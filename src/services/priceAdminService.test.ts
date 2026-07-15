import { describe, it, expect, vi, beforeEach } from 'vitest';

const queries = {
  pbListSuppliers: vi.fn(), pbListCatalogItems: vi.fn(), pbListCostVersions: vi.fn(),
  pbGetPricingPolicy: vi.fn(), pbGetQuotation: vi.fn(), pbListQuotations: vi.fn(),
  pbListHistoricalQuotations: vi.fn(), pbGetHistoricalQuotation: vi.fn(),
};
const mutations = {
  pbCreateSupplier: vi.fn(), pbUpdateSupplier: vi.fn(),
  pbCreateCatalogItem: vi.fn(), pbUpdateCatalogItem: vi.fn(),
  pbAppendCostVersion: vi.fn(), pbUpdatePricingPolicy: vi.fn(),
  pbCreateQuotationDraft: vi.fn(), pbUpdateQuotationDraft: vi.fn(),
  pbImportHistoricalQuotations: vi.fn(), pbRollbackHistoricalQuotationImport: vi.fn(),
};

vi.mock('./amplifyClient', () => ({
  getAmplifyDataClient: () => ({ queries, mutations }),
}));

import * as svc from './priceAdminService';

beforeEach(() => Object.values({ ...queries, ...mutations }).forEach((f) => f.mockReset()));

describe('priceAdminService', () => {
  it.each([
    ['19.99', 1999],
    ['90071992547409.91', Number.MAX_SAFE_INTEGER],
  ])('converts RMB %s to exact safe fen', (amount, expected) => {
    expect(svc.rmbToFen(amount)).toBe(expected);
  });

  it.each(['90071992547409.92', '99999999999999999999999999', '1.234'])('rejects invalid or unsafe RMB %s', (amount) => {
    expect(() => svc.rmbToFen(amount)).toThrow(/RMB amount/i);
  });
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

  it('accepts historical quotation lines without cost delta fields', async () => {
    queries.pbGetQuotation.mockResolvedValueOnce({
      data: {
        scheme: null,
        versions: [{ lines: [{ lineNo: 1, sku: 'RIE-300' }] }],
      },
    });

    const result = await svc.getQuotation('Q-2025-0001');
    const historicalLine: svc.QuotationLineSnapshot = result.versions[0].lines[0];

    expect(historicalLine.previousUnitCostFen).toBeUndefined();
    expect(historicalLine.costDeltaFen).toBeUndefined();
  });

  it('selects and unwraps all four historical operations', async () => {
    queries.pbListHistoricalQuotations.mockResolvedValueOnce({ data: JSON.stringify({ items: [], nextToken: null }) });
    queries.pbGetHistoricalQuotation.mockResolvedValueOnce({ data: JSON.stringify({ historicalId: 'h' }) });
    mutations.pbImportHistoricalQuotations.mockResolvedValueOnce({ data: JSON.stringify([{ status: 'IMPORTED' }]) });
    mutations.pbRollbackHistoricalQuotationImport.mockResolvedValueOnce({ data: JSON.stringify({ mode: 'PREVIEW' }) });
    await svc.listHistoricalQuotations({ limit: 1 });
    await svc.getHistoricalQuotation('h');
    await svc.importHistoricalQuotations({ importBatchId: 'b', sourceDocument: 's', sourceDocumentHash: 'x', rows: [] });
    await svc.rollbackHistoricalQuotationImport({ importBatchId: 'b', mode: 'PREVIEW' });
    expect(queries.pbListHistoricalQuotations).toHaveBeenCalledWith({ limit: 1 }, { authMode: 'userPool' });
    expect(JSON.parse(queries.pbGetHistoricalQuotation.mock.calls[0][0].input)).toEqual({ historicalId: 'h' });
    expect(JSON.parse(mutations.pbImportHistoricalQuotations.mock.calls[0][0].input).importBatchId).toBe('b');
    expect(JSON.parse(mutations.pbRollbackHistoricalQuotationImport.mock.calls[0][0].input).mode).toBe('PREVIEW');
  });
});
