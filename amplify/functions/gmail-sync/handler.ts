import { readState, acquireLease, releaseLease, writeStateFenced, type GmailSyncState } from './lib/gmailSyncState';
import { createGmailClient } from './lib/gmailClient';
import { runIncremental } from './lib/incrementalSync';
import { runBackfill } from './lib/backfill';
import { projectMessage, sanitizeDiagnostic, type ProjectOutcome } from './lib/emitMessage';
import type { MapResult } from './lib/mapMessage';

// keep in sync with gmail-sync/resource.ts's timeoutSeconds (see that file's comment for the
// lease-TTL arithmetic this depends on).
const LAMBDA_TIMEOUT_SEC = 120;
const BACKFILL_WINDOW_DAYS = 90;
const DEFAULT_MAILBOXES = 'info@ninescrolls.com';
// Runbook "Poison-mailbox alarm response": after this many CONSECUTIVE cycles blocked on the
// same message, emit the metric-filterable `gmail.sync.poison` event (3 cycles = 30 min at the
// */10 cron). The streak lives durably on the state item (blockedMessageId/blockedStreak),
// written only through the fenced releaseLease below.
const POISON_STREAK_THRESHOLD = 3;

// Tri-state classification of a completed (non-thrown, non-aborted-returned) mailbox run for the
// poison-streak bookkeeping. 'clean' means the run genuinely completed with zero retryable
// failures — an incremental pass that neither paused on a transient (hasMore) nor bailed to
// re-anchor, or a backfill that finished. Anything else that lacks a blocked id is inconclusive:
// the blocked message was never revisited, so the streak must not be cleared.
function classifyRun(outcome: Record<string, unknown>): 'blocked' | 'clean' | 'inconclusive' {
  if (typeof outcome.blockedMessageId === 'string') return 'blocked';
  if (outcome.aborted === true) return 'inconclusive';               // defensive — aborted runs return before release
  const counters = outcome.counters as Record<string, number> | undefined;
  if ((counters?.retryable_failure ?? 0) > 0) return 'inconclusive'; // defensive: retryable seen but no id surfaced
  if (outcome.phase === 'incremental') {
    return outcome.hasMore === true || outcome.needsReanchor === true ? 'inconclusive' : 'clean';
  }
  return outcome.completed === true ? 'clean' : 'inconclusive';
}

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
  let state: GmailSyncState = {};
  try {
    state = await readState(mailbox);
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
    // Thrown-run choke point (see sanitizeDiagnostic in emitMessage.ts): the error text entering
    // the mailbox_failed log and durable lastSummary is sanitized here — never the raw message.
    const { errorClass, diagnostic } = sanitizeDiagnostic(err);
    const error = `${errorClass}: ${diagnostic}`;
    console.error(JSON.stringify({ event: 'gmail.sync.mailbox_failed', mailbox, error }));
    try {
      // Inconclusive run (thrown): lastSummary only — blockedMessageId/blockedStreak are NOT
      // named in this write, and releaseLease's UpdateExpression only SETs the fields it is
      // given, so the prior streak persists on the item untouched.
      await releaseLease(mailbox, lease, Date.now(), { lastSummary: { status: 'error', error } });
    } catch {
      // best-effort — see the function-level comment above.
    }
    return { mailbox, status: 'error', error };
  }

  // Poison-mailbox diagnostics: fold this run's blocked-message diagnostics into a durable
  // consecutive-blocked streak. The streak fields ride the SAME fenced releaseLease write as
  // lastSummary — no extra write, full fence discipline (a lost lease skips them entirely).
  //
  // Tri-state run outcome:
  //  - 'blocked'      : the summary names a blocked message → same id: streak+1, new id: reset to 1
  //  - 'clean'        : the run COMPLETED with zero retryable_failures → the ONLY state that clears
  //  - 'inconclusive' : transient exit / needsReanchor / defensive retryable-without-id — the
  //                     blocked message was never revisited, so the prior streak must persist.
  //                     The fields are simply NOT named in the releaseLease write: its
  //                     UpdateExpression only SETs provided fields, so the item keeps them.
  // (Thrown runs and aborted/lease-lost/lease-held runs are inconclusive too — they return from
  // the catch / early paths above and never reach this write.)
  const runClass = classifyRun(outcome);
  const blockedFields: Partial<GmailSyncState> = {};
  if (runClass === 'blocked') {
    const blockedMessageId = outcome.blockedMessageId as string;
    const blockedStreak = state.blockedMessageId === blockedMessageId ? (state.blockedStreak ?? 0) + 1 : 1;
    blockedFields.blockedMessageId = blockedMessageId;
    blockedFields.blockedStreak = blockedStreak;
    console.log(JSON.stringify({
      event: 'gmail.sync.blocked', mailbox, blockedMessageId,
      blockedError: typeof outcome.blockedError === 'string' ? outcome.blockedError : null, blockedStreak,
    }));
    if (blockedStreak >= POISON_STREAK_THRESHOLD) {
      // Stable, metric-filterable event name — the runbook's poison-mailbox alarm keys on it.
      console.log(JSON.stringify({ event: 'gmail.sync.poison', mailbox, blockedMessageId, blockedStreak }));
    }
  } else if (runClass === 'clean' && (state.blockedMessageId != null || state.blockedStreak != null)) {
    blockedFields.blockedMessageId = null;      // genuine clean completion: clear the streak
    blockedFields.blockedStreak = null;
  }

  const rel = await releaseLease(mailbox, lease, Date.now(), { ...blockedFields, lastSummary: outcome });
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
