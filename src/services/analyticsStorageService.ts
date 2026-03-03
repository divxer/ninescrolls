import { generateClient } from 'aws-amplify/data';
import { isbot } from 'isbot';
import type { Schema } from '../../amplify/data/resource';

const client = generateClient<Schema>();

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
  properties?: Record<string, unknown>;
}

export function storeAnalyticsEvent(params: StoreAnalyticsEventParams): void {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : undefined;

  // Fire-and-forget: don't await, don't block UI
  client.models.AnalyticsEvent.create({
    eventName: params.eventName,
    eventType: params.eventType,
    timestamp: new Date().toISOString(),

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

    pathname: params.context?.pathname,
    pageTitle: params.context?.pageTitle,
    productId: params.context?.productId,
    productName: params.context?.productName,
    referrer: params.context?.referrer,

    properties: params.properties,
  }).catch((err) => {
    console.error('[AnalyticsStorage] Failed to store event:', err);
  });
}
