import { describe, it, expect, vi, beforeEach } from 'vitest';

const send = vi.fn();
vi.mock('../lib/dynamodb.js', () => ({
  docClient: { send: (...a: unknown[]) => send(...a) },
  TABLE_NAME: () => 'TestTable',
}));

import { loadLines, pbCreateQuotationDraft } from './quotationResolvers.js';

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

describe('loadLines cost delta snapshot', () => {
  const loadWith = async (...costVersions: Record<string, unknown>[]) => {
    send.mockResolvedValueOnce({ Items: [machineMeta, ...costVersions] });
    return (await loadLines(validInput.lines as Parameters<typeof loadLines>[0]))[0].snapshot;
  };

  it('snapshots the immediately preceding same-supplier cost and delta', async () => {
    const snapshot = await loadWith(
      { ...cost, SK: 'COST#s1#2018-01-01', effectiveFrom: '2018-01-01', effectiveTo: '2019-01-01', unitCostFen: 600_000 },
      { ...cost, SK: 'COST#s1#2019-01-01', effectiveFrom: '2019-01-01', effectiveTo: '2020-01-01', unitCostFen: 700_000 },
      cost,
    );

    expect(snapshot.previousUnitCostFen).toBe(700_000);
    expect(snapshot.costDeltaFen).toBe(25_000);
  });

  it('snapshots null delta fields when the selected cost has no prior version', async () => {
    const snapshot = await loadWith(cost);

    expect(snapshot.previousUnitCostFen).toBeNull();
    expect(snapshot.costDeltaFen).toBeNull();
  });

  it('excludes prior versions from a different supplier', async () => {
    const snapshot = await loadWith(
      { ...cost, SK: 'COST#s2#2019-01-01', supplierId: 's2', effectiveFrom: '2019-01-01', effectiveTo: '2020-01-01', unitCostFen: 700_000 },
      cost,
    );

    expect(snapshot.previousUnitCostFen).toBeNull();
    expect(snapshot.costDeltaFen).toBeNull();
  });
});

