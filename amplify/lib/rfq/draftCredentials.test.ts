import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import {
  encodeCredential,
  decodeCredential,
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
