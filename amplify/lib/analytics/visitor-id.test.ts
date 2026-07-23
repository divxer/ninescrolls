import { describe, it, expect } from 'vitest';
import { sanitizeVisitorId } from './visitor-id';

describe('sanitizeVisitorId', () => {
    it('accepts UUID-shaped ids', () => {
        expect(sanitizeVisitorId('550e8400-e29b-41d4-a716-446655440000'))
            .toBe('550e8400-e29b-41d4-a716-446655440000');
    });

    it('trims surrounding whitespace', () => {
        expect(sanitizeVisitorId('  abc123def456  ')).toBe('abc123def456');
    });

    it('rejects non-strings, empties, and junk', () => {
        expect(sanitizeVisitorId(undefined)).toBeUndefined();
        expect(sanitizeVisitorId(null)).toBeUndefined();
        expect(sanitizeVisitorId(42)).toBeUndefined();
        expect(sanitizeVisitorId('')).toBeUndefined();
        expect(sanitizeVisitorId('short')).toBeUndefined(); // below min length
        expect(sanitizeVisitorId('a'.repeat(65))).toBeUndefined(); // above max
        expect(sanitizeVisitorId('has spaces inside')).toBeUndefined();
        expect(sanitizeVisitorId('<script>alert(1)</script>')).toBeUndefined();
        expect(sanitizeVisitorId('id;drop table')).toBeUndefined();
    });
});
