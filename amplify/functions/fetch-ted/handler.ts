import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import axios from 'axios';
import type { NormalizedTender, FetchOutput } from '../../lib/tender-watch/types';
import { NormalizedTenderSchema } from '../../lib/tender-watch/types';
import { stagedKey } from '../../lib/tender-watch/s3-staging';

const s3 = new S3Client({});
const STAGING_BUCKET = () => process.env.STAGING_BUCKET!;

const TED_URL = 'https://api.ted.europa.eu/v3/notices/search';
const CPV_WHITELIST = ['38000000', '38500000', '38540000', '31700000'];
const LOOKBACK_DAYS = 2;
const PAGE_SIZE = 250;
const TED_FIELDS = [
    'publication-number',
    'notice-title',
    'publication-date',
    'classification-cpv',
    'buyer-name',
    'buyer-country',
    'description-proc',
    'deadline-receipt-tender-date-lot',
    'estimated-value-proc',
    'notice-type',
    'links',
];

export interface FetchTedEvent {
    executionId: string;
}

type LangMap = Record<string, string[] | string>;
type LinkLangMap = Record<string, string>;

interface TedNotice {
    'publication-number': string;
    'notice-title'?: LangMap;
    'publication-date'?: string;
    'classification-cpv'?: string[];
    'buyer-name'?: LangMap;
    'buyer-country'?: string[];
    'description-proc'?: LangMap;
    'deadline-receipt-tender-date-lot'?: string[];
    'estimated-value-proc'?: number | string;
    'notice-type'?: string;
    links?: {
        html?: LinkLangMap;
        htmlDirect?: LinkLangMap;
        xml?: LinkLangMap;
    };
}

interface TedResponse {
    notices?: TedNotice[];
    totalNoticeCount?: number;
    iterationNextToken?: string | null;
}

function pickLocalizedFromArrayMap(map: LangMap | undefined): string {
    if (!map) return '';
    const eng = map.eng;
    if (eng) return Array.isArray(eng) ? (eng[0] ?? '') : eng;
    for (const v of Object.values(map)) {
        if (!v) continue;
        if (Array.isArray(v)) return v[0] ?? '';
        return v;
    }
    return '';
}

function pickLinkEnglish(links: TedNotice['links'] | undefined): string {
    if (!links) return '';
    return (
        links.html?.ENG ??
        links.htmlDirect?.ENG ??
        links.xml?.ENG ??
        Object.values(links.html ?? {})[0] ??
        Object.values(links.htmlDirect ?? {})[0] ??
        ''
    );
}

function isoCountryFromIso3(code: string | undefined): string {
    if (!code) return 'EU';
    const upper = code.toUpperCase();
    if (upper.length === 2) return upper;
    // ISO 3166-1 alpha-3 to alpha-2 minimal map for EU + a few extras
    const map: Record<string, string> = {
        AUT: 'AT', BEL: 'BE', BGR: 'BG', HRV: 'HR', CYP: 'CY', CZE: 'CZ',
        DNK: 'DK', EST: 'EE', FIN: 'FI', FRA: 'FR', DEU: 'DE', GRC: 'GR',
        HUN: 'HU', IRL: 'IE', ITA: 'IT', LVA: 'LV', LTU: 'LT', LUX: 'LU',
        MLT: 'MT', NLD: 'NL', POL: 'PL', PRT: 'PT', ROU: 'RO', SVK: 'SK',
        SVN: 'SI', ESP: 'ES', SWE: 'SE', GBR: 'GB', NOR: 'NO', CHE: 'CH',
    };
    return map[upper] ?? 'EU';
}

function toIsoDate(input: string | null | undefined): string | null {
    if (!input) return null;
    const match = input.match(/^\d{4}-\d{2}-\d{2}/);
    return match ? match[0] : null;
}

function isOpenTender(noticeType: string | undefined): boolean {
    if (!noticeType) return false;
    // Contract Notices ('cn-') are open tenders. Awards ('can-') are post-award. Prior info ('cnde-', 'pin-') is intent only.
    return noticeType.startsWith('cn-');
}

function ymdCompact(date: Date): string {
    return [
        date.getUTCFullYear(),
        String(date.getUTCMonth() + 1).padStart(2, '0'),
        String(date.getUTCDate()).padStart(2, '0'),
    ].join('');
}

function normalize(n: TedNotice): NormalizedTender {
    const cpv = n['classification-cpv'] ?? [];
    const title = pickLocalizedFromArrayMap(n['notice-title']);
    const description = pickLocalizedFromArrayMap(n['description-proc']);
    const country = isoCountryFromIso3(n['buyer-country']?.[0]);
    const url = pickLinkEnglish(n.links);
    const postedDate = toIsoDate(n['publication-date']) ?? new Date().toISOString().slice(0, 10);
    const deadline = toIsoDate(n['deadline-receipt-tender-date-lot']?.[0]);
    const value = typeof n['estimated-value-proc'] === 'number' ? n['estimated-value-proc'] : null;

    return {
        source: 'ted',
        externalId: n['publication-number'],
        url,
        title,
        agency: pickLocalizedFromArrayMap(n['buyer-name']) || 'Unknown',
        country,
        language: 'en',
        description,
        estimatedValue: value != null ? { amount: value, currency: 'EUR' } : null,
        postedDate,
        deadline,
        naicsCodes: [],
        cpvCodes: cpv,
        rawPayload: n,
    };
}

export async function handler(event: FetchTedEvent): Promise<FetchOutput> {
    try {
        const today = new Date();
        const lookback = new Date(today.getTime() - LOOKBACK_DAYS * 24 * 3600 * 1000);
        const cpvClause = CPV_WHITELIST.map((c) => `classification-cpv="${c}"`).join(' OR ');
        const query = `(${cpvClause}) AND publication-date>=${ymdCompact(lookback)}`;

        const out: NormalizedTender[] = [];
        let nextToken: string | null | undefined;
        for (;;) {
            const body: Record<string, unknown> = {
                query,
                scope: 'ALL',
                limit: PAGE_SIZE,
                fields: TED_FIELDS,
            };
            if (nextToken) body.iterationNextToken = nextToken;
            const { data } = await axios.post<TedResponse>(TED_URL, body, { timeout: 30_000 });
            const notices = data.notices ?? [];
            for (const n of notices) {
                if (!isOpenTender(n['notice-type'])) continue;
                const candidate = normalize(n);
                const parsed = NormalizedTenderSchema.safeParse(candidate);
                if (parsed.success) {
                    out.push(parsed.data);
                } else {
                    console.warn(JSON.stringify({
                        event: 'fetch-ted.normalize-invalid',
                        pubNumber: n['publication-number'],
                        issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
                    }));
                }
            }
            if (!data.iterationNextToken || notices.length === 0) break;
            nextToken = data.iterationNextToken;
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
