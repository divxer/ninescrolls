import type { AppSyncResolverEvent } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
    DynamoDBDocumentClient,
    GetCommand,
    PutCommand,
    QueryCommand,
    UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { ulid } from 'ulid';
import {
    tenderKeywordConfigItemKey, tenderKeywordConfigActiveGsiKey,
    tenderStatusLogItemKey,
    TENDER_STATUSES, ACTIVE_TENDER_STATUSES, type TenderStatus,
} from '../../lib/tender-watch/keys';
import { matchesAnyConfig } from '../../lib/tender-watch/prefilter';
import type { TenderKeywordConfigItem } from '../../lib/tender-watch/types';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import Anthropic from '@anthropic-ai/sdk';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = () => process.env.INTELLIGENCE_TABLE!;
const bedrock = new BedrockRuntimeClient({});
const BEDROCK_TIMEOUT_MS = 8000;
const ANTHROPIC_TIMEOUT_MS = 20000;

const ADMIN_GROUP = 'admin';

export async function handler(event: AppSyncResolverEvent<Record<string, unknown>> & { fieldName?: string }): Promise<unknown> {
    requireAdmin(event);
    const identity = (event.identity as { username?: string } | null)?.username ?? 'unknown';
    // Amplify Gen 2's `a.handler.function()` path sends fieldName at the event root.
    // Standard AppSync wraps it under event.info. Support both.
    const fieldName = (event.info as { fieldName?: string } | undefined)?.fieldName
        ?? (event as { fieldName?: string }).fieldName;
    return dispatchFieldName(fieldName as string, event, identity);
}

/**
 * AppSync admin gate. Expects Cognito-authenticated callers with a `groups` claim
 * containing 'admin'. Other auth modes (IAM, API key) leave `event.identity.groups`
 * undefined and are rejected here.
 */
function requireAdmin(event: AppSyncResolverEvent<Record<string, unknown>>): void {
    const groups = (event.identity as { groups?: string[] } | null)?.groups ?? [];
    if (!groups.includes(ADMIN_GROUP)) {
        throw new Error('Unauthorized: admin group required');
    }
}

async function dispatchFieldName(
    fieldName: string,
    event: AppSyncResolverEvent<Record<string, unknown>>,
    identity: string,
): Promise<unknown> {
    switch (fieldName) {
        case 'listTenders':
            return listTenders(event.arguments);
        case 'getTender':
            return getTender(event.arguments);
        case 'listTenderKeywordConfigs':
            return listKeywordConfigs(event.arguments);
        case 'listPipelineRuns':
            return listPipelineRuns(event.arguments);
        case 'getPipelineRun':
            return getPipelineRun(event.arguments);
        case 'updateTenderStatus':
            return updateTenderStatus(event.arguments, identity);
        case 'bulkUpdateTenderStatus':
            return bulkUpdateTenderStatus(event.arguments, identity);
        case 'upsertTenderKeywordConfig':
            return upsertKeywordConfig(event.arguments, identity);
        case 'runPrefilterPreview':
            return runPrefilterPreview(event.arguments);
        case 'translateTenderDescription':
            return translateDescription(event.arguments);
        default:
            throw new Error(`Unknown fieldName: ${fieldName}`);
    }
}

interface ListTendersArgs {
    statuses?: string[];
    includeExpired?: boolean;
    countries?: string[];
    categories?: string[];
    minScore?: number;
    postedDateFrom?: string;
    postedDateTo?: string;
    search?: string;
    sortBy?: 'score' | 'postedDate' | 'deadline';
    sortDir?: 'asc' | 'desc';
    limit?: number;
    nextToken?: string;
}

