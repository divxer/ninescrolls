import { generateClient } from 'aws-amplify/data';
import { isbot } from 'isbot';
import type { Schema } from '../../amplify/data/resource';

const client = generateClient<Schema>();

// ─── Visitor ID ─────────────────────────────────────────────────────────────
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

  const id = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  try {
    localStorage.setItem(VISITOR_ID_KEY, id);
  } catch { /* localStorage unavailable */ }

  return id;
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

    properties: params.properties,
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
