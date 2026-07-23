import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const readState = vi.fn();
const acquireLease = vi.fn();
const releaseLease = vi.fn();
const writeStateFenced = vi.fn();
vi.mock('./lib/gmailSyncState', () => ({
  readState: (...a: unknown[]) => readState(...a),
  acquireLease: (...a: unknown[]) => acquireLease(...a),
  releaseLease: (...a: unknown[]) => releaseLease(...a),
  writeStateFenced: (...a: unknown[]) => writeStateFenced(...a),
}));

const createGmailClient = vi.fn();
vi.mock('./lib/gmailClient', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./lib/gmailClient')>()),   // keep the real GmailApiError class
  createGmailClient: (...a: unknown[]) => createGmailClient(...a),
}));

const runIncremental = vi.fn();
vi.mock('./lib/incrementalSync', () => ({
  runIncremental: (...a: unknown[]) => runIncremental(...a),
}));

const runBackfill = vi.fn();
vi.mock('./lib/backfill', () => ({
  runBackfill: (...a: unknown[]) => runBackfill(...a),
}));

const projectMessage = vi.fn();
vi.mock('./lib/emitMessage', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./lib/emitMessage')>()),   // keep the REAL sanitizeDiagnostic
  projectMessage: (...a: unknown[]) => projectMessage(...a),
}));

import { handler } from './handler';

