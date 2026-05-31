import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import axios from 'axios';
import type { NormalizedTender, FetchOutput } from '../../lib/tender-watch/types';
import { NormalizedTenderSchema } from '../../lib/tender-watch/types';
import { stagedKey } from '../../lib/tender-watch/s3-staging';

const s3 = new S3Client({});
const STAGING_BUCKET = () => process.env.STAGING_BUCKET!;

/**
 * New York State Contract Reporter (NYSCR) — nyscr.ny.gov.
 *
 * Discovered 2026-05-30. NYSCR is New York's official state procurement
 * advertising portal mandated by NY Economic Development Law §142. All
 * state agencies, authorities, **state universities** (SUNY, CUNY), and
 * public benefit corporations advertise solicitations ≥$50k here.
 *
 * Coverage includes:
 *   - SUNY (30 state-operated campuses including SUNY Polytechnic Albany,
 *     home of the IBM/Samsung/TSMC 300mm semiconductor R&D fab)
 *   - SUNY Stony Brook (NSF NNCI member)
 *   - SUNY Buffalo, Binghamton, Albany, etc.
 *   - CUNY system (24 colleges)
 *   - NY state agencies (OGS, DOH, DOT, Dormitory Authority, etc.)
 *   - Many NY municipalities, museums, libraries, schools
 *
 * Validated 2026-05-30: Status=Open + Keyword=microscope returned 2
 * currently-open RFPs (SUNY Binghamton Fluorescence Microscope + Erie
 * County Medical Center Zeiss Service). Site shows 888 total open
 * opportunities across 36 pages.
 *
 * # Why this source is the easiest so far
 *
 * Unlike fetch-txesbd (NetSuite SCA POST API with 40KB body and session
 * cookies) or fetch-uofa (Drupal table), NYSCR is plain server-side
 * rendered HTML with clean URL query string filtering. No cookies, no JS
 * hydration, no API reverse-engineering required.
 *
 *   GET https://www.nyscr.ny.gov/Ads/Search?Status=Open&Keyword=microscope&Top=25&Sort=-DateIssued
 *
 * Public anonymous access. The full solicitation body and attachments are
 * gated behind a free account login ("Log in or sign up to view this
 * opportunity"), but the row metadata visible on the search page already
 * contains everything we need for LLM scoring: title, agency, division,
 * category, posted date, due date, location, ad type.
 *
 * # HTML structure (each card)
 *
 *   <div title="Full Title: <TITLE>">  ... TITLE text ... </div>
 *   <div class="...">CR#:</div><div class="...">2135447</div>
 *   <div class="...">Agency:</div><div class="...">State University of New York (SUNY)</div>
 *   <div class="...">Division:</div><div class="...">SUNY Binghamton</div>
 *   <div class="...">Issue date:</div><div class="...">5/22/2026</div>
 *   <div class="...">Due date:</div><div class="...">6/15/2026</div>
 *   <div class="...">Location:</div><div class="...">Binghamton University ...</div>
 *   <div class="...">Category:</div><div class="...">Medical &amp; Laboratory Equipment</div>
 *   <div class="...">Ad type:</div><div class="...">General</div>
 *
 * "Notice of sole/single source" Ad type entries are NineScrolls-uninteresting
 * (vendor already selected, no competition); we keep them for completeness
 * but downstream prefilter usually drops them.
 *
 * # Query strategy
 *
 * Same curated keyword list as fetch-txesbd. Per-keyword GET with Top=25
 * (default page size), Status=Open, sorted latest-first. Dedup by CR#
 * across keyword runs. Per-keyword failures are tolerated.
 *
 * Phase 3b enrichment: free-account login + paginated fetch beyond 25;
 * scrape attached PDF descriptions for fuller LLM context.
 */
const NYSCR_BASE = 'https://www.nyscr.ny.gov';
const NYSCR_SEARCH_PATH = '/Ads/Search';
const HTTP_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1_000;
const USER_AGENT = 'Mozilla/5.0 (compatible; NineScrollsTenderWatch/1.0; +https://ninescrolls.com)';
const PAGE_SIZE = 25;

