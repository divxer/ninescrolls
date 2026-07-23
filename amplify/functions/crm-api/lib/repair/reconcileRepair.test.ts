import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
const acquireLease = vi.fn(); const releaseLeaseKeepCursor = vi.fn();
const readState = vi.fn(); const persistPage = vi.fn();
vi.mock('../sweep/sweepState', () => ({
  acquireLease: (...a: unknown[]) => acquireLease(...a),
  releaseLeaseKeepCursor: (...a: unknown[]) => releaseLeaseKeepCursor(...a),
  readState: (...a: unknown[]) => readState(...a),
  persistPage: (...a: unknown[]) => persistPage(...a),
}));
const queryPendingMarkers = vi.fn(); const deleteRepairMarker = vi.fn(); const deleteRepairMarkerIfUnchanged = vi.fn();
const markStuck = vi.fn(); const bumpAttempt = vi.fn(); const touchInProgress = vi.fn();
const queryBuildingOlderThan = vi.fn(); const promoteAbandonedBuilding = vi.fn();
const markStuckV2 = vi.fn(); const bumpAttemptFenced = vi.fn(); const deleteRepairMarkerFenced = vi.fn();
const queryStuckByReason = vi.fn(); const republishStuckFenced = vi.fn();
vi.mock('./repairMarker', () => ({
  queryPendingMarkers: (...a: unknown[]) => queryPendingMarkers(...a),
  deleteRepairMarker: (...a: unknown[]) => deleteRepairMarker(...a),
  deleteRepairMarkerIfUnchanged: (...a: unknown[]) => deleteRepairMarkerIfUnchanged(...a),
  markStuck: (...a: unknown[]) => markStuck(...a),
  bumpAttempt: (...a: unknown[]) => bumpAttempt(...a),
  touchInProgress: (...a: unknown[]) => touchInProgress(...a),
  queryBuildingOlderThan: (...a: unknown[]) => queryBuildingOlderThan(...a),
  promoteAbandonedBuilding: (...a: unknown[]) => promoteAbandonedBuilding(...a),
  markStuckV2: (...a: unknown[]) => markStuckV2(...a),
  bumpAttemptFenced: (...a: unknown[]) => bumpAttemptFenced(...a),
  deleteRepairMarkerFenced: (...a: unknown[]) => deleteRepairMarkerFenced(...a),
  queryStuckByReason: (...a: unknown[]) => queryStuckByReason(...a),
  republishStuckFenced: (...a: unknown[]) => republishStuckFenced(...a),
}));
const replayStructured = vi.fn(); const replayAnalytics = vi.fn(); const resolveEffectiveTarget = vi.fn();
vi.mock('./replaySideEffects', () => ({
  replayStructuredSideEffects: (...a: unknown[]) => replayStructured(...a),
  replayAnalyticsSideEffects: (...a: unknown[]) => replayAnalytics(...a),
  resolveEffectiveTarget: (...a: unknown[]) => resolveEffectiveTarget(...a),
}));
const send = vi.fn();
vi.mock('../dynamodb', () => ({ docClient: { send: (...a: unknown[]) => send(...a) }, TABLE_NAME: () => 'T' }));
import { reconcileRepair } from './reconcileRepair';

const struct = { unitType: 'structured', unitKey: 'u1', targetOrgId: 'acme.com', operator: 'op', createdAt: 't',
  sourceType: 'rfq', sourceEntityId: '1', backfillPk: 'RFQ#1', affectedEventIds: ['e1'], movedCount: 1, contactStatus: 'linked', attemptCount: 0 };
const ana = { unitType: 'analytics', unitKey: 'v1', targetOrgId: 'acme.com', operator: 'op', createdAt: 't', attemptCount: 0 };

