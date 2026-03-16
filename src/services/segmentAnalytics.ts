// Segment Analytics Service
// This service provides a unified interface for tracking events with Segment
// Includes server-side tracking fallback for visitors with ad blockers

import { ipAnalytics, type IPInfo, type TargetCustomerAnalysis } from './ipAnalytics';
import { simpleIPAnalytics, type SimpleIPInfo, type SimpleTargetCustomerAnalysis } from './simpleIPAnalytics';
import { behaviorAnalytics, extractSearchQuery, type BehaviorScore } from './behaviorAnalytics';
import { storeAnalyticsEvent, getVisitorId } from './analyticsStorageService';
import { getApiEndpoint, getAnonymousId, collectBrowserContext } from './analyticsTransportUtils';

// Behavioral tier boost: upgrade lead tier based on behavioral signals.
// Requires multiple distinct signal types (cross-validation) to avoid single-signal false positives.
function applyBehavioralTierBoost(
  isTargetCustomer: boolean,
  finalLeadTier: 'A' | 'B' | 'C' | undefined,
  behaviorScore: BehaviorScore,
): 'A' | 'B' | 'C' | undefined {
  if (!isTargetCustomer || !finalLeadTier) return finalLeadTier;

  const lifecycle = behaviorAnalytics.computeLifecycleStage();
  const boostSignals = [
    behaviorScore.formInteractions > 0,        // has form interaction
    behaviorScore.pdfDownloads >= 2,            // multiple PDF downloads
    behaviorScore.returnVisits >= 2,            // multiple return visits
    lifecycle === 'consideration' || lifecycle === 'intent',  // advanced lifecycle
    behaviorScore.productPagesViewed >= 3,     // broad product interest
  ].filter(Boolean).length;

  let tier = finalLeadTier;
  // C → B: 2+ distinct boost signals
  if (tier === 'C' && boostSignals >= 2) {
    tier = 'B';
  }
  // B → A: 3+ distinct boost signals
  if (tier === 'B' && boostSignals >= 3) {
    tier = 'A';
  }
  return tier;
}

function eventNameToType(event: string): string {
  const map: Record<string, string> = {
    'Page Viewed': 'page_view',
    'Product Viewed': 'product_view',
    'Product Downloaded': 'pdf_download',
    'Datasheet Downloaded': 'pdf_download',
    'Contact Form Submitted': 'contact_form',
    'Search Performed': 'search',
    'Product Added to Cart': 'add_to_cart',
    'Purchase Completed': 'purchase',
    'Target Customer Detected': 'target_customer',
    'Simple Target Customer Detected': 'target_customer',
    'RFQ Step 1: Your Information': 'rfq_step',
    'RFQ Step 2: Project Details': 'rfq_step',
    'RFQ Submitted': 'rfq_submission',
  };
  return map[event] || 'other';
}

type SegmentAnalyticsClient = {
  track: (event: string, properties?: Record<string, unknown>) => void;
  identify: (userId: string, traits?: Record<string, unknown>) => void;
  page: (name?: string, properties?: Record<string, unknown>) => void;
  group: (groupId: string, traits?: Record<string, unknown>) => void;
  alias: (userId: string, previousId?: string) => void;
  reset: () => void;
};

declare global {
  interface Window {
    analytics?: SegmentAnalyticsClient;
  }
}

// ─── Server-side tracking helpers ────────────────────────────────────────────
// getApiEndpoint, getAnonymousId, collectBrowserContext are imported from
// analyticsTransportUtils.ts (shared with analyticsStorageService.ts).

/**
 * Send an event to the server-side /d endpoint as a FALLBACK.
 *
 * Smart deduplication: waits a few seconds for analytics.js to initialize.
 * - If analytics.js loads successfully → skip (client-side handles it)
 * - If analytics.js is blocked → send via server-side /d endpoint
 *
 * This avoids duplicate events while guaranteeing delivery for blocked users.
 * Includes full browser context to match analytics.js event format.
 */
const SERVER_FALLBACK_DELAY_MS = 4000;

