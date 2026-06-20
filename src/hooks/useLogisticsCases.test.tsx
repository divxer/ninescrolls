import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import * as svc from '../services/logisticsAdminService';

vi.mock('../services/logisticsAdminService');

import { useLogisticsCases, useLogisticsCase, useLogisticsStats } from './useLogisticsCases';

beforeEach(() => {
  vi.resetAllMocks();
});

describe('useLogisticsCases', () => {
  it('loads the first page and exposes cases', async () => {
    vi.mocked(svc.listLogisticsCases).mockResolvedValueOnce({ items: [{ caseId: 'lc-1' }], nextToken: null } as never);
    const { result } = renderHook(() => useLogisticsCases({ caseType: 'SAMPLE' }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.cases).toHaveLength(1);
    expect(result.current.hasMore).toBe(false);
    expect(svc.listLogisticsCases).toHaveBeenCalledWith({ caseType: 'SAMPLE', stage: undefined, customsRequired: undefined, search: undefined, limit: 50 });
  });

  it('surfaces errors', async () => {
    vi.mocked(svc.listLogisticsCases).mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => useLogisticsCases());
    await waitFor(() => expect(result.current.error?.message).toBe('boom'));
  });

  it('forwards relatedOrderId to the service', async () => {
    vi.mocked(svc.listLogisticsCases).mockResolvedValueOnce({ items: [], nextToken: null } as never);
    const { result } = renderHook(() => useLogisticsCases({ relatedOrderId: 'ord-1' }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(svc.listLogisticsCases).toHaveBeenCalledWith(
      expect.objectContaining({ relatedOrderId: 'ord-1' }),
    );
  });
});

describe('useLogisticsCase', () => {
  it('loads one case', async () => {
    vi.mocked(svc.getLogisticsCase).mockResolvedValueOnce({ caseId: 'lc-1', currentStage: 'DRAFT' } as never);
    const { result } = renderHook(() => useLogisticsCase('lc-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.logisticsCase?.caseId).toBe('lc-1');
  });
});

describe('useLogisticsStats', () => {
  it('loads stats', async () => {
    vi.mocked(svc.fetchLogisticsStats).mockResolvedValueOnce({ totalActive: 3, byType: '{}', byStage: '{}', customsInProgress: 1, stalledCases: 0 } as never);
    const { result } = renderHook(() => useLogisticsStats());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.stats?.totalActive).toBe(3);
  });
});
