/* ------------------------------------------------------------------------------------------------
 * Task 14: adversarial suite — concurrency / crash / cross-writer, executed STATEFULLY.
 *
 * Every scenario calls the REAL production functions — linkStructuredUnit,
 * replayStructuredSideEffects, upsertContact, reconcileRepair, promoteAbandonedBuilding,
 * organization-api's mergeOrganization, and the Task-8b guarded delayed writer — with ONLY
 * `docClient.send` rerouted into the in-memory harness (vi.mock of '@aws-sdk/lib-dynamodb'
 * covers BOTH the crm-api and organization-api client instances), plus the plan-sanctioned
 * rollup pass-through (orgStore.recomputeRollupsForOrg records into store.dirtyRollups()).
 * orgExists and every other org read resolve from the harness's seeded org items.
 *
 * Documented adaptations from the plan's scenario sketches (fixture/mock plumbing only, except
 * where flagged as a REAL divergence):
 *  - Scenarios that link into an org seed that org's META row (the landed link path fences every
 *    transaction on ORG#<target> status='active', so the org must exist in the store).
 *  - S2/S5 read the committed marker from markersHistoryFor: the landed happy path deletes the
 *    marker after its in-process replay succeeds, and the harness records deletion snapshots.
 *  - S4 seeds a source-conflict (RFQ#r1 pre-matched to another org, unstamped) so the foreground
 *    replay fails and the seal transition — the operation under test — actually occurs.
 *  - S10 follows the corrected plan/spec contract (spec clarification ratified during execution):
 *    the stamp is a replay-ordering token, not org-provenance; linkLocked is the admin pin — an
 *    unlocked contact's org follows latest activity.
 *  - S14b crashes the foreground replay's backfill transact: the landed foreground replay already
 *    follows the merge successor (stronger than the plan assumed), so exercising the plan's
 *    marker-driven drainer convergence requires simulating a crash after the seal-relevant failure.
 *  - reconcileRepair is called as reconcileRepair({}) — the landed signature takes an args object.
 * ---------------------------------------------------------------------------------------------- */
import { describe, it, expect, vi, afterEach } from 'vitest';

const routed = vi.hoisted(() => ({ send: null as null | ((cmd: unknown) => Promise<unknown>) }));

vi.mock('@aws-sdk/client-dynamodb', () => ({ DynamoDBClient: class DynamoDBClient {} }));
vi.mock('@aws-sdk/lib-dynamodb', () => {
  class BaseCommand { input: unknown; constructor(input: unknown) { this.input = input; } }
  class GetCommand extends BaseCommand {}
  class PutCommand extends BaseCommand {}
  class UpdateCommand extends BaseCommand {}
  class DeleteCommand extends BaseCommand {}
  class QueryCommand extends BaseCommand {}
  class ScanCommand extends BaseCommand {}
  class BatchGetCommand extends BaseCommand {}
  class BatchWriteCommand extends BaseCommand {}
  class TransactWriteCommand extends BaseCommand {}
  class TransactGetCommand extends BaseCommand {}
  return {
    DynamoDBDocumentClient: { from: () => ({ send: (cmd: unknown) => routed.send!(cmd) }) },
    GetCommand, PutCommand, UpdateCommand, DeleteCommand, QueryCommand, ScanCommand,
    BatchGetCommand, BatchWriteCommand, TransactWriteCommand, TransactGetCommand,
  };
});
// organization-api handler module-init constructs these clients — inert stubs, never invoked here.
vi.mock('@aws-sdk/client-lambda', () => ({
  LambdaClient: class LambdaClient {},
  InvokeCommand: class InvokeCommand { input: unknown; constructor(input: unknown) { this.input = input; } },
}));
vi.mock('@aws-sdk/client-bedrock-runtime', () => ({
  BedrockRuntimeClient: class BedrockRuntimeClient {},
  InvokeModelCommand: class InvokeModelCommand { input: unknown; constructor(input: unknown) { this.input = input; } },
}));
vi.mock('@anthropic-ai/sdk', () => ({
  default: class Anthropic { messages = { create: () => Promise.reject(new Error('no AI in tests')) }; },
}));

// Rollup pass-through (the ONLY non-docClient mock, as the plan allows): recompute is recorded on
// the active harness store (dirtyRollups()); orgExists and the rest of orgStore stay REAL and
// resolve from harness state.
vi.mock('../orgStore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../orgStore')>();
  const { recordDirtyRollup } = await import('./linkTestHarness');
  return { ...actual, recomputeRollupsForOrg: async (orgId: string) => { recordDirtyRollup(orgId); } };
});

vi.stubEnv('INTELLIGENCE_TABLE', 'T');

import {
  seedStore, activeHarness, harnessSend, runDelayedWriterUpdate,
  unresolvedEvent, movedEvent, rfqRecord, orgItem, orgKeyOf, reconKeyOf,
  archiveOrgInStore, putPendingMarker, putStuckMarker,
  GEN_1, GEN_2, T0, T1, T2, T3, NOW_ISO, PAST_CUTOFF,
} from './linkTestHarness';
import { linkStructuredUnit } from './linkStructuredUnit';
import { replayStructuredSideEffects } from '../repair/replaySideEffects';
import { upsertContact } from '../contactStore';
import { reconcileRepair } from '../repair/reconcileRepair';
import { promoteAbandonedBuilding, type StructuredMarkerV2 } from '../repair/repairMarker';
import { mergeOrganization as mergeOrganizationRaw } from '../../../organization-api/handler';

