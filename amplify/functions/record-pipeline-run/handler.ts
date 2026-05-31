import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import {
    pipelineRunSummaryKey,
    pipelineRunSourceKey,
    pipelineRunGsi5Sk,
    reduceNotificationStatus,
    type PipelineRunSummary,
    type PipelineRunSource,
    type NotifyOutcome,
    type TenderSource,
} from '../../lib/tender-watch/pipeline-run-types';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = () => process.env.INTELLIGENCE_TABLE!;

type FetchOutputLike = {
    source: TenderSource;
    fetched: number;
    stagedKey: string | null;
    errorName?: string;
    errorCause?: string;
    error?: string;
};

type MatchLike = {
    tenderId: string;
    source: string;
    matches: { productSlug: string; productCategory: string; score: number }[];
    attempted: 0 | 1;
    llmTimeout: boolean;
    llmError: boolean;
};

type NormalizePerSource = Record<string, { fetched: number; normalized: number; duplicates: number }>;
type PrefilterPerSource = Record<string, { candidates: number }>;

export interface RecordEvent {
    kind: 'COMPLETE' | 'FAILED';
    executionId: string;
    startedAt: string;
    endedAt: string;
    stepFunctionExecutionArn: string;
    fetchResults?: FetchOutputLike[];
    normalized?: { newTenderIds: string[]; skipped: number; perSource: NormalizePerSource };
    prefilter?: { candidates: unknown[]; candidatesCount: number; perSource: PrefilterPerSource };
    matches?: MatchLike[];
    classified?: { tendersUpdated: number; highPriorityTenderIds: string[]; digestTenderIds: string[] };
    notifyHp?: NotifyOutcome;
    notifyDigest?: NotifyOutcome;
    errorName?: string;
    errorCause?: string;
}

const ALL_SOURCES: TenderSource[] = ['sam', 'ted', 'calusource', 'uofa', 'txesbd', 'nyscr'];

function durationMs(startedAt: string, endedAt: string): number {
    return Math.max(0, new Date(endedAt).getTime() - new Date(startedAt).getTime());
}

