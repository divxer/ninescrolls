import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { analytics } from '../../services/analytics';

interface GoogleAnalyticsProps {
  measurementId?: string;
}

export const GoogleAnalytics: React.FC<GoogleAnalyticsProps> = ({ 
  measurementId 
}) => {
  const location = useLocation();

  useEffect(() => {
    // Initialize analytics if measurement ID is provided
    if (measurementId) {
      analytics.initialize();
    }
  }, [measurementId]);

  useEffect(() => {
    // Track page views
    if (measurementId) {
      analytics.trackPageView(location.pathname, document.title);
    }
  }, [location, measurementId]);

  return null; // This component doesn't render anything
};

// Hook for tracking custom events
export const useAnalytics = () => {
  return {
    trackEvent: (category: string, action: string, label?: string, value?: number) => {
      analytics.trackEvent({ category: category as any, action: action as any, label, value });
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
    trackCustomEvent: (eventName: string, parameters?: Record<string, any>) => {
      analytics.trackCustomEvent(eventName, parameters);
    },
    trackSearch: (searchTerm: string) => {
      analytics.trackSearch(searchTerm);
    },
    identifyUser: (userId: string, traits?: any) => {
      analytics.identifyUser(userId, traits);
    }
  };
}; 