import { describe, it, expect } from 'vitest';
import { sourceTenderHash } from './hash';

describe('sourceTenderHash', () => {
    it('is deterministic for identical inputs', () => {
        const a = sourceTenderHash({
            title: 'PECVD System for Stanford Cleanroom',
            agency: 'Stanford University',
            deadline: '2026-08-15',
        });
        const b = sourceTenderHash({
            title: 'PECVD System for Stanford Cleanroom',
            agency: 'Stanford University',
            deadline: '2026-08-15',
        });
        expect(a).toBe(b);
        expect(a).toHaveLength(64); // sha256 hex
    });

    it('ignores leading/trailing whitespace and case in title and agency', () => {
        const a = sourceTenderHash({
            title: '  PECVD System  ',
            agency: 'Stanford University',
            deadline: '2026-08-15',
        });
        const b = sourceTenderHash({
            title: 'pecvd system',
            agency: 'stanford university',
            deadline: '2026-08-15',
        });
        expect(a).toBe(b);
    });

    it('treats missing deadline as empty string', () => {
        const a = sourceTenderHash({
            title: 'X',
            agency: 'Y',
            deadline: undefined,
        });
        const b = sourceTenderHash({
            title: 'X',
            agency: 'Y',
            deadline: null,
        });
        expect(a).toBe(b);
    });

    it('produces different hashes for different titles', () => {
        const a = sourceTenderHash({ title: 'A', agency: 'X', deadline: '2026-01-01' });
        const b = sourceTenderHash({ title: 'B', agency: 'X', deadline: '2026-01-01' });
        expect(a).not.toBe(b);
    });

    it('separator collisions: pipe characters in field values do not cause hash collisions', () => {
        // Regression test: an earlier implementation joined fields with '|',
        // which collided when a field value contained that character.
        const a = sourceTenderHash({ title: 'foo|bar', agency: 'baz', deadline: '2026-01-01' });
        const b = sourceTenderHash({ title: 'foo', agency: 'bar|baz', deadline: '2026-01-01' });
        expect(a).not.toBe(b);
    });
});
