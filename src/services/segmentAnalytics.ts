// Segment Analytics Service
// This service provides a unified interface for tracking events with Segment
// Includes server-side tracking fallback for visitors with ad blockers

import { behaviorAnalytics, extractSearchQuery } from './behaviorAnalytics';
import { storeAnalyticsEvent, sendPageViewBeacon, createPageViewId } from './analyticsStorageService';

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
  // Track custom event: sends to /d Lambda via sendBeacon (fire-and-forget).
  // Lambda handles IP lookup, AI classification, DDB write, and enriched Segment event.
  // Also fires basic client-side Segment track event for client-side integrations.
  trackWithIPAnalysis(event: string, properties?: Record<string, unknown>) {
    const pageViewId = (properties?.pageViewId as string) || createPageViewId();
    const behaviorScore = behaviorAnalytics.calculateBehaviorScore();

    // Fire-and-forget: /d Lambda does IP lookup + AI + DDB + enriched Segment event
    sendPageViewBeacon({
      eventName: event,
      eventType: eventNameToType(event),
      pageViewId,
      behaviorScore: {
        behaviorScore: behaviorScore.behaviorScore,
        productPagesViewed: behaviorScore.productPagesViewed,
        timeOnSite: behaviorScore.timeOnSite,
        pdfDownloads: behaviorScore.pdfDownloads,
        returnVisits: behaviorScore.returnVisits,
        isPaidTraffic: behaviorScore.isPaidTraffic,
        trafficChannel: behaviorScore.trafficChannel,
      },
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

  }

  // Track page view: sends minimal context to /d Lambda via sendBeacon.
  // Lambda handles IP lookup, AI classification, DDB write, and enriched Segment event.
  // Client-side analytics.page() fires immediately with basic properties for client-side integrations.
  trackPageViewWithAnalysis(pageName?: string, properties?: Record<string, unknown>) {
    const pageViewId = (properties?.pageViewId as string) || createPageViewId();
    const pathname = properties?.pathname || pageName || '';

    // Auto-detect product page visit from pathname
    if (typeof pathname === 'string' && pathname.startsWith('/products/') && pathname.length > '/products/'.length) {
      const productSlug = pathname.split('/').filter(Boolean).pop() || '';
      if (productSlug) behaviorAnalytics.trackProductView(productSlug, productSlug);
    }

    const behaviorScore = behaviorAnalytics.calculateBehaviorScore();
    const referrer = typeof document !== 'undefined' ? document.referrer : undefined;
    const searchQuery = extractSearchQuery(referrer);

    // Fire-and-forget: /d Lambda does IP lookup + AI + DDB + enriched Segment event
    sendPageViewBeacon({
      eventName: 'Page Viewed',
      eventType: 'page_view',
      pageViewId,
      behaviorScore: {
        behaviorScore: behaviorScore.behaviorScore,
        productPagesViewed: behaviorScore.productPagesViewed,
        timeOnSite: behaviorScore.timeOnSite,
        pdfDownloads: behaviorScore.pdfDownloads,
        returnVisits: behaviorScore.returnVisits,
        isPaidTraffic: behaviorScore.isPaidTraffic,
        trafficChannel: behaviorScore.trafficChannel,
      },
      context: {
        pathname: pathname as string,
        pageTitle: typeof window !== 'undefined' ? document.title : undefined,
        referrer,
        utmTerm: typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('utm_term') || undefined : undefined,
        searchQuery,
      },
    });

  }

  trackProductViewWithAnalysis(productId: string, productName: string) {
    behaviorAnalytics.trackProductView(productId, productName);
    this.trackWithIPAnalysis('Product Viewed', { productId, productName, category: 'Product' });
  }

  trackContactFormSubmitWithAnalysis(productId?: string, productName?: string) {
    this.trackWithIPAnalysis('Contact Form Submitted', { productId, productName, formName: 'contact_form' });
  }

  trackRFQSubmissionWithAnalysis(productId?: string, productName?: string) {
    this.trackWithIPAnalysis('RFQ Submitted', { productId, productName, formName: 'rfq_submission' });
  }

}

export const segmentAnalytics = SegmentAnalyticsService.getInstance(); 
