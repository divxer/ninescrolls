import { describe, it, expect, vi, beforeEach } from 'vitest';
const mockSend = vi.fn();
vi.mock('../dynamodb', () => ({ docClient: { send: (...a: unknown[]) => mockSend(...a) }, TABLE_NAME: () => 'T' }));
const recompute = vi.fn(); const mark = vi.fn();
vi.mock('../orgStore', () => ({ recomputeRollupsForOrg: (o: string) => recompute(o) }));
vi.mock('../timelineStore', () => ({ markRollupApplied: (id: string) => mark(id) }));
import { runDirtyRollupPage } from './dirtyRollupPass';
beforeEach(() => { mockSend.mockReset(); recompute.mockReset(); mark.mockReset(); });

describe('dirty-rollup pass', () => {
  it('repairs each dirty row: recompute pending + org, then mark clean', async () => {
    mockSend.mockResolvedValueOnce({ Items: [
      { id: 'tev-1', orgId: 'org-NEW', rollupPendingOrgId: 'org-OLD' },
      { id: 'tev-2', orgId: 'org-x', rollupPendingOrgId: null },
    ] });
    const out = await runDirtyRollupPage({ limit: 50 });
    expect(recompute).toHaveBeenCalledWith('org-OLD');
    expect(recompute).toHaveBeenCalledWith('org-NEW');
    expect(recompute).toHaveBeenCalledWith('org-x');
    expect(mark).toHaveBeenCalledWith('tev-1');
    expect(mark).toHaveBeenCalledWith('tev-2');
    expect(out.counters).toMatchObject({ dirtyFound: 2, repaired: 2, errors: 0 });
  });
  it('skips a sentinel unresolved org defensively (no recompute) but still marks clean', async () => {
    mockSend.mockResolvedValueOnce({ Items: [{ id: 'tev-3', orgId: 'unresolved-rfq-1', rollupPendingOrgId: null }] });
    await runDirtyRollupPage({ limit: 50 });
    expect(recompute).not.toHaveBeenCalled();
    expect(mark).toHaveBeenCalledWith('tev-3');
  });
  it('uses a scan filtered on rollupApplied=false and returns the cursor', async () => {
    mockSend.mockResolvedValueOnce({ Items: [], LastEvaluatedKey: { k: 1 } });
    const out = await runDirtyRollupPage({ limit: 50 });
    const scan = mockSend.mock.calls[0][0].input;
    expect(JSON.stringify(scan.ExpressionAttributeValues)).toContain('false');
    expect(out.hasMore).toBe(true);
  });
  it('isolates a per-row failure: errors++, failed row left dirty, next row still repaired', async () => {
    mockSend.mockResolvedValueOnce({ Items: [
      { id: 'tev-1', orgId: 'org-a', rollupPendingOrgId: null },
      { id: 'tev-2', orgId: 'org-b', rollupPendingOrgId: null },
    ] });
    recompute.mockRejectedValueOnce(new Error('boom')).mockResolvedValue(undefined); // tev-1 recompute fails
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const out = await runDirtyRollupPage({ limit: 50 });
    expect(mark).not.toHaveBeenCalledWith('tev-1'); // failed row stays rollupApplied=false → retried next cycle
    expect(mark).toHaveBeenCalledWith('tev-2');      // batch continues; next row repaired
    expect(out.counters).toMatchObject({ dirtyFound: 2, repaired: 1, errors: 1 });
    errSpy.mockRestore();
  });
});
