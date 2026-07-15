import { beforeEach, describe, expect, it, vi } from 'vitest';

const send = vi.fn();
vi.mock('../lib/dynamodb.js', () => ({
  docClient: { send: (...args: unknown[]) => send(...args) }, TABLE_NAME: () => 'TestTable',
}));

import { RESOLVER_FIELDS } from '../handler.js';
import { pbCreateSupplier, pbUpdateSupplier } from './supplierResolvers.js';
import { pbCreateCatalogItem, pbUpdateCatalogItem } from './catalogResolvers.js';
import { pbAppendCostVersion } from './costVersionResolvers.js';
import { pbUpdatePricingPolicy } from './policyResolvers.js';
import { pbCreateQuotationDraft, pbUpdateQuotationDraft } from './quotationResolvers.js';

const adversarialIds = ['PHIST#x', 'HISTIMPORT#x', '../PHIST#x', 'x#PHIST#y'];
const event = (input: Record<string, unknown>) => ({ info: { fieldName: 'x', parentTypeName: 'Mutation' },
  arguments: { input }, identity: { sub: 'operator', groups: ['admin'] } });
const surcharge = (id: string) => ({ itemId: id, sku: id, qty: 1, lineType: 'SURCHARGE', surchargeUsdCents: 100 });

const cases = {
  pbCreateQuotationDraft: { prefix: /^(?:PQUO#|COUNTER#QUOTATION)/, invoke: (id: string) => pbCreateQuotationDraft(event({
    rfqId: id, schemeLabel: 'S', customerName: 'C', lines: [surcharge(id)],
  })) },
  pbUpdateQuotationDraft: { prefix: /^PQUO#/, invoke: (id: string) => pbUpdateQuotationDraft(event({
    quotationNumber: id, version: 1, expectedRevision: 1, lines: [surcharge(id)],
  })) },
  pbCreateSupplier: { prefix: /^(?:PSUP#|COUNTER#SUPPLIER)/, invoke: (id: string) => pbCreateSupplier(event({ name: id })) },
  pbUpdateSupplier: { prefix: /^PSUP#/, invoke: (id: string) => pbUpdateSupplier(event({ supplierId: id, name: 'safe' })) },
  pbCreateCatalogItem: { prefix: /^(?:PCAT#|PCATSKU#)/, invoke: (id: string) => pbCreateCatalogItem(event({
    sku: id, name: 'N', series: 'S', kind: 'MACHINE',
  })) },
  pbUpdateCatalogItem: { prefix: /^PCAT#/, invoke: (id: string) => pbUpdateCatalogItem(event({ itemId: id, name: 'N' })) },
  pbAppendCostVersion: { prefix: /^(?:PCAT#|PSUP#)/, invoke: (id: string) => pbAppendCostVersion(event({ itemId: id,
    supplierId: id, unitCostFen: 1, effectiveFrom: '2026-01-01', effectiveTo: '2026-02-01', priceSource: 'MANUAL_ENTRY',
  })) },
  pbUpdatePricingPolicy: { prefix: /^PRICING_POLICY$/, invoke: (id: string) => pbUpdatePricingPolicy(event({
    itemOverrides: { [id]: 100 },
  })) },
} as const;

const READ_OPERATIONS = [
  'pbListSuppliers', 'pbListCatalogItems', 'pbListCostVersions', 'pbGetPricingPolicy',
  'pbGetQuotation', 'pbListQuotations', 'pbListHistoricalQuotations', 'pbGetHistoricalQuotation',
] as const;

const TRUSTED_OPERATOR_MUTATIONS = [
  'pbImportHistoricalQuotations', 'pbRollbackHistoricalQuotationImport',
] as const;

const keyedObjects = (value: unknown): Array<{ PK: unknown }> => {
  if (!value || typeof value !== 'object') return [];
  const object = value as Record<string, unknown>;
  return [...('PK' in object ? [object as { PK: unknown }] : []),
    ...Object.values(object).flatMap(keyedObjects)];
};

beforeEach(() => {
  send.mockReset();
  send.mockImplementation(async (command) => {
    const input = command?.input ?? {};
    if (command?.constructor.name === 'GetCommand' && input.Key?.PK?.startsWith('PQUO#')) {
      return { Item: { status: 'DRAFT', customerName: 'C', revision: 1, GSI1SK: 'old' } };
    }
    if (command?.constructor.name === 'QueryCommand') return { Items: [] };
    return {};
  });
});

describe('price mutation keyspace immutability', () => {
  it('classifies the complete real dispatch surface so any future operation causes drift', () => {
    expect([...RESOLVER_FIELDS].sort()).toEqual([
      ...READ_OPERATIONS, ...TRUSTED_OPERATOR_MUTATIONS, ...Object.keys(cases),
    ].sort());
  });

  it.each(Object.entries(cases))('%s emits only owned keys for adversarial identifiers', async (_name, spec) => {
    for (const id of adversarialIds) {
      send.mockClear();
      try { await spec.invoke(id); } catch { /* command capture is the assertion surface */ }
      const keys = send.mock.calls
        .filter(call => ['PutCommand', 'UpdateCommand', 'DeleteCommand', 'TransactWriteCommand'].includes(call[0]?.constructor.name))
        .flatMap(call => keyedObjects(call[0]?.input));
      expect(keys.length).toBeGreaterThan(0);
      for (const key of keys) {
        expect(key.PK).toEqual(expect.any(String));
        expect(key.PK).toMatch(spec.prefix);
        expect(key.PK).not.toMatch(/^(?:PHIST|HISTIMPORT)#/);
      }
    }
  });
});