describe('pbCreateQuotationDraft', () => {
  it('persists null cost delta fields for surcharge snapshots', async () => {
    send
      .mockResolvedValueOnce(policyItem)
      .mockResolvedValueOnce({ Item: { seq: 7 } })
      .mockResolvedValueOnce({});

    await pbCreateQuotationDraft(ev({
      ...validInput,
      lines: [{ sku: 'FREIGHT', qty: 1, lineType: 'SURCHARGE', surchargeUsdCents: 25_000 }],
    }));

    const line = send.mock.calls[2][0].input.TransactItems[3].Put.Item;
    expect(line).toMatchObject({
      previousUnitCostFen: null,
      costDeltaFen: null,
    });
  });

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

  it('rejects combining a line-level override with a total override', async () => {
    send
      .mockResolvedValueOnce(policyItem)
      .mockResolvedValueOnce({ Items: [machineMeta, cost] });
    await expect(pbCreateQuotationDraft(ev({
      ...validInput,
      lines: [{ itemId: 'c1', qty: 1, lineType: 'NORMAL', actualUnitUsdCents: 120_000, overrideReason: 'deal' }],
      totalOverride: { totalUsdCents: 100_000, reason: 'bundle' },
    }))).rejects.toThrow(/^VALIDATION:.*cannot be combined/);
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

import { pbUpdateQuotationDraft, pbGetQuotation, pbListQuotations } from './quotationResolvers.js';

const headerItem = {
  PK: 'PQUO#Q-2026-0008', SK: 'V#001', quotationNumber: 'Q-2026-0008', version: 1,
  revision: 2, status: 'DRAFT', schemeLabel: 'Standard', customerName: 'MIT Nano',
  lineCount: 2, createdAt: 'T0', createdBy: 'boss@ninescrolls.com',
};

describe('pbUpdateQuotationDraft', () => {
  it('recomputes, CASes the header revision, puts new lines and deletes the tail — one transaction', async () => {
    send
      .mockResolvedValueOnce({ Item: headerItem })                       // header Get (consistent)
      .mockResolvedValueOnce(policyItem)                                 // policy
      .mockResolvedValueOnce({ Items: [machineMeta, cost] })             // line load
      .mockResolvedValueOnce({});                                        // TransactWriteCommand
    const res = await pbUpdateQuotationDraft(ev({
      quotationNumber: 'Q-2026-0008', version: 1, expectedRevision: 2,
      customerName: 'MIT Nano',
      lines: [{ itemId: 'c1', qty: 2, lineType: 'NORMAL' }],             // 2 lines -> 1 line
    })) as Record<string, unknown>;
    expect(res.revision).toBe(3);

    const tx = send.mock.calls[3][0].input.TransactItems;
    const headerOp = tx[0];
    expect(headerOp.Update.ConditionExpression).toContain('revision = :expected');
    expect(headerOp.Update.ConditionExpression).toContain('#status = :draft');
    const putOps = tx.filter((op: Record<string, unknown>) => 'Put' in op);
    const delOps = tx.filter((op: Record<string, unknown>) => 'Delete' in op);
    expect(putOps).toHaveLength(1);                                      // line 1 overwrite
    // Self-healing tail delete: everything beyond the new count up to the cap,
    // regardless of what lineCount claims (idempotent for absent keys).
    expect(delOps).toHaveLength(44);                                     // lineNo 2..45
    expect(delOps[0].Delete.Key.SK).toBe('V#001#LINE#02');
    expect(delOps[43].Delete.Key.SK).toBe('V#001#LINE#45');
  });

  it('marshals the totalOverride summary key (with audit fields) into the header Update', async () => {
    send
      .mockResolvedValueOnce({ Item: headerItem })
      .mockResolvedValueOnce(policyItem)
      .mockResolvedValueOnce({ Items: [machineMeta, cost] })
      .mockResolvedValueOnce({});
    await pbUpdateQuotationDraft(ev({
      quotationNumber: 'Q-2026-0008', version: 1, expectedRevision: 2,
      lines: [{ itemId: 'c1', qty: 2, lineType: 'NORMAL' }],
      totalOverride: { totalUsdCents: 300_000, reason: 'bundle deal' },
    }));
    const headerOp = send.mock.calls[3][0].input.TransactItems[0];
    expect(headerOp.Update.ExpressionAttributeValues[':s_totalOverride']).toMatchObject({
      totalUsdCents: 300_000, reason: 'bundle deal', overriddenBy: 'boss@ninescrolls.com',
    });
  });

  it('rejects a stale revision as CONFLICT without partial application', async () => {
    send
      .mockResolvedValueOnce({ Item: headerItem })
      .mockResolvedValueOnce(policyItem)
      .mockResolvedValueOnce({ Items: [machineMeta, cost] })
      .mockRejectedValueOnce(Object.assign(new Error('x'), { name: 'TransactionCanceledException' }));
    await expect(pbUpdateQuotationDraft(ev({
      quotationNumber: 'Q-2026-0008', version: 1, expectedRevision: 1,
      lines: [{ itemId: 'c1', qty: 1, lineType: 'NORMAL' }],
    }))).rejects.toThrow(/^CONFLICT:/);
  });

  it('refuses to edit a non-DRAFT version', async () => {
    send.mockResolvedValueOnce({ Item: { ...headerItem, status: 'GENERATED' } });
    await expect(pbUpdateQuotationDraft(ev({
      quotationNumber: 'Q-2026-0008', version: 1, expectedRevision: 2,
      lines: [{ itemId: 'c1', qty: 1, lineType: 'NORMAL' }],
    }))).rejects.toThrow(/^VALIDATION:.*DRAFT/);
  });
});

describe('pbGetQuotation', () => {
  it('assembles scheme, versions and their lines from one partition Query', async () => {
    send.mockResolvedValueOnce({
      Items: [
        { PK: 'PQUO#Q-2026-0008', SK: 'SCHEME', quotationNumber: 'Q-2026-0008', latestVersion: 1 },
        headerItem,
        { PK: 'PQUO#Q-2026-0008', SK: 'V#001#LINE#01', lineNo: 1, sku: 'RIE-300' },
      ],
    });
    const res = await pbGetQuotation(ev({ quotationNumber: 'Q-2026-0008' })) as {
      scheme: Record<string, unknown>; versions: Array<{ lines: unknown[] }>;
    };
    expect(res.scheme.latestVersion).toBe(1);
    expect(res.versions).toHaveLength(1);
    expect(res.versions[0].lines).toHaveLength(1);
  });
});

describe('pbListQuotations', () => {
  it('queries the QUOTATIONS GSI partition newest-first', async () => {
    send.mockResolvedValueOnce({ Items: [{ ...headerItem, GSI1PK: 'QUOTATIONS', GSI1SK: 'x' }] });
    const res = await pbListQuotations(ev({})) as { items: unknown[] };
    expect(res.items).toHaveLength(1);
    const q = send.mock.calls[0][0].input;
    expect(q.IndexName).toBe('GSI1');
    expect(q.ScanIndexForward).toBe(false);
  });

  it('rejects a garbage nextToken with a typed error', async () => {
    await expect(pbListQuotations(
      { ...ev({}), arguments: { nextToken: 'garbage!!' } } as never,
    )).rejects.toThrow(/^VALIDATION:/);
  });
});