export const NYSCR_KEYWORDS = [
    'microscope',
    'wafer',
    'sputter',
    'evaporator',
    'deposition',
    'plasma',
    'etcher',
    'lithography',
    'profilometer',
    'ellipsometer',
] as const;

export interface FetchNyscrEvent {
    executionId: string;
}

export interface NyscrRow {
    cr: string;            // CR#
    title: string;
    agency: string | null;
    division: string | null;
    issueDate: string | null;     // M/D/YYYY
    dueDate: string | null;       // M/D/YYYY
    location: string | null;
    category: string | null;
    adType: string | null;
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function decodeHtmlEntities(s: string): string {
    return s
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&nbsp;/g, ' ');
}

function normWhitespace(s: string): string {
    return decodeHtmlEntities(s).replace(/\s+/g, ' ').trim();
}

/**
 * Parse M/D/YYYY (US-style) into ISO YYYY-MM-DD. Returns null on malformed input.
 * Exported for testing.
 */
export function parseMDYY(mdyy: string | null | undefined): string | null {
    if (!mdyy) return null;
    const m = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/.exec(mdyy);
    if (!m) return null;
    return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
}

/**
 * Extract the value div that follows a given label div within a row card.
 * NYSCR renders each row as a long flat sequence of <div>LABEL:</div><div>VALUE</div>
 * pairs. We anchor on the bold-label div class plus literal label text.
 */
function extractField(rowHtml: string, label: string): string | null {
    // Label divs use class containing "fw-bold" and contain the literal label.
    // Value div directly follows, has class containing "px-2" (and not bg-light).
    const labelRe = new RegExp(
        '<div[^>]*fw-bold[^>]*>\\s*' + label.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&') + '\\s*</div>\\s*' +
        '<div[^>]*?class="[^"]*px-2[^"]*"[^>]*>([\\s\\S]*?)</div>',
    );
    const m = labelRe.exec(rowHtml);
    if (!m) return null;
    return normWhitespace(m[1]);
}

/**
 * Parse the NYSCR search page HTML into structured row objects.
 * Exported for testing.
 */
export function parseNyscrHtml(html: string): NyscrRow[] {
    const rows: NyscrRow[] = [];
    // Each row begins at a div with title="Full Title: ..." and ends before the next one.
    // Use lookahead so the regex matches one whole row at a time.
    const cardRe = /<div[^>]*title="Full Title:\s*([^"]+)"[^>]*>([\s\S]*?)(?=<div[^>]*title="Full Title:|$)/g;
    let m: RegExpExecArray | null;
    while ((m = cardRe.exec(html)) !== null) {
        const title = normWhitespace(m[1]);
        const cardHtml = m[2];
        const cr = extractField(cardHtml, 'CR#:');
        if (!cr || !title) continue;
        rows.push({
            cr,
            title,
            agency: extractField(cardHtml, 'Agency:'),
            division: extractField(cardHtml, 'Division:'),
            issueDate: extractField(cardHtml, 'Issue date:'),
            dueDate: extractField(cardHtml, 'Due date:'),
            location: extractField(cardHtml, 'Location:'),
            category: extractField(cardHtml, 'Category:'),
            adType: extractField(cardHtml, 'Ad type:'),
        });
    }
    return rows;
}

/**
 * Convert a parsed row to NormalizedTender. Returns null if validation fails.
 * Exported for testing.
 */
