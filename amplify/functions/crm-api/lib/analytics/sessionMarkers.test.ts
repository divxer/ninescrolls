import { describe, it, expect, vi, beforeEach } from 'vitest';
const mockSend = vi.fn();
vi.mock('../dynamodb', () => ({ docClient: { send: (...a: unknown[]) => mockSend(...a) }, TABLE_NAME: () => 'T' }));
import { readMarker, writeMarker, listMarkers, readRetroState, writeRetroState, clearRetroState, type SessionMarker } from './sessionMarkers';
beforeEach(() => mockSend.mockReset());

const MARKER: SessionMarker = {
  sessionId: 's-1', timelineEventId: 'tev-analytics-session-s-1', occurredAt: '2026-07-01T00:00:00Z',
  resolutionStatus: 'unresolved', resolvedOrgId: null,
  lastFlushTs: '2026-07-01T00:10:00Z', flushCount: 3, inputHash: 'abc', emittedAt: '2026-07-01T01:00:00Z',
};

describe('sessionMarkers', () => {
  it('writeMarker keys VISITOR#<vid>/SESSION#<sid> and stores the full marker', async () => {
    mockSend.mockResolvedValueOnce({});
    await writeMarker('v-1', MARKER);
    const put = mockSend.mock.calls[0][0].input;
    expect(put.Item).toMatchObject({ PK: 'VISITOR#v-1', SK: 'SESSION#s-1', inputHash: 'abc', timelineEventId: 'tev-analytics-session-s-1' });
  });
  it('readMarker returns the marker or null', async () => {
    mockSend.mockResolvedValueOnce({ Item: { ...MARKER, PK: 'VISITOR#v-1', SK: 'SESSION#s-1' } });
    expect((await readMarker('v-1', 's-1'))?.inputHash).toBe('abc');
    mockSend.mockResolvedValueOnce({});
    expect(await readMarker('v-1', 's-1')).toBeNull();
  });
  it('listMarkers pages with begins_with(SESSION#) and honors startSk', async () => {
    mockSend.mockResolvedValueOnce({ Items: [{ ...MARKER, SK: 'SESSION#s-1' }], LastEvaluatedKey: { PK: 'VISITOR#v-1', SK: 'SESSION#s-1' } });
    const page = await listMarkers('v-1', { limit: 1, startKey: undefined });
    expect(mockSend.mock.calls[0][0].input.KeyConditionExpression).toContain('begins_with');
    expect(page.markers).toHaveLength(1);
    expect(page.lastKey).toEqual({ PK: 'VISITOR#v-1', SK: 'SESSION#s-1' });
  });
  it('guards blank visitorId: readMarker/writeMarker/listMarkers no-op', async () => {
    expect(await readMarker('', 's-1')).toBeNull();
    await writeMarker('', MARKER);
    expect((await listMarkers('', {})).markers).toEqual([]);
    expect(mockSend).not.toHaveBeenCalled();
  });
  it('RETRO#STATE round-trips and clears', async () => {
    mockSend.mockResolvedValueOnce({});
    await writeRetroState('v-1', { cursor: { PK: 'x' } });
    expect(mockSend.mock.calls[0][0].input.Item).toMatchObject({ PK: 'VISITOR#v-1', SK: 'RETRO#STATE' });
    mockSend.mockResolvedValueOnce({ Item: { cursor: { PK: 'x' } } });
    expect((await readRetroState('v-1'))?.cursor).toEqual({ PK: 'x' });
    mockSend.mockResolvedValueOnce({});
    await clearRetroState('v-1');
    expect(mockSend.mock.calls[2][0].input.Key).toEqual({ PK: 'VISITOR#v-1', SK: 'RETRO#STATE' });
  });
});
