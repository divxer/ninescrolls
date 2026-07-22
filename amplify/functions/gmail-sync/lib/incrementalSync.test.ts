import { describe, it, expect, beforeEach } from 'vitest';
import { runIncremental, type IncrementalCtx } from './incrementalSync';
import { GmailApiError } from './gmailClient';
import type { GmailMessage } from './mapMessage';
import type { ProjectOutcome } from './emitMessage';

// ---------------------------------------------------------------------------
// Harness (plan Task 5 Step 1): dependency-injected — no module mocks needed.
// Synthetic history records feed historyList; messagesGetMetadata builds a full
// message per id (customer→info@ so mapMessage yields kind:'emit' with the
// gmailMessageId fallback identity — no Message-ID header — letting the project
// mock key outcomes by message id).
// ---------------------------------------------------------------------------

type SyntheticRecord = { id: string; messages: string[] };

let pages: { history?: { id: string; messagesAdded?: { message: { id: string } }[] }[]; historyId?: string; nextPageToken?: string }[] = [];
let historyError: Error | null = null;
let outcomeById: Record<string, ProjectOutcome['outcome']> = {};
let messagesGetErrors: Record<string, Error> = {};
let checkpointWrites: string[] = [];
let writeLost = false;
let historyCalls: { startHistoryId: string; pageToken?: string }[] = [];

function historyPages(records: SyntheticRecord[], opts?: { responseHistoryId?: string }) {
  pages = [{
    history: records.map((r) => ({ id: r.id, messagesAdded: r.messages.map((mid) => ({ message: { id: mid } })) })),
    ...(opts?.responseHistoryId ? { historyId: opts.responseHistoryId } : {}),
  }];
}

// Multi-page variant: each element is one historyList response; nextPageToken chains them.
function historyPagesMulti(pagesIn: { records: SyntheticRecord[]; responseHistoryId?: string }[]) {
  pages = pagesIn.map((p, i) => ({
    history: p.records.map((r) => ({ id: r.id, messagesAdded: r.messages.map((mid) => ({ message: { id: mid } })) })),
    ...(p.responseHistoryId ? { historyId: p.responseHistoryId } : {}),
    ...(i < pagesIn.length - 1 ? { nextPageToken: `page-${i + 1}` } : {}),
  }));
}

function historyThrows(err: Error) { historyError = err; }
function outcomes(map: Record<string, ProjectOutcome['outcome']>) { outcomeById = map; }
function stateWriteLost() { writeLost = true; }

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