// v2 markers: generation-suffixed, version-fenced (Task 9 store).
const genA = { ...struct, generation: '01A', version: 2, customerEmail: null, affectedEventIdsSample: ['e1'], status: 'pending' };
const genB = { ...struct, generation: '01B', version: 1, customerEmail: null, affectedEventIdsSample: ['e2'], status: 'pending' };
const buildingA = { ...genA, unitKey: 'b1', status: 'building' };
const buildingB = { ...genA, unitKey: 'b2', status: 'building' };
const stuckA = { ...genA, unitKey: 'us1', status: 'stuck', stuckReason: 'org gone', stuckReasonClass: 'target_unavailable' };

const probeMarker = {
  PK: 'MERGE_RECON#src.com', SK: 'TO#tgt.com', fromOrgId: 'src.com', toOrgId: 'tgt.com',
  version: 2, state: 'pending_probe', mergedAt: '2026-01-01T00:00:00.000Z',
};
type CmdArg = { input: Record<string, any>; constructor: { name: string } };
function seedProbe(byPrefix: Record<string, unknown[]>, opts?: { fullPage?: boolean; failPrefix?: string; flipCCFE?: boolean }) {
  send.mockImplementation((cmd: CmdArg) => {
    const input = cmd.input ?? {};
    const vals = input.ExpressionAttributeValues ?? {};
    if (cmd.constructor.name === 'UpdateCommand') {
      if (opts?.flipCCFE) return Promise.reject(Object.assign(new Error('ccfe'), { name: 'ConditionalCheckFailedException' }));
      return Promise.resolve({});
    }
    if (vals[':pk'] === 'MERGE_RECON#pending_probe') return Promise.resolve({ Items: [probeMarker] });
    if (input.IndexName === 'GSI2') {
      const pfx = vals[':pfx'] as string;
      if (opts?.failPrefix === pfx) return Promise.reject(new Error('ddb read down'));
      return Promise.resolve({ Items: byPrefix[pfx] ?? [], ...(opts?.fullPage ? { LastEvaluatedKey: { k: 1 } } : {}) });
    }
    return Promise.resolve({ Items: [] });
  });
}
const gsi2Calls = () => send.mock.calls.filter((c) => (c[0] as CmdArg).input?.IndexName === 'GSI2').map((c) => (c[0] as CmdArg).input);
const updateCalls = () => send.mock.calls.filter((c) => (c[0] as CmdArg).constructor.name === 'UpdateCommand').map((c) => (c[0] as CmdArg).input);

beforeEach(() => {
  [acquireLease, releaseLeaseKeepCursor, readState, persistPage,
   queryPendingMarkers, deleteRepairMarker, deleteRepairMarkerIfUnchanged, markStuck, bumpAttempt, touchInProgress,
   queryBuildingOlderThan, promoteAbandonedBuilding, markStuckV2, bumpAttemptFenced,
   deleteRepairMarkerFenced, queryStuckByReason, republishStuckFenced,
   replayStructured, replayAnalytics, resolveEffectiveTarget, send].forEach((m) => m.mockReset());
  acquireLease.mockResolvedValue('tok');
  queryPendingMarkers.mockResolvedValue({ markers: [], hasMore: false });
  queryBuildingOlderThan.mockResolvedValue({ markers: [], lastKey: undefined });
  promoteAbandonedBuilding.mockResolvedValue({ lost: false });
  markStuckV2.mockResolvedValue({ lost: false });
  bumpAttemptFenced.mockResolvedValue({ lost: false });
  deleteRepairMarkerFenced.mockResolvedValue({ lost: false });
  deleteRepairMarkerIfUnchanged.mockResolvedValue({ lost: false });
  markStuck.mockResolvedValue({ lost: false });
  queryStuckByReason.mockResolvedValue({ markers: [], lastKey: undefined });
  republishStuckFenced.mockResolvedValue({ lost: false });
  resolveEffectiveTarget.mockResolvedValue({ status: 'active', orgId: 'acme.com' });
  readState.mockResolvedValue({});
  persistPage.mockResolvedValue(undefined);
  send.mockResolvedValue({ Items: [] });
});

