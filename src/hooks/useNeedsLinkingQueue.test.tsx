import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import * as svc from '../services/organizationAdminService';
vi.mock('../services/organizationAdminService');
import { useNeedsLinkingQueue } from './useNeedsLinkingQueue';

beforeEach(() => vi.resetAllMocks());

describe('useNeedsLinkingQueue', () => {
  it('loads page 1 and exposes items + hasMore', async () => {
    vi.mocked(svc.getNeedsLinkingQueue).mockResolvedValueOnce({ items: [{ unitKey: 'u1' }, { unitKey: 'u2' }], nextToken: 'T1' } as never);
    const { result } = renderHook(() => useNeedsLinkingQueue());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items).toHaveLength(2);
    expect(result.current.hasMore).toBe(true);
    expect(svc.getNeedsLinkingQueue).toHaveBeenCalledWith({ nextToken: undefined });
  });

  it('loadMore appends the next page', async () => {
    vi.mocked(svc.getNeedsLinkingQueue)
      .mockResolvedValueOnce({ items: [{ unitKey: 'u1' }], nextToken: 'T1' } as never)
      .mockResolvedValueOnce({ items: [{ unitKey: 'u2' }], nextToken: null } as never);
    const { result } = renderHook(() => useNeedsLinkingQueue());
    await waitFor(() => expect(result.current.hasMore).toBe(true));
    await act(async () => { await result.current.loadMore(); });
    expect(result.current.items.map((i: { unitKey: string }) => i.unitKey)).toEqual(['u1', 'u2']);
    expect(result.current.hasMore).toBe(false);
    expect(svc.getNeedsLinkingQueue).toHaveBeenLastCalledWith({ nextToken: 'T1' });
  });

  it('evictUnit removes EVERY loaded row with the same unitKey (client-side, no service call)', async () => {
    vi.mocked(svc.getNeedsLinkingQueue).mockResolvedValueOnce({ items: [{ unitKey: 'u1' }, { unitKey: 'u2' }, { unitKey: 'u1' }], nextToken: null } as never);
    const { result } = renderHook(() => useNeedsLinkingQueue());
    await waitFor(() => expect(result.current.items).toHaveLength(3));
    const callsBefore = vi.mocked(svc.getNeedsLinkingQueue).mock.calls.length;
    act(() => result.current.evictUnit('u1'));
    expect(result.current.items.map((i: { unitKey: string }) => i.unitKey)).toEqual(['u2']);   // BOTH u1 rows gone
    expect(vi.mocked(svc.getNeedsLinkingQueue).mock.calls.length).toBe(callsBefore);            // NO refetch
  });

  it('surfaces errors', async () => {
    vi.mocked(svc.getNeedsLinkingQueue).mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => useNeedsLinkingQueue());
    await waitFor(() => expect(result.current.error?.message).toBe('boom'));
  });
});
