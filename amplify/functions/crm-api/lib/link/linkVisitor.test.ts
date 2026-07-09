import { describe, it, expect, vi, beforeEach } from 'vitest';
const mockSend = vi.fn();
vi.mock('../dynamodb', () => ({ docClient: { send: (...a: unknown[]) => mockSend(...a) }, TABLE_NAME: () => 'T' }));
const orgExistsMock = vi.fn(); const readBridgeMock = vi.fn(); const upsertManualMock = vi.fn(); const retroMock = vi.fn();
vi.mock('../orgStore', () => ({ orgExists: (o: string) => orgExistsMock(o) }));
vi.mock('../../../../lib/crm/visitor-bridge', () => ({ readVisitorBridge: (...a: unknown[]) => readBridgeMock(...a), upsertManualVisitorBridge: (...a: unknown[]) => upsertManualMock(...a), toSend: () => 'send' }));
vi.mock('../analytics/reResolveVisitorSessions', () => ({ reResolveVisitorSessions: (a: unknown) => retroMock(a) }));
const putRepairMarker = vi.fn(); const deleteRepairMarker = vi.fn();
vi.mock('../repair/repairMarker', () => ({ putRepairMarker: (...a: unknown[]) => putRepairMarker(...a), deleteRepairMarker: (...a: unknown[]) => deleteRepairMarker(...a) }));
const replayAnalyticsSideEffects = vi.fn();
vi.mock('../repair/replaySideEffects', () => ({ replayAnalyticsSideEffects: (...a: unknown[]) => replayAnalyticsSideEffects(...a) }));
import { linkVisitor } from './linkVisitor';

beforeEach(() => {
  mockSend.mockReset(); orgExistsMock.mockReset(); readBridgeMock.mockReset(); upsertManualMock.mockReset(); retroMock.mockReset();
  putRepairMarker.mockReset(); deleteRepairMarker.mockReset(); replayAnalyticsSideEffects.mockReset();
  replayAnalyticsSideEffects.mockResolvedValue({ ok: true, sessionsResolved: 2, pending: false });
});

describe('linkVisitor', () => {
  it('written bridge → marker after commit, replay, delete on ok', async () => {
    orgExistsMock.mockResolvedValueOnce(true); readBridgeMock.mockResolvedValueOnce(undefined);
    upsertManualMock.mockResolvedValueOnce({ written: true, existingOrgId: 'acme.com' });
    const out = await linkVisitor({ visitorId: 'v1', targetOrgId: 'acme.com', operator: 'op' });
    expect(putRepairMarker).toHaveBeenCalledWith(expect.objectContaining({ unitType: 'analytics', unitKey: 'v1', targetOrgId: 'acme.com' }));
    expect(deleteRepairMarker).toHaveBeenCalledWith('analytics', 'v1');
    expect(out.postCommitStatus).toBe('ok');
    expect(out.sessionsResolved).toBe(2);
  });

  it('replay not ok → keep marker + post_commit_failed', async () => {
    orgExistsMock.mockResolvedValueOnce(true); readBridgeMock.mockResolvedValueOnce(undefined);
    upsertManualMock.mockResolvedValueOnce({ written: true, existingOrgId: 'acme.com' });
    replayAnalyticsSideEffects.mockResolvedValueOnce({ ok: false, errorType: 'transient', pending: false, sessionsResolved: 0 });
    const out = await linkVisitor({ visitorId: 'v1', targetOrgId: 'acme.com', operator: 'op' });
    expect(deleteRepairMarker).not.toHaveBeenCalled();
    expect(out.postCommitStatus).toBe('post_commit_failed');
  });

  it('already-manual bridge → NO marker (existing idempotent retro only)', async () => {
    orgExistsMock.mockResolvedValueOnce(true); readBridgeMock.mockResolvedValueOnce({ matchedOrgId: 'acme.com', orgSource: 'manual' });
    retroMock.mockResolvedValueOnce({ summary: { resolved: 0, hasMore: false } });
    const out = await linkVisitor({ visitorId: 'v1', targetOrgId: 'acme.com', operator: 'op' });
    expect(out.alreadyLinked).toBe(true);
    expect(putRepairMarker).not.toHaveBeenCalled();
  });

  it('lost race (upsert not written) → NO marker', async () => {
    orgExistsMock.mockResolvedValueOnce(true); readBridgeMock.mockResolvedValueOnce(undefined);
    upsertManualMock.mockResolvedValueOnce({ written: false, existingOrgId: 'x' });
    const out = await linkVisitor({ visitorId: 'v1', targetOrgId: 'acme.com', operator: 'op' });
    expect(out.alreadyResolved).toBe(true);
    expect(putRepairMarker).not.toHaveBeenCalled();
  });

  it('conditional manual write loses the race (written:false) → alreadyResolved, NO retro, NO replay, NO marker', async () => {
    orgExistsMock.mockResolvedValueOnce(true); readBridgeMock.mockResolvedValueOnce(null);
    upsertManualMock.mockResolvedValueOnce({ written: false, existingOrgId: 'winner.com' });
    const r = await linkVisitor({ visitorId: 'v1', targetOrgId: 'acme.com', operator: 'op' });
    expect(r).toMatchObject({ alreadyResolved: true, existingOrgId: 'winner.com' });
    expect(retroMock).not.toHaveBeenCalled();
    expect(replayAnalyticsSideEffects).not.toHaveBeenCalled();
    expect(putRepairMarker).not.toHaveBeenCalled();
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
    expect(putRepairMarker).not.toHaveBeenCalled();
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
