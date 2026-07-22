import { describe, it, expect, vi, beforeEach } from 'vitest';
const send = vi.fn();
vi.mock('../dynamodb', () => ({ docClient: { send: (...a: unknown[]) => send(...a) }, TABLE_NAME: () => 'T' }));
const orgExistsMock = vi.fn(); const recomputeMock = vi.fn(); const markMock = vi.fn(); const upsertContactMock = vi.fn();
vi.mock('../orgStore', () => ({ orgExists: (o: string) => orgExistsMock(o), recomputeRollupsForOrg: (o: string) => recomputeMock(o) }));
vi.mock('../timelineStore', () => ({ markRollupApplied: (id: string) => markMock(id) }));
vi.mock('../contactStore', () => ({ upsertContact: (a: unknown) => upsertContactMock(a) }));

// v2 marker fns: buildStructuredMarkerPut stays REAL (pure — its Put must ride the captured
// transaction so tx[2] is the genuine marker element); the fenced lifecycle fns are mocked.
const accumulateMarker = vi.fn(); const sealMarker = vi.fn(); const deleteRepairMarkerFenced = vi.fn();
vi.mock('../repair/repairMarker', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../repair/repairMarker')>();
  return {
    ...actual,
    accumulateMarker: (...a: unknown[]) => accumulateMarker(...a),
    sealMarker: (...a: unknown[]) => sealMarker(...a),
    deleteRepairMarkerFenced: (...a: unknown[]) => deleteRepairMarkerFenced(...a),
  };
});
const replayStructuredSideEffects = vi.fn();
vi.mock('../repair/replaySideEffects', () => ({ replayStructuredSideEffects: (...a: unknown[]) => replayStructuredSideEffects(...a) }));
const backfillTargetPkMock = vi.fn();
vi.mock('./sourceEmail', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./sourceEmail')>();
  return { ...actual, backfillTargetPk: (...a: unknown[]) => backfillTargetPkMock(...a) };
});
// manualMoveTimelineEvent stays REAL: the subsequent-move fence tests inspect ITS transactions.

import { linkStructuredUnit } from './linkStructuredUnit';
import { ULID_REGEX } from '../ulid';

// validRep = an unresolved gmail event fixture with payload.customerEmail (unit key format per
// resolveLinks: `unresolved-gmail-<normalized email>`).
const validRep = {
  id: 'tev-1', orgId: 'unresolved-gmail-a@acme.com', kind: 'email_received', source: 'gmail',
  sourceEntityType: 'gmail', sourceEntityId: 'msg-1', occurredAt: '2026-07-01T00:00:00Z',
  resolutionStatus: 'unresolved', voided: false, isInternalOnly: false, contactId: null,
  payload: { customerEmail: 'a@acme.com' },
};
const ev1 = { ...validRep };
const ev2 = { ...validRep, id: 'tev-2', occurredAt: '2026-07-01T00:00:01Z' };
const ev3 = { ...validRep, id: 'tev-3', occurredAt: '2026-07-01T00:00:02Z' };

// ---- harness (against the docClient mock) ----
let repItem: Record<string, unknown> | null = null;
let unitEvents: Record<string, unknown>[] = [];
const transactScript: Array<Error | 'ok'> = [];

function mockRepresentativeGet(item: Record<string, unknown> | null) { repItem = item; }
function arrangeUnitWithEvents(events: Record<string, unknown>[]) { repItem = events[0]; unitEvents = events; }
const transactCalls = () => send.mock.calls
  .filter((c) => (c[0] as { constructor?: { name?: string } })?.constructor?.name === 'TransactWriteCommand')
  .map((c) => c[0] as { input: { TransactItems: Array<Record<string, any>> } });
function rejectTransactWithCancellation(codes: string[]) {
  transactScript.push(Object.assign(new Error('Transaction cancelled'), {
    name: 'TransactionCanceledException', CancellationReasons: codes.map((Code) => ({ Code })),
  }));
}
function rejectTransactWithNoReasons() {
  transactScript.push(Object.assign(new Error('Transaction cancelled'), { name: 'TransactionCanceledException' }));
}
function transactSucceedsOnce() { transactScript.push('ok'); }

