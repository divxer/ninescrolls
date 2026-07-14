import { describe, it, expect, vi, beforeEach } from 'vitest';

const send = vi.fn();
vi.mock('../lib/dynamodb.js', () => ({
  docClient: { send: (...a: unknown[]) => send(...a) },
  TABLE_NAME: () => 'TestTable',
}));

import { pbAppendCostVersion, pbListCostVersions, selectEffectiveCost } from './costVersionResolvers.js';

const ev = (input: Record<string, unknown>) => ({
  info: { fieldName: 'x', parentTypeName: 'Mutation' },
  arguments: { input },
  identity: { sub: 's', groups: ['admin'], claims: { email: 'boss@ninescrolls.com' } },
});

const validInput = {
  itemId: 'c1', supplierId: 's1', unitCostFen: 725_000,
  effectiveFrom: '2026-08-01', effectiveTo: '2027-02-01', priceSource: 'MANUAL_ENTRY',
};

beforeEach(() => send.mockReset());

describe('pbAppendCostVersion', () => {
  it('reads guard FIRST (consistent), then versions (consistent), then transacts CAS + Put', async () => {
    send
      .mockResolvedValueOnce({ Item: { revision: 3 } })            // ① guard GetCommand
      .mockResolvedValueOnce({ Items: [] })                        // ② versions QueryCommand
      .mockResolvedValueOnce({});                                  // ④ TransactWriteCommand
    const res = await pbAppendCostVersion(ev(validInput)) as Record<string, unknown>;
    expect(res.unitCostFen).toBe(725_000);
    expect(res.reviewStatus).toBe('APPROVED');

    const [guardCall, versionsCall, txCall] = send.mock.calls.map((c) => c[0]);
    expect(guardCall.constructor.name).toBe('GetCommand');
    expect(guardCall.input.ConsistentRead).toBe(true);
    expect(guardCall.input.Key.SK).toBe('COSTGUARD#s1');
    expect(versionsCall.constructor.name).toBe('QueryCommand');
    expect(versionsCall.input.ConsistentRead).toBe(true);
    expect(versionsCall.input.ExpressionAttributeValues[':sk']).toBe('COST#s1#');

    const [guardOp, putOp] = txCall.input.TransactItems;
    expect(guardOp.Update.ConditionExpression).toContain('revision = :expected');
    expect(guardOp.Update.ExpressionAttributeValues[':expected']).toBe(3);
    expect(putOp.Put.ConditionExpression).toBe('attribute_not_exists(PK)');
    expect(putOp.Put.Item.SK).toBe('COST#s1#2026-08-01');
  });

  it('bootstraps a missing guard with attribute_not_exists', async () => {
    send
      .mockResolvedValueOnce({})                                   // guard absent
      .mockResolvedValueOnce({ Items: [] })
      .mockResolvedValueOnce({});
    await pbAppendCostVersion(ev(validInput));
    const guardOp = send.mock.calls[2][0].input.TransactItems[0];
    expect(guardOp.Update.ConditionExpression).toBe('attribute_not_exists(PK)');
  });

  it('rejects an overlapping interval', async () => {
    send
      .mockResolvedValueOnce({ Item: { revision: 1 } })
      .mockResolvedValueOnce({ Items: [{ effectiveFrom: '2026-06-01', effectiveTo: '2026-09-01' }] });
    await expect(pbAppendCostVersion(ev(validInput))).rejects.toThrow(/^VALIDATION:.*overlap/i);
    expect(send).toHaveBeenCalledTimes(2); // never reaches the transaction
  });

  it('maps a cancelled transaction to CONFLICT', async () => {
    send
      .mockResolvedValueOnce({ Item: { revision: 1 } })
      .mockResolvedValueOnce({ Items: [] })
      .mockRejectedValueOnce(Object.assign(new Error('boom'), { name: 'TransactionCanceledException' }));
    await expect(pbAppendCostVersion(ev(validInput))).rejects.toThrow(/^CONFLICT:/);
  });

  it('rejects effectiveTo <= effectiveFrom', async () => {
    await expect(pbAppendCostVersion(ev({ ...validInput, effectiveTo: '2026-08-01' })))
      .rejects.toThrow(/^VALIDATION:/);
  });
});

describe('pbListCostVersions', () => {
  it('queries the item partition by COST# prefix', async () => {
    send.mockResolvedValueOnce({ Items: [{ PK: 'PCAT#c1', SK: 'COST#s1#2026-01-01', unitCostFen: 1 }] });
    const res = await pbListCostVersions(ev({ itemId: 'c1' })) as { items: Record<string, unknown>[] };
    expect(res.items).toHaveLength(1);
    const q = send.mock.calls[0][0].input;
    expect(q.KeyConditionExpression).toContain('begins_with');
  });
});

describe('selectEffectiveCost', () => {
  const versions = [
    { effectiveFrom: '2026-01-01', effectiveTo: '2026-07-01', unitCostFen: 100 },
    { effectiveFrom: '2026-08-01', effectiveTo: '2027-02-01', unitCostFen: 200 }, // future-dated
  ];
  it('selects the covering version', () => {
    expect(selectEffectiveCost(versions, '2026-06-30')?.unitCostFen).toBe(100);
  });
  it('does not select a future-dated version early, then selects it once effective', () => {
    expect(selectEffectiveCost(versions, '2026-07-15')).toBeNull(); // gap ⇒ missing cost
    expect(selectEffectiveCost(versions, '2026-08-01')?.unitCostFen).toBe(200);
  });
});