const ctx: IncrementalCtx = {
  mailbox: 'info@ninescrolls.com',
  startHistoryId: '50',
  client: {
    historyList: async (startHistoryId: string, pageToken?: string) => {
      historyCalls.push({ startHistoryId, pageToken });
      if (historyError) throw historyError;
      const idx = pageToken ? Number(pageToken.replace('page-', '')) : 0;
      return pages[idx] as Record<string, unknown>;
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
  persistCheckpoint: async (historyId: string) => {
    checkpointWrites.push(historyId);
    return { lost: writeLost };
  },
};

beforeEach(() => {
  pages = []; historyError = null; outcomeById = {}; messagesGetErrors = {};
  checkpointWrites = []; writeLost = false; historyCalls = [];
});

describe('runIncremental', () => {
  it('advances across the contiguous prefix of fully-done records; stops at the first record with a retryable_failure', async () => {
    historyPages([{ id: '100', messages: ['a'] }, { id: '110', messages: ['b', 'c'] }, { id: '120', messages: ['d'] }]);
    outcomes({ a: 'persisted', b: 'persisted', c: 'retryable_failure', d: 'persisted' });
    const s = await runIncremental(ctx);
    expect(s.checkpoint).toBe('100');        // record 110 not fully done → stop BEFORE it (sibling c not skipped)
    expect(s.counters.persisted).toBe(3);    // d still processed (work continues; checkpoint just doesn't pass 110)
    expect(s.counters.retryable_failure).toBe(1);
    expect(checkpointWrites).toEqual(['100']);  // never wrote past the blocked record
  });

  it('clean run commits the response-level top-level historyId', async () => {
    historyPages([{ id: '100', messages: ['a'] }], { responseHistoryId: '999' });
    outcomes({ a: 'persisted' });
    const s = await runIncremental(ctx);
    expect(s.checkpoint).toBe('999');
    expect(checkpointWrites).toEqual(['100', '999']);
  });

  it('terminal_skip counts as done for its record (messages.get 404 → not blocked)', async () => {
    historyPages([{ id: '100', messages: ['a', 'b'] }]);
    outcomes({ a: 'terminal_skip', b: 'persisted' });
    const s = await runIncremental(ctx);
    expect(s.checkpoint).toBe('100');
    expect(s.counters.terminal_skip).toBe(1);
    expect(s.counters.persisted).toBe(1);
  });

  it('messages.get not_found (deleted between history and fetch) is a terminal_skip, record still advances', async () => {
    historyPages([{ id: '100', messages: ['a', 'b'] }]);
    messagesGetErrors.a = new GmailApiError('messagesGet', 404, 'not_found', {});
    outcomes({ b: 'persisted' });
    const s = await runIncremental(ctx);
    expect(s.checkpoint).toBe('100');
    expect(s.counters.terminal_skip).toBe(1);
  });

  it('history_expired classification returns needsReanchor (no checkpoint write)', async () => {
    historyThrows(new GmailApiError('historyList', 404, 'history_expired', {}));
    const s = await runIncremental(ctx);
    expect(s.needsReanchor).toBe(true);
    expect(s.checkpoint).toBeNull();
    expect(checkpointWrites).toEqual([]);
  });

  it('a lost fenced write aborts the run immediately', async () => {
    historyPages([{ id: '100', messages: ['a'] }]);
    outcomes({ a: 'persisted' });
    stateWriteLost();
    const s = await runIncremental(ctx);
    expect(s.aborted).toBe(true);
  });

  it('empty history with a response historyId commits it (normal no-new-mail watermark advance)', async () => {
    historyPages([], { responseHistoryId: '777' });
    const s = await runIncremental(ctx);
    expect(s.checkpoint).toBe('777');
    expect(s.counters.records).toBe(0);
    expect(checkpointWrites).toEqual(['777']);
  });

  it('empty history with no response historyId is a pure no-op (no writes)', async () => {
    pages = [{}];
    const s = await runIncremental(ctx);
    expect(s.checkpoint).toBeNull();
    expect(checkpointWrites).toEqual([]);
  });

  it('mapper-level skips count as done (record advances; skipped_filter counted)', async () => {
    historyPages([{ id: '100', messages: ['draft1', 'a'] }], { responseHistoryId: '200' });
    outcomes({ a: 'persisted' });
    // draft1: override metadata to a DRAFT-labeled message → mapMessage kind:'skip'
    const base = ctx.client.messagesGetMetadata;
    ctx.client.messagesGetMetadata = async (id: string) => {
      const m = (await base(id)) as unknown as GmailMessage;
      if (id === 'draft1') m.labelIds = ['DRAFT'];
      return m as unknown as Record<string, unknown>;
    };
    try {
      const s = await runIncremental(ctx);
      expect(s.checkpoint).toBe('200');
      expect(s.counters.skipped_filter).toBe(1);
      expect(s.counters.persisted).toBe(1);
    } finally {
      ctx.client.messagesGetMetadata = base;
    }
  });

  it('rate_limited mid-run returns hasMore:true and retains the last checkpoint (resume next cron)', async () => {
    historyPagesMulti([
      { records: [{ id: '100', messages: ['a'] }] },
      { records: [{ id: '110', messages: ['b'] }] },
    ]);
    outcomes({ a: 'persisted' });
    messagesGetErrors.b = new GmailApiError('messagesGet', 429, 'rate_limited', {});
    const s = await runIncremental(ctx);
    expect(s.hasMore).toBe(true);
    expect(s.checkpoint).toBe('100');
    expect(checkpointWrites).toEqual(['100']);
  });

  it('bad_request surfaces loudly (rethrown)', async () => {
    historyThrows(new GmailApiError('historyList', 400, 'bad_request', {}));
    await expect(runIncremental(ctx)).rejects.toThrow('gmail historyList 400 (bad_request)');
  });

  it('paginates with nextPageToken and passes the same startHistoryId on every page', async () => {
    historyPagesMulti([
      { records: [{ id: '100', messages: ['a'] }] },
      { records: [{ id: '110', messages: ['b'] }], responseHistoryId: '300' },
    ]);
    outcomes({ a: 'persisted', b: 'persisted' });
    const s = await runIncremental(ctx);
    expect(s.checkpoint).toBe('300');
    expect(historyCalls).toEqual([
      { startHistoryId: '50', pageToken: undefined },
      { startHistoryId: '50', pageToken: 'page-1' },
    ]);
    expect(checkpointWrites).toEqual(['100', '110', '300']);
  });

  it('checkpoint never moves backwards: a record id not newer than the current checkpoint is not written', async () => {
    // record ids out of ascending order (defensive: BigInt guard inside the loop)
    historyPages([{ id: '120', messages: ['a'] }, { id: '110', messages: ['b'] }], { responseHistoryId: '120' });
    outcomes({ a: 'persisted', b: 'persisted' });
    const s = await runIncremental(ctx);
    expect(s.checkpoint).toBe('120');
    expect(checkpointWrites).toEqual(['120']);  // neither '110' nor a same-value '120' re-write
  });
});
