import { describe, it, expect, vi, beforeEach } from 'vitest';
const mockSend = vi.fn();
vi.mock('./dynamodb', () => ({ docClient: { send: (...a: unknown[]) => mockSend(...a) }, TABLE_NAME: () => 'T' }));
const resolveLinks = vi.fn();
vi.mock('./resolveLinks', () => ({ resolveLinks: (i: unknown) => resolveLinks(i) }));
const upsertContact = vi.fn();
vi.mock('./contactStore', () => ({ upsertContact: (a: unknown) => upsertContact(a) }));
const createReviewOrgFromDomain = vi.fn(); const bumpOrgRollupOnCreate = vi.fn(); const recomputeRollupsForOrg = vi.fn();
vi.mock('./orgStore', () => ({
  createReviewOrgFromDomain: (d: string, o: string) => createReviewOrgFromDomain(d, o),
  bumpOrgRollupOnCreate: (a: unknown) => bumpOrgRollupOnCreate(a),
  recomputeRollupsForOrg: (o: string) => recomputeRollupsForOrg(o),
}));
const getTimelineEvent = vi.fn();
vi.mock('./timelineStore', () => ({ getTimelineEvent: (id: string) => getTimelineEvent(id) }));

import { emitTimelineEvent } from './emitTimelineEvent';
beforeEach(() => { mockSend.mockReset(); resolveLinks.mockReset(); upsertContact.mockReset(); createReviewOrgFromDomain.mockReset(); bumpOrgRollupOnCreate.mockReset(); recomputeRollupsForOrg.mockReset(); getTimelineEvent.mockReset(); });

const baseEvt = {
  source: 'rfq' as const, kind: 'rfq_submitted', sourceEntityType: 'rfq', sourceEntityId: 'rfq-1',
  occurredAt: '2026-06-19T10:00:00Z', summary: 'Submitted RFQ for ICP-1000W',
  idInput: { kind: 'rfq_submitted', rfqId: 'rfq-1' } as const,
  resolveInput: { sourceEntityType: 'rfq', sourceEntityId: 'rfq-1', channel: 'rfq' as const, email: 'terry@diamondfoundry.com' },
};