function sendServerSideEvent(payload: {
  type: 'page' | 'track' | 'identify';
  anonymousId: string;
  name?: string;
  event?: string;
  properties?: Record<string, unknown>;
  traits?: Record<string, unknown>;
}): void {
  // Capture browser context NOW (before the timeout, in case user navigates)
  const context = collectBrowserContext();

  setTimeout(() => {
    // Check if client-side analytics.js successfully initialized
    const analytics = window.analytics as Record<string, unknown> | undefined;
    if (analytics?.initialized) {
      if (import.meta.env.DEV) {
        console.debug('Server-side tracking skipped: analytics.js initialized');
      }
      return;
    }

    // analytics.js blocked or failed to load — send via server-side
    const apiEndpoint = getApiEndpoint();
    fetch(`${apiEndpoint}/d`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, context }),
      keepalive: true,
    }).catch(() => {
      // Silently fail — best-effort
    });
  }, SERVER_FALLBACK_DELAY_MS);
}

class SegmentAnalyticsService {
  private static instance: SegmentAnalyticsService;
  private isInitialized: boolean = false;
  private lastTrackedEvents: Map<string, number> = new Map(); // Prevent duplicate sending
  private readonly DEBOUNCE_TIME = 1000; // 1 second debounce

  private constructor() {}

  static getInstance(): SegmentAnalyticsService {
    if (!SegmentAnalyticsService.instance) {
      SegmentAnalyticsService.instance = new SegmentAnalyticsService();
      SegmentAnalyticsService.instance.initialize();
    }
    return SegmentAnalyticsService.instance;
  }

  initialize() {
    if (this.isInitialized) return;
    
    // Check if Segment is already loaded
    if (typeof window !== 'undefined' && window.analytics) {
      this.isInitialized = true;
      console.log('Segment Analytics already initialized');
      return;
    }
    
    console.log('Segment Analytics service initialized');
    this.isInitialized = true;
  }

  // Track custom events with debouncing to prevent duplicates.
  // skipDynamoDB: when true, skip the DynamoDB dual-write (used when the
  // caller already stored a richer record via storeAnalyticsEvent directly).
  track(event: string, properties?: Record<string, unknown>, { skipDynamoDB = false }: { skipDynamoDB?: boolean } = {}) {
    if (!this.isInitialized) {
      console.warn('Segment Analytics not initialized');
      return;
    }

    // Create a unique key for this event
    const eventKey = `${event}_${JSON.stringify(properties || {})}`;
    const now = Date.now();
    const lastTracked = this.lastTrackedEvents.get(eventKey);

    // Check if this event was recently tracked
    if (lastTracked && (now - lastTracked) < this.DEBOUNCE_TIME) {
      console.log('Segment event debounced (duplicate):', event);
      return;
    }

    this.lastTrackedEvents.set(eventKey, now);

    // Send to Segment (if analytics.js is loaded)
    if (typeof window !== 'undefined' && window.analytics && window.analytics.track) {
      window.analytics.track(event, properties);
      console.log('Segment Track Event:', event, properties);
    }

    // Always dual-write to DynamoDB regardless of analytics.js availability,
    // unless the caller already stored the event (skipDynamoDB).
    if (!skipDynamoDB) {
      storeAnalyticsEvent({
        eventName: event,
        eventType: eventNameToType(event),
        context: {
          pathname: typeof window !== 'undefined' ? window.location.pathname : undefined,
          pageTitle: typeof window !== 'undefined' ? document.title : undefined,
          productId: properties?.productId as string | undefined,
          productName: properties?.productName as string | undefined,
          referrer: typeof document !== 'undefined' ? document.referrer : undefined,
          utmTerm: typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('utm_term') || undefined : undefined,
        },
        properties,
      });
    }

    // Clean up old entries (older than 5 minutes)
    const fiveMinutesAgo = now - (5 * 60 * 1000);
    for (const [key, timestamp] of this.lastTrackedEvents.entries()) {
      if (timestamp < fiveMinutesAgo) {
        this.lastTrackedEvents.delete(key);
      }
    }
  }

  // Identify users
  identify(userId: string, traits?: Record<string, unknown>) {
    if (typeof window !== 'undefined' && window.analytics && window.analytics.identify) {
      window.analytics.identify(userId, traits);
      console.log('Segment Identify User:', userId, traits);
    }
  }

  // Track page views
  page(name?: string, properties?: Record<string, unknown>) {
    if (typeof window !== 'undefined' && window.analytics && window.analytics.page) {
      window.analytics.page(name, properties);
      console.log('Segment Page View:', name, properties);
    }
  }