export function toNormalizedTender(row: NyscrRow): NormalizedTender | null {
    const postedDate = parseMDYY(row.issueDate);
    const deadline = parseMDYY(row.dueDate);
    if (!postedDate) return null;
    const agency = [row.agency, row.division].filter(Boolean).join(' / ') || `NY agency`;
    const candidate = {
        source: 'nyscr' as const,
        externalId: row.cr,
        // Per-ad detail URL: NYSCR uses /Ads/<CR#>/Details when authenticated; the public
        // search URL is the most reliable anchor without an account.
        url: `${NYSCR_BASE}${NYSCR_SEARCH_PATH}?Status=Open&Keyword=${encodeURIComponent(row.cr)}`,
        title: row.title,
        agency,
        country: 'US',
        language: 'en',
        // Title is the strongest signal; category and location enrich the LLM context.
        description: [
            row.title,
            row.category ? `Category: ${row.category}` : null,
            row.location ? `Location: ${row.location}` : null,
            row.adType ? `Ad type: ${row.adType}` : null,
        ].filter(Boolean).join(' — '),
        postedDate,
        deadline,
        naicsCodes: [],   // NYSCR uses NY-specific categorization, not NAICS
        cpvCodes: [],
        rawPayload: row,
    };
    const parsed = NormalizedTenderSchema.safeParse(candidate);
    return parsed.success ? parsed.data : null;
}

/**
 * GET the NYSCR search page for one keyword with retry.
 * Exported for testing.
 */
export async function searchNyscr(keyword: string): Promise<NyscrRow[]> {
    let lastErr: unknown;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const res = await axios.get<string>(`${NYSCR_BASE}${NYSCR_SEARCH_PATH}`, {
                timeout: HTTP_TIMEOUT_MS,
                params: {
                    Status: 'Open',
                    Keyword: keyword,
                    DateFilter: 'All',
                    Top: PAGE_SIZE,
                    Sort: '-DateIssued',
                    Skip: 0,
                },
                headers: {
                    'User-Agent': USER_AGENT,
                    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                },
                responseType: 'text',
                transformResponse: [(d) => d],
            });
            return parseNyscrHtml(res.data);
        } catch (err) {
            lastErr = err;
            console.warn(JSON.stringify({
                event: 'fetch-nyscr.retry',
                keyword,
                attempt,
                error: err instanceof Error ? err.message : String(err),
            }));
            if (attempt < MAX_RETRIES) await sleep(RETRY_BASE_DELAY_MS * attempt);
        }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export async function handler(event: FetchNyscrEvent): Promise<FetchOutput> {
    try {
        const seen = new Set<string>();
        const allRows: NyscrRow[] = [];

        for (const kw of NYSCR_KEYWORDS) {
            try {
                const rows = await searchNyscr(kw);
                for (const r of rows) {
                    if (!r.cr || seen.has(r.cr)) continue;
                    seen.add(r.cr);
                    allRows.push(r);
                }
                console.info(JSON.stringify({
                    event: 'fetch-nyscr.keyword-done',
                    keyword: kw,
                    returned: rows.length,
                    uniqueSoFar: seen.size,
                }));
            } catch (kwErr) {
                console.warn(JSON.stringify({
                    event: 'fetch-nyscr.keyword-failed',
                    keyword: kw,
                    error: kwErr instanceof Error ? kwErr.message : String(kwErr),
                }));
            }
        }

        const out: NormalizedTender[] = [];
        for (const r of allRows) {
            const t = toNormalizedTender(r);
            if (t) out.push(t);
        }

        const key = stagedKey(event.executionId, 'fetch-nyscr', 'output');
        await s3.send(new PutObjectCommand({
            Bucket: STAGING_BUCKET(),
            Key: key,
            Body: JSON.stringify(out),
            ContentType: 'application/json',
        }));

        console.info(JSON.stringify({
            event: 'fetch-nyscr.complete',
            executionId: event.executionId,
            keywords: NYSCR_KEYWORDS.length,
            rawRows: allRows.length,
            tendersEmitted: out.length,
        }));

        return { source: 'nyscr', stagedKey: key, fetched: out.length };
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(JSON.stringify({
            event: 'fetch-nyscr.failed',
            executionId: event.executionId,
            error: message,
        }));
        return { source: 'nyscr', stagedKey: '', fetched: 0, error: message };
    }
}
