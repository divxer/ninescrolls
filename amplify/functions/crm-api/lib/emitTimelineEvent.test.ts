import { describe, it, expect, vi, beforeEach } from 'vitest';
const mockSend = vi.fn();
vi.mock('./dynamodb', () => ({ docClient: { send: (...a: unknown[]) => mockSend(...a) }, TABLE_NAME: () => 'T' }));
const resolveLinks = vi.fn();
vi.mock('./resolveLinks', () => ({ resolveLinks: (i: unknown) => resolveLinks(i) }));
const upsertContact = vi.fn();
vi.mock('./contactStore', () => ({ upsertContact: (a: unknown) => upsertContact(a) }));
const bumpOrgRollupOnCreate = vi.fn(); const recomputeRollupsForOrg = vi.fn();
vi.mock('./orgStore', () => ({
  bumpOrgRollupOnCreate: (a: unknown) => bumpOrgRollupOnCreate(a),
  recomputeRollupsForOrg: (o: string) => recomputeRollupsForOrg(o),
}));
const getTimelineEvent = vi.fn();
// Keep the real markRollupApplied (it routes through the mocked docClient.send, which the
// assertions below inspect); only getTimelineEvent is stubbed for branch control.
vi.mock('./timelineStore', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./timelineStore')>()),
  getTimelineEvent: (id: string) => getTimelineEvent(id),
}));

