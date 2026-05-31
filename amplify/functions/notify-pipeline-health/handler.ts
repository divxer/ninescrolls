import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, BatchGetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import type { PipelineRunSummary, PipelineRunSource, TenderSource } from '../../lib/tender-watch/pipeline-run-types';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const ses = new SESv2Client({});

const TABLE = () => process.env.INTELLIGENCE_TABLE!;
const ALERT_EMAIL_TO = () => process.env.ALERT_EMAIL_TO ?? 'info@ninescrolls.com';
const ALERT_EMAIL_FROM = () => process.env.ALERT_EMAIL_FROM ?? 'info@ninescrolls.com';
const ZERO_FETCH_ALERT_SOURCES = () =>
    (process.env.ZERO_FETCH_ALERT_SOURCES ?? 'sam,ted,calusource,uofa,txesbd,nyscr').split(',').map(s => s.trim()).filter(Boolean);

interface Alert {
    level: 'CRITICAL' | 'WARNING';
    ruleId: string;
    scope: string;
    message: string;
}

async function fetchRecentSummaries(): Promise<PipelineRunSummary[]> {
    const now = new Date();
    const lo = new Date(now.getTime() - 48 * 3600 * 1000).toISOString();
    const res = await ddb.send(new QueryCommand({
        TableName: TABLE(),
        IndexName: 'GSI5',
        KeyConditionExpression: 'GSI5PK = :pk AND GSI5SK BETWEEN :lo AND :hi',
        ExpressionAttributeValues: { ':pk': 'PIPELINE_RUNS', ':lo': `${lo}#`, ':hi': `${now.toISOString()}#~` },
        ScanIndexForward: false,
        Limit: 10,
    }));
    return (res.Items ?? []) as PipelineRunSummary[];
}

async function fetchSourceRows(executionId: string): Promise<PipelineRunSource[]> {
    const sources: TenderSource[] = ['sam', 'ted', 'calusource', 'uofa', 'txesbd', 'nyscr'];
    const res = await ddb.send(new BatchGetCommand({
        RequestItems: { [TABLE()]: { Keys: sources.map(s => ({ PK: `RUN#${executionId}`, SK: `SOURCE#${s}` })) } },
    }));
    return (res.Responses?.[TABLE()] ?? []) as PipelineRunSource[];
}

function evaluateRules(runs: PipelineRunSummary[], latestSources: PipelineRunSource[]): Alert[] {
    if (runs.length === 0) {
        return [{ level: 'CRITICAL', ruleId: 'rule-1', scope: 'cron', message: 'No pipeline run in last 48h; cron may not be firing' }];
    }

    const alerts: Alert[] = [];
    const latest = runs[0];
    if (latest.status === 'FAILED') {
        alerts.push({ level: 'CRITICAL', ruleId: 'rule-2', scope: latest.executionId, message: `Latest run ${latest.executionId} FAILED: ${latest.lastError ?? 'unknown'}` });
    }
    if (latest.notificationStatus === 'FAILED' || latest.notificationStatus === 'PARTIAL') {
        alerts.push({ level: 'WARNING', ruleId: 'rule-3', scope: latest.executionId, message: `Notification layer ${latest.notificationStatus}: ${latest.notificationError ?? 'unknown'}` });
    }
    if (runs.length >= 2) {
        for (const src of ['sam', 'ted', 'calusource', 'uofa', 'txesbd', 'nyscr'] as TenderSource[]) {
            if (runs.slice(0, 2).every(r => (r.sourcesFailed ?? []).includes(src))) {
                alerts.push({ level: 'CRITICAL', ruleId: 'rule-4', scope: src, message: `Source "${src}" failed in 2 consecutive runs` });
            }
        }
    }
    if (latest.status !== 'FAILED') {
        const expectedSources = latest.sourcesAttempted ?? ['sam', 'ted', 'calusource', 'uofa', 'txesbd', 'nyscr'];
        if (latestSources.length < expectedSources.length) {
            alerts.push({ level: 'WARNING', ruleId: 'rule-7', scope: latest.executionId, message: `Run ${latest.executionId} has missing SOURCE rows` });
        }
        const zeroAlertSources = ZERO_FETCH_ALERT_SOURCES();
        for (const row of latestSources) {
            if (row.status === 'SUCCESS' && row.fetched === 0 && zeroAlertSources.includes(row.source)) {
                alerts.push({ level: 'CRITICAL', ruleId: 'rule-5', scope: row.source, message: `Source "${row.source}" returned 0 records in latest run` });
            }
        }
        const timeouts = latestSources.reduce((sum, row) => sum + (row.llmTimeoutCount ?? 0), 0);
        if (timeouts > 0) {
            alerts.push({ level: 'WARNING', ruleId: 'rule-6', scope: 'bedrock', message: `${timeouts} LLM timeouts in latest run` });
        }
    }

    // Phase C placeholders, disabled until there is at least two weeks of baseline:
    // rule-c1: source prefilter pass rate below baseline.
    // rule-c2: source LLM average score below baseline.
    // rule-c3: source duplicate rate above baseline.
    // rule-c4: no high-priority tenders in 7 consecutive runs.
    return alerts;
}

