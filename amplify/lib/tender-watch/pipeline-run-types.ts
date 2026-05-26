/**
 * Shapes and key builders for pipeline-run rows in IntelligenceTable.
 * Spec: docs/superpowers/specs/2026-05-27-tender-watch-monitoring-design.md
 */

export type TenderSource = 'sam' | 'ted' | 'calusource';

export interface NotifyOutcome {
    status: 'sent' | 'skipped' | 'failed';
    count?: number;
    error?: string;
}

export interface PipelineRunSummary {
    PK: string;
    SK: 'SUMMARY';
    GSI5PK: 'PIPELINE_RUNS';
    GSI5SK: string;
    entityType: 'PIPELINE_RUN_SUMMARY';
    executionId: string;
    stepFunctionExecutionArn: string;

    status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
    notificationStatus: 'SUCCESS' | 'FAILED' | 'SKIPPED' | 'PARTIAL';
    notificationError: string | null;

    startedAt: string;
    endedAt: string;
    durationMs: number;

    sourcesAttempted: TenderSource[];
    sourcesSucceeded: TenderSource[];
    sourcesFailed: TenderSource[];

    totalFetched: number;
    totalDedupedCandidates: number;
    totalNewTenders: number;
    totalPrefilterCandidates: number;
    totalScored: number;
    totalHighPriority: number;
    totalNotified: number;

    lastError: string | null;
    createdAt: string;
}

export interface PipelineRunSource {
    PK: string;
    SK: string;
    entityType: 'PIPELINE_RUN_SOURCE';
    executionId: string;
    source: TenderSource;

    status: 'SUCCESS' | 'FAILED';
    isPartial: boolean;
    completedStages: ('fetch' | 'normalize' | 'prefilter' | 'match' | 'classify' | 'notify')[];

    startedAt: string;
    endedAt: string;
    durationMs: number;

    fetched: number | null;
    normalized: number | null;
    prefilterCandidates: number | null;
    scored: number | null;
    highPriority: number | null;
    notified: number | null;

    prefilterPassRate: number | null;
    llmAttemptedCount: number | null;
    llmScoredCount: number | null;
    llmAvgScore: number | null;
    llmErrorCount: number | null;
    llmTimeoutCount: number | null;
    duplicateRate: number | null;

    stagedKey: string | null;
    errorName: string | null;
    errorCause: string | null;
    createdAt: string;
}

export function pipelineRunSummaryKey(executionId: string): { PK: string; SK: 'SUMMARY' } {
    return { PK: `RUN#${executionId}`, SK: 'SUMMARY' };
}

export function pipelineRunSourceKey(executionId: string, source: TenderSource): { PK: string; SK: string } {
    return { PK: `RUN#${executionId}`, SK: `SOURCE#${source}` };
}

export function pipelineRunGsi5Sk(startedAt: string, executionId: string): string {
    return `${startedAt}#${executionId}`;
}

export function reduceNotificationStatus(
    hp: NotifyOutcome,
    digest: NotifyOutcome,
): { status: 'SUCCESS' | 'FAILED' | 'SKIPPED' | 'PARTIAL'; error: string | null } {
    const hpFailed = hp.status === 'failed';
    const digestFailed = digest.status === 'failed';

    if (hpFailed && digestFailed) {
        const err = [hp.error, digest.error].filter(Boolean).join(' | ');
        return { status: 'FAILED', error: err || 'both notifications failed' };
    }

    if (hpFailed || digestFailed) {
        const err = hp.error ?? digest.error ?? 'one notification failed';
        return { status: 'PARTIAL', error: err };
    }

    if (hp.status === 'skipped' && digest.status === 'skipped') {
        return { status: 'SKIPPED', error: null };
    }

    return { status: 'SUCCESS', error: null };
}
