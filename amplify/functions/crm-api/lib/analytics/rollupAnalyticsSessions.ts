import { readState, acquireLease, persistPage, releaseLeaseKeepCursor } from '../sweep/sweepState';
import { discoverFlushPage, isSessionClosed, loadSessionFlushes, computeCutoff } from './sessionWindow';
import { materializeSession } from './materializeSession';

const LAMBDA_TIMEOUT_SEC = 120;                       // keep in sync with crm-api/resource.ts
const LEASE_MS = Math.max(2 * LAMBDA_TIMEOUT_SEC, 300) * 1000;
const DEFAULT_MAX_SESSIONS = 200;                     // per-invocation safety cap
const MAX_DISCOVERY_PAGES = 50;

// Rollup run state — lives inside SweepState.cursor (spec §3 state shape).
type RollupCursor = {
  watermark?: string;                                  // last COMPLETED run's frozen cutoff
  activeRunCutoff?: string | null;                     // frozen window end for an in-flight run
  pageCursor?: Record<string, unknown> | null;         // discovery GSI LastEvaluatedKey
  pendingSessionIds?: string[];                        // discovered-but-unprocessed backlog
  discoveryDone?: boolean;                             // discovery finished for the active run — a capped resume must not re-scan from page 0
};
export interface RollupArgs { limit?: number; maxSessions?: number; cursor?: Record<string, unknown>; }

export async function rollupAnalyticsSessions(args: RollupArgs): Promise<{ summary: Record<string, unknown> }> {
  // Counters are per-invocation; a resumed run reports only its own slice.
  const counters: Record<string, number> = { discovered: 0, closed: 0, emitted: 0, belowThreshold: 0, skipped: 0, skippedBots: 0, bridgeResolved: 0, priorResolved: 0, unresolved: 0, errors: 0 };
  try {
    const nowIso = new Date().toISOString();
    const lease = await acquireLease('analytics', 'sessions', LAMBDA_TIMEOUT_SEC, nowIso);
    if (!lease) return { summary: { skipped: true } };
    const state = await readState('analytics', 'sessions');
    const cur: RollupCursor = { ...(state.cursor as RollupCursor | undefined), ...(args.cursor as RollupCursor | undefined) };
    // Freeze the window: an in-flight run keeps its cutoff; a fresh run pins cutoff = now − 30min.
    const resumed = cur.activeRunCutoff != null;
    const cutoff = cur.activeRunCutoff ?? computeCutoff(nowIso);
    const watermark = cur.watermark ?? cutoff;         // go-live: forward-only from first cron fire
    let pageCursor = cur.pageCursor ?? undefined;
    const pending = [...(cur.pendingSessionIds ?? [])];   // mutated in place (shift/push), never reassigned
    const maxSessions = args.maxSessions ?? DEFAULT_MAX_SESSIONS;
    const seen = new Set<string>(pending);
    let processed = 0;
    let discoveryDone = cur.discoveryDone === true;

    const persist = async (hasMore: boolean) => {
      const cursor: RollupCursor = hasMore
        ? { watermark, activeRunCutoff: cutoff, pageCursor: pageCursor ?? null, pendingSessionIds: pending, discoveryDone }
        : { watermark: cutoff, activeRunCutoff: null, pageCursor: null, pendingSessionIds: [] };
      const leaseExpiresAt = new Date(Date.now() + LEASE_MS).toISOString();
      await persistPage('analytics', 'sessions', lease, { cursor: cursor as Record<string, unknown>, hasMore, counters: { ...counters }, leaseExpiresAt });
    };

    const processOne = async (sessionId: string): Promise<void> => {
      try {
        const flushes = await loadSessionFlushes(sessionId);
        if (!isSessionClosed(flushes, nowIso)) return;               // still open — later flushes rediscover it
        counters.closed += 1;
        const r = await materializeSession({ sessionId, nowIso });
        if (r.outcome === 'emitted') counters.emitted += 1;
        else if (r.outcome === 'below_threshold') counters.belowThreshold += 1;
        else if (r.outcome === 'skipped') counters.skipped += 1;
        if (r.outcome === 'emitted') {
          if (r.resolutionSource === 'bridge') counters.bridgeResolved += 1;
          else if (r.resolutionSource === 'prior') counters.priorResolved += 1;
          else counters.unresolved += 1;
        }
      } catch (err) {
        counters.errors += 1;
        console.error(JSON.stringify({ event: 'crm.analytics.rollup.session_error', sessionId, error: err instanceof Error ? err.message : String(err) }));
      }
    };

    for (let page = 0; page < MAX_DISCOVERY_PAGES; page++) {
      // Drain the backlog BEFORE reading the next discovery page (spec §3.1).
      while (pending.length > 0) {
        if (processed >= maxSessions) { await persist(true); return { summary: { ...counters, hasMore: true } }; }
        const sid = pending.shift()!;
        processed += 1;
        await processOne(sid);
      }
      if (discoveryDone) break;
      const { sessionIds, skippedBots, lastKey } = await discoverFlushPage({ watermark, cutoff, startKey: pageCursor, limit: args.limit });
      const seenBefore = seen.size;
      for (const sid of sessionIds) if (!seen.has(sid)) { seen.add(sid); pending.push(sid); }
      counters.discovered += seen.size - seenBefore;                  // seen-set delta — ids repeated across pages count once
      counters.skippedBots += skippedBots ?? 0;
      pageCursor = lastKey;
      if (!lastKey) discoveryDone = true;
      await persist(true);                                            // durable progress each page
    }

    if (pending.length > 0 || !discoveryDone) {                       // page budget exhausted mid-run
      await persist(true);
      console.log(JSON.stringify({ event: 'crm.analytics.rollup.summary', resumed, ...counters, hasMore: true }));
      return { summary: { ...counters, hasMore: true } };
    }

    // Complete: advance the watermark to the frozen cutoff, clear active run fields, and release only
    // the lease fields. Unlike sweep passes, analytics must preserve the durable watermark between runs.
    await persist(false);
    await releaseLeaseKeepCursor('analytics', 'sessions', lease, { lastSummary: { ...counters, watermark: cutoff } });
    console.log(JSON.stringify({ event: 'crm.analytics.rollup.summary', resumed, ...counters, hasMore: false }));
    return { summary: { ...counters, hasMore: false } };
  } catch (err) {
    console.error(JSON.stringify({ event: 'crm.analytics.rollup.failed', error: err instanceof Error ? err.message : String(err) }));
    return { summary: { failed: true, error: err instanceof Error ? err.message : String(err), ...counters } };
  }
}
