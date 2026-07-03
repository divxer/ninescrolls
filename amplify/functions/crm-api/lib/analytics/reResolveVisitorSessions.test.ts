import { describe, it, expect, vi, beforeEach } from 'vitest';
const listMarkersMock = vi.fn(); const readRetro = vi.fn(); const writeRetro = vi.fn(); const clearRetro = vi.fn();
vi.mock('./sessionMarkers', () => ({
  listMarkers: (...a: unknown[]) => listMarkersMock(...a), readRetroState: (v: string) => readRetro(v),
  writeRetroState: (...a: unknown[]) => writeRetro(...a), clearRetroState: (v: string) => clearRetro(v),
}));
const materialize = vi.fn();
vi.mock('./materializeSession', () => ({ materializeSession: (o: unknown) => materialize(o) }));
import { reResolveVisitorSessions } from './reResolveVisitorSessions';
beforeEach(() => { [listMarkersMock, readRetro, writeRetro, clearRetro, materialize].forEach((m) => m.mockReset()); readRetro.mockResolvedValue(null); });

const M = (sid: string, status: string) => ({ sessionId: sid, resolutionStatus: status, resolvedOrgId: null, emittedAt: 'x' });

describe('reResolveVisitorSessions', () => {
  it('re-materializes ONLY unresolved markers with forceReemit', async () => {
    listMarkersMock.mockResolvedValueOnce({ markers: [M('s-1', 'unresolved'), M('s-2', 'resolved'), M('s-3', 'below_threshold')] });
    materialize.mockResolvedValue({ outcome: 'emitted', resolvedOrgId: 'lab.edu' });
    const out = await reResolveVisitorSessions({ visitorId: 'v-1' });
    expect(materialize).toHaveBeenCalledTimes(1);
    expect(materialize).toHaveBeenCalledWith(expect.objectContaining({ sessionId: 's-1', forceReemit: true }));
    expect(out.summary).toMatchObject({ examined: 3, reemitted: 1 });
    expect(clearRetro).toHaveBeenCalledWith('v-1');   // finished clean → no stale resume state
  });
  it('persists RETRO#STATE when the marker query has more pages than the cap allows', async () => {
    listMarkersMock.mockResolvedValueOnce({ markers: [M('s-1', 'unresolved'), M('s-2', 'unresolved')], lastKey: { PK: 'VISITOR#v-1', SK: 'SESSION#s-2' } });
    materialize.mockResolvedValue({ outcome: 'emitted' });
    const out = await reResolveVisitorSessions({ visitorId: 'v-1', maxSessions: 2 });
    expect(writeRetro).toHaveBeenCalledWith('v-1', { cursor: { PK: 'VISITOR#v-1', SK: 'SESSION#s-2' } });
    expect(out.summary).toMatchObject({ hasMore: true });
  });
  it('when maxSessions is smaller than a page, queries only the remaining allowance and resumes after the last processed marker', async () => {
    listMarkersMock.mockResolvedValueOnce({ markers: [M('s-1', 'unresolved')], lastKey: { PK: 'VISITOR#v-1', SK: 'SESSION#s-1' } });
    materialize.mockResolvedValue({ outcome: 'emitted' });
    const out = await reResolveVisitorSessions({ visitorId: 'v-1', maxSessions: 1 });
    expect(listMarkersMock).toHaveBeenCalledWith('v-1', expect.objectContaining({ limit: 1 }));
    expect(writeRetro).toHaveBeenCalledWith('v-1', { cursor: { PK: 'VISITOR#v-1', SK: 'SESSION#s-1' } });
    expect(out.summary).toMatchObject({ hasMore: true });
  });
  it('resumes from persisted RETRO#STATE', async () => {
    readRetro.mockResolvedValueOnce({ cursor: { PK: 'VISITOR#v-1', SK: 'SESSION#s-5' } });
    listMarkersMock.mockResolvedValueOnce({ markers: [] });
    await reResolveVisitorSessions({ visitorId: 'v-1' });
    expect(listMarkersMock).toHaveBeenCalledWith('v-1', expect.objectContaining({ startKey: { PK: 'VISITOR#v-1', SK: 'SESSION#s-5' } }));
  });
  it('guards a blank visitorId (no-op)', async () => {
    const out = await reResolveVisitorSessions({ visitorId: '' });
    expect(out.summary).toMatchObject({ skipped: true });
    expect(listMarkersMock).not.toHaveBeenCalled();
  });
  it('skipped markers do not consume the cap; paging continues under the cap with a shrunken limit', async () => {
    listMarkersMock
      .mockResolvedValueOnce({ markers: [M('s-1', 'resolved'), M('s-2', 'unresolved')], lastKey: { PK: 'VISITOR#v-1', SK: 'SESSION#s-2' } })
      .mockResolvedValueOnce({ markers: [M('s-3', 'unresolved')] });
    materialize.mockResolvedValue({ outcome: 'emitted' });
    const out = await reResolveVisitorSessions({ visitorId: 'v-1', maxSessions: 2 });
    expect(materialize).toHaveBeenCalledTimes(2);   // s-1 (resolved) must NOT have eaten allowance
    expect(listMarkersMock).toHaveBeenNthCalledWith(2, 'v-1', expect.objectContaining({ limit: 1, startKey: { PK: 'VISITOR#v-1', SK: 'SESSION#s-2' } }));
    expect(writeRetro).not.toHaveBeenCalled();      // cap met exactly on the final page → clean completion
    expect(out.summary).toMatchObject({ examined: 3, reemitted: 2, hasMore: false });
    expect(clearRetro).toHaveBeenCalledWith('v-1');
  });
  it('persists failed retro sessions for a later retry instead of clearing RETRO#STATE', async () => {
    listMarkersMock.mockResolvedValueOnce({ markers: [M('s-1', 'unresolved'), M('s-2', 'unresolved')] });
    materialize.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce({ outcome: 'emitted' });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const out = await reResolveVisitorSessions({ visitorId: 'v-1' });
    expect(out.summary).toMatchObject({ errors: 1, reemitted: 1, hasMore: true });
    expect(writeRetro).toHaveBeenCalledWith('v-1', { retrySessionIds: ['s-1'] });
    expect(clearRetro).not.toHaveBeenCalled();
    errSpy.mockRestore();
  });
  it('retries persisted failed retro sessions before scanning marker pages', async () => {
    readRetro.mockResolvedValueOnce({ retrySessionIds: ['s-1'] });
    listMarkersMock.mockResolvedValueOnce({ markers: [] });
    materialize.mockResolvedValueOnce({ outcome: 'emitted', resolvedOrgId: 'lab.edu' });
    const out = await reResolveVisitorSessions({ visitorId: 'v-1' });
    expect(materialize).toHaveBeenCalledWith(expect.objectContaining({ sessionId: 's-1', forceReemit: true }));
    expect(listMarkersMock).toHaveBeenCalledWith('v-1', expect.objectContaining({ startKey: undefined }));
    expect(out.summary).toMatchObject({ reemitted: 1, hasMore: false });
    expect(clearRetro).toHaveBeenCalledWith('v-1');
  });
  it('keeps failed retrySessionIds durable if a retry fails again', async () => {
    readRetro.mockResolvedValueOnce({ retrySessionIds: ['s-1'], cursor: { PK: 'VISITOR#v-1', SK: 'SESSION#s-9' } });
    materialize.mockRejectedValueOnce(new Error('boom'));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const out = await reResolveVisitorSessions({ visitorId: 'v-1' });
    expect(out.summary).toMatchObject({ errors: 1, hasMore: true });
    expect(writeRetro).toHaveBeenCalledWith('v-1', { cursor: { PK: 'VISITOR#v-1', SK: 'SESSION#s-9' }, retrySessionIds: ['s-1'] });
    expect(listMarkersMock).not.toHaveBeenCalled();
    expect(clearRetro).not.toHaveBeenCalled();
    errSpy.mockRestore();
  });
});
