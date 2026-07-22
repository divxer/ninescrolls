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

// Spec §7 (R4/R6): anchor captured + persisted BEFORE page 1; the pageToken advances only when
// EVERY message on the page is persisted/terminal_skip; completion is one fenced phase transition.
export async function runBackfill(ctx: BackfillCtx): Promise<{ completed: boolean; counters: Record<string, number>; aborted?: boolean }> {
  const counters = { persisted: 0, terminal_skip: 0, retryable_failure: 0, skipped_filter: 0, pages: 0 };
  let anchor = ctx.existing.anchorHistoryId ?? null;
  let pageToken = ctx.existing.pageToken ?? null;
  const window = ctx.existing.window ?? `newer_than:${ctx.windowDays}d`;

  if (!anchor) {                                                 // fresh backfill: capture-then-persist FIRST
    const profile = await ctx.client.getProfile() as { historyId?: string };
    anchor = String(profile.historyId);
    const w = await ctx.persist({ phase: 'backfill', anchorHistoryId: anchor, pageToken: null, window });
    if (w.lost) return { completed: false, counters, aborted: true };
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
      if (out.outcome === 'retryable_failure') pageClean = false;
    }
    if (!pageClean) return { completed: false, counters };       // R7/blocker-1: retain the INPUT cursor; page retries next run
    if (!page.nextPageToken) break;
    pageToken = page.nextPageToken;
    const w = await ctx.persist({ pageToken });                   // advance only after complete page success
    if (w.lost) return { completed: false, counters, aborted: true };
  }
  const w = await ctx.persist({ phase: 'incremental', historyId: anchor, anchorHistoryId: null, pageToken: null, window: null });
  if (w.lost) return { completed: true, counters, aborted: true };
  return { completed: true, counters };
}
