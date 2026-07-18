// amplify/lib/rfq/referenceNumber.ts
import crypto from 'node:crypto';

/**
 * Human-facing DISPLAY reference, stable across both rfqId schemes. Not a unique
 * key — the 4-hex suffix is 16 bits and can collide; `rfqId` is authoritative.
 *
 * Direct ids `rfq-YYYYMMDD-<hex>` keep the byte-identical historical reference.
 * Draft ids are base64url(SHA-256(...)) (contain '-'/'_', no date), so we take the
 * date from submittedAt + a 4-hex digest of the id. The strict legacy regex
 * (`\d{8}` then all-lowercase-hex to end) cannot match a 43-char mixed-case
 * base64url id, so the schemes never collide.
 */
export function deriveReferenceNumber(rfqId: string, submittedAt: string): string {
  const legacy = /^rfq-(\d{8})-([0-9a-f]+)$/.exec(rfqId);
  if (legacy) return `RFQ-${legacy[1]}-${legacy[2].slice(0, 4).toUpperCase()}`;
  const date = submittedAt.slice(0, 10).replace(/-/g, '');
  const digest = crypto.createHash('sha256').update(rfqId).digest('hex').slice(0, 4).toUpperCase();
  return `RFQ-${date}-${digest}`;
}
