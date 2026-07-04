import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import axios from 'axios';
import type { NormalizedTender, FetchOutput } from '../../lib/tender-watch/types';
import { NormalizedTenderSchema } from '../../lib/tender-watch/types';
import { stagedKey } from '../../lib/tender-watch/s3-staging';

const s3 = new S3Client({});
const STAGING_BUCKET = () => process.env.STAGING_BUCKET!;

/**
 * Universities of Wisconsin System sourcing portal (Jaggaer / SciQuest tenant).
 *
 * Discovered 2026-06-12 during systematic revisit of SciQuest tenants using
 * the "All" tab (previous Closed-tab-only pass missed everything because
 * completed RFPs are filed under status=Awarded, not status=Closed).
 *
 * Coverage: UW system (13 campuses). UW-Madison (business unit UWMSN) drives
 * ~85% of NineScrolls-relevant activity. Other campuses that occasionally
 * post scientific equipment: UW-Eau Claire (UWEAU), UW-Whitewater (UWWTW),
 * UW-Milwaukee (UWMIL). Facilities/food/IT campuses (Stout, Stevens Point,
 * Parkside, River Falls, Superior, Green Bay, Oshkosh, Platteville,
 * La Crosse) rarely post science equipment.
 *
 * Validation (3 years 2023-2026, 4 keywords):
 *   - microscope:   11 hits (SEM×3, AFM×2, TEM, thermal, confocal, NV diamond,
 *                             glass slide scanner, 5-year master contract)
 *   - spectrometer:  5 hits (ICP-OES, mass spec, imaging spec, optical emission)
 *   - vacuum:        3 hits (4K cryostat, 2× vacuum furnace)
 *   - deposition:    1 hit  (CVD, carbon nanotubes)
 *   TOTAL:          20 confirmed → ~7/year for these 4 keywords alone;
 *                     full-keyword sweep likely 10-15/year (UofA-tier volume).
 *
 * Primary buyer: Eric Thompson <eric.thompson@wisc.edu> — signed ~65% of the
 * NineScrolls-relevant RFPs above (UW-Madison's Celeste-Kanzig equivalent).
 * Secondary buyers: Thomas English, Jennifer Topp Quinn, Michael Marean,
 * Randall Massey (School of Medicine EM Core).
 *
 * # Why this source is easy (like fetch-nyscr)
 *
 * SciQuest ("Phoenix" UI) is server-side rendered per URL. The keyword filter
 * lives in the URL query string; no cookies, no XHR, no session state.
 *
 *   GET https://bids.sciquest.com/apps/Router/PublicEvent
 *       ?tab=PHX_NAV_SourcingAllOpps
 *       &CustomerOrg=UWisconsin
 *       &SimpleSearch_Keyword=<keyword>
 *
 * A polite Chrome-like User-Agent is sufficient. The server returns filtered
 * HTML directly. Verified 2026-06-12: curl produces the same rendered rows
 * as an interactive browser session.
 *
 * # Row structure (each bid card)
 *
 *   <span class="phx label-turquoise">Awarded</span>           ← status label
 *   <a class="btn btn-link btn-large btn-link-header"
 *      id="<TITLE_STRIPPED>" href="<JAGGAER_DETAIL_URL>"
 *      name="<FULL TITLE>">FULL TITLE</a>
 *   <div class="... label-mini">DESCRIPTION</div>
 *   <div SourcingPublicSite_LABEL_OPEN>Open</div>...<div>M/D/YYYY H:MM AM/PM TZ</div>
 *   <div SourcingPublicSite_LABEL_CLOSE>Close</div>...<div>M/D/YYYY H:MM AM/PM TZ</div>
 *   <div SourcingPublicSite_LABEL_TYPE>Type</div>...<div>RFB|RFP|RFQUAL|IFB</div>
 *   <div SourcingPublicSite_LABEL_NUMBER>Number</div>...<div>YYYY-{BU}-NNNNN-{TYPE}</div>
 *   <div SourcingPublicSite_LABEL_CONTACT>Contact</div>...<a href="mailto:...">NAME</a>
 *
 * The bid number encodes the business unit (e.g. UWMSN for UW-Madison); we
 * lift the BU code and translate it to a human-readable division so LLM
 * scoring has campus context.
 *
 * # Deep link
 *
 * The Jaggaer detail URL embedded in each anchor contains a session-scoped
 * AuthToken and expires. We construct a stable public-search deep link using
 * the bid number as the SimpleSearch_Keyword. Any anonymous user hitting
 * that URL sees the same card.
 *
 * # Query strategy
 *
 * Same curated keyword list as fetch-txesbd / fetch-nyscr. Per-keyword
 * failures are tolerated. Dedup by bid number across keywords.
 */
