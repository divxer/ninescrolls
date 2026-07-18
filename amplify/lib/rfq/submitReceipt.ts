import crypto from 'node:crypto';
import { decodeCredential } from './draftCredentials';

const RECEIPT_ID_DOMAIN = 'ninescrolls/rfq-submit-receipt/v1';
const BINDING_DOMAIN = 'ninescrolls/rfq-submit-binding/v1';

/** Values that are one-time or secret and must never enter the canonical payload. */
const EXCLUDED_FROM_BINDING = new Set([
  'turnstileToken', 'submitIdempotencyKey', 'draftToken', 'draftCreateNonce',
]);

export type SubmitOperationKind = 'direct' | 'draft-upgrade';

/** Non-enumerable receipt id = SUBMIT_RECEIPT#base64url(SHA-256(domain || key)). */
export function deriveSubmitReceiptId(submitKeyB64: string): string {
  const keyBytes = decodeCredential(submitKeyB64); // enforces 32 bytes
  const digest = crypto.createHash('sha256').update(RECEIPT_ID_DOMAIN).update(keyBytes).digest();
  return `SUBMIT_RECEIPT#${digest.toString('base64url')}`;
}

/** Deterministic canonical JSON of the payload, minus one-time/credential values. */
export function canonicalizeRfqPayload(payload: Record<string, unknown>): string {
  const entries = Object.entries(payload)
    .filter(([k, v]) => !EXCLUDED_FROM_BINDING.has(k) && v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return JSON.stringify(entries);
}

/** Domain-separated, non-reversible binding over (payload, opKind, rfqId?). */
export function computeRequestBinding(
  payload: Record<string, unknown>, opKind: SubmitOperationKind, rfqId = '',
): string {
  return crypto.createHash('sha256')
    .update(BINDING_DOMAIN).update('\0')
    .update(opKind).update('\0')
    .update(rfqId).update('\0')
    .update(canonicalizeRfqPayload(payload))
    .digest('hex');
}
