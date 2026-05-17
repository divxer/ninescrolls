import { describe, it, expect } from 'vitest';
import { matchesAnyConfig } from './prefilter';
import type { TenderKeywordConfigItem } from './types';

const baseConfig = (overrides: Partial<TenderKeywordConfigItem> = {}): TenderKeywordConfigItem => ({
    PK: 'TENDER_KEYWORD_CONFIG',
    SK: 'CATEGORY#ALD',
    GSI1PK: 'TENDER_KEYWORD_CONFIG_ACTIVE',
    GSI1SK: 'ALD',
    entityType: 'TENDER_KEYWORD_CONFIG',
    productCategory: 'ALD',
    productSlugs: ['ald-system'],
    keywords: ['atomic layer deposition'],
    synonyms: [],
    blacklist: [],
    naicsCodes: [],
    cpvCodes: [],
    isActive: true,
    updatedBy: 'admin',
    updatedAt: '2026-05-01T00:00:00Z',
    ...overrides,
});

describe('matchesAnyConfig', () => {
    it('matches a tender title containing a keyword', () => {
        const r = matchesAnyConfig(
            { title: 'Atomic layer deposition system for university lab', description: '', naicsCodes: [], cpvCodes: [] },
            [baseConfig()],
        );
        expect(r.matchedCategories).toEqual(['ALD']);
        expect(r.matchedKeywords).toContain('atomic layer deposition');
    });

    it('matches a keyword case-insensitively', () => {
        const r = matchesAnyConfig(
            { title: 'ATOMIC LAYER DEPOSITION installation', description: '', naicsCodes: [], cpvCodes: [] },
            [baseConfig()],
        );
        expect(r.matchedCategories).toEqual(['ALD']);
    });

    it('skips inactive configs', () => {
        const r = matchesAnyConfig(
            { title: 'atomic layer deposition', description: '', naicsCodes: [], cpvCodes: [] },
            [baseConfig({ isActive: false })],
        );
        expect(r.matchedCategories).toEqual([]);
    });

    it('rejects when blacklist term is present', () => {
        const r = matchesAnyConfig(
            { title: 'atomic layer deposition advertisement', description: '', naicsCodes: [], cpvCodes: [] },
            [baseConfig({ blacklist: ['advertisement'] })],
        );
        expect(r.matchedCategories).toEqual([]);
    });

    it('applies code whitelist when both NAICS and CPV are set on config', () => {
        const cfg = baseConfig({ naicsCodes: ['334516'], cpvCodes: ['38540000'] });
        const matchingNaics = matchesAnyConfig(
            { title: 'atomic layer deposition', description: '', naicsCodes: ['334516'], cpvCodes: [] },
            [cfg],
        );
        const noCodeOverlap = matchesAnyConfig(
            { title: 'atomic layer deposition', description: '', naicsCodes: ['999999'], cpvCodes: ['99999999'] },
            [cfg],
        );
        expect(matchingNaics.matchedCategories).toEqual(['ALD']);
        expect(noCodeOverlap.matchedCategories).toEqual([]);
    });

    it('returns matched keywords from synonyms too', () => {
        const r = matchesAnyConfig(
            { title: 'ALD process for thin films', description: '', naicsCodes: [], cpvCodes: [] },
            [baseConfig({ keywords: ['atomic layer deposition'], synonyms: ['ALD'] })],
        );
        expect(r.matchedKeywords).toContain('ALD');
    });

    it('matches across multiple configs and returns all hit categories', () => {
        const r = matchesAnyConfig(
            { title: 'PECVD and ALD combined deposition', description: '', naicsCodes: [], cpvCodes: [] },
            [
                baseConfig({ productCategory: 'ALD', keywords: ['ALD'] }),
                baseConfig({ productCategory: 'PECVD', SK: 'CATEGORY#PECVD', GSI1SK: 'PECVD', keywords: ['PECVD'] }),
            ],
        );
        expect(r.matchedCategories.sort()).toEqual(['ALD', 'PECVD']);
    });

    it('returns empty matchedKeywords when no config matches', () => {
        const r = matchesAnyConfig(
            { title: 'orange juice procurement', description: '', naicsCodes: [], cpvCodes: [] },
            [baseConfig()],
        );
        expect(r.matchedCategories).toEqual([]);
        expect(r.matchedKeywords).toEqual([]);
    });
});
