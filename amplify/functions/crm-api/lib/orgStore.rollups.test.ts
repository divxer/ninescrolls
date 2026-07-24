import { describe, it, expect, vi, beforeEach } from 'vitest';
const mockSend = vi.fn();
vi.mock('./dynamodb', () => ({ docClient: { send: (...a: unknown[]) => mockSend(...a) }, TABLE_NAME: () => 'T' }));
import { bumpOrgRollupOnCreate, recomputeRollupsForOrg } from './orgStore';
// Braces matter: mockReset() returns the mock, and a hook's return value is treated by Vitest as a
// teardown function — so the concise-arrow form makes Vitest call mockSend() with no args after
// every test (invisible with a no-op default impl, a TypeError with a real one).
beforeEach(() => { mockSend.mockReset(); });

// DynamoDB rejects a write whose ExpressionAttributeValues carry a key that no submitted expression
// references — the same server-side check that produced the prod
// `ValidationException: Value provided in ExpressionAttributeValues unused in expressions:
// keys: {:one, :zero}`. The plain mockResolvedValue mocks used elsewhere in this file accept
// anything, so this validating send is what actually pins the fix.
function validatingSend(cmd: { input: Record<string, any> }) {
  const input = cmd.input ?? {};
  const exprs = [input.UpdateExpression, input.ConditionExpression, input.KeyConditionExpression,
    input.FilterExpression, input.ProjectionExpression].filter(Boolean).join(' ');
  // `\b` matters: `:o` must not be considered "used" merely because `:occ` appears.
  const unused = Object.keys(input.ExpressionAttributeValues ?? {})
    .filter((k) => !new RegExp(`${k}\\b`).test(exprs)).sort();
  if (unused.length > 0) {
    return Promise.reject(Object.assign(
      new Error(`Value provided in ExpressionAttributeValues unused in expressions: keys: {${unused.join(', ')}}`),
      { name: 'ValidationException' }));
  }
  return Promise.resolve({});
}

// Every timeline kind emitted in prod that has NO entry in KIND_TO_COUNT/KIND_TO_LATEST.
const COUNTLESS_KINDS = ['site_visit_session', 'email', 'order_stage_changed', 'rfq_status_changed',
  'quote_sent', 'logistics_milestone', 'manual'];

describe('bumpOrgRollupOnCreate — ExpressionAttributeValues must match the built expression', () => {
  it.each(COUNTLESS_KINDS)('kind "%s" (no count/latest attr) writes without the unused :zero/:one', async (kind) => {
    mockSend.mockImplementation(validatingSend);
    await bumpOrgRollupOnCreate({ orgId: 'org-1', kind, occurredAt: '2026-07-23T10:00:00Z' });
    expect(mockSend).toHaveBeenCalledTimes(1); // one clean write — not a rejection + recompute
    const upd = mockSend.mock.calls[0][0].input;
    expect(upd.UpdateExpression).toBe('SET lastActivityAt = :occ');
    expect(Object.keys(upd.ExpressionAttributeValues)).toEqual([':occ']);
  });

  it('a count-bearing kind still supplies :zero/:one and bumps the counter', async () => {
    mockSend.mockImplementation(validatingSend);
    await bumpOrgRollupOnCreate({ orgId: 'org-1', kind: 'rfq_submitted', occurredAt: '2026-07-23T10:00:00Z' });
    const upd = mockSend.mock.calls[0][0].input;
    expect(upd.UpdateExpression).toMatch(/rfqCount = if_not_exists\(rfqCount, :zero\) \+ :one/);
    expect(upd.UpdateExpression).toMatch(/latestRFQDate = :occ/);
    expect(upd.ExpressionAttributeValues).toEqual({ ':occ': '2026-07-23T10:00:00Z', ':zero': 0, ':one': 1 });
  });

  it('the internalOnly branch also supplies only the values its expression references', async () => {
    mockSend.mockImplementation(validatingSend);
    // internalOnly + a count-bearing kind: skips lastActivityAt, keeps count/latest.
    await bumpOrgRollupOnCreate({ orgId: 'org-1', kind: 'lead_captured', occurredAt: '2026-07-23T10:00:00Z', isInternalOnly: true });
    const upd = mockSend.mock.calls[0][0].input;
    expect(upd.UpdateExpression).not.toMatch(/lastActivityAt/);
    expect(upd.ConditionExpression).toBeUndefined();
    const refd = Object.keys(upd.ExpressionAttributeValues);
    expect(refd.every((k) => new RegExp(`${k}\\b`).test(upd.UpdateExpression))).toBe(true);
  });
});

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
