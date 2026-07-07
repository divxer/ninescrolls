import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

/**
 * sessionStorage key holding the timestamp (ms) of the last auto-reload we
 * triggered in response to a failed dynamic import.
 */
const LAST_RELOAD_KEY = 'chunkReload:lastAt';

/**
 * If a chunk fails again within this window of our last auto-reload, we assume
 * the reload didn't help (a genuinely broken chunk, not just a stale hash) and
 * stop reloading — the rejection propagates to the nearest ErrorBoundary
 * instead of looping. Comfortably longer than a reload + re-import round trip.
 */
const RELOAD_COOLDOWN_MS = 10_000;

/**
 * Detects the family of errors thrown when a lazily-imported chunk can't be
 * fetched or parsed — the classic "stale hash after a deploy" case where the
 * old chunk file no longer exists on the CDN. Messages differ per browser, and
 * a missing chunk often returns the SPA's index.html fallback (HTML), which
 * fails to parse as a module script.
 */
export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false;
  if ((error as { name?: unknown }).name === 'ChunkLoadError') return true;
  const message = error instanceof Error ? error.message : String(error);
  return (
    /failed to fetch dynamically imported module/i.test(message) ||
    /error loading dynamically imported module/i.test(message) ||
    /importing a module script failed/i.test(message) ||
    /unexpected token '<'/i.test(message) ||
    /mime type of "?text\/html"?/i.test(message)
  );
}

function markReloadIfAllowed(): boolean {
  try {
    const raw = window.sessionStorage.getItem(LAST_RELOAD_KEY);
    if (raw) {
      const last = Number(raw);
      if (Number.isFinite(last) && Date.now() - last <= RELOAD_COOLDOWN_MS) {
        return false;
      }
    }
    window.sessionStorage.setItem(LAST_RELOAD_KEY, String(Date.now()));
    return true;
  } catch {
    // Without a persisted sentinel, a still-broken chunk could reload-loop.
    // Fail closed to the ErrorBoundary instead.
    return false;
  }
}

/**
 * Drop-in replacement for `React.lazy` that recovers from stale-chunk failures.
 *
 * When the dynamic import rejects because the chunk is missing, it forces a
 * single full-page reload so the browser fetches the fresh index.html and the
 * new chunk hashes. A short cooldown prevents a genuinely broken chunk from
 * looping — in that case the rejection propagates to the nearest ErrorBoundary,
 * which renders a friendly fallback instead of a blank white screen.
 */
// `ComponentType<any>` mirrors React's own `lazy` signature: it must accept
// components with any props shape (including no-prop `FC<{}>`), which a stricter
// `unknown` constraint rejects due to contravariant props.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyWithReload<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
): LazyExoticComponent<T> {
  return lazy(() =>
    factory().catch((error: unknown) => {
      if (isChunkLoadError(error) && markReloadIfAllowed()) {
        window.location.reload();
        // Keep <Suspense> in its loading state until the reload navigates the
        // page away; never resolve so we don't flash a broken render first.
        return new Promise<{ default: T }>(() => {});
      }
      throw error;
    }),
  );
}