function avg(nums: number[]): number | null {
    if (nums.length === 0) return null;
    return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function safeDiv(num: number, den: number): number | null {
    if (den <= 0) return null;
    return num / den;
}

function buildFailedSummary(event: RecordEvent): PipelineRunSummary {
    const lastError = `${event.errorName ?? 'UnknownError'}: ${event.errorCause ?? ''}`.slice(0, 1024);
    return {
        ...pipelineRunSummaryKey(event.executionId),
        GSI5PK: 'PIPELINE_RUNS',
        GSI5SK: pipelineRunGsi5Sk(event.startedAt, event.executionId),
        entityType: 'PIPELINE_RUN_SUMMARY',
        executionId: event.executionId,
        stepFunctionExecutionArn: event.stepFunctionExecutionArn,
        status: 'FAILED',
        notificationStatus: 'SKIPPED',
        notificationError: null,
        startedAt: event.startedAt,
        endedAt: event.endedAt,
        durationMs: durationMs(event.startedAt, event.endedAt),
        sourcesAttempted: ALL_SOURCES,
        sourcesSucceeded: [],
        sourcesFailed: [],
        totalFetched: 0,
        totalDedupedCandidates: 0,
        totalNewTenders: 0,
        totalPrefilterCandidates: 0,
        totalScored: 0,
        totalHighPriority: 0,
        totalNotified: 0,
        lastError,
        createdAt: new Date().toISOString(),
    };
}

function buildCompleteSummary(event: RecordEvent): PipelineRunSummary {
    const fetchResults = event.fetchResults ?? [];
    const reportedSources = new Set(fetchResults.map(r => r.source));
    const sourcesMissing = ALL_SOURCES.filter(s => !reportedSources.has(s));
    const sourcesFailed = [
        ...fetchResults.filter(r => r.errorName || r.errorCause || r.error).map(r => r.source),
        ...sourcesMissing,
    ];
    const sourcesSucceeded = ALL_SOURCES.filter(s => !sourcesFailed.includes(s));
    const status: 'SUCCESS' | 'PARTIAL' = sourcesFailed.length > 0 ? 'PARTIAL' : 'SUCCESS';
    const matches = event.matches ?? [];
    const notify = reduceNotificationStatus(
        event.notifyHp ?? { status: 'skipped' },
        event.notifyDigest ?? { status: 'skipped' },
    );

    return {
        ...pipelineRunSummaryKey(event.executionId),
        GSI5PK: 'PIPELINE_RUNS',
        GSI5SK: pipelineRunGsi5Sk(event.startedAt, event.executionId),
        entityType: 'PIPELINE_RUN_SUMMARY',
        executionId: event.executionId,
        stepFunctionExecutionArn: event.stepFunctionExecutionArn,
        status,
        notificationStatus: notify.status,
        notificationError: notify.error,
        startedAt: event.startedAt,
        endedAt: event.endedAt,
        durationMs: durationMs(event.startedAt, event.endedAt),
        sourcesAttempted: ALL_SOURCES,
        sourcesSucceeded,
        sourcesFailed,
        totalFetched: fetchResults.reduce((sum, r) => sum + (r.fetched ?? 0), 0),
        totalDedupedCandidates: Object.values(event.normalized?.perSource ?? {}).reduce((sum, r) => sum + r.normalized + r.duplicates, 0),
        totalNewTenders: event.normalized?.newTenderIds.length ?? 0,
        totalPrefilterCandidates: event.prefilter?.candidatesCount ?? 0,
        totalScored: matches.filter(m => m.matches.length > 0).length,
        totalHighPriority: event.classified?.highPriorityTenderIds.length ?? 0,
        totalNotified: (event.notifyHp?.count ?? 0) + (event.notifyDigest?.count ?? 0),
        lastError: sourcesFailed.length > 0 ? fetchResults.find(r => r.errorCause || r.error)?.errorCause ?? fetchResults.find(r => r.error)?.error ?? null : null,
        createdAt: new Date().toISOString(),
    };
}

function buildSourceRow(event: RecordEvent, fr: FetchOutputLike, notifyHpSent: boolean): PipelineRunSource {
    const src = fr.source;
    const failed = Boolean(fr.errorName || fr.errorCause || fr.error);
    const matchesForSrc = (event.matches ?? []).filter(m => m.source === src);
    const llmScores = matchesForSrc.flatMap(m => m.matches.map(x => x.score));
    const normalizedCounts = event.normalized?.perSource[src];
    const prefilterCounts = event.prefilter?.perSource[src];
    const scoredForSrc = matchesForSrc.filter(m => m.matches.length > 0).length;
    const hpForSrc = (event.classified?.highPriorityTenderIds ?? []).filter(id => matchesForSrc.some(m => m.tenderId === id)).length;
    const completedStages: PipelineRunSource['completedStages'] = failed
        ? ['fetch']
        : ['fetch', 'normalize', 'prefilter', 'match', 'classify', 'notify'];

    return {
        ...pipelineRunSourceKey(event.executionId, src),
        entityType: 'PIPELINE_RUN_SOURCE',
        executionId: event.executionId,
        source: src,
        status: failed ? 'FAILED' : 'SUCCESS',
        isPartial: false,
        completedStages,
        startedAt: event.startedAt,
        endedAt: event.endedAt,
        durationMs: durationMs(event.startedAt, event.endedAt),
        fetched: fr.fetched ?? 0,
        normalized: normalizedCounts?.normalized ?? null,
        prefilterCandidates: prefilterCounts?.candidates ?? null,
        scored: failed ? null : scoredForSrc,
        highPriority: failed ? null : hpForSrc,
        notified: failed ? null : (notifyHpSent ? hpForSrc : null),
        prefilterPassRate: safeDiv(prefilterCounts?.candidates ?? 0, normalizedCounts?.normalized ?? 0),
        llmAttemptedCount: matchesForSrc.length,
        llmScoredCount: scoredForSrc,
        llmAvgScore: avg(llmScores),
        llmErrorCount: matchesForSrc.filter(m => m.llmError).length,
        llmTimeoutCount: matchesForSrc.filter(m => m.llmTimeout).length,
        duplicateRate: safeDiv(normalizedCounts?.duplicates ?? 0, fr.fetched ?? 0),
        stagedKey: fr.stagedKey ?? null,
        errorName: fr.errorName ?? null,
        errorCause: fr.errorCause ?? fr.error ?? null,
        createdAt: new Date().toISOString(),
    };
}

export async function handler(event: RecordEvent): Promise<{ ok: true }> {
    const summary = event.kind === 'FAILED' ? buildFailedSummary(event) : buildCompleteSummary(event);
    await ddb.send(new PutCommand({ TableName: TABLE(), Item: summary }));

    if (event.kind === 'COMPLETE' && event.fetchResults) {
        const notifyHpSent = event.notifyHp?.status === 'sent';
        await Promise.allSettled(event.fetchResults.map(async (fr) => {
            try {
                await ddb.send(new PutCommand({ TableName: TABLE(), Item: buildSourceRow(event, fr, notifyHpSent) }));
            } catch (err) {
                console.warn(JSON.stringify({ event: 'record-pipeline-run.source-row-failed', source: fr.source, error: String(err) }));
            }
        }));
    }
    return { ok: true };
}
