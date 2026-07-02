import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import * as svc from '../services/orderAdminService';

vi.mock('../services/orderAdminService');

import { useRfqs } from './useRfqs';

beforeEach(() => {
  vi.resetAllMocks();
});

describe('useRfqs', () => {
  it('loads a status-filtered first page and exposes pagination state', async () => {
    vi.mocked(svc.listRfqs).mockResolvedValueOnce({
      items: [{ rfqId: 'rfq-1', status: 'pending' }],
      nextToken: 'cursor-1',
    } as never);

    const { result } = renderHook(() => useRfqs('pending', 50));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(svc.listRfqs).toHaveBeenCalledWith('pending', 50);
    expect(result.current.rfqs).toHaveLength(1);
    expect(result.current.hasMore).toBe(true);
  });

  it('loads additional status-filtered RFQs with the current nextToken', async () => {
    vi.mocked(svc.listRfqs)
      .mockResolvedValueOnce({
        items: [{ rfqId: 'rfq-1', status: 'pending' }],
        nextToken: 'cursor-1',
      } as never)
      .mockResolvedValueOnce({
        items: [{ rfqId: 'rfq-2', status: 'pending' }],
        nextToken: null,
      } as never);

    const { result } = renderHook(() => useRfqs('pending', 50));
    await waitFor(() => expect(result.current.hasMore).toBe(true));

    act(() => result.current.loadMore());

    await waitFor(() => expect(result.current.rfqs).toHaveLength(2));
    expect(svc.listRfqs).toHaveBeenLastCalledWith('pending', 50, 'cursor-1');
    expect(result.current.hasMore).toBe(false);
  });

  it('reports loading immediately when a lazily-enabled instance is turned on (no stale-empty flash)', async () => {
    vi.mocked(svc.listRfqs).mockResolvedValue({ items: [], nextToken: null } as never);

    const { result, rerender } = renderHook(
      ({ status, enabled }) => useRfqs(status, 50, enabled),
      { initialProps: { status: undefined as string | undefined, enabled: false } },
    );

    // Disabled instance settles to not-loading without fetching.
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(svc.listRfqs).not.toHaveBeenCalled();

    // Enabling for a status must flip loading true synchronously — before the
    // fetch effect resolves — so the page never renders a stale empty list.
    rerender({ status: 'pending', enabled: true });
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(svc.listRfqs).toHaveBeenCalledWith('pending', 50);
  });
});
