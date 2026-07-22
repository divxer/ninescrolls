import { describe, it, expect, vi, beforeEach } from 'vitest';
const send = vi.fn();
vi.mock('./dynamodb', () => ({ docClient: { send: (...a: unknown[]) => send(...a) }, TABLE_NAME: () => 'T' }));
import { acquireLease, writeStateFenced, releaseLease, isNewerHistoryId, stateKey } from './gmailSyncState';

beforeEach(() => { send.mockReset(); send.mockResolvedValue({}); });

describe('gmailSyncState', () => {
  it('stateKey: GMAIL_SYNC#<mailbox>/STATE', () =>
    expect(stateKey('info@ninescrolls.com')).toEqual({ PK: 'GMAIL_SYNC#info@ninescrolls.com', SK: 'STATE' }));
  it('acquire: conditional on no-live-lease; returns token; null on CCFE', async () => {
    const tok = await acquireLease('m@x', 120, 1000);
    expect(tok).toMatch(/[0-9a-f-]{36}/);
    const u = send.mock.calls[0][0].input;
    expect(u.ConditionExpression).toBe('attribute_not_exists(lease) OR leaseExpiresAt < :now');
    send.mockRejectedValueOnce(Object.assign(new Error('held'), { name: 'ConditionalCheckFailedException' }));
    expect(await acquireLease('m@x', 120, 1000)).toBeNull();
  });
  it('writeStateFenced: conditions on token AND unexpired lease; lost=true on CCFE', async () => {
    await writeStateFenced('m@x', 'tok', 2000, { historyId: '123' });
    const u = send.mock.calls[0][0].input;
    expect(u.ConditionExpression).toBe('lease = :tok AND leaseExpiresAt > :now');
    send.mockRejectedValueOnce(Object.assign(new Error('lost'), { name: 'ConditionalCheckFailedException' }));
    expect((await writeStateFenced('m@x', 'tok', 2000, { historyId: '124' })).lost).toBe(true);
  });
  it('release: ALSO requires unexpired lease (R6/blocker-3) and removes lease attrs', async () => {
    await releaseLease('m@x', 'tok', 2000, { lastSummary: { examined: 0 } });
    const u = send.mock.calls[0][0].input;
    expect(u.ConditionExpression).toBe('lease = :tok AND leaseExpiresAt > :now');
    expect(u.UpdateExpression).toContain('REMOVE lease, leaseExpiresAt');
  });
  it('isNewerHistoryId compares as decimal BigInt ("9" < "10")', () => {
    expect(isNewerHistoryId('10', '9')).toBe(true);
    expect(isNewerHistoryId('9', '10')).toBe(false);
    expect(isNewerHistoryId('18446744073709551617', '18446744073709551616')).toBe(true); // > Number.MAX_SAFE_INTEGER
    expect(isNewerHistoryId('5', null)).toBe(true);
  });
});
