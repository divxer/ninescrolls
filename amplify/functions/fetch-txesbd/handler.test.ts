import { describe, it, expect, vi, beforeEach } from 'vitest';
import fixture from './fixtures/txesbd-microscope.json';

const axiosGet = vi.fn();
const axiosPost = vi.fn();
vi.mock('axios', () => ({ default: { get: axiosGet, post: axiosPost }, get: axiosGet, post: axiosPost }));

const s3Send = vi.fn().mockResolvedValue({});
vi.mock('@aws-sdk/client-s3', () => ({
    S3Client: vi.fn().mockImplementation(() => ({ send: s3Send })),
    PutObjectCommand: vi.fn().mockImplementation((args) => ({ __cmd: 'PutObject', ...args })),
}));

vi.stubEnv('STAGING_BUCKET', 'tender-watch-raw-test');

const originalSetTimeout = globalThis.setTimeout;
globalThis.setTimeout = ((fn: () => void) => {
    fn();
    return 0 as unknown as ReturnType<typeof originalSetTimeout>;
}) as typeof globalThis.setTimeout;

beforeEach(() => {
    axiosGet.mockReset();
    axiosPost.mockReset();
    s3Send.mockClear();
});

function mockGetWithCookies() {
    axiosGet.mockResolvedValue({
        headers: {
            'set-cookie': [
                'JSESSIONID=abc123; Path=/; Secure; HttpOnly',
                'NLVisitorId=xyz789; Path=/; Max-Age=30758400',
                'NS_VER=2026.1; Path=/',
            ],
        },
        status: 200,
        data: '<html/>',
    });
}

describe('parseMDYY', () => {
    it('converts M/D/YYYY to ISO YYYY-MM-DD', async () => {
        const { parseMDYY } = await import('./handler');
        expect(parseMDYY('5/7/2026')).toBe('2026-05-07');
        expect(parseMDYY('12/31/2025')).toBe('2025-12-31');
        expect(parseMDYY('1/1/2020')).toBe('2020-01-01');
    });

    it('returns null on malformed input', async () => {
        const { parseMDYY } = await import('./handler');
        expect(parseMDYY('')).toBeNull();
        expect(parseMDYY('not a date')).toBeNull();
        expect(parseMDYY('5-7-2026')).toBeNull();
        expect(parseMDYY('2026/05/07')).toBeNull();
    });
});

describe('toNormalizedTender', () => {
    it('emits a valid NormalizedTender from a real ESBD line', async () => {
        const { toNormalizedTender } = await import('./handler');
        const line = fixture.lines[3];  // TAMU "BENCHTOP SCANNING ELECTRON MICROSCOPE"
        const t = toNormalizedTender(line as any);

        expect(t).not.toBeNull();
        expect(t!.source).toBe('txesbd');
        expect(t!.externalId).toBe(line.solicitationId);
        expect(t!.title).toBe('BENCHTOP SCANNING ELECTRON MICROSCOPE');
        expect(t!.agency).toBe('Texas A & M University - 711');
        expect(t!.country).toBe('US');
        expect(t!.language).toBe('en');
        expect(t!.postedDate).toBe('2022-06-06');
        expect(t!.deadline).toBe('2022-06-14');
        expect(t!.naicsCodes).toEqual([]);
        expect(t!.cpvCodes).toEqual([]);
        expect(t!.url).toMatch(/^https:\/\/www\.txsmartbuy\.gov\/esbd\?solicitationId=.+&search=1$/);
        expect(t!.description).toContain('BENCHTOP');
    });

    it('falls back to solicitationId when title is blank', async () => {
        const { toNormalizedTender } = await import('./handler');
        const t = toNormalizedTender({
            internalid: '1',
            title: '   ',
            solicitationId: 'TAMUK-ITB-3040',
            responseDue: '8/25/2021',
            responseTime: '2:00 PM',
            agencyNumber: '732',
            agencyName: 'Texas A&M University-Kingsville - 732',
            status: '5',
            statusName: 'Closed',
            postingDate: '8/11/2021',
            cancelledDate: '',
            created: '',
            lastModified: '',
            nigpCodes: '17553-Laboratory Equipment, General;',
            repostURL: '',
            url: '',
        } as any);
        expect(t).not.toBeNull();
        expect(t!.title).toBe('TAMUK-ITB-3040');
    });

    it('returns null when postingDate is unparseable', async () => {
        const { toNormalizedTender } = await import('./handler');
        expect(toNormalizedTender({
            internalid: '1', title: 'X', solicitationId: 'S1',
            responseDue: '', responseTime: '',
            agencyNumber: '711', agencyName: 'TAMU', status: '5', statusName: 'Closed',
            postingDate: '', cancelledDate: '', created: '', lastModified: '',
            nigpCodes: '', repostURL: '', url: '',
        } as any)).toBeNull();
    });

    it('handles missing deadline gracefully', async () => {
        const { toNormalizedTender } = await import('./handler');
        const t = toNormalizedTender({
            internalid: '1', title: 'Open RFP', solicitationId: 'TX-OPEN-1',
            responseDue: '', responseTime: '',
            agencyNumber: '711', agencyName: 'TAMU', status: '1', statusName: 'Posted',
            postingDate: '5/29/2026', cancelledDate: '', created: '', lastModified: '',
            nigpCodes: '', repostURL: '', url: '',
        } as any);
        expect(t).not.toBeNull();
        expect(t!.deadline).toBeNull();
        expect(t!.postedDate).toBe('2026-05-29');
    });
});

