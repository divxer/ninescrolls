import { Suspense, type ComponentType } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isChunkLoadError, lazyWithReload } from './lazyWithReload';
import { ErrorBoundary } from '../components/common/ErrorBoundary';

type LazyModule = Promise<{ default: ComponentType<unknown> }>;

const rejectWith = (error: unknown) => (): LazyModule =>
  Promise.reject(error) as LazyModule;

describe('isChunkLoadError', () => {
  it('recognises the per-browser dynamic-import failure messages', () => {
    const messages = [
      'Failed to fetch dynamically imported module: https://x/assets/OrderListPage-a1b2c3.js', // Chrome
      'error loading dynamically imported module', // Firefox
      'Importing a module script failed.', // Safari
      "Unexpected token '<'", // missing chunk served the SPA index.html fallback
      'Expected a JavaScript module script but the server responded with a MIME type of "text/html".',
    ];
    for (const message of messages) {
      expect(isChunkLoadError(new Error(message))).toBe(true);
    }
  });

  it('recognises a webpack-style ChunkLoadError by name', () => {
    const error = new Error('loading chunk 5 failed');
    error.name = 'ChunkLoadError';
    expect(isChunkLoadError(error)).toBe(true);
  });

  it('does not misclassify ordinary runtime errors', () => {
    expect(isChunkLoadError(new TypeError('Cannot read properties of undefined'))).toBe(false);
    expect(isChunkLoadError(new Error('Network request failed for /api/orders'))).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
    expect(isChunkLoadError(undefined)).toBe(false);
  });
});

describe('lazyWithReload recovery', () => {
  const originalLocation = window.location;
  let reload: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    window.sessionStorage.clear();
    reload = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, reload },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
    vi.restoreAllMocks();
  });

  it('forces one reload when a stale chunk fails to import', async () => {
    const Stale = lazyWithReload(
      rejectWith(new Error('Failed to fetch dynamically imported module')),
    );

    render(
      <Suspense fallback={<div>loading</div>}>
        <Stale />
      </Suspense>,
    );

    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(window.sessionStorage.getItem('chunkReload:lastAt')).not.toBeNull();
  });

  it('stops reloading within the cooldown and surfaces the error to the boundary', async () => {
    // Simulate "we already reloaded a moment ago and it still fails".
    window.sessionStorage.setItem('chunkReload:lastAt', String(Date.now()));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const Stale = lazyWithReload(
      rejectWith(new Error('Failed to fetch dynamically imported module')),
    );

    render(
      <ErrorBoundary fallback={<div>boundary fallback</div>}>
        <Suspense fallback={<div>loading</div>}>
          <Stale />
        </Suspense>
      </ErrorBoundary>,
    );

    await waitFor(() => expect(screen.getByText('boundary fallback')).toBeInTheDocument());
    expect(reload).not.toHaveBeenCalled();
  });

  it('surfaces stale chunk errors when storage cannot be read', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const Stale = lazyWithReload(
      rejectWith(new Error('Failed to fetch dynamically imported module')),
    );

    render(
      <ErrorBoundary fallback={<div>boundary fallback</div>}>
        <Suspense fallback={<div>loading</div>}>
          <Stale />
        </Suspense>
      </ErrorBoundary>,
    );

    await waitFor(() => expect(screen.getByText('boundary fallback')).toBeInTheDocument());
    expect(reload).not.toHaveBeenCalled();
  });

  it('surfaces stale chunk errors when the reload sentinel cannot be written', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const Stale = lazyWithReload(
      rejectWith(new Error('Failed to fetch dynamically imported module')),
    );

    render(
      <ErrorBoundary fallback={<div>boundary fallback</div>}>
        <Suspense fallback={<div>loading</div>}>
          <Stale />
        </Suspense>
      </ErrorBoundary>,
    );

    await waitFor(() => expect(screen.getByText('boundary fallback')).toBeInTheDocument());
    expect(reload).not.toHaveBeenCalled();
  });

  it('surfaces non-chunk errors to the boundary without reloading', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const Broken = lazyWithReload(rejectWith(new TypeError('boom in render module')));

    render(
      <ErrorBoundary fallback={<div>boundary fallback</div>}>
        <Suspense fallback={<div>loading</div>}>
          <Broken />
        </Suspense>
      </ErrorBoundary>,
    );

    await waitFor(() => expect(screen.getByText('boundary fallback')).toBeInTheDocument());
    expect(reload).not.toHaveBeenCalled();
  });
});
