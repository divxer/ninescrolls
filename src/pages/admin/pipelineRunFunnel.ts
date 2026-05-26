import type { PipelineRunSummary } from '../../../amplify/lib/tender-watch/pipeline-run-types';

export interface FunnelRow {
    label: string;
    count: number;
    widthPct: number;
}

const STAGES: { label: string; key: keyof PipelineRunSummary }[] = [
    { label: 'fetched', key: 'totalFetched' },
    { label: 'deduped', key: 'totalDedupedCandidates' },
    { label: 'newTenders', key: 'totalNewTenders' },
    { label: 'prefilterCandidates', key: 'totalPrefilterCandidates' },
    { label: 'scored', key: 'totalScored' },
    { label: 'highPriority', key: 'totalHighPriority' },
    { label: 'notified', key: 'totalNotified' },
];

export function buildFunnelRows(summary: PipelineRunSummary): FunnelRow[] {
    const max = Math.max(...STAGES.map(s => Number(summary[s.key] ?? 0)));
    return STAGES.map(s => {
        const count = Number(summary[s.key] ?? 0);
        const widthPct = max === 0 ? 0 : Math.round((count / max) * 100);
        return { label: s.label, count, widthPct };
    });
}
