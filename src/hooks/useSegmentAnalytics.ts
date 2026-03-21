import { useMemo } from 'react';
import { segmentAnalytics } from '../services/segmentAnalytics';

type SegmentProperties = Record<string, unknown>;

export const useSegmentAnalytics = () => {
  return useMemo(() => ({
    track: (event: string, properties?: SegmentProperties) => {
      if (typeof window !== 'undefined' && window.analytics && window.analytics.track) {
        window.analytics.track(event, properties);
      }
    },
    identify: (userId: string, traits?: SegmentProperties) => {
      if (typeof window !== 'undefined' && window.analytics && window.analytics.identify) {
        window.analytics.identify(userId, traits);
      }
    },
    page: (name?: string, properties?: SegmentProperties) => {
      if (typeof window !== 'undefined' && window.analytics && window.analytics.page) {
        window.analytics.page(name, properties);
      }
    },
    group: (groupId: string, traits?: SegmentProperties) => {
      if (typeof window !== 'undefined' && window.analytics && window.analytics.group) {
        window.analytics.group(groupId, traits);
      }
    },
    alias: (userId: string, previousId?: string) => {
      if (typeof window !== 'undefined' && window.analytics && window.analytics.alias) {
        window.analytics.alias(userId, previousId);
      }
    },
    reset: () => {
      if (typeof window !== 'undefined' && window.analytics && window.analytics.reset) {
        window.analytics.reset();
      }
    },
    // IP Analysis methods (server-side via /d Lambda)
    trackWithIPAnalysis: (event: string, properties?: SegmentProperties) => {
      segmentAnalytics.trackWithIPAnalysis(event, properties);
    },
    trackProductViewWithAnalysis: (productId: string, productName: string) => {
      segmentAnalytics.trackProductViewWithAnalysis(productId, productName);
    },
    trackContactFormSubmitWithAnalysis: (productId?: string, productName?: string) => {
      segmentAnalytics.trackContactFormSubmitWithAnalysis(productId, productName);
    },
    trackRFQSubmissionWithAnalysis: (productId?: string, productName?: string) => {
      segmentAnalytics.trackRFQSubmissionWithAnalysis(productId, productName);
    },
  }), []);
};