afterEach(() => { vi.useRealTimers(); });

describe('reconcileRepair', () => {
  it('lease held → skippedLeaseHeld, no query', async () => {
    acquireLease.mockResolvedValueOnce(null);
    const out = await reconcileRepair({});
    expect(out).toEqual({ skippedLeaseHeld: true });
    expect(queryPendingMarkers).not.toHaveBeenCalled();
  });
  it('replay ok → delete marker (repaired++)', async () => {
    queryPendingMarkers.mockResolvedValueOnce({ markers: [struct], hasMore: false });
    replayStructured.mockResolvedValueOnce({ ok: true, backfillStatus: 'written' });
    const out = await reconcileRepair({});
    expect(deleteRepairMarkerIfUnchanged).toHaveBeenCalledWith(expect.objectContaining({ unitType: 'structured', unitKey: 'u1' }));
    expect(out.repaired).toBe(1);
    expect(releaseLeaseKeepCursor).toHaveBeenCalledWith('repair', 'drain', 'tok', expect.objectContaining({ hasMore: false }));
  });
  it('in_progress (analytics retro hasMore, not churning) → touchInProgress, keep', async () => {
    queryPendingMarkers.mockResolvedValueOnce({ markers: [ana], hasMore: false });
    replayAnalytics.mockResolvedValueOnce({ ok: false, errorType: 'in_progress', pending: true });
    const out = await reconcileRepair({});
    expect(touchInProgress).toHaveBeenCalled();
    expect(deleteRepairMarkerIfUnchanged).not.toHaveBeenCalled();
    expect(out.inProgress).toBe(1);
  });
  it('churning in_progress below MAX → bumpAttempt (retrying++), NOT touched', async () => {
    queryPendingMarkers.mockResolvedValueOnce({ markers: [{ ...ana, attemptCount: 1 }], hasMore: false });
    replayAnalytics.mockResolvedValueOnce({ ok: false, errorType: 'in_progress', churning: true, pending: true, error: 'retro churning' });
    const out = await reconcileRepair({});
    expect(bumpAttempt).toHaveBeenCalled();
    expect(touchInProgress).not.toHaveBeenCalled();
    expect(out.retrying).toBe(1);
    expect(out.inProgress).toBe(0);
  });
  it('churning in_progress at MAX → markStuck(max_attempts) (stuck++), surfaces in stuck bucket', async () => {
    queryPendingMarkers.mockResolvedValueOnce({ markers: [{ ...ana, attemptCount: 4 }], hasMore: false });
    replayAnalytics.mockResolvedValueOnce({ ok: false, errorType: 'in_progress', churning: true, pending: true, error: 'retro churning: 1 session(s) failing' });
    const out = await reconcileRepair({});
    expect(markStuck).toHaveBeenCalledWith(expect.objectContaining({ attemptCount: 4 }), 'max_attempts', expect.any(String), expect.any(String));
    expect(touchInProgress).not.toHaveBeenCalled();
    expect(out.stuck).toBe(1);
  });
  it('source_conflict → markStuck(source_conflict) immediately (blocked++)', async () => {
    queryPendingMarkers.mockResolvedValueOnce({ markers: [struct], hasMore: false });
    replayStructured.mockResolvedValueOnce({ ok: false, errorType: 'source_conflict', backfillStatus: 'conflict' });
    const out = await reconcileRepair({});
    expect(markStuck).toHaveBeenCalledWith(struct, 'source_conflict', expect.any(String), expect.any(String));
    expect(out.blocked).toBe(1);
  });
  it('transient below MAX → bumpAttempt (retrying++)', async () => {
    queryPendingMarkers.mockResolvedValueOnce({ markers: [{ ...struct, attemptCount: 1 }], hasMore: false });
    replayStructured.mockResolvedValueOnce({ ok: false, errorType: 'transient', error: 'boom' });
    const out = await reconcileRepair({});
    expect(bumpAttempt).toHaveBeenCalled();
    expect(out.retrying).toBe(1);
  });
  it('transient at MAX → markStuck(max_attempts) (stuck++)', async () => {
    queryPendingMarkers.mockResolvedValueOnce({ markers: [{ ...struct, attemptCount: 4 }], hasMore: false });
    replayStructured.mockResolvedValueOnce({ ok: false, errorType: 'transient', error: 'boom' });
    const out = await reconcileRepair({});
    expect(markStuck).toHaveBeenCalledWith(expect.objectContaining({ attemptCount: 4 }), 'max_attempts', 'boom', expect.any(String));
    expect(out.stuck).toBe(1);
  });
  it('isolates a per-marker bookkeeping failure: counts it, keeps draining the rest, still releases lease', async () => {
    queryPendingMarkers.mockResolvedValueOnce({ markers: [struct, ana], hasMore: false });
    replayStructured.mockResolvedValueOnce({ ok: true });          // struct: replay ok...
    deleteRepairMarkerIfUnchanged.mockRejectedValueOnce(new Error('ddb down')); // ...but delete throws
    replayAnalytics.mockResolvedValueOnce({ ok: true });           // ana: fully succeeds
    const out = await reconcileRepair({});
    // The drainer is the marker OWNER — its replay must declare it so the
    // retro doesn't self-bump the version it is consuming
    expect(replayAnalytics).toHaveBeenCalledWith(expect.objectContaining({ markerOwned: true }));
    expect(out.errors).toBe(1);
    expect(out.repaired).toBe(1);     // ana still repaired despite struct's failure
    expect(out.examined).toBe(2);
    expect(releaseLeaseKeepCursor).toHaveBeenCalled(); // lease released, not stuck
  });
  it('propagates hasMore:true to releaseLeaseKeepCursor', async () => {
    queryPendingMarkers.mockResolvedValueOnce({ markers: [struct], hasMore: true });
    replayStructured.mockResolvedValueOnce({ ok: true });
    const out = await reconcileRepair({ limit: 1 });
    expect(out.hasMore).toBe(true);
    expect(releaseLeaseKeepCursor).toHaveBeenCalledWith('repair', 'drain', 'tok', expect.objectContaining({ hasMore: true }));
  });
});

