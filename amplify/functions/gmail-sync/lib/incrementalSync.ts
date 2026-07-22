import type { GmailClient } from './gmailClient';
import { GmailApiError } from './gmailClient';
import { mapMessage, type GmailMessage } from './mapMessage';
import type { ProjectOutcome } from './emitMessage';
import { isNewerHistoryId } from './gmailSyncState';

export interface IncrementalCtx {
  mailbox: string; startHistoryId: string;
  client: Pick<GmailClient, 'historyList' | 'messagesGetMetadata'>;
  project: (emit: ReturnType<typeof mapMessage>) => Promise<ProjectOutcome>;   // wraps projectMessage for 'emit' results
  persistCheckpoint: (historyId: string) => Promise<{ lost: boolean }>;        // fenced write via gmailSyncState
}

export interface IncrementalResult {
  checkpoint: string | null; needsReanchor?: boolean; aborted?: boolean;
  counters: Record<string, number>; hasMore: boolean;
  // First blocked message of the run (runbook poison-mailbox diagnostics): absent on clean runs.
  blockedMessageId?: string; blockedError?: string;
}

// Spec §4: outcome per message; checkpoint at HISTORY-RECORD boundaries; clean run commits the
// response-level historyId; expiry only from the historyList endpoint classification.
export async function runIncremental(ctx: IncrementalCtx): Promise<IncrementalResult> {
  const counters = { records: 0, persisted: 0, terminal_skip: 0, retryable_failure: 0, skipped_filter: 0 };
  let checkpoint: string | null = null;       // highest fully-done contiguous record id
  let blocked = false;                        // a record with a retryable_failure was seen
  // First blocked message of the run — surfaced so the runbook's poison-mailbox procedure can
  // identify the offending Gmail message without spelunking per-message logs.
  let diag: { blockedMessageId: string; blockedError: string } | undefined;
  let pageToken: string | undefined; let responseHistoryId: string | null = null;
  try {
    do {
      const page = await ctx.client.historyList(ctx.startHistoryId, pageToken) as {
        history?: { id: string; messagesAdded?: { message: GmailMessage }[] }[];
        historyId?: string; nextPageToken?: string;
      };
      responseHistoryId = page.historyId ?? responseHistoryId;
      for (const record of page.history ?? []) {
        counters.records += 1;
        let recordDone = true;
        for (const added of record.messagesAdded ?? []) {
          const full = await ctx.client.messagesGetMetadata(added.message.id).catch((err) => {
            if (err instanceof GmailApiError && err.classification === 'not_found') return null;   // deleted → terminal_skip
            throw err;
          });
          if (full === null) { counters.terminal_skip += 1; continue; }
          const mapped = mapMessage(full as unknown as GmailMessage, ctx.mailbox);
          if (mapped.kind === 'skip') { counters.skipped_filter += 1; continue; }                  // filtered = done
          const out = await ctx.project(mapped);
          counters[out.outcome] += 1;
          if (out.outcome === 'retryable_failure') {
            recordDone = false;
            diag ??= { blockedMessageId: added.message.id, blockedError: out.error };
          }
        }
        if (recordDone && !blocked && isNewerHistoryId(record.id, checkpoint)) {
          checkpoint = record.id;
          const w = await ctx.persistCheckpoint(checkpoint);
          if (w.lost) return { checkpoint, counters, hasMore: !!page.nextPageToken, aborted: true, ...diag };
        } else if (!recordDone) blocked = true;   // later records still process, but checkpoint never passes this one
      }
      pageToken = page.nextPageToken;
    } while (pageToken);
    if (!blocked && responseHistoryId && isNewerHistoryId(responseHistoryId, checkpoint)) {
      checkpoint = responseHistoryId;             // clean run: commit the response-level final historyId
      const w = await ctx.persistCheckpoint(checkpoint);
      if (w.lost) return { checkpoint, counters, hasMore: false, aborted: true, ...diag };
    }
    return { checkpoint, counters, hasMore: false, ...diag };
  } catch (err) {
    if (err instanceof GmailApiError && err.classification === 'history_expired') {
      return { checkpoint, counters, hasMore: false, needsReanchor: true, ...diag };
    }
    if (err instanceof GmailApiError && (err.classification === 'rate_limited' || err.classification === 'transient')) {
      return { checkpoint, counters, hasMore: true, ...diag };  // resume next cron from the last checkpoint
    }
    throw err;                                          // bad_request etc: surface loudly (spec §4)
  }
}
