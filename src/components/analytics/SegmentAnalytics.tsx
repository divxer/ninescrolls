import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { segmentAnalytics } from '../../services/segmentAnalytics';

interface SegmentAnalyticsProps {
  writeKey?: string;
}

declare global {
  interface Window {
    analytics: any;
  }
}

export const SegmentAnalytics: React.FC<SegmentAnalyticsProps> = ({ 
  writeKey = 'WMoEScvR6dgChGx0LQUz0wQhgXK4nAHU'
}) => {
  const location = useLocation();

  useEffect(() => {
    // Load Segment script if not already loaded
    if (typeof window !== 'undefined' && !window.analytics) {
      const script = document.createElement('script');
      script.innerHTML = `
        !function(){var i="analytics",analytics=window[i]=window[i]||[];if(!analytics.initialize)if(analytics.invoked)window.console&&console.error&&console.error("Segment snippet included twice.");else{analytics.invoked=!0;analytics.methods=["trackSubmit","trackClick","trackLink","trackForm","pageview","identify","reset","group","track","ready","alias","debug","page","screen","once","off","on","addSourceMiddleware","addIntegrationMiddleware","setAnonymousId","addDestinationMiddleware","register"];analytics.factory=function(e){return function(){if(window[i].initialized)return window[i][e].apply(window[i],arguments);var n=Array.prototype.slice.call(arguments);if(["track","screen","alias","group","page","identify"].indexOf(e)>-1){var c=document.querySelector("link[rel='canonical']");n.push({__t:"bpc",c:c&&c.getAttribute("href")||void 0,p:location.pathname,u:location.href,s:location.search,t:document.title,r:document.referrer})}n.unshift(e);analytics.push(n);return analytics}};for(var n=0;n<analytics.methods.length;n++){var key=analytics.methods[n];analytics[key]=analytics.factory(key)}analytics.load=function(key,n){var t=document.createElement("script");t.type="text/javascript";t.async=!0;t.setAttribute("data-global-segment-analytics-key",i);t.src="https://cdn.segment.com/analytics.js/v1/" + key + "/analytics.min.js";var r=document.getElementsByTagName("script")[0];r.parentNode.insertBefore(t,r);analytics._loadOptions=n};analytics._writeKey="${writeKey}";;analytics.SNIPPET_VERSION="5.2.0";
        analytics.load("${writeKey}");
        }}();
      `;
      document.head.appendChild(script);
    }
  }, [writeKey]);

  useEffect(() => {
    // Track page views with Segment and IP analysis (merged into single call)
    if (typeof window !== 'undefined' && window.analytics && window.analytics.page) {
      // Single call that handles both page event and IP analysis
      segmentAnalytics.trackPageViewWithAnalysis(location.pathname, {
        pathname: location.pathname,
        search: location.search,
        hash: location.hash
      });
    }
  }, [location]);

  return null; // This component doesn't render anything
};

// Hook for tracking custom events with Segment
export const useSegmentAnalytics = () => {
  return {
    track: (event: string, properties?: Record<string, any>) => {
      if (typeof window !== 'undefined' && window.analytics && window.analytics.track) {
        window.analytics.track(event, properties);
      }
    },
    identify: (userId: string, traits?: Record<string, any>) => {
      if (typeof window !== 'undefined' && window.analytics && window.analytics.identify) {
        window.analytics.identify(userId, traits);
      }
    },
    page: (name?: string, properties?: Record<string, any>) => {
      if (typeof window !== 'undefined' && window.analytics && window.analytics.page) {
        window.analytics.page(name, properties);
      }
    },
    group: (groupId: string, traits?: Record<string, any>) => {
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
    trackWithIPAnalysis: async (event: string, properties?: Record<string, any>) => {
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
    trackWithSimpleIPAnalysis: async (event: string, properties?: Record<string, any>) => {
      await segmentAnalytics.trackWithSimpleIPAnalysis(event, properties);
    },
    getSimpleIPInfo: async () => {
      return await segmentAnalytics.getSimpleIPInfo();
    },
    getSimpleTargetCustomerAnalysis: async () => {
      return await segmentAnalytics.getSimpleTargetCustomerAnalysis();
    }
  };
}; 