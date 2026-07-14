import { describe, it, expect } from 'vitest';
import { parseCsv, rmbToFen } from './csv';

describe('parseCsv (RFC 4180 subset)', () => {
  it('parses plain rows and trims CRLF', () => {
    expect(parseCsv('a,b\r\n1,2\r\n')).toEqual([['a', 'b'], ['1', '2']]);
  });
  it('handles quoted fields with commas and escaped quotes', () => {
    expect(parseCsv('sku,"Beijing OEM, Ltd","said ""hi"""')).toEqual([
      ['sku', 'Beijing OEM, Ltd', 'said "hi"'],
    ]);
  });
  it('handles newlines inside quoted fields and skips blank lines', () => {
    expect(parseCsv('a,"line1\nline2"\n\nb,c\n')).toEqual([['a', 'line1\nline2'], ['b', 'c']]);
  });
  it('rejects an unterminated quote', () => {
    expect(() => parseCsv('a,"oops')).toThrow(/unterminated/i);
  });
});

describe('rmbToFen (string-based, no float math)', () => {
  it('converts yuan strings to integer fen exactly', () => {
    expect(rmbToFen('72500')).toBe(7_250_000);
    expect(rmbToFen('19.9')).toBe(1990);
    expect(rmbToFen('19.99')).toBe(1999);
    expect(rmbToFen('0.01')).toBe(1);
  });
  it('rejects malformed amounts', () => {
    for (const bad of ['', 'abc', '1.999', '-5', '1,000', '1.']) {
      expect(() => rmbToFen(bad)).toThrow(/amount/i);
    }
  });
});
