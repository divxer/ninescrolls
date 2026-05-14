import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import axios from 'axios';
import type { NormalizedTender, FetchOutput } from '../../lib/tender-watch/types';
import { NormalizedTenderSchema } from '../../lib/tender-watch/types';
import { stagedKey } from '../../lib/tender-watch/s3-staging';

const s3 = new S3Client({});
const STAGING_BUCKET = () => process.env.STAGING_BUCKET!;

const TED_URL = 'https://ted.europa.eu/api/v3.0/notices/search';
const CPV_WHITELIST = ['38000000', '38500000', '38540000', '31700000'];
const LOOKBACK_DAYS = 2;
const PAGE_SIZE = 250;

export interface FetchTedEvent {
    executionId: string;
}

interface TedNotice {
    ND: string;
    TI?: Record<string, string>;
    DD: string;
    RC?: string;
    OL?: string;
    AC?: { 'official-name'?: string };
    CPV?: Array<{ code: string }>;
    DT?: string | null;
    VAL?: { amount: number; currency: string } | null;
    TX?: Record<string, string>;
    URI: string;
}

interface TedResponse {
    total?: number;
    results?: TedNotice[];
}

function pickLocalized(map: Record<string, string> | undefined, originalLang: string | undefined): string {
    if (!map) return '';
    if (map.en) return map.en;
    if (originalLang && map[originalLang.toLowerCase()]) return map[originalLang.toLowerCase()];
    const first = Object.values(map)[0];
    return first ?? '';
}

function isoCountry(code: string | undefined): string {
    if (!code) return 'EU';
    const upper = code.toUpperCase();
    return /^[A-Z]{2}$/.test(upper) ? upper : 'EU';
}

function isoLanguage(code: string | undefined): string {
    if (!code) return 'en';
    const lower = code.toLowerCase();
    return /^[a-z]{2}$/.test(lower) ? lower : 'en';
}

function normalize(n: TedNotice): NormalizedTender {
    const cpv = (n.CPV ?? []).map((c) => c.code);
    return {
        source: 'ted',
        externalId: n.ND,
        url: n.URI,
        title: pickLocalized(n.TI, n.OL),
        agency: n.AC?.['official-name'] ?? 'Unknown',
        country: isoCountry(n.RC),
        language: isoLanguage(n.OL),
        description: pickLocalized(n.TX, n.OL),
        estimatedValue: n.VAL ?? null,
        postedDate: n.DD,
        deadline: n.DT ?? null,
        naicsCodes: [],
        cpvCodes: cpv,
        rawPayload: n,
    };
}

export async function handler(event: FetchTedEvent): Promise<FetchOutput> {
    try {
        const today = new Date();
        const lookback = new Date(today.getTime() - LOOKBACK_DAYS * 24 * 3600 * 1000);
        const updatedFrom = lookback.toISOString().slice(0, 10);

        const out: NormalizedTender[] = [];
        let page = 1;
        for (;;) {
            const { data } = await axios.post<TedResponse>(
                TED_URL,
                {
                    query: `CPV IN (${CPV_WHITELIST.join(',')}) AND PD>=${updatedFrom}`,
                    page,
                    pageSize: PAGE_SIZE,
                    scope: '3', // active notices
                },
                { timeout: 30_000 },
            );
            const results = data.results ?? [];
            for (const n of results) {
                const candidate = normalize(n);
                const parsed = NormalizedTenderSchema.safeParse(candidate);
                if (parsed.success) {
                    out.push(parsed.data);
                } else {
                    console.warn(JSON.stringify({
                        event: 'fetch-ted.normalize-invalid',
                        nd: n.ND,
                        issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
                    }));
                }
            }
            page += 1;
            // Trust an empty page as the unambiguous termination condition.
            // If the server reports total, also exit early once we've covered it.
            if (results.length === 0) break;
            if (data.total != null && (page - 1) * PAGE_SIZE >= data.total) break;
        }

        const key = stagedKey(event.executionId, 'fetch-ted', 'output');
        await s3.send(new PutObjectCommand({
            Bucket: STAGING_BUCKET(),
            Key: key,
            Body: JSON.stringify(out),
            ContentType: 'application/json',
        }));

        console.log(JSON.stringify({ event: 'fetch-ted.success', count: out.length, executionId: event.executionId }));
        return { source: 'ted', stagedKey: key, fetched: out.length };
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(JSON.stringify({ event: 'fetch-ted.failure', error: message, executionId: event.executionId }));
        return { source: 'ted', stagedKey: '', fetched: 0, error: message };
    }
}
