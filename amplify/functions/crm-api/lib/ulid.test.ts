import { describe, it, expect } from 'vitest';
import { generateUlid, ULID_REGEX } from './ulid';

describe('generateUlid', () => {
  it('produces 26-char Crockford base32 ULIDs', () => {
    const u = generateUlid();
    expect(u).toHaveLength(26);
    expect(u).toMatch(ULID_REGEX);
  });
  it('is unique across rapid calls', () => {
    const seen = new Set(Array.from({ length: 1000 }, () => generateUlid()));
    expect(seen.size).toBe(1000);
  });
  it('lexicographic order follows time', () => {
    const a = generateUlid(1000);
    const b = generateUlid(1003);
    expect(a < b).toBe(true);
  });
});
