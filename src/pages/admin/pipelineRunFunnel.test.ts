import { describe, it, expect } from 'vitest';
import { buildFunnelRows } from './pipelineRunFunnel';

describe('buildFunnelRows', () => {
    it('returns 7 rows in canonical order with widths normalized to the max value', () => {
        const rows = buildFunnelRows({
            totalFetched: 147,
            totalDedupedCandidates: 142,
            totalNewTenders: 89,
            totalPrefilterCandidates: 12,
            totalScored: 5,
            totalHighPriority: 2,
            totalNotified: 2,
        } as any);
        expect(rows.map(r => r.label)).toEqual([
            'fetched', 'deduped', 'newTenders', 'prefilterCandidates', 'scored', 'highPriority', 'notified',
        ]);
        expect(rows[0].count).toBe(147);
        expect(rows[0].widthPct).toBe(100);
        const notifiedRow = rows.find(r => r.label === 'notified')!;
        expect(notifiedRow.widthPct).toBeGreaterThan(0);
        expect(notifiedRow.widthPct).toBeLessThan(5);
    });

    it('renders 0 as 0% width', () => {
        const rows = buildFunnelRows({
            totalFetched: 0,
            totalDedupedCandidates: 0,
            totalNewTenders: 0,
            totalPrefilterCandidates: 0,
            totalScored: 0,
            totalHighPriority: 0,
            totalNotified: 0,
        } as any);
        rows.forEach(r => expect(r.widthPct).toBe(0));
    });
});
