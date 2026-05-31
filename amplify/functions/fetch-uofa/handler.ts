import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import axios from 'axios';
import type { NormalizedTender, FetchOutput } from '../../lib/tender-watch/types';
import { NormalizedTenderSchema } from '../../lib/tender-watch/types';
import { stagedKey } from '../../lib/tender-watch/s3-staging';

const s3 = new S3Client({});
const STAGING_BUCKET = () => process.env.STAGING_BUCKET!;

/**
 * University of Arizona public bid board scraper.
 *
 * Source: https://vendors.arizona.edu/rfpb-opportunities
 *
 * Discovered 2026-05-30 during ASU/UofA comparison: UofA's RFP/Bid Opportunities
 * page is Drupal-rendered static HTML with a stable views table. Unlike ASU
 * (services + construction only, ~0 NineScrolls fit), UofA bids out
 * scientific/semiconductor equipment via this board (PECVD, thermal evaporator,
 * wafer probe station, stylus profilometer, sputter targets, wet processing
 * benches, LPCVD upgrades).
 *
 * Historical sample (24 months, vendors.arizona.edu/rfpb-results pages 0-3):
 *   - 8 direct NineScrolls equipment RFPs (avg 4/year)
 *   - Most NineScrolls-relevant bids handled by buyer Celeste Kanzig
 *     <cdkanzig@arizona.edu>, 520-621-3067
 *
 * Coverage scope: this scraper only reads the OPEN opportunities page
 * (currently live RFPs accepting responses). The /rfpb-results page lists
 * closed/awarded bids — useful for BD intelligence but not for tender-watch
 * notifications (deadline already passed). Future enhancement: also scrape
 * results for award-trail tracking and competitor intelligence.
 *
 * Table structure (each <tr> has 5 <td> cells identified by headers= attribute):
 *   1. view-title-table-column         — <strong>BIDNUM</strong><p>TITLE</p>
 *   2. view-field-documents-table-column — <a href="PDFURL">DOCNAME</a> (1..N links)
 *   3. view-field-contact-name-table-column — <a href="mailto:EMAIL">NAME</a>
 *   4. view-field-questions-due-table-column — important dates (multi-line)
 *   5. view-field-due-date-table-column — <time datetime="ISO">CLOSEDATE</time>
 *
 * postedDate is NOT exposed on the listing page; we use today (scrape time).
 * description falls back to the title since the PDF body is not parsed in v1.
 */
const UOFA_URL = 'https://vendors.arizona.edu/rfpb-opportunities';
const UOFA_BASE = 'https://vendors.arizona.edu';
const UOFA_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1_000;
const USER_AGENT = 'Mozilla/5.0 (compatible; NineScrollsTenderWatch/1.0; +https://ninescrolls.com)';

export interface FetchUofaEvent {
    executionId: string;
}

export interface UofaRow {
    externalId: string;
    title: string;
    documentUrl: string | null;
    contactName: string | null;
    contactEmail: string | null;
    closeDateIso: string | null;
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function decodeHtmlEntities(s: string): string {
    return s
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function stripTags(s: string): string {
    return decodeHtmlEntities(s.replace(/<[^>]+>/g, ''));
}

/**
 * Parse the UofA RFP/Bid Opportunities HTML page into structured rows.
 * Exported for testing.
 */
export function parseUofaHtml(html: string): UofaRow[] {
    const rows: UofaRow[] = [];
    // Split by <tr> tags that contain the title cell to isolate each bid row.
    const rowMatches = html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g);
    for (const rowMatch of rowMatches) {
        const rowHtml = rowMatch[1];
        if (!rowHtml.includes('view-title-table-column')) continue;

        const titleCell = /<td[^>]*headers="view-title-table-column"[^>]*>([\s\S]*?)<\/td>/.exec(rowHtml);
        if (!titleCell) continue;
        const titleHtml = titleCell[1];
        const idMatch = /<strong>([^<]+)<\/strong>/.exec(titleHtml);
        // Title text is inside <p>...</p>, sometimes wrapped in <span>.
        const pMatch = /<p[^>]*>([\s\S]*?)<\/p>/.exec(titleHtml);
        if (!idMatch || !pMatch) continue;
        const externalId = decodeHtmlEntities(idMatch[1]);
        const title = stripTags(pMatch[1]);
        if (!externalId || !title) continue;

        // First document PDF link (used as canonical URL when available).
        const docCell = /<td[^>]*headers="view-field-documents-table-column"[^>]*>([\s\S]*?)<\/td>/.exec(rowHtml);
        let documentUrl: string | null = null;
        if (docCell) {
            const firstLink = /<a\s+href="([^"]+)"/.exec(docCell[1]);
            if (firstLink) {
                const href = firstLink[1];
                documentUrl = href.startsWith('http') ? href : `${UOFA_BASE}${href}`;
            }
        }

