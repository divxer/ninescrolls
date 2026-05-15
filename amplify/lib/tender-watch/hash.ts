import crypto from 'node:crypto';

export interface TenderHashInput {
    title: string;
    agency: string;
    /**
     * Bid submission deadline. Callers MUST pass this as an ISO date string
     * `YYYY-MM-DD` (no time component) or null/undefined when the source omits
     * a deadline. The hash uses the raw value verbatim — non-normalized
     * formats will defeat cross-source dedupe.
     */
    deadline?: string | null;
}

/**
 * Stable cross-source identity hash for a tender. The hash is used to
 * recognise the same tender appearing in multiple procurement sources
 * (SAM.gov, TED, etc.) so the daily ingest pipeline can skip duplicates.
 *
 * Normalization:
 *   - title and agency are trimmed and lowercased
 *   - deadline is passed verbatim — callers must pre-normalize to YYYY-MM-DD
 *
 * The internal field separator is `\x00` (null byte) to prevent collisions
 * where a field value contains the separator character.
 */
export function sourceTenderHash(input: TenderHashInput): string {
    const normalized = [
        input.title.trim().toLowerCase(),
        input.agency.trim().toLowerCase(),
        input.deadline ?? '',
    ].join('\x00');
    return crypto.createHash('sha256').update(normalized).digest('hex');
}
