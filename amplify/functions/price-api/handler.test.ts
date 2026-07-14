import { describe, it, expect, vi } from 'vitest';

vi.mock('./resolvers/supplierResolvers.js', () => ({
  pbListSuppliers: vi.fn(async () => ({ items: [] })),
  pbCreateSupplier: vi.fn(async () => ({ supplierId: 's1' })),
  pbUpdateSupplier: vi.fn(async () => ({ supplierId: 's1' })),
}));
vi.mock('./resolvers/catalogResolvers.js', () => ({
  pbListCatalogItems: vi.fn(async () => ({ items: [] })),
  pbCreateCatalogItem: vi.fn(async () => ({})),
  pbUpdateCatalogItem: vi.fn(async () => ({})),
}));
vi.mock('./resolvers/costVersionResolvers.js', () => ({
  pbAppendCostVersion: vi.fn(async () => ({})),
  pbListCostVersions: vi.fn(async () => ({ items: [] })),
}));
vi.mock('./resolvers/policyResolvers.js', () => ({
  pbGetPricingPolicy: vi.fn(async () => ({})),
  pbUpdatePricingPolicy: vi.fn(async () => ({})),
}));
vi.mock('./resolvers/quotationResolvers.js', () => ({
  pbCreateQuotationDraft: vi.fn(async () => ({})),
  pbUpdateQuotationDraft: vi.fn(async () => ({})),
  pbGetQuotation: vi.fn(async () => ({})),
  pbListQuotations: vi.fn(async () => ({ items: [] })),
}));

import { handler, RESOLVER_FIELDS } from './handler.js';
import * as supplierResolvers from './resolvers/supplierResolvers.js';
import * as catalogResolvers from './resolvers/catalogResolvers.js';
import * as costVersionResolvers from './resolvers/costVersionResolvers.js';
import * as policyResolvers from './resolvers/policyResolvers.js';
import * as quotationResolvers from './resolvers/quotationResolvers.js';
import { beforeEach, type Mock } from 'vitest';

const adminIdentity = { sub: 's', groups: ['admin'] };
const nonAdminIdentity = { sub: 's', claims: { email: 'x@y.z' } };

// The COMPLETE operation surface — must match handler.ts's resolver map exactly.
const ALL_OPS = [
  'pbListSuppliers', 'pbCreateSupplier', 'pbUpdateSupplier',
  'pbListCatalogItems', 'pbCreateCatalogItem', 'pbUpdateCatalogItem',
  'pbAppendCostVersion', 'pbListCostVersions',
  'pbGetPricingPolicy', 'pbUpdatePricingPolicy',
  'pbCreateQuotationDraft', 'pbUpdateQuotationDraft', 'pbGetQuotation', 'pbListQuotations',
] as const;

const resolverMocks = {
  ...supplierResolvers, ...catalogResolvers, ...costVersionResolvers,
  ...policyResolvers, ...quotationResolvers,
} as unknown as Record<string, Mock>;

beforeEach(() => Object.values(resolverMocks).forEach((f) => f.mockClear()));

describe('price-api handler', () => {
  it('dispatches by fieldName for an admin caller', async () => {
    const res = await handler({
      info: { fieldName: 'pbListSuppliers', parentTypeName: 'Query' },
      arguments: {},
      identity: adminIdentity,
    });
    expect(res).toEqual({ items: [] });
  });

  it('normalizes the Gen-2 top-level fieldName shape', async () => {
    const res = await handler({
      fieldName: 'pbListSuppliers', typeName: 'Query', arguments: {}, identity: adminIdentity,
    });
    expect(res).toEqual({ items: [] });
  });

  // Table-driven: every operation routes to its own resolver (mocks are
  // cleared in beforeEach, so called-once proves per-op routing).
  it.each(ALL_OPS)('dispatches %s to its own resolver for an admin caller', async (op) => {
    await handler({ info: { fieldName: op, parentTypeName: 'Query' }, arguments: {}, identity: adminIdentity });
    expect(resolverMocks[op]).toHaveBeenCalledTimes(1);
  });

  // Table-driven: all 14 operations × both event shapes; the resolver must
  // NEVER execute on a rejected call.
  it.each(ALL_OPS)('rejects non-admin for %s in both event shapes, without dispatch', async (op) => {
    await expect(handler({
      info: { fieldName: op, parentTypeName: 'Query' }, arguments: {}, identity: nonAdminIdentity,
    })).rejects.toThrow(/^UNAUTHORIZED:/);
    await expect(handler({
      fieldName: op, typeName: 'Query', arguments: {}, identity: nonAdminIdentity,
    })).rejects.toThrow(/^UNAUTHORIZED:/);
    expect(resolverMocks[op]).not.toHaveBeenCalled();
  });

  it('covers the full resolver map (guards against adding an op without gate coverage)', () => {
    // Test-file mocks match the op table…
    expect(Object.keys(resolverMocks).sort()).toEqual([...ALL_OPS].sort());
    // …AND the handler's REAL dispatch map matches it too (the map keys are
    // literal identifiers, so RESOLVER_FIELDS reflects the real map even
    // though the resolver modules are vi.mocked).
    expect([...RESOLVER_FIELDS].sort()).toEqual([...ALL_OPS].sort());
  });

  it('throws on unknown field', async () => {
    await expect(handler({
      info: { fieldName: 'nope', parentTypeName: 'Query' }, arguments: {}, identity: adminIdentity,
    })).rejects.toThrow(/No resolver/);
  });
});
