import { describe, it, expect, vi, beforeEach } from 'vitest';
const mockSend = vi.fn();
vi.mock('../dynamodb', () => ({ docClient: { send: (...a: unknown[]) => mockSend(...a) }, TABLE_NAME: () => 'T' }));
const orgExistsMock = vi.fn(); const moveMock = vi.fn(); const auditMock = vi.fn();
vi.mock('../orgStore', () => ({ orgExists: (o: string) => orgExistsMock(o), recomputeRollupsForOrg: vi.fn() }));
vi.mock('./manualMoveTimelineEvent', () => ({ manualMoveTimelineEvent: (a: unknown) => moveMock(a) }));
vi.mock('../auditStore', () => ({ writeLinkAuditLog: (a: unknown) => auditMock(a) }));

const putRepairMarker = vi.fn(); const deleteRepairMarker = vi.fn();
vi.mock('../repair/repairMarker', () => ({
  putRepairMarker: (...a: unknown[]) => putRepairMarker(...a),
  deleteRepairMarker: (...a: unknown[]) => deleteRepairMarker(...a),
}));
const replayStructuredSideEffects = vi.fn();
vi.mock('../repair/replaySideEffects', () => ({ replayStructuredSideEffects: (...a: unknown[]) => replayStructuredSideEffects(...a) }));

// readSourceEmailForUnit stays REAL (exercised via the docClient mock, as before). Only the
// exported backfillTargetPk is overridden so linkStructuredUnit's link-time caching call is
// independently controllable per test (default resolves like the real rfq/lead mapping would).
const backfillTargetPkMock = vi.fn();
vi.mock('./sourceEmail', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./sourceEmail')>();
  return { ...actual, backfillTargetPk: (...a: unknown[]) => backfillTargetPkMock(...a) };
});

import { linkStructuredUnit } from './linkStructuredUnit';

const unresolvedEvent = { id: 'tev-a', orgId: 'unresolved-rfq-r1', kind: 'rfq_submitted', source: 'rfq', sourceEntityType: 'rfq', sourceEntityId: 'r1', occurredAt: 't', resolutionStatus: 'unresolved' };
beforeEach(() => {
  mockSend.mockReset(); orgExistsMock.mockReset(); moveMock.mockReset(); auditMock.mockReset();
  putRepairMarker.mockReset(); deleteRepairMarker.mockReset();
  replayStructuredSideEffects.mockReset();
  replayStructuredSideEffects.mockResolvedValue({ ok: true, backfillStatus: 'written' });
  backfillTargetPkMock.mockReset();
  backfillTargetPkMock.mockResolvedValue('RFQ#1');
});

