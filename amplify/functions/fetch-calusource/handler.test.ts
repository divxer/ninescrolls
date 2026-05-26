import { describe, it, expect, vi, beforeEach } from 'vitest';
import fixture from './fixtures/calusource-sample.json';

const axiosPost = vi.fn();
const axiosGet = vi.fn();
vi.mock('axios', () => ({ default: { post: axiosPost, get: axiosGet }, post: axiosPost, get: axiosGet }));

const s3Send = vi.fn().mockResolvedValue({});
vi.mock('@aws-sdk/client-s3', () => ({
    S3Client: vi.fn().mockImplementation(() => ({ send: s3Send })),
    PutObjectCommand: vi.fn().mockImplementation((args) => ({ __cmd: 'PutObject', ...args })),
    GetObjectCommand: vi.fn().mockImplementation((args) => ({ __cmd: 'GetObject', ...args })),
}));

vi.stubEnv('STAGING_BUCKET', 'tender-watch-raw-test');

// Patch global setTimeout so retry backoffs fire immediately in tests.
const originalSetTimeout = globalThis.setTimeout;
globalThis.setTimeout = ((fn: () => void) => {
    fn();
    return 0 as unknown as ReturnType<typeof originalSetTimeout>;
}) as typeof globalThis.setTimeout;

beforeEach(() => {
    axiosPost.mockReset();
    axiosGet.mockReset();
    s3Send.mockClear();
});

