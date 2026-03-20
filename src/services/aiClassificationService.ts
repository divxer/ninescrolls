// AI Organization Classification Service
// Calls the /classify-org Lambda to get Claude-powered org classification
// Results cached in localStorage (7 days) + DynamoDB (30 days in Lambda)

import outputs from '../../amplify_outputs.json';

export interface AIClassification {
  organizationType: string;
  isTargetCustomer: boolean;
  confidence: number;
  reason: string;
  cached?: boolean;
}

const CACHE_KEY = 'ninescrolls_ai_classifications';
const CACHE_TTL_MS = 3 * 24 * 60 * 60 * 1000; // 3 days
const REQUEST_TIMEOUT_MS = 8000; // 8 seconds

function getApiEndpoint(): string {
  if (outputs?.custom?.API?.['ninescrolls-api']?.endpoint) {
    return outputs.custom.API['ninescrolls-api'].endpoint.replace(/\/$/, '');
  }
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  return 'https://api.ninescrolls.com';
}

// ─── Local Cache ─────────────────────────────────────────────────────────────

interface CacheEntry {
  result: AIClassification;
  timestamp: number;
}

function getLocalCache(): Record<string, CacheEntry> {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function setLocalCache(cache: Record<string, CacheEntry>): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // localStorage full or unavailable
  }
}

function getCached(orgName: string): AIClassification | null {
  const cache = getLocalCache();
  const entry = cache[orgName];
  if (!entry) return null;

  // Check TTL
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    delete cache[orgName];
    setLocalCache(cache);
    return null;
  }

  return { ...entry.result, cached: true };
}

function setCached(orgName: string, result: AIClassification): void {
  const cache = getLocalCache();
  cache[orgName] = { result, timestamp: Date.now() };

  // Evict old entries (keep max 200)
  const entries = Object.entries(cache);
  if (entries.length > 200) {
    entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
    const trimmed = Object.fromEntries(entries.slice(0, 200));
    setLocalCache(trimmed);
  } else {
    setLocalCache(cache);
  }
}

// ─── API Call ────────────────────────────────────────────────────────────────

/**
 * Classify an organization using AI (Claude Haiku via Lambda).
 * - Checks localStorage cache first (7-day TTL)
 * - Falls back to null on timeout or error (caller should use keyword-based fallback)
 * - Non-blocking: designed for fire-and-forget enrichment
 */
export async function classifyOrganization(
  orgName: string,
  country?: string,
  city?: string,
  isp?: string
): Promise<AIClassification | null> {
  if (!orgName || orgName.length < 2 || orgName === 'Unknown') {
    return null;
  }

  // Check local cache
  const cached = getCached(orgName);
  if (cached) return cached;

  try {
    const apiEndpoint = getApiEndpoint();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const response = await fetch(`${apiEndpoint}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgName, country, city, isp }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      if (import.meta.env.DEV) {
        console.warn(`classify-org API returned ${response.status}`);
      }
      return null;
    }

    const result: AIClassification = await response.json();

    // Cache locally
    setCached(orgName, result);

    return result;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('classify-org API error:', error);
    }
    return null;
  }
}