describe('reconcileRepair v2 — building-aging pass', () => {
  it('ages building markers older than 2× link timeout via promoteAbandonedBuilding, paginating until exhausted', async () => {
    queryBuildingOlderThan
      .mockResolvedValueOnce({ markers: [buildingA], lastKey: { k: 1 } })
      .mockResolvedValueOnce({ markers: [buildingB], lastKey: undefined });
    const out = await reconcileRepair({});
    expect(promoteAbandonedBuilding).toHaveBeenCalledTimes(2);
    expect(promoteAbandonedBuilding).toHaveBeenCalledWith(buildingA, expect.any(String), expect.any(String));
    expect(out.aged).toBe(2);
    // cutoff = now − 2×120s
    const cutoffIso = queryBuildingOlderThan.mock.calls[0][0] as string;
    expect(Date.now() - Date.parse(cutoffIso)).toBeGreaterThanOrEqual(240_000);
  });
  it('a lost promotion (fresh foreground activity) is skipped silently, not an error', async () => {
    queryBuildingOlderThan.mockResolvedValueOnce({ markers: [buildingA], lastKey: undefined });
    promoteAbandonedBuilding.mockResolvedValueOnce({ lost: true });
    const out = await reconcileRepair({});
    expect(out.aged).toBe(0);
    expect(out.errors).toBe(0);
  });
});

