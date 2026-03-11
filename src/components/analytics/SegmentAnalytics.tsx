import { useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { segmentAnalytics } from '../../services/segmentAnalytics';
import { behaviorAnalytics, classifyTrafficChannel } from '../../services/behaviorAnalytics';
import {
  getSessionId,
  getTabId,
  createPageViewId,
  storePageTimeFlush,
  storePageTimeFlushViaBeacon,
  storeAnalyticsEvent,
  type FlushReason,
  type PageTimeFlushParams,
} from '../../services/analyticsStorageService';
import outputs from '../../../amplify_outputs.json';

// ─── Time tracking constants ─────────────────────────────────────────────────
const MIN_TRACK_SECONDS = 5;       // Minimum seconds to track (filters bots/misclicks)
const DEFAULT_IDLE_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes idle → pause timer
const HEARTBEAT_INTERVAL_MS = 30_000;  // Save progress every 30s
const CHECKPOINT_KEY = 'ns_page_time_checkpoint';
const RECOVERY_WINDOW_MS = 10 * 60 * 1000; // spec §12.2: 10 minutes

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

// ─── Checkpoint (spec §12.1) ─────────────────────────────────────────────────
interface RecoveryCheckpoint {
  visitorId?: string;
  sessionId: string;
  tabId: string;
  pageViewId: string;
  path: string;
  title: string;
  enteredAt: number;
  idleTimeoutMs: number;
  lastInteractionAt: number;
  lastFlushAt: number | null;
  idleAccumulatedMs: number;
  hiddenAccumulatedMs: number;
  flushSequence: number;
  isFinalized: boolean;
  // Computed at checkpoint time for convenience
  activeSeconds: number;
  idleSeconds: number;
  hiddenSeconds: number;
  wallClockSeconds: number;
  updatedAt: number;
}

function persistCheckpoint(state: ActivePageState, now: number): void {
  let idleMs = state.idleAccumulatedMs;
  let hiddenMs = state.hiddenAccumulatedMs;
  if (state.hiddenStartedAt !== null) {
    hiddenMs += now - state.hiddenStartedAt;
  } else if (state.idleStartedAt !== null) {
    idleMs += now - state.idleStartedAt;
  }
  const wallClockMs = Math.max(0, now - state.enteredAt);
  const activeMs = Math.max(0, wallClockMs - idleMs - hiddenMs);

  const cp: RecoveryCheckpoint = {
    sessionId: state.sessionId,
    tabId: state.tabId,
    pageViewId: state.pageViewId,
    path: state.path,
    title: state.title,
    enteredAt: state.enteredAt,
    idleTimeoutMs: state.idleTimeoutMs,
    lastInteractionAt: state.lastInteractionAt,
    lastFlushAt: state.lastFlushAt,
    idleAccumulatedMs: idleMs,
    hiddenAccumulatedMs: hiddenMs,
    flushSequence: state.flushSequence,
    isFinalized: state.isFinalized,
    activeSeconds: Math.floor(activeMs / 1000),
    idleSeconds: Math.floor(idleMs / 1000),
    hiddenSeconds: Math.floor(hiddenMs / 1000),
    wallClockSeconds: Math.floor(wallClockMs / 1000),
    updatedAt: now,
  };
  localStorage.setItem(CHECKPOINT_KEY, JSON.stringify(cp));
}

// ─── Anomaly dedup: only report each anomaly type once per pageViewId ────────
const reportedAnomalies = new Set<string>();

function reportAnomaly(
  pageViewId: string,
  anomalyType: string,
  details: Record<string, unknown>,
) {
  const key = `${pageViewId}:${anomalyType}`;
  if (reportedAnomalies.has(key)) return;
  reportedAnomalies.add(key);

  console.warn(`[Anomaly] ${anomalyType}`, details);
  storeAnalyticsEvent({
    eventName: `Anomaly: ${anomalyType}`,
    eventType: 'anomaly',
    properties: { anomalyType, pageViewId, ...details },
  });
}

// ─── Active page state (per-tab, in-memory) — spec §6 ──────────────────────
interface ActivePageState {
  sessionId: string;
  tabId: string;
  pageViewId: string;
  path: string;
  title: string;
  enteredAt: number;              // epoch ms — never reset after init
  lastInteractionAt: number;      // epoch ms — last user interaction
  lastFlushAt: number | null;     // epoch ms — last successful flush
  // Idle = user stopped interacting but tab is still visible (spec §2.6)
  idleStartedAt: number | null;
  idleAccumulatedMs: number;
  // Hidden = tab is backgrounded/minimized (spec §2.7, tracked separately)
  hiddenStartedAt: number | null;
  hiddenAccumulatedMs: number;
  flushSequence: number;          // most recently assigned sequence
  isFinalized: boolean;
  idleTimeoutMs: number;          // page-type-specific idle threshold
  maxFlushedActiveSeconds: number; // highest activeSeconds written so far (for anomaly detection)
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

  // ─── Core: flush page time to DynamoDB + Segment (spec §18) ────────────────
  const flushPageTime = useCallback((reason: FlushReason, isFinal: boolean) => {
    const state = pageStateRef.current;
    if (!state) return;

    // Spec §11 finalize guard — detect duplicate finals as anomaly
    if (state.isFinalized) {
      if (isFinal) {
        reportAnomaly(state.pageViewId, 'duplicate_final', {
          reason, path: state.path, flushSequence: state.flushSequence,
        });
      }
      return;
    }

    const now = Date.now();

    // Detect dual timer anomaly: both idle and hidden running simultaneously.
    // This shouldn't happen (hidden-priority else-if prevents it), but if it
    // does, self-heal by settling idle (hidden takes priority).
    if (state.hiddenStartedAt !== null && state.idleStartedAt !== null) {
      reportAnomaly(state.pageViewId, 'dual_timer', {
        path: state.path,
        idleStartedAt: state.idleStartedAt,
        hiddenStartedAt: state.hiddenStartedAt,
      });
      // Self-heal: settle idle into accumulated, hidden takes priority
      state.idleAccumulatedMs += now - state.idleStartedAt;
      state.idleStartedAt = null;
    }

    // 1. Compute cumulative time (spec §9.1: hidden-priority else-if)
    let effectiveIdleMs = state.idleAccumulatedMs;
    let effectiveHiddenMs = state.hiddenAccumulatedMs;
    if (state.hiddenStartedAt !== null) {
      effectiveHiddenMs += now - state.hiddenStartedAt;
    } else if (state.idleStartedAt !== null) {
      effectiveIdleMs += now - state.idleStartedAt;
    }

    const wallClockMs = Math.max(0, now - state.enteredAt);
    const activeMs = Math.max(0, wallClockMs - effectiveIdleMs - effectiveHiddenMs);
    const activeSeconds = Math.floor(activeMs / 1000);
    const idleSeconds = Math.floor(effectiveIdleMs / 1000);
    const hiddenSeconds = Math.floor(effectiveHiddenMs / 1000);
    const wallClockSeconds = Math.floor(wallClockMs / 1000);

    // 2. Filter noise: partial flushes below threshold are skipped.
    //    Final flushes are NEVER filtered — short visits are real visits,
    //    filtering belongs in the analysis layer, not the collection layer.
    //    Threshold uses < (not <=): exactly 5s counts as real engagement.
    if (!isFinal && activeSeconds < MIN_TRACK_SECONDS) return;

    // 3. Assign sequence AFTER guard — no sequence gaps from filtered partials
    const nextSequence = state.flushSequence + 1;
    state.flushSequence = nextSequence;

    // 4. Update localStorage behavior signals (kept for ALL branches — sync, safe during unload)
    behaviorAnalytics.trackTimeOnPage(state.path, activeSeconds);

    // 5-6. Write to targets (transport varies by flush reason)
    const flushParams: PageTimeFlushParams = {
      sessionId: state.sessionId,
      tabId: state.tabId,
      pageViewId: state.pageViewId,
      path: state.path,
      title: state.title,
      activeSeconds,
      idleSeconds,
      hiddenSeconds,
      wallClockSeconds,
      flushReason: reason,
      isFinal,
      sequence: nextSequence,
      startedAt: state.enteredAt,
      endedAt: now,
      idleTimeoutMsUsed: state.idleTimeoutMs,
    };

    if (reason === 'pagehide') {
      // Single beacon transport → Lambda fans out to Segment ('Time on Page') + DynamoDB.
      // sendBeacon is reliable during page unload; GraphQL fetch may be killed by the browser.
      storePageTimeFlushViaBeacon(flushParams);
    } else {
      // Segment via sendBeacon (backward-compatible heuristic path)
      const score = behaviorAnalytics.calculateBehaviorScore();
      segmentAnalytics.sendTimeBeacon(state.path, activeSeconds, score.timeOnSite, state.title);
      // Authoritative DynamoDB via GraphQL (safe — not in unload context)
      storePageTimeFlush(flushParams);
    }

    // 7. Detect final < partial anomaly (cumulative model should never regress)
    if (isFinal && state.maxFlushedActiveSeconds > 0 && activeSeconds < state.maxFlushedActiveSeconds) {
      reportAnomaly(state.pageViewId, 'final_lt_partial', {
        path: state.path,
        finalActiveSeconds: activeSeconds,
        maxPartialActiveSeconds: state.maxFlushedActiveSeconds,
        reason,
      });
    }
    state.maxFlushedActiveSeconds = Math.max(state.maxFlushedActiveSeconds, activeSeconds);

    // 8. Update state (spec §9.2 / §9.3)
    state.lastFlushAt = now;
    if (isFinal) {
      state.isFinalized = true;
    }
    // Partial flush: do NOT reset counters — cumulative snapshot model.

    // 8. Persist checkpoint after flush (spec §12.1)
    try { persistCheckpoint(state, now); } catch { /* ignore */ }
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
      lastInteractionAt: now,
      lastFlushAt: null,
      idleStartedAt: null,
      idleAccumulatedMs: 0,
      hiddenStartedAt: null,
      hiddenAccumulatedMs: 0,
      flushSequence: 0,
      isFinalized: false,
      idleTimeoutMs: getIdleTimeoutForPath(path),
      maxFlushedActiveSeconds: 0,
    };
  }, []);

  // ─── Recover crashed checkpoint on mount (spec §12.2–12.5) ─────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CHECKPOINT_KEY);
      if (!raw) return;

      const cp = JSON.parse(raw) as RecoveryCheckpoint;
      const now = Date.now();

      // Spec §12.2: only recover if within recovery window and not finalized.
      // No minimum activeSeconds check — short visits are real visits,
      // recovery is a data-preservation mechanism, not an analysis filter.
      const isRecoverable =
        !cp.isFinalized &&
        (now - cp.updatedAt) < RECOVERY_WINDOW_MS &&
        cp.activeSeconds > 0;

      if (isRecoverable) {
        // Update behavior heuristic (for lead scoring)
        behaviorAnalytics.trackTimeOnPage(cp.path, cp.activeSeconds);

        // Write a recovery flush to DynamoDB
        const recoverySeq = cp.flushSequence + 1;
        storePageTimeFlush({
          sessionId: cp.sessionId,
          tabId: cp.tabId,
          pageViewId: cp.pageViewId,
          path: cp.path,
          title: cp.title,
          activeSeconds: cp.activeSeconds,
          idleSeconds: cp.idleSeconds,
          hiddenSeconds: cp.hiddenSeconds,
          wallClockSeconds: cp.wallClockSeconds,
          flushReason: 'recovery',
          isFinal: true,
          sequence: recoverySeq,
          startedAt: cp.enteredAt,
          endedAt: cp.updatedAt,
          idleTimeoutMsUsed: cp.idleTimeoutMs,
        });
      }

      // Always clean up — stale or recovered, checkpoint is consumed
      localStorage.removeItem(CHECKPOINT_KEY);
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
      state.lastInteractionAt = now;

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

      // Touch session while user is actively engaged (not idle, not hidden).
      // Without this, a user reading one page for 40+ minutes gets a session
      // expiry because getSessionId() is only called on route change.
      if (state.idleStartedAt === null && state.hiddenStartedAt === null) {
        getSessionId(); // touches SESSION_TOUCH_KEY in localStorage
      }

      // Checkpoint is a recovery mechanism, not an analysis event —
      // always persist if state exists, regardless of active time.
      const now = Date.now();
      try { persistCheckpoint(state, now); } catch { /* ignore */ }
    }, HEARTBEAT_INTERVAL_MS);

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, []);

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

    // Guard: both beforeunload and pagehide fire on desktop Chrome.
    // Without a guard, the second event triggers a duplicate_final anomaly.
    let unloadFlushed = false;

    const handleUnload = () => {
      if (unloadFlushed) return;
      unloadFlushed = true;
      // pagehide/beforeunload → final flush
      flushPageTime('pagehide', true);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // Tab hidden → partial flush (user may come back)
        flushPageTime('hidden', false);
        // Start hidden period (tracked separately from idle)
        const state = pageStateRef.current;
        if (state && !state.isFinalized && state.hiddenStartedAt === null) {
          state.hiddenStartedAt = Date.now();
          // Pause idle timer — hidden time is its own category
          if (state.idleStartedAt !== null) {
            state.idleAccumulatedMs += Date.now() - state.idleStartedAt;
            state.idleStartedAt = null;
          }
        }
      } else if (document.visibilityState === 'visible') {
        // Tab returned — accumulate hidden period, then resume
        const state = pageStateRef.current;
        if (state && !state.isFinalized) {
          if (state.hiddenStartedAt !== null) {
            state.hiddenAccumulatedMs += Date.now() - state.hiddenStartedAt;
            state.hiddenStartedAt = null;
          }
          state.lastInteractionAt = Date.now();
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