  // Track group events
  group(groupId: string, traits?: Record<string, unknown>) {
    if (typeof window !== 'undefined' && window.analytics && window.analytics.group) {
      window.analytics.group(groupId, traits);
      console.log('Segment Group Event:', groupId, traits);
    }
  }

  // Alias users
  alias(userId: string, previousId?: string) {
    if (typeof window !== 'undefined' && window.analytics && window.analytics.alias) {
      window.analytics.alias(userId, previousId);
      console.log('Segment Alias User:', userId, previousId);
    }
  }

  // Reset user
  reset() {
    if (typeof window !== 'undefined' && window.analytics && window.analytics.reset) {
      window.analytics.reset();
      console.log('Segment Reset User');
    }
  }

  // Product-specific tracking methods
  trackProductView(productId: string, productName: string) {
    this.track('Product Viewed', {
      productId,
      productName,
      category: 'Product'
    });
  }

  trackProductDownload(productId: string, productName: string) {
    // Track behavior signal for PDF download
    behaviorAnalytics.trackPDFDownload(productId);
    
    this.track('Product Downloaded', {
      productId,
      productName,
      category: 'Product',
      fileType: 'pdf'
    });
  }

  trackContactFormSubmit(productId?: string, productName?: string) {
    this.track('Contact Form Submitted', {
      productId,
      productName,
      formName: 'contact_form'
    });
  }

  trackRFQSubmission(productId?: string, productName?: string) {
    this.track('RFQ Submitted', {
      productId,
      productName,
      formName: 'rfq_submission'
    });
  }

  trackDatasheetDownload(productId: string, productName: string) {
    this.track('Datasheet Downloaded', {
      productId,
      productName,
      fileType: 'datasheet',
      fileName: `${productName}_datasheet.pdf`
    });
  }

  trackSearch(searchTerm: string) {
    this.track('Search Performed', {
      searchTerm
    });
  }

  // E-commerce events
  trackAddToCart(productId: string, productName: string, value: number = 0) {
    this.track('Product Added to Cart', {
      productId,
      productName,
      value,
      currency: 'USD'
    });
  }

  trackPurchase(orderId: string, products: Array<{id: string, name: string, price: number}>, total: number) {
    this.track('Purchase Completed', {
      orderId,
      products,
      total,
      currency: 'USD'
    });
  }

