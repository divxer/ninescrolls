import { describe, it, expect, beforeEach } from 'vitest';
import { runBackfill, type BackfillCtx } from './backfill';
import { GmailApiError } from './gmailClient';
import type { GmailMessage } from './mapMessage';
import type { ProjectOutcome } from './emitMessage';
import type { GmailSyncState } from './gmailSyncState';

// ---------------------------------------------------------------------------
// Harness (plan Task 6 Step 1): dependency-injected — no module mocks needed.
// Mirrors Task 5's incrementalSync.test.ts harness style. `pages()` defines an
// ordered list of message-id pages; messagesList is addressed positionally via
// its own `pt-N` tokens. Resume tests pass `fromToken` so a STORED cursor from
// existingState() maps back onto page index 0 (the harness never invents its
// own token scheme the production code would recognize differently).
// ---------------------------------------------------------------------------

let pageList: string[][] = [];
let resumeFromToken: string | undefined;
let outcomeById: Record<string, ProjectOutcome['outcome']> = {};
let messagesGetErrors: Record<string, Error> = {};
let profileHistoryIdValue = '0';
let profileCallCount = 0;
let listCalls: { window: string; pageToken?: string }[] = [];
let writes: Partial<GmailSyncState>[] = [];
let persistLostOn: number | null = null;   // 0-based index of the persist() call that should report {lost:true}
let existing: GmailSyncState = {};

function profileHistoryId(id: string) { profileHistoryIdValue = id; }
function pages(defs: string[][], opts?: { fromToken?: string }) { pageList = defs; resumeFromToken = opts?.fromToken; }
function outcomes(map: Record<string, ProjectOutcome['outcome']>) { outcomeById = map; }
function existingState(s: GmailSyncState) { existing = s; }
function stateWrites() { return writes; }
function profileCalls() { return profileCallCount; }
function loseFenceOn(callIndex: number) { persistLostOn = callIndex; }

function fullMessage(id: string): GmailMessage {
  return {
    id, threadId: `t-${id}`, internalDate: '1753000000000', snippet: `snippet ${id}`,
    payload: { headers: [
      { name: 'From', value: `customer-${id}@example.com` },
      { name: 'To', value: 'info@ninescrolls.com' },
      { name: 'Subject', value: `Subject ${id}` },
      // no Message-ID → mapMessage falls back to `${mailbox}:${gmailMessageId}` identity
    ] },
  };
}

function pageIndexForToken(token: string | undefined): number {
  if (token === undefined) return 0;
  if (token === resumeFromToken) return 0;
  const m = /^pt-(\d+)$/.exec(token);
  return m ? Number(m[1]) : 0;
}

const ctx: BackfillCtx = {
  mailbox: 'info@ninescrolls.com',
  windowDays: 90,
  get existing() { return existing; },
  client: {
    getProfile: async () => { profileCallCount += 1; return { historyId: profileHistoryIdValue }; },
    messagesList: async (window: string, pageToken?: string) => {
      listCalls.push({ window, pageToken });
      const idx = pageIndexForToken(pageToken);
      const ids = pageList[idx] ?? [];
      const hasNext = idx < pageList.length - 1;
      return { messages: ids.map((id) => ({ id })), nextPageToken: hasNext ? `pt-${idx + 1}` : undefined };
    },
    messagesGetMetadata: async (id: string) => {
      if (messagesGetErrors[id]) throw messagesGetErrors[id];
      return fullMessage(id) as unknown as Record<string, unknown>;
    },
  },
  project: async (mapped) => {
    if (mapped.kind !== 'emit') throw new Error('project mock called with a skip result');
    const idIn = mapped.emit.idInput as { gmailMessageId?: string };
    const id = idIn.gmailMessageId!;
    const o = outcomeById[id] ?? 'persisted';
    if (o === 'persisted') return { outcome: 'persisted' };
    if (o === 'terminal_skip') return { outcome: 'terminal_skip', reason: 'test' };
    return { outcome: 'retryable_failure', error: 'test failure' };
  },
  persist: async (fields) => {
    const lost = persistLostOn !== null && writes.length === persistLostOn;
    writes.push(fields);
    return { lost };
  },
};

beforeEach(() => {
  pageList = []; resumeFromToken = undefined; outcomeById = {}; messagesGetErrors = {};
  profileHistoryIdValue = '0'; profileCallCount = 0; listCalls = []; writes = [];
  persistLostOn = null; existing = {};
});