const UWISC_BASE = 'https://bids.sciquest.com';
const UWISC_SEARCH_PATH = '/apps/Router/PublicEvent';
const UWISC_CUSTOMER_ORG = 'UWisconsin';
const UWISC_TAB_ALL = 'PHX_NAV_SourcingAllOpps';

const HTTP_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1_000;

// SciQuest silently 403s obvious bot User-Agents on the AWS Lambda IP range;
// a plausible desktop Chrome UA keeps the endpoint responsive without any
// session cookies. Verified 2026-06-12.
const USER_AGENT =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export const UWISC_KEYWORDS = [
    'microscope',
    'spectrometer',
    'deposition',
    'vacuum',
    'plasma',
    'evaporator',
    'sputter',
    'etcher',
    'wafer',
    'lithography',
    'profilometer',
    'ellipsometer',
    'furnace',
] as const;

/**
 * Row-status values SciQuest uses for terminal / non-actionable events. We
 * short-circuit these in `toNormalizedTender` because otherwise the "All"
 * tab surfaces years of Awarded and Canceled RFPs, which would light up
 * classify + notify on the very first deploy for events that are no longer
 * biddable.
 */
const UWISC_INACTIVE_STATUSES = new Set([
    'awarded',
    'closed',
    'canceled',
    'cancelled',
    'posting cancelled',
    'no award',
]);

/**
 * UW business unit codes seen in bid numbers, mapped to human-readable
 * campus names for the NormalizedTender `agency` field. Unknown codes fall
 * through to a generic "UW System" label.
 */
const UWISC_BU_MAP: Record<string, string> = {
    UWMSN: 'UW-Madison',
    UWMIL: 'UW-Milwaukee',
    UWEAU: 'UW-Eau Claire',
    UWWTW: 'UW-Whitewater',
    UWSTO: 'UW-Stout',
    UWSYS: 'UW System Administration',
    UWRVF: 'UW-River Falls',
    UWSPT: 'UW-Stevens Point',
    STPALL: 'UW-Stevens Point',
    MILALL: 'UW-Milwaukee',
    MILFAC: 'UW-Milwaukee Facilities',
    PRKFAC: 'UW-Parkside Facilities',
    UWPKS: 'UW-Parkside',
    UWGRB: 'UW-Green Bay',
    UWSPR: 'UW-Superior',
    UWPLT: 'UW-Platteville',
    UWLAX: 'UW-La Crosse',
    UWOSH: 'UW-Oshkosh',
};

export interface FetchUwiscEvent {
    executionId: string;
}

export interface UwiscRow {
    title: string;
    description: string | null;
    number: string;
    type: string | null;
    openDate: string | null;
    closeDate: string | null;
    status: string | null;
    contactName: string | null;
    contactEmail: string | null;
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
 * Parse M/D/YYYY [optional H:MM AM/PM TZ] → ISO YYYY-MM-DD (date part only).
 * Time and timezone are discarded because the downstream schema requires just
 * a date, and the close-date UI treats them as local Central Time anyway.
 */
export function parseUwiscDate(s: string | null | undefined): string | null {
    if (!s) return null;
    const m = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s);
    if (!m) return null;
    return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
}

