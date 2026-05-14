/**
 * Single-table key builders for Tender Watch entities.
 * See docs/superpowers/specs/2026-05-14-tender-watch-design.md § Data model.
 */

export function scoreSortToken(score: number): string {
    const clamped = Math.min(100, Math.max(0, Math.round(score)));
    // Inverse so lexicographic ASC = score DESC.
    return String(100 - clamped).padStart(3, '0');
}

export function tenderItemKey(tenderId: string) {
    return { PK: `TENDER#${tenderId}`, SK: 'METADATA' as const };
}

export function tenderMatchItemKey(tenderId: string, productSlug: string) {
    return { PK: `TENDER#${tenderId}`, SK: `MATCH#${productSlug}` };
}

export function tenderStatusLogItemKey(tenderId: string, isoTimestamp: string, ulid: string) {
    return { PK: `TENDER#${tenderId}`, SK: `LOG#${isoTimestamp}#${ulid}` };
}

export function tenderKeywordConfigItemKey(productCategory: string) {
    return { PK: 'TENDER_KEYWORD_CONFIG' as const, SK: `CATEGORY#${productCategory}` };
}

export function tenderStatusGsiKey(status: string, overallScore: number, postedDate: string, tenderId: string) {
    return {
        GSI1PK: `TENDER_STATUS#${status}`,
        GSI1SK: `${scoreSortToken(overallScore)}#${postedDate}#${tenderId}`,
    };
}

export function tenderHashGsiKey(sourceTenderHash: string) {
    return { GSI2PK: `TENDER_HASH#${sourceTenderHash}`, GSI2SK: 'TENDER' as const };
}

export function tenderHighPriorityGsiKey(postedDate: string, tenderId: string) {
    return { GSI3PK: 'TENDER_HIGH_PRIORITY' as const, GSI3SK: `${postedDate}#${tenderId}` };
}

export function tenderKeywordConfigActiveGsiKey(productCategory: string) {
    return {
        GSI1PK: 'TENDER_KEYWORD_CONFIG_ACTIVE' as const,
        GSI1SK: `CATEGORY#${productCategory}`,
    };
}

export const TENDER_STATUSES = [
    'new',
    'reviewing',
    'pursuing',
    'submitted',
    'won',
    'lost',
    'not_relevant',
] as const;
export type TenderStatus = (typeof TENDER_STATUSES)[number];

export const ACTIVE_TENDER_STATUSES: ReadonlyArray<TenderStatus> = [
    'new',
    'reviewing',
    'pursuing',
    'submitted',
];
