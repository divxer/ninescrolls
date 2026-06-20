import { describe, it, expect, vi, beforeEach } from 'vitest';

const queries = {
  listLogisticsCases: vi.fn(),
  getLogisticsCase: vi.fn(),
  logisticsStats: vi.fn(),
};
const mutations = {
  createLogisticsCase: vi.fn(),
  advanceLogisticsStage: vi.fn(),
};

vi.mock('./amplifyClient', () => ({
  getAmplifyDataClient: () => ({ queries, mutations }),
}));

import { listLogisticsCases, createLogisticsCase, advanceLogisticsStage } from './logisticsAdminService';

beforeEach(() => {
  Object.values(queries).forEach((f) => f.mockReset());
  Object.values(mutations).forEach((f) => f.mockReset());
});

describe('logisticsAdminService', () => {
  it('listLogisticsCases passes through filters and returns data', async () => {
    queries.listLogisticsCases.mockResolvedValueOnce({ data: { items: [], nextToken: null }, errors: null });
    const res = await listLogisticsCases({ caseType: 'SAMPLE' });
    expect(queries.listLogisticsCases).toHaveBeenCalledWith({ caseType: 'SAMPLE' }, { authMode: 'userPool' });
    expect(res?.items).toEqual([]);
  });

  it('createLogisticsCase JSON-stringifies the input', async () => {
    mutations.createLogisticsCase.mockResolvedValueOnce({ data: { caseId: 'lc-1' }, errors: null });
    await createLogisticsCase({ caseType: 'EQUIPMENT', customerName: 'HORIBA' });
    const arg = mutations.createLogisticsCase.mock.calls[0][0];
    expect(typeof arg.input).toBe('string');
    expect(JSON.parse(arg.input).customerName).toBe('HORIBA');
  });

  it('throws when the API returns errors', async () => {
    mutations.advanceLogisticsStage.mockResolvedValueOnce({ data: null, errors: [{ message: 'nope' }] });
    await expect(advanceLogisticsStage('lc-1', 'PRODUCTION')).rejects.toThrow('nope');
  });
});
