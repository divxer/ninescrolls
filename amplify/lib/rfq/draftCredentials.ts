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
