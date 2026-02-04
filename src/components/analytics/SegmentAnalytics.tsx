import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { segmentAnalytics } from '../../services/segmentAnalytics';
import { behaviorAnalytics } from '../../services/behaviorAnalytics';

interface SegmentAnalyticsProps {
  writeKey?: string;
}

type SegmentAnalyticsClient = {
  track: (event: string, properties?: Record<string, unknown>) => void;
  identify: (userId: string, traits?: Record<string, unknown>) => void;
  page: (name?: string, properties?: Record<string, unknown>) => void;
  group: (groupId: string, traits?: Record<string, unknown>) => void;
  alias: (userId: string, previousId?: string) => void;
  reset: () => void;
};

type SegmentAnalyticsStub = SegmentAnalyticsClient & {
  initialized?: boolean;
  invoked?: boolean;
  methods?: string[];
  factory?: (method: string) => (...args: unknown[]) => void;
  load?: (key: string, options?: Record<string, unknown>) => void;
  _writeKey?: string;
  SNIPPET_VERSION?: string;
  push: (args: unknown[]) => number;
};

declare global {
  interface Window {
    analytics?: SegmentAnalyticsClient;
  }
}

export const SegmentAnalytics: React.FC<SegmentAnalyticsProps> = ({ 
  writeKey = 'WMoEScvR6dgChGx0LQUz0wQhgXK4nAHU'
}) => {
  const location = useLocation();
  const pageStartTimeRef = useRef<number>(Date.now());
  const currentPathRef = useRef<string>(location.pathname);

  useEffect(() => {
    // Load Segment script if not already loaded
    if (typeof window !== 'undefined' && !window.analytics) {
      const analytics = (window.analytics = ((window.analytics || []) as unknown as SegmentAnalyticsStub));
      if (analytics.invoked) {
        window.console?.error?.('Segment snippet included twice.');
        return;
      }

      analytics.invoked = true;
      analytics.methods = [
        'trackSubmit',
        'trackClick',
        'trackLink',
        'trackForm',
        'pageview',
        'identify',
        'reset',
        'group',
        'track',
        'ready',
        'alias',
        'debug',
        'page',
        'screen',
        'once',
        'off',
        'on',
        'addSourceMiddleware',
        'addIntegrationMiddleware',
        'setAnonymousId',
        'addDestinationMiddleware',
        'register'
      ];

      analytics.factory = (method: string) => {
        return (...args: unknown[]) => {
          if (analytics.initialized && typeof (analytics as Record<string, unknown>)[method] === 'function') {
            const analyticsMethods = analytics as unknown as Record<string, (...params: unknown[]) => unknown>;
            return analyticsMethods[method](...args);
          }
          const payload = args.slice();
          if (['track', 'screen', 'alias', 'group', 'page', 'identify'].includes(method)) {
            const canonical = document.querySelector("link[rel='canonical']")?.getAttribute('href') || undefined;
            payload.push({
              __t: 'bpc',
              c: canonical,
              p: window.location.pathname,
              u: window.location.href,
              s: window.location.search,
              t: document.title,
              r: document.referrer
            });
          }
          payload.unshift(method);
          analytics.push(payload);
          return analytics;
        };
      };

      analytics.methods.forEach((method) => {
        (analytics as Record<string, unknown>)[method] = analytics.factory?.(method);
      });

      analytics.load = (key: string) => {
        const script = document.createElement('script');
        script.type = 'text/javascript';
        script.async = true;
        script.setAttribute('data-global-segment-analytics-key', 'analytics');
        script.src = `https://cdn.segment.com/analytics.js/v1/${key}/analytics.min.js`;
        const firstScript = document.getElementsByTagName('script')[0];
        firstScript?.parentNode?.insertBefore(script, firstScript);
      };

      analytics._writeKey = writeKey;
      analytics.SNIPPET_VERSION = '5.2.0';
      analytics.load(writeKey);
    }
  }, [writeKey]);

  useEffect(() => {
    // Track time spent on previous page before route change
    if (currentPathRef.current !== location.pathname) {
      const timeOnPreviousPage = Math.floor((Date.now() - pageStartTimeRef.current) / 1000);
      if (timeOnPreviousPage > 90) {
        behaviorAnalytics.trackTimeOnPage(currentPathRef.current, timeOnPreviousPage);
      }
    }

    // Reset timer for new page
    pageStartTimeRef.current = Date.now();
    currentPathRef.current = location.pathname;

    // Track page views with Segment and IP analysis (merged into single call)
    if (typeof window !== 'undefined' && window.analytics) {
      // Single call that handles both page event and IP analysis
      segmentAnalytics.trackPageViewWithAnalysis(location.pathname, {
        pathname: location.pathname,
        search: location.search,
        hash: location.hash
      });
    }

    // Track traffic source on first page load
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const utmSource = urlParams.get('utm_source');
      const utmMedium = urlParams.get('utm_medium');
      const utmCampaign = urlParams.get('utm_campaign');
      
      if (utmSource || utmMedium || document.referrer) {
        behaviorAnalytics.trackTrafficSource(
          utmSource || document.referrer || 'direct',
          utmMedium || 'direct',
          utmCampaign || undefined
        );
      }
    }
  }, [location.pathname, location.search, location.hash]);

  // Track time on page when user leaves the site
  useEffect(() => {
    const handleBeforeUnload = () => {
      const timeOnPage = Math.floor((Date.now() - pageStartTimeRef.current) / 1000);
      if (timeOnPage > 90) {
        behaviorAnalytics.trackTimeOnPage(currentPathRef.current, timeOnPage);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        const timeOnPage = Math.floor((Date.now() - pageStartTimeRef.current) / 1000);
        if (timeOnPage > 90) {
          behaviorAnalytics.trackTimeOnPage(currentPathRef.current, timeOnPage);
        }
      } else if (document.visibilityState === 'visible') {
        // Reset timer when page becomes visible again
        pageStartTimeRef.current = Date.now();
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', handleBeforeUnload);
      document.addEventListener('visibilitychange', handleVisibilityChange);
      
      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }
  }, []);

  return null; // This component doesn't render anything
};
