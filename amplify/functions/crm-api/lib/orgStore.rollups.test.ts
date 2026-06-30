import { describe, it, expect, vi, beforeEach } from 'vitest';
const mockSend = vi.fn();
vi.mock('./dynamodb', () => ({ docClient: { send: (...a: unknown[]) => mockSend(...a) }, TABLE_NAME: () => 'T' }));
vi.mock('./idGenerators', () => ({ generateOrgId: () => 'org-NEW', generateAuditId: () => 'audit-x' }));
import { createReviewOrgFromDomain, bumpOrgRollupOnCreate, recomputeRollupsForOrg } from './orgStore';
beforeEach(() => mockSend.mockReset());

describe('createReviewOrgFromDomain', () => {
  it('atomically claims domain + writes org META (SK=META) + name index, returns the new id', async () => {
    mockSend.mockResolvedValueOnce({}); // single TransactWrite
    const id = await createReviewOrgFromDomain('newcorp.com', '2026-06-19T10:00:00Z');
    expect(id).toBe('org-NEW');
    const txn = mockSend.mock.calls[0][0].input.TransactItems;
    expect(mockSend).toHaveBeenCalledTimes(1); // all-or-nothing, one round trip
    const claim = txn[0].Put;
    expect(claim.Item.PK).toBe('ORGDOMAIN#newcorp.com');
    expect(claim.ConditionExpression).toMatch(/attribute_not_exists/); // the idempotency anchor
    const orgItem = txn[1].Put.Item;
    expect(orgItem.PK).toBe('ORG#org-NEW');
    expect(orgItem.SK).toBe('META'); // shares the authoritative org metadata row, NOT a shadow 'A'
    expect(orgItem.status).toBe('review');
    expect(orgItem.createdByResolution).toBe(true);
    expect(orgItem.primaryDomain).toBe('newcorp.com');
    expect(orgItem.GSI1PK).toBe('ORG_STATUS#review');
    const nameItem = txn[2].Put.Item;
    expect(nameItem.PK).toBe('ORGNAME#newcorp'); // normalizeOrgName('newcorp')
    expect(nameItem.orgId).toBe('org-NEW');
  });
  it('on claim race (transaction cancelled), returns the existing org id without writing', async () => {
    mockSend.mockRejectedValueOnce(Object.assign(new Error('cancelled'), { name: 'TransactionCanceledException' }));
    mockSend.mockResolvedValueOnce({ Item: { orgId: 'org-EXISTING' } }); // getOrgIdByDomain
    const id = await createReviewOrgFromDomain('newcorp.com', '2026-06-19T10:00:00Z');
    expect(id).toBe('org-EXISTING');
  });
  it('does NOT set lastActivityAt when the triggering event is internal-only', async () => {
    mockSend.mockResolvedValueOnce({}); // single TransactWrite
    await createReviewOrgFromDomain('newcorp.com', '2026-06-19T10:00:00Z', true);
    const orgItem = mockSend.mock.calls[0][0].input.TransactItems[1].Put.Item;
    expect(orgItem.firstSeenAt).toBe('2026-06-19T10:00:00Z');
    expect(orgItem.lastActivityAt).toBeUndefined();
  });
});

describe('bumpOrgRollupOnCreate', () => {
  it('skips sentinel orgs', async () => {
    await bumpOrgRollupOnCreate({ orgId: 'unresolved-rfq-1', kind: 'rfq_submitted', occurredAt: '2026-01-01T00:00:00Z' });
    await bumpOrgRollupOnCreate({ orgId: 'new-org:x.com', kind: 'rfq_submitted', occurredAt: '2026-01-01T00:00:00Z' });
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