describe('reconcileRepair v2 — generation-aware draining', () => {
  it('drains BOTH generations of the same unit independently (older-after-newer: superseded = repaired)', async () => {
    queryPendingMarkers.mockResolvedValueOnce({ markers: [genB, genA], hasMore: false });  // newer first
    replayStructured.mockResolvedValueOnce({ ok: true, backfillStatus: 'written' })        // B
                    .mockResolvedValueOnce({ ok: true, backfillStatus: 'superseded' });    // A — success no-op
    const out = await reconcileRepair({});
    expect(out.repaired).toBe(2);
    expect(markStuck).not.toHaveBeenCalled();
    expect(markStuckV2).not.toHaveBeenCalled();
    expect(deleteRepairMarkerFenced).toHaveBeenCalledTimes(2);   // fenced v2 transitions, per generation
    expect(deleteRepairMarkerIfUnchanged).not.toHaveBeenCalled();           // v1 delete untouched for v2 markers
  });
  it('a fenced-transition CCFE (lost) is counted, not retried blindly', async () => {
    queryPendingMarkers.mockResolvedValueOnce({ markers: [genA], hasMore: false });
    replayStructured.mockResolvedValueOnce({ ok: true });
    deleteRepairMarkerFenced.mockResolvedValueOnce({ lost: true });
    const out = await reconcileRepair({});
    expect(out.raced).toBe(1);
    expect(out.repaired).toBe(0);
    expect(out.errors).toBe(0);
    expect(deleteRepairMarkerFenced).toHaveBeenCalledTimes(1);   // no blind retry
  });
  it('contact retry: marker with contactStatus!=="linked" and customerEmail → replay receives them', async () => {
    queryPendingMarkers.mockResolvedValueOnce({ markers: [{ ...genA, contactStatus: 'missing_email', customerEmail: 'b@x.com' }], hasMore: false });
    replayStructured.mockResolvedValueOnce({ ok: true });
    await reconcileRepair({});
    expect(replayStructured).toHaveBeenCalledWith(expect.objectContaining({ customerEmail: 'b@x.com', contactStatus: 'missing_email' }));
  });
  it('v2 marker replay receives generation + sample-derived affectedEventIds', async () => {
    queryPendingMarkers.mockResolvedValueOnce({ markers: [genA], hasMore: false });
    replayStructured.mockResolvedValueOnce({ ok: true });
    await reconcileRepair({});
    expect(replayStructured).toHaveBeenCalledWith(expect.objectContaining({ generation: '01A', affectedEventIds: ['e1'] }));
  });
  it('(a) target_unavailable ⇒ markStuckV2 with reason + class, marker retained, no retry burn', async () => {
    queryPendingMarkers.mockResolvedValueOnce({ markers: [genA], hasMore: false });
    replayStructured.mockResolvedValueOnce({ ok: false, errorType: 'target_unavailable', reason: 'org acme.com archived without successor' });
    const out = await reconcileRepair({});
    expect(markStuckV2).toHaveBeenCalledWith(genA, 'org acme.com archived without successor', 'target_unavailable', expect.any(String));
    expect(deleteRepairMarkerFenced).not.toHaveBeenCalled();
    expect(bumpAttempt).not.toHaveBeenCalled();
    expect(bumpAttemptFenced).not.toHaveBeenCalled();            // no attempt burned on a blocked chain
    expect(out.blocked).toBe(1);
  });
  it('v2 source_conflict/transient transitions use the fenced v2 fns, never the v1 key shape', async () => {
    queryPendingMarkers.mockResolvedValueOnce({ markers: [genA, { ...genB, attemptCount: 1 }, { ...genB, unitKey: 'u9', attemptCount: 4 }], hasMore: false });
    replayStructured.mockResolvedValueOnce({ ok: false, errorType: 'source_conflict', backfillStatus: 'conflict' })
                    .mockResolvedValueOnce({ ok: false, errorType: 'transient', error: 'boom' })
                    .mockResolvedValueOnce({ ok: false, errorType: 'transient', error: 'boom' });
    const out = await reconcileRepair({});
    expect(markStuckV2).toHaveBeenCalledWith(genA, 'source_conflict', 'other', expect.any(String));
    expect(bumpAttemptFenced).toHaveBeenCalledWith(expect.objectContaining({ generation: '01B', attemptCount: 1 }), 'boom', expect.any(String));
    expect(markStuckV2).toHaveBeenCalledWith(expect.objectContaining({ unitKey: 'u9' }), 'max_attempts', 'other', expect.any(String));
    expect(markStuck).not.toHaveBeenCalled();
    expect(bumpAttempt).not.toHaveBeenCalled();
    expect(out.blocked).toBe(1); expect(out.retrying).toBe(1); expect(out.stuck).toBe(1);
  });
});

