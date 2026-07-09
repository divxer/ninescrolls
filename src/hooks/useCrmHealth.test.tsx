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
});
