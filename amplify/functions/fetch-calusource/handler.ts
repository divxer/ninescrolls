import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import axios from 'axios';
import type { NormalizedTender, FetchOutput } from '../../lib/tender-watch/types';
import { NormalizedTenderSchema } from '../../lib/tender-watch/types';
import { stagedKey } from '../../lib/tender-watch/s3-staging';

const s3 = new S3Client({});
const STAGING_BUCKET = () => process.env.STAGING_BUCKET!;

/**
 * CalUsource (UC system procurement, powered by GEP SMART) public bid site API.
 *
 * Reverse-engineered 2026-05-24: the public bid site (no login required) at
 *   https://smart.gep.com/publicRFx/ucal
 * is backed by this single JSON endpoint:
 *   POST https://smart.gep.com/GetPublicRfxManageData?dd=YnBjPTQxMTk4Mw2
 *
 * The `dd` query parameter is base64(`bpc=411983`) — the UC system tenant ID.
 * Active events filter via SRCG_ResponseEnd date range (future = active).
 *
 * Coverage: all UC campuses (UCB, UCLA, UCSB, UCSD, UCSF, UC Davis, UCSC, UC
 * Merced, UC Riverside) plus UCOP system-wide RFPs. Historical sample shows
 * ~3 NineScrolls-relevant RFPs per year (PVD, AFM, ICP etcher, MBE), mostly
 * from UCSB and increasingly UCB (DARPA-NGMM 2025).
 *
 * No public detail-description endpoint reachable without login — v1 uses the
 * title only as LLM scoring input. The title carries ~95% of the signal
 * (e.g. "UCB RFP# 200mm Physical Vapor Deposition System").
 */
const CALUSOURCE_URL = 'https://smart.gep.com/GetPublicRfxManageData?dd=YnBjPTQxMTk4Mw2';
const CALUSOURCE_PUBLIC_REFERER = 'https://smart.gep.com/publicRFx/ucal?oloc=215#/';
const UC_BUYER_PARTNER_CODE = 411983;
const PAGE_SIZE = 100;
const CALUSOURCE_TIMEOUT_MS = 30_000;
const MAX_RETRIES_PER_PAGE = 3;
const RETRY_BASE_DELAY_MS = 1_000;

export interface FetchCalusourceEvent {
    executionId: string;
}

interface CalusourceField {
    DocumentCode: number;
    FieldID: string | null;
    FieldName: string;
    FieldText: string | null;
    FieldType: number;
    FieldValue: string;
    IsDeleted: boolean;
}

interface CalusourceDocumentSearchOutput {
    DocumentCode: number;
    DocumentName: string;
    DocumentNumber: string;
    DocumentStatusInfo: number;
    DocumentTypeInfo: string;
    DocumentAdditionalFieldList?: CalusourceField[];
    QueryString?: string;
    CreatedByName?: string;
    CreatedOn?: string;
    UpdatedOn?: string;
    IsConfidential?: boolean;
    BuyerPartnerName?: string;
}

interface CalusourceRow {
    DocumentSearchOutput: CalusourceDocumentSearchOutput;
}

interface CalusourceResponse {
    DataSearchResult: {
        Value: CalusourceRow[];
        TotalRecords: number;
        GroupTotal?: { rfx?: number; TotalCount?: number };
        Status: number;
        ErrorCode: string;
        ErrorMessage: string;
    };
}

/**
 * Format a Date as `M/d/yyyy h:mm am|pm` IN PACIFIC TIME.
 *
 * CalUsource's UI universally renders timestamps as "Pacific Standard Time"
 * (per UC system convention; GEP follows the customer locale). Empirical
 * testing confirms the API interprets `AdvanceSearchInput.Value` as Pacific
 * regardless of UTC offset. Passing UTC-derived numbers would shift the
 * active/closed boundary by 7–8 hours and could silently misclassify events
 * whose ResponseEnd sits within that window.
 *
 * We use Intl.DateTimeFormat with `timeZone: 'America/Los_Angeles'` so the
 * Lambda emits Pacific-correct strings regardless of Lambda runtime locale.
 */
