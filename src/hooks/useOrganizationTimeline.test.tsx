import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import * as svc from '../services/organizationAdminService';
vi.mock('../services/organizationAdminService');
import { useOrganizationTimeline } from './useOrganizationTimeline';

beforeEach(() => vi.resetAllMocks());

describe('useOrganizationTimeline', () => {
  it('loads the first page (default includeInternalOnly=false) and exposes items + hasMore', async () => {
    vi.mocked(svc.getOrganizationTimeline).mockResolvedValueOnce({ items: [{ id: 'tev-1' }], nextToken: 'T1' } as never);
    const { result } = renderHook(() => useOrganizationTimeline('acme.com'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items).toHaveLength(1);
    expect(result.current.hasMore).toBe(true);
    expect(svc.getOrganizationTimeline).toHaveBeenCalledWith({ orgId: 'acme.com', nextToken: undefined, includeInternalOnly: false });
  });

  it('loadMore APPENDS the next page and forwards the nextToken', async () => {
    vi.mocked(svc.getOrganizationTimeline)
      .mockResolvedValueOnce({ items: [{ id: 'tev-1' }], nextToken: 'T1' } as never)
      .mockResolvedValueOnce({ items: [{ id: 'tev-2' }], nextToken: null } as never);
    const { result } = renderHook(() => useOrganizationTimeline('acme.com'));
    await waitFor(() => expect(result.current.hasMore).toBe(true));
    await act(async () => { await result.current.loadMore(); });
    expect(result.current.items.map((i: { id: string }) => i.id)).toEqual(['tev-1', 'tev-2']);
    expect(result.current.hasMore).toBe(false);
    expect(svc.getOrganizationTimeline).toHaveBeenLastCalledWith({ orgId: 'acme.com', nextToken: 'T1', includeInternalOnly: false });
  });

  it('setIncludeInternal(true) REFETCHES from scratch with the param (not a client reveal)', async () => {
    vi.mocked(svc.getOrganizationTimeline)
      .mockResolvedValueOnce({ items: [{ id: 'ext' }], nextToken: null } as never)
      .mockResolvedValueOnce({ items: [{ id: 'ext' }, { id: 'internal' }], nextToken: null } as never);
    const { result } = renderHook(() => useOrganizationTimeline('acme.com'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { result.current.setIncludeInternal(true); });
    await waitFor(() => expect(result.current.items).toHaveLength(2));
    expect(svc.getOrganizationTimeline).toHaveBeenLastCalledWith({ orgId: 'acme.com', nextToken: undefined, includeInternalOnly: true });
  });

  it('surfaces errors', async () => {
    vi.mocked(svc.getOrganizationTimeline).mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => useOrganizationTimeline('acme.com'));
    await waitFor(() => expect(result.current.error?.message).toBe('boom'));
  });
});
