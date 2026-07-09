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
    expect(h.repairStuck).toMatchObject({ count: 1, more: true });
    expect(h.lastRepairSummary).toEqual({ repaired: 3 });
    expect(h.lastHotSweep).toMatchObject({ expected: 9, hasMore: false });
    expect(h.lastColdSweep).toMatchObject({ expected: 42, hasMore: true });
    expect(h.lastDirtyRollupSweep).toEqual({ repaired: 2 });
  });
  it('caps the Query Limit at the sample size', async () => {
    await crmHealth();
    for (const c of send.mock.calls) expect(c[0].input.Limit).toBe(25);
  });
});