import { emitTimelineEvent } from './emitTimelineEvent';
beforeEach(() => { mockSend.mockReset(); resolveLinks.mockReset(); upsertContact.mockReset(); bumpOrgRollupOnCreate.mockReset(); recomputeRollupsForOrg.mockReset(); getTimelineEvent.mockReset(); });

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
  it('unresolved: no contact upsert, no rollup bump', async () => {
    resolveLinks.mockResolvedValueOnce({ orgId: 'unresolved-rfq-rfq-1', contactId: null, resolutionStatus: 'unresolved', resolutionReason: 'unresolved', confidence: 0 });
    mockSend.mockResolvedValueOnce({}); mockSend.mockResolvedValueOnce({});
    await emitTimelineEvent(baseEvt);
    expect(upsertContact).not.toHaveBeenCalled();
    expect(bumpOrgRollupOnCreate).toHaveBeenCalledWith(expect.objectContaining({ orgId: 'unresolved-rfq-rfq-1' }));
  });
  it('re-emit (link moved): writes dirty (false + pending old org) FIRST, recomputes both, then marks clean', async () => {
    resolveLinks.mockResolvedValueOnce({ orgId: 'org-NEW', contactId: null, resolutionStatus: 'manually_linked', resolutionReason: 'manual', confidence: 1 });
    upsertContact.mockResolvedValueOnce('ct-terry');
    mockSend.mockRejectedValueOnce(Object.assign(new Error('dup'), { name: 'ConditionalCheckFailedException' })); // conditional put
    getTimelineEvent.mockResolvedValueOnce({ id: 'tev-rfq-rfq-1-submitted', orgId: 'org-OLD', createdAt: '2026-01-01T00:00:00Z', rollupApplied: true });
    mockSend.mockResolvedValueOnce({}); // dirty overwrite put
    mockSend.mockResolvedValueOnce({}); // markRollupApplied
    await emitTimelineEvent(baseEvt);
    const overwrite = mockSend.mock.calls[1][0].input;
    expect(overwrite.Item.orgId).toBe('org-NEW');
    expect(overwrite.Item.resolutionReason).toBe('manual');
    expect(overwrite.Item.createdAt).toBe('2026-01-01T00:00:00Z');
    expect(overwrite.ConditionExpression).toBeUndefined();
    expect(overwrite.Item.rollupApplied).toBe(false);          // durable dirty marker written first
    expect(overwrite.Item.rollupPendingOrgId).toBe('org-OLD'); // old org recorded durably
    expect(recomputeRollupsForOrg).toHaveBeenCalledWith('org-OLD');
    expect(recomputeRollupsForOrg).toHaveBeenCalledWith('org-NEW');
    expect(bumpOrgRollupOnCreate).not.toHaveBeenCalled();
    expect(mockSend.mock.calls[2][0].input.UpdateExpression).toMatch(/rollupApplied = :t REMOVE rollupPendingOrgId/);
  });
  it('re-emit where original rollup never landed (rollupApplied=false), same org: recomputes once, then marks clean', async () => {
    resolveLinks.mockResolvedValueOnce({ orgId: 'org-df', contactId: null, resolutionStatus: 'resolved', resolutionReason: 'email_domain_exact', confidence: 0.95 });
    upsertContact.mockResolvedValueOnce('ct-terry');
    mockSend.mockRejectedValueOnce(Object.assign(new Error('dup'), { name: 'ConditionalCheckFailedException' }));
    getTimelineEvent.mockResolvedValueOnce({ id: 'tev-rfq-rfq-1-submitted', orgId: 'org-df', kind: 'rfq_submitted', occurredAt: '2026-06-19T10:00:00Z', isInternalOnly: false, voided: false, createdAt: '2026-01-01T00:00:00Z', rollupApplied: false });
    mockSend.mockResolvedValueOnce({}); // dirty overwrite
    mockSend.mockResolvedValueOnce({}); // markRollupApplied
    await emitTimelineEvent(baseEvt);
    expect(mockSend.mock.calls[1][0].input.Item.rollupApplied).toBe(false); // dirty first
    expect(recomputeRollupsForOrg).toHaveBeenCalledWith('org-df');
    expect(recomputeRollupsForOrg).toHaveBeenCalledTimes(1); // no pending old org → only current org
    expect(bumpOrgRollupOnCreate).not.toHaveBeenCalled();
  });
  it('re-emit same org with a rollup-affecting change (voided) recomputes once, even if rollupApplied was true', async () => {
    resolveLinks.mockResolvedValueOnce({ orgId: 'org-df', contactId: null, resolutionStatus: 'resolved', resolutionReason: 'email_domain_exact', confidence: 0.95 });
    upsertContact.mockResolvedValueOnce('ct-terry');
    mockSend.mockRejectedValueOnce(Object.assign(new Error('dup'), { name: 'ConditionalCheckFailedException' }));
    getTimelineEvent.mockResolvedValueOnce({ id: 'tev-rfq-rfq-1-submitted', orgId: 'org-df', kind: 'rfq_submitted', occurredAt: '2026-06-19T10:00:00Z', isInternalOnly: false, voided: false, createdAt: '2026-01-01T00:00:00Z', rollupApplied: true });
    mockSend.mockResolvedValueOnce({}); // dirty overwrite
    mockSend.mockResolvedValueOnce({}); // markRollupApplied
    await emitTimelineEvent({ ...baseEvt, voided: true });
    expect(recomputeRollupsForOrg).toHaveBeenCalledWith('org-df');
    expect(recomputeRollupsForOrg).toHaveBeenCalledTimes(1);
    expect(bumpOrgRollupOnCreate).not.toHaveBeenCalled();
  });
  it('re-emit recovers a crashed attempt: existing rollupApplied=false + rollupPendingOrgId recomputes BOTH pending and current org', async () => {
    resolveLinks.mockResolvedValueOnce({ orgId: 'org-NEW', contactId: null, resolutionStatus: 'manually_linked', resolutionReason: 'manual', confidence: 1 });
    upsertContact.mockResolvedValueOnce('ct-1');
    mockSend.mockRejectedValueOnce(Object.assign(new Error('dup'), { name: 'ConditionalCheckFailedException' }));
    // a prior link-move crashed after the dirty write: row already on org-NEW, org-OLD still pending
    getTimelineEvent.mockResolvedValueOnce({ id: 'tev-rfq-rfq-1-submitted', orgId: 'org-NEW', kind: 'rfq_submitted', occurredAt: '2026-06-19T10:00:00Z', isInternalOnly: false, voided: false, createdAt: '2026-01-01T00:00:00Z', rollupApplied: false, rollupPendingOrgId: 'org-OLD' });
    mockSend.mockResolvedValueOnce({}); // dirty overwrite
    mockSend.mockResolvedValueOnce({}); // markRollupApplied
    await emitTimelineEvent(baseEvt);
    expect(recomputeRollupsForOrg).toHaveBeenCalledWith('org-OLD'); // pending recovered durably
    expect(recomputeRollupsForOrg).toHaveBeenCalledWith('org-NEW');
  });
  it('re-emit with no rollup-affecting change stays clean (overwrite rollupApplied=true, no recompute, no markClean)', async () => {
    resolveLinks.mockResolvedValueOnce({ orgId: 'org-df', contactId: null, resolutionStatus: 'resolved', resolutionReason: 'email_domain_exact', confidence: 0.95 });
    upsertContact.mockResolvedValueOnce('ct-terry');
    mockSend.mockRejectedValueOnce(Object.assign(new Error('dup'), { name: 'ConditionalCheckFailedException' }));
    getTimelineEvent.mockResolvedValueOnce({ id: 'tev-rfq-rfq-1-submitted', orgId: 'org-df', kind: 'rfq_submitted', occurredAt: '2026-06-19T10:00:00Z', isInternalOnly: false, voided: false, createdAt: '2026-01-01T00:00:00Z', rollupApplied: true, rollupPendingOrgId: null });
    mockSend.mockResolvedValueOnce({}); // single clean overwrite
    await emitTimelineEvent(baseEvt);
    expect(mockSend.mock.calls[1][0].input.Item.rollupApplied).toBe(true);
    expect(recomputeRollupsForOrg).not.toHaveBeenCalled();
    expect(bumpOrgRollupOnCreate).not.toHaveBeenCalled();
    expect(mockSend).toHaveBeenCalledTimes(2); // reject + clean overwrite only
  });
});
