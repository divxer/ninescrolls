import { useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { segmentAnalytics } from '../../services/segmentAnalytics';
import { behaviorAnalytics, classifyTrafficChannel } from '../../services/behaviorAnalytics';
import {
  getSessionId,
  getTabId,
  createPageViewId,
  storePageTimeFlush,
  type FlushReason,
} from '../../services/analyticsStorageService';
import outputs from '../../../amplify_outputs.json';

// ─── Time tracking constants ─────────────────────────────────────────────────
const MIN_TRACK_SECONDS = 5;       // Minimum seconds to track (filters bots/misclicks)
const DEFAULT_IDLE_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes idle → pause timer
const HEARTBEAT_INTERVAL_MS = 30_000;  // Save progress every 30s
const CHECKPOINT_KEY = 'ns_page_time_checkpoint';

// ─── Page-type-aware idle threshold ─────────────────────────────────────────
function getIdleTimeoutForPath(path: string): number {
  // RFQ form — users spend a long time filling it out
  if (path === '/request-a-quote' || path.startsWith('/request-a-quote/')) {
    return 10 * 60 * 1000; // 10 minutes
  }
  // Product detail pages — users read specs, compare features
  if (path.startsWith('/products/') && path.split('/').length > 2) {
    return 5 * 60 * 1000; // 5 minutes
  }
  // Insights/blog — users read articles
  if (path.startsWith('/insights/') && path.split('/').length > 2) {
    return 5 * 60 * 1000; // 5 minutes
  }
  // Contact page — users may compose messages
  if (path === '/contact' || path.startsWith('/contact/')) {
    return 8 * 60 * 1000; // 8 minutes
  }
  // Default for homepage, category pages, etc.
  return DEFAULT_IDLE_TIMEOUT_MS;
}

// ─── Active page state (per-tab, in-memory) ─────────────────────────────────
interface ActivePageState {
  sessionId: string;
  tabId: string;
  pageViewId: string;
  path: string;
  title: string;
  enteredAt: number;          // epoch ms
  lastActiveAt: number;       // epoch ms
  idleStartedAt: number | null;
  idleAccumulatedMs: number;
  flushSequence: number;
  isFinalized: boolean;
  idleTimeoutMs: number;      // page-type-specific idle threshold
}

/**
 * Get API Gateway endpoint for Segment proxy.
 * Follows the same pattern as stripeService.ts getApiEndpoint().
 */
function getSegmentProxyBase(): string {
  if (outputs?.custom?.API?.['ninescrolls-api']?.endpoint) {
    return outputs.custom.API['ninescrolls-api'].endpoint.replace(/\/$/, '');
  }
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  return 'https://api.ninescrolls.com';
}

/**
 * Intercept fetch / XMLHttpRequest / sendBeacon to redirect all Segment requests
 * through our first-party proxy. This works regardless of analytics.js version
 * and catches all network calls to Segment domains.
 */
let _proxyInterceptInstalled = false;
function installSegmentProxyIntercept(proxyBase: string) {
  if (_proxyInterceptInstalled) return;
  _proxyInterceptInstalled = true;

  const rewriteUrl = (url: string): string => {
    if (url.includes('api.segment.io')) {
      return url.replace('https://api.segment.io', `${proxyBase}/seg`);
    }
    if (url.includes('cdn.segment.com')) {
      return url.replace('https://cdn.segment.com', `${proxyBase}/seg/cdn`);
    }
    return url;
  };

  // Intercept fetch
  const originalFetch = window.fetch;
  window.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
    if (typeof input === 'string') {
      input = rewriteUrl(input);
    } else if (input instanceof Request) {
      const rewritten = rewriteUrl(input.url);
      if (rewritten !== input.url) {
        input = new Request(rewritten, input);
      }
    }
    return originalFetch.call(window, input, init);
  };

  // Intercept XMLHttpRequest
  const originalXHROpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (
    method: string,
    url: string | URL,
    ...rest: unknown[]
  ) {
    const urlStr = typeof url === 'string' ? url : url.toString();
    const rewritten = rewriteUrl(urlStr);
    return originalXHROpen.apply(this, [method, rewritten, ...rest] as Parameters<typeof originalXHROpen>);
  };

  // Intercept sendBeacon
  if (navigator.sendBeacon) {
    const originalSendBeacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = function (url: string | URL, data?: BodyInit | null) {
      const urlStr = typeof url === 'string' ? url : url.toString();
      return originalSendBeacon(rewriteUrl(urlStr), data);
    };
  }
}

