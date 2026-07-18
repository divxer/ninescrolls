// amplify/lib/rfq/clientRequestToken.test.ts
import { describe, it, expect } from 'vitest';
import { deriveClientRequestToken } from './clientRequestToken';

const KEY = Buffer.alloc(32, 7).toString('base64url'); // valid 32-byte credential

describe('deriveClientRequestToken', () => {
  it('is stable for the same submit key (idempotent retries share a token)', () => {
    expect(deriveClientRequestToken(KEY)).toBe(deriveClientRequestToken(KEY));
  });

  it('differs for different submit keys', () => {
    const other = Buffer.alloc(32, 8).toString('base64url');
    expect(deriveClientRequestToken(KEY)).not.toBe(deriveClientRequestToken(other));
  });

  it('is at most 36 characters (DynamoDB ClientRequestToken limit)', () => {
    expect(deriveClientRequestToken(KEY).length).toBeLessThanOrEqual(36);
    expect(deriveClientRequestToken(KEY).length).toBeGreaterThan(0);
  });

  it('rejects a malformed submit key', () => {
    expect(() => deriveClientRequestToken('not base64url!!')).toThrow();
  });
});
