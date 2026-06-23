import { describe, it, expect } from 'vitest';
import { normalizeUtm } from './utm';

describe('normalizeUtm', () => {
  it('returns a trimmed string for normal input', () => {
    expect(normalizeUtm('mrs')).toBe('mrs');
    expect(normalizeUtm('  mxenes_202610  ')).toBe('mxenes_202610');
  });

  it('returns undefined for null / undefined / empty / whitespace', () => {
    expect(normalizeUtm(undefined)).toBeUndefined();
    expect(normalizeUtm(null)).toBeUndefined();
    expect(normalizeUtm('')).toBeUndefined();
    expect(normalizeUtm('   ')).toBeUndefined();
  });

  it('coerces non-string input to string (defensive against malformed payloads)', () => {
    expect(normalizeUtm(123)).toBe('123');
    expect(normalizeUtm(true)).toBe('true');
  });

  it('caps length to guard against oversized public input', () => {
    const long = 'a'.repeat(500);
    expect(normalizeUtm(long)).toHaveLength(200);
    expect(normalizeUtm(long, 10)).toBe('aaaaaaaaaa');
  });
});
