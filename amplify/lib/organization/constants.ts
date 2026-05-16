/**
 * Shared constants for Customer Organization (Phase C).
 * See docs/superpowers/specs/2026-05-15-organization-db-design.md
 */

/** Max aliasDomains entries stored on a single Organization META item. */
export const ALIAS_DOMAINS_CAP = 100;

/** Lead score threshold above which an Org is indexed into GSI3 (high-priority list). */
export const LEAD_SCORE_THRESHOLD = 10;

/** Days within which `reclassifyOrganization` with force=false is a no-op. */
export const RECLASSIFY_COOLDOWN_DAYS = 30;

/** Bedrock InvokeModel client-side timeout (mirrors match-with-llm). */
export const BEDROCK_TIMEOUT_MS = 8000;

/** Anthropic API client timeout (mirrors match-with-llm). */
export const ANTHROPIC_TIMEOUT_MS = 20000;

/** Allowed Organization type values. */
export const ORG_TYPES = ['university', 'research-institute', 'company', 'government', 'other', 'unknown'] as const;
export type OrgType = typeof ORG_TYPES[number];

/** Allowed Organization status values. */
export const ORG_STATUSES = ['active', 'archived', 'blocked'] as const;
export type OrgStatus = typeof ORG_STATUSES[number];