routed.send = harnessSend;

const mergeOrganization = (sourceOrgId: string, targetOrgId: string) =>
  mergeOrganizationRaw({ sourceOrgId, targetOrgId }, 'op-test');

// The replay fixture base (plan Task 14): scenarios spread and override target/generation/pk.
const rfqBase = {
  sourceType: 'rfq', sourceEntityId: 'r1', backfillPk: null as string | null,
  targetOrgId: '', unitKey: 'unresolved-rfq-r1', operator: 'op', createdAt: T0,
  affectedEventIds: ['tev-1'], movedCount: 1, contactStatus: 'missing_email',
};

type TxInput = { TransactItems?: Array<{ Update?: { Key?: { PK?: string } }; Put?: { Item?: { PK?: string } }; ConditionCheck?: { Key?: any } }> };

afterEach(() => { activeHarness()?.clearGates(); });

describe('linkStructuredUnit adversarial suite (stateful harness, real functions)', () => {

  // Scenario 1 — stateful transaction atomicity: after a cancelled transaction the STORE holds
  // neither the moved event nor the marker.
  it('cancelled transaction leaves the store untouched', async () => {
    const store = seedStore([unresolvedEvent('tev-1'), orgItem('acme.com')]);
    store.put('TLEVENT#tev-1', { ...store.get('TLEVENT#tev-1'), resolutionStatus: 'resolved', orgId: 'other.com' }); // pre-occupied → move condition fails
    await linkStructuredUnit({ representativeEventId: 'tev-1', targetOrgId: 'acme.com', operator: 'op' })
      .catch((e) => e);                                    // representative validation may reject — either path must leave the store clean
    expect(store.keys().filter((k) => k.startsWith('CRM_REPAIR#'))).toHaveLength(0);
    expect(store.get('TLEVENT#tev-1').orgId).toBe('other.com');
  });

  // Scenario 2 — marker self-sufficiency: from the instant the transaction commits, the marker
  // carries every replay input (crash-at-any-later-point recoverable). The landed happy path
  // deletes the marker after its in-process replay succeeds, so the committed snapshot is read
  // from the harness's deletion history.
  it('the committed marker is self-sufficient for replay', async () => {
    const store = seedStore([unresolvedEvent('tev-1'), orgItem('acme.com')]);
    await linkStructuredUnit({ representativeEventId: 'tev-1', targetOrgId: 'acme.com', operator: 'op' });
    const marker = store.markersHistoryFor('unresolved-rfq-r1')[0];
    expect(marker).toBeDefined();
    for (const f of ['targetOrgId', 'unitKey', 'generation', 'sourceType', 'sourceEntityId', 'customerEmail', 'backfillPk']) {
      expect(marker).toHaveProperty(f);
    }
  });

  // Scenario 3 — TRUE overlapping same-unit links via a deterministic gate: A parks at its
  // TransactWrite, B runs to completion, A resumes and loses on the move condition.
  it('overlapped links: the parked writer loses against the committed store, mints no marker', async () => {
    const store = seedStore([unresolvedEvent('tev-1'), orgItem('a.com'), orgItem('b.com')]);
    const gate = store.gateOn((cmd) => cmd.constructor.name === 'TransactWriteCommand');   // catches A's transact only (first match)
    const pA = linkStructuredUnit({ representativeEventId: 'tev-1', targetOrgId: 'a.com', operator: 'opA' });
    await store.idle();                                     // A is now parked at the gate
    const b = await linkStructuredUnit({ representativeEventId: 'tev-1', targetOrgId: 'b.com', operator: 'opB' });  // B runs through the REAL store
    gate.release();
    const a = await pA;
    expect(b.moved).toBe(1);
    expect(a.moved).toBe(0);                                // A's conditions evaluated against B's committed state
    expect(store.get('TLEVENT#tev-1').orgId).toBe('b.com');
    expect(store.markersFor('unresolved-rfq-r1').filter((m) => m.operator === 'opA')).toHaveLength(0);  // loser minted nothing
  });

  // Scenario 4 — overlapping link + drainer promotion: linker parks before SEAL; drainer promotes
  // the aged building marker; released seal loses the version fence; exactly one pending marker.
  // (The seal transition only occurs when the foreground replay fails — a seeded source-conflict
  // forces that deterministically.)
  it('seal vs promoteAbandonedBuilding: one version-fenced winner, no duplicate pending markers', async () => {
    const store = seedStore([unresolvedEvent('tev-1'), orgItem('acme.com'), rfqRecord('RFQ#r1', { matchedOrgId: 'other.com' })]);
    const gate = store.gateOn((cmd, input) => String(input.UpdateExpression ?? '').includes(':st'));   // parks the seal transition
    const pLink = linkStructuredUnit({ representativeEventId: 'tev-1', targetOrgId: 'acme.com', operator: 'op' });
    await store.idle();
    const marker = store.markersFor('unresolved-rfq-r1')[0] as unknown as StructuredMarkerV2;
    await promoteAbandonedBuilding(marker, PAST_CUTOFF, NOW_ISO);   // drainer claims it: version+1, building→pending
    gate.release();
    const out = await pLink;
    expect(store.markersFor('unresolved-rfq-r1').filter((m) => m.status === 'pending')).toHaveLength(1);
    expect(out.postCommitStatus).toBe('post_commit_failed');        // seal lost ⇒ surfaced, not silent
  });

  // Scenario 5 — >100-event unit: movedCount exact, sample capped, replay completes from the marker.
  it('130-event unit: full move, bounded sample, marker-driven replay converges', async () => {
    const events = Array.from({ length: 130 }, (_, i) => unresolvedEvent(`tev-${i}`));
    const store = seedStore([...events, orgItem('acme.com')]);
    const out = await linkStructuredUnit({ representativeEventId: 'tev-0', targetOrgId: 'acme.com', operator: 'op' });
    expect(out.moved).toBe(130);
    const m = store.markersHistoryFor('unresolved-rfq-r1')[0];      // harness records deleted markers too
    expect(m.movedCount).toBe(130);
    // Finding-3 regression: the sample is EXACTLY the first 100 moved event ids in move order —
    // a stale accumulate handle collapses it to ~[first, latest] instead of growing to the cap.
    expect(m.affectedEventIdsSample).toEqual(Array.from({ length: 100 }, (_, i) => `tev-${i}`));
    expect(store.get('RFQ#r1').matchedOrgId).toBe('acme.com');      // the replay completed off the marker inputs
  });

  // Scenario 6 — MERGE-BEFORE-REPLAY with successor: the unapplied action's target was merged away;
  // the replay follows mergedInto and completes Contact + source AT THE SUCCESSOR.
  it('replay after merge applies to the canonical successor; events + rollups converge too', async () => {
    const store = seedStore([rfqRecord('RFQ#1', { matchedOrgId: '' }),
      orgItem('a.com', { status: 'archived', mergedInto: 'b.com' }), orgItem('b.com', { status: 'active' }),
      movedEvent('tev-1', { orgId: 'a.com', linkGeneration: GEN_1 }),   // the foreground link had moved these to (now-archived) A
      movedEvent('tev-2', { orgId: 'a.com', linkGeneration: GEN_1 }),
      movedEvent('tev-3', { orgId: 'a.com', linkGeneration: GEN_2 })]); // ANOTHER unit's generation — must NOT move
    const r = await replayStructuredSideEffects({ ...rfqBase, targetOrgId: 'a.com', generation: GEN_1, customerEmail: 'b@x.com', backfillPk: 'RFQ#1' });
    expect(r.ok).toBe(true);
    expect(store.get('RFQ#1').matchedOrgId).toBe('b.com');           // source completed at the successor
    expect(store.contactByEmail('b@x.com').orgId).toBe('b.com');     // Contact completed at the successor
    expect(store.get('TLEVENT#tev-1').orgId).toBe('b.com');          // R5: the unit's EVENTS follow the redirect
    expect(store.get('TLEVENT#tev-2').orgId).toBe('b.com');
    expect(store.get('TLEVENT#tev-3').orgId).toBe('a.com');          // foreign-generation event untouched
    expect(store.dirtyRollups()).toEqual(expect.arrayContaining(['a.com', 'b.com']));
    expect(store.auditFor(GEN_1).details).toMatchObject({ requestedTargetOrgId: 'a.com', effectiveTargetOrgId: 'b.com' });
  });

  // Scenario 7 — MULTI-HOP chain a→b→c resolves to the final active org.
  it('multi-hop merge chain resolves through archived intermediates', async () => {
    const store = seedStore([rfqRecord('RFQ#1', { matchedOrgId: '' }),
      orgItem('a.com', { status: 'archived', mergedInto: 'b.com' }),
      orgItem('b.com', { status: 'archived', mergedInto: 'c.com' }), orgItem('c.com', { status: 'active' })]);
    const r = await replayStructuredSideEffects({ ...rfqBase, targetOrgId: 'a.com', generation: GEN_1, backfillPk: 'RFQ#1' });
    expect(r.ok).toBe(true);
    expect(store.get('RFQ#1').matchedOrgId).toBe('c.com');
  });

  // Scenario 8 — MISSING SUCCESSOR: archived, no mergedInto → blocked, marker retained, no writes.
  it('archived target without successor blocks the repair instead of faking success', async () => {
    const store = seedStore([rfqRecord('RFQ#1', { matchedOrgId: '' }), orgItem('a.com', { status: 'archived' })]);
    const marker = putPendingMarker(store, { unitKey: 'unresolved-rfq-r1', generation: GEN_1, targetOrgId: 'a.com' });
    await reconcileRepair({});                                        // REAL drainer over the store
    expect(store.get(marker.PK as string).status).toBe('stuck');      // blocked/actionable, NOT deleted
    expect(store.get(marker.PK as string).stuckReason).toMatch(/without successor/);
    expect(store.get('RFQ#1').matchedOrgId).toBe('');                 // no half-applied writes
  });

  // Scenario 9 — RFQ/order legacy regression: NO-generation replay writes the EXACT pre-plan shape.
  it('legacy (no-generation) replay is byte-identical to 3C and converges', async () => {
    const store = seedStore([rfqRecord('RFQ#1', { matchedOrgId: '' })]);
    const r = await replayStructuredSideEffects({ ...rfqBase, targetOrgId: 'acme.com', backfillPk: 'RFQ#1' });  // no generation ⇒ legacy path
    expect(r.ok).toBe(true);
    const written = store.lastCommandFor('RFQ#1');
    expect(written?.input.UpdateExpression).toBe('SET matchedOrgId = :o');           // NO stamp field — the verbatim 3C write
    expect(written?.input.ExpressionAttributeValues).not.toHaveProperty(':gen');
    expect(store.get('RFQ#1').matchedOrgId).toBe('acme.com');
    expect(store.get('RFQ#1')).not.toHaveProperty('matchedOrgLinkGeneration');
  });

  // Scenario 10 — cross-writer interleaving: non-generational upsertContact lands BETWEEN two
  // generational writes. CONTRACT (spec clarification, ratified during execution): the cross-writer
  // policy protects the STAMP (carried forward, never dropped/mixed) and linkLocked; the ORG of an
  // UNLOCKED contact follows latest activity (P1 semantics — linkLocked is the admin pin). The
  // stamp is a replay-ordering token, NOT an org-provenance pair.
  it('interleaved non-generational contact write preserves the newest STAMP; unlocked org follows activity', async () => {
    const store = seedStore([]);
    await upsertContact({ email: 'b@x.com', orgId: 'a.com', source: 'rfq', occurredAt: T1, linkGeneration: GEN_1 });
    const gate = store.gateOn((cmd) => cmd.constructor.name === 'PutCommand');      // parks the non-generational Put
    const pNonGen = upsertContact({ email: 'b@x.com', orgId: 'late.com', source: 'order', occurredAt: T2 });  // reads GEN_1, parks
    await store.idle();
    await upsertContact({ email: 'b@x.com', orgId: 'b.com', source: 'rfq', occurredAt: T3, linkGeneration: GEN_2 }); // newer generational write lands
    gate.release();
    await pNonGen;                                                                   // CASes on stale GEN_1 → CCFE → re-read → retry on fresh state
    const c = store.contactByEmail('b@x.com');
    expect(c.lastLinkGeneration).toBe(GEN_2);                                        // newest stamp survives (the cross-writer guarantee)
    expect(c.orgId).toBe('late.com');                                                // unlocked contact follows the latest activity's org
  });

  it('a linkLocked contact is NEVER re-orged by the interleaved non-generational writer', async () => {
    const store = seedStore([]);
    await upsertContact({ email: 'c@x.com', orgId: 'b.com', source: 'rfq', occurredAt: T1, linkGeneration: GEN_2 });
    store.put(store.contactPkOf('c@x.com'), { ...store.contactByEmail('c@x.com'), linkLocked: true });
    await upsertContact({ email: 'c@x.com', orgId: 'late.com', source: 'order', occurredAt: T2 });
    const c = store.contactByEmail('c@x.com');
    expect(c.orgId).toBe('b.com');                                                   // the admin pin holds
    expect(c.lastLinkGeneration).toBe(GEN_2);
  });

  // Scenario 11 — DELAYED SOURCE WRITER (Task 8b, store-level): a late creation-path matchedOrgId
  // write cannot overwrite a stamped admin decision.
  it('delayed writer update against a stamped record is a guarded no-op', async () => {
    const store = seedStore([rfqRecord('RFQ#1', { matchedOrgId: 'a.com', matchedOrgLinkGeneration: GEN_1 })]);
    await runDelayedWriterUpdate(store, { pk: 'RFQ#1', resolvedOrgId: 'late.com' });   // the REAL guarded writer from Task 8b
    expect(store.get('RFQ#1').matchedOrgId).toBe('a.com');           // admin decision stands
    expect(store.get('RFQ#1').matchedOrgLinkGeneration).toBe(GEN_1);
  });

  // Scenario 11 (NULL-typed org case): an UNstamped record whose matchedOrgId is a typed NULL is
  // still legitimately writable — attribute_type(matchedOrgId,'NULL') on a present JS null.
  it('delayed writer fills an unstamped NULL-typed matchedOrgId (typed NULL ≠ blocked)', async () => {
    const store = seedStore([rfqRecord('RFQ#1', { matchedOrgId: null })]);
    await runDelayedWriterUpdate(store, { pk: 'RFQ#1', resolvedOrgId: 'late.com' });
    expect(store.get('RFQ#1').matchedOrgId).toBe('late.com');
  });

  // Scenario 12 — RESOLVE-vs-ARCHIVE interleaving (R5 blocker 1): replay resolves A as active,
  // parks before its transact; merge archives A and re-points; released replay's fence cancels,
  // re-resolve applies everything to B.
  it('org archived between resolve and write: the fence cancels and the retry lands on the successor', async () => {
    const store = seedStore([rfqRecord('RFQ#1', { matchedOrgId: '' }), orgItem('a.com', { status: 'active' }), orgItem('b.com', { status: 'active' })]);
    const gate = store.gateOn((cmd) => cmd.constructor.name === 'TransactWriteCommand');
    const pReplay = replayStructuredSideEffects({ ...rfqBase, targetOrgId: 'a.com', generation: GEN_1, backfillPk: 'RFQ#1' });
    await store.idle();                                               // replay parked at its fenced write; resolve already saw A active
    archiveOrgInStore(store, 'a.com', { mergedInto: 'b.com' });       // merge archives A first (its half of the fence)
    gate.release();
    const r = await pReplay;
    expect(r.ok).toBe(true);
    expect(store.get('RFQ#1').matchedOrgId).toBe('b.com');            // fence cancelled → re-resolved → successor
  });

  // Scenario 12b (Finding-2 regression) — REDIRECT RETRY vs MID-REDIRECT MERGE: the drainer's
  // replay redirects requested A → effective B, moves one event A→B, then a REAL merge archives
  // B→C mid-redirect (the parked move's fence cancels). The single re-resolve retry must page
  // EVERY org the replay has targeted so far (A AND B) so the event already moved to B is not
  // stranded under the archived intermediate while the marker completes.
  it('mid-redirect merge: the retry drains BOTH the requested org and the abandoned intermediate; full convergence at C', async () => {
    const store = seedStore([rfqRecord('RFQ#1', { matchedOrgId: '' }),
      orgItem('a.com', { status: 'archived', mergedInto: 'b.com' }), orgItem('b.com'), orgItem('c.com'),
      movedEvent('tev-1', { orgId: 'a.com', linkGeneration: GEN_1 }),
      movedEvent('tev-2', { orgId: 'a.com', linkGeneration: GEN_1 })]);
    putPendingMarker(store, { unitKey: 'unresolved-rfq-r1', generation: GEN_1, targetOrgId: 'a.com', customerEmail: 'b@x.com' });
    const gate = store.gateOn((cmd, input) => cmd.constructor.name === 'TransactWriteCommand'
      && Boolean((input as TxInput).TransactItems?.some((t) => t.Put?.Item?.PK === 'TLEVENT#tev-2')));  // parks the SECOND redirect move
    const pDrain = reconcileRepair({});
    await store.idle();                                               // parked mid-redirect
    expect(store.get('TLEVENT#tev-1').orgId).toBe('b.com');           // first move already committed at B
    expect(store.markersFor('unresolved-rfq-r1')).toHaveLength(1);    // marker NOT deleted before convergence
    await mergeOrganization('b.com', 'c.com');                        // the REAL merge archives B mid-redirect
    gate.release();
    const s = await pDrain;
    expect(s.repaired).toBe(1);
    expect(store.get('TLEVENT#tev-1').orgId).toBe('c.com');           // the B-stranded event converged
    expect(store.get('TLEVENT#tev-2').orgId).toBe('c.com');           // and the A-remainder followed too
    expect(store.markersFor('unresolved-rfq-r1')).toHaveLength(0);    // deleted only after full convergence
    // Round 3: EVERY org-bearing effect converges at C — backfill and contact were committed at B
    // with THIS generation before the fence loss; the retry must MIGRATE them, not no-op them.
    expect(store.get('RFQ#1').matchedOrgId).toBe('c.com');
    const contact = store.contactByEmail('b@x.com');
    expect(contact.orgId).toBe('c.com');
    expect(contact.lastLinkGeneration).toBe(GEN_1);                   // stamp unchanged — same-generation migration
    // ISSUE-2: the audit is written AFTER redirect convergence — the final row names the org the
    // unit actually CONVERGED on (C), never only the abandoned intermediate (B).
    const audits = store.auditsFor(GEN_1);
    expect(audits.map((a) => a.newOrgId)).toContain('c.com');
    const finalAudit = audits.find((a) => a.newOrgId === 'c.com') as Record<string, any>;
    expect(finalAudit.details).toMatchObject({ requestedTargetOrgId: 'a.com', effectiveTargetOrgId: 'c.com' });
  });

  // Scenario 12e (round-3 regression — fence loss AT THE AUDIT step): backfill, contact and the
  // full redirect all committed at B; B merges into C while the audit transact is parked. The
  // retry must restart from effect 0 with same-generation migration semantics so backfill+contact
  // CONVERGE at C (instead of no-oping as 'superseded' at archived B) before the audit lands and
  // the marker deletes.
  it('fence loss at the audit: backfill+contact MIGRATE to the successor before the audit/marker-delete', async () => {
    const store = seedStore([rfqRecord('RFQ#1', { matchedOrgId: '' }),
      orgItem('a.com', { status: 'archived', mergedInto: 'b.com' }), orgItem('b.com'), orgItem('c.com'),
      movedEvent('tev-1', { orgId: 'a.com', linkGeneration: GEN_1 })]);
    putPendingMarker(store, { unitKey: 'unresolved-rfq-r1', generation: GEN_1, targetOrgId: 'a.com', customerEmail: 'b@x.com' });
    const gate = store.gateOn((cmd, input) => cmd.constructor.name === 'TransactWriteCommand'
      && Boolean((input as TxInput).TransactItems?.some((t) => String(t.Put?.Item?.PK ?? '').startsWith('AUDIT#'))));
    const pDrain = reconcileRepair({});
    await store.idle();                                               // parked at the audit; every other effect committed at B
    expect(store.get('RFQ#1').matchedOrgId).toBe('b.com');
    expect(store.contactByEmail('b@x.com').orgId).toBe('b.com');
    expect(store.get('TLEVENT#tev-1').orgId).toBe('b.com');
    await mergeOrganization('b.com', 'c.com');                        // B merges away under the parked audit
    gate.release();
    const s = await pDrain;
    expect(s.repaired).toBe(1);
    expect(store.get('RFQ#1').matchedOrgId).toBe('c.com');            // MIGRATED, not stranded at archived B
    const contact = store.contactByEmail('b@x.com');
    expect(contact.orgId).toBe('c.com');
    expect(contact.lastLinkGeneration).toBe(GEN_1);                   // stamp unchanged — same-generation migration
    expect(store.get('TLEVENT#tev-1').orgId).toBe('c.com');
    expect(store.auditsFor(GEN_1).map((a) => a.newOrgId)).toEqual(['c.com']);   // the parked B-audit never committed; final audit names C
    expect(store.markersFor('unresolved-rfq-r1')).toHaveLength(0);    // deleted only after FULL convergence
  });

  // Scenario 12c (ISSUE-1 regression — cross-INVOCATION durability): invocation 1's redirect moves
  // the unit A→B and then crashes on a late rollup write — the marker survives, but the list of
  // orgs that invocation had targeted lived only in its memory. B merges into C BEFORE the drainer
  // retries. Invocation 2 must re-derive its redirect sources from the PERSISTENT merge chain
  // (mergedInto is forever), find the B-stranded events, and converge them at C.
  it('cross-invocation stranding: a fresh drain derives redirect sources from the merge chain and drains the archived intermediate', async () => {
    const store = seedStore([rfqRecord('RFQ#1', { matchedOrgId: '' }),
      orgItem('a.com', { status: 'archived', mergedInto: 'b.com' }), orgItem('b.com'), orgItem('c.com'),
      movedEvent('tev-1', { orgId: 'a.com', linkGeneration: GEN_1 }),
      movedEvent('tev-2', { orgId: 'a.com', linkGeneration: GEN_1 })]);
    putPendingMarker(store, { unitKey: 'unresolved-rfq-r1', generation: GEN_1, targetOrgId: 'a.com' });
    // invocation 1: both redirect moves COMMIT at B, then the first markRollupApplied write crashes
    const crash = store.gateOn((cmd, input) => cmd.constructor.name === 'UpdateCommand'
      && String((input as { Key?: { PK?: string } }).Key?.PK ?? '').startsWith('TLEVENT#'));
    const p1 = reconcileRepair({});
    await store.idle();
    crash.releaseWithCrash();
    const s1 = await p1;
    expect(s1.retrying).toBe(1);                                      // transient → marker retained
    expect(store.get('TLEVENT#tev-1').orgId).toBe('b.com');           // the moves committed at B
    expect(store.get('TLEVENT#tev-2').orgId).toBe('b.com');
    await mergeOrganization('b.com', 'c.com');                        // B merges away BETWEEN invocations
    const s2 = await reconcileRepair({});                             // invocation 2: fresh call, no shared memory
    expect(s2.repaired).toBe(1);
    expect(store.get('TLEVENT#tev-1').orgId).toBe('c.com');           // recovered via the chain walk
    expect(store.get('TLEVENT#tev-2').orgId).toBe('c.com');
    expect(store.get('RFQ#1').matchedOrgId).toBe('c.com');            // round 3: backfill migrated off archived B too
    expect(store.markersFor('unresolved-rfq-r1')).toHaveLength(0);    // deleted only after full convergence
  });

  // Scenario 12d (ISSUE-2 regression — audit trail across invocations): invocation 1 converges the
  // unit at B and writes its audit, but crashes DELETING the marker. B merges into C; invocation 2
  // re-drains and converges at C. Each invocation's audit is a distinct deterministic row (the id
  // includes the effective target + generation): the B-row remains honest history, the C-row
  // records the final convergence.
  it('two invocations with a merge between: audit rows exist for BOTH effective targets (B then C); events converge at C', async () => {
    const store = seedStore([rfqRecord('RFQ#1', { matchedOrgId: '' }),
      orgItem('a.com', { status: 'archived', mergedInto: 'b.com' }), orgItem('b.com'), orgItem('c.com'),
      movedEvent('tev-1', { orgId: 'a.com', linkGeneration: GEN_1 })]);
    putPendingMarker(store, { unitKey: 'unresolved-rfq-r1', generation: GEN_1, targetOrgId: 'a.com' });
    const crash = store.gateOn((cmd, input) => cmd.constructor.name === 'DeleteCommand'
      && String((input as { Key?: { PK?: string } }).Key?.PK ?? '').startsWith('CRM_REPAIR#'));
    const p1 = reconcileRepair({});
    await store.idle();
    crash.releaseWithCrash();
    const s1 = await p1;
    expect(s1.errors).toBe(1);                                        // marker-delete bookkeeping failed → retained
    expect(store.get('TLEVENT#tev-1').orgId).toBe('b.com');
    expect(store.auditsFor(GEN_1).map((a) => a.newOrgId)).toEqual(['b.com']);   // invocation 1's audit at ITS effective target
    await mergeOrganization('b.com', 'c.com');
    const s2 = await reconcileRepair({});
    expect(s2.repaired).toBe(1);
    expect(store.get('TLEVENT#tev-1').orgId).toBe('c.com');
    const audits = store.auditsFor(GEN_1);
    expect(audits.map((a) => a.newOrgId).sort()).toEqual(['b.com', 'c.com']);   // both rows kept
    expect(new Set(audits.map((a) => a.id)).size).toBe(2);                      // distinct deterministic ids
    const cRow = audits.find((a) => a.newOrgId === 'c.com') as Record<string, any>;
    expect(cRow.details).toMatchObject({ requestedTargetOrgId: 'a.com', effectiveTargetOrgId: 'c.com' });
    expect(store.get('RFQ#1').matchedOrgId).toBe('c.com');            // round 3: backfill migrated off archived B too
    expect(store.markersFor('unresolved-rfq-r1')).toHaveLength(0);
  });

  // Scenario 13 — >100-event unit REDIRECT: the paginated redirect pass moves all 130, rollups dirty.
  it('130-event unit redirect converges fully via pagination', async () => {
    const events = Array.from({ length: 130 }, (_, i) => movedEvent(`tev-${i}`, { orgId: 'a.com', linkGeneration: GEN_1 }));
    const store = seedStore([rfqRecord('RFQ#1', { matchedOrgId: '' }),
      orgItem('a.com', { status: 'archived', mergedInto: 'b.com' }), orgItem('b.com', { status: 'active' }), ...events]);
    store.pageSize = 25;                                              // force multiple pages
    const r = await replayStructuredSideEffects({ ...rfqBase, targetOrgId: 'a.com', generation: GEN_1, backfillPk: 'RFQ#1' });
    expect(r.ok).toBe(true);
    expect(events.filter((e) => store.get(`TLEVENT#${String(e.id)}`).orgId === 'b.com')).toHaveLength(130);
    expect(store.dirtyRollups()).toEqual(expect.arrayContaining(['a.com', 'b.com']));
  });

  // Scenario 14a — FIRST-MOVE vs ARCHIVE race (R6 blocker 1): linker parks at its 3-item transact;
  // merge archives the target; released transact cancels on the ORG fence → explicit error, store clean.
  it('first-move fence cancels when the target archives mid-link; no marker, no moved event', async () => {
    const store = seedStore([unresolvedEvent('tev-1'), orgItem('acme.com', { status: 'active' })]);
    const gate = store.gateOn((cmd) => cmd.constructor.name === 'TransactWriteCommand');
    const pLink = linkStructuredUnit({ representativeEventId: 'tev-1', targetOrgId: 'acme.com', operator: 'op' });
    await store.idle();
    archiveOrgInStore(store, 'acme.com', { mergedInto: 'other.com' });
    gate.release();
    await expect(pLink).rejects.toThrow(/not active|being merged/i);
    expect(store.get('TLEVENT#tev-1').orgId).not.toBe('acme.com');
    expect(store.keys().filter((k) => k.startsWith('CRM_REPAIR#'))).toHaveLength(0);
  });

  // Scenario 14b — SUBSEQUENT-MOVE vs ARCHIVE race: first move committed (marker exists), archive
  // lands, remaining fenced moves fail → link surfaces post_commit_failed; drainer later redirects
  // everything to the successor (marker-driven convergence). The foreground replay's backfill
  // transact is crashed (see file header) so the SEALED marker — not the in-process replay — is
  // what converges the unit, exactly the plan's crash-recoverability claim.
  it('mid-unit archive: fenced later moves stop; the marker drives full convergence at the successor', async () => {
    const store = seedStore([unresolvedEvent('tev-1'), unresolvedEvent('tev-2'), orgItem('acme.com', { status: 'active' }), orgItem('b.com', { status: 'active' })]);
    const gate = store.gateOn((cmd, _input, n) => n === 2 && cmd.constructor.name === 'TransactWriteCommand');  // parks the SECOND move
    const pLink = linkStructuredUnit({ representativeEventId: 'tev-1', targetOrgId: 'acme.com', operator: 'op' });
    await store.idle();
    archiveOrgInStore(store, 'acme.com', { mergedInto: 'b.com' });
    const crashGate = store.gateOn((cmd, input) => cmd.constructor.name === 'TransactWriteCommand'
      && Boolean((input as TxInput).TransactItems?.some((t) => t.Update?.Key?.PK === 'RFQ#r1')));  // the foreground replay's backfill
    gate.release();
    await store.idle();                                               // replay re-resolved the successor, parked at its backfill
    crashGate.releaseWithCrash();                                     // simulated crash mid-replay
    const out = await pLink;
    expect(out.postCommitStatus).toBe('post_commit_failed');          // surfaced, marker retained (sealed → pending)
    await reconcileRepair({});                                        // drainer resolves the successor and converges
    expect(store.get('TLEVENT#tev-1').orgId).toBe('b.com');           // redirect pass moved the committed first move
    expect(store.get('RFQ#r1').matchedOrgId).toBe('b.com');
  });

  // Scenario 15 — STUCK STARVATION (R6): 40 'other'-class stuck markers must not hide the
  // target_unavailable one from recovery (keyed partitions, not filters).
  it('recovery finds the target_unavailable marker regardless of unrelated stuck backlog', async () => {
    const store = seedStore([orgItem('a.com', { status: 'archived', mergedInto: 'b.com' }), orgItem('b.com', { status: 'active' }), rfqRecord('RFQ#1', { matchedOrgId: '' })]);
    for (let i = 0; i < 40; i++) putStuckMarker(store, { unitKey: `u-${i}`, reasonClass: 'other' });
    putStuckMarker(store, { unitKey: 'unresolved-rfq-r1', generation: GEN_1, targetOrgId: 'a.com', reasonClass: 'target_unavailable' });
    const s = await reconcileRepair({});
    expect(s.recovered).toBe(1);                                      // found despite Limit 25 < 41 total stuck
  });

  // Scenario 16 — CHAINED-MERGE RESUME (R9 critical, executable): A→B archives A and crashes;
  // B→C completes; retrying A→B finishes A's phases against ACTIVE C.
  it('A→B crash-after-archive, then B→C, then retry A→B: phases finish against C', async () => {
    const store = seedStore([rfqRecord('RFQ#a1', { matchedOrgId: 'a.com' }),
      orgItem('a.com', { status: 'active' }), orgItem('b.com', { status: 'active' }), orgItem('c.com', { status: 'active' })]);
    // DETERMINISTIC crash point (final-gate fix): gate on the FIRST identifiable post-archive PHASE
    // write — the re-point of RFQ#a1 — not on an ordinal command count (which could catch a read).
    const gate = store.gateOn((cmd, input) =>
      cmd.constructor.name === 'TransactWriteCommand'
      && Boolean((input as TxInput).TransactItems?.some((t) => t.Update?.Key?.PK === 'RFQ#a1')));
    const pAB = mergeOrganization('a.com', 'b.com');
    await store.idle();
    // Assert the pre-crash state BEFORE releasing (the archive transaction committed; phases did not):
    expect(store.get(orgKeyOf('a.com')).status).toBe('archived');
    expect(store.get(orgKeyOf('a.com')).mergePhase).toBe('archived');
    expect(store.get(reconKeyOf('a.com', 'b.com'))).toBeDefined();     // visibility marker exists
    expect(store.get('RFQ#a1').matchedOrgId).toBe('a.com');            // no phase write landed yet
    const abMarkerVersion = store.get(reconKeyOf('a.com', 'b.com')).version;
    gate.releaseWithCrash();                                           // harness: the parked call rejects — simulated crash
    await expect(pAB).rejects.toThrow();
    await mergeOrganization('b.com', 'c.com');                         // B→C completes fully
    await mergeOrganization('a.com', 'b.com');                         // the R9 resume path
    // Effective targeting asserted from STORED STATE + captured commands (no bespoke return field):
    expect(store.get('RFQ#a1').matchedOrgId).toBe('c.com');            // phases ran against the ACTIVE successor
    const last = store.commandsFor('RFQ#a1').at(-1) as unknown as TxInput;
    expect(last.TransactItems?.[0].ConditionCheck?.Key).toEqual(orgKeyOf('c.com'));  // fenced on C
    expect(store.get(orgKeyOf('a.com')).mergedInto).toBe('b.com');     // historical truth preserved
    expect(store.get(orgKeyOf('a.com')).mergePhase).toBe('complete');
    expect(store.get(reconKeyOf('a.com', 'b.com')).version).toBe(abMarkerVersion);  // upsert NOT re-executed on resume
  });

  // Scenario 17 — STUCK RECOVERY end-to-end: blocked marker heals automatically once the chain is fixed.
  it('target_unavailable marker recovers via the reason-specific republish pass', async () => {
    const store = seedStore([rfqRecord('RFQ#1', { matchedOrgId: '' }), orgItem('a.com', { status: 'archived' })]);
    putPendingMarker(store, { unitKey: 'unresolved-rfq-r1', generation: GEN_1, targetOrgId: 'a.com' });
    await reconcileRepair({});                                        // drain 1: blocks it (stuck, target_unavailable)
    expect(store.markersFor('unresolved-rfq-r1')[0].status).toBe('stuck');
    archiveOrgInStore(store, 'a.com', { mergedInto: 'b.com' });       // admin fixes the chain
    store.put(orgKeyOf('b.com'), orgItem('b.com', { status: 'active' }));
    const s2 = await reconcileRepair({});                             // drain 2: recovery pass republishes
    expect(s2.recovered).toBe(1);
    await reconcileRepair({});                                        // drain 3: normal drain repairs at the successor
    expect(store.markersFor('unresolved-rfq-r1')).toHaveLength(0);    // repaired + deleted
    expect(store.get('RFQ#1').matchedOrgId).toBe('b.com');
  });
});
