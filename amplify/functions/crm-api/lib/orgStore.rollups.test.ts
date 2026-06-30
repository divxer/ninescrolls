import { describe, it, expect, vi, beforeEach } from 'vitest';
const mockSend = vi.fn();
vi.mock('./dynamodb', () => ({ docClient: { send: (...a: unknown[]) => mockSend(...a) }, TABLE_NAME: () => 'T' }));
vi.mock('./idGenerators', () => ({ generateOrgId: () => 'org-NEW', generateAuditId: () => 'audit-x' }));
import { createReviewOrgFromDomain, bumpOrgRollupOnCreate, recomputeRollupsForOrg } from './orgStore';
beforeEach(() => mockSend.mockReset());

describe('createReviewOrgFromDomain', () => {
  it('claims the domain index, writes the review org + name index, returns the new id', async () => {
    mockSend.mockResolvedValueOnce({}); // claim ORGDOMAIN (conditional put ok)
    mockSend.mockResolvedValueOnce({}); // put ORG review record
    mockSend.mockResolvedValueOnce({}); // put ORGNAME index
    const id = await createReviewOrgFromDomain('newcorp.com', '2026-06-19T10:00:00Z');
    expect(id).toBe('org-NEW');
    const orgItem = mockSend.mock.calls[1][0].input.Item;
    expect(orgItem.status).toBe('review');
    expect(orgItem.createdByResolution).toBe(true);
    expect(orgItem.primaryDomain).toBe('newcorp.com');
    expect(orgItem.GSI1PK).toBe('ORG_STATUS#review');
    const nameItem = mockSend.mock.calls[2][0].input.Item;
    expect(nameItem.PK).toBe('ORGNAME#newcorp'); // normalizeOrgName('newcorp')
    expect(nameItem.orgId).toBe('org-NEW');
  });
  it('on claim race, returns the existing org id without creating', async () => {
    mockSend.mockRejectedValueOnce(Object.assign(new Error('dup'), { name: 'ConditionalCheckFailedException' }));
    mockSend.mockResolvedValueOnce({ Item: { orgId: 'org-EXISTING' } }); // getOrgIdByDomain
    const id = await createReviewOrgFromDomain('newcorp.com', '2026-06-19T10:00:00Z');
    expect(id).toBe('org-EXISTING');
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
    expect(upd.Key).toEqual({ PK: 'ORG#org-1', SK: 'A' });
    expect(upd.UpdateExpression).toMatch(/orderCount/);
  });
  it('internalOnly note is a no-op (never advances lastActivityAt)', async () => {
    await bumpOrgRollupOnCreate({ orgId: 'org-1', kind: 'note', occurredAt: '2026-06-19T10:00:00Z', isInternalOnly: true });
    expect(mockSend).not.toHaveBeenCalled();
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
});