beforeEach(() => {
  send.mockReset(); orgExistsMock.mockReset(); recomputeMock.mockReset(); markMock.mockReset(); upsertContactMock.mockReset();
  accumulateMarker.mockReset(); sealMarker.mockReset(); deleteRepairMarkerFenced.mockReset();
  replayStructuredSideEffects.mockReset(); backfillTargetPkMock.mockReset();
  repItem = null; unitEvents = []; transactScript.length = 0;

  orgExistsMock.mockResolvedValue(true);
  upsertContactMock.mockResolvedValue({ contactId: 'ct-1', outcome: 'written' });
  accumulateMarker.mockResolvedValue({ lost: false });
  sealMarker.mockResolvedValue({ lost: false });
  deleteRepairMarkerFenced.mockResolvedValue({ lost: false });
  replayStructuredSideEffects.mockResolvedValue({ ok: true, backfillStatus: 'written' });
  backfillTargetPkMock.mockResolvedValue(null);

  send.mockImplementation(async (cmd: { constructor: { name: string }; input: Record<string, unknown> }) => {
    const kind = cmd.constructor?.name;
    if (kind === 'GetCommand') {
      const key = (cmd.input as { Key?: { PK?: string } }).Key;
      if (key?.PK?.startsWith('TLEVENT#')) return { Item: repItem ?? undefined };
      return {};
    }
    if (kind === 'QueryCommand') return { Items: unitEvents };
    if (kind === 'TransactWriteCommand') {
      const next = transactScript.shift() ?? 'ok';
      if (next !== 'ok') throw next;
      return {};
    }
    return {};
  });
});

