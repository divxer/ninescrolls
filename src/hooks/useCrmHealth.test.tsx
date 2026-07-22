import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import * as svc from '../services/organizationAdminService';
vi.mock('../services/organizationAdminService');
import { useCrmHealth } from './useCrmHealth';

beforeEach(() => vi.resetAllMocks());

describe('useCrmHealth', () => {
  it('loads health data on mount', async () => {
    vi.mocked(svc.getCrmHealth).mockResolvedValueOnce({ repairPending: { count: 0 } } as never);
    const { result } = renderHook(() => useCrmHealth());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual({ repairPending: { count: 0 } });
    expect(svc.getCrmHealth).toHaveBeenCalled();
  });

  it('runRepair on a lease-held response shows "already running" (does not report a repair count)', async () => {
    vi.mocked(svc.getCrmHealth).mockResolvedValue({ repairPending: { count: 0 } } as never);
    vi.mocked(svc.runCrmRepair).mockResolvedValueOnce({ skippedLeaseHeld: true } as never);
    const { result } = renderHook(() => useCrmHealth());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.runRepair(); });
    expect(result.current.runMsg).toMatch(/already running/i);
    expect(result.current.runMsg).not.toMatch(/repaired/i);
  });

  it('runRepair on a normal drain reports repaired + stuck counts and reloads', async () => {
    vi.mocked(svc.getCrmHealth).mockResolvedValue({ repairPending: { count: 0 } } as never);
    vi.mocked(svc.runCrmRepair).mockResolvedValueOnce({ repaired: 3, stuck: 1 } as never);
    const { result } = renderHook(() => useCrmHealth());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.runRepair(); });
    expect(result.current.runMsg).toBe('repaired 3, stuck 1');
    expect(svc.getCrmHealth).toHaveBeenCalledTimes(2); // initial load + reload after runRepair
  });

  it('runRepair surfaces a failure message', async () => {
    vi.mocked(svc.getCrmHealth).mockResolvedValue({ repairPending: { count: 0 } } as never);
    vi.mocked(svc.runCrmRepair).mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => useCrmHealth());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.runRepair(); });
    expect(result.current.runMsg).toMatch(/failed: boom/i);
  });

  it('surfaces mergeReviewMarkers from the raw data, parsing a JSON-string field defensively', async () => {
    vi.mocked(svc.getCrmHealth).mockResolvedValueOnce({
      repairPending: { count: 0 }, mergeNeedsReviewCount: 1,
      mergeReviewMarkers: JSON.stringify([{ fromOrgId: 'src.com', toOrgId: 'tgt.com', residualsDetected: true, residualSamples: ['RFQ#1'], probedAt: 'p1' }]),
    } as never);
    const { result } = renderHook(() => useCrmHealth());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.mergeNeedsReviewCount).toBe(1);
    expect(result.current.mergeReviewMarkers).toEqual([{ fromOrgId: 'src.com', toOrgId: 'tgt.com', residualsDetected: true, residualSamples: ['RFQ#1'], probedAt: 'p1' }]);
  });

  it('acknowledge: a successful fenced flip refetches the health data', async () => {
    vi.mocked(svc.getCrmHealth).mockResolvedValue({ repairPending: { count: 0 } } as never);
    vi.mocked(svc.acknowledgeMergeRecon).mockResolvedValueOnce({ ok: true });
    const { result } = renderHook(() => useCrmHealth());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.acknowledge('src.com', 'tgt.com'); });
    expect(svc.acknowledgeMergeRecon).toHaveBeenCalledWith('src.com', 'tgt.com');
    expect(svc.getCrmHealth).toHaveBeenCalledTimes(2); // initial load + reload after acknowledge
    expect(result.current.ackInFlight).toBeNull();
    expect(result.current.ackError).toBeNull();
  });

  it('acknowledge: a lost fence ({ok:false,raced:true}) surfaces ackError but still refetches', async () => {
    vi.mocked(svc.getCrmHealth).mockResolvedValue({ repairPending: { count: 0 } } as never);
    vi.mocked(svc.acknowledgeMergeRecon).mockResolvedValueOnce({ ok: false, raced: true });
    const { result } = renderHook(() => useCrmHealth());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.acknowledge('src.com', 'tgt.com'); });
    expect(result.current.ackError).toMatch(/already acknowledged/i);
    expect(svc.getCrmHealth).toHaveBeenCalledTimes(2);
  });

  it('acknowledge: sets ackInFlight to the "from|to" key while in progress', async () => {
    vi.mocked(svc.getCrmHealth).mockResolvedValue({ repairPending: { count: 0 } } as never);
    let resolveAck: (v: unknown) => void = () => {};
    vi.mocked(svc.acknowledgeMergeRecon).mockReturnValueOnce(new Promise((res) => { resolveAck = res; }) as never);
    const { result } = renderHook(() => useCrmHealth());
    await waitFor(() => expect(result.current.loading).toBe(false));
    let ackPromise!: Promise<unknown>;
    act(() => { ackPromise = result.current.acknowledge('src.com', 'tgt.com'); });
    await waitFor(() => expect(result.current.ackInFlight).toBe('src.com|tgt.com'));
    await act(async () => { resolveAck({ ok: true }); await ackPromise; });
    expect(result.current.ackInFlight).toBeNull();
  });
});
