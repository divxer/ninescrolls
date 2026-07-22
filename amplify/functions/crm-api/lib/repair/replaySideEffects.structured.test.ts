import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetCommand as RealGetCommand, UpdateCommand as RealUpdateCommand, TransactWriteCommand as RealTransactWriteCommand, QueryCommand as RealQueryCommand } from '@aws-sdk/lib-dynamodb';
const send = vi.fn();
vi.mock('../dynamodb', () => ({ docClient: { send: (...a: unknown[]) => send(...a) }, TABLE_NAME: () => 'T' }));
const writeLinkAuditLog = vi.fn();
vi.mock('../auditStore', () => ({ writeLinkAuditLog: (...a: unknown[]) => writeLinkAuditLog(...a) }));
const upsertContact = vi.fn();
vi.mock('../contactStore', () => ({ upsertContact: (...a: unknown[]) => upsertContact(...a) }));
const recomputeRollupsForOrg = vi.fn();
vi.mock('../orgStore', () => ({ recomputeRollupsForOrg: (...a: unknown[]) => recomputeRollupsForOrg(...a) }));
const markRollupApplied = vi.fn();
vi.mock('../timelineStore', () => ({ markRollupApplied: (...a: unknown[]) => markRollupApplied(...a) }));
import { replayStructuredSideEffects, resolveEffectiveTarget } from './replaySideEffects';

const base = { sourceType: 'rfq', sourceEntityId: '1', backfillPk: 'RFQ#1', targetOrgId: 'acme.com',
  unitKey: 'unresolved-rfq-1', operator: 'op', createdAt: '2026-07-08T00:00:00.000Z',
  affectedEventIds: ['e1'], movedCount: 1, contactStatus: 'linked' };

beforeEach(() => {
  send.mockReset(); writeLinkAuditLog.mockReset(); writeLinkAuditLog.mockResolvedValue('audit-x');
  upsertContact.mockReset(); upsertContact.mockResolvedValue({ contactId: 'ct-1', outcome: 'written' });
  recomputeRollupsForOrg.mockReset(); recomputeRollupsForOrg.mockResolvedValue(undefined);
  markRollupApplied.mockReset(); markRollupApplied.mockResolvedValue(undefined);
});

