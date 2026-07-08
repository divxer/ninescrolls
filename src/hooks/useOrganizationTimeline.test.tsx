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

  it('clears the error and recovers on a successful reload', async () => {
    vi.mocked(svc.getOrganizationTimeline)
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ items: [{ id: 'tev-1' }], nextToken: null } as never);
    const { result } = renderHook(() => useOrganizationTimeline('acme.com'));
    await waitFor(() => expect(result.current.error?.message).toBe('boom'));
    await act(async () => { result.current.reload(); });
    await waitFor(() => expect(result.current.error).toBeNull());
    expect(result.current.items).toHaveLength(1);
  });

  it('discards a stale response when an older request resolves after a newer one supersedes it (no internal-row leak)', async () => {
    let resolveInitial: (v: unknown) => void = () => {};
    let resolveOn: (v: unknown) => void = () => {};
    let resolveOff: (v: unknown) => void = () => {};
    vi.mocked(svc.getOrganizationTimeline)
      .mockImplementationOnce(() => new Promise((r) => { resolveInitial = r; }) as never) // initial mount load (off)
      .mockImplementationOnce(() => new Promise((r) => { resolveOn = r; }) as never)      // setIncludeInternal(true)
      .mockImplementationOnce(() => new Promise((r) => { resolveOff = r; }) as never);    // setIncludeInternal(false), supersedes ON

    const { result } = renderHook(() => useOrganizationTimeline('acme.com'));
    await act(async () => { resolveInitial({ items: [], nextToken: null }); });
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => { result.current.setIncludeInternal(true); });
    await waitFor(() => expect(svc.getOrganizationTimeline).toHaveBeenCalledTimes(2));

    act(() => { result.current.setIncludeInternal(false); });
    await waitFor(() => expect(svc.getOrganizationTimeline).toHaveBeenCalledTimes(3));

    // Resolve the newer (OFF) request first, then the older (ON) request last —
    // the stale ON response must NOT be allowed to overwrite the newer OFF result.
    await act(async () => { resolveOff({ items: [{ id: 'ext-only' }], nextToken: null }); });
    await act(async () => { resolveOn({ items: [{ id: 'ext' }, { id: 'internal' }], nextToken: null }); });

    expect(result.current.items.map((i: { id: string }) => i.id)).toEqual(['ext-only']);
  });

  it('clears items when the visibility toggle refetch fails (off means off, no stale rows)', async () => {
    vi.mocked(svc.getOrganizationTimeline)
      .mockResolvedValueOnce({ items: [{ id: 'internal' }], nextToken: null } as never) // initial load
      .mockRejectedValueOnce(new Error('refetch failed'));                               // toggle refetch fails
    const { result } = renderHook(() => useOrganizationTimeline('acme.com'));
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    await act(async () => { result.current.setIncludeInternal(true); });                  // triggers refetch that rejects
    await waitFor(() => expect(result.current.error?.message).toBe('refetch failed'));
    expect(result.current.items).toHaveLength(0); // items cleared — no stale rows lingering
  });
});
