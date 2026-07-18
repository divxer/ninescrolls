import crypto from 'node:crypto';

/** A credential (nonce / draft token / submit key) is exactly 32 random bytes. */
export const CREDENTIAL_BYTES = 32;

export class InvalidCredentialError extends Error {
  constructor(message = 'Invalid credential encoding') {
    super(message);
    this.name = 'InvalidCredentialError';
  }
}

const BASE64URL_RE = /^[A-Za-z0-9_-]+$/;

/** Encode raw bytes as base64url without padding. */
export function encodeCredential(bytes: Buffer): string {
  if (bytes.length !== CREDENTIAL_BYTES) {
    throw new InvalidCredentialError();
  }
  return bytes.toString('base64url');
}

/** Decode a base64url credential, requiring exactly CREDENTIAL_BYTES bytes. */
export function decodeCredential(value: string): Buffer {
  if (typeof value !== 'string' || !BASE64URL_RE.test(value)) {
    throw new InvalidCredentialError();
  }
  const bytes = Buffer.from(value, 'base64url');
  if (bytes.length !== CREDENTIAL_BYTES) {
    throw new InvalidCredentialError();
  }
  return bytes;
}

const DRAFT_TOKEN_INFO = 'ninescrolls/rfq-draft-token/v1';
const DRAFT_ID_INFO = 'ninescrolls/rfq-draft-id/v1';

/**
 * Bearer token = HKDF-SHA-256(ikm=nonce, info=domain). Deterministic and
 * independent of the pepper, so an identical create retry returns the same token.
 */
export function deriveDraftToken(nonce: Buffer): Buffer {
  return Buffer.from(
    crypto.hkdfSync('sha256', nonce, Buffer.alloc(0), Buffer.from(DRAFT_TOKEN_INFO), CREDENTIAL_BYTES),
  );
}

/**
 * Non-enumerable rfqId = base64url(SHA-256(domain || nonce)). Deterministic and
 * distinct from the token (different domain, different primitive).
 */
export function deriveDraftId(nonce: Buffer): string {
  const digest = crypto.createHash('sha256')
    .update(DRAFT_ID_INFO)
    .update(nonce)
    .digest();
  return digest.toString('base64url');
}
