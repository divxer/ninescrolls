import { describe, it, expect, vi, beforeEach } from 'vitest';
const mockSend = vi.fn();
vi.mock('./dynamodb', () => ({ docClient: { send: (...a: unknown[]) => mockSend(...a) }, TABLE_NAME: () => 'T' }));
import { bumpOrgRollupOnCreate, recomputeRollupsForOrg } from './orgStore';
beforeEach(() => mockSend.mockReset());

describe('bumpOrgRollupOnCreate', () => {
  it('skips the unresolved sentinel org', async () => {
    await bumpOrgRollupOnCreate({ orgId: 'unresolved-rfq-1', kind: 'rfq_submitted', occurredAt: '2026-01-01T00:00:00Z' });
    expect(mockSend).not.toHaveBeenCalled();
  });
  it('increments count + advances lastActivityAt for a real org', async () => {
    mockSend.mockResolvedValueOnce({});
    await bumpOrgRollupOnCreate({ orgId: 'org-1', kind: 'order_created', occurredAt: '2026-06-19T10:00:00Z' });
    const upd = mockSend.mock.calls[0][0].input;
    expect(upd.Key).toEqual({ PK: 'ORG#org-1', SK: 'META' });
    expect(upd.UpdateExpression).toMatch(/orderCount/);
  });
  it('internalOnly note is a no-op (never advances lastActivityAt)', async () => {
    await bumpOrgRollupOnCreate({ orgId: 'org-1', kind: 'note', occurredAt: '2026-06-19T10:00:00Z', isInternalOnly: true });
    expect(mockSend).not.toHaveBeenCalled();
  });
  it('out-of-order event (conditional check fails) recomputes from the authoritative set, not a partial count bump', async () => {
    mockSend.mockRejectedValueOnce(Object.assign(new Error('older'), { name: 'ConditionalCheckFailedException' })); // conditional update fails
    mockSend.mockResolvedValueOnce({ Items: [
      { kind: 'order_created', occurredAt: '2026-09-01T00:00:00Z' },
      { kind: 'order_created', occurredAt: '2026-06-19T10:00:00Z' },
    ] }); // recompute GSI2 query
    mockSend.mockResolvedValueOnce({}); // recompute final update
    await bumpOrgRollupOnCreate({ orgId: 'org-1', kind: 'order_created', occurredAt: '2026-06-19T10:00:00Z' });
    expect(mockSend).toHaveBeenCalledTimes(3);
    const upd = mockSend.mock.calls[2][0].input;
    expect(upd.UpdateExpression).toMatch(/rfqCount = :r/); // recompute-style full SET, not a partial count
    expect(upd.ExpressionAttributeValues[':o']).toBe(2); // both order_created counted
    expect(upd.ExpressionAttributeValues[':la']).toBe('2026-09-01T00:00:00Z'); // latest preserved
  });
});

describe('recomputeRollupsForOrg', () => {
  it('paginates GSI2, re-derives counts/max dates, and excludes internalOnly from lastActivityAt', async () => {
    mockSend
      .mockResolvedValueOnce({ Items: [{ kind: 'rfq_submitted', occurredAt: '2026-01-01T00:00:00Z' }], LastEvaluatedKey: { k: 1 } })
      .mockResolvedValueOnce({ Items: [
        { kind: 'order_created', occurredAt: '2026-03-01T00:00:00Z' },
        { kind: 'order_stage_changed', occurredAt: '2026-04-01T00:00:00Z' },
        { kind: 'note', occurredAt: '2026-05-01T00:00:00Z', isInternalOnly: true },
      ] })
      .mockResolvedValueOnce({}); // final update
    await recomputeRollupsForOrg('org-1');
    expect(mockSend).toHaveBeenCalledTimes(3);
    const vals = mockSend.mock.calls[2][0].input.ExpressionAttributeValues;
    expect(vals[':la']).toBe('2026-04-01T00:00:00Z');
    expect(vals[':r']).toBe(1);
    expect(vals[':o']).toBe(1);
  });
  it('REMOVEs lastActivityAt (never writes NULL) when only internalOnly/voided events remain', async () => {
    mockSend
      .mockResolvedValueOnce({ Items: [
        { kind: 'note', occurredAt: '2026-05-01T00:00:00Z', isInternalOnly: true },
        { kind: 'order_created', occurredAt: '2026-03-01T00:00:00Z', voided: true },
      ] })
      .mockResolvedValueOnce({}); // final update
    await recomputeRollupsForOrg('org-1');
    const upd = mockSend.mock.calls[1][0].input;
    expect(upd.UpdateExpression).toMatch(/REMOVE lastActivityAt/);
    expect(upd.ExpressionAttributeValues[':la']).toBeUndefined();
  });
});
