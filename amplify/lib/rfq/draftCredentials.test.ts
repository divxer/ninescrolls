import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import {
  encodeCredential,
  decodeCredential,
  deriveDraftToken,
  deriveDraftId,
  hashDraftToken,
  verifyDraftToken,
  InvalidCredentialError,
} from './draftCredentials';

describe('credential codec', () => {
  it('round-trips exactly 32 random bytes as unpadded base64url', () => {
    const bytes = crypto.randomBytes(32);
    const encoded = encodeCredential(bytes);
    expect(encoded).not.toMatch(/[+/=]/); // url-safe, no padding
    expect(decodeCredential(encoded).equals(bytes)).toBe(true);
  });

  it('rejects a credential that does not decode to 32 bytes', () => {
    const short = crypto.randomBytes(16).toString('base64url');
    expect(() => decodeCredential(short)).toThrow(InvalidCredentialError);
  });

  it('rejects raw values that are not exactly 32 bytes before encoding', () => {
    expect(() => encodeCredential(crypto.randomBytes(16))).toThrow(InvalidCredentialError);
    expect(() => encodeCredential(crypto.randomBytes(33))).toThrow(InvalidCredentialError);
  });

  it('rejects a credential with non-base64url characters', () => {
    expect(() => decodeCredential('not*valid*base64url')).toThrow(InvalidCredentialError);
  });

  it('rejects non-canonical base64url aliases with unused trailing bits', () => {
    const bytes = Buffer.alloc(32, 1);
    const canonical = encodeCredential(bytes);
    const alias = `${canonical.slice(0, -1)}F`;

    expect(alias).not.toBe(canonical);
    expect(Buffer.from(alias, 'base64url').equals(bytes)).toBe(true);
    expect(() => decodeCredential(alias)).toThrow(InvalidCredentialError);
  });
});

describe('draft token + id derivation', () => {
  const nonce = crypto.randomBytes(32);

  it('derives a 32-byte token deterministically from the nonce', () => {
    const a = deriveDraftToken(nonce);
    const b = deriveDraftToken(nonce);
    expect(a.length).toBe(32);
    expect(a.equals(b)).toBe(true);       // identical retry → identical token
    expect(a.equals(nonce)).toBe(false);  // token is not the nonce
  });

  it('derives a url-safe id deterministically, distinct from the token', () => {
    const id = deriveDraftId(nonce);
    expect(deriveDraftId(nonce)).toBe(id); // deterministic
    expect(id).toMatch(/^[A-Za-z0-9_-]+$/); // non-enumerable, url + PK safe
    expect(id).not.toBe(encodeCredential(deriveDraftToken(nonce)));
  });

  it('gives different nonces different tokens and ids', () => {
    const other = crypto.randomBytes(32);
    expect(deriveDraftToken(nonce).equals(deriveDraftToken(other))).toBe(false);
    expect(deriveDraftId(nonce)).not.toBe(deriveDraftId(other));
  });
});

describe('peppered hash + verify', () => {
  const pepperV1 = crypto.randomBytes(32);
  const pepperV2 = crypto.randomBytes(32);
  const resolve = (v: number) => (v === 1 ? pepperV1 : v === 2 ? pepperV2 : undefined);
  const nonce = crypto.randomBytes(32);
  const token = deriveDraftToken(nonce);

  it('stores a versioned hex hash and verifies the matching token', () => {
    const stored = hashDraftToken(pepperV1, 1, token);
    expect(stored).toMatch(/^v1:[0-9a-f]{64}$/);
    expect(verifyDraftToken(stored, token, resolve)).toBe(true);
  });

  it('rejects invalid pepper key versions before creating an unusable hash', () => {
    for (const version of [-1, 1.5, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => hashDraftToken(pepperV1, version, token)).toThrow(RangeError);
    }
  });

  it('rejects a wrong token', () => {
    const stored = hashDraftToken(pepperV1, 1, token);
    const wrong = deriveDraftToken(crypto.randomBytes(32));
    expect(verifyDraftToken(stored, wrong, resolve)).toBe(false);
  });

  it('selects the pepper by stored version', () => {
    const stored = hashDraftToken(pepperV2, 2, token);
    expect(verifyDraftToken(stored, token, resolve)).toBe(true);
    // verifying a v2 hash with only v1 available must fail, not throw
    expect(verifyDraftToken(stored, token, (v) => (v === 1 ? pepperV1 : undefined))).toBe(false);
  });

  it('returns false (never throws) for missing or malformed stored hashes', () => {
    expect(verifyDraftToken(undefined, token, resolve)).toBe(false);
    expect(verifyDraftToken('', token, resolve)).toBe(false);
    expect(verifyDraftToken('garbage', token, resolve)).toBe(false);
    expect(verifyDraftToken('v9:deadbeef', token, resolve)).toBe(false); // unknown version
  });
});
