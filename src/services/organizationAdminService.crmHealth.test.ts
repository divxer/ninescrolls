import { describe, it, expect, vi, beforeEach } from 'vitest';
const crmHealth = vi.fn(); const runCrmRepair = vi.fn();
vi.mock('./amplifyClient', () => ({ getAmplifyDataClient: () => ({ queries: { crmHealth }, mutations: { runCrmRepair } }) }));
import { getCrmHealth, runCrmRepair as runRepair } from './organizationAdminService';

beforeEach(() => { crmHealth.mockReset(); runCrmRepair.mockReset(); });

describe('crm health service', () => {
  it('getCrmHealth returns data', async () => {
    crmHealth.mockResolvedValueOnce({ data: { repairPending: { count: 0 } }, errors: undefined });
    expect(await getCrmHealth()).toEqual({ repairPending: { count: 0 } });
  });
  it('runCrmRepair passes limit and returns data', async () => {
    runCrmRepair.mockResolvedValueOnce({ data: { repaired: 2 }, errors: undefined });
    expect(await runRepair({ limit: 50 })).toEqual({ repaired: 2 });
    expect(runCrmRepair).toHaveBeenCalledWith({ limit: 50 }, expect.anything());
  });
  it('throws on errors', async () => {
    crmHealth.mockResolvedValueOnce({ data: null, errors: [{ message: 'boom' }] });
    await expect(getCrmHealth()).rejects.toThrow('boom');
  });
});
