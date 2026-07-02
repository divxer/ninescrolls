import { describe, it, expect, vi, beforeEach } from 'vitest';
const acquireLease = vi.fn(); const persistPage = vi.fn(); const releaseLeaseKeepCursor = vi.fn(); const readState = vi.fn();
vi.mock('../sweep/sweepState', () => ({
  acquireLease: (...a: unknown[]) => acquireLease(...a), persistPage: (...a: unknown[]) => persistPage(...a),
  releaseLeaseKeepCursor: (...a: unknown[]) => releaseLeaseKeepCursor(...a), readState: (...a: unknown[]) => readState(...a), stateKey: () => ({}),
}));
const discover = vi.fn(); const loadFlushes = vi.fn(); const closed = vi.fn();
vi.mock('./sessionWindow', () => ({
  discoverFlushPage: (o: unknown) => discover(o), loadSessionFlushes: (s: string) => loadFlushes(s),
  isSessionClosed: (...a: unknown[]) => closed(...a), computeCutoff: (n: string) => new Date(Date.parse(n) - 1800000).toISOString(),
  ANALYTICS_TABLE: () => 'ANALYTICS',
}));
const materialize = vi.fn();
vi.mock('./materializeSession', () => ({ materializeSession: (o: unknown) => materialize(o) }));
import { rollupAnalyticsSessions } from './rollupAnalyticsSessions';
beforeEach(() => { [acquireLease, persistPage, releaseLeaseKeepCursor, readState, discover, loadFlushes, closed, materialize].forEach((m) => m.mockReset());
  acquireLease.mockResolvedValue('tok'); readState.mockResolvedValue({}); loadFlushes.mockResolvedValue([{ timestamp: 't' }]); });

