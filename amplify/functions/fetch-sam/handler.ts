import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import axios from 'axios';
import type { NormalizedTender, FetchOutput } from '../../lib/tender-watch/types';
import { NormalizedTenderSchema } from '../../lib/tender-watch/types';
import { stagedKey } from '../../lib/tender-watch/s3-staging';

const s3 = new S3Client({});

const STAGING_BUCKET = () => process.env.STAGING_BUCKET!;
const SAM_API_KEY = () => process.env.SAM_API_KEY!;

const SAM_URL = 'https://api.sam.gov/opportunities/v2/search';

/**
 * NAICS codes monitored by NineScrolls.
 *
 * IMPORTANT: SAM API's `ncode` parameter is single-value only. Comma-separated
 * values like `334516,334519,333242,541380` are treated as a literal single
 * NAICS code and match ZERO results (verified empirically May 2026 — this was
 * the original launch bug causing every fetchSam run to return count=0).
 *
 * The fetcher iterates this array, issuing one SAM API call per NAICS code,
 * deduping noticeIds across iterations.
 */
const NAICS_WHITELIST = ['334516', '334519', '333242', '541380'];
const PAGE_SIZE = 1000;
const LOOKBACK_DAYS = Number(process.env.LOOKBACK_DAYS ?? 7);
const SAM_TIMEOUT_MS = 30_000;
const MAX_RETRIES_PER_PAGE = 3;
const RETRY_BASE_DELAY_MS = 1_000;

export interface FetchSamEvent {
    executionId: string;
}

interface SamOpportunity {
    noticeId: string;
    title: string;
    fullParentPathName?: string;
    organizationName?: string;
    postedDate: string;
    responseDeadLine?: string | null;
    type?: string;
    active?: string;
    naicsCode?: string;
    uiLink: string;
    description?: string;
    placeOfPerformance?: { country?: { code?: string } };
}

interface SamResponse {
    totalRecords?: number;
    opportunitiesData?: SamOpportunity[];
}

function isoCountryFromUsa(code: string | undefined): string {
    if (!code) return 'US';
    if (code === 'USA' || code === 'US') return 'US';
    const map: Record<string, string> = {
        CAN: 'CA', MEX: 'MX', GBR: 'GB', FRA: 'FR', DEU: 'DE',
        AUS: 'AU', JPN: 'JP', KOR: 'KR', SGP: 'SG',
    };
    const mapped = map[code] ?? code.slice(0, 2);
    return /^[A-Z]{2}$/.test(mapped) ? mapped : 'US';
}

function toIsoDate(input: string | null | undefined): string | null {
    if (!input) return null;
    const match = input.match(/^\d{4}-\d{2}-\d{2}/);
    return match ? match[0] : null;
}

function formatMdy(date: Date): string {
    const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(date.getUTCDate()).padStart(2, '0');
    const yyyy = String(date.getUTCFullYear());
    return `${mm}/${dd}/${yyyy}`;
}

function normalize(op: SamOpportunity): NormalizedTender {
    return {
        source: 'sam',
        externalId: op.noticeId,
        url: op.uiLink,
        title: op.title,
        agency: op.organizationName ?? op.fullParentPathName ?? 'Unknown',
        country: isoCountryFromUsa(op.placeOfPerformance?.country?.code),
        language: 'en',
        description: op.description ?? '',
        estimatedValue: null,
        postedDate: toIsoDate(op.postedDate) ?? new Date().toISOString().slice(0, 10),
        deadline: toIsoDate(op.responseDeadLine),
        naicsCodes: op.naicsCode ? [op.naicsCode] : [],
        cpvCodes: [],
        rawPayload: op,
    };
}

async function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch a single SAM API page with retry on transient 5xx / network errors.
 * Returns the parsed page on success or rethrows the last error after exhausting retries.
 */
