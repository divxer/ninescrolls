import { isbot } from 'isbot';
import { getApiEndpoint, getAnonymousId, collectBrowserContext } from './analyticsTransportUtils';

// ─── UUID helper ────────────────────────────────────────────────────────────
function generateUUID(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// ─── Visitor ID (localStorage – persists across sessions) ───────────────────
const VISITOR_ID_KEY = 'ns_visitor_id';

/**
 * Get or create a persistent visitor ID stored in localStorage.
 * This allows us to track individual visitors across sessions,
 * even if their IP address changes (e.g. mobile networks, VPNs).
 */
export function getVisitorId(): string {
  try {
    const existing = localStorage.getItem(VISITOR_ID_KEY);
    if (existing) return existing;
  } catch { /* localStorage unavailable */ }

  const id = generateUUID();

  try {
    localStorage.setItem(VISITOR_ID_KEY, id);
  } catch { /* localStorage unavailable */ }

  return id;
}

// ─── Session ID (localStorage – shared across tabs, 30-min idle timeout) ────
const SESSION_ID_KEY = 'ns_session_id';
const SESSION_TOUCH_KEY = 'ns_session_touch';
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Get or create a session ID stored in localStorage.
 * A session expires after 30 minutes of inactivity (no calls to getSessionId).
 * This gives a true "session" semantic: shared across tabs, expires on idle.
 */
export function getSessionId(): string {
  try {
    const existingId = localStorage.getItem(SESSION_ID_KEY);
    const lastTouch = localStorage.getItem(SESSION_TOUCH_KEY);
    const now = Date.now();

    if (existingId && lastTouch) {
      const elapsed = now - Number(lastTouch);
      if (elapsed < SESSION_TIMEOUT_MS) {
        // Session still active — touch and return
        localStorage.setItem(SESSION_TOUCH_KEY, String(now));
        return existingId;
      }
      // Session expired — fall through to create new one
    }
  } catch { /* localStorage unavailable */ }

  const id = generateUUID();

  try {
    localStorage.setItem(SESSION_ID_KEY, id);
    localStorage.setItem(SESSION_TOUCH_KEY, String(Date.now()));
  } catch { /* localStorage unavailable */ }

  return id;
}

// ─── Tab ID (sessionStorage – unique per tab, never shared) ─────────────────
const TAB_ID_KEY = 'ns_tab_id';

export function getTabId(): string {
  try {
    const existing = sessionStorage.getItem(TAB_ID_KEY);
    if (existing) return existing;
  } catch { /* sessionStorage unavailable */ }

  const id = generateUUID();

  try {
    sessionStorage.setItem(TAB_ID_KEY, id);
  } catch { /* sessionStorage unavailable */ }

  return id;
}

// ─── Page View ID (generated fresh per page navigation) ─────────────────────

export function createPageViewId(): string {
  return generateUUID();
}

interface BehaviorScoreInput {
  behaviorScore?: number;
  productPagesViewed?: number;
  timeOnSite?: number;
  pdfDownloads?: number;
  returnVisits?: number;
  isPaidTraffic?: boolean;
  trafficChannel?: string;
  formInteractions?: number;
  maxScrollDepth?: number;
}

interface EventContext {
  pathname?: string;
  pageTitle?: string;
  productId?: string;
  productName?: string;
  referrer?: string;
  utmTerm?: string;
  searchQuery?: string;
}

export interface StoreAnalyticsEventParams {
  eventName: string;
  eventType: string;
  pageViewId?: string;
  behaviorScore?: BehaviorScoreInput | null;
  context?: EventContext | null;
  properties?: Record<string, unknown>;
}

export function storeAnalyticsEvent(params: StoreAnalyticsEventParams): void {
  // All analytics events go through /d Lambda via sendBeacon/fetch.
  // Lambda handles DDB write + Segment forwarding server-side.
  sendPageViewBeacon({
    ...params,
    pageViewId: params.pageViewId || createPageViewId(),
  });
}

// ─── Server-side page_view write via /d Lambda ──────────────────────────────
// Sends minimal context to /d Lambda via sendBeacon. The Lambda handles
// IP lookup, AI classification, DDB write, and Segment event forwarding.
// IP/geo/org fields are resolved server-side from request headers.

export interface SendPageViewBeaconParams extends StoreAnalyticsEventParams {
  pageViewId: string; // required — deterministic DDB ID: pv-${pageViewId}
}

function buildPageViewPayload(params: SendPageViewBeaconParams): string {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : undefined;
  return JSON.stringify({
    type: 'track',
    event: 'page_view_store',
    anonymousId: getAnonymousId(),
    properties: {
      pageViewId: params.pageViewId,
      eventName: params.eventName,
      eventType: params.eventType,
      timestamp: new Date().toISOString(),
      visitorId: getVisitorId(),
      userAgent: ua,
      isBot: ua ? isbot(ua) : false,

      // Behavior data (client-side only — Lambda can't compute this)
      behaviorScore: params.behaviorScore?.behaviorScore,
      productPagesViewed: params.behaviorScore?.productPagesViewed,
      timeOnSite: params.behaviorScore?.timeOnSite,
      pdfDownloads: params.behaviorScore?.pdfDownloads,
      returnVisits: params.behaviorScore?.returnVisits,
      isPaidTraffic: params.behaviorScore?.isPaidTraffic,
      trafficChannel: params.behaviorScore?.trafficChannel,
      formInteractions: params.behaviorScore?.formInteractions,
      maxScrollDepth: params.behaviorScore?.maxScrollDepth,

      // Page context
      pathname: params.context?.pathname,
      pageTitle: params.context?.pageTitle,
      productId: params.context?.productId,
      productName: params.context?.productName,
      referrer: params.context?.referrer,
      utmTerm: params.context?.utmTerm,
      searchQuery: params.context?.searchQuery,
    },
    context: collectBrowserContext(),
  });
}

export function sendPageViewBeacon(params: SendPageViewBeaconParams): void {
  try {
    const payload = buildPageViewPayload(params);
    const url = `${getApiEndpoint()}/d`;

    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' });
      if (navigator.sendBeacon(url, blob)) {
        console.info('[AnalyticsStorage] page_view sent via sendBeacon:', params.eventName);
        return;
      }
    }

    // Fallback: fetch with keepalive
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).then(() => {
      console.info('[AnalyticsStorage] page_view sent via fetch:', params.eventName);
    }).catch((err) => {
      console.error('[AnalyticsStorage] page_view fetch failed:', params.eventName, err);
    });
  } catch (err) {
    console.error('[AnalyticsStorage] sendPageViewBeacon error:', err);
  }
}