function formatGepDate(d: Date): string {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Los_Angeles',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    }).formatToParts(d);
    const pick = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
    const month = Number(pick('month'));
    const day = Number(pick('day'));
    const year = pick('year');
    const hours12 = Number(pick('hour'));
    const mins = pick('minute');
    // dayPeriod is "AM" or "PM"; GEP wants lowercase "am" / "pm".
    const ampm = pick('dayPeriod').toLowerCase();
    return `${month}/${day}/${year} ${hours12}:${mins} ${ampm}`;
}

/** Parse CalUsource date strings like "6/15/2026 7:00:00 PM" (or ISO) into ISO date "YYYY-MM-DD". */
function toIsoDate(input: string | null | undefined): string | null {
    if (!input) return null;
    // ISO short-circuit
    const iso = input.match(/^\d{4}-\d{2}-\d{2}/);
    if (iso) return iso[0];
    // M/d/yyyy ...
    const m = input.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (!m) return null;
    const mm = String(Number(m[1])).padStart(2, '0');
    const dd = String(Number(m[2])).padStart(2, '0');
    return `${m[3]}-${mm}-${dd}`;
}

/** Lookup helper for the AdditionalFieldList key/value array. */
function field(o: CalusourceDocumentSearchOutput, name: string): string | undefined {
    return o.DocumentAdditionalFieldList?.find((f) => f.FieldName === name)?.FieldValue;
}

/**
 * Derive the agency name from the contact email domain.
 * UC subdomains map to readable campus names — gives a usable `agency` value
 * even though the API doesn't return one directly.
 */
function agencyFromEmail(email: string | undefined): string {
    if (!email) return 'University of California';
    const m = email.toLowerCase().match(/@([^>\s]+)$/);
    if (!m) return 'University of California';
    const domain = m[1];
    if (domain.endsWith('ucop.edu')) return 'UC Office of the President';
    if (domain.endsWith('berkeley.edu')) return 'UC Berkeley';
    if (domain.endsWith('ucla.edu')) return 'UCLA';
    if (domain.endsWith('ucsd.edu') || domain.endsWith('health.ucsd.edu')) return 'UC San Diego';
    if (domain.endsWith('ucsf.edu')) return 'UCSF';
    if (domain.endsWith('ucsb.edu')) return 'UC Santa Barbara';
    if (domain.endsWith('ucdavis.edu') || domain.endsWith('health.ucdavis.edu')) return 'UC Davis';
    if (domain.endsWith('ucsc.edu')) return 'UC Santa Cruz';
    if (domain.endsWith('ucmerced.edu')) return 'UC Merced';
    if (domain.endsWith('ucr.edu')) return 'UC Riverside';
    if (domain.endsWith('uci.edu')) return 'UC Irvine';
    return 'University of California';
}

/**
 * Construct the deep-link URL for a CalUsource event. The `QueryString` field
 * returned by the API is already base64-encoded as `dc=<code>&bpc=<tenant>`,
 * which is the same shape used in workspace URLs. Suppliers logged into UC
 * supplier portal land directly on the detail page; unauthenticated users get
 * redirected to login.
 */
function buildEventUrl(o: CalusourceDocumentSearchOutput): string {
    if (o.QueryString) {
        return `https://smart.gep.com/Sourcing/Rfx?dd=${o.QueryString}&oloc=219`;
    }
    // Fallback: public bid site root (admin can search by DocumentNumber).
    return 'https://smart.gep.com/publicRFx/ucal?oloc=215#/';
}

function normalize(o: CalusourceDocumentSearchOutput): NormalizedTender {
    const endRaw = field(o, 'End');
    const startRaw = field(o, 'Start');
    const email = field(o, 'EmailID');
    const postedDate =
        toIsoDate(o.CreatedOn) ??
        toIsoDate(startRaw) ??
        new Date().toISOString().slice(0, 10);
    return {
        source: 'calusource',
        externalId: o.DocumentNumber,
        url: buildEventUrl(o),
        title: o.DocumentName,
        agency: agencyFromEmail(email),
        country: 'US',
        language: 'en',
        description: '', // v1: title-only LLM scoring. v2 enrichment in separate task.
        estimatedValue: null,
        postedDate,
        deadline: toIsoDate(endRaw),
        naicsCodes: [],
        cpvCodes: [],
        rawPayload: o,
    };
}

async function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * POST a single CalUsource API page with retry on transient 5xx / network errors.
 * Mirrors fetch-sam / fetch-ted retry policy.
 */
