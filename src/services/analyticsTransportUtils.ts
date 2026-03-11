// ─── Shared transport utilities for analytics services ──────────────────────
// Extracted to avoid circular dependency between segmentAnalytics.ts and
// analyticsStorageService.ts. Both import from here.

import outputs from '../../amplify_outputs.json';

/**
 * Get the REST API endpoint for server-side analytics.
 * Resolves from amplify_outputs.json, env var, or hardcoded fallback.
 */
export function getApiEndpoint(): string {
  if (outputs?.custom?.API?.['ninescrolls-api']?.endpoint) {
    return outputs.custom.API['ninescrolls-api'].endpoint.replace(/\/$/, '');
  }
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  return 'https://api.ninescrolls.com';
}

/**
 * Get or generate a stable anonymous ID.
 * Tries Segment's cookie first, then localStorage, then generates a new UUID.
 */
export function getAnonymousId(): string {
  // Try Segment's ajs_anonymous_id cookie
  try {
    const match = document.cookie.match(/ajs_anonymous_id=([^;]+)/);
    if (match?.[1]) {
      const decoded = decodeURIComponent(match[1]).replace(/^"|"$/g, '');
      if (decoded) return decoded;
    }
  } catch { /* ignore */ }

  // Try localStorage (Segment also stores it there)
  try {
    const stored = localStorage.getItem('ajs_anonymous_id');
    if (stored) {
      const cleaned = stored.replace(/^"|"$/g, '');
      if (cleaned) return cleaned;
    }
  } catch { /* ignore */ }

  // Generate a new UUID and persist it
  const id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  try {
    localStorage.setItem('ajs_anonymous_id', JSON.stringify(id));
  } catch { /* ignore */ }
  return id;
}

/**
 * Parse UTM campaign parameters from the current URL.
 */
function parseCampaignParams(): Record<string, string> | undefined {
  const params = new URLSearchParams(window.location.search);
  const campaign: Record<string, string> = {};
  const utmMap: Record<string, string> = {
    utm_source: 'source',
    utm_medium: 'medium',
    utm_campaign: 'name',
    utm_term: 'term',
    utm_content: 'content',
  };

  for (const [param, key] of Object.entries(utmMap)) {
    const value = params.get(param);
    if (value) campaign[key] = value;
  }

  return Object.keys(campaign).length > 0 ? campaign : undefined;
}

/**
 * Collect browser context that analytics.js would normally auto-populate.
 * This ensures server-side events have the same context structure.
 */
export function collectBrowserContext(): Record<string, unknown> {
  return {
    locale: navigator.language || '',
    page: {
      path: window.location.pathname,
      referrer: document.referrer || '',
      search: window.location.search || '',
      title: document.title || '',
      url: window.location.href,
    },
    screen: {
      width: window.screen?.width,
      height: window.screen?.height,
      density: window.devicePixelRatio || 1,
    },
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
    campaign: parseCampaignParams(),
  };
}