describe('emitTimelineEvent', () => {
  it('create path: put(rollupApplied=false) → bump → mark applied', async () => {
    resolveLinks.mockResolvedValueOnce({ orgId: 'org-df', contactId: null, resolutionStatus: 'resolved', resolutionReason: 'email_domain_exact', confidence: 0.95 });
    upsertContact.mockResolvedValueOnce('ct-terry');
    mockSend.mockResolvedValueOnce({}); // conditional put (new)
    mockSend.mockResolvedValueOnce({}); // set rollupApplied=true
    await emitTimelineEvent(baseEvt);
    const put = mockSend.mock.calls[0][0].input;
    expect(put.Item.PK).toBe('TLEVENT#tev-rfq-rfq-1-submitted');
    expect(put.Item.orgId).toBe('org-df');
    expect(put.Item.contactId).toBe('ct-terry');
    expect(put.Item.rollupApplied).toBe(false);
    expect(put.ConditionExpression).toMatch(/attribute_not_exists/);
    expect(bumpOrgRollupOnCreate).toHaveBeenCalledWith(expect.objectContaining({ orgId: 'org-df', kind: 'rfq_submitted' }));
    expect(mockSend.mock.calls[1][0].input.UpdateExpression).toMatch(/rollupApplied/);
  });
  it('email_domain_new: materializes review org, uses real id, upserts contact there', async () => {
    resolveLinks.mockResolvedValueOnce({ orgId: 'new-org:newcorp.com', contactId: null, resolutionStatus: 'resolved', resolutionReason: 'email_domain_new', confidence: 0.8 });
    createReviewOrgFromDomain.mockResolvedValueOnce('org-REVIEW');
    upsertContact.mockResolvedValueOnce('ct-1');
    mockSend.mockResolvedValueOnce({}); mockSend.mockResolvedValueOnce({});
    await emitTimelineEvent({ ...baseEvt, resolveInput: { ...baseEvt.resolveInput, email: 'first@newcorp.com' } });
    expect(createReviewOrgFromDomain).toHaveBeenCalledWith('newcorp.com', '2026-06-19T10:00:00Z');
    expect(mockSend.mock.calls[0][0].input.Item.orgId).toBe('org-REVIEW');
    expect(upsertContact).toHaveBeenCalledWith(expect.objectContaining({ orgId: 'org-REVIEW' }));
  });
  it('unresolved: no contact upsert, no rollup bump', async () => {
    resolveLinks.mockResolvedValueOnce({ orgId: 'unresolved-rfq-rfq-1', contactId: null, resolutionStatus: 'unresolved', resolutionReason: 'unresolved', confidence: 0 });
    mockSend.mockResolvedValueOnce({}); mockSend.mockResolvedValueOnce({});
    await emitTimelineEvent(baseEvt);
    expect(upsertContact).not.toHaveBeenCalled();
    expect(bumpOrgRollupOnCreate).toHaveBeenCalledWith(expect.objectContaining({ orgId: 'unresolved-rfq-rfq-1' }));
  });
  it('re-emit (duplicate): writes FULL projection, NO bump; recomputes both orgs on org change', async () => {
    resolveLinks.mockResolvedValueOnce({ orgId: 'org-NEW', contactId: null, resolutionStatus: 'manually_linked', resolutionReason: 'manual', confidence: 1 });
    upsertContact.mockResolvedValueOnce('ct-terry');
    mockSend.mockRejectedValueOnce(Object.assign(new Error('dup'), { name: 'ConditionalCheckFailedException' }));
    getTimelineEvent.mockResolvedValueOnce({ id: 'tev-rfq-rfq-1-submitted', orgId: 'org-OLD', createdAt: '2026-01-01T00:00:00Z', rollupApplied: true });
    mockSend.mockResolvedValueOnce({}); // overwrite put
    await emitTimelineEvent(baseEvt);
    const overwrite = mockSend.mock.calls[1][0].input;
    expect(overwrite.Item.orgId).toBe('org-NEW');
    expect(overwrite.Item.resolutionReason).toBe('manual');
    expect(overwrite.Item.createdAt).toBe('2026-01-01T00:00:00Z');
    expect(overwrite.ConditionExpression).toBeUndefined();
    expect(overwrite.Item.rollupApplied).toBe(true);
    expect(bumpOrgRollupOnCreate).not.toHaveBeenCalled();
    expect(recomputeRollupsForOrg).toHaveBeenCalledWith('org-OLD');
    expect(recomputeRollupsForOrg).toHaveBeenCalledWith('org-NEW');
  });
  it('re-emit where original rollup never landed (rollupApplied=false), same org: compensates the bump', async () => {
    resolveLinks.mockResolvedValueOnce({ orgId: 'org-df', contactId: null, resolutionStatus: 'resolved', resolutionReason: 'email_domain_exact', confidence: 0.95 });
    upsertContact.mockResolvedValueOnce('ct-terry');
    mockSend.mockRejectedValueOnce(Object.assign(new Error('dup'), { name: 'ConditionalCheckFailedException' }));
    getTimelineEvent.mockResolvedValueOnce({ id: 'tev-rfq-rfq-1-submitted', orgId: 'org-df', createdAt: '2026-01-01T00:00:00Z', rollupApplied: false });
    mockSend.mockResolvedValueOnce({}); // overwrite put
    await emitTimelineEvent(baseEvt);
    expect(mockSend.mock.calls[1][0].input.Item.rollupApplied).toBe(true);
    expect(bumpOrgRollupOnCreate).toHaveBeenCalledWith(expect.objectContaining({ orgId: 'org-df', kind: 'rfq_submitted' }));
    expect(recomputeRollupsForOrg).not.toHaveBeenCalled();
  });
});
