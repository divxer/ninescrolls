import { describe, it, expect } from 'vitest';
import {
    tenderItemKey,
    tenderMatchItemKey,
    tenderStatusLogItemKey,
    tenderKeywordConfigItemKey,
    tenderStatusGsiKey,
    tenderHashGsiKey,
    tenderHighPriorityGsiKey,
    tenderKeywordConfigActiveGsiKey,
    scoreSortToken,
} from './keys';

describe('keys', () => {
    describe('tenderItemKey', () => {
        it('builds the TENDER metadata key', () => {
            expect(tenderItemKey('sam-12345')).toEqual({
                PK: 'TENDER#sam-12345',
                SK: 'METADATA',
            });
        });
    });

    describe('tenderMatchItemKey', () => {
        it('builds the MATCH key for a product slug', () => {
            expect(tenderMatchItemKey('sam-12345', 'pluto-f')).toEqual({
                PK: 'TENDER#sam-12345',
                SK: 'MATCH#pluto-f',
            });
        });
    });

    describe('tenderStatusLogItemKey', () => {
        it('builds the LOG key with a sortable timestamp prefix', () => {
            const key = tenderStatusLogItemKey('sam-12345', '2026-05-14T10:30:00.000Z', 'abc123');
            expect(key.PK).toBe('TENDER#sam-12345');
            expect(key.SK).toBe('LOG#2026-05-14T10:30:00.000Z#abc123');
        });
    });

    describe('tenderKeywordConfigItemKey', () => {
        it('builds the CATEGORY key', () => {
            expect(tenderKeywordConfigItemKey('PECVD')).toEqual({
                PK: 'TENDER_KEYWORD_CONFIG',
                SK: 'CATEGORY#PECVD',
            });
        });
    });

    describe('tenderStatusGsiKey', () => {
        it('builds GSI1 key with inverse-score sort token', () => {
            expect(tenderStatusGsiKey('new', 87, '2026-05-14', 'sam-12345')).toEqual({
                GSI1PK: 'TENDER_STATUS#new',
                GSI1SK: '013#2026-05-14#sam-12345',
            });
        });

        it('zero-pads the score token to 3 digits', () => {
            expect(tenderStatusGsiKey('new', 0, '2026-05-14', 'a').GSI1SK).toBe('100#2026-05-14#a');
            expect(tenderStatusGsiKey('new', 100, '2026-05-14', 'a').GSI1SK).toBe('000#2026-05-14#a');
            expect(tenderStatusGsiKey('new', 50, '2026-05-14', 'a').GSI1SK).toBe('050#2026-05-14#a');
        });
    });

    describe('tenderHashGsiKey', () => {
        it('builds GSI2 dedupe key', () => {
            expect(tenderHashGsiKey('abc123')).toEqual({
                GSI2PK: 'TENDER_HASH#abc123',
                GSI2SK: 'TENDER',
            });
        });
    });

    describe('tenderHighPriorityGsiKey', () => {
        it('builds GSI3 high-priority key', () => {
            expect(tenderHighPriorityGsiKey('2026-05-14', 'sam-12345')).toEqual({
                GSI3PK: 'TENDER_HIGH_PRIORITY',
                GSI3SK: '2026-05-14#sam-12345',
            });
        });
    });

    describe('tenderKeywordConfigActiveGsiKey', () => {
        it('builds GSI1 active config key', () => {
            expect(tenderKeywordConfigActiveGsiKey('PECVD')).toEqual({
                GSI1PK: 'TENDER_KEYWORD_CONFIG_ACTIVE',
                GSI1SK: 'CATEGORY#PECVD',
            });
        });
    });

    describe('scoreSortToken', () => {
        it('clamps negative scores to 100 (lowest priority)', () => {
            expect(scoreSortToken(-5)).toBe('100');
        });
        it('clamps scores above 100 to 0 (highest priority)', () => {
            expect(scoreSortToken(150)).toBe('000');
        });
    });
});