async function fetchPageWithRetry(params: Record<string, unknown>, ncode: string, offset: number): Promise<SamResponse> {
    let lastErr: unknown;
    for (let attempt = 1; attempt <= MAX_RETRIES_PER_PAGE; attempt++) {
        try {
            const { data } = await axios.get<SamResponse>(SAM_URL, { params, timeout: SAM_TIMEOUT_MS });
            return data;
        } catch (err) {
            lastErr = err;
            const status = (err as { response?: { status?: number } })?.response?.status;
            const retryable = status === undefined || status >= 500;
            if (!retryable || attempt === MAX_RETRIES_PER_PAGE) {
                console.warn(JSON.stringify({
                    event: 'fetch-sam.page-failed',
                    ncode,
                    offset,
                    attempt,
                    status,
                    error: err instanceof Error ? err.message : String(err),
                }));
                throw err;
            }
            const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
            console.warn(JSON.stringify({
                event: 'fetch-sam.page-retry',
                ncode,
                offset,
                attempt,
                status,
                delayMs: delay,
                error: err instanceof Error ? err.message : String(err),
            }));
            await sleep(delay);
        }
    }
    // Unreachable, but TS needs an explicit throw.
    throw lastErr;
}

export async function handler(event: FetchSamEvent): Promise<FetchOutput> {
    try {
        const apiKey = SAM_API_KEY();
        const today = new Date();
        const lookback = new Date(today.getTime() - LOOKBACK_DAYS * 24 * 3600 * 1000);
        const postedFrom = formatMdy(lookback);
        const postedTo = formatMdy(today);

        const out: NormalizedTender[] = [];
        const seenNoticeIds = new Set<string>();
        const perNcodeCounts: Record<string, number> = {};

        // SAM API's `ncode` parameter is single-value. Loop per NAICS code.
        for (const ncode of NAICS_WHITELIST) {
            let offset = 0;
            for (;;) {
                const data = await fetchPageWithRetry(
                    { api_key: apiKey, postedFrom, postedTo, ncode, limit: PAGE_SIZE, offset },
                    ncode,
                    offset,
                );
                const opps = data.opportunitiesData ?? [];
                for (const op of opps) {
                    if (op.active !== 'Yes' && op.active !== undefined) continue;
                    // Only Solicitation / Combined Synopsis/Solicitation — drop awards, justifications, etc.
                    if (op.type && !['Solicitation', 'Combined Synopsis/Solicitation'].includes(op.type)) continue;
                    // Dedupe across NAICS iterations (a single opportunity can be tagged with multiple NAICS,
                    // and the SAM API returns it once per matching ncode call).
                    if (seenNoticeIds.has(op.noticeId)) continue;
                    seenNoticeIds.add(op.noticeId);

                    const candidate = normalize(op);
                    const parsed = NormalizedTenderSchema.safeParse(candidate);
                    if (parsed.success) {
                        out.push(parsed.data);
                        perNcodeCounts[ncode] = (perNcodeCounts[ncode] ?? 0) + 1;
                    } else {
                        console.warn(JSON.stringify({
                            event: 'fetch-sam.normalize-invalid',
                            noticeId: op.noticeId,
                            issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
                        }));
                    }
                }
                offset += PAGE_SIZE;
                if (opps.length === 0) break;
                if (data.totalRecords != null && offset >= data.totalRecords) break;
            }
        }

        const key = stagedKey(event.executionId, 'fetch-sam', 'output');
        await s3.send(new PutObjectCommand({
            Bucket: STAGING_BUCKET(),
            Key: key,
            Body: JSON.stringify(out),
            ContentType: 'application/json',
        }));

        console.log(JSON.stringify({
            event: 'fetch-sam.success',
            count: out.length,
            perNcode: perNcodeCounts,
            postedFrom,
            postedTo,
            lookbackDays: LOOKBACK_DAYS,
            executionId: event.executionId,
        }));
        return { source: 'sam', stagedKey: key, fetched: out.length };
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(JSON.stringify({ event: 'fetch-sam.failure', error: message, executionId: event.executionId }));
        return { source: 'sam', stagedKey: '', fetched: 0, error: message };
    }
}
