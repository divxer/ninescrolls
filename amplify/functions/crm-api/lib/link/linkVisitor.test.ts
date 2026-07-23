import { describe, it, expect, vi, beforeEach } from 'vitest';
const mockSend = vi.fn();
vi.mock('../dynamodb', () => ({ docClient: { send: (...a: unknown[]) => mockSend(...a) }, TABLE_NAME: () => 'T' }));
const orgExistsMock = vi.fn(); const readBridgeMock = vi.fn(); const upsertManualMock = vi.fn(); const retroMock = vi.fn();
vi.mock('../orgStore', () => ({ orgExists: (o: string) => orgExistsMock(o) }));
vi.mock('../../../../lib/crm/visitor-bridge', () => ({ readVisitorBridge: (...a: unknown[]) => readBridgeMock(...a), upsertManualVisitorBridge: (...a: unknown[]) => upsertManualMock(...a), toSend: () => 'send' }));
vi.mock('../analytics/reResolveVisitorSessions', () => ({ reResolveVisitorSessions: (a: unknown) => retroMock(a) }));
const ensureRepairMarker = vi.fn(); const deleteRepairMarkerIfUnchanged = vi.fn();
vi.mock('../repair/repairMarker', () => ({ ensureRepairMarker: (...a: unknown[]) => ensureRepairMarker(...a), deleteRepairMarkerIfUnchanged: (...a: unknown[]) => deleteRepairMarkerIfUnchanged(...a) }));
const replayAnalyticsSideEffects = vi.fn();
vi.mock('../repair/replaySideEffects', () => ({ replayAnalyticsSideEffects: (...a: unknown[]) => replayAnalyticsSideEffects(...a) }));
import { linkVisitor } from './linkVisitor';

beforeEach(() => {
  mockSend.mockReset(); orgExistsMock.mockReset(); readBridgeMock.mockReset(); upsertManualMock.mockReset(); retroMock.mockReset();
  ensureRepairMarker.mockReset(); ensureRepairMarker.mockResolvedValue({ created: true, workVersion: 3 }); deleteRepairMarkerIfUnchanged.mockReset(); deleteRepairMarkerIfUnchanged.mockResolvedValue({ lost: false }); replayAnalyticsSideEffects.mockReset();
  replayAnalyticsSideEffects.mockResolvedValue({ ok: true, sessionsResolved: 2, pending: false });
});

