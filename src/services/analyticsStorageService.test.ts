import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// getVisitorId caches in module-level state, so each test needs a fresh
// module instance via vi.resetModules() + dynamic import.
async function importGetVisitorId() {
  const mod = await import('./analyticsStorageService');
  return mod.getVisitorId;
}

describe('getVisitorId', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a stable id across calls when localStorage throws (e.g. Safari private mode)', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage blocked');
    });

    const getVisitorId = await importGetVisitorId();
    const first = getVisitorId();
    const second = getVisitorId();

    expect(first).toBeTruthy();
    expect(second).toBe(first);
  });

  it('returns a stable id across calls when getItem works but setItem throws (e.g. quota exceeded)', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });

    const getVisitorId = await importGetVisitorId();
    const first = getVisitorId();
    const second = getVisitorId();

    expect(first).toBeTruthy();
    expect(second).toBe(first);
  });

  it('returns the persisted id when localStorage is available', async () => {
    localStorage.setItem('ns_visitor_id', 'existing-visitor-id');

    const getVisitorId = await importGetVisitorId();

    expect(getVisitorId()).toBe('existing-visitor-id');
  });

  it('prefers a localStorage id over the in-memory fallback once storage recovers', async () => {
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage blocked');
    });
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage blocked');
    });

    const getVisitorId = await importGetVisitorId();
    const fallbackId = getVisitorId();
    expect(fallbackId).toBeTruthy();

    // Storage recovers with an id written by another tab
    getItemSpy.mockRestore();
    setItemSpy.mockRestore();
    localStorage.setItem('ns_visitor_id', 'persisted-visitor-id');

    expect(getVisitorId()).toBe('persisted-visitor-id');
  });
});
