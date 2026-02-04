import { useMemo } from 'react';
import { analytics, type EventAction, type EventCategory } from '../services/analytics';

type AnalyticsTraits = Record<string, unknown>;
type AnalyticsParams = Record<string, unknown>;

// Hook for tracking custom events
export const useAnalytics = () => {
  return useMemo(() => ({
    trackEvent: (category: EventCategory | string, action: EventAction | string, label?: string, value?: number) => {
      analytics.trackEvent({ category: category as EventCategory, action: action as EventAction, label, value });
    },
    trackProductView: (productId: string, productName: string) => {
      analytics.trackProductView(productId, productName);
    },
    trackProductDownload: (productId: string, productName: string) => {
      analytics.trackProductDownload(productId, productName);
    },
    trackContactFormSubmit: (productId?: string, productName?: string) => {
      analytics.trackContactFormSubmit(productId, productName);
    },
    trackDatasheetDownload: (productId: string, productName: string) => {
      analytics.trackDatasheetDownload(productId, productName);
    },
    trackCustomEvent: (eventName: string, parameters?: AnalyticsParams) => {
      analytics.trackCustomEvent(eventName, parameters);
    },
    trackSearch: (searchTerm: string) => {
      analytics.trackSearch(searchTerm);
    },
    identifyUser: (userId: string, traits?: AnalyticsTraits) => {
      analytics.identifyUser(userId, traits);
    }
  }), []);
};