/**
 * Extract the value that appears immediately after a labeled div. The value
 * always lives in the next `<div class="phx data-row-content">...</div>`
 * sibling.
 *
 * SciQuest tags the FIRST occurrence of each label with a stable id
 * (e.g. `SourcingPublicSite_LABEL_NUMBER`) but auto-suffixes every subsequent
 * occurrence within the same page (`..._NUMBER_2`, `..._NUMBER_3`, ...) so
 * DOM ids remain unique across cards. The regex must tolerate the suffix.
 * Text-anchored strip tags ensure we only pull the plain data string.
 */
function extractLabeledValue(cardHtml: string, labelId: string): string | null {
    const re = new RegExp(
        `id="${labelId}(?:_\\d+)?"[^>]*>[^<]*</div>[\\s\\S]*?<div class="phx data-row-content"[^>]*>([\\s\\S]*?)</div>`,
    );
    const m = re.exec(cardHtml);
    if (!m) return null;
    // The value cell sometimes contains inline formatting (<b>, <a>) — strip
    // it so we get a bare human-readable string for parsing.
    return normWhitespace(m[1].replace(/<[^>]+>/g, ''));
}

/**
 * Extract campus (business unit) code from a bid number like
 * "2026-UWMSN-01294-RFB" → "UWMSN". Returns null if the pattern doesn't hold.
 */
export function extractBusinessUnit(bidNumber: string): string | null {
    const m = /^\d{4}-([A-Z]+)-\d+-[A-Z]+$/.exec(bidNumber);
    return m ? m[1] : null;
}

/**
 * Build a stable, publicly reachable URL for a bid. The Jaggaer detail URL
 * in the anchor requires a session-scoped AuthToken; we use the search URL
 * with the bid number as the keyword so anyone can find the row.
 */
export function uwiscDeepLink(bidNumber: string): string {
    const params = new URLSearchParams({
        tab: UWISC_TAB_ALL,
        CustomerOrg: UWISC_CUSTOMER_ORG,
        SimpleSearch_Keyword: bidNumber,
    });
    return `${UWISC_BASE}${UWISC_SEARCH_PATH}?${params.toString()}`;
}

/**
 * Parse the SciQuest UWisconsin search-results HTML into structured rows.
 * Exported for testing.
 */
