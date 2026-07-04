import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import axios from 'axios';
import type { NormalizedTender, FetchOutput } from '../../lib/tender-watch/types';
import { NormalizedTenderSchema } from '../../lib/tender-watch/types';
import { stagedKey } from '../../lib/tender-watch/s3-staging';

const s3 = new S3Client({});
const STAGING_BUCKET = () => process.env.STAGING_BUCKET!;

/**
 * Texas Electronic State Business Daily (ESBD) — txsmartbuy.gov.
 *
 * Discovered 2026-05-30. ESBD is the centralized public bid board for ALL
 * Texas public agencies (~225 entities) including the entire UT System
 * (Austin/Dallas/Arlington/El Paso/SA/Tyler), Texas A&M System (11 campuses,
 * including TAMU Qatar), Texas Tech, UNT, Texas State, and every public school
 * district, city, county, and workforce board. Mandated by Texas Government
 * Code Chapter 2155: all state agencies must post solicitations ≥$25k.
 *
 * Validation 2026-05-30: keyword="microscope" returned 44 historical
 * solicitations (5+ years), top buyers:
 *   - Texas A&M (711)        — 8 microscope/SEM/AFM/Raman RFPs
 *   - UT Dallas (738)        — 3 (incl. Dimension Icon AFM, low-temp STM)
 *   - UT Arlington (714)     — 2 SEM
 *   - UT Southwestern (729)  — 1 electron microscope lab
 *   - UTSA (743), UNT (769), TAMU Kingsville (732), Austin CC (J2270) — 1 each
 *
 * UT Austin (721) does NOT appear in microscope results — UT Austin routes
 * scientific equipment through sole-source rather than ESBD. TAMU + UT Dallas
 * are the primary NineScrolls targets via this source.
 *
 * # Backend API (reverse-engineered)
 *
 * The public web UI at https://www.txsmartbuy.gov/esbd uses a NetSuite SCA
 * (Site Builder Commerce Application) backend. The list is loaded via:
 *
 *   POST https://www.txsmartbuy.gov/app/extensions/CPA/CPAMain/1.0.0/services/ESBD.Service.ss?c=852252&n=2
 *
 * Request body (JSON):
 *   {
 *     "keyword": "microscope",
 *     "agency": "", "agencyNumber": "",
 *     "status": "", "nigp": "", "solicitationId": "",
 *     "dateRange": "custom", "startDate": "", "endDate": "",
 *     "recordsPerPage": 24, "page": 1
 *   }
 *
 * Response shape:
 *   {
 *     "lines":   [{ internalid, title, solicitationId, responseDue, responseTime,
 *                   agencyNumber, agencyName, status, statusName, postingDate,
 *                   cancelledDate, created, lastModified, nigpCodes, repostURL, url }],
 *     "page":    1,
 *     "recordsPerPage": 24,
 *     "totalRecordsFound": 44,
 *     "agencies": [ ... 225 entries, useful for UI but ignored here ... ]
 *   }
 *
 * # Auth model
 *
 * The endpoint requires a NetSuite session cookie. The page is publicly readable
 * but the POST endpoint returns HTTP 200 with empty body if cookies are missing.
 * We do a 2-step request: GET /esbd to harvest cookies, then POST with them.
 * Akamai may also set bm_sv (bot manager); a polite User-Agent and Referer
 * are sufficient — no JS challenge is required for the JSON endpoint.
 *
 * # Query strategy
 *
 * The ESBD database has 56k+ solicitations. To keep volume manageable and surface
 * NineScrolls-relevant equipment, we query a curated keyword list and dedup by
 * solicitationId. Each keyword returns page 1 (24 newest sorted by postingDate
 * descending by default). 10 keywords × 24 max = 240 raw, ~50-100 unique after
 * dedup. Subsequent prefilter + LLM match filters out the rest.
 *
 * Phase 3b enrichment: paginate beyond page 1 for relevant keywords; use NIGP
 * codes 175xx (Lab Equipment) + 178xx (Optical/Photographic) as additional
 * filters; fetch full solicitation PDFs for description body.
 */
const ESBD_BASE = 'https://www.txsmartbuy.gov';
const ESBD_PAGE_URL = `${ESBD_BASE}/esbd`;
const ESBD_API_URL = `${ESBD_BASE}/app/extensions/CPA/CPAMain/1.0.0/services/ESBD.Service.ss?c=852252&n=2`;
const HTTP_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1_000;
const USER_AGENT = 'Mozilla/5.0 (compatible; NineScrollsTenderWatch/1.0; +https://ninescrolls.com)';

/**
 * Keyword list curated for NineScrolls product fit. Hits across these terms
 * are deduped by solicitationId before normalization. Order matters only for
 * deterministic dedup (first-keyword-seen wins on tie).
 */
