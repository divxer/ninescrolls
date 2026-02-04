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