  // IP Analytics and Target Customer Analysis
  async trackWithIPAnalysis(event: string, properties?: Record<string, unknown>) {
    try {
      // Get IP information and analysis results
      const ipInfo = await ipAnalytics.getIPInfo();
      const analysis = await ipAnalytics.analyzeTargetCustomer();

      // Get behavior score
      const behaviorScore = behaviorAnalytics.calculateBehaviorScore();

      // ── Target customer determination ─────────────────────────────────
      // Based on org type (categorical), NOT confidence thresholds.
      //   1. Target org type (education/university/research_institute) → always target
      //   2. AI says isTargetCustomer → target (business/enterprise/hospital/government)
      //   3. ISP/unknown + strong behavior → target (professor at home, VPN user)
      const orgType = analysis?.organizationType || 'unknown';
      const TARGET_ORG_TYPES = ['education', 'university', 'research_institute', 'government'];
      const isTargetOrgType = TARGET_ORG_TYPES.includes(orgType);
      const isAITarget = analysis?.isTargetCustomer === true;
      const isBehaviorTarget = ['isp', 'hosting', 'telecom_isp', 'unknown'].includes(orgType)
        && behaviorScore.behaviorScore >= 0.4;
      const isTargetCustomer = isTargetOrgType || isAITarget || isBehaviorTarget;

      // ── Final confidence (metadata, not a driver) ─────────────────────
      // AI confidence = how sure AI is about the org TYPE classification.
      // Blended with behavior when both are available.
      const aiConfidence = analysis?.confidence ?? 0;
      const hasBehaviorData = behaviorScore.behaviorScore > 0;
      let finalConfidence: number;
      if (aiConfidence > 0 && hasBehaviorData) {
        finalConfidence = aiConfidence * 0.5 + behaviorScore.behaviorScore * 0.5;
      } else if (aiConfidence > 0) {
        finalConfidence = aiConfidence;
      } else if (hasBehaviorData) {
        finalConfidence = behaviorScore.behaviorScore;
      } else {
        finalConfidence = 0;
      }

      // ── Lead tier (only for target customers) ─────────────────────────
      // Based on org type category + AI confidence, then boosted by behavior.
      let finalLeadTier: 'A' | 'B' | 'C' | undefined = analysis?.leadTier;
      if (isTargetCustomer) {
        if (!finalLeadTier) {
          // Assign initial tier based on how the visitor was classified
          if (isTargetOrgType && aiConfidence >= 0.7) {
            finalLeadTier = 'A';
          } else if (isTargetOrgType || (isAITarget && aiConfidence >= 0.5)) {
            finalLeadTier = 'B';
          } else {
            finalLeadTier = 'C';
          }
        }
      } else {
        finalLeadTier = undefined;
      }

      // Apply behavioral tier boost (cross-validated multi-signal upgrade)
      finalLeadTier = applyBehavioralTierBoost(isTargetCustomer, finalLeadTier, behaviorScore);

      // Merge event properties
      const enhancedProperties = {
        ...properties,
        ipInfo: ipInfo ? {
          ip: ipInfo.ip,
          country: ipInfo.country,
          region: ipInfo.region,
          city: ipInfo.city,
          org: ipInfo.org,
          isp: ipInfo.isp,
          timezone: ipInfo.timezone,
          latitude: ipInfo.latitude,
          longitude: ipInfo.longitude,
          privacy: ipInfo.privacy,
          company: ipInfo.company
        } : null,
        targetCustomerAnalysis: analysis ? {
          isTargetCustomer,
          organizationType: analysis.organizationType,
          confidence: analysis.confidence,
          finalConfidence,
          leadTier: finalLeadTier,
          orgName: analysis.details.orgName,
          orgType: analysis.details.orgType,
          location: analysis.details.location,
          keywords: analysis.details.keywords
        } : null,
        behaviorScore: {
          productPagesViewed: behaviorScore.productPagesViewed,
          highValuePagesViewed: behaviorScore.highValuePagesViewed,
          timeOnSite: behaviorScore.timeOnSite,
          pdfDownloads: behaviorScore.pdfDownloads,
          returnVisits: behaviorScore.returnVisits,
          isPaidTraffic: behaviorScore.isPaidTraffic,
          trafficChannel: behaviorScore.trafficChannel,
          behaviorScore: behaviorScore.behaviorScore
        }
      };

      // Send to Segment with enhanced properties
      this.track(event, enhancedProperties);

      // Server-side tracking: guarantee delivery even when analytics.js is blocked
      if (typeof window !== 'undefined') {
        sendServerSideEvent({
          type: 'track',
          anonymousId: getAnonymousId(),
          event,
          properties: enhancedProperties,
        });
      }

      // Wait for AI classification before DynamoDB write (avoid missing AI data)
      const aiResult = ipAnalytics.getAIClassification()
        ?? await ipAnalytics.waitForAIClassification(3000);

      // Dual-write to DynamoDB (fire-and-forget)
      storeAnalyticsEvent({
        eventName: event,
        eventType: eventNameToType(event),
        ipInfo: ipInfo ? { ip: ipInfo.ip, country: ipInfo.country, region: ipInfo.region, city: ipInfo.city, org: ipInfo.org, isp: ipInfo.isp, companyType: ipInfo.company?.type, latitude: ipInfo.latitude, longitude: ipInfo.longitude } : null,
        targetAnalysis: analysis ? {
          isTargetCustomer,
          organizationType: analysis.organizationType,
          orgName: analysis.details.orgName,
          confidence: analysis.confidence,
          finalConfidence,
          leadTier: finalLeadTier,
        } : null,
        behaviorScore: {
          behaviorScore: behaviorScore.behaviorScore,
          productPagesViewed: behaviorScore.productPagesViewed,
          timeOnSite: behaviorScore.timeOnSite,
          pdfDownloads: behaviorScore.pdfDownloads,
          returnVisits: behaviorScore.returnVisits,
          isPaidTraffic: behaviorScore.isPaidTraffic,
          trafficChannel: behaviorScore.trafficChannel,
        },
        aiClassification: aiResult ? {
          aiOrganizationType: aiResult.organizationType,
          aiConfidence: aiResult.confidence,
          aiReason: aiResult.reason,
        } : null,
        context: {
          pathname: (properties?.pathname || properties?.pagePath || '') as string,
          pageTitle: typeof window !== 'undefined' ? document.title : undefined,
          productId: properties?.productId as string | undefined,
          productName: properties?.productName as string | undefined,
          referrer: typeof document !== 'undefined' ? document.referrer : undefined,
          utmTerm: typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('utm_term') || undefined : undefined,
        },
        properties,
      });

      // If it's a target customer, send Segment-only event (skipDynamoDB because
      // the full event was already stored above via storeAnalyticsEvent with
      // complete IP/org fields — the track() dual-write would create a duplicate
      // record missing top-level org data, causing dashboard grouping issues).
      if (isTargetCustomer) {
        this.track('Target Customer Detected', {
          originalEvent: event,
          timestamp: new Date().toISOString(),
          organizationType: analysis?.organizationType || 'unknown',
          orgName: analysis?.details.orgName || 'Unknown',
          orgType: analysis?.details.orgType || 'Unknown',
          location: analysis?.details.location || 'Unknown',
          keywords: analysis?.details.keywords || [],
          confidence: analysis?.confidence || 0,
          finalConfidence,
          leadTier: finalLeadTier || 'C',
          behaviorScore: behaviorScore.behaviorScore,
          behaviorDetails: {
            productPagesViewed: behaviorScore.productPagesViewed,
            highValuePagesViewed: behaviorScore.highValuePagesViewed,
            timeOnSite: behaviorScore.timeOnSite,
            pdfDownloads: behaviorScore.pdfDownloads,
            returnVisits: behaviorScore.returnVisits,
            isPaidTraffic: behaviorScore.isPaidTraffic,
            trafficChannel: behaviorScore.trafficChannel
          },
          ipInfo: ipInfo ? {
            ip: ipInfo.ip,
            country: ipInfo.country,
            region: ipInfo.region,
            city: ipInfo.city,
            org: ipInfo.org,
            isp: ipInfo.isp,
            privacy: ipInfo.privacy,
            company: ipInfo.company
          } : null,
          pagePath: properties?.pathname || properties?.pagePath || 'unknown',
          pageUrl: typeof window !== 'undefined' ? window.location.href : undefined,
          pageTitle: typeof window !== 'undefined' ? document.title : undefined
        }, { skipDynamoDB: true });
      }

      console.log('Event tracked with IP analysis:', {
        event,
        ipInfo,
        analysis
      });

    } catch (error) {
      console.error('Error tracking with IP analysis:', error);
      // If IP analysis fails, send the original event without IP data
      if (properties) {
        this.track(event, properties);
      } else {
        this.track(event);
      }
    }
  }