export const ESBD_KEYWORDS = [
    'microscope',
    'wafer',
    'sputter',
    'evaporator',  // hits HVAC false-positives but also catches thermal evaporators
    'deposition',  // PVD, CVD, ALD adjacents
    'plasma',
    'etcher',
    'lithography',
    'profilometer',
    'ellipsometer',
] as const;

const PAGE_SIZE = 24;
const MAX_KEYWORDS_PER_RUN = ESBD_KEYWORDS.length;

export interface FetchTxesbdEvent {
    executionId: string;
}

export interface EsbdLine {
    internalid: string;
    title: string;
    solicitationId: string;
    responseDue: string;       // M/D/YYYY
    responseTime: string;
    agencyNumber: string;
    agencyName: string;
    status: string;            // numeric code
    statusName: string;        // "Posted" | "Addendum Posted" | "Closed" | "Awarded" | "Posting Cancelled" | "No Award"
    postingDate: string;       // M/D/YYYY
    cancelledDate: string;
    created: string;
    lastModified: string;
    nigpCodes: string;
    repostURL: string;
    url: string;
}

export interface EsbdResponse {
    lines: EsbdLine[];
    page: number;
    recordsPerPage: number;
    totalRecordsFound: number;
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * Parse M/D/YYYY (US-style) into ISO YYYY-MM-DD.
 * Returns null on malformed input.
 */
export function parseMDYY(mdyy: string): string | null {
    if (!mdyy) return null;
    const m = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/.exec(mdyy);
    if (!m) return null;
    const month = m[1].padStart(2, '0');
    const day = m[2].padStart(2, '0');
    return `${m[3]}-${month}-${day}`;
}

/**
 * Build a public-facing URL for an ESBD solicitation. ESBD does not expose
 * a stable per-bid permalink; we use the listing page with the solicitation
 * number visible in the rendered DOM. Suppliers can find it via Ctrl+F.
 */
function esbdDeepLink(solicitationId: string): string {
    const enc = encodeURIComponent(solicitationId);
    return `${ESBD_PAGE_URL}?solicitationId=${enc}&search=1`;
}

function parseSetCookieHeader(setCookies: string[] | string | undefined): string {
    if (!setCookies) return '';
    const arr = Array.isArray(setCookies) ? setCookies : [setCookies];
    const pairs = arr
        .map(line => line.split(';')[0].trim())
        .filter(Boolean);
    return pairs.join('; ');
}

/**
 * Fetch the public ESBD page to harvest session cookies. Returns the
 * Cookie header value to send on subsequent POSTs.
 * Exported for testing.
 */
export async function harvestCookies(): Promise<string> {
    const res = await axios.get(ESBD_PAGE_URL, {
        timeout: HTTP_TIMEOUT_MS,
        headers: {
            'User-Agent': USER_AGENT,
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
        },
        // Don't follow redirects automatically — we need cookies from each hop.
        maxRedirects: 0,
        validateStatus: (s) => s >= 200 && s < 400,
    });
    return parseSetCookieHeader(res.headers['set-cookie']);
}

/**
 * Query ESBD for one keyword. Returns the parsed lines from page 1.
 * Exported for testing.
 */
export async function searchEsbd(keyword: string, cookie: string): Promise<EsbdLine[]> {
    let lastErr: unknown;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const body = {
                keyword,
                agency: '',
                agencyNumber: '',
                status: '',
                nigp: '',
                solicitationId: '',
                dateRange: 'custom',
                startDate: '',
                endDate: '',
                recordsPerPage: PAGE_SIZE,
                page: 1,
            };
            const res = await axios.post<EsbdResponse>(ESBD_API_URL, body, {
                timeout: HTTP_TIMEOUT_MS,
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json, text/javascript, */*; q=0.01',
                    'User-Agent': USER_AGENT,
                    Origin: ESBD_BASE,
                    Referer: ESBD_PAGE_URL,
                    'X-Requested-With': 'XMLHttpRequest',
                    Cookie: cookie,
                },
            });
            return res.data?.lines ?? [];
        } catch (err) {
            lastErr = err;
            console.warn(JSON.stringify({
                event: 'fetch-txesbd.retry',
                keyword,
                attempt,
                error: err instanceof Error ? err.message : String(err),
            }));
            if (attempt < MAX_RETRIES) await sleep(RETRY_BASE_DELAY_MS * attempt);
        }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

/**
 * Convert an ESBD line to NormalizedTender. Returns null if Zod validation fails.
 * Exported for testing.
 */
export function toNormalizedTender(line: EsbdLine): NormalizedTender | null {
    const postedDate = parseMDYY(line.postingDate);
    const deadline = parseMDYY(line.responseDue);
    if (!postedDate) return null;     // schema requires YYYY-MM-DD postedDate
    // Title sometimes equals the solicitation ID (when buyer left it blank).
    // Fall back to a synthetic title so Zod's title.min(1) passes meaningfully.
    const title = (line.title || '').trim() || line.solicitationId;
    const candidate = {
        source: 'txesbd' as const,
        externalId: line.solicitationId,
        url: esbdDeepLink(line.solicitationId),
        title,
        agency: line.agencyName || `Texas Agency #${line.agencyNumber}`,
        country: 'US',
        language: 'en',
        // Concatenate title + NIGP code descriptions so LLM scoring has more context.
        // ESBD does not expose the full RFP body via the JSON API; nigpCodes are
        // the only structured signal beyond the title.
        description: [title, line.nigpCodes].filter(Boolean).join(' — '),
        postedDate,
        deadline,
        naicsCodes: [],   // Texas uses NIGP, not NAICS
        cpvCodes: [],     // EU CPV doesn't apply
        rawPayload: line,
    };
    const parsed = NormalizedTenderSchema.safeParse(candidate);
    return parsed.success ? parsed.data : null;
}

export async function handler(event: FetchTxesbdEvent): Promise<FetchOutput> {
    try {
        const cookie = await harvestCookies();
        const seen = new Set<string>();
        const allLines: EsbdLine[] = [];

        // Parallel per-keyword. Initial sequential version timed out at 300s
        // when one or two keywords hit retry-exhaustion (3× 30s = 90s per
        // failed keyword, ×10 keywords = up to 15 min worst case). Parallel
        // with Promise.allSettled caps total time at max-single-query (~30s)
        // plus GET cookies + S3 staging, and one slow keyword no longer
        // blocks the rest. NetSuite SCA tolerates concurrent POSTs with the
        // same JSESSIONID — verified manually 2026-05-31.
        const keywordsToRun = ESBD_KEYWORDS.slice(0, MAX_KEYWORDS_PER_RUN);
        const settled = await Promise.allSettled(
            keywordsToRun.map(async (kw) => {
                const lines = await searchEsbd(kw, cookie);
                return { kw, lines };
            }),
        );
        let fulfilledCount = 0;
        let rejectedCount = 0;
        let lastRejectReason: unknown = null;
        for (const r of settled) {
            if (r.status === 'fulfilled') {
                fulfilledCount++;
                const { kw, lines } = r.value;
                let added = 0;
                for (const ln of lines) {
                    if (!ln.solicitationId || seen.has(ln.solicitationId)) continue;
                    seen.add(ln.solicitationId);
                    allLines.push(ln);
                    added++;
                }
                console.info(JSON.stringify({
                    event: 'fetch-txesbd.keyword-done',
                    keyword: kw,
                    returned: lines.length,
                    added,
                    uniqueSoFar: seen.size,
                }));
            } else {
                // Per-keyword failure does not fail the run — log and continue.
                rejectedCount++;
                lastRejectReason = r.reason;
                console.warn(JSON.stringify({
                    event: 'fetch-txesbd.keyword-failed',
                    error: r.reason instanceof Error ? r.reason.message : String(r.reason),
                }));
            }
        }

        // A total upstream outage — every keyword search rejected — would
        // otherwise stage `[]` and return `{ fetched: 0 }` with no error,
        // masking a real incident from record-pipeline-run /
        // notify-pipeline-health. Rethrow so the Step Function catch flags
        // this source as FAILED.
        if (fulfilledCount === 0 && rejectedCount === keywordsToRun.length) {
            throw lastRejectReason instanceof Error
                ? lastRejectReason
                : new Error(`fetch-txesbd: all ${rejectedCount} keyword searches failed`);
        }

        const out: NormalizedTender[] = [];
        for (const ln of allLines) {
            const t = toNormalizedTender(ln);
            if (t) out.push(t);
        }

        const key = stagedKey(event.executionId, 'fetch-txesbd', 'output');
        await s3.send(new PutObjectCommand({
            Bucket: STAGING_BUCKET(),
            Key: key,
            Body: JSON.stringify(out),
            ContentType: 'application/json',
        }));

        console.info(JSON.stringify({
            event: 'fetch-txesbd.complete',
            executionId: event.executionId,
            keywords: ESBD_KEYWORDS.length,
            rawRows: allLines.length,
            tendersEmitted: out.length,
        }));

        return { source: 'txesbd', stagedKey: key, fetched: out.length };
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(JSON.stringify({
            event: 'fetch-txesbd.failed',
            executionId: event.executionId,
            error: message,
        }));
        return { source: 'txesbd', stagedKey: '', fetched: 0, error: message };
    }
}
