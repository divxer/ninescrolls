import { describe, it, expect, vi, beforeEach } from 'vitest';

const send = vi.fn();
vi.mock('../lib/dynamodb.js', () => ({
  docClient: { send: (...a: unknown[]) => send(...a) },
  TABLE_NAME: () => 'TestTable',
}));

import { pbCreateQuotationDraft } from './quotationResolvers.js';

const ev = (input: Record<string, unknown>) => ({
  info: { fieldName: 'x', parentTypeName: 'Mutation' },
  arguments: { input },
  identity: { sub: 's', groups: ['admin'], claims: { email: 'boss@ninescrolls.com' } },
});

const machineMeta = {
  PK: 'PCAT#c1', SK: 'META', itemId: 'c1', sku: 'RIE-300', name: 'RIE 300', series: 'RIE',
  kind: 'MACHINE', requiredOptionSkus: [], requiresSkus: [], excludesSkus: [],
};
const cost = {
  PK: 'PCAT#c1', SK: 'COST#s1#2020-01-01', effectiveFrom: '2020-01-01', effectiveTo: '2099-01-01',
  unitCostFen: 725_000, supplierId: 's1', currency: 'RMB',
  priceSource: 'MANUAL_ENTRY', reviewStatus: 'APPROVED',
};
const policyItem = {
  Item: {
    PK: 'PRICING_POLICY', SK: 'META', fxRmbPerUsdMilli: 7250, defaultMarginBp: 3500,
    minMarginBp: 2000, roundingGranularityUsdCents: 10000, seriesOverrides: {}, itemOverrides: {},
  },
};

function primeHappyPath() {
  send
    .mockResolvedValueOnce(policyItem)                                   // policy Get
    .mockResolvedValueOnce({ Items: [machineMeta, cost] })               // item partition Query (META + costs)
    .mockResolvedValueOnce({ Item: { seq: 7 } })                         // counter Get (consistent)
    .mockResolvedValueOnce({});                                          // TransactWriteCommand
}

const validInput = {
  schemeLabel: 'Standard', customerName: 'MIT Nano',
  lines: [{ itemId: 'c1', qty: 1, lineType: 'NORMAL' }],
};

beforeEach(() => send.mockReset());

