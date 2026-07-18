import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import {
  encodeCredential,
  decodeCredential,
  deriveDraftToken,
  deriveDraftId,
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
