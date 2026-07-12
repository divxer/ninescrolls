import { describe, it, expect } from 'vitest';
import { normalizeUtm, extractClickIds } from './utm';

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

describe('extractClickIds', () => {
  it('extracts gclid, gbraid, wbraid, and msclkid from a query string', () => {
    expect(extractClickIds('?gclid=Cj0abc&gbraid=0AAAqq&wbraid=1BBBrr&msclkid=m123')).toEqual({
      gclid: 'Cj0abc', gbraid: '0AAAqq', wbraid: '1BBBrr', msclkid: 'm123',
    });
  });

  it('returns only the click-ID params actually present', () => {
    expect(extractClickIds('?gclid=Cj0abc&utm_source=google&utm_medium=cpc')).toEqual({ gclid: 'Cj0abc' });
  });

  it('returns an empty object for missing, empty, or non-string input', () => {
    expect(extractClickIds(undefined)).toEqual({});
    expect(extractClickIds('')).toEqual({});
    expect(extractClickIds(42)).toEqual({});
    expect(extractClickIds('?utm_source=google')).toEqual({});
  });

  it('caps oversized values (public untrusted input)', () => {
    const long = 'a'.repeat(500);
    expect(extractClickIds(`?gclid=${long}`).gclid).toHaveLength(200);
  });
});
