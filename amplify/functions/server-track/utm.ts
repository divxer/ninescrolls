// Normalization for UTM campaign values arriving on the public /d endpoint.
// Values come from untrusted client input (context.campaign), so coerce to a
// trimmed string and cap the length before persisting to DynamoDB.

const DEFAULT_MAX_LENGTH = 200;

/**
 * Normalize an untrusted UTM value: coerce to string, trim whitespace, cap
 * length. Returns undefined for null/undefined/empty so the DDB attribute is
 * simply omitted rather than stored as an empty string.
 */
export function normalizeUtm(value: unknown, maxLength = DEFAULT_MAX_LENGTH): string | undefined {
  if (value === null || value === undefined) return undefined;
  const str = typeof value === 'string' ? value : String(value);
  const trimmed = str.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLength);
}

// Ad-platform click IDs. Present only in the landing-page URL query string;
// persisting them enables offline conversion upload (join click → RFQ → order
// value) back to the ad platforms.
const CLICK_ID_PARAMS = ['gclid', 'gbraid', 'wbraid', 'msclkid'] as const;

export type ClickIds = Partial<Record<(typeof CLICK_ID_PARAMS)[number], string>>;

/**
 * Extract ad click IDs from an untrusted URL query string
 * (context.page.search). Absent/invalid input yields an empty object so
 * callers can spread the result unconditionally.
 */
export function extractClickIds(search: unknown): ClickIds {
  if (typeof search !== 'string' || !search) return {};
  const params = new URLSearchParams(search);
  const out: ClickIds = {};
  for (const key of CLICK_ID_PARAMS) {
    const value = normalizeUtm(params.get(key));
    if (value) out[key] = value;
  }
  return out;
}
