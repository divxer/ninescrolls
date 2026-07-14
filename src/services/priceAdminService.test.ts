import { describe, it, expect, vi, beforeEach } from 'vitest';

const queries = {
  pbListSuppliers: vi.fn(), pbListCatalogItems: vi.fn(), pbListCostVersions: vi.fn(),
  pbGetPricingPolicy: vi.fn(), pbGetQuotation: vi.fn(), pbListQuotations: vi.fn(),
};
const mutations = {
  pbCreateSupplier: vi.fn(), pbUpdateSupplier: vi.fn(),
  pbCreateCatalogItem: vi.fn(), pbUpdateCatalogItem: vi.fn(),
  pbAppendCostVersion: vi.fn(), pbUpdatePricingPolicy: vi.fn(),
  pbCreateQuotationDraft: vi.fn(), pbUpdateQuotationDraft: vi.fn(),
};

vi.mock('./amplifyClient', () => ({
  getAmplifyDataClient: () => ({ queries, mutations }),
}));

import * as svc from './priceAdminService';

beforeEach(() => Object.values({ ...queries, ...mutations }).forEach((f) => f.mockReset()));

describe('priceAdminService', () => {
  it('unwraps JSON-string payloads', async () => {
    queries.pbListSuppliers.mockResolvedValueOnce({ data: JSON.stringify({ items: [{ supplierId: 's1' }] }) });
    const res = await svc.listSuppliers();
    expect(res.items[0].supplierId).toBe('s1');
  });

  it('passes objects through unchanged', async () => {
    queries.pbGetPricingPolicy.mockResolvedValueOnce({ data: { fxRmbPerUsdMilli: 7250 } });
    const res = await svc.getPricingPolicy();
    expect(res.fxRmbPerUsdMilli).toBe(7250);
  });

  it('serializes mutation inputs as JSON strings', async () => {
    mutations.pbCreateSupplier.mockResolvedValueOnce({ data: '{}' });
    await svc.createSupplier({ name: 'OEM' });
    const [args] = mutations.pbCreateSupplier.mock.calls[0];
    expect(typeof args.input).toBe('string');
    expect(JSON.parse(args.input).name).toBe('OEM');
  });

  it('surfaces GraphQL errors as thrown Errors', async () => {
    queries.pbListQuotations.mockResolvedValueOnce({ errors: [{ message: 'UNAUTHORIZED: admin group required' }] });
    await expect(svc.listQuotations()).rejects.toThrow(/UNAUTHORIZED/);
  });
});
