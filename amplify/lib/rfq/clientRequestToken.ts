// amplify/lib/rfq/clientRequestToken.ts
import crypto from 'node:crypto';
import { decodeCredential } from './draftCredentials';

const TOKEN_DOMAIN = 'ninescrolls/rfq-submit-crt/v1';

/**
 * Stable, ≤36-char DynamoDB ClientRequestToken derived from the 32-byte submit key.
 * Domain-separated so it never equals the receipt id or the key itself. 27 bytes of
 * digest → 36 base64url chars (216 bits) — well within the 36-char limit and
 * collision-resistant. Belt-and-suspenders with the receipt barrier (D5a).
 */
export function deriveClientRequestToken(submitKeyB64: string): string {
  const keyBytes = decodeCredential(submitKeyB64); // enforces exactly 32 bytes
  const digest = crypto.createHash('sha256').update(TOKEN_DOMAIN).update(keyBytes).digest();
  return digest.subarray(0, 27).toString('base64url'); // 27 bytes → 36 chars, no padding
}
