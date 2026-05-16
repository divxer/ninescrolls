/**
 * Lead-score contribution from each submission type.
 *
 * Used by both the live `organization-api.upsertFromSubmission` Lambda
 * (called from submit-rfq, submit-lead, convert-rfq-to-order) and the
 * one-time backfill script. Keeping the logic in one place ensures
 * historical scores match what the live path would have produced.
 */

// Per spec docs/superpowers/specs/2026-05-15-organization-db-design.md (scoring rubric)
const RFQ_BASE = 8;
const RFQ_FUNDED_BONUS = 5;
const RFQ_IMMEDIATE_BONUS = 3;

const LEAD_BASE = 2;
const LEAD_DEMO_BONUS = 5;
const LEAD_TECH_QUESTION_BONUS = 1;
const LEAD_OPT_IN_BONUS = 1;

const ORDER_LARGE_THRESHOLD_USD = 100_000;
const ORDER_MID_THRESHOLD_USD = 30_000;
const ORDER_LARGE_POINTS = 25;
const ORDER_MID_POINTS = 15;
const ORDER_SMALL_POINTS = 5;

export function computeRfqScore(data: {
    fundingStatus?: string;
    timeline?: string;
}): number {
    let points = RFQ_BASE;
    if (data.fundingStatus === 'funded') points += RFQ_FUNDED_BONUS;
    if (data.timeline === 'immediate') points += RFQ_IMMEDIATE_BONUS;
    return points;
}

export function computeLeadScore(data: {
    type: string;
    marketingOptIn?: boolean;
}): number {
    let points = LEAD_BASE;
    if (data.type === 'demo-request') points += LEAD_DEMO_BONUS;
    if (data.type === 'tech-question') points += LEAD_TECH_QUESTION_BONUS;
    if (data.marketingOptIn) points += LEAD_OPT_IN_BONUS;
    return points;
}

export function computeOrderScore(orderAmount?: number): number {
    if (!orderAmount || !Number.isFinite(orderAmount) || orderAmount <= 0) return 0;
    if (orderAmount >= ORDER_LARGE_THRESHOLD_USD) return ORDER_LARGE_POINTS;
    if (orderAmount >= ORDER_MID_THRESHOLD_USD) return ORDER_MID_POINTS;
    return ORDER_SMALL_POINTS;
}