describe('reconcileRepair v2 — stuck-recovery pass (target_unavailable)', () => {
  it('(b) now-active stuck marker → republishStuckFenced, recovered=1; subsequent drain repairs + deletes it', async () => {
    queryStuckByReason.mockResolvedValueOnce({ markers: [stuckA], lastKey: undefined });
    resolveEffectiveTarget.mockResolvedValueOnce({ status: 'active', orgId: 'successor.com' });
    const out = await reconcileRepair({});
    expect(queryStuckByReason).toHaveBeenCalledWith('target_unavailable', 25, undefined);
    expect(republishStuckFenced).toHaveBeenCalledWith(stuckA, expect.any(String));
    expect(out.recovered).toBe(1);
    // subsequent cycle: the republished marker drains normally
    queryPendingMarkers.mockResolvedValueOnce({ markers: [{ ...stuckA, status: 'pending' }], hasMore: false });
    replayStructured.mockResolvedValueOnce({ ok: true, backfillStatus: 'written' });
    const out2 = await reconcileRepair({});
    expect(deleteRepairMarkerFenced).toHaveBeenCalledTimes(1);
    expect(out2.repaired).toBe(1);
  });
  it('(b2) republish {lost:true} ⇒ skip (recovered stays 0)', async () => {
    queryStuckByReason.mockResolvedValueOnce({ markers: [stuckA], lastKey: undefined });
    republishStuckFenced.mockResolvedValueOnce({ lost: true });
    const out = await reconcileRepair({});
    expect(out.recovered).toBe(0);
    expect(out.errors).toBe(0);
  });
  it('(c) still-unavailable → untouched, zero replay attempts', async () => {
    queryStuckByReason.mockResolvedValueOnce({ markers: [stuckA], lastKey: undefined });
    resolveEffectiveTarget.mockResolvedValueOnce({ status: 'unavailable', reason: 'org gone' });
    const out = await reconcileRepair({});
    expect(republishStuckFenced).not.toHaveBeenCalled();
    expect(replayStructured).not.toHaveBeenCalled();
    expect(out.recovered).toBe(0);
  });
  it('(d) resolver THROW during recovery → marker left stuck, retried next cycle (not misclassified)', async () => {
    queryStuckByReason.mockResolvedValueOnce({ markers: [stuckA], lastKey: undefined });
    resolveEffectiveTarget.mockRejectedValueOnce(new Error('ddb read down'));
    const out = await reconcileRepair({});
    expect(republishStuckFenced).not.toHaveBeenCalled();
    expect(markStuckV2).not.toHaveBeenCalled();                  // still stuck — no reclassification
    expect(out.recovered).toBe(0);
    expect(releaseLeaseKeepCursor).toHaveBeenCalled();           // cycle completes
  });
  it('(j) rotation cursor: starts from the persisted cursor and persists the new lastKey under the lease', async () => {
    readState.mockResolvedValue({ cursor: { k: 25 } });
    queryStuckByReason.mockResolvedValueOnce({ markers: [stuckA], lastKey: { k: 50 } });
    resolveEffectiveTarget.mockResolvedValueOnce({ status: 'unavailable', reason: 'still gone' });
    await reconcileRepair({});
    expect(queryStuckByReason).toHaveBeenCalledWith('target_unavailable', 25, { k: 25 });
    expect(persistPage).toHaveBeenCalledWith('repair', 'drain', 'tok', expect.objectContaining({ cursor: { k: 50 } }));
  });
  it('(k) cursor wraps to null/undefined at partition end so the head is re-scanned next cycle', async () => {
    readState.mockResolvedValue({ cursor: { k: 99 } });
    queryStuckByReason.mockResolvedValueOnce({ markers: [], lastKey: undefined });
    await reconcileRepair({});
    expect(queryStuckByReason).toHaveBeenCalledWith('target_unavailable', 25, { k: 99 });
    const persisted = persistPage.mock.calls[0][3] as { cursor?: unknown };
    expect(persisted.cursor).toBeUndefined();                    // persistPage stores undefined as null (wrap)
  });
});