describe('linkVisitor', () => {
  it('written bridge → marker after commit, replay, delete on ok', async () => {
    orgExistsMock.mockResolvedValueOnce(true); readBridgeMock.mockResolvedValueOnce(undefined);
    upsertManualMock.mockResolvedValueOnce({ written: true, existingOrgId: 'acme.com' });
    const out = await linkVisitor({ visitorId: 'v1', targetOrgId: 'acme.com', operator: 'op' });
    expect(ensureRepairMarker).toHaveBeenCalledWith(expect.objectContaining({ unitType: 'analytics', unitKey: 'v1', targetOrgId: 'acme.com' }));
    // Fenced completion delete: linkVisitor created a version-LESS marker, so
    // the fence is attribute_not_exists(workVersion) — concurrent published
    // work (version present) survives the delete
    // ABA closed: the publish is VERSIONED (ensureRepairMarker) and the
    // completion delete carries the exact version we published — a concurrent
    // publish (different version) can never be killed by our delete
    expect(ensureRepairMarker).toHaveBeenCalledWith(expect.objectContaining({ unitType: 'analytics', unitKey: 'v1' }));
    expect(deleteRepairMarkerIfUnchanged).toHaveBeenCalledWith({ unitType: 'analytics', unitKey: 'v1', workVersion: 3 });
    // NOT markerOwned: a truncated retro must publish its own marker (the
    // initial Put above is best-effort and may have failed)
    expect(replayAnalyticsSideEffects).toHaveBeenCalledWith(expect.not.objectContaining({ markerOwned: true }));
    expect(out.postCommitStatus).toBe('ok');
    expect(out.sessionsResolved).toBe(2);
  });

  it('replay not ok → keep marker + post_commit_failed', async () => {
    orgExistsMock.mockResolvedValueOnce(true); readBridgeMock.mockResolvedValueOnce(undefined);
    upsertManualMock.mockResolvedValueOnce({ written: true, existingOrgId: 'acme.com' });
    replayAnalyticsSideEffects.mockResolvedValueOnce({ ok: false, errorType: 'transient', pending: false, sessionsResolved: 0 });
    const out = await linkVisitor({ visitorId: 'v1', targetOrgId: 'acme.com', operator: 'op' });
    expect(deleteRepairMarkerIfUnchanged).not.toHaveBeenCalled();
    expect(out.postCommitStatus).toBe('post_commit_failed');
  });

  it('replay in_progress (large retro) → keep marker but postCommitStatus stays ok + pending', async () => {
    orgExistsMock.mockResolvedValueOnce(true); readBridgeMock.mockResolvedValueOnce(undefined);
    upsertManualMock.mockResolvedValueOnce({ written: true, existingOrgId: 'acme.com' });
    replayAnalyticsSideEffects.mockResolvedValueOnce({ ok: false, errorType: 'in_progress', pending: true, sessionsResolved: 200 });
    const out = await linkVisitor({ visitorId: 'v1', targetOrgId: 'acme.com', operator: 'op' });
    expect(deleteRepairMarkerIfUnchanged).not.toHaveBeenCalled();
    expect(out.postCommitStatus).toBe('ok');
    expect(out.pending).toBe(true);
  });

  it('already-manual bridge → NO marker (existing idempotent retro only)', async () => {
    orgExistsMock.mockResolvedValueOnce(true); readBridgeMock.mockResolvedValueOnce({ matchedOrgId: 'acme.com', orgSource: 'manual' });
    retroMock.mockResolvedValueOnce({ summary: { resolved: 0, hasMore: false } });
    const out = await linkVisitor({ visitorId: 'v1', targetOrgId: 'acme.com', operator: 'op' });
    expect(out.alreadyLinked).toBe(true);
    expect(ensureRepairMarker).not.toHaveBeenCalled();
  });

  it('lost race (upsert not written) → NO marker', async () => {
    orgExistsMock.mockResolvedValueOnce(true); readBridgeMock.mockResolvedValueOnce(undefined);
    upsertManualMock.mockResolvedValueOnce({ written: false, existingOrgId: 'x' });
    const out = await linkVisitor({ visitorId: 'v1', targetOrgId: 'acme.com', operator: 'op' });
    expect(out.alreadyResolved).toBe(true);
    expect(ensureRepairMarker).not.toHaveBeenCalled();
  });

  it('conditional manual write loses the race (written:false) → alreadyResolved, NO retro, NO replay, NO marker', async () => {
    orgExistsMock.mockResolvedValueOnce(true); readBridgeMock.mockResolvedValueOnce(null);
    upsertManualMock.mockResolvedValueOnce({ written: false, existingOrgId: 'winner.com' });
    const r = await linkVisitor({ visitorId: 'v1', targetOrgId: 'acme.com', operator: 'op' });
    expect(r).toMatchObject({ alreadyResolved: true, existingOrgId: 'winner.com' });
    expect(retroMock).not.toHaveBeenCalled();
    expect(replayAnalyticsSideEffects).not.toHaveBeenCalled();
    expect(ensureRepairMarker).not.toHaveBeenCalled();
  });

  it('already manual → alreadyLinked no-op, repairs retro (no upsert, no bridge re-write)', async () => {
    orgExistsMock.mockResolvedValueOnce(true); readBridgeMock.mockResolvedValueOnce({ matchedOrgId: 'acme.com', orgSource: 'manual' });
    retroMock.mockResolvedValueOnce({ summary: { resolved: 0, hasMore: false } });
    const r = await linkVisitor({ visitorId: 'v1', targetOrgId: 'other.com', operator: 'op' });
    expect(r).toMatchObject({ alreadyLinked: true, existingOrgId: 'acme.com' });
    expect(upsertManualMock).not.toHaveBeenCalled();
    expect(retroMock).toHaveBeenCalledWith({ visitorId: 'v1' }); // repair retro ran
  });

  it('already real non-manual → alreadyResolved no-op (no manual overwrite)', async () => {
    orgExistsMock.mockResolvedValueOnce(true); readBridgeMock.mockResolvedValueOnce({ matchedOrgId: 'acme.com', orgSource: 'rfq_match' });
    const r = await linkVisitor({ visitorId: 'v1', targetOrgId: 'other.com', operator: 'op' });
    expect(r).toMatchObject({ alreadyResolved: true, existingOrgId: 'acme.com' });
    expect(upsertManualMock).not.toHaveBeenCalled();
    expect(ensureRepairMarker).not.toHaveBeenCalled();
  });

  it('rejects invalid target', async () => {
    orgExistsMock.mockResolvedValueOnce(false);
    await expect(linkVisitor({ visitorId: 'v1', targetOrgId: 'nope', operator: 'op' })).rejects.toThrow(/target/i);
  });

  it('already-manual repair path re-runs idempotent retro', async () => {
    orgExistsMock.mockResolvedValueOnce(true);
    readBridgeMock.mockResolvedValueOnce({ matchedOrgId: 'acme.com', orgSource: 'manual' });
    retroMock.mockResolvedValueOnce({ summary: { resolved: 0, hasMore: false } });
    const r = await linkVisitor({ visitorId: 'v1', targetOrgId: 'other.com', operator: 'op' });
    expect(r).toMatchObject({ alreadyLinked: true, existingOrgId: 'acme.com', postCommitStatus: 'ok' });
    expect(retroMock).toHaveBeenCalledWith({ visitorId: 'v1' });   // repair retro ran
    expect(upsertManualMock).not.toHaveBeenCalled();               // did NOT re-write the bridge
  });
});
