import { z } from 'zod';
import { TENDER_STATUSES, type TenderStatus } from './keys';

/** Re-exported here as a Zod enum for runtime validation in Phase 2 resolvers. */
export const TenderStatusSchema = z.enum(TENDER_STATUSES);
export type { TenderStatus };

/** Common shape every fetch-* Lambda emits and normalize-dedupe consumes. */
export const NormalizedTenderSchema = z.object({
    source: z.enum(['sam', 'ted', 'calusource', 'uk', 'canada', 'australia', 'singapore', 'korea']),
    externalId: z.string().min(1),
    url: z.string().url(),
    title: z.string().min(1),
    agency: z.string().min(1),
    country: z.string().length(2),                 // ISO 3166-1 alpha-2
    language: z.string().length(2),                // ISO 639-1
    description: z.string(),
    estimatedValue: z
        .object({ amount: z.number(), currency: z.string() })
        .nullable()
        .optional(),
    postedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    naicsCodes: z.array(z.string()),
    cpvCodes: z.array(z.string()),
    rawPayload: z.unknown(),
});
export type NormalizedTender = z.infer<typeof NormalizedTenderSchema>;

/** What each fetch-* Lambda returns to Step Functions. */
export const FetchOutputSchema = z.object({
    source: z.string(),
    stagedKey: z.string(),                         // S3 key with the normalized tender array
    fetched: z.number().int().nonnegative(),
    error: z.string().optional(),
});
export type FetchOutput = z.infer<typeof FetchOutputSchema>;

/** Persisted Tender METADATA item shape (what's written to DynamoDB). */
export interface TenderItem {
    PK: string;                                    // TENDER#<id>
    SK: 'METADATA';
    GSI1PK: string;                                // TENDER_STATUS#<status>
    GSI1SK: string;                                // <scoreToken>#<postedDate>#<id>
    GSI2PK: string;                                // TENDER_HASH#<hash>
    GSI2SK: 'TENDER';
    GSI3PK?: string;                               // TENDER_HIGH_PRIORITY (only when isHighPriority)
    GSI3SK?: string;                               // <postedDate>#<id>
    tenderId: string;
    entityType: 'TENDER';
    source: string;
    sourceUrl: string;
    sourceTenderHash: string;
    title: string;
    agency: string;
    country: string;
    language: string;
    description: string;
    estimatedValueUSD: number | null;
    estimatedValueOriginal: string | null;
    postedDate: string;
    deadline: string | null;
    naicsCodes: string[];
    cpvCodes: string[];
    rawPayload: unknown;
    overallScore: number;
    isHighPriority: boolean;
    isExpired: boolean;
    status: TenderStatus;
    statusNote: string | null;
    assignedTo: string | null;
    lastStatusChangedAt: string | null;
    createdAt: string;
    updatedAt: string;
}

/** Persisted MATCH item shape. */
export interface TenderMatchItem {
    PK: string;                                    // TENDER#<id>
    SK: string;                                    // MATCH#<productSlug>
    tenderId: string;
    productSlug: string;
    entityType: 'TENDER_MATCH';
    score: number;
    reasoning: string;
    matchedKeywords: string[];
    createdAt: string;
}

/** Persisted TENDER_KEYWORD_CONFIG item shape. */
export interface TenderKeywordConfigItem {
    PK: 'TENDER_KEYWORD_CONFIG';
    SK: string;                                    // CATEGORY#<productCategory>
    GSI1PK?: 'TENDER_KEYWORD_CONFIG_ACTIVE';
    GSI1SK?: string;
    productCategory: string;
    entityType: 'TENDER_KEYWORD_CONFIG';
    productSlugs: string[];
    keywords: string[];
    synonyms: string[];
    blacklist: string[];
    naicsCodes: string[];
    cpvCodes: string[];
    isActive: boolean;
    updatedBy: string;
    updatedAt: string;
}

/** USD conversion rate table (refresh quarterly; see expire-old-tenders for refresh cadence). */
export const USD_RATES: Record<string, number> = {
    USD: 1.0,
    EUR: 1.08,
    GBP: 1.27,
    CAD: 0.73,
    AUD: 0.66,
    JPY: 0.0065,
    KRW: 0.00073,
    SGD: 0.74,
};

export function toUsd(amount: number | undefined | null, currency: string | undefined | null): number | null {
    if (amount == null || !Number.isFinite(amount) || !currency) return null;
    const rate = USD_RATES[currency.toUpperCase()];
    if (rate == null) return null;
    return Math.round(amount * rate);
}
