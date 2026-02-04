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
    // IP Analysis methods
    trackWithIPAnalysis: async (event: string, properties?: SegmentProperties) => {
      await segmentAnalytics.trackWithIPAnalysis(event, properties);
    },
    trackProductViewWithAnalysis: async (productId: string, productName: string) => {
      await segmentAnalytics.trackProductViewWithAnalysis(productId, productName);
    },
    trackContactFormSubmitWithAnalysis: async (productId?: string, productName?: string) => {
      await segmentAnalytics.trackContactFormSubmitWithAnalysis(productId, productName);
    },
    getCurrentIPInfo: async () => {
      return await segmentAnalytics.getCurrentIPInfo();
    },
    getTargetCustomerAnalysis: async () => {
      return await segmentAnalytics.getTargetCustomerAnalysis();
    },
    // Simple IP Analysis methods
    trackWithSimpleIPAnalysis: async (event: string, properties?: SegmentProperties) => {
      await segmentAnalytics.trackWithSimpleIPAnalysis(event, properties);
    },
    getSimpleIPInfo: async () => {
      return await segmentAnalytics.getSimpleIPInfo();
    },
    getSimpleTargetCustomerAnalysis: async () => {
      return await segmentAnalytics.getSimpleTargetCustomerAnalysis();
    }
  }), []);
};
