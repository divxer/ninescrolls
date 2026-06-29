import type { AnalyticsEvent, PageViewFlushInfo } from './types';

/**
 * Select the best flush for a pageViewId using "final-preferred, MAX fallback":
 * 1. If any isFinal=true flush exists, take the one with the highest activeSeconds.
 * 2. Otherwise fall back to the flush with the highest activeSeconds (partial).
 *
 * This prevents a late-arriving partial from overriding a proper final flush.
 */
export function selectBestFlush(
  existing: PageViewFlushInfo | undefined,
  candidate: { activeSeconds: number; isFinal: boolean },
): PageViewFlushInfo {
  if (!existing) return { activeSeconds: candidate.activeSeconds, isFinal: candidate.isFinal };

  // Final always beats non-final; among same finality, take MAX
  if (candidate.isFinal && !existing.isFinal) return { activeSeconds: candidate.activeSeconds, isFinal: true };
  if (!candidate.isFinal && existing.isFinal) return existing;
  // Same finality — take higher activeSeconds
  if (candidate.activeSeconds > existing.activeSeconds) return { activeSeconds: candidate.activeSeconds, isFinal: candidate.isFinal };
  return existing;
}

/**
 * Compute per-page duration from page_time_flush events (authoritative)
 * with fallback to legacy cumulative timeOnSite deltas.
 *
 * Flush events report cumulative active time per pageViewId.
 * Selection: final-preferred, MAX fallback (see selectBestFlush).
 */
export function computePerPageDuration(events: AnalyticsEvent[]): Map<string, number> {
  const result = new Map<string, number>();

  // 1. Authoritative: group flush events by pageViewId, select best
  const flushEvents = events.filter(
    (e) => e.eventType === 'page_time_flush' && e.activeSeconds != null && e.activeSeconds > 0
  );

  if (flushEvents.length > 0) {
    const pvBest = new Map<string, { seconds: number; pathname: string; isFinal: boolean }>();
    for (const flush of flushEvents) {
      const pvId = (flush as Record<string, unknown>).pageViewId as string || flush.id;
      const isFinal = !!((flush as Record<string, unknown>).isFinal);
      const existing = pvBest.get(pvId);
      const existingFlush = existing ? { activeSeconds: existing.seconds, isFinal: existing.isFinal } : undefined;
      const best = selectBestFlush(existingFlush, { activeSeconds: flush.activeSeconds!, isFinal });
      pvBest.set(pvId, { seconds: best.activeSeconds, pathname: flush.pathname || '', isFinal: best.isFinal });
    }

    // Map each pageViewId's best time to a corresponding page_view event
    const pageViews = events
      .filter((e) => e.eventType === 'page_view')
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const usedPageViews = new Set<string>();
    for (const [, { seconds, pathname }] of pvBest) {
      let attached = false;
      for (const pv of pageViews) {
        if (pv.pathname === pathname && !usedPageViews.has(pv.id)) {
          result.set(pv.id, seconds);
          usedPageViews.add(pv.id);
          attached = true;
          break;
        }
      }
      if (!attached) {
        result.set(`flush-${pathname}-${seconds}`, seconds);
      }
    }
  }

  // 2. Legacy fallback: compute deltas from cumulative timeOnSite
  const legacySorted = [...events]
    .filter((e) => e.eventType !== 'page_time_flush' && e.timeOnSite != null && e.timeOnSite > 0)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  let prevCumulative = 0;
  for (const e of legacySorted) {
    if (result.has(e.id)) continue;
    const cumulative = e.timeOnSite!;
    const delta = cumulative >= prevCumulative ? cumulative - prevCumulative : cumulative;
    if (delta > 0) result.set(e.id, delta);
    prevCumulative = cumulative;
  }

  return result;
}
