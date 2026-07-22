import crypto from 'node:crypto';
import type { GmailClient } from './gmailClient';
import { GmailApiError } from './gmailClient';
import { mapMessage, type GmailMessage } from './mapMessage';
import type { ProjectOutcome } from './emitMessage';
import type { GmailSyncState } from './gmailSyncState';

export interface BackfillCtx {
  mailbox: string; windowDays: number;
  existing: GmailSyncState;                                     // strongly-read state at run start
  client: Pick<GmailClient, 'getProfile' | 'messagesList' | 'messagesGetMetadata'>;
  project: (mapped: ReturnType<typeof mapMessage>) => Promise<ProjectOutcome>;
  persist: (fields: Partial<GmailSyncState>) => Promise<{ lost: boolean }>;   // fenced
}

export interface BackfillResult {
  completed: boolean; counters: Record<string, number>; aborted?: boolean;
  restarted?: boolean;                                          // configId mismatch forced a deliberate restart
  blockedMessageId?: string; blockedError?: string;             // first blocked message of the run (poison diagnostics)
}

// Spec §7 step 1: the stable configuration identity persisted with the anchor. Hashes exactly the
// paging-affecting inputs — the mailbox being listed and the query window. (The alias set is a
// post-fetch mapMessage filter; it does not affect `messages.list` paging, so it is NOT part of
// the identity.) 16 hex chars of sha256 — stable across deploys, cheap to compare.
export function computeBackfillConfigId(mailbox: string, window: string): string {
  return crypto.createHash('sha256').update(`v1|mailbox=${mailbox}|window=${window}`).digest('hex').slice(0, 16);
}

// Spec §7 (R4/R6): anchor captured + persisted BEFORE page 1; the pageToken advances only when
// EVERY message on the page is persisted/terminal_skip; completion is one fenced phase transition.
export async function runBackfill(ctx: BackfillCtx): Promise<BackfillResult> {
  const counters = { persisted: 0, terminal_skip: 0, retryable_failure: 0, skipped_filter: 0, pages: 0 };
  const currentWindow = `newer_than:${ctx.windowDays}d`;
  const configId = computeBackfillConfigId(ctx.mailbox, currentWindow);
  let anchor = ctx.existing.anchorHistoryId ?? null;
  let pageToken = ctx.existing.pageToken ?? null;
  let restarted = false;
  let diag: { blockedMessageId: string; blockedError: string } | undefined;

  // Spec §7: if the paging-affecting config changed mid-backfill (or the stored anchor predates
  // configId and is unverifiable), the stale cursor points into a DIFFERENT listing — deliberately
  // RESTART anchor-first in this same run. The reset is carried by the fresh-anchor fenced write
  // below, which atomically replaces anchor+cursor+window+configId in one state write.
  if (anchor && ctx.existing.configId !== configId) {
    anchor = null; restarted = true;
  }

  // ANY anchor-less start (fresh mailbox, config restart, post-reset residue, manual surgery)
  // ignores stored paging state entirely — cursor and window normalize to the CURRENT inputs, so
  // a stale window/configId left on the item can never bind a fresh anchor to an old listing.
  if (!anchor) pageToken = null;
  const window = anchor ? (ctx.existing.window ?? currentWindow) : currentWindow;

  if (!anchor) {                                                 // fresh backfill: capture-then-persist FIRST
    const profile = await ctx.client.getProfile() as { historyId?: string };
    anchor = String(profile.historyId);
    const w = await ctx.persist({ phase: 'backfill', anchorHistoryId: anchor, pageToken: null, window, configId });
    if (w.lost) return { completed: false, counters, aborted: true, ...(restarted && { restarted }) };
  }

  for (;;) {
    counters.pages += 1;
    const page = await ctx.client.messagesList(window, pageToken ?? undefined) as
      { messages?: { id: string }[]; nextPageToken?: string };
    let pageClean = true;
    for (const ref of page.messages ?? []) {
      const full = await ctx.client.messagesGetMetadata(ref.id).catch((err) => {
        if (err instanceof GmailApiError && err.classification === 'not_found') return null;
        throw err;
      });
      if (full === null) { counters.terminal_skip += 1; continue; }
      const mapped = mapMessage(full as unknown as GmailMessage, ctx.mailbox);
      if (mapped.kind === 'skip') { counters.skipped_filter += 1; continue; }
      const out = await ctx.project(mapped);
      counters[out.outcome] += 1;
      if (out.outcome === 'retryable_failure') {
        pageClean = false;
        diag ??= { blockedMessageId: ref.id, blockedError: out.error };
      }
    }
    if (!pageClean) return { completed: false, counters, ...(restarted && { restarted }), ...diag };  // R7/blocker-1: retain the INPUT cursor; page retries next run
    if (!page.nextPageToken) break;
    pageToken = page.nextPageToken;
    const w = await ctx.persist({ pageToken });                   // advance only after complete page success
    if (w.lost) return { completed: false, counters, aborted: true, ...(restarted && { restarted }) };
  }
  const w = await ctx.persist({ phase: 'incremental', historyId: anchor, anchorHistoryId: null, pageToken: null, window: null, configId: null });
  if (w.lost) return { completed: true, counters, aborted: true, ...(restarted && { restarted }) };
  return { completed: true, counters, ...(restarted && { restarted }) };
}
