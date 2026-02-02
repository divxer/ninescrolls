import { useAnalytics } from '../components/analytics/GoogleAnalytics';
import { useSegmentAnalytics } from '../components/analytics/SegmentAnalytics';
import { segmentAnalytics } from '../services/segmentAnalytics';

// Combined analytics hook that works with both Google Analytics and Segment
export const useCombinedAnalytics = () => {
  const gaAnalytics = useAnalytics();
  const segmentAnalyticsHook = useSegmentAnalytics();

  return {
    // Track events with both GA and Segment
    trackEvent: (category: string, action: string, label?: string, value?: number) => {
      // Google Analytics
      gaAnalytics.trackEvent(category, action, label, value);
      
      // Segment
      segmentAnalytics.track(`${category} ${action}`, {
        category,
        action,
        label,
        value
      });
    },

    // Product tracking
    trackProductView: (productId: string, productName: string) => {
      // Google Analytics
      gaAnalytics.trackProductView(productId, productName);
      
      // Segment
      segmentAnalytics.trackProductView(productId, productName);
    },

    trackProductDownload: (productId: string, productName: string) => {
      // Google Analytics
      gaAnalytics.trackProductDownload(productId, productName);
      
      // Segment
      segmentAnalytics.trackProductDownload(productId, productName);
    },

    // Contact form tracking
    trackContactFormSubmit: (productId?: string, productName?: string) => {
      // Google Analytics only
      // Segment tracking is handled separately via trackContactFormSubmitWithAnalysis
      // to avoid duplicate events (simple vs. full version with IP analysis)
      gaAnalytics.trackContactFormSubmit(productId, productName);
    },

    // Datasheet download tracking
    trackDatasheetDownload: (productId: string, productName: string) => {
      // Google Analytics
      gaAnalytics.trackDatasheetDownload(productId, productName);
      
      // Segment
      segmentAnalytics.trackDatasheetDownload(productId, productName);
    },

    // Search tracking
    trackSearch: (searchTerm: string) => {
      // Google Analytics
      gaAnalytics.trackSearch(searchTerm);
      
      // Segment
      segmentAnalytics.trackSearch(searchTerm);
    },

    // User identification
    identifyUser: (userId: string, traits?: any) => {
      // Google Analytics
      gaAnalytics.identifyUser(userId, traits);
      
      // Segment
      segmentAnalytics.identify(userId, traits);
    },

    // Custom event tracking
    trackCustomEvent: (eventName: string, parameters?: Record<string, any>) => {
      // Google Analytics
      gaAnalytics.trackCustomEvent(eventName, parameters);
      
      // Segment
      segmentAnalytics.track(eventName, parameters);
    },

    // Segment-specific methods
    segment: {
      track: segmentAnalyticsHook.track,
      identify: segmentAnalyticsHook.identify,
      page: segmentAnalyticsHook.page,
      group: segmentAnalyticsHook.group,
      alias: segmentAnalyticsHook.alias,
      reset: segmentAnalyticsHook.reset,
      // IP Analysis methods
      trackWithIPAnalysis: segmentAnalyticsHook.trackWithIPAnalysis,
      trackProductViewWithAnalysis: segmentAnalyticsHook.trackProductViewWithAnalysis,
      trackContactFormSubmitWithAnalysis: segmentAnalyticsHook.trackContactFormSubmitWithAnalysis,
      getCurrentIPInfo: segmentAnalyticsHook.getCurrentIPInfo,
      getTargetCustomerAnalysis: segmentAnalyticsHook.getTargetCustomerAnalysis,
      // Simple IP Analysis methods
      trackWithSimpleIPAnalysis: segmentAnalyticsHook.trackWithSimpleIPAnalysis,
      getSimpleIPInfo: segmentAnalyticsHook.getSimpleIPInfo,
      getSimpleTargetCustomerAnalysis: segmentAnalyticsHook.getSimpleTargetCustomerAnalysis
    },

    // Google Analytics-specific methods
    googleAnalytics: {
      trackEvent: gaAnalytics.trackEvent,
      trackProductView: gaAnalytics.trackProductView,
      trackProductDownload: gaAnalytics.trackProductDownload,
      trackContactFormSubmit: gaAnalytics.trackContactFormSubmit,
      trackDatasheetDownload: gaAnalytics.trackDatasheetDownload,
      trackSearch: gaAnalytics.trackSearch,
      identifyUser: gaAnalytics.identifyUser,
      trackCustomEvent: gaAnalytics.trackCustomEvent
    }
  };
}; 