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
  it('lexicographic order follows time for calls ≥2ms apart', async () => {
    const a = generateUlid();
    await new Promise((r) => setTimeout(r, 3));
    const b = generateUlid();
    expect(a < b).toBe(true);
  });
});
