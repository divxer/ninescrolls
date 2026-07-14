import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FakeDdb, gatedSend } from '../lib/testing/fakeDdb.js';

let sendImpl: (cmd: unknown) => Promise<unknown> = async () => ({});
vi.mock('../lib/dynamodb.js', () => ({
  docClient: { send: (cmd: unknown) => sendImpl(cmd) },
  TABLE_NAME: () => 'TestTable',
}));

import { pbAppendCostVersion } from './costVersionResolvers.js';
import { pbCreateQuotationDraft, pbUpdateQuotationDraft } from './quotationResolvers.js';

const ev = (input: Record<string, unknown>) => ({
  info: { fieldName: 'x', parentTypeName: 'Mutation' },
  arguments: { input },
  identity: { sub: 's', groups: ['admin'], claims: { email: 'boss@ninescrolls.com' } },
});

const machineMeta = {
  PK: 'PCAT#c1', SK: 'META', GSI1PK: 'CATALOG_ITEMS', GSI1SK: 'RIE#RIE-300',
  itemId: 'c1', sku: 'RIE-300', name: 'RIE 300', series: 'RIE', kind: 'MACHINE',
  requiredOptionSkus: [], requiresSkus: [], excludesSkus: [],
};
const activeCost = {
  PK: 'PCAT#c1', SK: 'COST#s1#2020-01-01', itemId: 'c1', supplierId: 's1',
  unitCostFen: 725_000, currency: 'RMB', effectiveFrom: '2020-01-01', effectiveTo: '2099-01-01',
  priceSource: 'MANUAL_ENTRY', reviewStatus: 'APPROVED',
};
const settle = (ps: Promise<unknown>[]) => Promise.allSettled(ps);

beforeEach(() => { sendImpl = async () => ({}); });

describe('concurrency invariants (deterministic worst-case interleaving)', () => {
  it('CostVersion: two racers on the same gap — exactly one wins, exactly one version lands', async () => {
    const fake = new FakeDdb();
    fake.seed([machineMeta, { PK: 'PSUP#s1', SK: 'META', supplierId: 's1', name: 'OEM' }]);
    sendImpl = gatedSend(fake, 4);
    const mk = (from: string, to: string) => pbAppendCostVersion(ev({
      itemId: 'c1', supplierId: 's1', unitCostFen: 100,
      effectiveFrom: from, effectiveTo: to, priceSource: 'MANUAL_ENTRY',
    }));
    const results = await settle([mk('2026-01-01', '2026-07-01'), mk('2026-03-01', '2026-09-01')]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
    expect(fulfilled).toHaveLength(1);
    expect(rejected[0].reason.message).toMatch(/^CONFLICT:/);
    const versions = [...fake.store.keys()].filter((k) => k.includes('|COST#s1#'));
    expect(versions).toHaveLength(1);
    expect(fake.store.get('PCAT#c1|COSTGUARD#s1')!.revision).toBe(1);
  });

  it('Quotation numbers: two concurrent creates never share a number; retry gets the next one', async () => {
    const fake = new FakeDdb();
    fake.seed([machineMeta, activeCost]);
    sendImpl = gatedSend(fake, 6);
    const mk = () => pbCreateQuotationDraft(ev({
      schemeLabel: 'Standard', customerName: 'MIT Nano',
      lines: [{ itemId: 'c1', qty: 1, lineType: 'NORMAL' }],
    }));
    const results = await settle([mk(), mk()]);
    const won = results.filter((r) => r.status === 'fulfilled') as PromiseFulfilledResult<{ quotationNumber: string }>[];
    expect(won).toHaveLength(1);
    expect(results.some((r) => r.status === 'rejected'
      && /^CONFLICT:/.test((r as PromiseRejectedResult).reason.message))).toBe(true);

    sendImpl = (cmd) => fake.send(cmd as never);
    const retry = await mk() as { quotationNumber: string };
    expect(retry.quotationNumber).not.toBe(won[0].value.quotationNumber);
    const counter = fake.store.get(`COUNTER#QUOTATION|YEAR#${new Date().getFullYear()}`)!.seq;
    const schemes = [...fake.store.keys()].filter((k) => k.endsWith('|SCHEME'));
    expect(counter).toBe(schemes.length);
  });

  it('DRAFT edit: stale racer applies NONE of its line delta', async () => {
    const fake = new FakeDdb();
    fake.seed([machineMeta, activeCost]);
    sendImpl = (cmd) => fake.send(cmd as never);
    const created = await pbCreateQuotationDraft(ev({
      schemeLabel: 'Standard', customerName: 'MIT Nano',
      lines: [{ itemId: 'c1', qty: 1, lineType: 'NORMAL' }, { sku: 'FREIGHT', qty: 1, lineType: 'SURCHARGE', surchargeUsdCents: 100 }],
    })) as { quotationNumber: string };

    sendImpl = gatedSend(fake, 6);
    const edit = (qty: number) => pbUpdateQuotationDraft(ev({
      quotationNumber: created.quotationNumber, version: 1, expectedRevision: 1,
      lines: [{ itemId: 'c1', qty, lineType: 'NORMAL' }],
    }));
    const results = await settle([edit(2), edit(3)]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);

    const header = fake.store.get(`PQUO#${created.quotationNumber}|V#001`)!;
    expect(header.revision).toBe(2);
    expect(header.lineCount).toBe(1);
    const lines = [...fake.store.keys()].filter((k) => k.includes('|V#001#LINE#'));
    expect(lines).toHaveLength(1);
  });
});
