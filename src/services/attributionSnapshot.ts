import { RFQ_FIELD_LIMITS } from '../../amplify/lib/rfq/limits';

const KEY = 'ns_attribution';
const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;
const L = RFQ_FIELD_LIMITS.attribution;

export interface AttributionSnapshot {
  source?: string;
  medium?: string;
  campaign?: string;
  term?: string;
  content?: string;
  gclid?: string;
  gbraid?: string;
  wbraid?: string;
  msclkid?: string;
  capturedAt: string;
  landingPath: string;
}

// utm fields are lowercased for aggregation alignment; click ids are kept
// verbatim (case-sensitive — folding breaks Google Ads offline-conversion match).
const UTM_FIELDS = [
  ['utm_source', 'source'],
  ['utm_medium', 'medium'],
  ['utm_campaign', 'campaign'],
  ['utm_term', 'term'],
  ['utm_content', 'content'],
] as const;
const CLICK_FIELDS = [
  ['gclid', 'gclid'],
  ['gbraid', 'gbraid'],
  ['wbraid', 'wbraid'],
  ['msclkid', 'msclkid'],
] as const;

function cap(v: string, max: number): string {
  return v.length > max ? v.slice(0, max) : v;
}

function parse(search: string, now: Date, landingPath: string): AttributionSnapshot | null {
  const params = new URLSearchParams(search);
  const out: Partial<AttributionSnapshot> = {};
  let hasAny = false;
  for (const [param, key] of UTM_FIELDS) {
    const raw = params.get(param);
    if (raw) { out[key] = cap(raw.toLowerCase(), L[key].max); hasAny = true; }
  }
  for (const [param, key] of CLICK_FIELDS) {
    const raw = params.get(param);
    if (raw) { out[key] = cap(raw, L[key].max); hasAny = true; }
  }
  if (!hasAny) return null;
  out.capturedAt = now.toISOString();
  out.landingPath = cap(landingPath, L.landingPath.max);
  return out as AttributionSnapshot;
}

/**
 * Capture last-non-direct attribution. A landing carrying any utm/click param
 * ALWAYS overwrites the stored snapshot (recency wins, ignores age). A param-less
 * landing never overwrites; it only clears a snapshot older than 90 days.
 */
export function captureLandingAttribution(
  search: string = typeof window !== 'undefined' ? window.location.search : '',
  now: Date = new Date(),
  landingPath: string = typeof window !== 'undefined' ? window.location.pathname : '',
): void {
  const fresh = parse(search, now, landingPath);
  try {
    if (fresh) {
      localStorage.setItem(KEY, JSON.stringify(fresh));
      return;
    }
    const existing = getAttributionSnapshot();
    if (existing) {
      const age = now.getTime() - new Date(existing.capturedAt).getTime();
      if (age > MAX_AGE_MS) localStorage.removeItem(KEY);
    }
  } catch { /* localStorage unavailable */ }
}

export function getAttributionSnapshot(): AttributionSnapshot | undefined {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return undefined;
    const snap = JSON.parse(raw) as AttributionSnapshot;
    if (!snap.capturedAt) return undefined;
    return snap;
  } catch {
    return undefined;
  }
}
