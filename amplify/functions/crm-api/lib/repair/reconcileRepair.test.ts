import { describe, it, expect, vi, beforeEach } from 'vitest';
const acquireLease = vi.fn(); const releaseLeaseKeepCursor = vi.fn();
vi.mock('../sweep/sweepState', () => ({
  acquireLease: (...a: unknown[]) => acquireLease(...a),
  releaseLeaseKeepCursor: (...a: unknown[]) => releaseLeaseKeepCursor(...a),
}));
const queryPendingMarkers = vi.fn(); const deleteRepairMarker = vi.fn();
const markStuck = vi.fn(); const bumpAttempt = vi.fn(); const touchInProgress = vi.fn();
vi.mock('./repairMarker', () => ({
  queryPendingMarkers: (...a: unknown[]) => queryPendingMarkers(...a),
  deleteRepairMarker: (...a: unknown[]) => deleteRepairMarker(...a),
  markStuck: (...a: unknown[]) => markStuck(...a),
  bumpAttempt: (...a: unknown[]) => bumpAttempt(...a),
  touchInProgress: (...a: unknown[]) => touchInProgress(...a),
}));
const replayStructured = vi.fn(); const replayAnalytics = vi.fn();
vi.mock('./replaySideEffects', () => ({
  replayStructuredSideEffects: (...a: unknown[]) => replayStructured(...a),
  replayAnalyticsSideEffects: (...a: unknown[]) => replayAnalytics(...a),
}));
import { reconcileRepair } from './reconcileRepair';

const struct = { unitType: 'structured', unitKey: 'u1', targetOrgId: 'acme.com', operator: 'op', createdAt: 't',
  sourceType: 'rfq', sourceEntityId: '1', backfillPk: 'RFQ#1', affectedEventIds: ['e1'], movedCount: 1, contactStatus: 'linked', attemptCount: 0 };
const ana = { unitType: 'analytics', unitKey: 'v1', targetOrgId: 'acme.com', operator: 'op', createdAt: 't', attemptCount: 0 };

beforeEach(() => {
  [acquireLease, releaseLeaseKeepCursor, queryPendingMarkers, deleteRepairMarker, markStuck, bumpAttempt, touchInProgress, replayStructured, replayAnalytics].forEach((m) => m.mockReset());
  acquireLease.mockResolvedValue('tok');
  queryPendingMarkers.mockResolvedValue({ markers: [], hasMore: false });
});

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
    expect(deleteRepairMarker).toHaveBeenCalledWith('structured', 'u1');
    expect(out.repaired).toBe(1);
    expect(releaseLeaseKeepCursor).toHaveBeenCalledWith('repair', 'drain', 'tok', expect.objectContaining({ hasMore: false }));
  });
  it('in_progress (analytics retro hasMore, not churning) → touchInProgress, keep', async () => {
    queryPendingMarkers.mockResolvedValueOnce({ markers: [ana], hasMore: false });
    replayAnalytics.mockResolvedValueOnce({ ok: false, errorType: 'in_progress', pending: true });
    const out = await reconcileRepair({});
    expect(touchInProgress).toHaveBeenCalled();
    expect(deleteRepairMarker).not.toHaveBeenCalled();
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
    deleteRepairMarker.mockRejectedValueOnce(new Error('ddb down')); // ...but delete throws
    replayAnalytics.mockResolvedValueOnce({ ok: true });           // ana: fully succeeds
    const out = await reconcileRepair({});
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
