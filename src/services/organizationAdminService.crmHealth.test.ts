import { describe, it, expect, vi, beforeEach } from 'vitest';
const crmHealth = vi.fn(); const runCrmRepair = vi.fn(); const acknowledgeMergeRecon = vi.fn();
vi.mock('./amplifyClient', () => ({ getAmplifyDataClient: () => ({ queries: { crmHealth }, mutations: { runCrmRepair, acknowledgeMergeRecon } }) }));
import { getCrmHealth, runCrmRepair as runRepair, acknowledgeMergeRecon as ackMergeRecon } from './organizationAdminService';

beforeEach(() => { crmHealth.mockReset(); runCrmRepair.mockReset(); acknowledgeMergeRecon.mockReset(); });

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

describe('acknowledgeMergeRecon service (Task 13, R9)', () => {
  it('passes fromOrgId/toOrgId and returns data', async () => {
    acknowledgeMergeRecon.mockResolvedValueOnce({ data: { ok: true }, errors: undefined });
    expect(await ackMergeRecon('src.com', 'tgt.com')).toEqual({ ok: true });
    expect(acknowledgeMergeRecon).toHaveBeenCalledWith({ fromOrgId: 'src.com', toOrgId: 'tgt.com' }, expect.anything());
  });
  it('surfaces a lost fence result without throwing', async () => {
    acknowledgeMergeRecon.mockResolvedValueOnce({ data: { ok: false, raced: true }, errors: undefined });
    expect(await ackMergeRecon('src.com', 'tgt.com')).toEqual({ ok: false, raced: true });
  });
  it('throws on errors', async () => {
    acknowledgeMergeRecon.mockResolvedValueOnce({ data: null, errors: [{ message: 'boom' }] });
    await expect(ackMergeRecon('src.com', 'tgt.com')).rejects.toThrow('boom');
  });
});
