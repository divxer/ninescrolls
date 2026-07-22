import { readState, acquireLease, releaseLease, writeStateFenced } from './lib/gmailSyncState';
import { createGmailClient } from './lib/gmailClient';
import { runIncremental } from './lib/incrementalSync';
import { runBackfill } from './lib/backfill';
import { projectMessage, type ProjectOutcome } from './lib/emitMessage';
import type { MapResult } from './lib/mapMessage';

// keep in sync with gmail-sync/resource.ts's timeoutSeconds (see that file's comment for the
// lease-TTL arithmetic this depends on).
const LAMBDA_TIMEOUT_SEC = 120;
const BACKFILL_WINDOW_DAYS = 90;
const DEFAULT_MAILBOXES = 'info@ninescrolls.com';

// Both engines (runIncremental/runBackfill) already filter out kind:'skip' before calling
// ctx.project — this adapter only exists to narrow their shared MapResult param down to the
// GmailEmit shape projectMessage actually wants. The throw path is unreachable in practice.
async function projectForCtx(mapped: MapResult): Promise<ProjectOutcome> {
  if (mapped.kind !== 'emit') throw new Error('gmail-sync: project invoked with a skip result (unreachable)');
  return projectMessage(mapped.emit);
}

// One mailbox's full run: acquire lease → read state → dispatch phase → release. A THROW anywhere
// in the try (including runBackfill's transient GmailApiError, which — unlike runIncremental —
// propagates rather than returning a hasMore-retry outcome; see backfill.ts) is caught here so it
// becomes a retry-next-cron outcome for THIS mailbox only, never a crash that skips the rest of
// MAILBOXES (invariant: the per-mailbox loop in `handler` must keep going).
//
// Lease-in-catch decision (plan silent on this): attempt a best-effort releaseLease in the catch.
// A failed release there is fine — the 300s lease TTL (gmailSyncState.ts) is the backstop that lets
// the next cron fire acquire it regardless — so the release failure is swallowed, not rethrown.
async function syncMailbox(mailbox: string, nowMs: number): Promise<Record<string, unknown>> {
  const lease = await acquireLease(mailbox, LAMBDA_TIMEOUT_SEC, nowMs);
  if (!lease) return { mailbox, skippedLeaseHeld: true };

  let outcome: Record<string, unknown>;
  try {
    const state = await readState(mailbox);
    const client = await createGmailClient(mailbox);

    if (state.phase === 'incremental' && state.historyId) {
      const r = await runIncremental({
        mailbox, startHistoryId: state.historyId,
        client, project: projectForCtx,
        persistCheckpoint: (historyId: string) => writeStateFenced(mailbox, lease, Date.now(), { historyId }),
      });
      // A lost fenced write mid-run means another actor now owns this mailbox's state — invariant 2:
      // stop immediately, no further writes/Google calls, no releaseLease (our token is stale).
      if (r.aborted) {
        console.log(JSON.stringify({ event: 'gmail.sync.lease_lost', mailbox, phase: 'incremental' }));
        return { mailbox, phase: 'incremental', ...r };
      }
      if (r.needsReanchor) {
        // Next run re-seeds the anchor from scratch via runBackfill's fresh-backfill branch.
        const w = await writeStateFenced(mailbox, lease, Date.now(), {
          phase: 'backfill', anchorHistoryId: null, pageToken: null,
        });
        console.log(JSON.stringify({ event: 'gmail.sync.reanchor', mailbox }));
        if (w.lost) {
          console.log(JSON.stringify({ event: 'gmail.sync.lease_lost', mailbox, phase: 'reanchor' }));
          return { mailbox, phase: 'incremental', ...r };
        }
      }
      outcome = { mailbox, phase: 'incremental', ...r };
    } else {
      const r = await runBackfill({
        mailbox, windowDays: BACKFILL_WINDOW_DAYS, existing: state,
        client, project: projectForCtx,
        persist: (fields) => writeStateFenced(mailbox, lease, Date.now(), fields),
      });
      if (r.aborted) {
        console.log(JSON.stringify({ event: 'gmail.sync.lease_lost', mailbox, phase: 'backfill' }));
        return { mailbox, phase: 'backfill', ...r };
      }
      outcome = { mailbox, phase: 'backfill', ...r };
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(JSON.stringify({ event: 'gmail.sync.mailbox_failed', mailbox, error }));
    try {
      await releaseLease(mailbox, lease, Date.now(), { lastSummary: { status: 'error', error } });
    } catch {
      // best-effort — see the function-level comment above.
    }
    return { mailbox, status: 'error', error };
  }

  const rel = await releaseLease(mailbox, lease, Date.now(), { lastSummary: outcome });
  if (rel.lost) console.log(JSON.stringify({ event: 'gmail.sync.lease_lost', mailbox, stage: 'release' }));
  return outcome;
}

export async function handler(_event?: { action?: string }): Promise<{ results: Record<string, unknown>[] }> {
  const secretArn = process.env.GMAIL_SA_SECRET_ARN ?? '';
  const mailboxes = (process.env.MAILBOXES ?? DEFAULT_MAILBOXES).split(',').map((m) => m.trim()).filter(Boolean);
  const nowMs = Date.now();
  const results: Record<string, unknown>[] = [];

  for (const mailbox of mailboxes) {
    // Runtime guard: an inert deployment (GMAIL_SA_SECRET_ARN unset — every sandbox by default,
    // per backend.ts's gmailSyncEnabled gate) must report itself and touch NOTHING — no lease,
    // no DynamoDB, no Google — never crash-loop.
    if (!secretArn) {
      results.push({ mailbox, status: 'not_configured' });
      continue;
    }
    results.push(await syncMailbox(mailbox, nowMs));
  }

  console.log(JSON.stringify({ event: 'gmail.sync.summary', results }));
  return { results };
}
