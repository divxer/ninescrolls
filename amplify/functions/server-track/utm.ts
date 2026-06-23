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
