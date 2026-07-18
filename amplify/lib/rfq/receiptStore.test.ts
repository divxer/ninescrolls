import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import { recordReceipt, checkReceipt } from './receiptStore';
import { deriveSubmitReceiptId, computeRequestBinding } from './submitReceipt';
import { encodeCredential } from './draftCredentials';
import { FakeDdb } from '../../functions/price-api/lib/testing/fakeDdb';
import { buildReceiptItem } from './receiptStore';

const NOW = '2026-07-15T00:00:00.000Z';
const deps = (ddb: FakeDdb, now = NOW) => ({
  send: (c: unknown) => ddb.send(c as never), tableName: 't', now: () => now,
});
const key = encodeCredential(crypto.randomBytes(32));
const PAYLOAD = { name: 'Jane', email: 'jane@stanford.edu', quantity: 1 };
const id = deriveSubmitReceiptId(key);
const binding = computeRequestBinding(PAYLOAD, { kind: 'direct' });
const RESULT = { rfqId: 'rfq-1', referenceNumber: 'RFQ-1', status: 200 };

describe('receipt store', () => {
  it('records first use, then replays the stored result for the same key+binding', async () => {
    const ddb = new FakeDdb();
    expect((await checkReceipt(deps(ddb), id, binding)).outcome).toBe('first-use');
    await recordReceipt(deps(ddb), id, { opKind: 'direct', binding, result: RESULT });
    const replay = await checkReceipt(deps(ddb), id, binding);
    expect(replay.outcome).toBe('replay');
    if (replay.outcome === 'replay') expect(replay.result).toEqual(RESULT);
  });

  it('rejects a same-key / different-binding reuse as a conflict', async () => {
    const ddb = new FakeDdb();
    await recordReceipt(deps(ddb), id, { opKind: 'direct', binding, result: RESULT });
    const other = computeRequestBinding({ ...PAYLOAD, quantity: 9 }, { kind: 'direct' });
    expect((await checkReceipt(deps(ddb), id, other)).outcome).toBe('conflict');
  });

  it('replays just before day 7, then returns window-expired at day 7 through retained day 90', async () => {
    const ddb = new FakeDdb();
    await recordReceipt(deps(ddb), id, { opKind: 'direct', binding, result: RESULT });
    expect((await checkReceipt(deps(ddb, '2026-07-21T23:59:59.999Z'), id, binding)).outcome).toBe('replay');
    expect((await checkReceipt(deps(ddb, '2026-07-22T00:00:00.000Z'), id, binding)).outcome).toBe('window-expired');
    expect((await checkReceipt(deps(ddb, '2026-10-13T00:00:00.000Z'), id, binding)).outcome).toBe('window-expired');
    ddb.store.clear(); // model DynamoDB TTL deletion after the tombstone retention period
    expect((await checkReceipt(deps(ddb, '2026-10-14T00:00:00.000Z'), id, binding)).outcome).toBe('first-use');
  });

  it('atomically admits one concurrent writer and lets the loser resolve with a strong read', async () => {
    const ddb = new FakeDdb();
    const attempts = await Promise.allSettled([
      recordReceipt(deps(ddb), id, { opKind: 'direct', binding, result: RESULT }),
      recordReceipt(deps(ddb), id, { opKind: 'direct', binding, result: RESULT }),
    ]);
    expect(attempts.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(attempts.filter((r) => r.status === 'rejected')).toHaveLength(1);
    expect((await checkReceipt(deps(ddb), id, binding)).outcome).toBe('replay');
  });

  it('uses a strongly consistent read for idempotency classification', async () => {
    let input: Record<string, unknown> | undefined;
    await checkReceipt({
      tableName: 't', now: () => NOW,
      send: async (command) => { input = (command as { input: Record<string, unknown> }).input; return {}; },
    }, id, binding);
    expect(input?.ConsistentRead).toBe(true);
  });

  it('fails closed when a stored receipt is malformed', async () => {
    const ddb = new FakeDdb();
    ddb.seed([{ PK: id, SK: 'META', binding: 'not-a-hash', replayExpiresAt: 'bad-date' }]);
    await expect(checkReceipt(deps(ddb), id, binding)).rejects.toThrow('Invalid stored receipt');
  });

  it('stores no form PII', async () => {
    const ddb = new FakeDdb();
    await recordReceipt(deps(ddb), id, { opKind: 'direct', binding, result: RESULT });
    const item = [...ddb.store.values()][0];
    expect(item).not.toHaveProperty('email');
    expect(item).not.toHaveProperty('name');
    expect(item.binding).toBe(binding);
  });
});

describe('buildReceiptItem', () => {
  it('builds the receipt with 7-day replay + 90-day TTL and terminal fields only', () => {
    const now = '2026-07-18T00:00:00.000Z';
    expect(buildReceiptItem('SUBMIT_RECEIPT#abc', {
      opKind: 'direct', binding: 'f'.repeat(64),
      result: { rfqId: 'rfq-20260718-abc123', referenceNumber: 'RFQ-20260718-ABC1', status: 200 }, now,
    })).toEqual({
      PK: 'SUBMIT_RECEIPT#abc', SK: 'META', opKind: 'direct', binding: 'f'.repeat(64),
      rfqId: 'rfq-20260718-abc123', referenceNumber: 'RFQ-20260718-ABC1', status: 200,
      createdAt: now, replayExpiresAt: '2026-07-25T00:00:00.000Z',
      TTL: Math.floor(Date.parse('2026-10-16T00:00:00.000Z') / 1000),
    });
  });

  it('stores no form PII', () => {
    const item = buildReceiptItem('SUBMIT_RECEIPT#abc', {
      opKind: 'draft-upgrade', binding: '0'.repeat(64),
      result: { rfqId: 'rfq-x', referenceNumber: 'RFQ-x', status: 200 }, now: '2026-07-18T00:00:00.000Z',
    }) as unknown as Record<string, unknown>;
    for (const k of ['name', 'email', 'institution', 'applicationDescription']) expect(k in item).toBe(false);
  });
});
