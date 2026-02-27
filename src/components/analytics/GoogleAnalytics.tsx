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
    } else {
      console.warn('⚠️ GoogleAnalytics: measurementId is undefined. Check VITE_GA_MEASUREMENT_ID env variable.');
    }
  }, [measurementId]);

  useEffect(() => {
    // Skip tracking for trailing-slash paths — RedirectHandler will normalize
    // them and we'll track the canonical (no trailing slash) path instead
    if (location.pathname !== '/' && location.pathname.endsWith('/')) {
      return;
    }
    // Track page views
    if (measurementId) {
      analytics.trackPageView(location.pathname, document.title);
    }
  }, [location, measurementId]);

  return null; // This component doesn't render anything
};