describe('replayStructuredSideEffects', () => {
  it('ok: backfill written + audit written with deterministic id', async () => {
    send.mockResolvedValueOnce({}); // conditional Update succeeds
    const r = await replayStructuredSideEffects(base);
    expect(r).toEqual({ ok: true, backfillStatus: 'written' });
    expect(writeLinkAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      id: expect.stringMatching(/^audit-[0-9a-f]{16}$/), reason: 'manual_link_unit', timestamp: base.createdAt,
      details: expect.objectContaining({ sourceBackfillStatus: 'written', affectedEventIds: ['e1'] }),
    }));
  });
  it('already_set: conditional fails but source already points at target → ok', async () => {
    send.mockRejectedValueOnce(Object.assign(new Error('ccfe'), { name: 'ConditionalCheckFailedException' }));
    send.mockResolvedValueOnce({ Item: { matchedOrgId: 'acme.com' } }); // Get
    const r = await replayStructuredSideEffects(base);
    expect(r.ok).toBe(true); expect(r.backfillStatus).toBe('already_set');
  });
  it('source_conflict: source points at a DIFFERENT real org → audit still written, not ok', async () => {
    send.mockRejectedValueOnce(Object.assign(new Error('ccfe'), { name: 'ConditionalCheckFailedException' }));
    send.mockResolvedValueOnce({ Item: { matchedOrgId: 'other.com' } });
    const r = await replayStructuredSideEffects(base);
    expect(r).toMatchObject({ ok: false, errorType: 'source_conflict', backfillStatus: 'conflict' });
    expect(writeLinkAuditLog).toHaveBeenCalled(); // audit written despite conflict
  });
  it('audit CCFE (already written) is idempotent success, not transient', async () => {
    send.mockResolvedValueOnce({}); // backfill ok
    writeLinkAuditLog.mockRejectedValueOnce(Object.assign(new Error('dup'), { name: 'ConditionalCheckFailedException' }));
    const r = await replayStructuredSideEffects(base);
    expect(r.ok).toBe(true);
  });
  it('transient: backfill Update throws a non-CCFE error → transient', async () => {
    send.mockRejectedValueOnce(new Error('throttled'));
    const r = await replayStructuredSideEffects(base);
    expect(r).toMatchObject({ ok: false, errorType: 'transient' });
  });
  it('logistics with NO cached backfillPk re-resolves via LOGISTICS META Get', async () => {
    send.mockResolvedValueOnce({ Item: { relatedOrderId: 'o9' } }); // resolveBackfillPk Get
    send.mockResolvedValueOnce({}); // backfill Update on ORDER#o9
    const r = await replayStructuredSideEffects({ ...base, sourceType: 'logistics', sourceEntityId: 'lc1', backfillPk: null });
    expect(r.ok).toBe(true);
    const updateInput = send.mock.calls[1][0].input;
    expect(updateInput.Key.PK).toBe('ORDER#o9');
  });
  it('logistics re-resolve Get throws → transient (never a lost backfill)', async () => {
    send.mockRejectedValueOnce(new Error('get boom'));
    const r = await replayStructuredSideEffects({ ...base, sourceType: 'logistics', sourceEntityId: 'lc1', backfillPk: null });
    expect(r).toMatchObject({ ok: false, errorType: 'transient' });
  });
  it('no source (pk resolves null) → no_source counts as ok', async () => {
    const r = await replayStructuredSideEffects({ ...base, sourceType: 'quote', sourceEntityId: 'q1', backfillPk: null });
    expect(r).toMatchObject({ ok: true, backfillStatus: 'no_source' });
  });
  it('transient: backfill SUCCEEDS but audit throws a non-CCFE error → transient', async () => {
    send.mockResolvedValueOnce({}); // backfill Update ok
    writeLinkAuditLog.mockRejectedValueOnce(new Error('audit throttled')); // non-CCFE
    const r = await replayStructuredSideEffects(base);
    expect(r).toMatchObject({ ok: false, errorType: 'transient' });
  });
});

// ---------------------------------------------------------------------------------------------
// Task 8: generational replay — source stamps, canonical-successor resolution, write-time fences
// ---------------------------------------------------------------------------------------------
const GEN_A = '01J0AAAAAAAAAAAAAAAAAAAAAA';
const GEN_B = '01J0BBBBBBBBBBBBBBBBBBBBBB';