  // Perform IP analysis on page view
  async trackPageViewWithAnalysis(pageName?: string, properties?: Record<string, unknown>) {
    try {
      // Get IP information and analysis results
      const ipInfo = await ipAnalytics.getIPInfo();
      const analysis = await ipAnalytics.analyzeTargetCustomer();

      // Auto-detect product page visit from pathname so behavior score
      // reflects product interest even before the product component mounts
      const pagePath = (properties?.pathname || pageName || '') as string;
      if (pagePath.startsWith('/products/') && pagePath.length > '/products/'.length) {
        const productSlug = pagePath.split('/').filter(Boolean).pop() || '';
        if (productSlug) {
          behaviorAnalytics.trackProductView(productSlug, productSlug);
        }
      }

      // Get behavior score (includes timeOnSite)
      const behaviorScore = behaviorAnalytics.calculateBehaviorScore();

      // ── Target customer determination ─────────────────────────────────
      const orgType = analysis?.organizationType || 'unknown';
      const TARGET_ORG_TYPES = ['education', 'university', 'research_institute', 'government'];
      const isTargetOrgType = TARGET_ORG_TYPES.includes(orgType);
      const isAITarget = analysis?.isTargetCustomer === true;
      const isBehaviorTarget = ['isp', 'hosting', 'telecom_isp', 'unknown'].includes(orgType)
        && behaviorScore.behaviorScore >= 0.4;
      const isTargetCustomer = isTargetOrgType || isAITarget || isBehaviorTarget;

      // ── Final confidence (metadata) ───────────────────────────────────
      const aiConfidence = analysis?.confidence ?? 0;
      const hasBehaviorData = behaviorScore.behaviorScore > 0;
      let finalConfidence: number;
      if (aiConfidence > 0 && hasBehaviorData) {
        finalConfidence = aiConfidence * 0.5 + behaviorScore.behaviorScore * 0.5;
      } else if (aiConfidence > 0) {
        finalConfidence = aiConfidence;
      } else if (hasBehaviorData) {
        finalConfidence = behaviorScore.behaviorScore;
      } else {
        finalConfidence = 0;
      }

      // ── Lead tier ─────────────────────────────────────────────────────
      let finalLeadTier: 'A' | 'B' | 'C' | undefined = analysis?.leadTier;
      if (isTargetCustomer) {
        if (!finalLeadTier) {
          if (isTargetOrgType && aiConfidence >= 0.7) {
            finalLeadTier = 'A';
          } else if (isTargetOrgType || (isAITarget && aiConfidence >= 0.5)) {
            finalLeadTier = 'B';
          } else {
            finalLeadTier = 'C';
          }
        }
      } else {
        finalLeadTier = undefined;
      }

      finalLeadTier = applyBehavioralTierBoost(isTargetCustomer, finalLeadTier, behaviorScore);

      // Extract search query from referrer (available when enterprise proxies leak full URL)
      const referrer = typeof document !== 'undefined' ? document.referrer : undefined;
      const searchQuery = extractSearchQuery(referrer);

      // Merge event properties with IP info and behavior
      const pathname = properties?.pathname || pageName || '';
      const enhancedProperties = {
        ...properties,
        path: pathname,  // Segment expects 'path' property
        pathname: pathname,
        search: properties?.search || '',
        hash: properties?.hash || '',
        title: typeof window !== 'undefined' ? document.title : '',
        url: typeof window !== 'undefined' ? window.location.href : '',
        ipInfo: ipInfo ? {
          ip: ipInfo.ip,
          country: ipInfo.country,
          region: ipInfo.region,
          city: ipInfo.city,
          org: ipInfo.org,
          isp: ipInfo.isp,
          timezone: ipInfo.timezone,
          latitude: ipInfo.latitude,
          longitude: ipInfo.longitude,
          privacy: ipInfo.privacy,
          company: ipInfo.company
        } : null,
        targetCustomerAnalysis: analysis ? {
          isTargetCustomer,
          organizationType: analysis.organizationType,
          confidence: analysis.confidence,
          finalConfidence,
          leadTier: finalLeadTier,
          orgName: analysis.details.orgName,
          orgType: analysis.details.orgType,
          location: analysis.details.location,
          keywords: analysis.details.keywords
        } : null,
        behaviorScore: {
          productPagesViewed: behaviorScore.productPagesViewed,
          highValuePagesViewed: behaviorScore.highValuePagesViewed,
          timeOnSite: behaviorScore.timeOnSite,
          pdfDownloads: behaviorScore.pdfDownloads,
          returnVisits: behaviorScore.returnVisits,
          isPaidTraffic: behaviorScore.isPaidTraffic,
          trafficChannel: behaviorScore.trafficChannel,
          behaviorScore: behaviorScore.behaviorScore
        },
        ...(searchQuery ? { searchQuery } : {}),
      };

      // Send PAGE event with enhanced properties (instead of TRACK event)
      if (typeof window !== 'undefined' && window.analytics && window.analytics.page) {
        window.analytics.page(pageName, enhancedProperties);
        console.log('Segment Page View with IP + Behavior analysis:', enhancedProperties);
      }

      // Server-side tracking
      if (typeof window !== 'undefined') {
        sendServerSideEvent({
          type: 'page',
          anonymousId: getAnonymousId(),
          name: pageName,
          properties: enhancedProperties,
        });
      }

      // Wait for AI classification before DynamoDB write (avoid missing AI data)
      const aiResultPage = ipAnalytics.getAIClassification()
        ?? await ipAnalytics.waitForAIClassification(3000);

      // Dual-write page view to DynamoDB (fire-and-forget)
      storeAnalyticsEvent({
        eventName: 'Page Viewed',
        eventType: 'page_view',
        ipInfo: ipInfo ? { ip: ipInfo.ip, country: ipInfo.country, region: ipInfo.region, city: ipInfo.city, org: ipInfo.org, isp: ipInfo.isp, companyType: ipInfo.company?.type, latitude: ipInfo.latitude, longitude: ipInfo.longitude } : null,
        targetAnalysis: analysis ? {
          isTargetCustomer,
          organizationType: analysis.organizationType,
          orgName: analysis.details.orgName,
          confidence: analysis.confidence,
          finalConfidence,
          leadTier: finalLeadTier,
        } : null,
        behaviorScore: {
          behaviorScore: behaviorScore.behaviorScore,
          productPagesViewed: behaviorScore.productPagesViewed,
          timeOnSite: behaviorScore.timeOnSite,
          pdfDownloads: behaviorScore.pdfDownloads,
          returnVisits: behaviorScore.returnVisits,
          isPaidTraffic: behaviorScore.isPaidTraffic,
          trafficChannel: behaviorScore.trafficChannel,
        },
        aiClassification: aiResultPage ? {
          aiOrganizationType: aiResultPage.organizationType,
          aiConfidence: aiResultPage.confidence,
          aiReason: aiResultPage.reason,
        } : null,
        context: {
          pathname: pathname as string,
          pageTitle: typeof window !== 'undefined' ? document.title : undefined,
          referrer: typeof document !== 'undefined' ? document.referrer : undefined,
          utmTerm: typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('utm_term') || undefined : undefined,
          searchQuery,
        },
      });

      // If it's a target customer, send Segment-only event
      if (isTargetCustomer) {
        this.track('Target Customer Detected', {
          originalEvent: 'Page Viewed',
          timestamp: new Date().toISOString(),
          organizationType: analysis?.organizationType || 'unknown',
          orgName: analysis?.details.orgName || 'Unknown',
          orgType: analysis?.details.orgType || 'Unknown',
          location: analysis?.details.location || 'Unknown',
          keywords: analysis?.details.keywords || [],
          confidence: analysis?.confidence || 0,
          finalConfidence,
          leadTier: finalLeadTier || 'C',
          behaviorScore: behaviorScore.behaviorScore,
          behaviorDetails: {
            productPagesViewed: behaviorScore.productPagesViewed,
            highValuePagesViewed: behaviorScore.highValuePagesViewed,
            timeOnSite: behaviorScore.timeOnSite,
            pdfDownloads: behaviorScore.pdfDownloads,
            returnVisits: behaviorScore.returnVisits,
            isPaidTraffic: behaviorScore.isPaidTraffic,
            trafficChannel: behaviorScore.trafficChannel
          },
          ipInfo: ipInfo ? {
            ip: ipInfo.ip,
            country: ipInfo.country,
            region: ipInfo.region,
            city: ipInfo.city,
            org: ipInfo.org,
            isp: ipInfo.isp,
            privacy: ipInfo.privacy,
            company: ipInfo.company
          } : null,
          pagePath: properties?.pathname || pageName || 'unknown',
          pageUrl: typeof window !== 'undefined' ? window.location.href : undefined,
          pageTitle: typeof window !== 'undefined' ? document.title : undefined
        }, { skipDynamoDB: true });
      }

    } catch (error) {
      console.error('Error tracking page view with IP analysis:', error);
      // If IP analysis fails, send the basic page event without IP data
      if (typeof window !== 'undefined' && window.analytics && window.analytics.page) {
        window.analytics.page(pageName, {
          ...properties,
          pathname: properties?.pathname || pageName,
          search: properties?.search || '',
          hash: properties?.hash || '',
          title: typeof window !== 'undefined' ? document.title : '',
          url: typeof window !== 'undefined' ? window.location.href : ''
        });
      }
    }
  }

