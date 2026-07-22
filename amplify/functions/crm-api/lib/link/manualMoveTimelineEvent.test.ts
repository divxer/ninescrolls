import { describe, it, expect, vi, beforeEach } from 'vitest';
const mockSend = vi.fn();
vi.mock('../dynamodb', () => ({ docClient: { send: (...a: unknown[]) => mockSend(...a) }, TABLE_NAME: () => 'T' }));
const recomputeMock = vi.fn(); const markMock = vi.fn(); const upsertContactMock = vi.fn();
vi.mock('../orgStore', () => ({ recomputeRollupsForOrg: (o: string) => recomputeMock(o) }));
vi.mock('../timelineStore', () => ({ markRollupApplied: (id: string) => markMock(id) }));
vi.mock('../contactStore', () => ({ upsertContact: (a: unknown) => upsertContactMock(a) }));
import { manualMoveTimelineEvent } from './manualMoveTimelineEvent';

const GEN = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
const ev = (o = {}) => ({ id: 'tev-a', orgId: 'unresolved-rfq-r1', kind: 'rfq_submitted', occurredAt: '2026-03-01T00:00:00Z', source: 'rfq', sourceEntityType: 'rfq', sourceEntityId: 'r1', resolutionStatus: 'unresolved', isInternalOnly: false, contactId: null, ...o }) as never;
beforeEach(() => { mockSend.mockReset(); recomputeMock.mockReset(); markMock.mockReset(); upsertContactMock.mockReset(); });

const cancelled = (codes: string[]) => Object.assign(new Error('Transaction cancelled'), {
  name: 'TransactionCanceledException', CancellationReasons: codes.map((Code) => ({ Code })),
});

