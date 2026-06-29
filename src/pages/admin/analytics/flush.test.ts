import { describe, it, expect } from 'vitest';
import { selectBestFlush, computePerPageDuration } from './flush';
import type { AnalyticsEvent } from './types';

const ev = (p: Record<string, unknown>): AnalyticsEvent =>
  ({ id: 'e', timestamp: '2026-01-01T00:00:00.000Z', ...p } as unknown as AnalyticsEvent);

describe('selectBestFlush', () => {
  it('returns the candidate when there is no existing flush', () => {
    expect(selectBestFlush(undefined, { activeSeconds: 5, isFinal: false }))
      .toEqual({ activeSeconds: 5, isFinal: false });
  });

  it('prefers a final flush over a higher non-final one', () => {
    const existing = { activeSeconds: 100, isFinal: false };
    expect(selectBestFlush(existing, { activeSeconds: 10, isFinal: true }))
      .toEqual({ activeSeconds: 10, isFinal: true });
  });

  it('does not let a late non-final override an existing final', () => {
    const existing = { activeSeconds: 10, isFinal: true };
    expect(selectBestFlush(existing, { activeSeconds: 999, isFinal: false }))
      .toEqual(existing);
  });

  it('takes the max among flushes of the same finality', () => {
    expect(selectBestFlush({ activeSeconds: 10, isFinal: true }, { activeSeconds: 20, isFinal: true }))
      .toEqual({ activeSeconds: 20, isFinal: true });
    expect(selectBestFlush({ activeSeconds: 30, isFinal: false }, { activeSeconds: 20, isFinal: false }))
      .toEqual({ activeSeconds: 30, isFinal: false });
  });
});

describe('computePerPageDuration', () => {
  it('attaches the best flush per pageViewId to a matching page_view', () => {
    const events = [
      ev({ id: 'pv1', eventType: 'page_view', pathname: '/a', timestamp: '2026-01-01T00:00:00Z' }),
      ev({ eventType: 'page_time_flush', pageViewId: 'x', pathname: '/a', activeSeconds: 12, isFinal: false }),
      ev({ eventType: 'page_time_flush', pageViewId: 'x', pathname: '/a', activeSeconds: 30, isFinal: true }),
    ];
    const result = computePerPageDuration(events);
    expect(result.get('pv1')).toBe(30); // final flush wins
  });

  it('falls back to cumulative timeOnSite deltas when no flushes exist', () => {
    const events = [
      ev({ id: 'a', eventType: 'page_view', timeOnSite: 10, timestamp: '2026-01-01T00:00:01Z' }),
      ev({ id: 'b', eventType: 'page_view', timeOnSite: 25, timestamp: '2026-01-01T00:00:02Z' }),
    ];
    const result = computePerPageDuration(events);
    expect(result.get('a')).toBe(10);
    expect(result.get('b')).toBe(15); // 25 - 10 delta
  });
});