async function listTenders(args: ListTendersArgs) {
    const statuses = (args.statuses?.length ? args.statuses : [...ACTIVE_TENDER_STATUSES]) as TenderStatus[];
    const limit = args.limit ?? 25;
    const sortBy = args.sortBy ?? 'score';
    const sortDir = args.sortDir ?? 'desc';

    // If filters are restrictive, fetch more candidates per status so the
    // post-filter page isn't near-empty. Heuristic: any of country / category /
    // minScore / search / postedDate range bump us to 10x.
    const hasRestrictiveFilter =
        (args.countries?.length ?? 0) > 0 ||
        (args.categories?.length ?? 0) > 0 ||
        typeof args.minScore === 'number' ||
        !!args.search ||
        !!args.postedDateFrom ||
        !!args.postedDateTo;
    const fetchMultiplier = hasRestrictiveFilter ? 10 : 2;

    // Fan-out one Query per requested status on GSI1
    const queries = await Promise.all(
        statuses.map((status) =>
            ddb.send(new QueryCommand({
                TableName: TABLE(),
                IndexName: 'GSI1',
                KeyConditionExpression: 'GSI1PK = :pk',
                ExpressionAttributeValues: { ':pk': `TENDER_STATUS#${status}` },
                Limit: limit * fetchMultiplier,
            })),
        ),
    );
    let items: Record<string, unknown>[] = queries.flatMap((q) => q.Items ?? []);

    // In-memory filters
    if (!args.includeExpired) {
        items = items.filter((i) => !i.isExpired);
    }
    if (args.countries?.length) {
        items = items.filter((i) => args.countries!.includes(i.country as string));
    }
    if (typeof args.minScore === 'number') {
        items = items.filter((i) => ((i.overallScore as number) ?? 0) >= args.minScore!);
    }
    if (args.postedDateFrom) {
        items = items.filter((i) => ((i.postedDate as string) ?? '') >= args.postedDateFrom!);
    }
    if (args.postedDateTo) {
        items = items.filter((i) => ((i.postedDate as string) ?? '') <= args.postedDateTo!);
    }
    if (args.search) {
        const needle = args.search.toLowerCase();
        items = items.filter((i) =>
            ((i.title as string) ?? '').toLowerCase().includes(needle) ||
            ((i.agency as string) ?? '').toLowerCase().includes(needle),
        );
    }
    if (args.categories?.length) {
        // Match against matchedProductCategories (denormalized array on Tender; written by classify-and-store)
        items = items.filter((i) => {
            const cats = (i.matchedProductCategories ?? []) as string[];
            return args.categories!.some((c) => cats.includes(c));
        });
    }

    // Sort
    const cmp = (a: Record<string, unknown>, b: Record<string, unknown>) => {
        let av: string | number; let bv: string | number;
        if (sortBy === 'score') { av = (a.overallScore as number) ?? 0; bv = (b.overallScore as number) ?? 0; }
        else if (sortBy === 'postedDate') { av = (a.postedDate as string) ?? ''; bv = (b.postedDate as string) ?? ''; }
        else if (sortBy === 'deadline') { av = (a.deadline as string) ?? '9999-99-99'; bv = (b.deadline as string) ?? '9999-99-99'; }
        else { av = 0; bv = 0; }
        const dir = sortDir === 'asc' ? 1 : -1;
        return av < bv ? -dir : av > bv ? dir : 0;
    };
    items.sort(cmp);

    // totalActiveUnfiltered — fire one COUNT query per active status
    const countQueries = await Promise.all(
        ACTIVE_TENDER_STATUSES.map((s) =>
            ddb.send(new QueryCommand({
                TableName: TABLE(),
                IndexName: 'GSI1',
                KeyConditionExpression: 'GSI1PK = :pk',
                ExpressionAttributeValues: { ':pk': `TENDER_STATUS#${s}` },
                Select: 'COUNT',
            })),
        ),
    );
    const totalActiveUnfiltered = countQueries.reduce((sum, q) => sum + (q.Count ?? 0), 0);

    return {
        items: items.slice(0, limit),
        nextToken: null,  // TODO(phase-d): true pagination — current pass returns first page only
        totalActiveUnfiltered,
    };
}

async function getTender(args: { tenderId: string }) {
    const [metaRes, matchesRes, logRes] = await Promise.all([
        ddb.send(new GetCommand({
            TableName: TABLE(),
            Key: { PK: `TENDER#${args.tenderId}`, SK: 'METADATA' },
        })),
        ddb.send(new QueryCommand({
            TableName: TABLE(),
            KeyConditionExpression: 'PK = :pk AND begins_with(SK, :m)',
            ExpressionAttributeValues: { ':pk': `TENDER#${args.tenderId}`, ':m': 'MATCH#' },
        })),
        ddb.send(new QueryCommand({
            TableName: TABLE(),
            KeyConditionExpression: 'PK = :pk AND begins_with(SK, :l)',
            ExpressionAttributeValues: { ':pk': `TENDER#${args.tenderId}`, ':l': 'LOG#' },
            ScanIndexForward: false,
            Limit: 100,
        })),
    ]);
    if (!metaRes.Item) throw new Error(`Tender not found: ${args.tenderId}`);
    return {
        tender: metaRes.Item,
        matches: (matchesRes.Items ?? []).sort((a, b) => ((b.score as number) ?? 0) - ((a.score as number) ?? 0)),
        log: logRes.Items ?? [],
    };
}