describe('linkStructuredUnit v2', () => {
  it('rejects a non-existent / unresolved-* target before any write', async () => {
    orgExistsMock.mockResolvedValueOnce(false);
    await expect(linkStructuredUnit({ representativeEventId: 'tev-1', targetOrgId: 'nope.com', operator: 'op' })).rejects.toThrow(/target/i);
    expect(send).not.toHaveBeenCalled();
  });

  it('derives the unit from a strongly-read representative and rejects invalid ones', async () => {
    for (const bad of [
      { resolutionStatus: 'resolved' }, { voided: true }, { isInternalOnly: true },
      { orgId: 'acme.com' }, { source: 'manual' }, null,
    ]) {
      mockRepresentativeGet(bad && { ...validRep, ...bad });
      await expect(linkStructuredUnit({ representativeEventId: 'tev-1', targetOrgId: 'acme.com', operator: 'op' }))
        .rejects.toThrow(/invalid representative/i);
    }
    const getInput = send.mock.calls[0][0].input;
    expect(getInput.ConsistentRead).toBe(true);
  });

  it('empty unit read (already linked/raced) → alreadyLinked, NO transaction, NO marker', async () => {
    mockRepresentativeGet(validRep); unitEvents = [];
    const out = await linkStructuredUnit({ representativeEventId: 'tev-1', targetOrgId: 'acme.com', operator: 'op' });
    expect(out).toMatchObject({ alreadyLinked: true, affected: 0, moved: 0 });
    expect(transactCalls()).toHaveLength(0);
    expect(sealMarker).not.toHaveBeenCalled();
    expect(deleteRepairMarkerFenced).not.toHaveBeenCalled();
  });

  it('first move rides ONE TransactWriteItems: [org-active check, event move, marker] (R6 fence)', async () => {
    arrangeUnitWithEvents([ev1, ev2]);
    await linkStructuredUnit({ representativeEventId: ev1.id, targetOrgId: 'acme.com', operator: 'op' });
    const tx = transactCalls()[0].input.TransactItems;
    expect(tx).toHaveLength(3);
    expect(tx[0].ConditionCheck.ConditionExpression).toBe('#s = :active');          // position 0 = org fence, ALWAYS
    expect(tx[1].Put.ConditionExpression).toContain('resolutionStatus = :unres');
    expect(tx[1].Put.ConditionExpression).toContain('voided = :false');
    expect(tx[1].Put.ConditionExpression).toContain('#source = :src');
    expect(tx[2].Put.ConditionExpression).toBe('attribute_not_exists(PK)');
  });

  it('subsequent moves are fenced too: [org-active check, event move]; positional classification', async () => {
    arrangeUnitWithEvents([ev1, ev2, ev3]);
    await linkStructuredUnit({ representativeEventId: ev1.id, targetOrgId: 'acme.com', operator: 'op' });
    const later = transactCalls().slice(1);
    expect(later.length).toBeGreaterThan(0);
    for (const call of later) {
      expect(call.input.TransactItems).toHaveLength(2);
      expect(call.input.TransactItems[0].ConditionCheck.ConditionExpression).toBe('#s = :active');
    }
  });

  it('FOREGROUND org-fence failure (position 0) aborts with an explicit merged-org error — no silent redirect', async () => {
    arrangeUnitWithEvents([ev1]);
    rejectTransactWithCancellation(['ConditionalCheckFailed', 'None', 'None']);     // index 0 = the ORG check
    await expect(linkStructuredUnit({ representativeEventId: ev1.id, targetOrgId: 'acme.com', operator: 'op' }))
      .rejects.toThrow(/being merged|not active/i);
    expect(sealMarker).not.toHaveBeenCalled();                                       // nothing created
  });

  it('EVENT-condition failure (position 1) is the loser path, NOT the fence path', async () => {
    arrangeUnitWithEvents([ev1]);
    rejectTransactWithCancellation(['None', 'ConditionalCheckFailed', 'None']);      // index 1 = the move
    const out = await linkStructuredUnit({ representativeEventId: ev1.id, targetOrgId: 'acme.com', operator: 'op' });
    expect(out.moved).toBe(0);                                                       // alreadyLinked-style return
  });

  it('loser: transaction cancelled on the MOVE condition (index 1 — index 0 is the org fence) → alreadyLinked-style return, NO marker, no further moves', async () => {
    arrangeUnitWithEvents([ev1]);
    rejectTransactWithCancellation(['None', 'ConditionalCheckFailed', 'None']);   // [org fence, MOVE, marker]
    const out = await linkStructuredUnit({ representativeEventId: ev1.id, targetOrgId: 'acme.com', operator: 'op' });
    expect(out.moved).toBe(0);
    expect(sealMarker).not.toHaveBeenCalled();
  });

  it('missing/malformed CancellationReasons → classified other → error propagates (never guessed into loser/fence)', async () => {
    arrangeUnitWithEvents([ev1]);
    rejectTransactWithNoReasons();                                                // TransactionCanceledException without the array
    await expect(linkStructuredUnit({ representativeEventId: ev1.id, targetOrgId: 'acme.com', operator: 'op' })).rejects.toThrow();
  });

  it('ineligible siblings are skipped, never moved (per-event eligibility)', async () => {
    arrangeUnitWithEvents([ev1, { ...ev2, voided: true }, { ...ev3, source: 'manual' }]);
    const out = await linkStructuredUnit({ representativeEventId: ev1.id, targetOrgId: 'acme.com', operator: 'op' });
    expect(out.moved).toBe(1);
    expect(out.skipped).toBeGreaterThanOrEqual(2);
    expect(transactCalls()).toHaveLength(1);           // only the first-move transaction — no write for ineligibles
  });

  it('replay ok → fenced delete; replay not-ok → seal building→pending (exactly one of the two)', async () => {
    arrangeUnitWithEvents([ev1]);
    replayStructuredSideEffects.mockResolvedValueOnce({ ok: false, errorType: 'transient' });
    const out = await linkStructuredUnit({ representativeEventId: ev1.id, targetOrgId: 'acme.com', operator: 'op' });
    expect(sealMarker).toHaveBeenCalled();
    expect(deleteRepairMarkerFenced).not.toHaveBeenCalled();
    expect(out.postCommitStatus).toBe('post_commit_failed');
  });

  it('replay ok → fenced delete only, postCommitStatus ok', async () => {
    arrangeUnitWithEvents([ev1]);
    const out = await linkStructuredUnit({ representativeEventId: ev1.id, targetOrgId: 'acme.com', operator: 'op' });
    expect(deleteRepairMarkerFenced).toHaveBeenCalled();
    expect(sealMarker).not.toHaveBeenCalled();
    expect(out.postCommitStatus).toBe('ok');
  });

  it('fenced delete lost → success + post_commit_failed (another actor owns the marker now)', async () => {
    arrangeUnitWithEvents([ev1]);
    deleteRepairMarkerFenced.mockResolvedValueOnce({ lost: true });
    const out = await linkStructuredUnit({ representativeEventId: ev1.id, targetOrgId: 'acme.com', operator: 'op' });
    expect(out.postCommitStatus).toBe('post_commit_failed');
    expect(sealMarker).not.toHaveBeenCalled();
  });

  it('accumulate version-fence lost → ABORT immediately: no further moves, no replay, post_commit_failed', async () => {
    arrangeUnitWithEvents([ev1, ev2, ev3]);
    accumulateMarker.mockResolvedValueOnce({ lost: true });      // after ev2's move
    const out = await linkStructuredUnit({ representativeEventId: ev1.id, targetOrgId: 'acme.com', operator: 'op' });
    expect(out.postCommitStatus).toBe('post_commit_failed');
    expect(transactCalls()).toHaveLength(2);                     // ev3 never attempted
    expect(replayStructuredSideEffects).not.toHaveBeenCalled();
    expect(sealMarker).not.toHaveBeenCalled();
  });

  it('audit + contact + backfill all receive THIS generation', async () => {
    arrangeUnitWithEvents([ev1]);
    await linkStructuredUnit({ representativeEventId: ev1.id, targetOrgId: 'acme.com', operator: 'op' });
    expect(replayStructuredSideEffects).toHaveBeenCalledWith(expect.objectContaining({ generation: expect.stringMatching(/^[0-9A-HJKMNP-TV-Z]{26}$/) }));
  });

  it('stamps linkGeneration on every moved item (transact first move AND subsequent moves) matching the action generation', async () => {
    arrangeUnitWithEvents([ev1, ev2]);
    transactSucceedsOnce(); transactSucceedsOnce();
    await linkStructuredUnit({ representativeEventId: ev1.id, targetOrgId: 'acme.com', operator: 'op' });
    const calls = transactCalls();
    const firstItem = calls[0].input.TransactItems[1].Put.Item;
    const secondItem = calls[1].input.TransactItems[1].Put.Item;
    expect(firstItem.linkGeneration).toMatch(ULID_REGEX);
    expect(secondItem.linkGeneration).toBe(firstItem.linkGeneration);
    const markerItem = calls[0].input.TransactItems[2].Put.Item;
    expect(markerItem.generation).toBe(firstItem.linkGeneration);
    expect(replayStructuredSideEffects).toHaveBeenCalledWith(expect.objectContaining({ generation: firstItem.linkGeneration }));
  });

  it('marker rides the transaction built by buildStructuredMarkerPut with the unit metadata + customerEmail', async () => {
    arrangeUnitWithEvents([ev1]);
    await linkStructuredUnit({ representativeEventId: ev1.id, targetOrgId: 'acme.com', operator: 'op@x.com' });
    const markerItem = transactCalls()[0].input.TransactItems[2].Put.Item;
    expect(markerItem).toMatchObject({
      unitType: 'structured', unitKey: 'unresolved-gmail-a@acme.com', targetOrgId: 'acme.com', operator: 'op@x.com',
      sourceType: 'gmail', sourceEntityId: 'msg-1', status: 'building', version: 1,
      customerEmail: 'a@acme.com', movedCount: 1, affectedEventIdsSample: ['tev-1'],
    });
    expect(replayStructuredSideEffects).toHaveBeenCalledWith(expect.objectContaining({
      sourceType: 'gmail', sourceEntityId: 'msg-1', targetOrgId: 'acme.com', unitKey: 'unresolved-gmail-a@acme.com',
      customerEmail: 'a@acme.com', movedCount: 1,
    }));
  });

  it('backfillTargetPk throw is isolated — marker still built with backfillPk null (drainer re-resolves)', async () => {
    arrangeUnitWithEvents([ev1]);
    backfillTargetPkMock.mockRejectedValueOnce(new Error('logistics get boom'));
    const out = await linkStructuredUnit({ representativeEventId: ev1.id, targetOrgId: 'acme.com', operator: 'op' });
    const markerItem = transactCalls()[0].input.TransactItems[2].Put.Item;
    expect(markerItem.backfillPk).toBeNull();
    expect(out.moved).toBe(1);
  });

  it('per-event isolation: a subsequent move throwing (transient, non-transact) → errors+1, loop continues', async () => {
    arrangeUnitWithEvents([ev1, ev2, ev3]);
    transactSucceedsOnce();                                       // first move ok
    transactScript.push(Object.assign(new Error('network boom'), { name: 'ServiceUnavailable' }));  // ev2 throws
    transactSucceedsOnce();                                       // ev3 ok
    const out = await linkStructuredUnit({ representativeEventId: ev1.id, targetOrgId: 'acme.com', operator: 'op' });
    expect(out).toMatchObject({ affected: 3, moved: 2, errors: 1 });
    expect(replayStructuredSideEffects).toHaveBeenCalled();
  });
});