interface SegmentAnalyticsProps {
  writeKey?: string;
}

type SegmentAnalyticsClient = {
  track: (event: string, properties?: Record<string, unknown>) => void;
  identify: (userId: string, traits?: Record<string, unknown>) => void;
  page: (name?: string, properties?: Record<string, unknown>) => void;
  group: (groupId: string, traits?: Record<string, unknown>) => void;
  alias: (userId: string, previousId?: string) => void;
  reset: () => void;
};

type SegmentAnalyticsStub = SegmentAnalyticsClient & {
  initialized?: boolean;
  invoked?: boolean;
  methods?: string[];
  factory?: (method: string) => (...args: unknown[]) => void;
  load?: (key: string, options?: { integrations?: Record<string, unknown> }) => void;
  _writeKey?: string;
  SNIPPET_VERSION?: string;
  push: (args: unknown[]) => number;
};

declare global {
  interface Window {
    analytics?: SegmentAnalyticsClient;
  }
}

export const SegmentAnalytics: React.FC<SegmentAnalyticsProps> = ({
  writeKey = 'WMoEScvR6dgChGx0LQUz0wQhgXK4nAHU'
}) => {
  const location = useLocation();

  // ─── Page state ref (replaces scattered refs) ─────────────────────────────
  const pageStateRef = useRef<ActivePageState | null>(null);

  // ─── Idle detection refs ──────────────────────────────────────────────────
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  // ─── Segment script loading ───────────────────────────────────────────────
  useEffect(() => {
    // Load Segment script if not already loaded
    if (typeof window !== 'undefined' && !window.analytics) {
      const analytics = (window.analytics = ((window.analytics || []) as unknown as SegmentAnalyticsStub));
      if (analytics.invoked) {
        window.console?.error?.('Segment snippet included twice.');
        return;
      }

      analytics.invoked = true;
      analytics.methods = [
        'trackSubmit',
        'trackClick',
        'trackLink',
        'trackForm',
        'pageview',
        'identify',
        'reset',
        'group',
        'track',
        'ready',
        'alias',
        'debug',
        'page',
        'screen',
        'once',
        'off',
        'on',
        'addSourceMiddleware',
        'addIntegrationMiddleware',
        'setAnonymousId',
        'addDestinationMiddleware',
        'register'
      ];

      analytics.factory = (method: string) => {
        return (...args: unknown[]) => {
          if (analytics.initialized && typeof (analytics as Record<string, unknown>)[method] === 'function') {
            const analyticsMethods = analytics as unknown as Record<string, (...params: unknown[]) => unknown>;
            return analyticsMethods[method](...args);
          }
          const payload = args.slice();
          if (['track', 'screen', 'alias', 'group', 'page', 'identify'].includes(method)) {
            const canonical = document.querySelector("link[rel='canonical']")?.getAttribute('href') || undefined;
            payload.push({
              __t: 'bpc',
              c: canonical,
              p: window.location.pathname,
              u: window.location.href,
              s: window.location.search,
              t: document.title,
              r: document.referrer
            });
          }
          payload.unshift(method);
          analytics.push(payload);
          return analytics;
        };
      };

      analytics.methods.forEach((method) => {
        (analytics as Record<string, unknown>)[method] = analytics.factory?.(method);
      });

      // Use first-party proxy to avoid network-level blocking of cdn.segment.com / api.segment.io
      // Intercept all network requests to Segment domains and redirect through our proxy
      const proxyBase = getSegmentProxyBase();
      installSegmentProxyIntercept(proxyBase);

      analytics.load = (key: string) => {
        const script = document.createElement('script');
        script.type = 'text/javascript';
        script.async = true;
        script.setAttribute('data-global-segment-analytics-key', 'analytics');
        script.src = `${proxyBase}/seg/cdn/analytics.js/v1/${key}/analytics.min.js`;
        const firstScript = document.getElementsByTagName('script')[0];
        firstScript?.parentNode?.insertBefore(script, firstScript);
      };

      analytics._writeKey = writeKey;
      analytics.SNIPPET_VERSION = '5.2.0';
      // Set custom CDN base so the real SDK fetches settings from our proxy
      // The proxy rewrites the settings JSON to redirect tracking calls through our domain
      (analytics as Record<string, unknown>)._cdn = `${proxyBase}/seg/cdn`;

      analytics.load(writeKey);
    }
  }, [writeKey]);

  // ─── Helper: calculate active seconds from current page state ─────────────
  const getActiveSeconds = useCallback((): number => {
    const state = pageStateRef.current;
    if (!state) return 0;
    const now = Date.now();
    const wallClockMs = now - state.enteredAt;
    let idleMs = state.idleAccumulatedMs;
    if (state.idleStartedAt !== null) {
      idleMs += now - state.idleStartedAt;
    }
    return Math.max(0, Math.floor((wallClockMs - idleMs) / 1000));
  }, []);

  // ─── Core: flush page time to DynamoDB + Segment ──────────────────────────
  const flushPageTime = useCallback((reason: FlushReason, isFinal: boolean) => {
    const state = pageStateRef.current;
    if (!state || state.isFinalized) return;

    const now = Date.now();
    const wallClockMs = now - state.enteredAt;
    let idleMs = state.idleAccumulatedMs;
    if (state.idleStartedAt !== null) {
      idleMs += now - state.idleStartedAt;
    }
    const activeMs = Math.max(0, wallClockMs - idleMs);
    const activeSeconds = Math.floor(activeMs / 1000);
    const idleSeconds = Math.floor(idleMs / 1000);
    const wallClockSeconds = Math.floor(wallClockMs / 1000);

    if (activeSeconds <= MIN_TRACK_SECONDS) return;

    const nextSequence = state.flushSequence + 1;

    // 1. Update localStorage behavior signals (heuristic, for lead scoring)
    behaviorAnalytics.trackTimeOnPage(state.path, activeSeconds);

    // 2. Send to Segment via sendBeacon (backward-compatible)
    const score = behaviorAnalytics.calculateBehaviorScore();
    segmentAnalytics.sendTimeBeacon(state.path, activeSeconds, score.timeOnSite, state.title);

    // 3. Write authoritative page_time_flush to DynamoDB
    storePageTimeFlush({
      sessionId: state.sessionId,
      tabId: state.tabId,
      pageViewId: state.pageViewId,
      path: state.path,
      title: state.title,
      activeSeconds,
      idleSeconds,
      wallClockSeconds,
      flushReason: reason,
      isFinal,
      sequence: nextSequence,
      startedAt: state.enteredAt,
      endedAt: now,
    });

    // 4. Clear checkpoint
    try { localStorage.removeItem(CHECKPOINT_KEY); } catch { /* ignore */ }

    // 5. Update state
    state.flushSequence = nextSequence;
    if (isFinal) {
      state.isFinalized = true;
    }
    // Partial flush: do NOT reset counters — report cumulative time.
    // Each successive flush for the same pageViewId reports total active time
    // from enteredAt. Dashboard takes MAX per pageViewId.
  }, []);

  // ─── Helper: create new page state ────────────────────────────────────────
  const initPageState = useCallback((path: string): ActivePageState => {
    const now = Date.now();
    return {
      sessionId: getSessionId(),
      tabId: getTabId(),
      pageViewId: createPageViewId(),
      path,
      title: document.title,
      enteredAt: now,
      lastActiveAt: now,
      idleStartedAt: null,
      idleAccumulatedMs: 0,
      flushSequence: 0,
      isFinalized: false,
      idleTimeoutMs: getIdleTimeoutForPath(path),
    };
  }, []);

  // ─── Recover crashed checkpoint on mount ──────────────────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CHECKPOINT_KEY);
      if (raw) {
        const cp = JSON.parse(raw) as {
          path: string; activeTime: number; timestamp: number;
          pageViewId?: string; sessionId?: string; tabId?: string;
          flushSequence?: number; idleSeconds?: number;
          wallClockSeconds?: number; enteredAt?: number;
        };
        // Only recover if checkpoint is less than 10 minutes old
        if (Date.now() - cp.timestamp < 10 * 60 * 1000 && cp.activeTime > MIN_TRACK_SECONDS) {
          behaviorAnalytics.trackTimeOnPage(cp.path, cp.activeTime);

          // If checkpoint has structured IDs, write a recovery flush to DynamoDB
          if (cp.pageViewId && cp.sessionId && cp.tabId) {
            // Use flushSequence + 1 so the deterministic ID (ptf-{pvId}-{seq})
            // won't collide with any already-written flush for this pageView.
            const recoverySeq = (cp.flushSequence ?? 0) + 1;
            storePageTimeFlush({
              sessionId: cp.sessionId,
              tabId: cp.tabId,
              pageViewId: cp.pageViewId,
              path: cp.path,
              title: '',  // unknown at recovery time
              activeSeconds: cp.activeTime,
              idleSeconds: cp.idleSeconds ?? 0,
              wallClockSeconds: cp.wallClockSeconds ?? cp.activeTime,
              flushReason: 'recovery',
              isFinal: true,
              sequence: recoverySeq,
              startedAt: cp.enteredAt ?? (cp.timestamp - (cp.wallClockSeconds ?? cp.activeTime) * 1000),
              endedAt: cp.timestamp,
            });
          }
        }
        localStorage.removeItem(CHECKPOINT_KEY);
      }
    } catch { /* ignore */ }
  }, []);

  // ─── Idle detection ───────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const markActive = () => {
      const now = Date.now();
      // Throttle: ignore activity events within 1s of last one
      if (now - lastActivityRef.current < 1000) return;
      lastActivityRef.current = now;

      const state = pageStateRef.current;
      if (!state || state.isFinalized) return;

      // If we were idle, accumulate the idle time and resume
      if (state.idleStartedAt !== null) {
        state.idleAccumulatedMs += now - state.idleStartedAt;
        state.idleStartedAt = null;
      }
      state.lastActiveAt = now;

      // Reset the idle countdown (using page-specific threshold)
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      const timeout = pageStateRef.current?.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS;
      idleTimerRef.current = setTimeout(() => {
        const s = pageStateRef.current;
        if (s && !s.isFinalized) {
          s.idleStartedAt = Date.now();
        }
      }, timeout);
    };

    // Start the initial idle countdown
    idleTimerRef.current = setTimeout(() => {
      const s = pageStateRef.current;
      if (s && !s.isFinalized) {
        s.idleStartedAt = Date.now();
      }
    }, pageStateRef.current?.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS);

    const events = ['mousemove', 'keydown', 'scroll', 'touchstart'] as const;
    events.forEach(evt => window.addEventListener(evt, markActive, { passive: true }));

    return () => {
      events.forEach(evt => window.removeEventListener(evt, markActive));
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, []);

  // ─── Heartbeat: save progress to localStorage every 30s ──────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;

    heartbeatRef.current = setInterval(() => {
      const state = pageStateRef.current;
      if (!state || state.isFinalized) return;

      const now = Date.now();
      const activeTime = getActiveSeconds();
      if (activeTime > MIN_TRACK_SECONDS) {
        const wallClockMs = now - state.enteredAt;
        let idleMs = state.idleAccumulatedMs;
        if (state.idleStartedAt !== null) idleMs += now - state.idleStartedAt;
        try {
          localStorage.setItem(CHECKPOINT_KEY, JSON.stringify({
            path: state.path,
            activeTime,
            idleSeconds: Math.floor(idleMs / 1000),
            wallClockSeconds: Math.floor(wallClockMs / 1000),
            timestamp: now,
            pageViewId: state.pageViewId,
            sessionId: state.sessionId,
            tabId: state.tabId,
            flushSequence: state.flushSequence,
            enteredAt: state.enteredAt,
          }));
        } catch { /* ignore */ }
      }
    }, HEARTBEAT_INTERVAL_MS);

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, [getActiveSeconds]);

  // ─── Route change tracking ────────────────────────────────────────────────
  useEffect(() => {
    const prevState = pageStateRef.current;

    // Finalize previous page on route change
    if (prevState && prevState.path !== location.pathname && !prevState.isFinalized) {
      flushPageTime('route_change', true);
    }

    // Initialize new page state
    const newState = initPageState(location.pathname);
    pageStateRef.current = newState;
    lastActivityRef.current = Date.now();
    // Capture title after a microtask so React/Helmet has time to update it
    queueMicrotask(() => {
      if (pageStateRef.current === newState) {
        newState.title = document.title;
      }
    });

    // Skip tracking for trailing-slash paths — RedirectHandler will normalize
    // them and we'll track the canonical (no trailing slash) path instead
    if (location.pathname !== '/' && location.pathname.endsWith('/')) {
      return;
    }

    // Track page views with Segment and IP analysis (merged into single call)
    if (typeof window !== 'undefined' && window.analytics) {
      segmentAnalytics.trackPageViewWithAnalysis(location.pathname, {
        pathname: location.pathname,
        search: location.search,
        hash: location.hash
      });
    }

    // Track traffic source on first page load
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const utmSource = urlParams.get('utm_source');
      const utmMedium = urlParams.get('utm_medium');
      const utmCampaign = urlParams.get('utm_campaign');
      const gclid = urlParams.get('gclid');
      const msclkid = urlParams.get('msclkid');
      const gadSource = urlParams.get('gad_source');
      const gbraid = urlParams.get('gbraid');
      const wbraid = urlParams.get('wbraid');

      if (utmSource || utmMedium || gclid || msclkid || gadSource || gbraid || wbraid || document.referrer) {
        const channel = classifyTrafficChannel({
          utmSource, utmMedium, utmCampaign,
          referrer: document.referrer,
          gclid, msclkid, gadSource, gbraid, wbraid,
        });
        behaviorAnalytics.trackTrafficSource(
          utmSource || document.referrer || 'direct',
          utmMedium || 'direct',
          utmCampaign || undefined,
          channel
        );
      }
    }
  }, [location.pathname, location.search, location.hash, flushPageTime, initPageState]);

  // ─── Unload / visibility tracking ─────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleUnload = () => {
      // pagehide/beforeunload → final flush
      flushPageTime('pagehide', true);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // Tab hidden → partial flush (user may come back)
        flushPageTime('hidden', false);
        // Start idle period to account for hidden time in cumulative tracking
        const state = pageStateRef.current;
        if (state && !state.isFinalized && state.idleStartedAt === null) {
          state.idleStartedAt = Date.now();
        }
      } else if (document.visibilityState === 'visible') {
        // Tab returned — accumulate the hidden idle period, then resume
        const state = pageStateRef.current;
        if (state && !state.isFinalized) {
          if (state.idleStartedAt !== null) {
            state.idleAccumulatedMs += Date.now() - state.idleStartedAt;
            state.idleStartedAt = null;
          }
          state.lastActiveAt = Date.now();
          lastActivityRef.current = Date.now();
        }
      }
    };

    window.addEventListener('beforeunload', handleUnload);
    // pagehide is more reliable than beforeunload on mobile
    window.addEventListener('pagehide', handleUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      window.removeEventListener('pagehide', handleUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [flushPageTime]);

  return null; // This component doesn't render anything
};