export function parseUwiscHtml(html: string): UwiscRow[] {
    const rows: UwiscRow[] = [];
    // Anchor on the unique title-link class. This is far more selective than
    // any generic <a> pattern, so we don't get confused by header nav links.
    const cardRe =
        /<a\s+class="btn btn-link btn-large btn-link-header"[^>]*?name="([^"]{5,300})"[^>]*>([\s\S]*?)(?=<a\s+class="btn btn-link btn-large btn-link-header"|<div class="phx pagination|<footer|$)/g;

    let match: RegExpExecArray | null;
    while ((match = cardRe.exec(html)) !== null) {
        const title = normWhitespace(match[1]);
        const cardHtml = match[2];

        const number = extractLabeledValue(cardHtml, 'SourcingPublicSite_LABEL_NUMBER');
        if (!number || !title) continue;

        const openRaw = extractLabeledValue(cardHtml, 'SourcingPublicSite_LABEL_OPEN');
        const closeRaw = extractLabeledValue(cardHtml, 'SourcingPublicSite_LABEL_CLOSE');
        const type = extractLabeledValue(cardHtml, 'SourcingPublicSite_LABEL_TYPE');

        // Description sits between the title anchor and the first labeled block.
        const descRe = /<div[^>]*class="[^"]*label-mini[^"]*"[^>]*>([\s\S]*?)<\/div>/;
        const descMatch = descRe.exec(cardHtml);
        const description = descMatch ? normWhitespace(descMatch[1]) : null;

        // Status label sits just before the title anchor in a status-badge span
        // colour-coded by state (e.g. "Awarded" / "Closed" / "Canceled" / "Open"):
        //   <span class="mosaic status-badge status-badge-turquoise">Awarded</span>
        // We scan a short window preceding the anchor and take the closest badge.
        let status: string | null = null;
        const anchorPos = match.index;
        const before = html.substring(Math.max(0, anchorPos - 800), anchorPos);
        const spanRe = /<span[^>]*class="[^"]*status-badge[^"]*"[^>]*>([^<]+)<\/span>/g;
        let lastSpan: string | null = null;
        let sm: RegExpExecArray | null;
        while ((sm = spanRe.exec(before)) !== null) lastSpan = normWhitespace(sm[1]);
        status = lastSpan;

        // Contact: SciQuest suffixes duplicate labels in the same page as
        // `LABEL_CONTACT_2`, `LABEL_CONTACT_3`, ..., so the id anchor must be
        // suffix-tolerant like the other extractors. The value cell contains
        // free-form name text followed by a mailto anchor (occasionally a tel
        // link), so we capture EVERYTHING before the first mailto <a> as the
        // name — the earlier `[^<>\s]+` pattern truncated multi-word names
        // like "Teri Drake" to just "Drake".
        let contactName: string | null = null;
        let contactEmail: string | null = null;
        const contactRe =
            /id="SourcingPublicSite_LABEL_CONTACT(?:_\d+)?"[\s\S]*?<div class="phx data-row-content"[^>]*>([\s\S]*?)<\/div>/;
        const contactMatch = contactRe.exec(cardHtml);
        if (contactMatch) {
            const inner = contactMatch[1];
            const mailtoRe = /([\s\S]*?)<a[^>]*href="mailto:([^"?]+)/;
            const mm = mailtoRe.exec(inner);
            if (mm) {
                const nameRaw = mm[1].replace(/<[^>]+>/g, '');
                contactName = normWhitespace(nameRaw) || null;
                contactEmail = decodeHtmlEntities(mm[2]);
            }
        }

        rows.push({
            title,
            description,
            number,
            type,
            openDate: openRaw,
            closeDate: closeRaw,
            status,
            contactName,
            contactEmail,
        });
    }
    return rows;
}

/**
 * Convert a parsed row to NormalizedTender. Returns null when the row is
 * not actionable — either an archived status (Awarded / Closed / Cancelled
 * / No Award), a deadline that has already passed, or missing a parseable
 * posted date.
 *
 * We MUST drop these here rather than downstream because our normalize +
 * prefilter + LLM + notify chain treats every distinct tender ID as new
 * on first sight. Without the gate, the very first UWisc run would surface
 * years of Awarded RFPs into email alerts.
 */
export function toNormalizedTender(row: UwiscRow, now: Date = new Date()): NormalizedTender | null {
    const postedDate = parseUwiscDate(row.openDate);
    const deadline = parseUwiscDate(row.closeDate);
    if (!postedDate) return null;

    // Terminal statuses aren't biddable anymore.
    if (row.status && UWISC_INACTIVE_STATUSES.has(row.status.toLowerCase())) return null;

    // Missing status but the deadline is already in the past → same outcome.
    const today = now.toISOString().slice(0, 10);
    if (deadline && deadline < today) return null;

    const buCode = extractBusinessUnit(row.number);
    const campus = buCode ? UWISC_BU_MAP[buCode] ?? `UW System (${buCode})` : 'UW System';
    const agency = `Universities of Wisconsin — ${campus}`;

    const descriptionParts = [
        row.title,
        row.description,
        row.type ? `Type: ${row.type}` : null,
        row.status ? `Status: ${row.status}` : null,
        row.contactName ? `Contact: ${row.contactName}` : null,
    ].filter(Boolean);

    const candidate = {
        source: 'uwisc' as const,
        externalId: row.number,
        url: uwiscDeepLink(row.number),
        title: row.title,
        agency,
        country: 'US',
        language: 'en',
        description: descriptionParts.join(' — '),
        postedDate,
        deadline,
        naicsCodes: [],
        cpvCodes: [],
        rawPayload: row,
    };
    const parsed = NormalizedTenderSchema.safeParse(candidate);
    return parsed.success ? parsed.data : null;
}

/**
 * GET the SciQuest UWisconsin All-tab search page for one keyword with retry.
 * Exported for testing.
 */
