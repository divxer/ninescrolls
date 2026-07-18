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
  if (bytes.length !== CREDENTIAL_BYTES || bytes.toString('base64url') !== value) {
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

const HASH_HEX_LEN = 64; // SHA-256 hex
const DUMMY_HASH = '0'.repeat(HASH_HEX_LEN);
// Fixed dummy pepper for the non-disclosing path; never used for real storage.
const DUMMY_PEPPER = Buffer.alloc(CREDENTIAL_BYTES, 0);

/** Peppered token hash, stored as `v<keyVersion>:<hmac-sha256 hex>`. */
export function hashDraftToken(pepper: Buffer, keyVersion: number, token: Buffer): string {
  if (!Number.isSafeInteger(keyVersion) || keyVersion < 0) {
    throw new RangeError('keyVersion must be a non-negative safe integer');
  }
  const mac = crypto.createHmac('sha256', pepper).update(token).digest('hex');
  return `v${keyVersion}:${mac}`;
}

/**
 * Constant-time verification. Any missing/malformed/unknown-version input still
 * computes an HMAC and compares against a fixed dummy so the caller cannot infer
 * draft existence from timing or from which branch returned false.
 */
export function verifyDraftToken(
  storedHash: string | undefined,
  token: Buffer,
  resolvePepper: (keyVersion: number) => Buffer | undefined,
): boolean {
  const parsed = typeof storedHash === 'string' ? /^v(\d+):([0-9a-f]{64})$/.exec(storedHash) : null;
  const version = parsed ? Number(parsed[1]) : -1;
  const expectedHex = parsed ? parsed[2] : DUMMY_HASH;
  const pepper = version >= 0 ? resolvePepper(version) : undefined;
  // Always run the HMAC (dummy pepper if unresolved) to keep timing uniform.
  const actualHex = crypto
    .createHmac('sha256', pepper ?? DUMMY_PEPPER)
    .update(token)
    .digest('hex');
  const match = crypto.timingSafeEqual(Buffer.from(actualHex, 'hex'), Buffer.from(expectedHex, 'hex'));
  return match && parsed !== null && pepper !== undefined;
}