async function listKeywordConfigs(args: { includeInactive?: boolean }) {
    if (args.includeInactive) {
        const r = await ddb.send(new QueryCommand({
            TableName: TABLE(),
            KeyConditionExpression: 'PK = :pk',
            ExpressionAttributeValues: { ':pk': 'TENDER_KEYWORD_CONFIG' },
        }));
        return r.Items ?? [];
    }
    const r = await ddb.send(new QueryCommand({
        TableName: TABLE(),
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :pk',
        ExpressionAttributeValues: { ':pk': 'TENDER_KEYWORD_CONFIG_ACTIVE' },
    }));
    return r.Items ?? [];
}

async function listPipelineRuns(args: { limit?: number }) {
    const r = await ddb.send(new QueryCommand({
        TableName: TABLE(),
        IndexName: 'GSI5',
        KeyConditionExpression: 'GSI5PK = :pk',
        ExpressionAttributeValues: { ':pk': 'PIPELINE_RUNS' },
        ScanIndexForward: false,
        Limit: args.limit ?? 100,
    }));
    return r.Items ?? [];
}

async function getPipelineRun(args: { executionId: string }) {
    const r = await ddb.send(new QueryCommand({
        TableName: TABLE(),
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: { ':pk': `RUN#${args.executionId}` },
    }));
    const items = r.Items ?? [];
    return {
        summary: items.find((i) => i.SK === 'SUMMARY') ?? null,
        sources: items.filter((i) => typeof i.SK === 'string' && i.SK.startsWith('SOURCE#')),
    };
}

async function updateTenderStatus(
    args: { tenderId: string; toStatus: string; note?: string; assignedTo?: string },
    identity: string,
) {
    if (!(TENDER_STATUSES as readonly string[]).includes(args.toStatus)) {
        throw new Error(`Invalid status: ${args.toStatus}`);
    }
    // 1. GetItem current to know fromStatus + updatedAt for optimistic lock
    const existing = await ddb.send(new GetCommand({
        TableName: TABLE(),
        Key: { PK: `TENDER#${args.tenderId}`, SK: 'METADATA' },
    }));
    if (!existing.Item) throw new Error(`Tender not found: ${args.tenderId}`);
    const fromStatus = (existing.Item.status as string) ?? 'new';
    const prevUpdatedAt = existing.Item.updatedAt as string;
    const nowIso = new Date().toISOString();

    // 2. UpdateItem with optimistic lock
    const setExprs: string[] = [
        '#st = :toStatus',
        'lastStatusChangedAt = :now',
        'updatedAt = :now',
        'GSI1PK = :gsi1pk',
    ];
    const exprValues: Record<string, unknown> = {
        ':toStatus': args.toStatus,
        ':now': nowIso,
        ':gsi1pk': `TENDER_STATUS#${args.toStatus}`,
        ':prevUpdatedAt': prevUpdatedAt,
    };
    const exprNames: Record<string, string> = { '#st': 'status' };
    if (args.note !== undefined) {
        setExprs.push('statusNote = :note');
        exprValues[':note'] = args.note;
    }
    if (args.assignedTo !== undefined) {
        setExprs.push('assignedTo = :assigned');
        exprValues[':assigned'] = args.assignedTo;
    }

    let updated;
    try {
        updated = await ddb.send(new UpdateCommand({
            TableName: TABLE(),
            Key: { PK: `TENDER#${args.tenderId}`, SK: 'METADATA' },
            UpdateExpression: `SET ${setExprs.join(', ')}`,
            ConditionExpression: 'updatedAt = :prevUpdatedAt',
            ExpressionAttributeNames: exprNames,
            ExpressionAttributeValues: exprValues,
            ReturnValues: 'ALL_NEW',
        }));
    } catch (err) {
        if ((err as { name?: string })?.name === 'ConditionalCheckFailedException') {
            throw new Error('Conflict: tender was modified by another user');
        }
        throw err;
    }

    // 3. PutItem log entry
    await ddb.send(new PutCommand({
        TableName: TABLE(),
        Item: {
            ...tenderStatusLogItemKey(args.tenderId, nowIso, ulid()),
            entityType: 'TENDER_STATUS_LOG',
            tenderId: args.tenderId,
            fromStatus,
            toStatus: args.toStatus,
            changedBy: identity,
            changedAt: nowIso,
            ...(args.note !== undefined ? { note: args.note } : {}),
        },
    }));

    console.log(JSON.stringify({
        event: 'tender.status.updated',
        tenderId: args.tenderId,
        fromStatus,
        toStatus: args.toStatus,
        changedBy: identity,
    }));

    return updated.Attributes;
}

