import { readState, acquireLease, persistPage, releaseLease, type SweepMode, type SweepPass } from './sweepState';
import { runExistencePage } from './existencePass';
import { runDirtyRollupPage } from './dirtyRollupPass';

const LAMBDA_TIMEOUT_SEC = 120; // keep in sync with crm-api/resource.ts
const HOT_CUTOFF_MS = 24 * 60 * 60 * 1000;
const MAX_PAGES_PER_INVOCATION = 50; // safety bound within the 120s timeout

const LEASE_MS = Math.max(2 * LAMBDA_TIMEOUT_SEC, 300) * 1000; // longer than any single invocation

export interface SweepArgs { mode: SweepMode; limit?: number; cursor?: Record<string, unknown>; }
type PageResult = { counters: Record<string, number>; cursor?: unknown; hasMore: boolean };
// `hasMore` distinguishes a COMPLETED pass (false — released the lease) from one that exited on the
// page budget (true — cursor persisted, resumes next fire). Surfaced in `crm.sweep.summary` so Plan 3
// health can alarm on a cold pass that never completes within one fire.
type PassSummary = { counters: Record<string, number>; hasMore: boolean } | { skipped: true } | { failed: true; error: string };

// Run a pass under its own lease, LOOPING pages and PERSISTING AFTER EACH page (cursor + counters +
// a freshly-computed lease heartbeat); release on completion. Every state write carries the lease
// token, so a stale invocation can't corrupt a pass another fire now owns. A WHOLE-PASS throw
// (scan/query/state error, or a lost-lease conditional failure) is CAUGHT here: it is logged as
// `crm.sweep.pass_failed`, the lease is left to expire (NOT released), and a failed summary is
// returned — so the caller's other pass still runs and the next fire resumes from the persisted
// cursor. An admin override cursor is honored.
async function runPass(mode: SweepMode, pass: SweepPass, overrideCursor: unknown, runner: (cursor: unknown) => Promise<PageResult>): Promise<PassSummary> {
  try {
    const lease = await acquireLease(mode, pass, LAMBDA_TIMEOUT_SEC, new Date().toISOString());
    if (!lease) return { skipped: true };
    const state = await readState(mode, pass);
    let cursor: unknown = overrideCursor ?? state.cursor;
    const total: Record<string, number> = {};
    for (let page = 0; page < MAX_PAGES_PER_INVOCATION; page++) {
      const { counters, cursor: next, hasMore } = await runner(cursor);
      for (const [k, v] of Object.entries(counters)) total[k] = (total[k] ?? 0) + v;
      cursor = next;
      if (!hasMore) { await releaseLease(mode, pass, lease, { lastSummary: total }); return { counters: total, hasMore: false }; }
      const leaseExpiresAt = new Date(Date.now() + LEASE_MS).toISOString(); // per-page heartbeat
      // Persist a SNAPSHOT copy of the running total — `total` keeps mutating on later pages, so
      // passing it by reference would risk a slow marshal capturing a newer value than this page.
      await persistPage(mode, pass, lease, { cursor: next as Record<string, unknown> | undefined, hasMore: true, counters: { ...total }, leaseExpiresAt });
    }
    return { counters: total, hasMore: true }; // hit the page budget; cursor persisted + lease expires → next fire resumes
  } catch (err) {
    console.error(JSON.stringify({ event: 'crm.sweep.pass_failed', mode, pass, error: err instanceof Error ? err.message : String(err) }));
    return { failed: true, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function reconcileSweep(args: SweepArgs): Promise<{ mode: SweepMode; summary: Record<string, unknown> }> {
  const limit = args.limit ?? 100;
  const cutoffIso = new Date(Date.now() - HOT_CUTOFF_MS).toISOString();
  const summary: Record<string, unknown> = {};

  // runPass never throws — it catches its own pass failure — so the cold dirty-rollup pass runs
  // independently of the existence pass's outcome.
  summary.existence = await runPass(args.mode, 'existence', args.cursor, async (cursor) => {
    const r = await runExistencePage({ mode: args.mode, limit, cursor: cursor as never, cutoffIso: args.mode === 'hot' ? cutoffIso : undefined });
    return { counters: { ...r.counters }, cursor: r.cursor, hasMore: r.hasMore };
  });

  if (args.mode === 'cold') {
    summary.dirty = await runPass('cold', 'dirty-rollups', undefined, async (cursor) => {
      const r = await runDirtyRollupPage({ limit, cursor: cursor as never });
      return { counters: { ...r.counters }, cursor: r.cursor, hasMore: r.hasMore };
    });
  }

  // Operational telemetry, not an error — info-level.
  console.log(JSON.stringify({ event: 'crm.sweep.summary', mode: args.mode, summary }));
  return { mode: args.mode, summary };
}
