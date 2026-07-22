import { describe, it, expect, vi, beforeEach } from 'vitest';
const send = vi.fn();
vi.mock('../dynamodb', () => ({ docClient: { send: (...a: unknown[]) => send(...a) }, TABLE_NAME: () => 'T' }));
const readState = vi.fn();
vi.mock('../sweep/sweepState', () => ({ readState: (...a: unknown[]) => readState(...a) }));
import { crmHealth } from './crmHealth';

beforeEach(() => {
  send.mockReset(); readState.mockReset();
  send.mockImplementation((cmd: { input: { ExpressionAttributeValues: Record<string, string> } }) => {
    const pk = cmd.input.ExpressionAttributeValues[':pk'];
    if (pk === 'CRM_REPAIR#pending') return Promise.resolve({ Items: [{ unitType: 'structured', unitKey: 'u1', targetOrgId: 'acme.com', attemptCount: 1, lastError: 'x', createdAt: 't' }], LastEvaluatedKey: undefined });
    if (pk === 'MERGE_RECON#needs_review') return Promise.resolve({ Items: [
      { fromOrgId: 'src.com', toOrgId: 'tgt.com', version: 3, residualsDetected: true, residualSamples: ['RFQ#1'], probedAt: 'p1', extraneous: 'never-mapped' },
      { fromOrgId: 'old.com', toOrgId: 'tgt.com', version: 5, residualsDetected: false, residualSamples: [], probedAt: 'p2' },
    ], LastEvaluatedKey: undefined });
    // v2 stuck markers live in REASON-KEYED partitions (Task 9) — the health bucket must merge them.
    if (pk === 'CRM_REPAIR#stuck#target_unavailable') return Promise.resolve({ Items: [
      { unitType: 'structured', unitKey: 'u2', generation: '01A', targetOrgId: 'gone.com', stuckReason: 'org gone.com archived without successor', stuckReasonClass: 'target_unavailable', lastError: null, createdAt: 't3' },
    ], LastEvaluatedKey: undefined });
    if (pk === 'CRM_REPAIR#stuck#other') return Promise.resolve({ Items: [
      { unitType: 'structured', unitKey: 'u3', generation: '01B', targetOrgId: 'c.com', stuckReason: 'max_attempts', stuckReasonClass: 'other', lastError: 'boom', createdAt: 't4' },
    ], LastEvaluatedKey: undefined });
    return Promise.resolve({ Items: [{ unitType: 'analytics', unitKey: 'v1', targetOrgId: 'b.com', stuckReason: 'source_conflict', lastError: 'c', createdAt: 't2' }], LastEvaluatedKey: { z: 1 } });
  });
  readState.mockImplementation((mode: string, pass: string) => {
    if (mode === 'repair') return Promise.resolve({ lastSummary: { repaired: 3 } });
    if (mode === 'hot') return Promise.resolve({ lastSummary: { expected: 9 }, hasMore: false });
    if (mode === 'cold' && pass === 'existence') return Promise.resolve({ lastSummary: { expected: 42 }, hasMore: true });
    return Promise.resolve({ lastSummary: { repaired: 2 } }); // cold dirty-rollups
  });
});

describe('crmHealth', () => {
  it('returns bounded repair buckets + four sweep summaries with NO Scan', async () => {
    const h = await crmHealth();
    for (const c of send.mock.calls) expect(c[0].constructor.name).not.toBe('ScanCommand');
    expect(h.repairPending).toMatchObject({ count: 1, more: false });
    expect((h.repairPending as { sample: unknown[] }).sample[0]).toMatchObject({ unitKey: 'u1' });
    expect(h.repairStuck).toMatchObject({ count: 3, more: true }); // v1 legacy + both reason-keyed v2 partitions, merged
    expect(h.lastRepairSummary).toEqual({ repaired: 3 });
    expect(h.lastHotSweep).toMatchObject({ expected: 9, hasMore: false });
    expect(h.lastColdSweep).toMatchObject({ expected: 42, hasMore: true });
    expect(h.lastDirtyRollupSweep).toEqual({ repaired: 2 });
  });
  it('caps the Query Limit at the sample size', async () => {
    await crmHealth();
    // repair buckets query 25; the merge-review list is bounded at 20 — every query stays bounded
    for (const c of send.mock.calls) expect(c[0].input.Limit).toBeLessThanOrEqual(25);
  });
  it('(a) stuck bucket surfaces v2 target_unavailable + v2 other + legacy v1 markers together', async () => {
    const h = await crmHealth();
    const sample = (h.repairStuck as { sample: Array<Record<string, unknown>> }).sample;
    expect(sample).toContainEqual(expect.objectContaining({ unitKey: 'v1', stuckReason: 'source_conflict' }));                       // legacy v1
    expect(sample).toContainEqual(expect.objectContaining({ unitKey: 'u2', stuckReasonClass: 'target_unavailable' }));               // v2 blocked chain
    expect(sample).toContainEqual(expect.objectContaining({ unitKey: 'u3', stuckReasonClass: 'other', stuckReason: 'max_attempts' })); // v2 aged-out
    expect(sample.find((s) => s.unitKey === 'v1')).not.toHaveProperty('stuckReasonClass');   // absent on v1, not null-stuffed
  });
  it('(b) stuck coverage = THREE bounded KeyCondition queries (legacy + both reason-keyed) — no FilterExpression, no Scan', async () => {
    await crmHealth();
    const stuckQs = send.mock.calls.filter((c) => String(c[0].input.ExpressionAttributeValues[':pk']).startsWith('CRM_REPAIR#stuck'));
    expect(stuckQs.map((c) => c[0].input.ExpressionAttributeValues[':pk']).sort()).toEqual(
      ['CRM_REPAIR#stuck', 'CRM_REPAIR#stuck#other', 'CRM_REPAIR#stuck#target_unavailable']);
    for (const c of stuckQs) {
      expect(c[0].input.KeyConditionExpression).toBe('GSI1PK = :pk');
      expect(c[0].input.FilterExpression).toBeUndefined();
      expect(c[0].input.Limit).toBe(25);
      expect(c[0].constructor.name).not.toBe('ScanCommand');
    }
  });
  it('mergeNeedsReviewCount + bounded mergeReviewMarkers from ONE GSI1 query on MERGE_RECON#needs_review', async () => {
    const h = await crmHealth();
    const reviewQs = send.mock.calls.filter((c) => c[0].input.ExpressionAttributeValues[':pk'] === 'MERGE_RECON#needs_review');
    expect(reviewQs).toHaveLength(1);
    expect(reviewQs[0][0].input.Limit).toBe(20);
    expect(reviewQs[0][0].input.ScanIndexForward).toBe(true);   // GSI1SK = mergedAt ⇒ oldest first
    expect(h.mergeNeedsReviewCount).toBe(2);
    expect(h.mergeReviewMarkers).toEqual([
      { fromOrgId: 'src.com', toOrgId: 'tgt.com', version: 3, residualsDetected: true, residualSamples: ['RFQ#1'], probedAt: 'p1' },
      { fromOrgId: 'old.com', toOrgId: 'tgt.com', version: 5, residualsDetected: false, residualSamples: [], probedAt: 'p2' },
    ]);
  });
});