async function bulkUpdateTenderStatus(
    args: { tenderIds: string[]; toStatus: string },
    identity: string,
) {
    if (args.tenderIds.length > 50) {
        throw new Error('bulk update limit exceeded: maximum 50 tenders per request');
    }
    // Concurrency limit of 10 — chunk into batches and Promise.allSettled per chunk.
    const CHUNK = 10;
    let success = 0;
    for (let i = 0; i < args.tenderIds.length; i += CHUNK) {
        const chunk = args.tenderIds.slice(i, i + CHUNK);
        const results = await Promise.allSettled(
            chunk.map((tid) => updateTenderStatus({ tenderId: tid, toStatus: args.toStatus }, identity)),
        );
        success += results.filter((r) => r.status === 'fulfilled').length;
        for (const r of results) {
            if (r.status === 'rejected') {
                console.warn(JSON.stringify({
                    event: 'tender.bulk.update-failed',
                    error: String(r.reason),
                    changedBy: identity,
                }));
            }
        }
    }
    return success;
}

async function upsertKeywordConfig(
    args: {
        productCategory: string;
        productSlugs: string[];
        keywords: string[];
        synonyms: string[];
        blacklist: string[];
        naicsCodes: string[];
        cpvCodes: string[];
        isActive: boolean;
    },
    identity: string,
) {
    const nowIso = new Date().toISOString();
    const item: Record<string, unknown> = {
        ...tenderKeywordConfigItemKey(args.productCategory),
        entityType: 'TENDER_KEYWORD_CONFIG',
        ...args,
        updatedBy: identity,
        updatedAt: nowIso,
        ...(args.isActive ? tenderKeywordConfigActiveGsiKey(args.productCategory) : {}),
    };
    await ddb.send(new PutCommand({ TableName: TABLE(), Item: item }));
    console.log(JSON.stringify({
        event: 'tender.config.upserted',
        productCategory: args.productCategory,
        isActive: args.isActive,
        changedBy: identity,
    }));
    return item;
}

async function runPrefilterPreview(args: {
    title: string;
    description: string;
    naicsCodes?: string[];
    cpvCodes?: string[];
    configOverride?: unknown;
}) {
    const tender = {
        title: args.title,
        description: args.description,
        naicsCodes: args.naicsCodes ?? [],
        cpvCodes: args.cpvCodes ?? [],
    };
    let configs: TenderKeywordConfigItem[];
    if (args.configOverride) {
        // AppSync's AWSJSON scalar arrives as a string from the frontend service
        // layer (see tenderAdminService.runPrefilterPreview). Direct callers (tests,
        // future tooling) can still pass a parsed object — handle both.
        const rawOverride: unknown = typeof args.configOverride === 'string'
            ? JSON.parse(args.configOverride)
            : args.configOverride;
        // Defensively fill missing array/boolean fields so malformed inputs don't
        // crash matchesAnyConfig. Spec only requires the UI to send full configs,
        // but the mutation is exposed in the schema and other callers may not.
        const override = (rawOverride ?? {}) as Partial<TenderKeywordConfigItem>;
        configs = [{
            productCategory: override.productCategory ?? 'PREVIEW',
            productSlugs: override.productSlugs ?? [],
            keywords: override.keywords ?? [],
            synonyms: override.synonyms ?? [],
            blacklist: override.blacklist ?? [],
            naicsCodes: override.naicsCodes ?? [],
            cpvCodes: override.cpvCodes ?? [],
            isActive: override.isActive ?? true,
        } as TenderKeywordConfigItem];
    } else {
        const r = await ddb.send(new QueryCommand({
            TableName: TABLE(),
            IndexName: 'GSI1',
            KeyConditionExpression: 'GSI1PK = :pk',
            ExpressionAttributeValues: { ':pk': 'TENDER_KEYWORD_CONFIG_ACTIVE' },
        }));
        configs = (r.Items ?? []) as TenderKeywordConfigItem[];
    }
    const result = matchesAnyConfig(tender, configs);
    return {
        matchedCategories: result.matchedCategories,
        matchedKeywords: result.matchedKeywords,
        passed: result.matchedCategories.length > 0,
    };
}