describe('linkStructuredUnit', () => {
  it('rejects a non-existent / unresolved-* target before any write', async () => {
    orgExistsMock.mockResolvedValueOnce(false);
    await expect(linkStructuredUnit({ sourceType: 'rfq', sourceEntityId: 'r1', targetOrgId: 'nope.com', operator: 'op' })).rejects.toThrow(/target/i);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('alreadyLinked (empty partition) does NOT backfill the source from the request target (stale-client safe)', async () => {
    orgExistsMock.mockResolvedValueOnce(true);
    mockSend.mockResolvedValueOnce({ Items: [] });   // no unresolved events → alreadyLinked
    const r = await linkStructuredUnit({ sourceType: 'rfq', sourceEntityId: 'r1', targetOrgId: 'acme.com', operator: 'op' });
    expect(r).toMatchObject({ alreadyLinked: true });
    const updates = mockSend.mock.calls.filter((c) => c[0].constructor?.name === 'UpdateCommand');
    expect(updates.length).toBe(0);                  // NO backfill from a possibly-stale request target
    expect(auditMock).not.toHaveBeenCalled();
    expect(putRepairMarker).not.toHaveBeenCalled();
  });

  it('moves each unresolved event, writes a repair marker, and delegates backfill+audit to replayStructuredSideEffects', async () => {
    orgExistsMock.mockResolvedValueOnce(true);
    mockSend
      .mockResolvedValueOnce({ Items: [unresolvedEvent] })                         // synthetic partition query
      .mockResolvedValueOnce({ Item: { PK: 'RFQ#r1', SK: 'META', email: 'a@acme.com' } }); // readSourceEmail GET
    moveMock.mockResolvedValueOnce({ moved: true, skipped: false, contactStatus: 'linked' });
    const r = await linkStructuredUnit({ sourceType: 'rfq', sourceEntityId: 'r1', targetOrgId: 'acme.com', operator: 'op@x.com' });
    expect(moveMock).toHaveBeenCalledTimes(1);
    expect(r).toMatchObject({ affected: 1, moved: 1, skipped: 0, errors: 0, sourceBackfillStatus: 'written', postCommitStatus: 'ok' });
    expect(putRepairMarker).toHaveBeenCalledWith(expect.objectContaining({
      unitType: 'structured', unitKey: 'unresolved-rfq-r1', targetOrgId: 'acme.com', operator: 'op@x.com',
      sourceType: 'rfq', sourceEntityId: 'r1', affectedEventIds: ['tev-a'], movedCount: 1, contactStatus: 'linked',
    }));
    expect(replayStructuredSideEffects).toHaveBeenCalledWith(expect.objectContaining({
      sourceType: 'rfq', sourceEntityId: 'r1', targetOrgId: 'acme.com', unitKey: 'unresolved-rfq-r1',
      affectedEventIds: ['tev-a'], movedCount: 1, contactStatus: 'linked',
    }));
    expect(deleteRepairMarker).toHaveBeenCalledWith('structured', 'unresolved-rfq-r1');
  });

  it('a source_conflict from replay is surfaced but does not delete the marker (finding 3, moved layer)', async () => {
    orgExistsMock.mockResolvedValueOnce(true);
    mockSend
      .mockResolvedValueOnce({ Items: [unresolvedEvent] })
      .mockResolvedValueOnce({ Item: { PK: 'RFQ#r1', SK: 'META', email: 'a@acme.com' } });
    moveMock.mockResolvedValueOnce({ moved: true, skipped: false, contactStatus: 'linked' });
    replayStructuredSideEffects.mockResolvedValueOnce({ ok: false, errorType: 'source_conflict', backfillStatus: 'conflict' });
    const r = await linkStructuredUnit({ sourceType: 'rfq', sourceEntityId: 'r1', targetOrgId: 'acme.com', operator: 'op' });
    expect(r.sourceBackfillStatus).toBe('conflict');
    expect(r.postCommitStatus).toBe('post_commit_failed');
    expect(deleteRepairMarker).not.toHaveBeenCalled();
  });

  it('all events condition-fail (raced) → moved:0, NO source backfill, NO marker (finding 2)', async () => {
    orgExistsMock.mockResolvedValueOnce(true);
    mockSend
      .mockResolvedValueOnce({ Items: [unresolvedEvent] })
      .mockResolvedValueOnce({ Item: { PK: 'RFQ#r1', SK: 'META', email: 'a@acme.com' } });
    moveMock.mockResolvedValueOnce({ moved: false, skipped: true, contactStatus: 'missing_email' });
    const r = await linkStructuredUnit({ sourceType: 'rfq', sourceEntityId: 'r1', targetOrgId: 'acme.com', operator: 'op' });
    expect(r).toMatchObject({ moved: 0, skipped: 1 });
    expect(auditMock).not.toHaveBeenCalled();
    expect(putRepairMarker).not.toHaveBeenCalled();
    const updates = mockSend.mock.calls.filter((c) => c[0].constructor?.name === 'UpdateCommand');
    expect(updates.length).toBe(0);
  });

  it('per-event isolation: one move throws → errors+1, loop continues, the other event still moves', async () => {
    orgExistsMock.mockResolvedValueOnce(true);
    const evA = { ...unresolvedEvent, id: 'tev-a' };
    const evB = { ...unresolvedEvent, id: 'tev-b' };
    mockSend
      .mockResolvedValueOnce({ Items: [evA, evB] })                                 // synthetic partition query (2 events)
      .mockResolvedValueOnce({ Item: { PK: 'RFQ#r1', SK: 'META', email: 'a@acme.com' } }); // readSourceEmail GET
    moveMock
      .mockRejectedValueOnce(new Error('move boom'))                                // evA throws
      .mockResolvedValueOnce({ moved: true, skipped: false, contactStatus: 'linked' }); // evB moves
    const r = await linkStructuredUnit({ sourceType: 'rfq', sourceEntityId: 'r1', targetOrgId: 'acme.com', operator: 'op' });
    expect(moveMock).toHaveBeenCalledTimes(2);            // loop did NOT abort after the throw
    expect(r).toMatchObject({ affected: 2, moved: 1, errors: 1 });
    // moved>0 so the marker + replay DID run, scoped to only the moved event
    expect(putRepairMarker).toHaveBeenCalledWith(expect.objectContaining({ affectedEventIds: ['tev-b'], movedCount: 1 }));
    expect(replayStructuredSideEffects).toHaveBeenCalledWith(expect.objectContaining({ affectedEventIds: ['tev-b'], movedCount: 1 }));
  });

  it('F2: paginates the GSI2 query and moves events from BOTH pages', async () => {
    orgExistsMock.mockResolvedValueOnce(true);
    const evA = { ...unresolvedEvent, id: 'tev-a' }; const evB = { ...unresolvedEvent, id: 'tev-b' };
    mockSend
      .mockResolvedValueOnce({ Items: [evA], LastEvaluatedKey: { k: 1 } })            // page 1
      .mockResolvedValueOnce({ Items: [evB] })                                        // page 2 (no LEK)
      .mockResolvedValueOnce({ Item: { PK: 'RFQ#r1', SK: 'META', email: 'a@acme.com' } }); // readSourceEmail
    moveMock.mockResolvedValue({ moved: true, skipped: false, contactStatus: 'linked' });
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
      .mockRejectedValueOnce(new Error('source read boom'));                          // readSourceEmail GET throws
    moveMock.mockResolvedValueOnce({ moved: true, skipped: false, contactStatus: 'enrichment_error' });
    const r = await linkStructuredUnit({ sourceType: 'rfq', sourceEntityId: 'r1', targetOrgId: 'acme.com', operator: 'op' });
    expect(moveMock).toHaveBeenCalledWith(expect.objectContaining({ email: null, enrichmentError: true }));
    expect(r).toMatchObject({ moved: 1 });
  });

  it('a marker-put failure does NOT fail the mutation (moves already durable)', async () => {
    orgExistsMock.mockResolvedValueOnce(true);
    mockSend
      .mockResolvedValueOnce({ Items: [unresolvedEvent] })                            // query
      .mockResolvedValueOnce({ Item: { PK: 'RFQ#r1', SK: 'META', email: 'a@acme.com' } }); // readSourceEmail
    moveMock.mockResolvedValueOnce({ moved: true, skipped: false, contactStatus: 'linked' });
    putRepairMarker.mockRejectedValueOnce(new Error('marker put boom'));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = await linkStructuredUnit({ sourceType: 'rfq', sourceEntityId: 'r1', targetOrgId: 'acme.com', operator: 'op' }); // must NOT throw
    expect(r).toMatchObject({ moved: 1, postCommitStatus: 'post_commit_failed' });
    expect(errSpy).toHaveBeenCalled();
    expect(replayStructuredSideEffects).toHaveBeenCalled();   // still runs despite the marker-put failure
    errSpy.mockRestore();
  });

  // --- Task 5 cases (repair marker + shared replay wiring) ---

  it('writes a repair marker AFTER commit then deletes it on replay ok', async () => {
    orgExistsMock.mockResolvedValueOnce(true);
    const ev = { ...unresolvedEvent, orgId: 'unresolved-rfq-1', sourceEntityId: '1' };
    mockSend
      .mockResolvedValueOnce({ Items: [ev] })                                          // synthetic partition query
      .mockResolvedValueOnce({ Item: { PK: 'RFQ#1', SK: 'META', email: 'a@acme.com' } }); // readSourceEmail GET
    moveMock.mockResolvedValueOnce({ moved: true, skipped: false, contactStatus: 'linked' });
    const out = await linkStructuredUnit({ sourceType: 'rfq', sourceEntityId: '1', targetOrgId: 'acme.com', operator: 'op' });
    expect(putRepairMarker).toHaveBeenCalledWith(expect.objectContaining({ unitType: 'structured', targetOrgId: 'acme.com' }));
    expect(replayStructuredSideEffects).toHaveBeenCalled();
    expect(deleteRepairMarker).toHaveBeenCalledWith('structured', 'unresolved-rfq-1');
    expect(out.postCommitStatus).toBe('ok');
  });

  it('keeps the marker (no delete) + post_commit_failed when replay is not ok', async () => {
    orgExistsMock.mockResolvedValueOnce(true);
    const ev = { ...unresolvedEvent, orgId: 'unresolved-rfq-1', sourceEntityId: '1' };
    mockSend
      .mockResolvedValueOnce({ Items: [ev] })
      .mockResolvedValueOnce({ Item: { PK: 'RFQ#1', SK: 'META', email: 'a@acme.com' } });
    moveMock.mockResolvedValueOnce({ moved: true, skipped: false, contactStatus: 'linked' });
    replayStructuredSideEffects.mockResolvedValueOnce({ ok: false, errorType: 'transient', backfillStatus: 'written' });
    const out = await linkStructuredUnit({ sourceType: 'rfq', sourceEntityId: '1', targetOrgId: 'acme.com', operator: 'op' });
    expect(deleteRepairMarker).not.toHaveBeenCalled();
    expect(out.postCommitStatus).toBe('post_commit_failed');
  });

  it('moved===0 does NOT put a marker', async () => {
    orgExistsMock.mockResolvedValueOnce(true);
    const ev = { ...unresolvedEvent, orgId: 'unresolved-rfq-1', sourceEntityId: '1' };
    mockSend
      .mockResolvedValueOnce({ Items: [ev] })
      .mockResolvedValueOnce({ Item: { PK: 'RFQ#1', SK: 'META', email: 'a@acme.com' } });
    moveMock.mockResolvedValueOnce({ moved: false, skipped: true, contactStatus: 'missing_email' });
    const out = await linkStructuredUnit({ sourceType: 'rfq', sourceEntityId: '1', targetOrgId: 'acme.com', operator: 'op' });
    expect(out.moved).toBe(0);
    expect(putRepairMarker).not.toHaveBeenCalled();
  });

  it('empty synthetic partition (alreadyLinked) does NOT put a marker', async () => {
    orgExistsMock.mockResolvedValueOnce(true);
    mockSend.mockResolvedValueOnce({ Items: [] });
    const out = await linkStructuredUnit({ sourceType: 'rfq', sourceEntityId: '1', targetOrgId: 'acme.com', operator: 'op' });
    expect(out.alreadyLinked).toBe(true);
    expect(putRepairMarker).not.toHaveBeenCalled();
  });

  it('marker still written when link-time backfillTargetPk throws (logistics), with backfillPk null', async () => {
    orgExistsMock.mockResolvedValueOnce(true);
    const ev = { id: 'tev-l', orgId: 'unresolved-logistics-lc1', kind: 'logistics_created', source: 'logistics', sourceEntityType: 'logistics', sourceEntityId: 'lc1', occurredAt: 't', resolutionStatus: 'unresolved' };
    mockSend
      .mockResolvedValueOnce({ Items: [ev] })                 // synthetic partition query
      .mockResolvedValueOnce({});                              // readSourceEmailForUnit's internal LOGISTICS META Get (no relatedOrderId)
    moveMock.mockResolvedValueOnce({ moved: true, skipped: false, contactStatus: 'missing_email' });
    backfillTargetPkMock.mockRejectedValueOnce(new Error('logistics get boom'));  // link-time caching call throws
    const out = await linkStructuredUnit({ sourceType: 'logistics', sourceEntityId: 'lc1', targetOrgId: 'acme.com', operator: 'op' });
    expect(putRepairMarker).toHaveBeenCalledWith(expect.objectContaining({ backfillPk: null, sourceType: 'logistics' }));
    expect(out.moved).toBe(1);
  });

  it('deleteRepairMarker failure ⇒ success + post_commit_failed (drainer will re-drive)', async () => {
    orgExistsMock.mockResolvedValueOnce(true);
    const ev = { ...unresolvedEvent, orgId: 'unresolved-rfq-1', sourceEntityId: '1' };
    mockSend
      .mockResolvedValueOnce({ Items: [ev] })
      .mockResolvedValueOnce({ Item: { PK: 'RFQ#1', SK: 'META', email: 'a@acme.com' } });
    moveMock.mockResolvedValueOnce({ moved: true, skipped: false, contactStatus: 'linked' });
    deleteRepairMarker.mockRejectedValueOnce(new Error('delete boom'));
    const out = await linkStructuredUnit({ sourceType: 'rfq', sourceEntityId: '1', targetOrgId: 'acme.com', operator: 'op' });
    expect(out.postCommitStatus).toBe('post_commit_failed');
  });

  it('quote marker always caches backfillPk (order) from in-memory events', async () => {
    orgExistsMock.mockResolvedValueOnce(true);
    const ev = { id: 'tev-q', orgId: 'unresolved-quote-q1', kind: 'quote_created', source: 'quote', sourceEntityType: 'quote', sourceEntityId: 'q1', occurredAt: 't', resolutionStatus: 'unresolved', payload: { orderId: 'o9' } };
    mockSend
      .mockResolvedValueOnce({ Items: [ev] })   // synthetic partition query
      .mockResolvedValueOnce({});                // readSourceEmailForUnit's internal ORDER#o9 META Get (no email fields)
    moveMock.mockResolvedValueOnce({ moved: true, skipped: false, contactStatus: 'missing_email' });
    backfillTargetPkMock.mockResolvedValueOnce('ORDER#o9');  // link-time caching call
    await linkStructuredUnit({ sourceType: 'quote', sourceEntityId: 'q1', targetOrgId: 'acme.com', operator: 'op' });
    expect(putRepairMarker).toHaveBeenCalledWith(expect.objectContaining({ backfillPk: 'ORDER#o9' }));
  });
});