export async function searchUwisc(keyword: string): Promise<UwiscRow[]> {
    let lastErr: unknown;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const res = await axios.get<string>(`${UWISC_BASE}${UWISC_SEARCH_PATH}`, {
                timeout: HTTP_TIMEOUT_MS,
                params: {
                    tab: UWISC_TAB_ALL,
                    CustomerOrg: UWISC_CUSTOMER_ORG,
                    SimpleSearch_Keyword: keyword,
                },
                headers: {
                    'User-Agent': USER_AGENT,
                    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                },
                responseType: 'text',
                transformResponse: [(d) => d],
            });
            return parseUwiscHtml(res.data);
        } catch (err) {
            lastErr = err;
            console.warn(JSON.stringify({
                event: 'fetch-uwisc.retry',
                keyword,
                attempt,
                error: err instanceof Error ? err.message : String(err),
            }));
            if (attempt < MAX_RETRIES) await sleep(RETRY_BASE_DELAY_MS * attempt);
        }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export async function handler(event: FetchUwiscEvent): Promise<FetchOutput> {
    try {
        const seen = new Set<string>();
        const allRows: UwiscRow[] = [];

        // Parallel keyword sweep — same wall-clock rationale as fetch-txesbd:
        // one slow keyword must not block the rest. SciQuest tolerates
        // simultaneous requests fine because there are no session cookies.
        const settled = await Promise.allSettled(
            UWISC_KEYWORDS.map((kw) =>
                searchUwisc(kw).then((rows) => ({ kw, rows })),
            ),
        );
        let fulfilledCount = 0;
        let rejectedCount = 0;
        let lastRejectReason: unknown = null;
        for (const r of settled) {
            if (r.status === 'fulfilled') {
                fulfilledCount++;
                const { kw, rows } = r.value;
                let added = 0;
                for (const row of rows) {
                    if (!row.number || seen.has(row.number)) continue;
                    seen.add(row.number);
                    allRows.push(row);
                    added++;
                }
                console.info(JSON.stringify({
                    event: 'fetch-uwisc.keyword-done',
                    keyword: kw,
                    returned: rows.length,
                    added,
                    uniqueSoFar: seen.size,
                }));
            } else {
                rejectedCount++;
                lastRejectReason = r.reason;
                console.warn(JSON.stringify({
                    event: 'fetch-uwisc.keyword-failed',
                    error: r.reason instanceof Error ? r.reason.message : String(r.reason),
                }));
            }
        }

        // A total outage — every single keyword search rejected — means the
        // upstream is unreachable, and we would otherwise report SUCCESS with
        // fetched=0. That masks a real incident from record-pipeline-run /
        // notify-pipeline-health. Rethrow so the Step Function catch surfaces
        // an actionable FAILED source.
        if (fulfilledCount === 0 && rejectedCount === UWISC_KEYWORDS.length) {
            throw lastRejectReason instanceof Error
                ? lastRejectReason
                : new Error(`fetch-uwisc: all ${rejectedCount} keyword searches failed`);
        }

        const out: NormalizedTender[] = [];
        for (const row of allRows) {
            const t = toNormalizedTender(row);
            if (t) out.push(t);
        }

        const key = stagedKey(event.executionId, 'fetch-uwisc', 'output');
        await s3.send(new PutObjectCommand({
            Bucket: STAGING_BUCKET(),
            Key: key,
            Body: JSON.stringify(out),
            ContentType: 'application/json',
        }));

        console.info(JSON.stringify({
            event: 'fetch-uwisc.complete',
            executionId: event.executionId,
            keywords: UWISC_KEYWORDS.length,
            rawRows: allRows.length,
            tendersEmitted: out.length,
        }));

        return { source: 'uwisc', stagedKey: key, fetched: out.length };
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(JSON.stringify({
            event: 'fetch-uwisc.failed',
            executionId: event.executionId,
            error: message,
        }));
        return { source: 'uwisc', stagedKey: '', fetched: 0, error: message };
    }
}
