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
 * Coarse code-based pre-filter — first pass before LLM scoring.
 *
 * Soft-filter semantics (revised 2026-05-22):
 * 1. Skip inactive configs.
 * 2. Reject category if any blacklist term appears in title+description.
 * 3. **NAICS/CPV is the hard gate** — if the config has either NAICS or CPV
 *    restrictions, require the tender to overlap at least one.
 * 4. Keywords/synonyms are NO LONGER required for a category to match. They
 *    are still recorded in `matchedKeywords` as hints for downstream
 *    consumers (admin UI, LLM prompt context), but their absence does not
 *    gate the category.
 * 5. Edge case: when a config has neither NAICS nor CPV restrictions, fall
 *    back to keyword/synonym substring match (otherwise every tender would
 *    match every unrestricted category, which is too noisy).
 *
 * Rationale (RCA 2026-05-21): SAM.gov RFP titles often use terminology
 * variants like "Inductively Coupled Etching System" instead of "Inductively
 * Coupled Plasma" — substring matching against an expert-curated keyword
 * list silently drops these. NAICS codes are a more reliable hard signal
 * (curated by procurement officials, mandatory per RFP). Bedrock's semantic
 * understanding then handles the keyword-variant problem at scoring time
 * (match-with-llm Lambda) where it can reason about whether "Inductively
 * Coupled Etching" is the same product class as "Inductively Coupled Plasma".
 *
 * Cost impact: ~5x more tenders reach match-with-llm. At ~50 SAM+TED
 * tenders/day and Bedrock Haiku 4.5 pricing, additional spend is <$10/month.
 *
 * Used by both Phase 1's prefilter-by-keyword Lambda (during the daily
 * pipeline) and Phase 2's tender-api `runPrefilterPreview` mutation (admin
 * "Test match").
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

        const hasNaics = c.naicsCodes.length > 0;
        const hasCpv = c.cpvCodes.length > 0;

        if (hasNaics || hasCpv) {
            // NAICS/CPV is the hard gate. Keywords/synonyms are hints only.
            const naicsHit = t.naicsCodes.some((n) => c.naicsCodes.includes(n));
            const cpvHit = t.cpvCodes.some((c2) => c.cpvCodes.includes(c2));
            if (!naicsHit && !cpvHit) continue;
        } else {
            // Fallback: if the config has no code restrictions, keyword
            // match becomes the only gate (otherwise every tender would
            // match every unrestricted category).
            const terms = [...c.keywords, ...c.synonyms];
            const anyHit = terms.some((term) => haystack.includes(term.toLowerCase()));
            if (!anyHit) continue;
        }

        // Record keyword/synonym hits as hints (no longer gating).
        const terms = [...c.keywords, ...c.synonyms];
        const hits = terms.filter((term) => haystack.includes(term.toLowerCase()));
        hits.forEach((h) => matchedKeywords.add(h));

        matchedCategories.push(c.productCategory);
    }
    return { matchedCategories, matchedKeywords: [...matchedKeywords] };
}