describe('fetch-calusource handler', () => {
    it('fetches active events, normalizes them, and stages to S3', async () => {
        axiosPost.mockResolvedValueOnce({ data: fixture });
        const { handler } = await import('./handler');

        const result = await handler({ executionId: 'exec-cal-1' });

        expect(result.source).toBe('calusource');
        expect(result.fetched).toBe(2);
        expect(result.stagedKey).toMatch(/tender-watch\/exec-cal-1\/fetch-calusource\/output\.json/);

        const putCall = s3Send.mock.calls.find((c) => c[0].__cmd === 'PutObject');
        expect(putCall).toBeDefined();
        const body = JSON.parse(putCall![0].Body);
        expect(body).toHaveLength(2);

        // UCB PVD event — the headline NineScrolls fit
        expect(body[0]).toMatchObject({
            source: 'calusource',
            externalId: '003829-Oct2026',
            title: 'UCB RFP# 200mm Physical Vapor Deposition System_Materials Science and Engineering 2026',
            agency: 'UC Berkeley',
            country: 'US',
            language: 'en',
            postedDate: '2026-10-02',
            deadline: '2026-10-24',
            naicsCodes: [],
            cpvCodes: [],
        });
        // URL must be a deep-link with the QueryString so admin clicks land on detail (or login)
        expect(body[0].url).toBe('https://smart.gep.com/Sourcing/Rfx?dd=ZGM9MTkyOTMmYnBjPTQxMTk4Mw==&oloc=219');

        // Sushi event — sanity check non-NineScrolls record still normalizes cleanly
        expect(body[1]).toMatchObject({
            externalId: '003902-Feb2026',
            agency: 'UC Berkeley',
            deadline: '2026-06-12',
        });
    });

    it('sends BuyerPartnerCode=411983 and a future-dated SRCG_ResponseEnd range', async () => {
        axiosPost.mockResolvedValueOnce({ data: fixture });
        const { handler } = await import('./handler');
        await handler({ executionId: 'exec-cal-2' });

        const [url, body] = axiosPost.mock.calls[0];
        expect(url).toContain('/GetPublicRfxManageData');
        expect(body.BuyerPartnerCode).toBe(411983);
        const dateRange = body.AdvanceSearchInput[0].Value as string;
        expect(dateRange).toMatch(/,12\/31\/3000 11:59 pm$/);
        // Filters carry pagination + sort + scope
        expect(body.Filters).toEqual(expect.arrayContaining([
            'moduleScope:rfx',
            'PageType:Public',
            'pageNumber:1',
            'noOfRecords:100',
            expect.stringMatching(/sortField:/),
        ]));
        // The CulturalCode lets GEP return English names
        expect(body.CultureCode).toBe('en-US');
    });

    it('formats the SRCG_ResponseEnd start in PACIFIC TIME, not UTC', async () => {
        // Fix "now" to a moment where UTC and Pacific fall on different days:
        // 2026-05-27 03:00:00 UTC == 2026-05-26 20:00 PDT (UTC-7 in summer).
        // The Lambda should emit "5/26/2026 8:00 pm", not "5/27/2026 3:00 am".
        // We fake only the clock, not setTimeout (which our outer module patch
        // already shortcuts to immediate).
        const fixedNow = new Date('2026-05-27T03:00:00.000Z');
        vi.useFakeTimers({ now: fixedNow, toFake: ['Date'] });
        try {
            axiosPost.mockResolvedValueOnce({ data: fixture });
            const { handler } = await import('./handler');
            await handler({ executionId: 'exec-cal-tz' });

            const body = axiosPost.mock.calls[0][1];
            const dateRange = body.AdvanceSearchInput[0].Value as string;
            const [startStr] = dateRange.split(',');
            // Date must be 5/26/2026 (Pacific calendar day), NOT 5/27/2026 (UTC).
            expect(startStr).toMatch(/^5\/26\/2026 /);
            expect(startStr).toMatch(/ pm$/);
        } finally {
            vi.useRealTimers();
        }
    });

    it('paginates when TotalRecords exceeds one page', async () => {
        // Build 100 unique rows for page 1 and 5 for page 2
        const mkRow = (i: number) => ({
            DocumentSearchOutput: {
                DocumentCode: 30000 + i,
                DocumentName: `UC paged event ${i}`,
                DocumentNumber: `paged-${i}`,
                DocumentStatusInfo: 165,
                DocumentTypeInfo: '1',
                QueryString: `ZGM9${i}`,
                CreatedOn: '2026-10-02T17:00:00.000',
                BuyerPartnerCode: 411983,
                DocumentAdditionalFieldList: [
                    { DocumentCode: 30000 + i, FieldName: 'EmailID', FieldValue: 'someone@berkeley.edu', FieldType: 3, FieldText: null, FieldID: null, IsDeleted: false },
                    { DocumentCode: 30000 + i, FieldName: 'End', FieldValue: '12/31/2026 11:59:00 PM', FieldType: 3, FieldText: null, FieldID: null, IsDeleted: false },
                ],
            },
        });
        const page1 = { DataSearchResult: { Value: Array.from({ length: 100 }, (_, i) => mkRow(i)), TotalRecords: 105, Status: 1, ErrorCode: '0', ErrorMessage: '' } };
        const page2 = { DataSearchResult: { Value: Array.from({ length: 5 }, (_, i) => mkRow(100 + i)), TotalRecords: 105, Status: 1, ErrorCode: '0', ErrorMessage: '' } };
        axiosPost.mockResolvedValueOnce({ data: page1 }).mockResolvedValueOnce({ data: page2 });

        const { handler } = await import('./handler');
        const result = await handler({ executionId: 'exec-cal-3' });

        expect(axiosPost).toHaveBeenCalledTimes(2);
        expect(result.fetched).toBe(105);
        // page numbers were 1, 2
        expect(axiosPost.mock.calls[0][1].Filters).toContain('pageNumber:1');
        expect(axiosPost.mock.calls[1][1].Filters).toContain('pageNumber:2');
    });

    it('dedupes the same DocumentNumber across pages', async () => {
        const dup = {
            DocumentSearchOutput: {
                DocumentCode: 1,
                DocumentName: 'Dup event',
                DocumentNumber: 'same-number',
                DocumentStatusInfo: 165,
                DocumentTypeInfo: '1',
                QueryString: 'Wmw==',
                CreatedOn: '2026-10-02T17:00:00.000',
                BuyerPartnerCode: 411983,
                DocumentAdditionalFieldList: [
                    { DocumentCode: 1, FieldName: 'EmailID', FieldValue: 'someone@ucsb.edu', FieldType: 3, FieldText: null, FieldID: null, IsDeleted: false },
                    { DocumentCode: 1, FieldName: 'End', FieldValue: '12/31/2026 11:59:00 PM', FieldType: 3, FieldText: null, FieldID: null, IsDeleted: false },
                ],
            },
        };
        axiosPost
            .mockResolvedValueOnce({ data: { DataSearchResult: { Value: [dup, dup], TotalRecords: 2, Status: 1, ErrorCode: '0', ErrorMessage: '' } } });
        const { handler } = await import('./handler');
        const result = await handler({ executionId: 'exec-cal-4' });
        expect(result.fetched).toBe(1);
    });

    it('retries transient 5xx then succeeds', async () => {
        const transient = Object.assign(new Error('upstream 502'), { response: { status: 502 } });
        axiosPost
            .mockRejectedValueOnce(transient)
            .mockResolvedValueOnce({ data: fixture });
        const { handler } = await import('./handler');
        const result = await handler({ executionId: 'exec-cal-5' });
        expect(axiosPost).toHaveBeenCalledTimes(2);
        expect(result.fetched).toBe(2);
        expect(result.error).toBeUndefined();
    });

    it('does NOT retry non-retryable 4xx errors (e.g. 400)', async () => {
        const clientErr = Object.assign(new Error('bad request'), { response: { status: 400 } });
        axiosPost.mockRejectedValueOnce(clientErr);
        const { handler } = await import('./handler');
        const result = await handler({ executionId: 'exec-cal-6' });
        expect(axiosPost).toHaveBeenCalledTimes(1);
        expect(result.fetched).toBe(0);
        expect(result.error).toContain('bad request');
    });

    it('retries 429 rate-limit responses', async () => {
        const rateLimited = Object.assign(new Error('Too Many Requests'), { response: { status: 429 } });
        axiosPost
            .mockRejectedValueOnce(rateLimited)
            .mockResolvedValueOnce({ data: fixture });
        const { handler } = await import('./handler');
        const result = await handler({ executionId: 'exec-cal-429' });
        expect(axiosPost).toHaveBeenCalledTimes(2);
        expect(result.fetched).toBe(2);
    });

    it('returns fetched=0 + error after exhausting retries on persistent 5xx', async () => {
        const transient = Object.assign(new Error('upstream timeout'), { response: { status: 504 } });
        axiosPost.mockRejectedValue(transient);
        const { handler } = await import('./handler');
        const result = await handler({ executionId: 'exec-cal-7' });
        expect(axiosPost).toHaveBeenCalledTimes(3);
        expect(result.fetched).toBe(0);
        expect(result.error).toContain('upstream timeout');
    });

    it('derives agency from multiple UC email domains', async () => {
        const mkRow = (email: string, num: string) => ({
            DocumentSearchOutput: {
                DocumentCode: 1, DocumentName: `Event for ${email}`,
                DocumentNumber: num, DocumentStatusInfo: 165, DocumentTypeInfo: '1',
                QueryString: 'Wmw==', CreatedOn: '2026-10-02T17:00:00.000',
                BuyerPartnerCode: 411983,
                DocumentAdditionalFieldList: [
                    { DocumentCode: 1, FieldName: 'EmailID', FieldValue: email, FieldType: 3, FieldText: null, FieldID: null, IsDeleted: false },
                    { DocumentCode: 1, FieldName: 'End', FieldValue: '12/31/2026 11:59:00 PM', FieldType: 3, FieldText: null, FieldID: null, IsDeleted: false },
                ],
            },
        });
        axiosPost.mockResolvedValueOnce({ data: { DataSearchResult: { Value: [
            mkRow('ops@berkeley.edu', 'a'),
            mkRow('ops@ucla.edu', 'b'),
            mkRow('ops@ucsb.edu', 'c'),
            mkRow('ops@health.ucsd.edu', 'd'),
            mkRow('ops@ucsf.edu', 'e'),
            mkRow('ops@ucdavis.edu', 'f'),
            mkRow('ops@ucsc.edu', 'g'),
            mkRow('ops@ucmerced.edu', 'h'),
            mkRow('ops@ucop.edu', 'i'),
            mkRow('ops@uci.edu', 'j'),
            mkRow('ops@ucr.edu', 'k'),
        ], TotalRecords: 11, Status: 1, ErrorCode: '0', ErrorMessage: '' } } });
        const { handler } = await import('./handler');
        await handler({ executionId: 'exec-cal-8' });
        const putCall = s3Send.mock.calls.find((c) => c[0].__cmd === 'PutObject');
        const body = JSON.parse(putCall![0].Body);
        const agencies = body.map((b: { agency: string }) => b.agency);
        expect(agencies).toEqual([
            'UC Berkeley',
            'UCLA',
            'UC Santa Barbara',
            'UC San Diego',
            'UCSF',
            'UC Davis',
            'UC Santa Cruz',
            'UC Merced',
            'UC Office of the President',
            'UC Irvine',
            'UC Riverside',
        ]);
    });
});
