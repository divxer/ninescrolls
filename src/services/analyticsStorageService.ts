import { generateClient } from 'aws-amplify/data';
import { isbot } from 'isbot';
import type { Schema } from '../../amplify/data/resource';
import { getApiEndpoint, getAnonymousId, collectBrowserContext } from './analyticsTransportUtils';

const client = generateClient<Schema>();

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

interface IPInfoInput {
  ip?: string;
  country?: string;
  region?: string;
  city?: string;
  org?: string;
  isp?: string;
  latitude?: number;
  longitude?: number;
}

interface TargetAnalysisInput {
  isTargetCustomer?: boolean;
  organizationType?: string;
  orgName?: string;
  confidence?: number;
  finalConfidence?: number;
  leadTier?: string;
}

interface BehaviorScoreInput {
  behaviorScore?: number;
  productPagesViewed?: number;
  timeOnSite?: number;
  pdfDownloads?: number;
  returnVisits?: number;
  isPaidTraffic?: boolean;
  trafficChannel?: string;
}

interface AIClassificationInput {
  aiOrganizationType?: string;
  aiConfidence?: number;
  aiReason?: string;
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
  ipInfo?: IPInfoInput | null;
  targetAnalysis?: TargetAnalysisInput | null;
  behaviorScore?: BehaviorScoreInput | null;
  context?: EventContext | null;
  aiClassification?: AIClassificationInput | null;
  properties?: Record<string, unknown>;
}

export function storeAnalyticsEvent(params: StoreAnalyticsEventParams): void {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : undefined;

  const payload = {
    eventName: params.eventName,
    eventType: params.eventType,
    timestamp: new Date().toISOString(),

    visitorId: getVisitorId(),

    userAgent: ua,
    isBot: ua ? isbot(ua) : undefined,
    latitude: params.ipInfo?.latitude,
    longitude: params.ipInfo?.longitude,

    ip: params.ipInfo?.ip,
    country: params.ipInfo?.country,
    region: params.ipInfo?.region,
    city: params.ipInfo?.city,
    org: params.ipInfo?.org,
    isp: params.ipInfo?.isp,

    isTargetCustomer: params.targetAnalysis?.isTargetCustomer,
    organizationType: params.targetAnalysis?.organizationType,
    orgName: params.targetAnalysis?.orgName,
    confidence: params.targetAnalysis?.confidence,
    finalConfidence: params.targetAnalysis?.finalConfidence,
    leadTier: params.targetAnalysis?.leadTier,

    behaviorScore: params.behaviorScore?.behaviorScore,
    productPagesViewed: params.behaviorScore?.productPagesViewed,
    timeOnSite: params.behaviorScore?.timeOnSite,
    pdfDownloads: params.behaviorScore?.pdfDownloads,
    returnVisits: params.behaviorScore?.returnVisits,
    isPaidTraffic: params.behaviorScore?.isPaidTraffic,
    trafficChannel: params.behaviorScore?.trafficChannel,

    aiOrganizationType: params.aiClassification?.aiOrganizationType,
    aiConfidence: params.aiClassification?.aiConfidence,
    aiReason: params.aiClassification?.aiReason,

    pathname: params.context?.pathname,
    pageTitle: params.context?.pageTitle,
    productId: params.context?.productId,
    productName: params.context?.productName,
    referrer: params.context?.referrer,
    utmTerm: params.context?.utmTerm,
    searchQuery: params.context?.searchQuery,

    properties: params.properties ? JSON.stringify(params.properties) : undefined,
  };

  // Fire-and-forget: don't await, don't block UI.
  // Amplify Data returns { data, errors } — GraphQL errors are in the
  // response, NOT thrown.  We must check both paths.
  const attempt = () =>
    client.models.AnalyticsEvent.create(payload).then((result) => {
      if (result.errors && result.errors.length > 0) {
        console.error(
          '[AnalyticsStorage] GraphQL errors storing event:',
          params.eventName,
          result.errors,
        );
      }
    });

  attempt().catch((err) => {
    console.error('[AnalyticsStorage] Failed to store event:', params.eventName, err);
    // Retry once after 2s for transient network failures
    setTimeout(() => {
      attempt().catch((retryErr) => {
        console.error('[AnalyticsStorage] Retry also failed:', params.eventName, retryErr);
      });
    }, 2000);
  });
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
}

export function storePageTimeFlush(params: PageTimeFlushParams): void {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : undefined;

  const payload = {
    // Deterministic ID → idempotent writes (retries won't create duplicates)
    id: `ptf-${params.pageViewId}-${params.sequence}`,
    eventName: 'Page Time Flush',
    eventType: 'page_time_flush',
    timestamp: new Date(params.endedAt).toISOString(),

    visitorId: getVisitorId(),
    pageViewId: params.pageViewId,
    sessionId: params.sessionId,
    tabId: params.tabId,

    pathname: params.path,
    pageTitle: params.title,

    activeSeconds: params.activeSeconds,
    idleSeconds: params.idleSeconds,
    hiddenSeconds: params.hiddenSeconds,
    wallClockSeconds: params.wallClockSeconds,
    flushReason: params.flushReason,
    isFinal: params.isFinal,
    flushSequence: params.sequence,
    idleTimeoutMsUsed: params.idleTimeoutMsUsed,

    userAgent: ua,
    isBot: ua ? isbot(ua) : undefined,
  };

  const attempt = () =>
    client.models.AnalyticsEvent.create(payload).then((result) => {
      if (result.errors && result.errors.length > 0) {
        console.error('[AnalyticsStorage] GraphQL errors storing page_time_flush:', result.errors);
      }
    });

  attempt().catch((err) => {
    console.error('[AnalyticsStorage] Failed to store page_time_flush:', err);
    setTimeout(() => {
      attempt().catch((retryErr) => {
        console.error('[AnalyticsStorage] Retry also failed (page_time_flush):', retryErr);
      });
    }, 2000);
  });
}

// ─── Beacon-friendly page_time_flush (pagehide path) ────────────────────────
// Uses sendBeacon to /d, which fans out to Segment ('Time on Page') + DynamoDB.
// This is the only reliable transport during page unload — GraphQL fetch
// may be killed by the browser before completing.

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
        isBot: ua ? isbot(ua) : false,
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