  // Perform IP analysis on product view
  async trackProductViewWithAnalysis(productId: string, productName: string) {
    // Track behavior signal for product view
    behaviorAnalytics.trackProductView(productId, productName);
    
    await this.trackWithIPAnalysis('Product Viewed', {
      productId,
      productName,
      category: 'Product'
    });
  }

  // Perform IP analysis on contact form submission
  async trackContactFormSubmitWithAnalysis(productId?: string, productName?: string) {
    await this.trackWithIPAnalysis('Contact Form Submitted', {
      productId,
      productName,
      formName: 'contact_form'
    });
  }

  // Perform IP analysis on RFQ submission
  async trackRFQSubmissionWithAnalysis(productId?: string, productName?: string) {
    await this.trackWithIPAnalysis('RFQ Submitted', {
      productId,
      productName,
      formName: 'rfq_submission'
    });
  }

  // Get current IP information
  async getCurrentIPInfo(): Promise<IPInfo | null> {
    return await ipAnalytics.getIPInfo();
  }

  // Get target customer analysis results
  async getTargetCustomerAnalysis(): Promise<TargetCustomerAnalysis | null> {
    return await ipAnalytics.analyzeTargetCustomer();
  }

  // Use simplified IP analysis service
  async trackWithSimpleIPAnalysis(event: string, properties?: Record<string, unknown>) {
    try {
      // Get simplified IP information and analysis results
      const ipInfo = await simpleIPAnalytics.getIPInfo();
      const analysis = await simpleIPAnalytics.analyzeTargetCustomer();

      // Merge event properties
      const enhancedProperties = {
        ...properties,
        simpleIPInfo: ipInfo ? {
          ip: ipInfo.ip,
          country: ipInfo.country,
          region: ipInfo.region,
          city: ipInfo.city,
          org: ipInfo.org,
          isp: ipInfo.isp
        } : null,
        simpleTargetCustomerAnalysis: analysis ? {
          isTargetCustomer: analysis.isTargetCustomer,
          organizationType: analysis.organizationType,
          confidence: analysis.confidence,
          orgName: analysis.details.orgName,
          orgType: analysis.details.orgType,
          location: analysis.details.location,
          keywords: analysis.details.keywords
        } : null
      };

      // Send to Segment with enhanced properties
      this.track(event, enhancedProperties);

      // If it's a target customer, send additional event (not duplicate)
      if (analysis && analysis.isTargetCustomer) {
        this.track('Simple Target Customer Detected', {
          originalEvent: event,
          organizationType: analysis.organizationType,
          confidence: analysis.confidence,
          leadTier: analysis.leadTier || 'C',
          orgName: analysis.details.orgName,
          location: analysis.details.location
        });
      }

      console.log('Event tracked with simple IP analysis:', {
        event,
        ipInfo,
        analysis
      });

    } catch (error) {
      console.error('Error tracking with simple IP analysis:', error);
      // If IP analysis fails, send the original event without IP data
      if (properties) {
        this.track(event, properties);
      } else {
        this.track(event);
      }
    }
  }

