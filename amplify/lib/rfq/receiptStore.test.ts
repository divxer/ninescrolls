import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import { recordReceipt, checkReceipt } from './receiptStore';
import { deriveSubmitReceiptId, computeRequestBinding } from './submitReceipt';
import { encodeCredential } from './draftCredentials';
import { FakeDdb } from '../../functions/price-api/lib/testing/fakeDdb';

const NOW = '2026-07-15T00:00:00.000Z';
const deps = (ddb: FakeDdb, now = NOW) => ({
  send: (c: unknown) => ddb.send(c as never), tableName: 't', now: () => now,
});
const key = encodeCredential(crypto.randomBytes(32));
const PAYLOAD = { name: 'Jane', email: 'jane@stanford.edu', quantity: 1 };
const id = deriveSubmitReceiptId(key);
const binding = computeRequestBinding(PAYLOAD, 'direct');
const RESULT = { rfqId: 'rfq-1', referenceNumber: 'RFQ-1', status: 200 };

describe('receipt store', () => {
  it('records first use, then replays the stored result for the same key+binding', async () => {
    const ddb = new FakeDdb();
    expect((await checkReceipt(deps(ddb), id)).outcome).toBe('first-use');
    await recordReceipt(deps(ddb), id, { opKind: 'direct', binding, result: RESULT });
    const replay = await checkReceipt(deps(ddb), id, binding);
    expect(replay.outcome).toBe('replay');
    if (replay.outcome === 'replay') expect(replay.result).toEqual(RESULT);
  });

  it('rejects a same-key / different-binding reuse as a conflict', async () => {
    const ddb = new FakeDdb();
    await recordReceipt(deps(ddb), id, { opKind: 'direct', binding, result: RESULT });
    const other = computeRequestBinding({ ...PAYLOAD, quantity: 9 }, 'direct');
    expect((await checkReceipt(deps(ddb), id, other)).outcome).toBe('conflict');
  });

  it('returns window-expired from day 7 through day 90', async () => {
    const ddb = new FakeDdb();
    await recordReceipt(deps(ddb), id, { opKind: 'direct', binding, result: RESULT });
    const day30 = deps(ddb, '2026-08-14T00:00:00.000Z');
    expect((await checkReceipt(day30, id, binding)).outcome).toBe('window-expired');
  });

  it('a second concurrent record is rejected (conditional create)', async () => {
    const ddb = new FakeDdb();
    await recordReceipt(deps(ddb), id, { opKind: 'direct', binding, result: RESULT });
    await expect(recordReceipt(deps(ddb), id, { opKind: 'direct', binding, result: RESULT }))
      .rejects.toThrow();
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
