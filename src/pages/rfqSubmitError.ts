/**
 * Rendering for RFQ API rejections.
 *
 * The RFQ API rejects with `{ success: false, error, details? }` and never sends
 * a `message` key. Reading the wrong key collapsed every 400/403/500 into one
 * generic retry string, which hid a live enum-drift outage on Probe-Station RFQs.
 */
export type SubmitErrorBody = {
  success?: boolean;
  error?: string;
  message?: string;
  details?: { field?: string; message?: string }[];
} | null;

export const GENERIC_SUBMIT_ERROR = 'Failed to submit request. Please try again.';

/** Human-readable reason for a rejected submission, naming the offending fields. */
export function describeSubmitError(body: SubmitErrorBody): string {
  const fields = (body?.details ?? [])
    .map(d => (d.field ? `${d.field}: ${d.message ?? ''}`.trim() : d.message))
    .filter((s): s is string => Boolean(s));

  if (fields.length > 0) {
    return `${body?.error ?? 'Validation failed'} — ${fields.join('; ')}`;
  }
  return body?.error || body?.message || GENERIC_SUBMIT_ERROR;
}
