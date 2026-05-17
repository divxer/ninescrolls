import type { TenderKeywordConfigItem } from './types';

/**
 * Shape the matcher needs from a tender. Kept minimal so callers can pass
 * either a stored DDB item or a synthetic preview payload.
 */
export interface MatchableTender {
    title: string;
    description: string;
    naicsCodes: string[];
    cpvCodes: string[];
}

/**
 * Coarse string + code filter — first pass before LLM scoring.
 *
 * Logic:
 * 1. Skip inactive configs.
 * 2. Reject category if any blacklist term appears in title+description.
 * 3. Match category if any keyword OR synonym is a case-insensitive substring.
 * 4. If config has either NAICS or CPV restrictions, require the tender to
 *    overlap at least one. Empty code arrays on the config = no restriction.
 *
 * Used by both Phase 1's prefilter-by-keyword Lambda (during the daily pipeline)
 * and Phase 2's tender-api `runPrefilterPreview` mutation (admin "Test match").
 */
export function matchesAnyConfig(
    t: MatchableTender,
    configs: TenderKeywordConfigItem[],
): { matchedCategories: string[]; matchedKeywords: string[] } {
    const haystack = `${t.title}\n${t.description}`.toLowerCase();
    const matchedCategories: string[] = [];
    const matchedKeywords = new Set<string>();

    for (const c of configs) {
        if (!c.isActive) continue;
        if (c.blacklist.some((b) => haystack.includes(b.toLowerCase()))) continue;
        const terms = [...c.keywords, ...c.synonyms];
        const hits = terms.filter((term) => haystack.includes(term.toLowerCase()));
        if (hits.length === 0) continue;
        const hasNaics = c.naicsCodes.length > 0;
        const hasCpv = c.cpvCodes.length > 0;
        if (hasNaics || hasCpv) {
            const naicsHit = t.naicsCodes.some((n) => c.naicsCodes.includes(n));
            const cpvHit = t.cpvCodes.some((c2) => c.cpvCodes.includes(c2));
            if (!naicsHit && !cpvHit) continue;
        }
        matchedCategories.push(c.productCategory);
        hits.forEach((h) => matchedKeywords.add(h));
    }
    return { matchedCategories, matchedKeywords: [...matchedKeywords] };
}
