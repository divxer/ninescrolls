// amplify/lib/rfq/submitTransaction.test.ts
import { describe, it, expect } from 'vitest';
import { buildSubmitTransaction, type SubmitTransactionParams } from './submitTransaction';
import type { PendingRfqSource, PendingRfqMeta } from './pendingRfq';

const SOURCE: PendingRfqSource = {
  name: 'Ada', email: 'ada@lab.edu', institution: 'Lab', equipmentCategory: 'RIE',
  applicationDescription: 'A valid application description.', quantity: 1,
};
const META: PendingRfqMeta = {
  rfqId: 'rfq-20260718-abc123', submittedAt: '2026-07-18T09:30:00.000Z',
  ipHash: 'a'.repeat(64), referenceNumber: 'RFQ-20260718-ABC1',
};
const SUBMIT_KEY = Buffer.alloc(32, 7).toString('base64url');

function direct(over: Partial<Extract<SubmitTransactionParams, { kind: 'direct' }>> = {}): SubmitTransactionParams {
  return {
    kind: 'direct', tableName: 'T', source: SOURCE, meta: META, tempKeys: [],
    receipt: { receiptId: 'SUBMIT_RECEIPT#r', binding: 'b'.repeat(64), status: 200 },
    submitKeyB64: SUBMIT_KEY, now: '2026-07-18T09:30:00.000Z', ...over,
  };
}

describe('buildSubmitTransaction — direct', () => {
  it('composes pending Put + receipt Put + email roots when no attachments', () => {
    const { TransactItems, ClientRequestToken } = buildSubmitTransaction(direct());
    expect(TransactItems).toHaveLength(5);
    expect(TransactItems![0].Put!.Item!.PK).toBe('RFQ#rfq-20260718-abc123');
    expect(TransactItems![0].Put!.ConditionExpression).toBe('attribute_not_exists(PK)');
    expect(TransactItems![1].Put!.Item!.PK).toBe('SUBMIT_RECEIPT#r');
    expect(TransactItems!.slice(2).map((i) => i.Put!.Item!.SK))
      .toEqual(['OUTBOX#org-upsert', 'OUTBOX#confirmation-email', 'OUTBOX#internal-email']);
    expect(ClientRequestToken).toHaveLength(36);
    for (const i of TransactItems!) expect(i.Put!.TableName).toBe('T');
  });

  it('uses attachment-move root (carrying tempKeys) when attachments present', () => {
    const keys = ['temp/rfq/aaaaaaaaaaaaaaaa/file.pdf'];
    const { TransactItems } = buildSubmitTransaction(direct({ tempKeys: keys }));
    expect(TransactItems).toHaveLength(4);
    const roots = TransactItems!.slice(2);
    expect(roots.map((i) => i.Put!.Item!.SK)).toEqual(['OUTBOX#org-upsert', 'OUTBOX#attachment-move']);
    const attach = roots.find((i) => i.Put!.Item!.SK === 'OUTBOX#attachment-move')!;
    expect(attach.Put!.Item!.input).toEqual({ tempKeys: keys });
  });

  it('rejects a pending item over the item-size limit', () => {
    expect(() => buildSubmitTransaction(direct({ source: { ...SOURCE, additionalComments: 'z'.repeat(500 * 1024) } })))
      .toThrow(/item size/i);
  });
});

describe('buildSubmitTransaction — draft-upgrade', () => {
  it('uses the 4-clause draft condition with the stored hash verbatim', () => {
    const params: SubmitTransactionParams = {
      kind: 'draft-upgrade', tableName: 'T', source: SOURCE, meta: META, tempKeys: [],
      receipt: { receiptId: 'SUBMIT_RECEIPT#r', binding: 'b'.repeat(64), status: 200 },
      submitKeyB64: SUBMIT_KEY, now: '2026-07-18T09:30:00.000Z',
      draftPrecondition: { storedHash: 'v1:' + 'a'.repeat(64), expectedVersion: 3 },
    };
    const p = buildSubmitTransaction(params).TransactItems![0].Put!;
    expect(p.ConditionExpression)
      .toBe('#status = :draft AND draftTokenHash = :h AND draftVersion = :v AND expiresAt > :now');
    expect(p.ExpressionAttributeNames).toEqual({ '#status': 'status' });
    expect(p.ExpressionAttributeValues).toEqual({
      ':draft': 'draft', ':h': 'v1:' + 'a'.repeat(64), ':v': 3, ':now': '2026-07-18T09:30:00.000Z',
    });
  });
});

describe('buildSubmitTransaction — parity + guards', () => {
  it('writes a byte-identical pending item on both paths for the same source + meta', () => {
    const d = buildSubmitTransaction(direct());
    const u = buildSubmitTransaction({
      kind: 'draft-upgrade', tableName: 'T', source: SOURCE, meta: META, tempKeys: [],
      receipt: { receiptId: 'SUBMIT_RECEIPT#r', binding: 'b'.repeat(64), status: 200 },
      submitKeyB64: SUBMIT_KEY, now: '2026-07-18T09:30:00.000Z',
      draftPrecondition: { storedHash: 'v1:' + 'a'.repeat(64), expectedVersion: 1 },
    });
    expect(u.TransactItems![0].Put!.Item).toEqual(d.TransactItems![0].Put!.Item);
  });

  it('produces a stable ClientRequestToken for the same submit key', () => {
    expect(buildSubmitTransaction(direct()).ClientRequestToken)
      .toBe(buildSubmitTransaction(direct()).ClientRequestToken);
  });
});
