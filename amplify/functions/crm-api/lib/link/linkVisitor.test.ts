import { describe, it, expect, vi, beforeEach } from 'vitest';
const mockSend = vi.fn();
vi.mock('../dynamodb', () => ({ docClient: { send: (...a: unknown[]) => mockSend(...a) }, TABLE_NAME: () => 'T' }));
const orgExistsMock = vi.fn(); const readBridgeMock = vi.fn(); const upsertManualMock = vi.fn(); const retroMock = vi.fn(); const auditMock = vi.fn();
vi.mock('../orgStore', () => ({ orgExists: (o: string) => orgExistsMock(o) }));
vi.mock('../../../../lib/crm/visitor-bridge', () => ({ readVisitorBridge: (...a: unknown[]) => readBridgeMock(...a), upsertManualVisitorBridge: (...a: unknown[]) => upsertManualMock(...a), toSend: () => 'send' }));
vi.mock('../analytics/reResolveVisitorSessions', () => ({ reResolveVisitorSessions: (a: unknown) => retroMock(a) }));
vi.mock('../auditStore', () => ({ writeLinkAuditLog: (a: unknown) => auditMock(a) }));
import { linkVisitor } from './linkVisitor';

beforeEach(() => { mockSend.mockReset(); orgExistsMock.mockReset(); readBridgeMock.mockReset(); upsertManualMock.mockReset(); retroMock.mockReset(); auditMock.mockReset(); });

describe('linkVisitor', () => {
  it('no bridge → conditional manual write succeeds, triggers retro, audits', async () => {
    orgExistsMock.mockResolvedValueOnce(true); readBridgeMock.mockResolvedValueOnce(null);
    upsertManualMock.mockResolvedValueOnce({ written: true, existingOrgId: 'acme.com' });
    retroMock.mockResolvedValueOnce({ summary: { resolved: 3, hasMore: false } }); auditMock.mockResolvedValueOnce('a');
    const r = await linkVisitor({ visitorId: 'v1', targetOrgId: 'acme.com', operator: 'op' });
    expect(upsertManualMock).toHaveBeenCalled();
    expect(retroMock).toHaveBeenCalledWith({ visitorId: 'v1' });
    expect(r).toMatchObject({ sessionsResolved: 3, pending: false });
  });

  it('conditional manual write loses the race (written:false) → alreadyResolved, NO retro, NO audit (finding 4)', async () => {
    orgExistsMock.mockResolvedValueOnce(true); readBridgeMock.mockResolvedValueOnce(null);
    upsertManualMock.mockResolvedValueOnce({ written: false, existingOrgId: 'winner.com' });
    const r = await linkVisitor({ visitorId: 'v1', targetOrgId: 'acme.com', operator: 'op' });
    expect(r).toMatchObject({ alreadyResolved: true, existingOrgId: 'winner.com' });
    expect(retroMock).not.toHaveBeenCalled();
    expect(auditMock).not.toHaveBeenCalled();
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
  });

  it('rejects invalid target', async () => {
    orgExistsMock.mockResolvedValueOnce(false);
    await expect(linkVisitor({ visitorId: 'v1', targetOrgId: 'nope', operator: 'op' })).rejects.toThrow(/target/i);
  });

  it('F1: a post-commit retro/audit failure does NOT fail the mutation (bridge write already durable)', async () => {
    orgExistsMock.mockResolvedValueOnce(true); readBridgeMock.mockResolvedValueOnce(null);
    upsertManualMock.mockResolvedValueOnce({ written: true, existingOrgId: 'acme.com' });
    retroMock.mockRejectedValueOnce(new Error('retro boom'));   // post-commit failure
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = await linkVisitor({ visitorId: 'v1', targetOrgId: 'acme.com', operator: 'op' });   // must NOT throw
    expect(r).toMatchObject({ existingOrgId: 'acme.com', postCommitStatus: 'post_commit_failed' });
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it('F1: audit failure after a successful retro also does NOT fail the mutation', async () => {
    orgExistsMock.mockResolvedValueOnce(true); readBridgeMock.mockResolvedValueOnce(null);
    upsertManualMock.mockResolvedValueOnce({ written: true, existingOrgId: 'acme.com' });
    retroMock.mockResolvedValueOnce({ summary: { resolved: 2, hasMore: false } });
    auditMock.mockRejectedValueOnce(new Error('audit boom'));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = await linkVisitor({ visitorId: 'v1', targetOrgId: 'acme.com', operator: 'op' });
    expect(r).toMatchObject({ sessionsResolved: 2, postCommitStatus: 'post_commit_failed' });
    errSpy.mockRestore();
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
