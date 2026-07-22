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
vi.mock('./lib/gmailClient', () => ({
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
vi.mock('./lib/emitMessage', () => ({
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