// ─── Page Time Flush: authoritative per-page active time ────────────────────

export type FlushReason = 'route_change' | 'pagehide' | 'hidden' | 'heartbeat' | 'recovery';

export interface PageTimeFlushParams {
  sessionId: string;
  tabId: string;
  pageViewId: string;
  path: string;
  title: string;
  activeSeconds: number;
  idleSeconds: number;
  hiddenSeconds: number;
  wallClockSeconds: number;
  flushReason: FlushReason;
  isFinal: boolean;
  sequence: number;
  startedAt: number;  // epoch ms
  endedAt: number;    // epoch ms
  idleTimeoutMsUsed: number;
  maxScrollDepth?: number; // highest scroll depth % (0-100) reached during this page view
}

// ─── page_time_flush via /d Lambda ──────────────────────────────────────────
// All flush reasons go through /d Lambda via sendBeacon/fetch.
// Lambda fans out to Segment ('Time on Page') + DynamoDB.

export function storePageTimeFlushViaBeacon(params: PageTimeFlushParams): void {
  try {
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : undefined;
    const payload = JSON.stringify({
      type: 'track',
      event: 'page_time_flush',
      anonymousId: getAnonymousId(),
      properties: {
        pageViewId: params.pageViewId,
        sessionId: params.sessionId,
        tabId: params.tabId,
        path: params.path,
        title: params.title,
        visitorId: getVisitorId(),
        activeSeconds: params.activeSeconds,
        idleSeconds: params.idleSeconds,
        hiddenSeconds: params.hiddenSeconds,
        wallClockSeconds: params.wallClockSeconds,
        flushReason: params.flushReason,
        isFinal: params.isFinal,
        flushSequence: params.sequence,
        startedAt: params.startedAt,
        endedAt: params.endedAt,
        idleTimeoutMsUsed: params.idleTimeoutMsUsed,
        maxScrollDepth: params.maxScrollDepth || undefined,
        isBot: ua ? isbot(ua) : false,
        // IP/org enrichment resolved server-side by /d Lambda from request headers
      },
      context: collectBrowserContext(),
    });

    const url = `${getApiEndpoint()}/d`;

    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' });
      if (navigator.sendBeacon(url, blob)) return;
    }

    // Fallback: fetch with keepalive (also survives page unload in most browsers)
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => { /* best-effort during unload */ });
  } catch {
    // Silent — runs during page unload, no UI to show errors
  }
}
