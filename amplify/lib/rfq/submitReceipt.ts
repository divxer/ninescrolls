import crypto from 'node:crypto';
import { decodeCredential } from './draftCredentials';

const RECEIPT_ID_DOMAIN = 'ninescrolls/rfq-submit-receipt/v1';
const BINDING_DOMAIN = 'ninescrolls/rfq-submit-binding/v1';

/** Values that are one-time or secret and must never enter the canonical payload. */
const EXCLUDED_FROM_BINDING = new Set([
  'turnstileToken', 'submitIdempotencyKey', 'draftToken', 'draftCreateNonce',
]);

export type SubmitOperationKind = 'direct' | 'draft-upgrade';
export type SubmitOperation =
  | { kind: 'direct' }
  | { kind: 'draft-upgrade'; rfqId: string };

/** Non-enumerable receipt id = SUBMIT_RECEIPT#base64url(SHA-256(domain || key)). */
export function deriveSubmitReceiptId(submitKeyB64: string): string {
  const keyBytes = decodeCredential(submitKeyB64); // enforces 32 bytes
  const digest = crypto.createHash('sha256').update(RECEIPT_ID_DOMAIN).update(keyBytes).digest();
  return `SUBMIT_RECEIPT#${digest.toString('base64url')}`;
}

/** Deterministic canonical JSON of the payload, minus one-time/credential values. */
export function canonicalizeRfqPayload(payload: Record<string, unknown>): string {
  const seen = new WeakSet<object>();
  const canonicalize = (value: unknown): unknown => {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) throw new TypeError('RFQ payload must contain only finite JSON numbers');
      return Object.is(value, -0) ? 0 : value;
    }
    if (typeof value !== 'object') throw new TypeError('RFQ payload must contain only JSON values');
    if (seen.has(value)) throw new TypeError('RFQ payload must not be cyclic');
    seen.add(value);
    let result: unknown;
    if (Array.isArray(value)) {
      if (Object.keys(value).length !== value.length) throw new TypeError('RFQ payload arrays must not be sparse');
      result = value.map(canonicalize);
    } else {
      if (Object.getPrototypeOf(value) !== Object.prototype) throw new TypeError('RFQ payload objects must be plain');
      result = Object.fromEntries(Object.entries(value as Record<string, unknown>)
        .filter(([key, child]) => !EXCLUDED_FROM_BINDING.has(key) && child !== undefined)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, child]) => [key, canonicalize(child)]));
    }
    seen.delete(value);
    return result;
  };
  return JSON.stringify(canonicalize(payload));
}

/** Domain-separated, non-reversible binding over (payload, opKind, rfqId?). */
export function computeRequestBinding(
  payload: Record<string, unknown>, operation: SubmitOperation,
): string {
  if (operation.kind === 'direct' && 'rfqId' in operation) throw new TypeError('direct submission must not include rfqId');
  if (operation.kind === 'draft-upgrade' && (!operation.rfqId || !operation.rfqId.trim())) {
    throw new TypeError('draft-upgrade requires rfqId');
  }
  const rfqId = operation.kind === 'draft-upgrade' ? operation.rfqId : '';
  return crypto.createHash('sha256')
    .update(BINDING_DOMAIN).update('\0')
    .update(operation.kind).update('\0')
    .update(rfqId).update('\0')
    .update(canonicalizeRfqPayload(payload))
    .digest('hex');
}