async function alreadySent(date: string, alert: Alert): Promise<boolean> {
    try {
        await ddb.send(new PutCommand({
            TableName: TABLE(),
            Item: {
                PK: `ALERT_SENT#${date}`,
                SK: `${alert.ruleId}#${alert.scope}`,
                entityType: 'ALERT_SENT_MARKER',
                TTL: Math.floor(Date.now() / 1000) + 48 * 3600,
            },
            ConditionExpression: 'attribute_not_exists(PK)',
        }));
        return false;
    } catch (err) {
        if ((err as { name?: string }).name === 'ConditionalCheckFailedException') return true;
        throw err;
    }
}

function emailFor(alerts: Alert[], runs: PipelineRunSummary[], latestSources: PipelineRunSource[]): { subject: string; body: string } {
    const top = alerts.find(a => a.level === 'CRITICAL') ?? alerts[0];
    const latest = runs[0];
    const body = [
        `Tender-watch health check - ${new Date().toISOString()}`,
        '',
        latest ? `Latest run ${latest.executionId}: ${latest.status}` : 'No recent runs.',
        '',
        'Alerts:',
        ...alerts.map(a => `${a.level} ${a.ruleId}: ${a.message}`),
        '',
        'Sources:',
        ...latestSources.map(s => `${s.source}: status=${s.status} fetched=${s.fetched ?? 'n/a'} llmTimeouts=${s.llmTimeoutCount ?? 0}`),
    ].join('\n');
    return { subject: `[${top.level}] tender-watch: ${top.message.slice(0, 90)}`, body };
}

export async function handler(_event: unknown): Promise<{ ok: true; alertsSent: number }> {
    const runs = await fetchRecentSummaries();
    const latestSources = runs[0] && runs[0].status !== 'FAILED' ? await fetchSourceRows(runs[0].executionId) : [];
    const alerts = evaluateRules(runs, latestSources);
    if (alerts.length === 0) return { ok: true, alertsSent: 0 };

    const today = new Date().toISOString().slice(0, 10);
    const fresh: Alert[] = [];
    for (const alert of alerts) {
        // eslint-disable-next-line no-await-in-loop
        if (!(await alreadySent(today, alert))) fresh.push(alert);
    }
    if (fresh.length === 0) return { ok: true, alertsSent: 0 };

    const email = emailFor(fresh, runs, latestSources);
    await ses.send(new SendEmailCommand({
        FromEmailAddress: ALERT_EMAIL_FROM(),
        Destination: { ToAddresses: [ALERT_EMAIL_TO()] },
        Content: {
            Simple: {
                Subject: { Data: email.subject, Charset: 'UTF-8' },
                Body: { Text: { Data: email.body, Charset: 'UTF-8' } },
            },
        },
    }));
    return { ok: true, alertsSent: fresh.length };
}
