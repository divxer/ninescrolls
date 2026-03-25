import { useMemo } from 'react';
import { useAnalytics } from './useAnalytics';
import { segmentAnalytics } from '../services/segmentAnalytics';
import type { EventAction, EventCategory } from '../services/analytics';

type AnalyticsTraits = Record<string, unknown>;
type AnalyticsParams = Record<string, unknown>;

// Combined analytics hook that works with both Google Analytics and Segment
export const useCombinedAnalytics = () => {
  const gaAnalytics = useAnalytics();

  return useMemo(() => ({
    // Track events with both GA and Segment
    trackEvent: (category: EventCategory | string, action: EventAction | string, label?: string, value?: number) => {
      // Google Analytics
      gaAnalytics.trackEvent(category, action, label, value);

      // Segment (via /d Lambda server-side)
      segmentAnalytics.track(`${category} ${action}`, {
        category,
        action,
        label,
        value
      });
    },

    // Product tracking
    trackProductView: (productId: string, productName: string) => {
      gaAnalytics.trackProductView(productId, productName);
      segmentAnalytics.trackProductView(productId, productName);
    },

    trackProductDownload: (productId: string, productName: string) => {
      gaAnalytics.trackProductDownload(productId, productName);
      segmentAnalytics.trackProductDownload(productId, productName);
    },

    // Contact form tracking
    trackContactFormSubmit: (productId?: string, productName?: string) => {
      // Google Analytics only — Segment handled via trackContactFormSubmitWithAnalysis
      gaAnalytics.trackContactFormSubmit(productId, productName);
    },

    // RFQ submission tracking
    trackRFQSubmission: (productId?: string, productName?: string) => {
      // Google Analytics only — Segment handled via trackRFQSubmissionWithAnalysis
      gaAnalytics.trackRFQSubmission(productId, productName);
    },

    // Datasheet download tracking
    trackDatasheetDownload: (productId: string, productName: string) => {
      gaAnalytics.trackDatasheetDownload(productId, productName);
      segmentAnalytics.trackDatasheetDownload(productId, productName);
    },

    // Search tracking
    trackSearch: (searchTerm: string) => {
      gaAnalytics.trackSearch(searchTerm);
      segmentAnalytics.trackSearch(searchTerm);
    },

    // User identification
    identifyUser: (userId: string, traits?: AnalyticsTraits) => {
      gaAnalytics.identifyUser(userId, traits);
    },

    // Custom event tracking
    trackCustomEvent: (eventName: string, parameters?: AnalyticsParams) => {
      gaAnalytics.trackCustomEvent(eventName, parameters);
      segmentAnalytics.track(eventName, parameters);
    },

    // Segment-specific methods (server-side via /d Lambda)
    segment: {
      trackWithIPAnalysis: (event: string, properties?: AnalyticsParams) => {
        segmentAnalytics.trackWithIPAnalysis(event, properties);
      },
      trackProductViewWithAnalysis: (productId: string, productName: string) => {
        segmentAnalytics.trackProductViewWithAnalysis(productId, productName);
      },
      trackContactFormSubmitWithAnalysis: (productId?: string, productName?: string) => {
        segmentAnalytics.trackContactFormSubmitWithAnalysis(productId, productName);
      },
      trackRFQSubmissionWithAnalysis: (productId?: string, productName?: string, rfqId?: string, institution?: string) => {
        segmentAnalytics.trackRFQSubmissionWithAnalysis(productId, productName, rfqId, institution);
      },
    },

    // Google Analytics-specific methods
    googleAnalytics: {
      trackEvent: gaAnalytics.trackEvent,
      trackProductView: gaAnalytics.trackProductView,
      trackProductDownload: gaAnalytics.trackProductDownload,
      trackContactFormSubmit: gaAnalytics.trackContactFormSubmit,
      trackRFQSubmission: gaAnalytics.trackRFQSubmission,
      trackDatasheetDownload: gaAnalytics.trackDatasheetDownload,
      trackSearch: gaAnalytics.trackSearch,
      identifyUser: gaAnalytics.identifyUser,
      trackCustomEvent: gaAnalytics.trackCustomEvent
    }
  }), [gaAnalytics]);
};