describe('harvestCookies', () => {
    it('builds Cookie header from set-cookie array', async () => {
        mockGetWithCookies();
        const { harvestCookies } = await import('./handler');
        const cookie = await harvestCookies();
        expect(cookie).toBe('JSESSIONID=abc123; NLVisitorId=xyz789; NS_VER=2026.1');
    });

    it('returns empty string when set-cookie header is missing', async () => {
        axiosGet.mockResolvedValue({ headers: {}, status: 200, data: '<html/>' });
        const { harvestCookies } = await import('./handler');
        expect(await harvestCookies()).toBe('');
    });
});

describe('searchEsbd', () => {
    it('POSTs the expected JSON body and returns lines', async () => {
        axiosPost.mockResolvedValueOnce({ data: fixture });
        const { searchEsbd } = await import('./handler');
        const lines = await searchEsbd('microscope', 'JSESSIONID=abc');

        expect(lines.length).toBe(24);
        expect(axiosPost).toHaveBeenCalledTimes(1);
        const call = axiosPost.mock.calls[0];
        expect(call[0]).toMatch(/ESBD\.Service\.ss/);
        const body = call[1];
        expect(body.keyword).toBe('microscope');
        expect(body.page).toBe(1);
        expect(body.recordsPerPage).toBe(24);
        const headers = call[2].headers;
        expect(headers.Cookie).toBe('JSESSIONID=abc');
        expect(headers['Content-Type']).toBe('application/json');
        expect(headers['X-Requested-With']).toBe('XMLHttpRequest');
    });

    it('retries on transient error and succeeds', async () => {
        axiosPost.mockRejectedValueOnce(new Error('ECONNRESET'));
        axiosPost.mockResolvedValueOnce({ data: fixture });
        const { searchEsbd } = await import('./handler');
        const lines = await searchEsbd('microscope', 'c=1');
        expect(lines.length).toBe(24);
        expect(axiosPost).toHaveBeenCalledTimes(2);
    });

    it('throws after MAX_RETRIES exhausted', async () => {
        axiosPost.mockRejectedValue(new Error('persistent network error'));
        const { searchEsbd } = await import('./handler');
        await expect(searchEsbd('microscope', 'c=1')).rejects.toThrow(/persistent network error/);
        expect(axiosPost).toHaveBeenCalledTimes(3);
    });
});

describe('fetch-txesbd handler', () => {
    it('fetches all keywords, dedups, stages to S3', async () => {
        mockGetWithCookies();
        axiosPost.mockResolvedValue({ data: fixture });    // same fixture for every keyword

        const { handler } = await import('./handler');
        const result = await handler({ executionId: 'exec-tx-1' });

        expect(result.source).toBe('txesbd');
        expect(result.stagedKey).toMatch(/tender-watch\/exec-tx-1\/fetch-txesbd\/output\.json/);
        // Each keyword returns the same 24 lines; dedup by solicitationId → 24 unique total.
        expect(result.fetched).toBe(24);
        // GET (cookies) + 10 keyword POSTs
        expect(axiosGet).toHaveBeenCalledTimes(1);
        expect(axiosPost).toHaveBeenCalledTimes(10);
        expect(s3Send).toHaveBeenCalledTimes(1);
    });

    it('continues on per-keyword failure (does not fail whole run)', async () => {
        mockGetWithCookies();
        // First keyword fails after retries, rest succeed
        axiosPost.mockRejectedValueOnce(new Error('boom'))
                 .mockRejectedValueOnce(new Error('boom'))
                 .mockRejectedValueOnce(new Error('boom'))
                 .mockResolvedValue({ data: fixture });

        const { handler } = await import('./handler');
        const result = await handler({ executionId: 'exec-tx-2' });

        expect(result.source).toBe('txesbd');
        expect(result.fetched).toBe(24);    // other 9 keywords still produced data
        expect(result.stagedKey).toMatch(/exec-tx-2/);
    });

    it('returns error output if cookie harvest fails completely', async () => {
        axiosGet.mockRejectedValue(new Error('upstream down'));
        const { handler } = await import('./handler');
        const result = await handler({ executionId: 'exec-tx-3' });
        expect(result.source).toBe('txesbd');
        expect(result.fetched).toBe(0);
        expect(result.stagedKey).toBe('');
        expect(result.error).toMatch(/upstream down/);
        expect(s3Send).not.toHaveBeenCalled();
    });
});
