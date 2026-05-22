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

    it('applies code whitelist when at least one of NAICS or CPV is set on config', () => {
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

    it('applies code whitelist when only NAICS is set on config', () => {
        const cfg = baseConfig({ naicsCodes: ['334516'], cpvCodes: [] });
        const matchingNaics = matchesAnyConfig(
            { title: 'atomic layer deposition', description: '', naicsCodes: ['334516'], cpvCodes: [] },
            [cfg],
        );
        const rejectedNaics = matchesAnyConfig(
            { title: 'atomic layer deposition', description: '', naicsCodes: ['999999'], cpvCodes: [] },
            [cfg],
        );
        expect(matchingNaics.matchedCategories).toEqual(['ALD']);
        expect(rejectedNaics.matchedCategories).toEqual([]);
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

    // ---- Soft filter behavior (added 2026-05-22) ----
    // When a config has NAICS/CPV restrictions, code overlap is the hard gate.
    // Keywords/synonyms are recorded as hints but their absence no longer
    // drops the category. Rationale: SAM.gov titles use terminology variants
    // (e.g. "Inductively Coupled Etching System" vs "Inductively Coupled
    // Plasma") that an expert-curated keyword list silently misses; NAICS is
    // the more reliable hard signal.

    it('matches by NAICS alone even when title has no keyword hit (Argonne ICP case)', () => {
        const cfg = baseConfig({
            productCategory: 'ICP',
            SK: 'CATEGORY#ICP',
            GSI1SK: 'ICP',
            keywords: ['inductively coupled plasma'],
            naicsCodes: ['333242'],
        });
        const r = matchesAnyConfig(
            {
                title: 'Inductively Coupled Etching System',
                description: 'Argonne National Lab cleanroom equipment',
                naicsCodes: ['333242'],
                cpvCodes: [],
            },
            [cfg],
        );
        expect(r.matchedCategories).toEqual(['ICP']);
        // No keyword hit — hints set is empty.
        expect(r.matchedKeywords).toEqual([]);
    });

    it('matches by CPV alone even when title has no keyword hit', () => {
        const cfg = baseConfig({ cpvCodes: ['38540000'] });
        const r = matchesAnyConfig(
            { title: 'thin film coating station', description: '', naicsCodes: [], cpvCodes: ['38540000'] },
            [cfg],
        );
        expect(r.matchedCategories).toEqual(['ALD']);
        expect(r.matchedKeywords).toEqual([]);
    });

    it('records keyword/synonym hits as hints when NAICS is the gate', () => {
        const cfg = baseConfig({
            keywords: ['atomic layer deposition'],
            synonyms: ['ALD'],
            naicsCodes: ['334516'],
        });
        const r = matchesAnyConfig(
            {
                title: 'ALD reactor with atomic layer deposition capability',
                description: '',
                naicsCodes: ['334516'],
                cpvCodes: [],
            },
            [cfg],
        );
        expect(r.matchedCategories).toEqual(['ALD']);
        // Both the keyword and the synonym should appear as hints.
        expect(r.matchedKeywords.sort()).toEqual(['ALD', 'atomic layer deposition']);
    });

    it('still respects blacklist when matching by NAICS alone', () => {
        const cfg = baseConfig({
            blacklist: ['training course'],
            naicsCodes: ['334516'],
        });
        const r = matchesAnyConfig(
            {
                title: 'Inductively coupled etching training course',
                description: '',
                naicsCodes: ['334516'],
                cpvCodes: [],
            },
            [cfg],
        );
        expect(r.matchedCategories).toEqual([]);
    });

    it('falls back to keyword gate when config has no NAICS/CPV restrictions', () => {
        // No code restrictions on either tender or config → keyword gate applies
        // to avoid matching every tender against every unrestricted category.
        const r = matchesAnyConfig(
            { title: 'office supplies procurement', description: '', naicsCodes: [], cpvCodes: [] },
            [baseConfig()],
        );
        expect(r.matchedCategories).toEqual([]);
    });
});
