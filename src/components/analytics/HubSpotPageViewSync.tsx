import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

declare global {
  interface Window {
    _hsq?: HubSpotCommand[];
  }
}

type HubSpotCommand =
  | ['setPath', string]
  | ['trackPageView']
  | ['trackEvent', { id: string; value: string }];

/**
 * HubSpot Page View Sync Component
 * 
 * Syncs React Router route changes with HubSpot tracking.
 * HubSpot's default tracking code only fires on initial page load,
 * so we need to manually send pageview events on route changes.
 * 
 * This component listens to route changes and sends the correct path
 * to HubSpot using the _hsq API.
 */
export const HubSpotPageViewSync: React.FC = () => {
  const location = useLocation();

  useEffect(() => {
    // Wait for HubSpot script to load
    if (typeof window === 'undefined' || !window._hsq) {
      // HubSpot script not loaded yet, try again after a short delay
      const timeoutId = setTimeout(() => {
        if (window._hsq) {
          syncPageView(location);
        }
      }, 100);
      return () => clearTimeout(timeoutId);
    }

    syncPageView(location);
  }, [location]);

  return null;
};

/**
 * Sync page view to HubSpot
 */
function syncPageView(location: { pathname: string; search: string }) {
  if (!window._hsq) {
    return;
  }

  // Build the full path including query string
  const path = location.pathname + location.search;

  // Set the path and track page view
  // This ensures HubSpot records the correct path for SPA navigation
  window._hsq.push(['setPath', path]);
  window._hsq.push(['trackPageView']);

  // Optional: Log for debugging (remove in production if needed)
  if (process.env.NODE_ENV === 'development') {
    console.log('[HubSpot] Page view synced:', path);
  }
}
