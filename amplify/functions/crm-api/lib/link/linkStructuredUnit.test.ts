import { describe, it, expect, vi, beforeEach } from 'vitest';
const mockSend = vi.fn();
vi.mock('../dynamodb', () => ({ docClient: { send: (...a: unknown[]) => mockSend(...a) }, TABLE_NAME: () => 'T' }));
const orgExistsMock = vi.fn(); const moveMock = vi.fn(); const auditMock = vi.fn();
vi.mock('../orgStore', () => ({ orgExists: (o: string) => orgExistsMock(o), recomputeRollupsForOrg: vi.fn() }));
vi.mock('./manualMoveTimelineEvent', () => ({ manualMoveTimelineEvent: (a: unknown) => moveMock(a) }));
vi.mock('../auditStore', () => ({ writeLinkAuditLog: (a: unknown) => auditMock(a) }));
import { linkStructuredUnit } from './linkStructuredUnit';

const unresolvedEvent = { id: 'tev-a', orgId: 'unresolved-rfq-r1', kind: 'rfq_submitted', source: 'rfq', sourceEntityType: 'rfq', sourceEntityId: 'r1', occurredAt: 't', resolutionStatus: 'unresolved' };
beforeEach(() => { mockSend.mockReset(); orgExistsMock.mockReset(); moveMock.mockReset(); auditMock.mockReset(); });