describe('rollupAnalyticsSessions', () => {
  it('skips when the lease is held', async () => {
    acquireLease.mockResolvedValueOnce(null);
    const out = await rollupAnalyticsSessions({});
    expect(out.summary).toMatchObject({ skipped: true });
    expect(discover).not.toHaveBeenCalled();
  });
  it('happy path: freezes activeRunCutoff, materializes closed sessions, advances watermark, releases', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-02T12:00:00.000Z'));
    try {
      readState.mockResolvedValue({ cursor: { watermark: '2026-07-01T00:00:00.000Z' } });
      discover.mockResolvedValueOnce({ sessionIds: ['s-1', 's-2'] });                 // no lastKey → final page
      closed.mockReturnValueOnce(true).mockReturnValueOnce(false);                     // s-2 still open
      materialize.mockResolvedValueOnce({ outcome: 'emitted', resolutionSource: 'bridge' });
      const out = await rollupAnalyticsSessions({});
      expect(materialize).toHaveBeenCalledTimes(1);
      expect(materialize).toHaveBeenCalledWith(expect.objectContaining({ sessionId: 's-1' }));
      expect(releaseLeaseKeepCursor).toHaveBeenCalledTimes(1);
      const summary = releaseLeaseKeepCursor.mock.calls[0][3].lastSummary as Record<string, unknown>;
      expect(summary).toMatchObject({ discovered: 2, closed: 1, emitted: 1, bridgeResolved: 1 });
      // watermark advanced to the frozen cutoff on completion:
      expect((releaseLeaseKeepCursor.mock.calls[0][3].lastSummary as { watermark?: string }).watermark).toBeDefined();
      const final = persistPage.mock.calls.at(-1)![3] as { hasMore: boolean; cursor: Record<string, unknown> };
      expect(final.hasMore).toBe(false);
      expect(final.cursor).toMatchObject({ activeRunCutoff: null, pageCursor: null, pendingSessionIds: [] });
      expect(final.cursor.watermark).toBe('2026-07-02T11:30:00.000Z');                 // frozen cutoff = now − 30min
      expect(out.summary).toMatchObject({ hasMore: false });
    } finally {
      vi.useRealTimers();
    }
  });
  it('resumes an ACTIVE run: reuses persisted activeRunCutoff + pageCursor + drains pendingSessionIds first', async () => {
    readState.mockResolvedValue({ cursor: { watermark: 'w0', activeRunCutoff: 'CUT', pageCursor: { k: 1 }, pendingSessionIds: ['s-9'] } });
    closed.mockReturnValue(true);
    materialize.mockResolvedValue({ outcome: 'emitted' });
    discover.mockResolvedValueOnce({ sessionIds: [] });                              // final page
    await rollupAnalyticsSessions({});
    expect(materialize).toHaveBeenCalledWith(expect.objectContaining({ sessionId: 's-9' }));      // backlog drained
    expect(discover).toHaveBeenCalledWith(expect.objectContaining({ cutoff: 'CUT', startKey: { k: 1 } }));
  });
  it('hits the session cap: persists pending backlog + cursor, returns hasMore, does NOT advance watermark or release', async () => {
    readState.mockResolvedValue({ cursor: { watermark: 'w0' } });
    discover.mockResolvedValueOnce({ sessionIds: ['s-1', 's-2', 's-3'], lastKey: { k: 2 } });
    closed.mockReturnValue(true);
    materialize.mockResolvedValue({ outcome: 'emitted' });
    const out = await rollupAnalyticsSessions({ maxSessions: 2 });
    expect(materialize).toHaveBeenCalledTimes(2);
    expect(releaseLeaseKeepCursor).not.toHaveBeenCalled();
    const persisted = persistPage.mock.calls.at(-1)![3].cursor as Record<string, unknown>;
    expect(persisted.pendingSessionIds).toEqual(['s-3']);
    expect(persisted.pageCursor).toEqual({ k: 2 });
    expect(persisted.watermark).toBe('w0');                                          // NOT advanced
    expect(out.summary).toMatchObject({ hasMore: true });
  });
  it('persists discoveryDone at the cap so a resumed run does not re-discover (livelock fix)', async () => {
    readState.mockResolvedValueOnce({ cursor: { watermark: 'w0' } });
    discover.mockResolvedValueOnce({ sessionIds: ['s-1', 's-2', 's-3'] });           // final page — no lastKey
    closed.mockReturnValue(true);
    materialize.mockResolvedValue({ outcome: 'emitted' });
    const run1 = await rollupAnalyticsSessions({ maxSessions: 2 });
    expect(run1.summary).toMatchObject({ hasMore: true });
    const persisted = persistPage.mock.calls.at(-1)![3].cursor as Record<string, unknown>;
    expect(persisted.discoveryDone).toBe(true);
    expect(persisted.pendingSessionIds).toEqual(['s-3']);
    // run 2 resumes from the persisted cursor: drains pending WITHOUT re-discovering, then completes.
    discover.mockClear();
    readState.mockResolvedValueOnce({ cursor: persisted });
    const run2 = await rollupAnalyticsSessions({});
    expect(discover).not.toHaveBeenCalled();
    expect(materialize).toHaveBeenCalledWith(expect.objectContaining({ sessionId: 's-3' }));
    expect(run2.summary).toMatchObject({ hasMore: false });
    expect(releaseLeaseKeepCursor).toHaveBeenCalledTimes(1);
    // watermark advances to the run's FROZEN cutoff, not a fresh now − 30min:
    expect((releaseLeaseKeepCursor.mock.calls[0][3].lastSummary as { watermark?: string }).watermark).toBe(persisted.activeRunCutoff);
  });
  it('dedupes session ids repeated across discovery pages via the seen set', async () => {
    readState.mockResolvedValue({ cursor: { watermark: 'w0' } });
    discover.mockResolvedValueOnce({ sessionIds: ['s-1', 's-2'], lastKey: { k: 1 } })
      .mockResolvedValueOnce({ sessionIds: ['s-2', 's-3'] });                        // s-2 repeated on page 2
    closed.mockReturnValue(true);
    materialize.mockResolvedValue({ outcome: 'emitted' });
    await rollupAnalyticsSessions({});
    expect(materialize).toHaveBeenCalledTimes(3);                                    // once per UNIQUE id
    const summary = releaseLeaseKeepCursor.mock.calls[0][3].lastSummary as Record<string, unknown>;
    expect(summary).toMatchObject({ discovered: 3 });                                // seen-delta count, no double-count
  });
  it('isolates a per-session materialize failure and continues', async () => {
    readState.mockResolvedValue({ cursor: { watermark: 'w0' } });
    discover.mockResolvedValueOnce({ sessionIds: ['s-1', 's-2'] });
    closed.mockReturnValue(true);
    materialize.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce({ outcome: 'emitted' });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await rollupAnalyticsSessions({});
    const summary = releaseLeaseKeepCursor.mock.calls[0][3].lastSummary as Record<string, unknown>;
    expect(summary).toMatchObject({ errors: 1, emitted: 1 });
    errSpy.mockRestore();
  });
});
