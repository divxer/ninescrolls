import { describe, it, expect } from 'vitest';
import { classifyEmailDomain } from './etld';

describe('classifyEmailDomain', () => {
    it('extracts eTLD+1 for a standard university email', () => {
        expect(classifyEmailDomain('harvey@stanford.edu')).toEqual({
            orgId: 'stanford.edu',
            domain: 'stanford.edu',
            isFreeMailDomain: false,
        });
    });

    it('strips subdomain to eTLD+1', () => {
        const r = classifyEmailDomain('lab@media.mit.edu');
        expect(r.orgId).toBe('mit.edu');
        expect(r.domain).toBe('media.mit.edu');
    });

    it('handles compound TLDs (.edu.cn)', () => {
        const r = classifyEmailDomain('procurement@cs.tsinghua.edu.cn');
        expect(r.orgId).toBe('tsinghua.edu.cn');
        expect(r.domain).toBe('cs.tsinghua.edu.cn');
    });

    it('handles compound TLDs (.ac.uk)', () => {
        const r = classifyEmailDomain('chem@chem.ox.ac.uk');
        expect(r.orgId).toBe('ox.ac.uk');
    });

    it('skips free-mail domains (gmail.com)', () => {
        expect(classifyEmailDomain('harvey@gmail.com')).toEqual({
            orgId: null,
            domain: 'gmail.com',
            isFreeMailDomain: true,
        });
    });

    it('skips free-mail (qq.com)', () => {
        expect(classifyEmailDomain('user@qq.com').orgId).toBeNull();
    });

    it('skips free-mail (vip.qq.com)', () => {
        // vip.qq.com is its own eTLD+1 (treated like a separate brand)
        expect(classifyEmailDomain('user@vip.qq.com').orgId).toBeNull();
    });

    it('normalizes case (uppercase input)', () => {
        const r = classifyEmailDomain('HARVEY@Stanford.EDU');
        expect(r.orgId).toBe('stanford.edu');
    });

    it('handles plus-addressing transparently', () => {
        const r = classifyEmailDomain('harvey+work@stanford.edu');
        expect(r.orgId).toBe('stanford.edu');
    });

    it('returns null for empty string', () => {
        expect(classifyEmailDomain('').orgId).toBeNull();
    });

    it('returns null for missing @', () => {
        expect(classifyEmailDomain('not-an-email').orgId).toBeNull();
    });

    it('returns null for trailing @', () => {
        expect(classifyEmailDomain('user@').orgId).toBeNull();
    });

    it('returns null for unrecognized TLD', () => {
        // `tldts` returns null for domains it cannot place on PSL
        const r = classifyEmailDomain('user@invalid.fake-tld-xyz');
        expect(r.orgId).toBeNull();
    });

    it('trims whitespace', () => {
        expect(classifyEmailDomain('  user@stanford.edu  ').orgId).toBe('stanford.edu');
    });
});