describe('pbCreateQuotationDraft', () => {
  it('allocates the number via CAS and writes scheme+header+lines in ONE transaction', async () => {
    primeHappyPath();
    const res = await pbCreateQuotationDraft(ev(validInput)) as Record<string, unknown>;
    expect(res.quotationNumber).toMatch(/^Q-\d{4}-0008$/);
    expect(res.status).toBe('DRAFT');
    expect(res.version).toBe(1);

    const itemQuery = send.mock.calls[1][0];
    expect(itemQuery.input.ConsistentRead).toBe(true); // money-bearing read

    const counterGet = send.mock.calls[2][0];
    expect(counterGet.input.ConsistentRead).toBe(true);

    const tx = send.mock.calls[3][0].input.TransactItems;
    const [counterOp, schemeOp, headerOp, lineOp] = tx;
    expect(counterOp.Update.ConditionExpression).toBe('seq = :expected');
    expect(counterOp.Update.ExpressionAttributeValues[':expected']).toBe(7);
    expect(schemeOp.Put.Item.SK).toBe('SCHEME');
    expect(schemeOp.Put.ConditionExpression).toBe('attribute_not_exists(PK)');
    expect(headerOp.Put.Item.SK).toBe('V#001');
    expect(headerOp.Put.Item.revision).toBe(1);
    expect(lineOp.Put.Item.SK).toBe('V#001#LINE#01');
    expect(lineOp.Put.Item.unitCostFen).toBe(725_000);
    expect(lineOp.Put.Item.fxRmbPerUsdMilli).toBe(7250); // rate snapshotted into the line
    // Full cost provenance in the snapshot (audit-complete):
    expect(lineOp.Put.Item.costSnapshot).toMatchObject({
      supplierId: 's1', unitCostFen: 725_000, currency: 'RMB',
      effectiveFrom: '2020-01-01', effectiveTo: '2099-01-01',
      priceSource: 'MANUAL_ENTRY', reviewStatus: 'APPROVED',
    });
    expect(lineOp.Put.Item.overriddenBy).toBeNull(); // no manual override on this line
    // Header ≡ lines reconciliation: actual total is exactly the line-total sum.
    expect(res.actualTotalUsdCents).toBe(153_846);
    expect((res.lines as Array<{ actualLineTotalUsdCents: number }>)
      .reduce((s, l) => s + l.actualLineTotalUsdCents, 0)).toBe(153_846);
  });

  it('bootstraps a missing year counter with attribute_not_exists and seq 1', async () => {
    send
      .mockResolvedValueOnce(policyItem)
      .mockResolvedValueOnce({ Items: [machineMeta, cost] })
      .mockResolvedValueOnce({})                                         // counter absent
      .mockResolvedValueOnce({});
    const res = await pbCreateQuotationDraft(ev(validInput)) as Record<string, unknown>;
    expect(res.quotationNumber).toMatch(/-0001$/);
    const counterOp = send.mock.calls[3][0].input.TransactItems[0];
    expect(counterOp.Update.ConditionExpression).toBe('attribute_not_exists(PK)');
  });

  it('maps a lost race to CONFLICT', async () => {
    send
      .mockResolvedValueOnce(policyItem)
      .mockResolvedValueOnce({ Items: [machineMeta, cost] })
      .mockResolvedValueOnce({ Item: { seq: 7 } })
      .mockRejectedValueOnce(Object.assign(new Error('x'), { name: 'TransactionCanceledException' }));
    await expect(pbCreateQuotationDraft(ev(validInput))).rejects.toThrow(/^CONFLICT:/);
  });

  it('missing cost coverage yields unknown pricing, not zero, and still saves', async () => {
    send
      .mockResolvedValueOnce(policyItem)
      .mockResolvedValueOnce({ Items: [machineMeta] })                   // no cost versions at all
      .mockResolvedValueOnce({ Item: { seq: 1 } })
      .mockResolvedValueOnce({});
    const res = await pbCreateQuotationDraft(ev(validInput)) as Record<string, unknown>;
    expect(res.incomplete).toBe(true);
    expect(res.totalCostUsdCents).toBeNull();
  });

  it('rejects configuration errors', async () => {
    const needy = { ...machineMeta, requiredOptionSkus: ['CHILLER'] };
    send
      .mockResolvedValueOnce(policyItem)
      .mockResolvedValueOnce({ Items: [needy, cost] });
    await expect(pbCreateQuotationDraft(ev(validInput))).rejects.toThrow(/^VALIDATION:.*CHILLER/);
  });

  it('requires a reason for line-level overrides', async () => {
    send
      .mockResolvedValueOnce(policyItem)
      .mockResolvedValueOnce({ Items: [machineMeta, cost] });
    await expect(pbCreateQuotationDraft(ev({
      ...validInput,
      lines: [{ itemId: 'c1', qty: 1, lineType: 'NORMAL', actualUnitUsdCents: 120_000 }],
    }))).rejects.toThrow(/^VALIDATION:.*reason/i);
  });

  it('rejects duplicate NORMAL itemIds', async () => {
    await expect(pbCreateQuotationDraft(ev({
      ...validInput,
      lines: [{ itemId: 'c1', qty: 1, lineType: 'NORMAL' }, { itemId: 'c1', qty: 2, lineType: 'NORMAL' }],
    }))).rejects.toThrow(/^VALIDATION:.*duplicate/i);
  });

  it('rejects a negative manual override', async () => {
    await expect(pbCreateQuotationDraft(ev({
      ...validInput,
      lines: [{ itemId: 'c1', qty: 1, lineType: 'NORMAL', actualUnitUsdCents: -5, overrideReason: 'x' }],
    }))).rejects.toThrow(/^VALIDATION:.*non-negative/i);
  });

  it('enforces the 45-line cap with a typed error', async () => {
    const lines = Array.from({ length: 46 }, (_, i) => ({ itemId: `c${i}`, qty: 1, lineType: 'NORMAL' }));
    await expect(pbCreateQuotationDraft(ev({ ...validInput, lines }))).rejects.toThrow(/^VALIDATION:.*45/);
  });
});
