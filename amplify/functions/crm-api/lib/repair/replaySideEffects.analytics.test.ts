import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('../dynamodb', () => ({ docClient: { send: vi.fn() }, TABLE_NAME: () => 'T' }));
const writeLinkAuditLog = vi.fn();
vi.mock('../auditStore', () => ({ writeLinkAuditLog: (...a: unknown[]) => writeLinkAuditLog(...a) }));
const reResolve = vi.fn();
vi.mock('../analytics/reResolveVisitorSessions', () => ({ reResolveVisitorSessions: (...a: unknown[]) => reResolve(...a) }));
import { replayAnalyticsSideEffects } from './replaySideEffects';

const base = { visitorId: 'v1', targetOrgId: 'acme.com', operator: 'op', createdAt: '2026-07-08T00:00:00.000Z' };
beforeEach(() => { writeLinkAuditLog.mockReset(); writeLinkAuditLog.mockResolvedValue('a'); reResolve.mockReset(); });

describe('replayAnalyticsSideEffects', () => {
  it('ok: retro done (hasMore false) + audit written with deterministic id', async () => {
    reResolve.mockResolvedValueOnce({ summary: { reemitted: 2, hasMore: false } });
    const r = await replayAnalyticsSideEffects(base);
    expect(r.ok).toBe(true); expect(r.pending).toBe(false);
    expect(writeLinkAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      id: expect.stringMatching(/^audit-[0-9a-f]{16}$/), reason: 'manual_link_visitor',
      details: expect.objectContaining({ unitType: 'analytics', retroSummary: expect.any(Object) }),
    }));
  });
  it('in_progress: retro hasMore → not ok, marker kept', async () => {
    reResolve.mockResolvedValueOnce({ summary: { reemitted: 5, hasMore: true } });
    const r = await replayAnalyticsSideEffects(base);
    expect(r).toMatchObject({ ok: false, errorType: 'in_progress', pending: true });
    expect(writeLinkAuditLog).toHaveBeenCalled(); // audit still written
  });
  it('in_progress: legit more-pages retro (not churning) → churning:false', async () => {
    reResolve.mockResolvedValueOnce({ summary: { reemitted: 5, hasMore: true, churning: false } });
    const r = await replayAnalyticsSideEffects(base);
    expect(r).toMatchObject({ ok: false, errorType: 'in_progress', pending: true, churning: false });
  });
  it('churning: retro re-failing same sessions (hasMore + churning) → in_progress with churning:true', async () => {
    reResolve.mockResolvedValueOnce({ summary: { reemitted: 0, errors: 1, hasMore: true, churning: true } });
    const r = await replayAnalyticsSideEffects(base);
    // errorType stays in_progress so linkVisitor still treats it as "kept" (not post_commit_failed);
    // the churning flag is what the drainer routes on.
    expect(r).toMatchObject({ ok: false, errorType: 'in_progress', pending: true, churning: true });
  });
  it('transient: retro throws → transient (audit still attempted, idempotent)', async () => {
    reResolve.mockRejectedValueOnce(new Error('boom'));
    const r = await replayAnalyticsSideEffects(base);
    expect(r).toMatchObject({ ok: false, errorType: 'transient' });
  });
  it('audit CCFE is idempotent success, not transient', async () => {
    reResolve.mockResolvedValueOnce({ summary: { hasMore: false } });
    writeLinkAuditLog.mockRejectedValueOnce(Object.assign(new Error('dup'), { name: 'ConditionalCheckFailedException' }));
    const r = await replayAnalyticsSideEffects(base);
    expect(r.ok).toBe(true);
  });
  it('transient: retro SUCCEEDS but audit throws a non-CCFE error → transient', async () => {
    reResolve.mockResolvedValueOnce({ summary: { hasMore: false } });
    writeLinkAuditLog.mockRejectedValueOnce(new Error('audit throttled')); // non-CCFE
    const r = await replayAnalyticsSideEffects(base);
    expect(r).toMatchObject({ ok: false, errorType: 'transient' });
  });
});