describe('linkStructuredUnit', () => {
  it('rejects a non-existent / unresolved-* target before any write', async () => {
    orgExistsMock.mockResolvedValueOnce(false);
    await expect(linkStructuredUnit({ sourceType: 'rfq', sourceEntityId: 'r1', targetOrgId: 'nope.com', operator: 'op' })).rejects.toThrow(/target/i);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('empty synthetic partition → alreadyLinked no-op, writes nothing', async () => {
    orgExistsMock.mockResolvedValueOnce(true);
    mockSend.mockResolvedValueOnce({ Items: [] });
    const r = await linkStructuredUnit({ sourceType: 'rfq', sourceEntityId: 'r1', targetOrgId: 'acme.com', operator: 'op' });
    expect(r).toMatchObject({ alreadyLinked: true, affected: 0 });
    expect(moveMock).not.toHaveBeenCalled();
    expect(auditMock).not.toHaveBeenCalled();
  });

  it('moves each unresolved event, backfills source CONDITIONALLY, writes one per-unit audit', async () => {
    orgExistsMock.mockResolvedValueOnce(true);
    mockSend
      .mockResolvedValueOnce({ Items: [unresolvedEvent] })                         // synthetic partition query
      .mockResolvedValueOnce({ Item: { PK: 'RFQ#r1', SK: 'META', email: 'a@acme.com' } }) // readSourceEmail GET
      .mockResolvedValueOnce({});                                                   // conditional backfill Update (success)
    moveMock.mockResolvedValueOnce({ moved: true, skipped: false, contactStatus: 'linked' });
    auditMock.mockResolvedValueOnce('aud-1');
    const r = await linkStructuredUnit({ sourceType: 'rfq', sourceEntityId: 'r1', targetOrgId: 'acme.com', operator: 'op@x.com' });
    expect(moveMock).toHaveBeenCalledTimes(1);
    expect(r).toMatchObject({ affected: 1, moved: 1, skipped: 0, errors: 0, sourceBackfillStatus: 'written' });
    const upd = (mockSend.mock.calls.find((c) => c[0].constructor?.name === 'UpdateCommand') as [{ input: { ConditionExpression: string } }])[0].input;
    expect(upd.ConditionExpression).toContain('begins_with(matchedOrgId, :unres)');
    expect(upd.ConditionExpression).toContain('attribute_type(matchedOrgId, :nullType)');
    const audit = auditMock.mock.calls[0][0];
    expect(audit.reason).toBe('manual_link_unit'); expect(audit.operator).toBe('op@x.com');
    expect(audit.details).toMatchObject({ unitType: 'structured', unitKey: 'unresolved-rfq-r1', targetOrgId: 'acme.com', affectedCount: 1, affectedEventIds: ['tev-a'] });
  });

  it('conditional backfill that hits a real different matchedOrgId → conflict, no clobber (finding 3)', async () => {
    orgExistsMock.mockResolvedValueOnce(true);
    mockSend
      .mockResolvedValueOnce({ Items: [unresolvedEvent] })
      .mockResolvedValueOnce({ Item: { PK: 'RFQ#r1', SK: 'META', email: 'a@acme.com' } })
      .mockRejectedValueOnce(Object.assign(new Error('x'), { name: 'ConditionalCheckFailedException' }))
      .mockResolvedValueOnce({ Item: { matchedOrgId: 'other.com' } });
    moveMock.mockResolvedValueOnce({ moved: true, skipped: false, contactStatus: 'linked' });
    auditMock.mockResolvedValueOnce('aud-1');
    const r = await linkStructuredUnit({ sourceType: 'rfq', sourceEntityId: 'r1', targetOrgId: 'acme.com', operator: 'op' });
    expect(r.sourceBackfillStatus).toBe('conflict');
  });

  it('all events condition-fail (raced) → moved:0, NO source backfill, NO audit (finding 2)', async () => {
    orgExistsMock.mockResolvedValueOnce(true);
    mockSend
      .mockResolvedValueOnce({ Items: [unresolvedEvent] })
      .mockResolvedValueOnce({ Item: { PK: 'RFQ#r1', SK: 'META', email: 'a@acme.com' } });
    moveMock.mockResolvedValueOnce({ moved: false, skipped: true, contactStatus: 'missing_email' });
    const r = await linkStructuredUnit({ sourceType: 'rfq', sourceEntityId: 'r1', targetOrgId: 'acme.com', operator: 'op' });
    expect(r).toMatchObject({ moved: 0, skipped: 1 });
    expect(auditMock).not.toHaveBeenCalled();
    const updates = mockSend.mock.calls.filter((c) => c[0].constructor?.name === 'UpdateCommand');
    expect(updates.length).toBe(0);
  });

  it('per-event isolation: one move throws → errors+1, loop continues, the other event still moves', async () => {
    orgExistsMock.mockResolvedValueOnce(true);
    const evA = { ...unresolvedEvent, id: 'tev-a' };
    const evB = { ...unresolvedEvent, id: 'tev-b' };
    mockSend
      .mockResolvedValueOnce({ Items: [evA, evB] })                                 // synthetic partition query (2 events)
      .mockResolvedValueOnce({ Item: { PK: 'RFQ#r1', SK: 'META', email: 'a@acme.com' } }) // readSourceEmail GET
      .mockResolvedValueOnce({});                                                    // conditional backfill Update
    moveMock
      .mockRejectedValueOnce(new Error('move boom'))                                // evA throws
      .mockResolvedValueOnce({ moved: true, skipped: false, contactStatus: 'linked' }); // evB moves
    auditMock.mockResolvedValueOnce('aud-1');
    const r = await linkStructuredUnit({ sourceType: 'rfq', sourceEntityId: 'r1', targetOrgId: 'acme.com', operator: 'op' });
    expect(moveMock).toHaveBeenCalledTimes(2);            // loop did NOT abort after the throw
    expect(r).toMatchObject({ affected: 2, moved: 1, errors: 1 });
    // moved>0 so backfill + audit DID run
    expect(auditMock).toHaveBeenCalled();
    const audit = auditMock.mock.calls[0][0];
    expect(audit.details.affectedEventIds).toEqual(['tev-b']);   // only the moved event
    expect(audit.details.affectedCount).toBe(1);
  });

  it('F2: paginates the GSI2 query and moves events from BOTH pages', async () => {
    orgExistsMock.mockResolvedValueOnce(true);
    const evA = { ...unresolvedEvent, id: 'tev-a' }; const evB = { ...unresolvedEvent, id: 'tev-b' };
    mockSend
      .mockResolvedValueOnce({ Items: [evA], LastEvaluatedKey: { k: 1 } })            // page 1
      .mockResolvedValueOnce({ Items: [evB] })                                        // page 2 (no LEK)
      .mockResolvedValueOnce({ Item: { PK: 'RFQ#r1', SK: 'META', email: 'a@acme.com' } }) // readSourceEmail
      .mockResolvedValueOnce({});                                                     // backfill Update
    moveMock.mockResolvedValue({ moved: true, skipped: false, contactStatus: 'linked' });
    auditMock.mockResolvedValueOnce('aud-1');
    const r = await linkStructuredUnit({ sourceType: 'rfq', sourceEntityId: 'r1', targetOrgId: 'acme.com', operator: 'op' });
    expect(moveMock).toHaveBeenCalledTimes(2);      // both pages moved
    expect(r).toMatchObject({ affected: 2, moved: 2 });
    // the second call had ExclusiveStartKey from page 1's LastEvaluatedKey
    const q2 = mockSend.mock.calls[1][0].input;
    expect(q2.ExclusiveStartKey).toEqual({ k: 1 });
  });

  it('F3: a source-enrichment failure is isolated — events still move with enrichmentError', async () => {
    orgExistsMock.mockResolvedValueOnce(true);
    mockSend
      .mockResolvedValueOnce({ Items: [unresolvedEvent] })                            // query
      .mockRejectedValueOnce(new Error('source read boom'))                           // readSourceEmail GET throws
      .mockResolvedValueOnce({});                                                     // backfill Update
    moveMock.mockResolvedValueOnce({ moved: true, skipped: false, contactStatus: 'enrichment_error' });
    auditMock.mockResolvedValueOnce('aud-1');
    const r = await linkStructuredUnit({ sourceType: 'rfq', sourceEntityId: 'r1', targetOrgId: 'acme.com', operator: 'op' });
    expect(moveMock).toHaveBeenCalledWith(expect.objectContaining({ email: null, enrichmentError: true }));
    expect(r).toMatchObject({ moved: 1 });
  });

  it('F1: a post-commit backfill/audit failure does NOT fail the mutation (moves already durable)', async () => {
    orgExistsMock.mockResolvedValueOnce(true);
    mockSend
      .mockResolvedValueOnce({ Items: [unresolvedEvent] })                            // query
      .mockResolvedValueOnce({ Item: { PK: 'RFQ#r1', SK: 'META', email: 'a@acme.com' } }) // readSourceEmail
      .mockRejectedValueOnce(new Error('backfill boom'));                             // backfill Update throws
    moveMock.mockResolvedValueOnce({ moved: true, skipped: false, contactStatus: 'linked' });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = await linkStructuredUnit({ sourceType: 'rfq', sourceEntityId: 'r1', targetOrgId: 'acme.com', operator: 'op' }); // must NOT throw
    expect(r).toMatchObject({ moved: 1, postCommitStatus: 'post_commit_failed' });
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });
});
