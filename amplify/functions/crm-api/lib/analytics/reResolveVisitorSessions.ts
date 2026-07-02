import { listMarkers, readRetroState, writeRetroState, clearRetroState } from './sessionMarkers';
import { materializeSession } from './materializeSession';

const DEFAULT_MAX_SESSIONS = 200;   // a session ≈ one query + a few GetItems + emit — hundreds fit in 120s
const PAGE_LIMIT = 100;

// NOTE: a persisted RETRO#STATE resume cursor takes precedence over startSessionSk — an in-flight
// interrupted run always finishes before a manually-requested range starts.
export interface RetroArgs { visitorId: string; startSessionSk?: string; maxSessions?: number; }

// Spec §4: bounded to ONE visitor's markers; re-runs the shared materialize path with forceReemit
// so an unresolved session re-emits under its deterministic id now that the bridge exists.
export async function reResolveVisitorSessions(args: RetroArgs): Promise<{ summary: Record<string, unknown> }> {
  if (!args.visitorId) return { summary: { skipped: true } };
  // stillUnresolved = re-emitted but the marker stayed unresolved (e.g. email-only bridge) — the
  // churn signal for repeated retro fires over the same sessions.
  const counters: Record<string, number> = { examined: 0, reemitted: 0, errors: 0, stillUnresolved: 0 };
  const nowIso = new Date().toISOString();
  const max = args.maxSessions ?? DEFAULT_MAX_SESSIONS;
  if (max <= 0) return { summary: { skipped: true, hasMore: true } };

  const resume = await readRetroState(args.visitorId);
  if (resume?.cursor && args.startSessionSk) {
    console.log(JSON.stringify({ event: 'crm.analytics.retro.resume_overrode_start', visitorId: args.visitorId }));
  }
  let startKey: Record<string, unknown> | undefined = resume?.cursor
    ?? (args.startSessionSk ? { PK: `VISITOR#${args.visitorId}`, SK: args.startSessionSk } : undefined);

  let processed = 0;
  do {
    const remaining = max - processed;
    const { markers, lastKey } = await listMarkers(args.visitorId, { limit: Math.min(PAGE_LIMIT, remaining), startKey });
    for (const m of markers) {
      counters.examined += 1;
      if (m.resolutionStatus !== 'unresolved') continue;   // skip resolved + below_threshold (spec §4)
      processed += 1;
      try {
        const r = await materializeSession({ sessionId: m.sessionId, nowIso, forceReemit: true });
        if (r.outcome === 'emitted') {
          counters.reemitted += 1;
          if (!r.resolvedOrgId) counters.stillUnresolved += 1;
        }
      } catch (err) {
        counters.errors += 1;
        console.error(JSON.stringify({ event: 'crm.analytics.retro.session_error', sessionId: m.sessionId, error: err instanceof Error ? err.message : String(err) }));
      }
    }
    if (lastKey && processed >= max) {
      await writeRetroState(args.visitorId, { cursor: lastKey });
      console.warn(JSON.stringify({ event: 'crm.analytics.retro.truncated', visitorId: args.visitorId }));
      return { summary: { ...counters, hasMore: true } };
    }
    startKey = lastKey;
  } while (startKey);

  await clearRetroState(args.visitorId);
  console.log(JSON.stringify({ event: 'crm.analytics.retro.summary', visitorId: args.visitorId, ...counters }));
  return { summary: { ...counters, hasMore: false } };
}
