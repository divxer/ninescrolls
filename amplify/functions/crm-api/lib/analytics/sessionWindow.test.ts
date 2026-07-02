import { describe, it, expect, vi, beforeEach } from 'vitest';
const mockSend = vi.fn();
vi.mock('../dynamodb', () => ({ docClient: { send: (...a: unknown[]) => mockSend(...a) }, TABLE_NAME: () => 'T' }));
import { discoverFlushPage, loadSessionFlushes, isSessionClosed, computeCutoff } from './sessionWindow';
beforeEach(() => { mockSend.mockReset(); process.env.ANALYTICS_EVENT_TABLE = 'ANALYTICS'; });

describe('sessionWindow', () => {
  it('computeCutoff = now − 30min (ISO)', () => {
    expect(computeCutoff('2026-07-01T01:00:00.000Z')).toBe('2026-07-01T00:30:00.000Z');
  });
  it('discoverFlushPage queries the eventType GSI over (watermark−overlap, cutoff], skipping bots + sessionless rows', async () => {
    mockSend.mockResolvedValueOnce({ Items: [
      { sessionId: 's-1', isBot: false }, { sessionId: 's-1', isBot: false },
      { sessionId: 's-bot', isBot: true }, { pathname: '/x' } ] });
    const out = await discoverFlushPage({ watermark: '2026-07-01T00:00:00.000Z', cutoff: '2026-07-01T00:30:00.000Z' });
    const q = mockSend.mock.calls[0][0].input;
    expect(q.TableName).toBe('ANALYTICS');
    expect(q.IndexName).toBe('analyticsEventsByEventTypeAndTimestamp');
    expect(q.ExpressionAttributeValues[':et']).toBe('page_time_flush');
    expect(q.ExpressionAttributeValues[':from']).toBe('2026-06-30T23:50:00.000Z'); // watermark − 10min overlap
    expect(q.ExpressionAttributeValues[':to']).toBe('2026-07-01T00:30:00.000Z');
    expect(out.sessionIds).toEqual(['s-1']);
    expect(out.skippedBots).toBe(1);
  });
  it('discoverFlushPage forwards + returns the page cursor', async () => {
    mockSend.mockResolvedValueOnce({ Items: [], LastEvaluatedKey: { k: 1 } });
    // Valid ISO dummies (the impl date-parses the watermark to apply the overlap; non-date strings throw).
    const out = await discoverFlushPage({ watermark: '2026-07-01T00:00:00.000Z', cutoff: '2026-07-01T00:30:00.000Z', startKey: { k: 0 } });
    expect(mockSend.mock.calls[0][0].input.ExclusiveStartKey).toEqual({ k: 0 });
    expect(out.lastKey).toEqual({ k: 1 });
  });
  it('loadSessionFlushes pages the sessionId GSI to completion', async () => {
    mockSend.mockResolvedValueOnce({ Items: [{ sessionId: 's-1', timestamp: 't1' }], LastEvaluatedKey: { k: 1 } });
    mockSend.mockResolvedValueOnce({ Items: [{ sessionId: 's-1', timestamp: 't2' }] });
    const flushes = await loadSessionFlushes('s-1');
    expect(mockSend.mock.calls[0][0].input.IndexName).toBe('analyticsEventsBySessionIdAndTimestamp');
    expect(mockSend.mock.calls[1][0].input.ExclusiveStartKey).toEqual({ k: 1 });
    expect(flushes).toHaveLength(2);
  });
  it('isSessionClosed: empty flushes → false (open, never falsely closed)', () => {
    expect(isSessionClosed([], '2026-07-01T00:55:00.000Z')).toBe(false);
  });
  it('isSessionClosed: last flush ≤ now−30min → closed', () => {
    const f = (ts: string) => ({ timestamp: ts } as never);
    expect(isSessionClosed([f('2026-07-01T00:00:00Z'), f('2026-07-01T00:20:00Z')], '2026-07-01T00:55:00.000Z')).toBe(true);
    expect(isSessionClosed([f('2026-07-01T00:40:00Z')], '2026-07-01T00:55:00.000Z')).toBe(false);
  });
});