  // Get simplified IP information
  async getSimpleIPInfo(): Promise<SimpleIPInfo | null> {
    return await simpleIPAnalytics.getIPInfo();
  }

  // Get simplified target customer analysis results
  async getSimpleTargetCustomerAnalysis(): Promise<SimpleTargetCustomerAnalysis | null> {
    return await simpleIPAnalytics.analyzeTargetCustomer();
  }

  /**
   * Send time-on-page data via sendBeacon (guaranteed delivery on page unload).
   * Falls back to fetch+keepalive if sendBeacon is unavailable.
   */
  sendTimeBeacon(pagePath: string, timeOnPage: number, totalTimeOnSite: number, pageTitle?: string): void {
    try {
      const apiEndpoint = getApiEndpoint();
      const payload = JSON.stringify({
        type: 'track',
        event: 'Time on Page',
        anonymousId: getAnonymousId(),
        properties: {
          pathname: pagePath,
          timeOnPage,
          totalTimeOnSite,
          url: window.location.origin + pagePath,
          title: pageTitle || document.title,
          visitorId: getVisitorId(),
        },
        context: collectBrowserContext(),
      });

      const url = `${apiEndpoint}/d`;

      if (navigator.sendBeacon) {
        const blob = new Blob([payload], { type: 'application/json' });
        const sent = navigator.sendBeacon(url, blob);
        if (sent) return;
      }

      // Fallback: fetch with keepalive
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      }).catch(() => { /* best-effort */ });
    } catch {
      // Silently fail — this runs during page unload
    }
  }
}

export const segmentAnalytics = SegmentAnalyticsService.getInstance(); 
