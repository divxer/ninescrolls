import { useEffect, useRef } from 'react';
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

const HUBSPOT_SCRIPT_ID = 'hs-script-loader';
const HUBSPOT_SRC = '//js-na2.hs-scripts.com/241965345.js';

/**
 * HubSpot Page View Sync Component
 *
 * Dynamically loads the HubSpot tracking script and syncs React Router
 * route changes with HubSpot tracking. Only rendered on public routes
 * so the tracking script never loads on admin pages.
 */
export const HubSpotPageViewSync: React.FC = () => {
  const location = useLocation();
  const scriptLoaded = useRef(false);

  // Load HubSpot script dynamically (once)
  useEffect(() => {
    if (scriptLoaded.current || document.getElementById(HUBSPOT_SCRIPT_ID)) {
      return;
    }
    const script = document.createElement('script');
    script.id = HUBSPOT_SCRIPT_ID;
    script.src = HUBSPOT_SRC;
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
    scriptLoaded.current = true;
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !window._hsq) {
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

  // Skip tracking for trailing-slash paths — RedirectHandler will normalize
  // them and we'll track the canonical (no trailing slash) path instead
  if (location.pathname !== '/' && location.pathname.endsWith('/')) {
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