describe('runBackfill', () => {
  it('persists {phase:backfill, anchorHistoryId, pageToken:null, window} BEFORE the first page', async () => {
    profileHistoryId('500'); pages([['a'], ['b']]); outcomes({ a: 'persisted', b: 'persisted' });
    await runBackfill(ctx);
    expect(stateWrites()[0]).toMatchObject({ phase: 'backfill', anchorHistoryId: '500', pageToken: null });
    expect(listCalls).toHaveLength(0 + 2); // sanity: both pages were fetched after the anchor write
  });

  it('pageToken advances ONLY after complete page success; a retryable_failure retains the input cursor', async () => {
    profileHistoryId('500'); pages([['a', 'b'], ['c']]); outcomes({ a: 'persisted', b: 'retryable_failure', c: 'persisted' });
    const s = await runBackfill(ctx);
    expect(s.completed).toBe(false);
    expect(stateWrites().some((w) => 'pageToken' in w && w.pageToken === 'pt-1')).toBe(false);  // never advanced past page 0
  });

  it('a retryable_failure anywhere on the page blocks it; only the anchor write is persisted (no page-advance, no completion)', async () => {
    profileHistoryId('500'); pages([['a', 'b']]); outcomes({ a: 'retryable_failure', b: 'persisted' });
    const s = await runBackfill(ctx);
    expect(s.completed).toBe(false);
    expect(s.counters.retryable_failure).toBe(1);
    expect(s.counters.persisted).toBe(1);   // b still processed — work continues within the page
    expect(stateWrites()).toHaveLength(1);  // only the anchor-capture write
  });

  it('resume uses the STORED anchor + pageToken (never re-captures)', async () => {
    existingState({ phase: 'backfill', anchorHistoryId: '500', pageToken: 'pt-1', window: 'newer_than:90d' });
    pages([['c']], { fromToken: 'pt-1' }); outcomes({ c: 'persisted' });
    await runBackfill(ctx);
    expect(profileCalls()).toBe(0);
  });

  it('resume fetches messagesList with the STORED pageToken (not undefined)', async () => {
    existingState({ phase: 'backfill', anchorHistoryId: '500', pageToken: 'pt-1', window: 'newer_than:90d' });
    pages([['c']], { fromToken: 'pt-1' }); outcomes({ c: 'persisted' });
    await runBackfill(ctx);
    expect(listCalls[0]).toEqual({ window: 'newer_than:90d', pageToken: 'pt-1' });
  });

  it('completion: ONE fenced write sets {phase:incremental, historyId:anchor} and clears backfill fields', async () => {
    existingState({ phase: 'backfill', anchorHistoryId: '500', pageToken: null, window: 'newer_than:90d' });
    pages([['a']]); outcomes({ a: 'persisted' });
    const s = await runBackfill(ctx);
    expect(s.completed).toBe(true);
    expect(stateWrites().at(-1)).toMatchObject({ phase: 'incremental', historyId: '500', anchorHistoryId: null, pageToken: null });
  });

  it('completion sets the watermark to the STORED anchor, not a fresh profile call', async () => {
    existingState({ phase: 'backfill', anchorHistoryId: '500', pageToken: null, window: 'newer_than:90d' });
    pages([['a']]); outcomes({ a: 'persisted' });
    await runBackfill(ctx);
    expect(profileCalls()).toBe(0);
  });

  it('anchor-persist CCFE aborts the run before any page is fetched', async () => {
    profileHistoryId('500'); loseFenceOn(0); pages([['a']]);
    const s = await runBackfill(ctx);
    expect(s.aborted).toBe(true);
    expect(s.completed).toBe(false);
    expect(listCalls).toHaveLength(0);   // abort happens strictly before page 1
  });

  it('page-advance persist CCFE aborts mid-backfill (page 1 never fetched)', async () => {
    profileHistoryId('500'); pages([['a'], ['b']]); outcomes({ a: 'persisted', b: 'persisted' });
    loseFenceOn(1);   // 2nd persist() call = the pageToken advance after page 0
    const s = await runBackfill(ctx);
    expect(s.aborted).toBe(true);
    expect(s.completed).toBe(false);
    expect(listCalls).toHaveLength(1);
  });

  it('completion-persist CCFE still reports completed:true (page work is done) with aborted:true', async () => {
    existingState({ phase: 'backfill', anchorHistoryId: '500', pageToken: null, window: 'newer_than:90d' });
    pages([['a']]); outcomes({ a: 'persisted' });
    loseFenceOn(0);   // the only persist() call here is the completion write (anchor already existed)
    const s = await runBackfill(ctx);
    expect(s.completed).toBe(true);
    expect(s.aborted).toBe(true);
  });

  it('messages.get 404 is a terminal_skip; the page still counts as complete', async () => {
    profileHistoryId('500'); pages([['a', 'b']]);
    messagesGetErrors.a = new GmailApiError('messagesGet', 404, 'not_found', {});
    outcomes({ b: 'persisted' });
    const s = await runBackfill(ctx);
    expect(s.completed).toBe(true);
    expect(s.counters.terminal_skip).toBe(1);
    expect(s.counters.persisted).toBe(1);
  });

  it('a transient messages.get error propagates uncaught; no page-advance write happens (page retries next run)', async () => {
    profileHistoryId('500'); pages([['a', 'b'], ['c']]);
    messagesGetErrors.a = new GmailApiError('messagesGet', 500, 'transient', {});
    await expect(runBackfill(ctx)).rejects.toThrow('gmail messagesGet 500 (transient)');
    expect(stateWrites()).toHaveLength(1);   // only the anchor-capture write
  });

  it('mapper-level skip counts as done for the page (skipped_filter, page still advances)', async () => {
    profileHistoryId('500'); pages([['draft1', 'a']]); outcomes({ a: 'persisted' });
    const base = ctx.client.messagesGetMetadata;
    ctx.client.messagesGetMetadata = async (id: string) => {
      const m = (await base(id)) as unknown as GmailMessage;
      if (id === 'draft1') m.labelIds = ['DRAFT'];
      return m as unknown as Record<string, unknown>;
    };
    try {
      const s = await runBackfill(ctx);
      expect(s.completed).toBe(true);
      expect(s.counters.skipped_filter).toBe(1);
      expect(s.counters.persisted).toBe(1);
    } finally {
      ctx.client.messagesGetMetadata = base;
    }
  });

  it('uses newer_than:{windowDays}d as the default window when none is stored', async () => {
    profileHistoryId('500'); pages([['a']]); outcomes({ a: 'persisted' });
    await runBackfill(ctx);
    expect(listCalls[0].window).toBe('newer_than:90d');
  });
});
