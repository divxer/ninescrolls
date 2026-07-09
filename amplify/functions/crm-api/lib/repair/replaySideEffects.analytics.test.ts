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
});