async function fetchPageWithRetry(body: Record<string, unknown>, pageIndex: number): Promise<CalusourceResponse> {
    let lastErr: unknown;
    for (let attempt = 1; attempt <= MAX_RETRIES_PER_PAGE; attempt++) {
        try {
            const { data } = await axios.post<CalusourceResponse>(CALUSOURCE_URL, body, {
                timeout: CALUSOURCE_TIMEOUT_MS,
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    IsAnonymous: true,
                    Origin: 'https://smart.gep.com',
                    Referer: CALUSOURCE_PUBLIC_REFERER,
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36',
                },
            });
            return data;
        } catch (err) {
            lastErr = err;
            const status = (err as { response?: { status?: number } })?.response?.status;
            // Retry on network errors (no .response), 5xx, and 429 rate-limit.
            const retryable = status === undefined || status === 429 || status >= 500;
            if (!retryable || attempt === MAX_RETRIES_PER_PAGE) {
                console.warn(JSON.stringify({
                    event: 'fetch-calusource.page-failed',
                    pageIndex,
                    attempt,
                    status,
                    error: err instanceof Error ? err.message : String(err),
                }));
                throw err;
            }
            const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
            console.warn(JSON.stringify({
                event: 'fetch-calusource.page-retry',
                pageIndex,
                attempt,
                status,
                delayMs: delay,
                error: err instanceof Error ? err.message : String(err),
            }));
            await sleep(delay);
        }
    }
    throw lastErr;
}

export async function handler(event: FetchCalusourceEvent): Promise<FetchOutput> {
    try {
        const now = new Date();
        const activeEndRange = `${formatGepDate(now)},12/31/3000 11:59 pm`;

        const out: NormalizedTender[] = [];
        const seenDocNumbers = new Set<string>();
        let pageNumber = 1;
        let pageIndex = 0;
        for (;;) {
            pageIndex += 1;
            const data = await fetchPageWithRetry(
                {
                    CultureCode: 'en-US',
                    AdvanceSearchInput: [{
                        FieldType: 'DateTimeRange',
                        IsCustAttr: false,
                        SearchKey: 'SRCG_ResponseEnd',
                        Value: activeEndRange,
                    }],
                    Filters: [
                        'moduleScope:rfx',
                        'isGlobalSearch:false',
                        'PageType:Public',
                        `pageNumber:${pageNumber}`,
                        `noOfRecords:${PAGE_SIZE}`,
                        'isSeeAllResult:true',
                        'sortField:SORT_SRCG_ResponseStart|DESC',
                    ],
                    BuyerPartnerCode: UC_BUYER_PARTNER_CODE,
                },
                pageIndex,
            );

            const rows = data.DataSearchResult?.Value ?? [];
            for (const row of rows) {
                const o = row.DocumentSearchOutput;
                if (!o || !o.DocumentNumber) continue;
                if (seenDocNumbers.has(o.DocumentNumber)) continue;
                seenDocNumbers.add(o.DocumentNumber);

                const candidate = normalize(o);
                const parsed = NormalizedTenderSchema.safeParse(candidate);
                if (parsed.success) {
                    out.push(parsed.data);
                } else {
                    console.warn(JSON.stringify({
                        event: 'fetch-calusource.normalize-invalid',
                        documentNumber: o.DocumentNumber,
                        issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
                    }));
                }
            }

            const totalRecords = data.DataSearchResult?.TotalRecords ?? 0;
            const fetchedSoFar = pageNumber * PAGE_SIZE;
            if (rows.length === 0 || fetchedSoFar >= totalRecords) break;
            pageNumber += 1;
        }

        const key = stagedKey(event.executionId, 'fetch-calusource', 'output');
        await s3.send(new PutObjectCommand({
            Bucket: STAGING_BUCKET(),
            Key: key,
            Body: JSON.stringify(out),
            ContentType: 'application/json',
        }));

        console.log(JSON.stringify({
            event: 'fetch-calusource.success',
            count: out.length,
            buyerPartnerCode: UC_BUYER_PARTNER_CODE,
            executionId: event.executionId,
        }));
        return { source: 'calusource', stagedKey: key, fetched: out.length };
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(JSON.stringify({ event: 'fetch-calusource.failure', error: message, executionId: event.executionId }));
        return { source: 'calusource', stagedKey: '', fetched: 0, error: message };
    }
}
