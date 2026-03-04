import { useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { segmentAnalytics } from '../../services/segmentAnalytics';
import { behaviorAnalytics } from '../../services/behaviorAnalytics';
import outputs from '../../../amplify_outputs.json';

// ─── Time tracking constants ─────────────────────────────────────────────────
const MIN_TRACK_SECONDS = 5;       // Minimum seconds to track (filters bots/misclicks)
const IDLE_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes idle → pause timer
const HEARTBEAT_INTERVAL_MS = 30_000;  // Save progress every 30s
const CHECKPOINT_KEY = 'ns_page_time_checkpoint';

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

  // ─── Time tracking refs ──────────────────────────────────────────────────
  const pageStartTimeRef = useRef<number>(Date.now());
  const currentPathRef = useRef<string>(location.pathname);
  const accumulatedIdleRef = useRef<number>(0);   // Total idle ms for current page
  const idleStartRef = useRef<number | null>(null); // When user became idle (null = active)
  const lastActivityRef = useRef<number>(Date.now());
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasTrackedUnloadRef = useRef<boolean>(false); // Prevent double-counting

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

  // ─── Helper: calculate active time on current page ────────────────────────
  const getActiveSeconds = useCallback((): number => {
    const elapsed = Date.now() - pageStartTimeRef.current;
    let idleMs = accumulatedIdleRef.current;
    // If currently idle, add the ongoing idle period
    if (idleStartRef.current !== null) {
      idleMs += Date.now() - idleStartRef.current;
    }
    return Math.max(0, Math.floor((elapsed - idleMs) / 1000));
  }, []);

  // ─── Helper: track time + send beacon + clear checkpoint ─────────────────
  const trackAndSend = useCallback((path: string, seconds: number) => {
    if (seconds <= MIN_TRACK_SECONDS) return;
    behaviorAnalytics.trackTimeOnPage(path, seconds);
    const score = behaviorAnalytics.calculateBehaviorScore();
    segmentAnalytics.sendTimeBeacon(path, seconds, score.timeOnSite);
    try { localStorage.removeItem(CHECKPOINT_KEY); } catch { /* ignore */ }
  }, []);

  // ─── Helper: reset all timers for a new page ────────────────────────────
  const resetTimers = useCallback(() => {
    pageStartTimeRef.current = Date.now();
    accumulatedIdleRef.current = 0;
    idleStartRef.current = null;
    lastActivityRef.current = Date.now();
    hasTrackedUnloadRef.current = false;
  }, []);

  // ─── Recover crashed checkpoint on mount ─────────────────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CHECKPOINT_KEY);
      if (raw) {
        const cp = JSON.parse(raw) as { path: string; activeTime: number; timestamp: number };
        // Only recover if checkpoint is less than 10 minutes old
        if (Date.now() - cp.timestamp < 10 * 60 * 1000 && cp.activeTime > MIN_TRACK_SECONDS) {
          behaviorAnalytics.trackTimeOnPage(cp.path, cp.activeTime);
        }
        localStorage.removeItem(CHECKPOINT_KEY);
      }
    } catch { /* ignore */ }
  }, []);

  // ─── Idle detection ──────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const markActive = () => {
      const now = Date.now();
      // Throttle: ignore activity events within 1s of last one
      if (now - lastActivityRef.current < 1000) return;
      lastActivityRef.current = now;

      // If we were idle, accumulate the idle time and resume
      if (idleStartRef.current !== null) {
        accumulatedIdleRef.current += now - idleStartRef.current;
        idleStartRef.current = null;
      }

      // Reset the idle countdown
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => {
        // User has been inactive for IDLE_TIMEOUT_MS → mark idle
        idleStartRef.current = Date.now();
      }, IDLE_TIMEOUT_MS);
    };

    // Start the initial idle countdown
    idleTimerRef.current = setTimeout(() => {
      idleStartRef.current = Date.now();
    }, IDLE_TIMEOUT_MS);

    const events = ['mousemove', 'keydown', 'scroll', 'touchstart'] as const;
    events.forEach(evt => window.addEventListener(evt, markActive, { passive: true }));

    return () => {
      events.forEach(evt => window.removeEventListener(evt, markActive));
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, []);

  // ─── Heartbeat: save progress to localStorage every 30s ─────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;

    heartbeatRef.current = setInterval(() => {
      const activeTime = getActiveSeconds();
      if (activeTime > MIN_TRACK_SECONDS) {
        try {
          localStorage.setItem(CHECKPOINT_KEY, JSON.stringify({
            path: currentPathRef.current,
            activeTime,
            timestamp: Date.now(),
          }));
        } catch { /* ignore */ }
      }
    }, HEARTBEAT_INTERVAL_MS);

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, [getActiveSeconds]);

  // ─── Route change tracking ───────────────────────────────────────────────
  useEffect(() => {
    // Track time spent on previous page before route change
    if (currentPathRef.current !== location.pathname) {
      const activeTime = getActiveSeconds();
      if (activeTime > MIN_TRACK_SECONDS) {
        behaviorAnalytics.trackTimeOnPage(currentPathRef.current, activeTime);
        try { localStorage.removeItem(CHECKPOINT_KEY); } catch { /* ignore */ }
      }
    }

    // Reset timer for new page
    resetTimers();
    currentPathRef.current = location.pathname;

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

      if (utmSource || utmMedium || document.referrer) {
        behaviorAnalytics.trackTrafficSource(
          utmSource || document.referrer || 'direct',
          utmMedium || 'direct',
          utmCampaign || undefined
        );
      }
    }
  }, [location.pathname, location.search, location.hash, getActiveSeconds, resetTimers]);

  // ─── Unload / visibility tracking (with duplicate prevention) ────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleUnload = () => {
      if (hasTrackedUnloadRef.current) return;
      hasTrackedUnloadRef.current = true;
      const activeTime = getActiveSeconds();
      trackAndSend(currentPathRef.current, activeTime);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (hasTrackedUnloadRef.current) return;
        hasTrackedUnloadRef.current = true;
        const activeTime = getActiveSeconds();
        trackAndSend(currentPathRef.current, activeTime);
      } else if (document.visibilityState === 'visible') {
        // Tab returned — reset for continued tracking
        hasTrackedUnloadRef.current = false;
        pageStartTimeRef.current = Date.now();
        accumulatedIdleRef.current = 0;
        idleStartRef.current = null;
        lastActivityRef.current = Date.now();
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
  }, [getActiveSeconds, trackAndSend]);

  return null; // This component doesn't render anything
};
