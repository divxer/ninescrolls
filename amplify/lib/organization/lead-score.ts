/**
 * Lead-score contribution from each submission type.
 *
 * Used by both the live `organization-api.upsertFromSubmission` Lambda
 * (called from submit-rfq, submit-lead, convert-rfq-to-order) and the
 * one-time backfill script. Keeping the logic in one place ensures
 * historical scores match what the live path would have produced.
 */

export function computeRfqScore(data: {
    fundingStatus?: string;
    timeline?: string;
}): number {
    let points = 8; // Base: RFQ submission
    if (data.fundingStatus === 'funded') points += 5;
    if (data.timeline === 'immediate') points += 3;
    return points;
}

export function computeLeadScore(data: {
    type: string;
    marketingOptIn?: boolean;
}): number {
    let points = 2; // Base: Lead submission
    if (data.type === 'demo-request') points += 5;
    if (data.type === 'tech-question') points += 1;
    if (data.marketingOptIn) points += 1;
    return points;
}

export function computeOrderScore(orderAmount?: number): number {
    if (!orderAmount) return 0;
    if (orderAmount >= 100_000) return 25;
    if (orderAmount >= 30_000) return 15;
    return 5;
}