describe('reconcileRepair v2 — merge-residual visibility probe', () => {
  it('(e) marker past horizon ⇒ probed once (first page only), residualsDetected + samples set, state → needs_review', async () => {
    seedProbe({ 'RFQ#': [{ PK: 'RFQ#1', entityType: 'RFQ', GSI2SK: 'RFQ#t1' }] }, { fullPage: true });
    await reconcileRepair({});
    expect(gsi2Calls()).toHaveLength(5);                         // full pages, yet NEVER paginated
    const flips = updateCalls().filter((u) => String(u.Key?.PK).startsWith('MERGE_RECON#'));
    expect(flips).toHaveLength(1);
    expect(flips[0].Key).toEqual({ PK: 'MERGE_RECON#src.com', SK: 'TO#tgt.com' });
    expect(flips[0].ExpressionAttributeValues[':review']).toBe('needs_review');
    expect(flips[0].ExpressionAttributeValues[':reviewPk']).toBe('MERGE_RECON#needs_review');
    expect(flips[0].ExpressionAttributeValues[':d']).toBe(true);
    expect(flips[0].ExpressionAttributeValues[':s']).toEqual(['RFQ#1']);
  });
  it('(f) LINK_AUDIT/AUDIT rows ⇒ NOT counted; residualsDetected:false when they are all that remains', async () => {
    seedProbe({
      'RFQ#': [{ PK: 'AUDIT#a1', entityType: 'LINK_AUDIT', GSI2SK: 'AUDIT#t#a1' }],
      'CONTACT#': [{ PK: 'AUDIT#a2', entityType: 'LINK_AUDIT', GSI2SK: 'AUDIT#t#a2' }],
    });
    await reconcileRepair({});
    const flip = updateCalls().find((u) => String(u.Key?.PK).startsWith('MERGE_RECON#'))!;
    expect(flip.ExpressionAttributeValues[':d']).toBe(false);
    expect(flip.ExpressionAttributeValues[':s']).toEqual([]);
  });
  it('(g) horizon is a KEY condition: GSI1SK(mergedAt) <= now − 15min; young markers are never even read', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T01:00:00.000Z'));
    await reconcileRepair({});
    const disc = send.mock.calls.map((c) => (c[0] as CmdArg).input)
      .find((i) => i.ExpressionAttributeValues?.[':pk'] === 'MERGE_RECON#pending_probe')!;
    expect(disc.KeyConditionExpression).toBe('GSI1PK = :pk AND GSI1SK <= :cut');
    expect(disc.ExpressionAttributeValues[':cut']).toBe('2026-01-01T00:45:00.000Z');
    expect(disc.ScanIndexForward).toBe(true);
    expect(disc.Limit).toBe(10);
  });
  it('(h) a probe read failure ⇒ marker untouched (no flip), retried next cycle; cycle still completes', async () => {
    seedProbe({ 'RFQ#': [{ PK: 'RFQ#1', entityType: 'RFQ' }] }, { failPrefix: 'ORDER#' });
    const out = await reconcileRepair({});
    expect(updateCalls().filter((u) => String(u.Key?.PK).startsWith('MERGE_RECON#'))).toHaveLength(0);
    expect(out.errors).toBe(1);
    expect(releaseLeaseKeepCursor).toHaveBeenCalled();
  });
  it('(i-discovery) needs_review markers are never re-probed: discovery queries ONLY the pending_probe partition', async () => {
    await reconcileRepair({});
    const gsi1Pks = send.mock.calls.map((c) => (c[0] as CmdArg).input?.ExpressionAttributeValues?.[':pk']).filter(Boolean);
    expect(gsi1Pks).toContain('MERGE_RECON#pending_probe');
    expect(gsi1Pks).not.toContain('MERGE_RECON#needs_review');
  });
  it('(shape i+ii) exactly FIVE queries per probed marker, fixed prefix order, Limit 20, forward, NO ExclusiveStartKey', async () => {
    seedProbe({}, { fullPage: true });
    await reconcileRepair({});
    const qs = gsi2Calls();
    expect(qs.map((q) => q.ExpressionAttributeValues[':pfx'])).toEqual(['RFQ#', 'ORDER#', 'LEAD#', 'CONTACT#', 'TLEVENT#']);
    for (const q of qs) {
      expect(q.KeyConditionExpression).toBe('GSI2PK = :pk AND begins_with(GSI2SK, :pfx)');
      expect(q.ExpressionAttributeValues[':pk']).toBe('ORG#src.com');
      expect(q.Limit).toBe(20);
      expect(q.ScanIndexForward).toBe(true);
      expect(q.ExclusiveStartKey).toBeUndefined();
    }
    expect(qs).toHaveLength(5);                                  // full page ⇒ still no follow-up page
  });
  it('(shape iv) an unknown-entityType row ⇒ counted + sampled (visibility, not classification)', async () => {
    seedProbe({ 'TLEVENT#': [{ PK: 'WIDGET#9', entityType: 'FUTURE_THING', GSI2SK: 'TLEVENT#t#9' }] });
    await reconcileRepair({});
    const flip = updateCalls().find((u) => String(u.Key?.PK).startsWith('MERGE_RECON#'))!;
    expect(flip.ExpressionAttributeValues[':d']).toBe(true);
    expect(flip.ExpressionAttributeValues[':s']).toEqual(['WIDGET#9']);
  });
  it('(shape v) 30 residuals across prefixes ⇒ residualSamples capped at exactly 10', async () => {
    const rows = (p: string, n: number) => Array.from({ length: n }, (_, i) => ({ PK: `${p}${i}`, entityType: 'RFQ', GSI2SK: `${p}${i}` }));
    seedProbe({ 'RFQ#': rows('RFQ#', 15), 'ORDER#': rows('ORDER#', 15) });
    await reconcileRepair({});
    const flip = updateCalls().find((u) => String(u.Key?.PK).startsWith('MERGE_RECON#'))!;
    expect(flip.ExpressionAttributeValues[':d']).toBe(true);
    expect(flip.ExpressionAttributeValues[':s']).toHaveLength(10);
  });
  it('(shape vi) flip is fenced on state+version; CCFE ⇒ marker untouched by this actor, no retry within the cycle', async () => {
    seedProbe({}, { flipCCFE: true });
    const out = await reconcileRepair({});
    const flips = updateCalls().filter((u) => String(u.Key?.PK).startsWith('MERGE_RECON#'));
    expect(flips).toHaveLength(1);                               // ONE attempt, no in-cycle retry
    expect(flips[0].ConditionExpression).toBe('#st = :probe AND version = :v');
    expect(flips[0].ExpressionAttributeValues[':probe']).toBe('pending_probe');
    expect(flips[0].ExpressionAttributeValues[':v']).toBe(2);
    expect(flips[0].ExpressionAttributeNames).toEqual({ '#st': 'state' });
    expect(out.errors).toBe(0);                                  // CCFE = silent skip, not an error
  });
});