        // Contact: mailto link + visible name.
        const contactCell = /<td[^>]*headers="view-field-contact-name-table-column"[^>]*>([\s\S]*?)<\/td>/.exec(rowHtml);
        let contactName: string | null = null;
        let contactEmail: string | null = null;
        if (contactCell) {
            const mailto = /<a\s+href="mailto:([^"]+)"[^>]*>([^<]+)<\/a>/.exec(contactCell[1]);
            if (mailto) {
                contactEmail = decodeHtmlEntities(mailto[1]);
                contactName = decodeHtmlEntities(mailto[2]);
            }
        }

        // Close date: <time datetime="2026-06-23T21:30:00Z">.
        const dueCell = /<td[^>]*headers="view-field-due-date-table-column"[^>]*>([\s\S]*?)<\/td>/.exec(rowHtml);
        let closeDateIso: string | null = null;
        if (dueCell) {
            const timeMatch = /<time[^>]*datetime="([^"]+)"/.exec(dueCell[1]);
            if (timeMatch) closeDateIso = timeMatch[1];
        }

        rows.push({ externalId, title, documentUrl, contactName, contactEmail, closeDateIso });
    }
    return rows;
}

/**
 * Convert a parsed row to NormalizedTender. Skips rows that fail Zod validation.
 * Exported for testing.
 */
export function toNormalizedTender(row: UofaRow, scrapedAt: Date): NormalizedTender | null {
    const today = scrapedAt.toISOString().slice(0, 10);
    let deadline: string | null = null;
    if (row.closeDateIso) {
        const d = new Date(row.closeDateIso);
        if (!isNaN(d.getTime())) deadline = d.toISOString().slice(0, 10);
    }
    const url = row.documentUrl ?? UOFA_URL;
    const candidate = {
        source: 'uofa' as const,
        externalId: row.externalId,
        url,
        title: row.title,
        agency: 'University of Arizona',
        country: 'US',
        language: 'en',
        // Title is the only signal v1 — Drupal listing does not expose body.
        // PDF body parsing is a Phase 3b enrichment (mirrors fetch-calusource).
        description: row.title,
        postedDate: today,
        deadline,
        naicsCodes: [],
        cpvCodes: [],
        rawPayload: row,
    };
    const parsed = NormalizedTenderSchema.safeParse(candidate);
    return parsed.success ? parsed.data : null;
}

async function fetchHtmlWithRetry(): Promise<string> {
    let lastErr: unknown;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const { data } = await axios.get<string>(UOFA_URL, {
                timeout: UOFA_TIMEOUT_MS,
                headers: {
                    'User-Agent': USER_AGENT,
                    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                },
                responseType: 'text',
                transformResponse: [(d) => d],
            });
            return data;
        } catch (err) {
            lastErr = err;
            console.warn(JSON.stringify({
                event: 'fetch-uofa.retry',
                attempt,
                error: err instanceof Error ? err.message : String(err),
            }));
            if (attempt < MAX_RETRIES) await sleep(RETRY_BASE_DELAY_MS * attempt);
        }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export async function handler(event: FetchUofaEvent): Promise<FetchOutput> {
    const scrapedAt = new Date();
    try {
        const html = await fetchHtmlWithRetry();
        const rows = parseUofaHtml(html);
        const out: NormalizedTender[] = [];
        for (const row of rows) {
            const t = toNormalizedTender(row, scrapedAt);
            if (t) out.push(t);
        }

        const key = stagedKey(event.executionId, 'fetch-uofa', 'output');
        await s3.send(new PutObjectCommand({
            Bucket: STAGING_BUCKET(),
            Key: key,
            Body: JSON.stringify(out),
            ContentType: 'application/json',
        }));

        console.info(JSON.stringify({
            event: 'fetch-uofa.complete',
            executionId: event.executionId,
            rowsParsed: rows.length,
            tendersEmitted: out.length,
        }));

        return { source: 'uofa', stagedKey: key, fetched: out.length };
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(JSON.stringify({
            event: 'fetch-uofa.failed',
            executionId: event.executionId,
            error: message,
        }));
        return { source: 'uofa', stagedKey: '', fetched: 0, error: message };
    }
}