async function translateDescription(args: { tenderId: string; force?: boolean }): Promise<string> {
    const existing = await ddb.send(new GetCommand({
        TableName: TABLE(),
        Key: { PK: `TENDER#${args.tenderId}`, SK: 'METADATA' },
    }));
    if (!existing.Item) throw new Error(`Tender not found: ${args.tenderId}`);

    const cached = existing.Item.descriptionEn as string | undefined;
    if (cached && !args.force) return cached;

    const description = (existing.Item.description as string | undefined) ?? '';
    const language = (existing.Item.language as string | undefined) ?? 'unknown';
    const prompt = buildTranslatePrompt(description, language);

    let translated: string | null = null;
    try {
        translated = await callBedrock(prompt);
    } catch (err) {
        console.warn(JSON.stringify({ event: 'tender.translate.bedrock-failed', tenderId: args.tenderId, error: String(err) }));
        try {
            translated = await callAnthropic(prompt);
        } catch (err2) {
            console.error(JSON.stringify({
                event: 'tender.translate.both-providers-failed',
                tenderId: args.tenderId,
                bedrockError: String(err),
                anthropicError: String(err2),
            }));
            throw new Error('Translation unavailable');
        }
    }

    const nowIso = new Date().toISOString();
    // Don't touch updatedAt — translation is a derived field, doesn't invalidate optimistic lock token.
    await ddb.send(new UpdateCommand({
        TableName: TABLE(),
        Key: { PK: `TENDER#${args.tenderId}`, SK: 'METADATA' },
        UpdateExpression: 'SET descriptionEn = :en, descriptionEnAt = :now',
        ExpressionAttributeValues: { ':en': translated, ':now': nowIso },
    }));
    return translated;
}

function buildTranslatePrompt(description: string, language: string): string {
    const truncated = description.length > 4000 ? description.slice(0, 4000) : description;
    return [
        'Translate this procurement tender description to English. Preserve technical terminology (CPV codes, model numbers, scientific units) verbatim. Output translation only, no commentary.',
        '',
        `Original (language: ${language}):`,
        truncated,
    ].join('\n');
}

async function callBedrock(prompt: string): Promise<string> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), BEDROCK_TIMEOUT_MS);
    try {
        const res = await bedrock.send(new InvokeModelCommand({
            modelId: process.env.BEDROCK_MODEL_ID!,
            contentType: 'application/json',
            accept: 'application/json',
            body: JSON.stringify({
                anthropic_version: 'bedrock-2023-05-31',
                max_tokens: 2000,
                messages: [{ role: 'user', content: prompt }],
            }),
        }), { abortSignal: ctrl.signal });
        const text = await (res.body as { transformToString(enc: string): Promise<string> }).transformToString('utf-8');
        const wrap = JSON.parse(text) as { content?: Array<{ text?: string }> };
        return ((wrap.content?.[0]?.text as string) ?? '').trim();
    } finally {
        clearTimeout(t);
    }
}

async function callAnthropic(prompt: string): Promise<string> {
    const client = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY!,
        timeout: ANTHROPIC_TIMEOUT_MS,
    });
    const res = await client.messages.create({
        model: process.env.CLAUDE_MODEL!,
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
    });
    const block = res.content[0] as { text?: string };
    return ((block?.text as string) ?? '').trim();
}

// Export internals for unit tests
export { dispatchFieldName, requireAdmin, ddb, TABLE, listTenders, getTender, listKeywordConfigs, listPipelineRuns, getPipelineRun, updateTenderStatus, bulkUpdateTenderStatus, upsertKeywordConfig, runPrefilterPreview, translateDescription };