describe('replayStructuredSideEffects (generational)', () => {
  // -- stateful dispatcher over the send mock (org reads by key, queued behaviors elsewhere) ----
  let orgStates: Map<string, Array<Record<string, unknown> | null>>;
  let orgReadRejects: Error[];
  let transactBehaviors: Array<{ reject?: unknown }>;
  let getBehaviors: Array<Record<string, unknown>>;
  let timelinePages: Map<string, Array<Array<Record<string, unknown>>>>;

  function mockOrg(orgId: string, attrs: Record<string, unknown> | null) {
    const q = orgStates.get(orgId) ?? [];
    q.push(attrs); orgStates.set(orgId, q);
  }
  function rejectOrgReadOnce(err: Error) { orgReadRejects.push(err); }
  function transactSucceeds() { transactBehaviors.push({}); }
  function rejectTransactWithCancellation(codes: string[]) {
    transactBehaviors.push({ reject: Object.assign(new Error('cancelled'), {
      name: 'TransactionCanceledException',
      CancellationReasons: codes.map((Code) => ({ Code })),
    }) });
  }
  function rejectTransactWithNoReasons() {
    transactBehaviors.push({ reject: Object.assign(new Error('cancelled'), { name: 'TransactionCanceledException' }) });
  }
  // each call queues ONE query result page for the org partition; a query on an exhausted queue
  // returns [] (matches DynamoDB: nothing left under the key condition)
  function mockTimelinePage(orgId: string, events: Array<Record<string, unknown>>) {
    const q = timelinePages.get(`ORG#${orgId}`) ?? [];
    q.push(events);
    timelinePages.set(`ORG#${orgId}`, q);
  }
  function evStamped(id: string, gen: string) {
    return { PK: `TLEVENT#${id}`, SK: 'A', id, orgId: 'a.com', linkGeneration: gen,
      occurredAt: '2026-07-08T00:00:00.000Z', GSI2PK: 'ORG#a.com', GSI2SK: `TLEVENT#2026-07-08T00:00:00.000Z#${id}` };
  }

  beforeEach(() => {
    orgStates = new Map(); orgReadRejects = []; transactBehaviors = []; getBehaviors = []; timelinePages = new Map();
    send.mockImplementation((cmd: unknown) => {
      if (cmd instanceof RealGetCommand) {
        const pk = String((cmd.input.Key as Record<string, unknown>)?.PK ?? '');
        if (pk.startsWith('ORG#') && (cmd.input.Key as Record<string, unknown>)?.SK === 'META') {
          if (orgReadRejects.length) return Promise.reject(orgReadRejects.shift());
          const orgId = pk.slice('ORG#'.length);
          const q = orgStates.get(orgId) ?? [];
          const st = q.length > 1 ? q.shift() : q[0]; // sequential states; last one sticks
          return Promise.resolve(st ? { Item: { orgId, ...st } } : {});
        }
        return Promise.resolve(getBehaviors.shift() ?? {});
      }
      if (cmd instanceof RealTransactWriteCommand) {
        const b = transactBehaviors.shift();
        if (b?.reject) return Promise.reject(b.reject);
        return Promise.resolve({});
      }
      if (cmd instanceof RealQueryCommand) {
        const pk = String((cmd.input.ExpressionAttributeValues as Record<string, unknown>)?.[':pk'] ?? '');
        const evs = timelinePages.get(pk)?.shift() ?? [];
        return Promise.resolve({ Items: evs });
      }
      return Promise.resolve({}); // UpdateCommand etc.
    });
  });

  // -- helpers over the recorded calls ---------------------------------------------------------
  const transactCalls = () => send.mock.calls.filter((c) => c[0] instanceof RealTransactWriteCommand);
  const lastTransactInput = () => transactCalls().at(-1)![0].input;
  function backfillWriteInput() {
    for (const c of transactCalls()) {
      const u = (c[0].input.TransactItems as Array<Record<string, any>>)[1]?.Update;
      if (u && String(u.UpdateExpression).includes('matchedOrgId')) return u;
    }
    throw new Error('no backfill write found');
  }
  const orgReads = () => send.mock.calls
    .filter((c) => c[0] instanceof RealGetCommand && String(c[0].input.Key?.PK ?? '').startsWith('ORG#'))
    .map((c) => c[0].input);
  function writesTo(prefix: string) {
    const hits: unknown[] = [];
    for (const c of send.mock.calls) {
      const cmd = c[0];
      if (cmd instanceof RealUpdateCommand && String(cmd.input.Key?.PK ?? '').startsWith(prefix)) hits.push(cmd.input);
      if (cmd instanceof RealTransactWriteCommand) {
        for (const t of (cmd.input.TransactItems ?? []) as Array<Record<string, any>>) {
          if (String(t.Update?.Key?.PK ?? '').startsWith(prefix)) hits.push(t.Update);
          if (String(t.Put?.Item?.PK ?? '').startsWith(prefix)) hits.push(t.Put);
        }
      }
    }
    return hits;
  }
  function updatesTo(prefix: string) {
    const hits: Array<Record<string, any>> = [];
    for (const c of transactCalls()) {
      for (const t of (c[0].input.TransactItems ?? []) as Array<Record<string, any>>) {
        if (String(t.Put?.Item?.PK ?? '').startsWith(prefix)) hits.push(t.Put);
        if (String(t.Update?.Key?.PK ?? '').startsWith(prefix)) hits.push(t.Update);
      }
    }
    return hits;
  }
  const auditCallDetails = () => (writeLinkAuditLog.mock.calls.at(-1)![0] as Record<string, any>).details;
  const dirtyRollupCalls = () => recomputeRollupsForOrg.mock.calls.map((c) => ({ orgId: c[0] as string }));

  // -- generational backfill stamps ------------------------------------------------------------
  it('backfill stamps matchedOrgId + matchedOrgLinkGeneration atomically', async () => {
    mockOrg('acme.com', { status: 'active' });
    const r = await replayStructuredSideEffects({ ...base, generation: GEN_B });
    expect(r.ok).toBe(true);
    const u = backfillWriteInput();
    expect(u.UpdateExpression).toContain('matchedOrgId');
    expect(u.UpdateExpression).toContain('matchedOrgLinkGeneration');
    expect(u.ConditionExpression).toContain('matchedOrgLinkGeneration < :gen');
  });
  it('older generation vs newer stamp → superseded SUCCESS (not conflict, not stuck)', async () => {
    mockOrg('a.com', { status: 'active' });
    rejectTransactWithCancellation(['None', 'ConditionalCheckFailed']);           // the backfill write's own condition
    getBehaviors.push({ Item: { matchedOrgId: 'b.com', matchedOrgLinkGeneration: GEN_B } });
    const r = await replayStructuredSideEffects({ ...base, targetOrgId: 'a.com', generation: GEN_A });
    expect(r.ok).toBe(true);
    expect(r.backfillStatus).toBe('superseded');
  });
  it('genuine non-generational real-org mismatch is still conflict', async () => {
    mockOrg('acme.com', { status: 'active' });
    rejectTransactWithCancellation(['None', 'ConditionalCheckFailed']);
    getBehaviors.push({ Item: { matchedOrgId: 'other.com' } });                   // no generation stamp
    const r = await replayStructuredSideEffects({ ...base, generation: GEN_A });
    expect(r).toMatchObject({ ok: false, errorType: 'source_conflict' });
  });

  // ---- spec R10 final: canonical-successor resolution ----------------------------------------
  it('MERGE-BEFORE-REPLAY: archived target with mergedInto → replay applies to the successor; audit carries both', async () => {
    mockOrg('a.com', { status: 'archived', mergedInto: 'b.com' });
    mockOrg('b.com', { status: 'active' });
    const r = await replayStructuredSideEffects({ ...base, targetOrgId: 'a.com', generation: GEN_A });
    expect(r.ok).toBe(true);
    expect(backfillWriteInput().ExpressionAttributeValues[':o']).toBe('b.com');   // applied THERE
    expect(auditCallDetails()).toMatchObject({ requestedTargetOrgId: 'a.com', effectiveTargetOrgId: 'b.com' });
  });
  it('MULTI-HOP: a→b→c chain resolves to the final active org', async () => {
    mockOrg('a.com', { status: 'archived', mergedInto: 'b.com' });
    mockOrg('b.com', { status: 'archived', mergedInto: 'c.com' });
    mockOrg('c.com', { status: 'active' });
    const r = await replayStructuredSideEffects({ ...base, targetOrgId: 'a.com', generation: GEN_A });
    expect(r.ok).toBe(true);
    expect(backfillWriteInput().ExpressionAttributeValues[':o']).toBe('c.com');
  });
  it('MISSING SUCCESSOR: archived without mergedInto → target_unavailable, ok:false, NO writes', async () => {
    mockOrg('a.com', { status: 'archived' });
    const r = await replayStructuredSideEffects({ ...base, targetOrgId: 'a.com', generation: GEN_A });
    expect(r).toMatchObject({ ok: false, errorType: 'target_unavailable' });
    expect(writesTo('RFQ#')).toHaveLength(0);                                     // nothing half-applied
    expect(writeLinkAuditLog).not.toHaveBeenCalled();
  });
  it('CYCLE + DEPTH LIMIT: a→b→a and chains >5 hops → target_unavailable, no infinite walk', async () => {
    mockOrg('a.com', { status: 'archived', mergedInto: 'b.com' });
    mockOrg('b.com', { status: 'archived', mergedInto: 'a.com' });
    const r = await replayStructuredSideEffects({ ...base, targetOrgId: 'a.com', generation: GEN_A });
    expect(r).toMatchObject({ ok: false, errorType: 'target_unavailable' });
    expect(orgReads()).toHaveLength(2);                                            // visited-set stopped it, not a timeout
  });
  it('STATUS DISCIPLINE: only exact active applies; non-navigable status is structural; reads are ConsistentRead', async () => {
    mockOrg('a.com', { status: 'pending_review' });                                // neither active nor archived
    const r = await replayStructuredSideEffects({ ...base, targetOrgId: 'a.com', generation: GEN_A });
    expect(r).toMatchObject({ ok: false, errorType: 'target_unavailable' });
    expect(orgReads()[0].ConsistentRead).toBe(true);
  });
  it('TRANSIENT vs STRUCTURAL: an org-read THROW is transient (retryable), never target_unavailable', async () => {
    rejectOrgReadOnce(new Error('throttled'));
    const r = await replayStructuredSideEffects({ ...base, targetOrgId: 'a.com', generation: GEN_A });
    expect(r).toMatchObject({ ok: false, errorType: 'transient' });
  });

  // ---- chain-derived redirect sources (cross-invocation durability) --------------------------
  // `mergedInto` persists forever, so the walk from the requested org passes through EVERY org
  // that was ever an effective target for this unit and later merged away — the archived orgs
  // VISITED are the durable redirect-source list (no marker schema, no in-memory state).
  it('resolveEffectiveTarget returns the archived orgs VISITED on the walk', async () => {
    mockOrg('a.com', { status: 'archived', mergedInto: 'b.com' });
    mockOrg('b.com', { status: 'archived', mergedInto: 'c.com' });
    mockOrg('c.com', { status: 'active' });
    await expect(resolveEffectiveTarget('a.com')).resolves.toEqual({
      status: 'active', orgId: 'c.com', visitedArchived: ['a.com', 'b.com'],
    });
  });
  it('resolveEffectiveTarget: an already-active requested org yields an EMPTY visitedArchived', async () => {
    mockOrg('a.com', { status: 'active' });
    await expect(resolveEffectiveTarget('a.com')).resolves.toEqual({
      status: 'active', orgId: 'a.com', visitedArchived: [],
    });
  });

  // ---- write-time fences ---------------------------------------------------------------------
  it('WRITE-TIME FENCE: backfill rides a TransactWriteItems with an org-active ConditionCheck', async () => {
    mockOrg('a.com', { status: 'active' });
    transactSucceeds();
    await replayStructuredSideEffects({ ...base, targetOrgId: 'a.com', generation: GEN_A });
    const tx = lastTransactInput().TransactItems;
    expect(tx[0].ConditionCheck.ConditionExpression).toBe('#s = :active');
    expect(tx[1].Update.UpdateExpression).toContain('matchedOrgId');
  });
  it('FENCE CANCELLATION → re-resolve ONCE and apply to the successor; second cancellation → transient', async () => {
    mockOrg('a.com', { status: 'active' });                                        // preflight read says active…
    rejectTransactWithCancellation(['ConditionalCheckFailed', 'None']);            // …but the org check fails at write time
    mockOrg('a.com', { status: 'archived', mergedInto: 'b.com' });                 // re-resolve now sees the merge
    mockOrg('b.com', { status: 'active' });
    transactSucceeds();
    const r = await replayStructuredSideEffects({ ...base, targetOrgId: 'a.com', generation: GEN_A });
    expect(r.ok).toBe(true);
    expect(lastTransactInput().TransactItems[1].Update.ExpressionAttributeValues[':o']).toBe('b.com');
  });
  it('SECOND fence cancellation → transient (merge storm, retry next drain)', async () => {
    mockOrg('a.com', { status: 'active' });                                        // stays "active" on both resolves
    rejectTransactWithCancellation(['ConditionalCheckFailed', 'None']);
    rejectTransactWithCancellation(['ConditionalCheckFailed', 'None']);
    const r = await replayStructuredSideEffects({ ...base, targetOrgId: 'a.com', generation: GEN_A });
    expect(r).toMatchObject({ ok: false, errorType: 'transient' });
  });
  it('missing/malformed CancellationReasons → propagate as transient (never guessed into an outcome)', async () => {
    mockOrg('a.com', { status: 'active' });
    rejectTransactWithNoReasons();
    const r = await replayStructuredSideEffects({ ...base, targetOrgId: 'a.com', generation: GEN_A });
    expect(r).toMatchObject({ ok: false, errorType: 'transient' });
    expect(r.backfillStatus).not.toBe('superseded');
  });

  // ---- redirect event-move pass --------------------------------------------------------------
  it('REDIRECT MOVES THE UNIT EVENTS: effective≠requested pages linkGeneration-stamped events to the successor and dirties both rollups', async () => {
    mockOrg('a.com', { status: 'archived', mergedInto: 'b.com' });
    mockOrg('b.com', { status: 'active' });
    mockTimelinePage('a.com', [evStamped('tev-1', GEN_A), evStamped('tev-2', GEN_A)]);
    const r = await replayStructuredSideEffects({ ...base, targetOrgId: 'a.com', generation: GEN_A });
    expect(r.ok).toBe(true);
    const moves = updatesTo('TLEVENT#');
    expect(moves).toHaveLength(2);
    expect(moves[0].ConditionExpression).toContain('linkGeneration = :gen');       // only THIS unit's events
    expect(moves[0].Item.orgId).toBe('b.com');
    expect(dirtyRollupCalls().map((c) => c.orgId).sort()).toEqual(['a.com', 'b.com']);
    // R5/R6 coverage: EVERY transact in a redirect replay carries the org fence at index 0
    for (const c of transactCalls()) {
      expect((c[0].input.TransactItems as Array<Record<string, unknown>>)[0].ConditionCheck).toBeDefined();
    }
  });

  // Finding-2 regression: replay redirects requested A → effective B, moves SOME events A→B, then
  // B is merged into C mid-redirect (write fence cancels). The single re-resolve retry must page
  // EVERY org this replay has targeted so far — A AND B — or the events already moved to B (now
  // archived) are stranded there while the marker completes.
  it('REDIRECT RETRY AFTER MID-MOVE FENCE LOSS: the retry pages BOTH prior targets and moves B-stranded events to C', async () => {
    mockOrg('a.com', { status: 'archived', mergedInto: 'b.com' });
    mockOrg('b.com', { status: 'active' });                                        // first resolve: eff = B
    mockOrg('b.com', { status: 'archived', mergedInto: 'c.com' });                 // re-resolve sees the merge
    mockOrg('c.com', { status: 'active' });
    // first redirect pass at A→B: tev-1 moves, tev-2's fenced move cancels (B archived mid-move)
    mockTimelinePage('a.com', [evStamped('tev-1', GEN_A), evStamped('tev-2', GEN_A)]);
    transactSucceeds();                                                            // backfill at B
    transactSucceeds();                                                            // move tev-1 A→B
    rejectTransactWithCancellation(['ConditionalCheckFailed', 'None']);            // move tev-2: org fence lost
    // retry pass at C: A still holds tev-2; B holds the previously-moved tev-1 (stranded)
    mockTimelinePage('a.com', [evStamped('tev-2', GEN_A)]);
    mockTimelinePage('b.com', [{ ...evStamped('tev-1', GEN_A), orgId: 'b.com', GSI2PK: 'ORG#b.com' }]);
    const r = await replayStructuredSideEffects({ ...base, targetOrgId: 'a.com', generation: GEN_A });
    expect(r.ok).toBe(true);
    // the retry queried BOTH source partitions (requested A and abandoned intermediate B)
    const queriedPks = send.mock.calls.filter((c) => c[0] instanceof RealQueryCommand)
      .map((c) => String((c[0].input.ExpressionAttributeValues as Record<string, unknown>)[':pk']));
    expect(queriedPks).toEqual(['ORG#a.com', 'ORG#a.com', 'ORG#b.com']);
    // every stranded event converged on C, each move conditioned on ITS OWN source org
    const moves = updatesTo('TLEVENT#').filter((mv) => mv.Item?.orgId === 'c.com');
    expect(moves.map((mv) => [mv.Item.id, mv.ExpressionAttributeValues[':src']]).sort()).toEqual([
      ['tev-1', 'b.com'], ['tev-2', 'a.com'],
    ]);
    for (const mv of moves) expect(mv.ConditionExpression).toBe('orgId = :src AND linkGeneration = :gen');
    expect(dirtyRollupCalls().map((c) => c.orgId).sort()).toEqual(['a.com', 'b.com', 'c.com']);
  });

  // ---- contact effect (Task 7 API) -----------------------------------------------------------
  it('contact effect: customerEmail present → upsertContact at the EFFECTIVE org with generation + fence; locked is SUCCESS', async () => {
    mockOrg('a.com', { status: 'archived', mergedInto: 'b.com' });
    mockOrg('b.com', { status: 'active' });
    upsertContact.mockResolvedValueOnce({ contactId: 'ct-1', outcome: 'locked' });
    const r = await replayStructuredSideEffects({ ...base, targetOrgId: 'a.com', generation: GEN_A, customerEmail: 'kim@corp.com' });
    expect(r.ok).toBe(true);
    expect(upsertContact).toHaveBeenCalledWith(expect.objectContaining({
      email: 'kim@corp.com', orgId: 'b.com', linkGeneration: GEN_A, activeOrgFence: true,
    }));
  });
  it('contact org_inactive outcome = fence lost → re-resolve once and retry at the successor', async () => {
    mockOrg('a.com', { status: 'active' });
    upsertContact.mockResolvedValueOnce({ contactId: 'ct-1', outcome: 'org_inactive' });
    mockOrg('a.com', { status: 'archived', mergedInto: 'b.com' });
    mockOrg('b.com', { status: 'active' });
    upsertContact.mockResolvedValueOnce({ contactId: 'ct-1', outcome: 'written' });
    const r = await replayStructuredSideEffects({ ...base, targetOrgId: 'a.com', generation: GEN_A, customerEmail: 'kim@corp.com' });
    expect(r.ok).toBe(true);
    expect(upsertContact).toHaveBeenCalledTimes(2);
    expect((upsertContact.mock.calls[1][0] as Record<string, unknown>).orgId).toBe('b.com');
  });

  // ---- audit ---------------------------------------------------------------------------------
  it('audit is fenced and generational: id uses the generation; fence failure re-resolves and re-runs at the successor', async () => {
    mockOrg('a.com', { status: 'active' });
    writeLinkAuditLog.mockRejectedValueOnce(Object.assign(new Error('org a.com is not active'), { name: 'OrgInactiveError' }));
    mockOrg('a.com', { status: 'archived', mergedInto: 'b.com' });
    mockOrg('b.com', { status: 'active' });
    const r = await replayStructuredSideEffects({ ...base, targetOrgId: 'a.com', generation: GEN_A });
    expect(r.ok).toBe(true);
    expect(writeLinkAuditLog).toHaveBeenCalledTimes(2);
    const second = writeLinkAuditLog.mock.calls[1][0] as Record<string, any>;
    expect(second.newOrgId).toBe('b.com');
    expect(second.activeOrgFence).toBe(true);
    expect(second.id).toMatch(/^audit-[0-9a-f]{32}$/);                             // generational 32-hex id
    expect(second.details.generation).toBe(GEN_A);
  });

  // ---- legacy pinning (invariant #1: absent generation ⇒ byte-identical 3C behavior) ---------
  it('NO-generation call issues the IDENTICAL 3C UpdateCommand input and NEVER reads orgs', async () => {
    await replayStructuredSideEffects(base);
    expect(orgReads()).toHaveLength(0);                                            // no resolve pass on the legacy path
    const upd = send.mock.calls.find((c) => c[0] instanceof RealUpdateCommand)![0].input;
    expect(upd).toEqual({
      TableName: 'T', Key: { PK: 'RFQ#1', SK: 'META' },
      UpdateExpression: 'SET matchedOrgId = :o',
      ConditionExpression: 'attribute_not_exists(matchedOrgId) OR attribute_type(matchedOrgId, :nullType) OR matchedOrgId = :empty OR begins_with(matchedOrgId, :unres)',
      ExpressionAttributeValues: { ':o': 'acme.com', ':empty': '', ':unres': 'unresolved-', ':nullType': 'NULL' },
    });
  });
  it('NO-generation call pins the legacy deterministic audit id byte-for-byte', async () => {
    await replayStructuredSideEffects(base);
    const call = writeLinkAuditLog.mock.calls[0][0] as Record<string, unknown>;
    expect(call.id).toBe('audit-d71de22c13a86afd');                                // sha256('manual_link_unit|unresolved-rfq-1|acme.com')[:16]
    expect(call.activeOrgFence).toBeUndefined();
  });
});
