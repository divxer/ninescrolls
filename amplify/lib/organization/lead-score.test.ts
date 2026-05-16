import { describe, it, expect } from 'vitest';
import { computeRfqScore, computeLeadScore, computeOrderScore } from './lead-score';

describe('computeRfqScore', () => {
    it('returns base 8 with no signals', () => {
        expect(computeRfqScore({})).toBe(8);
    });

    it('adds 5 for funded status', () => {
        expect(computeRfqScore({ fundingStatus: 'funded' })).toBe(13);
    });

    it('adds 3 for immediate timeline', () => {
        expect(computeRfqScore({ timeline: 'immediate' })).toBe(11);
    });

    it('stacks signals', () => {
        expect(computeRfqScore({ fundingStatus: 'funded', timeline: 'immediate' })).toBe(16);
    });

    it('ignores unknown values', () => {
        expect(computeRfqScore({ fundingStatus: 'pending', timeline: '6-months' })).toBe(8);
    });
});

describe('computeLeadScore', () => {
    it('returns base 2 for newsletter signup', () => {
        expect(computeLeadScore({ type: 'newsletter' })).toBe(2);
    });

    it('adds 5 for demo request', () => {
        expect(computeLeadScore({ type: 'demo-request' })).toBe(7);
    });

    it('adds 1 for tech question', () => {
        expect(computeLeadScore({ type: 'tech-question' })).toBe(3);
    });

    it('adds 1 for marketing opt-in', () => {
        expect(computeLeadScore({ type: 'newsletter', marketingOptIn: true })).toBe(3);
    });

    it('stacks demo + opt-in', () => {
        expect(computeLeadScore({ type: 'demo-request', marketingOptIn: true })).toBe(8);
    });
});

describe('computeOrderScore', () => {
    it('returns 0 with no amount', () => {
        expect(computeOrderScore()).toBe(0);
    });

    it('returns 5 for small order', () => {
        expect(computeOrderScore(15_000)).toBe(5);
    });

    it('returns 15 for mid order', () => {
        expect(computeOrderScore(50_000)).toBe(15);
    });

    it('returns 25 for large order', () => {
        expect(computeOrderScore(200_000)).toBe(25);
    });

    it('handles boundary at 30000', () => {
        expect(computeOrderScore(30_000)).toBe(15);
    });

    it('handles boundary at 100000', () => {
        expect(computeOrderScore(100_000)).toBe(25);
    });
});
