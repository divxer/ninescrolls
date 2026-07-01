import { describe, it, expect, vi, beforeEach } from 'vitest';
const acquireLease = vi.fn(); const persistPage = vi.fn(); const releaseLease = vi.fn(); const readState = vi.fn();
vi.mock('./sweepState', () => ({
  acquireLease: (...a: unknown[]) => acquireLease(...a),
  persistPage: (...a: unknown[]) => persistPage(...a),
  releaseLease: (...a: unknown[]) => releaseLease(...a),
  readState: (...a: unknown[]) => readState(...a),
  stateKey: () => ({}),
}));
const runExistencePage = vi.fn(); const runDirtyRollupPage = vi.fn();
vi.mock('./existencePass', () => ({ runExistencePage: (o: unknown) => runExistencePage(o) }));
vi.mock('./dirtyRollupPass', () => ({ runDirtyRollupPage: (o: unknown) => runDirtyRollupPage(o) }));
import { reconcileSweep } from './reconcileSweep';
beforeEach(() => { acquireLease.mockReset(); persistPage.mockReset(); releaseLease.mockReset(); readState.mockReset(); runExistencePage.mockReset(); runDirtyRollupPage.mockReset(); readState.mockResolvedValue({}); acquireLease.mockResolvedValue('tok'); });

describe('reconcileSweep', () => {
  it('hot mode runs ONLY the existence pass', async () => {
    runExistencePage.mockResolvedValueOnce({ counters: { scanned: 3, missingReemitted: 1, errors: 0 }, hasMore: false });
    const out = await reconcileSweep({ mode: 'hot', limit: 100 });
    expect(runExistencePage).toHaveBeenCalledWith(expect.objectContaining({ mode: 'hot' }));
    expect(runDirtyRollupPage).not.toHaveBeenCalled();
    expect(releaseLease).toHaveBeenCalled();
    expect(out.summary.existence).toMatchObject({ missingReemitted: 1 });
  });
  it('cold mode runs existence AND dirty-rollup passes', async () => {
    runExistencePage.mockResolvedValueOnce({ counters: { scanned: 5, missingReemitted: 0, errors: 0 }, hasMore: false });
    runDirtyRollupPage.mockResolvedValueOnce({ counters: { dirtyFound: 2, repaired: 2, errors: 0 }, hasMore: false });
    const out = await reconcileSweep({ mode: 'cold', limit: 100 });
    expect(runExistencePage).toHaveBeenCalled();
    expect(runDirtyRollupPage).toHaveBeenCalled();
    expect(out.summary.dirty).toMatchObject({ repaired: 2 });
  });
  it('skips a pass whose lease is already held', async () => {
    acquireLease.mockResolvedValueOnce(null); // existence lease held
    await reconcileSweep({ mode: 'hot', limit: 100 });
    expect(runExistencePage).not.toHaveBeenCalled();
  });
  it('isolates a whole-pass failure (logs pass_failed) and still runs the cold dirty-rollup pass', async () => {
    runExistencePage.mockRejectedValueOnce(new Error('scan boom'));
    runDirtyRollupPage.mockResolvedValueOnce({ counters: { dirtyFound: 1, repaired: 1, errors: 0 }, hasMore: false });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const out = await reconcileSweep({ mode: 'cold', limit: 100 });
    expect(out.summary.existence).toMatchObject({ failed: true });
    expect(runDirtyRollupPage).toHaveBeenCalled();          // existence failure did NOT block dirty-rollup
    expect(out.summary.dirty).toMatchObject({ repaired: 1 });
    expect(releaseLease).toHaveBeenCalledTimes(1);           // only dirty released; the failed existence pass left its lease to expire
    errSpy.mockRestore();
  });
  it('loops multiple pages: accumulates counters, persists each non-final page, releases once at the end', async () => {
    runExistencePage
      .mockResolvedValueOnce({ counters: { scanned: 2, missingReemitted: 1, errors: 0 }, cursor: { channel: 'lead' }, hasMore: true })
      .mockResolvedValueOnce({ counters: { scanned: 3, missingReemitted: 0, errors: 0 }, cursor: { channel: 'order' }, hasMore: true })
      .mockResolvedValueOnce({ counters: { scanned: 1, missingReemitted: 1, errors: 0 }, hasMore: false });
    const out = await reconcileSweep({ mode: 'hot', limit: 100 });
    expect(runExistencePage).toHaveBeenCalledTimes(3);
    expect(persistPage).toHaveBeenCalledTimes(2);            // the two non-final pages persist mid-pass
    expect(releaseLease).toHaveBeenCalledTimes(1);           // released once, on the final page
    // counters accumulate across all three pages
    expect(out.summary.existence).toMatchObject({ scanned: 6, missingReemitted: 2, errors: 0 });
    // each persistPage carries the lease token (3rd arg) + the CUMULATIVE counters so far
    expect(persistPage.mock.calls[0][2]).toBe('tok');
    expect(persistPage.mock.calls[0][3]).toMatchObject({ hasMore: true, counters: { scanned: 2 } });
    expect(persistPage.mock.calls[1][3]).toMatchObject({ counters: { scanned: 5 } }); // 2 + 3
  });
});