describe('manualMoveTimelineEvent', () => {
  it('is a fenced 2-item transaction [org-active check, conditional move] with the R7 eligibility condition, drops GSI1, stamps linkGeneration, and does NO side effect before the move; orders move→contact→recompute→mark', async () => {
    mockSend.mockResolvedValueOnce({});
    upsertContactMock.mockResolvedValueOnce('ct-x');
    const r = await manualMoveTimelineEvent({ event: ev(), targetOrgId: 'acme.com', email: 'a@acme.com', operator: 'op', nowIso: '2026-07-08T00:00:00Z', linkGeneration: GEN });
    const cmd = mockSend.mock.calls[0][0];
    expect(cmd.constructor.name).toBe('TransactWriteCommand');
    const tx = cmd.input.TransactItems;
    expect(tx).toHaveLength(2);
    expect(tx[0].ConditionCheck.ConditionExpression).toBe('#s = :active');       // position 0 = org fence, ALWAYS
    const put = tx[1].Put;
    expect(put.ConditionExpression).toBe('resolutionStatus = :unres AND orgId = :syn AND voided = :false AND isInternalOnly = :false AND #source = :src');
    expect(put.ExpressionAttributeValues[':syn']).toBe('unresolved-rfq-r1');
    expect(put.ExpressionAttributeValues[':false']).toBe(false);
    expect(put.ExpressionAttributeValues[':src']).toBe('rfq');
    expect(put.ExpressionAttributeNames['#source']).toBe('source');
    expect(put.Item.resolutionStatus).toBe('manually_linked');
    expect(put.Item.resolutionReason).toBe('manual');
    expect(put.Item.orgId).toBe('acme.com');
    expect(put.Item.GSI2PK).toBe('ORG#acme.com');
    expect(put.Item.GSI1PK).toBeUndefined();
    expect('GSI1PK' in put.Item).toBe(false);
    expect(put.Item.rollupApplied).toBe(false);
    expect(put.Item.contactId).toBeTruthy();
    expect(put.Item.linkGeneration).toBe(GEN);                                   // queryable unit membership (R5)
    const putOrder = mockSend.mock.invocationCallOrder[0];
    const contactOrder = upsertContactMock.mock.invocationCallOrder[0];
    const recomputeOrder = recomputeMock.mock.invocationCallOrder[0];
    const markOrder = markMock.mock.invocationCallOrder[0];
    expect(putOrder).toBeLessThan(contactOrder);
    expect(contactOrder).toBeLessThan(recomputeOrder);
    expect(recomputeOrder).toBeLessThan(markOrder);
    expect(recomputeMock).toHaveBeenCalledWith('acme.com');
    expect(r).toMatchObject({ moved: true, skipped: false, contactStatus: 'linked' });
  });

  it('uses representativeSource for :src when provided (unit-level source, not the row copy)', async () => {
    mockSend.mockResolvedValueOnce({});
    await manualMoveTimelineEvent({ event: ev(), targetOrgId: 'acme.com', email: null, operator: 'op', nowIso: 'n', linkGeneration: GEN, representativeSource: 'rfq' });
    expect(mockSend.mock.calls[0][0].input.TransactItems[1].Put.ExpressionAttributeValues[':src']).toBe('rfq');
  });

  it('MOVE-condition cancellation (index 1 — index 0 is the org fence) → skipped, NO contact/recompute/mark side effects (finding 1)', async () => {
    mockSend.mockRejectedValueOnce(cancelled(['None', 'ConditionalCheckFailed']));
    const r = await manualMoveTimelineEvent({ event: ev(), targetOrgId: 'acme.com', email: 'a@acme.com', operator: 'op', nowIso: 'n', linkGeneration: GEN });
    expect(r).toMatchObject({ moved: false, skipped: true });
    expect(upsertContactMock).not.toHaveBeenCalled();
    expect(recomputeMock).not.toHaveBeenCalled();
    expect(markMock).not.toHaveBeenCalled();
  });

  it('org-fence cancellation (index 0) → throws the explicit merged-org error, NO side effects', async () => {
    mockSend.mockRejectedValueOnce(cancelled(['ConditionalCheckFailed', 'None']));
    await expect(manualMoveTimelineEvent({ event: ev(), targetOrgId: 'acme.com', email: null, operator: 'op', nowIso: 'n', linkGeneration: GEN }))
      .rejects.toThrow(/being merged|not active/i);
    expect(upsertContactMock).not.toHaveBeenCalled();
    expect(recomputeMock).not.toHaveBeenCalled();
    expect(markMock).not.toHaveBeenCalled();
  });

  it('missing/malformed CancellationReasons → error propagates (never guessed into skipped)', async () => {
    mockSend.mockRejectedValueOnce(Object.assign(new Error('Transaction cancelled'), { name: 'TransactionCanceledException' }));
    await expect(manualMoveTimelineEvent({ event: ev(), targetOrgId: 'acme.com', email: null, operator: 'op', nowIso: 'n', linkGeneration: GEN })).rejects.toThrow();
  });

  it('no email → still moves, contactStatus=missing_email, contactId stays null', async () => {
    mockSend.mockResolvedValueOnce({});
    const r = await manualMoveTimelineEvent({ event: ev(), targetOrgId: 'acme.com', email: null, operator: 'op', nowIso: 'n', linkGeneration: GEN });
    expect(upsertContactMock).not.toHaveBeenCalled();
    expect(r).toMatchObject({ moved: true, contactStatus: 'missing_email' });
    expect(mockSend.mock.calls[0][0].input.TransactItems[1].Put.Item.contactId).toBeNull();
  });

  it('a POST-move failure (recompute throws) still returns moved:true (row already committed; sweep repairs)', async () => {
    mockSend.mockResolvedValueOnce({});
    recomputeMock.mockRejectedValueOnce(new Error('recompute boom'));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = await manualMoveTimelineEvent({ event: ev(), targetOrgId: 'acme.com', email: null, operator: 'op', nowIso: 'n', linkGeneration: GEN });
    expect(r).toMatchObject({ moved: true, skipped: false });
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });
});