const ORIGINAL_ENV = { ...process.env };
const FAKE_CLIENT = { getProfile: vi.fn(), historyList: vi.fn(), messagesList: vi.fn(), messagesGetMetadata: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  process.env.GMAIL_SA_SECRET_ARN = 'arn:aws:secretsmanager:us-east-2:123456789012:secret:gmail-sa-Ab12Cd';
  process.env.MAILBOXES = 'info@ninescrolls.com';
  acquireLease.mockResolvedValue('lease-tok');
  readState.mockResolvedValue({});
  createGmailClient.mockResolvedValue(FAKE_CLIENT);
  releaseLease.mockResolvedValue({ lost: false });
  writeStateFenced.mockResolvedValue({ lost: false });
  runIncremental.mockResolvedValue({ checkpoint: '100', counters: {}, hasMore: false });
  runBackfill.mockResolvedValue({ completed: true, counters: {} });
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('gmail-sync handler', () => {
  it('GMAIL_SA_SECRET_ARN empty: reports not_configured, makes NO acquireLease/Google calls', async () => {
    process.env.GMAIL_SA_SECRET_ARN = '';
    const res = await handler();
    expect(res.results).toEqual([{ mailbox: 'info@ninescrolls.com', status: 'not_configured' }]);
    expect(acquireLease).not.toHaveBeenCalled();
    expect(readState).not.toHaveBeenCalled();
    expect(createGmailClient).not.toHaveBeenCalled();
  });

  it('lease held: returns {skippedLeaseHeld:true} and makes NO Google calls', async () => {
    acquireLease.mockResolvedValueOnce(null);
    const res = await handler();
    expect(res.results).toEqual([{ mailbox: 'info@ninescrolls.com', skippedLeaseHeld: true }]);
    expect(readState).not.toHaveBeenCalled();
    expect(createGmailClient).not.toHaveBeenCalled();
    expect(runIncremental).not.toHaveBeenCalled();
    expect(runBackfill).not.toHaveBeenCalled();
  });

  it('fresh mailbox (no state): dispatches to runBackfill, not runIncremental', async () => {
    readState.mockResolvedValue({});
    await handler();
    expect(runBackfill).toHaveBeenCalledTimes(1);
    expect(runIncremental).not.toHaveBeenCalled();
    const ctx = runBackfill.mock.calls[0][0];
    expect(ctx.mailbox).toBe('info@ninescrolls.com');
    expect(ctx.existing).toEqual({});
  });

  it("phase:'backfill' with no historyId: dispatches to runBackfill (not incremental)", async () => {
    readState.mockResolvedValue({ phase: 'backfill', anchorHistoryId: '500', pageToken: 'pt-1', window: 'newer_than:90d' });
    await handler();
    expect(runBackfill).toHaveBeenCalledTimes(1);
    expect(runIncremental).not.toHaveBeenCalled();
  });

  it("phase:'incremental': dispatches to runIncremental with the STORED watermark", async () => {
    readState.mockResolvedValue({ phase: 'incremental', historyId: '999' });
    await handler();
    expect(runIncremental).toHaveBeenCalledTimes(1);
    expect(runBackfill).not.toHaveBeenCalled();
    const ctx = runIncremental.mock.calls[0][0];
    expect(ctx.startHistoryId).toBe('999');
    expect(ctx.mailbox).toBe('info@ninescrolls.com');
  });

  it('needsReanchor: clears to backfill mode via a fenced write and logs', async () => {
    readState.mockResolvedValue({ phase: 'incremental', historyId: '999' });
    runIncremental.mockResolvedValue({ checkpoint: '999', counters: {}, hasMore: false, needsReanchor: true });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await handler();
    expect(writeStateFenced).toHaveBeenCalledWith('info@ninescrolls.com', 'lease-tok', expect.any(Number), {
      phase: 'backfill', anchorHistoryId: null, pageToken: null,
    });
    const reanchorLog = logSpy.mock.calls.map((c) => c[0]).find((l) => typeof l === 'string' && l.includes('gmail.sync.reanchor'));
    expect(reanchorLog).toBeDefined();
    logSpy.mockRestore();
  });

  it('run summary is logged as gmail.sync.summary', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await handler();
    const summaryLog = logSpy.mock.calls.map((c) => c[0]).find((l) => typeof l === 'string' && l.includes('gmail.sync.summary'));
    expect(summaryLog).toBeDefined();
    const parsed = JSON.parse(summaryLog as string);
    expect(parsed.event).toBe('gmail.sync.summary');
    expect(parsed.results).toHaveLength(1);
    logSpy.mockRestore();
  });

  it('release is called with unexpired-lease semantics (same token, mailbox, a lastSummary)', async () => {
    await handler();
    expect(releaseLease).toHaveBeenCalledTimes(1);
    const [mailbox, token, nowMs, fields] = releaseLease.mock.calls[0];
    expect(mailbox).toBe('info@ninescrolls.com');
    expect(token).toBe('lease-tok');
    expect(typeof nowMs).toBe('number');
    expect(fields).toHaveProperty('lastSummary');
  });

  it('a lost release is logged, not thrown', async () => {
    releaseLease.mockResolvedValue({ lost: true });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await expect(handler()).resolves.toBeDefined();
    const lostLog = logSpy.mock.calls.map((c) => c[0]).find((l) => typeof l === 'string' && l.includes('gmail.sync.lease_lost'));
    expect(lostLog).toBeDefined();
    logSpy.mockRestore();
  });

  it('a lost checkpoint write (aborted) stops immediately: no releaseLease call after abort', async () => {
    readState.mockResolvedValue({ phase: 'incremental', historyId: '999' });
    runIncremental.mockResolvedValue({ checkpoint: '999', counters: {}, hasMore: true, aborted: true });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await handler();
    expect(releaseLease).not.toHaveBeenCalled();
    const lostLog = logSpy.mock.calls.map((c) => c[0]).find((l) => typeof l === 'string' && l.includes('gmail.sync.lease_lost'));
    expect(lostLog).toBeDefined();
    logSpy.mockRestore();
  });

  it('runBackfill THROWING (transient GmailApiError propagation) is absorbed as retry-next-cron, not a crash', async () => {
    runBackfill.mockRejectedValue(new Error('gmail messagesList 503 (transient)'));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await handler();
    expect(res.results[0]).toMatchObject({ mailbox: 'info@ninescrolls.com', status: 'error' });
    const failLog = errSpy.mock.calls.map((c) => c[0]).find((l) => typeof l === 'string' && l.includes('gmail.sync.mailbox_failed'));
    expect(failLog).toBeDefined();
    errSpy.mockRestore();
  });

  it('a mailbox throw attempts a best-effort releaseLease (failure of that release does not throw)', async () => {
    runBackfill.mockRejectedValue(new Error('boom'));
    releaseLease.mockRejectedValue(new Error('release also failed'));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(handler()).resolves.toBeDefined();
    expect(releaseLease).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it("one mailbox's failure does not skip others: MAILBOXES=a,b with a throwing still processes b", async () => {
    process.env.MAILBOXES = 'a@ninescrolls.com,b@ninescrolls.com';
    runBackfill
      .mockRejectedValueOnce(new Error('a is poisoned'))
      .mockResolvedValueOnce({ completed: true, counters: {} });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await handler();
    expect(res.results).toHaveLength(2);
    expect(res.results[0]).toMatchObject({ mailbox: 'a@ninescrolls.com', status: 'error' });
    expect(res.results[1]).toMatchObject({ mailbox: 'b@ninescrolls.com', phase: 'backfill', completed: true });
    errSpy.mockRestore();
  });

  it('MAILBOXES env parses a comma list, trimming whitespace', async () => {
    process.env.MAILBOXES = ' a@ninescrolls.com , b@ninescrolls.com ';
    const res = await handler();
    expect(res.results.map((r) => r.mailbox)).toEqual(['a@ninescrolls.com', 'b@ninescrolls.com']);
  });

  it('MAILBOXES unset defaults to info@ninescrolls.com', async () => {
    delete process.env.MAILBOXES;
    const res = await handler();
    expect(res.results).toEqual([expect.objectContaining({ mailbox: 'info@ninescrolls.com' })]);
  });
});

// Poison-mailbox diagnostics (runbook "Poison-mailbox alarm response"): the consecutive-blocked
// streak is tracked DURABLY on the state item via the fenced releaseLease write.
describe('gmail-sync handler poison diagnostics', () => {
  function logs(spy: ReturnType<typeof vi.spyOn>, event: string) {
    return spy.mock.calls
      .map((c) => c[0]).filter((l): l is string => typeof l === 'string' && l.includes(`"${event}"`))
      .map((l) => JSON.parse(l));
  }

  it('a blocked incremental run logs gmail.sync.blocked and persists {blockedMessageId, blockedStreak:1} via releaseLease', async () => {
    readState.mockResolvedValue({ phase: 'incremental', historyId: '999' });
    runIncremental.mockResolvedValue({ checkpoint: '999', counters: {}, hasMore: false, blockedMessageId: 'm1', blockedError: 'projection 500' });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await handler();
    const blocked = logs(logSpy, 'gmail.sync.blocked');
    expect(blocked).toHaveLength(1);
    expect(blocked[0]).toMatchObject({ mailbox: 'info@ninescrolls.com', blockedMessageId: 'm1', blockedError: 'projection 500', blockedStreak: 1 });
    const [, , , fields] = releaseLease.mock.calls[0];
    expect(fields).toMatchObject({ blockedMessageId: 'm1', blockedStreak: 1 });
    expect(logs(logSpy, 'gmail.sync.poison')).toHaveLength(0);   // below threshold
    logSpy.mockRestore();
  });

  it('the streak increments across runs when the SAME message blocks again (read from durable state)', async () => {
    readState.mockResolvedValue({ phase: 'incremental', historyId: '999', blockedMessageId: 'm1', blockedStreak: 1 });
    runIncremental.mockResolvedValue({ checkpoint: '999', counters: {}, hasMore: false, blockedMessageId: 'm1', blockedError: 'projection 500' });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await handler();
    const [, , , fields] = releaseLease.mock.calls[0];
    expect(fields).toMatchObject({ blockedMessageId: 'm1', blockedStreak: 2 });
    expect(logs(logSpy, 'gmail.sync.blocked')[0]).toMatchObject({ blockedStreak: 2 });
    logSpy.mockRestore();
  });

  it('a DIFFERENT blocked message resets the streak to 1', async () => {
    readState.mockResolvedValue({ phase: 'incremental', historyId: '999', blockedMessageId: 'm1', blockedStreak: 2 });
    runIncremental.mockResolvedValue({ checkpoint: '999', counters: {}, hasMore: false, blockedMessageId: 'm2', blockedError: 'projection 500' });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await handler();
    const [, , , fields] = releaseLease.mock.calls[0];
    expect(fields).toMatchObject({ blockedMessageId: 'm2', blockedStreak: 1 });
    expect(logs(logSpy, 'gmail.sync.poison')).toHaveLength(0);
    logSpy.mockRestore();
  });

  it('a clean run clears previously-stored blocked fields in the releaseLease write', async () => {
    readState.mockResolvedValue({ phase: 'incremental', historyId: '999', blockedMessageId: 'm1', blockedStreak: 2 });
    runIncremental.mockResolvedValue({ checkpoint: '1000', counters: {}, hasMore: false });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await handler();
    const [, , , fields] = releaseLease.mock.calls[0];
    expect(fields).toMatchObject({ blockedMessageId: null, blockedStreak: null });
    expect(logs(logSpy, 'gmail.sync.blocked')).toHaveLength(0);
    logSpy.mockRestore();
  });

  it('at the 3rd consecutive cycle blocked on the same message, gmail.sync.poison is logged (runbook threshold)', async () => {
    readState.mockResolvedValue({ phase: 'incremental', historyId: '999', blockedMessageId: 'm1', blockedStreak: 2 });
    runIncremental.mockResolvedValue({ checkpoint: '999', counters: {}, hasMore: false, blockedMessageId: 'm1', blockedError: 'projection 500' });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await handler();
    const poison = logs(logSpy, 'gmail.sync.poison');
    expect(poison).toHaveLength(1);
    expect(poison[0]).toMatchObject({ event: 'gmail.sync.poison', mailbox: 'info@ninescrolls.com', blockedMessageId: 'm1', blockedStreak: 3 });
    const [, , , fields] = releaseLease.mock.calls[0];
    expect(fields).toMatchObject({ blockedMessageId: 'm1', blockedStreak: 3 });
    logSpy.mockRestore();
  });

  it('reviewer sequence: blocked → throw → transient → lease-held → blocked = streak 1, unchanged, unchanged, unchanged, 2', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const durable = { phase: 'incremental', historyId: '999', blockedMessageId: 'm1', blockedStreak: 1 };

    // run 1: blocked on m1 → streak 1
    readState.mockResolvedValueOnce({ phase: 'incremental', historyId: '999' });
    runIncremental.mockResolvedValueOnce({ checkpoint: '999', counters: {}, hasMore: false, blockedMessageId: 'm1', blockedError: 'x' });
    await handler();
    expect(releaseLease.mock.calls[0][3]).toMatchObject({ blockedMessageId: 'm1', blockedStreak: 1 });

    // run 2: thrown run = inconclusive — release must NOT touch the blocked fields
    readState.mockResolvedValueOnce(durable);
    runIncremental.mockRejectedValueOnce(new Error('boom'));
    await handler();
    const f2 = releaseLease.mock.calls[1][3];
    expect('blockedMessageId' in f2).toBe(false);
    expect('blockedStreak' in f2).toBe(false);

    // run 3: transient exit (hasMore:true, no blockedMessageId) = inconclusive — NOT a clear
    readState.mockResolvedValueOnce(durable);
    runIncremental.mockResolvedValueOnce({ checkpoint: '999', counters: {}, hasMore: true });
    await handler();
    const f3 = releaseLease.mock.calls[2][3];
    expect('blockedMessageId' in f3).toBe(false);
    expect('blockedStreak' in f3).toBe(false);

    // run 4: lease held = inconclusive — nothing written at all
    acquireLease.mockResolvedValueOnce(null);
    await handler();
    expect(releaseLease).toHaveBeenCalledTimes(3);

    // run 5: blocked on m1 again — durable state still says streak 1 → streak 2
    readState.mockResolvedValueOnce(durable);
    runIncremental.mockResolvedValueOnce({ checkpoint: '999', counters: {}, hasMore: false, blockedMessageId: 'm1', blockedError: 'x' });
    await handler();
    expect(releaseLease.mock.calls[3][3]).toMatchObject({ blockedMessageId: 'm1', blockedStreak: 2 });

    logSpy.mockRestore(); errSpy.mockRestore();
  });

  it('a needsReanchor run is inconclusive: prior blocked fields ride through untouched', async () => {
    readState.mockResolvedValue({ phase: 'incremental', historyId: '999', blockedMessageId: 'm1', blockedStreak: 2 });
    runIncremental.mockResolvedValue({ checkpoint: null, counters: {}, hasMore: false, needsReanchor: true });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await handler();
    const [, , , fields] = releaseLease.mock.calls[0];
    expect('blockedMessageId' in fields).toBe(false);
    expect('blockedStreak' in fields).toBe(false);
    logSpy.mockRestore();
  });

  it('a thrown run with a PII-bearing error persists/logs ONLY the allowlisted diagnostic', async () => {
    readState.mockResolvedValue({ phase: 'incremental', historyId: '999' });
    runIncremental.mockRejectedValue(new Error('failed for bob@acme.com re: Quote #123 +1-555-0100 https://x.com/y'));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await handler();
    const error = (res.results[0] as { error: string }).error;
    expect(error).toBe('unknown: Error');                      // constructor name only, no message prose
    const failLog = errSpy.mock.calls.map((c) => c[0]).find((l) => typeof l === 'string' && l.includes('gmail.sync.mailbox_failed')) as string;
    const persisted = JSON.stringify(releaseLease.mock.calls[0][3]);
    for (const fragment of ['bob@acme.com', 'Quote', '555', 'x.com', 'failed for']) {
      expect(failLog).not.toContain(fragment);
      expect(persisted).not.toContain(fragment);
    }
    errSpy.mockRestore();
  });

  it('a thrown crm-api FunctionError surfaces as the bare crm_api_error class', async () => {
    readState.mockResolvedValue({ phase: 'incremental', historyId: '999' });
    runIncremental.mockRejectedValue(new Error(`crm-api error: emit failed for bob@acme.com ${'Z'.repeat(9000)}`));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await handler();
    expect((res.results[0] as { error: string }).error).toBe('crm_api_error');
    errSpy.mockRestore();
  });

  it("mailbox isolation: A's NORMAL-PATH releaseLease throwing a non-CCFE error is mailbox-local — B still fully processed", async () => {
    process.env.MAILBOXES = 'a@ninescrolls.com,b@ninescrolls.com';
    releaseLease
      .mockRejectedValueOnce(Object.assign(new Error('dynamo down'), { name: 'InternalServerError' }))  // A, normal path
      .mockResolvedValueOnce({ lost: false });                                                          // B
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await handler();
    expect(res.results).toHaveLength(2);
    expect(res.results[0]).toMatchObject({ mailbox: 'a@ninescrolls.com', status: 'error' });
    expect(res.results[1]).toMatchObject({ mailbox: 'b@ninescrolls.com', phase: 'backfill', completed: true });
    expect(runBackfill).toHaveBeenCalledTimes(2);                // B's run actually happened
    const relLog = errSpy.mock.calls.map((c) => c[0]).find((l) => typeof l === 'string' && l.includes('gmail.sync.release_failed'));
    expect(relLog).toBeDefined();
    errSpy.mockRestore();
  });

  it('a LOST normal-path release after a would-be-clean run returns lease_lost — never the clean outcome — and the summary log matches', async () => {
    readState.mockResolvedValue({ phase: 'incremental', historyId: '999' });
    runIncremental.mockResolvedValue({ checkpoint: '1000', counters: { persisted: 3 }, hasMore: false });
    releaseLease.mockResolvedValue({ lost: true });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const res = await handler();
    expect(res.results[0]).toMatchObject({ mailbox: 'info@ninescrolls.com', status: 'lease_lost' });
    expect(res.results[0]).not.toHaveProperty('checkpoint');     // the unpersisted summary must not leak out
    expect(res.results[0]).not.toHaveProperty('counters');
    expect(res.results[0]).not.toHaveProperty('completed');
    const summary = logs(logSpy, 'gmail.sync.summary')[0] as { results: Record<string, unknown>[] };
    expect(summary.results[0]).toMatchObject({ status: 'lease_lost' });
    expect(summary.results[0].completed).toBeUndefined();
    expect(summary.results[0].counters).toBeUndefined();
    expect(writeStateFenced).not.toHaveBeenCalled();             // state item untouched by any later write
    logSpy.mockRestore();
  });

  it('persist-then-alarm: a LOST fenced release at the poison threshold emits NO blocked/poison events', async () => {
    readState.mockResolvedValue({ phase: 'incremental', historyId: '999', blockedMessageId: 'm1', blockedStreak: 2 });
    runIncremental.mockResolvedValue({ checkpoint: '999', counters: {}, hasMore: false, blockedMessageId: 'm1', blockedError: 'x' });
    releaseLease.mockResolvedValue({ lost: true });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await handler();
    expect(logs(logSpy, 'gmail.sync.blocked')).toHaveLength(0);
    expect(logs(logSpy, 'gmail.sync.poison')).toHaveLength(0);
    expect(logs(logSpy, 'gmail.sync.lease_lost')).toHaveLength(1);   // the existing lost log still covers it
    logSpy.mockRestore();
  });

  it('a blocked BACKFILL run also tracks the streak (phase-agnostic)', async () => {
    readState.mockResolvedValue({});
    runBackfill.mockResolvedValue({ completed: false, counters: {}, blockedMessageId: 'b1', blockedError: 'projection 500' });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await handler();
    const [, , , fields] = releaseLease.mock.calls[0];
    expect(fields).toMatchObject({ blockedMessageId: 'b1', blockedStreak: 1 });
    expect(logs(logSpy, 'gmail.sync.blocked')).toHaveLength(1);
    logSpy.mockRestore();
  });
});
