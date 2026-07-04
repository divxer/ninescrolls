import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureHtml = readFileSync(
    join(__dirname, 'fixtures', 'uwisc-spectrometer.html'),
    'utf-8',
);

const axiosGet = vi.fn();
vi.mock('axios', () => ({ default: { get: axiosGet }, get: axiosGet }));

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
    s3Send.mockClear();
});

describe('parseUwiscDate', () => {
    it('converts M/D/YYYY (with optional time/TZ) to ISO YYYY-MM-DD', async () => {
        const { parseUwiscDate } = await import('./handler');
        expect(parseUwiscDate('3/5/2026 9:00 AM CST')).toBe('2026-03-05');
        expect(parseUwiscDate('12/31/2025 4:00 PM CDT')).toBe('2025-12-31');
        expect(parseUwiscDate('1/1/2023')).toBe('2023-01-01');
    });

    it('returns null on malformed or missing input', async () => {
        const { parseUwiscDate } = await import('./handler');
        expect(parseUwiscDate('')).toBeNull();
        expect(parseUwiscDate(null)).toBeNull();
        expect(parseUwiscDate(undefined)).toBeNull();
        expect(parseUwiscDate('not a date')).toBeNull();
    });
});

describe('extractBusinessUnit', () => {
    it('extracts the campus code from a bid number', async () => {
        const { extractBusinessUnit } = await import('./handler');
        expect(extractBusinessUnit('2026-UWMSN-01294-RFB')).toBe('UWMSN');
        expect(extractBusinessUnit('2023-UWEAU-00270-RFB')).toBe('UWEAU');
        expect(extractBusinessUnit('2026-UWWTW-01281-RFB')).toBe('UWWTW');
    });

    it('returns null for numbers that do not match the pattern', async () => {
        const { extractBusinessUnit } = await import('./handler');
        expect(extractBusinessUnit('bogus')).toBeNull();
        expect(extractBusinessUnit('UWMSN-01294')).toBeNull();
    });
});

describe('uwiscDeepLink', () => {
    it('builds a public-search deep link using the bid number as keyword', async () => {
        const { uwiscDeepLink } = await import('./handler');
        const url = uwiscDeepLink('2026-UWMSN-01294-RFB');
        expect(url).toContain('bids.sciquest.com/apps/Router/PublicEvent');
        expect(url).toContain('CustomerOrg=UWisconsin');
        expect(url).toContain('tab=PHX_NAV_SourcingAllOpps');
        expect(url).toContain('SimpleSearch_Keyword=2026-UWMSN-01294-RFB');
    });
});

describe('parseUwiscHtml', () => {
    it('extracts the ICP-OES row + several spectrometer siblings from the real fixture', async () => {
        const { parseUwiscHtml } = await import('./handler');
        const rows = parseUwiscHtml(fixtureHtml);

        expect(rows.length).toBeGreaterThanOrEqual(3);

        const icp = rows.find(r => r.title.includes('INDUCTIVELY COUPLED PLASMA'));
        expect(icp).toBeDefined();
        expect(icp!.number).toBe('2026-UWWTW-01281-RFB');
        expect(icp!.type).toBe('RFB');
        expect(icp!.openDate).toContain('3/5/2026');
        expect(icp!.closeDate).toContain('3/20/2026');
        expect(icp!.contactEmail).toBe('DrakeT11@uww.edu');
        expect(icp!.status).toMatch(/awarded/i);
    });

    it('returns an empty array when the HTML has no result cards', async () => {
        const { parseUwiscHtml } = await import('./handler');
        const empty =
            '<html><body><div>No Events have upcoming key dates</div></body></html>';
        expect(parseUwiscHtml(empty)).toEqual([]);
    });
});

describe('toNormalizedTender', () => {
    it('maps a real ICP-OES row into a valid NormalizedTender', async () => {
        const { parseUwiscHtml, toNormalizedTender } = await import('./handler');
        const rows = parseUwiscHtml(fixtureHtml);
        const icp = rows.find(r => r.title.includes('INDUCTIVELY COUPLED PLASMA'))!;
        const t = toNormalizedTender(icp);

        expect(t).not.toBeNull();
        expect(t!.source).toBe('uwisc');
        expect(t!.externalId).toBe('2026-UWWTW-01281-RFB');
        expect(t!.agency).toContain('UW-Whitewater');
        expect(t!.country).toBe('US');
        expect(t!.language).toBe('en');
        expect(t!.postedDate).toBe('2026-03-05');
        expect(t!.deadline).toBe('2026-03-20');
        expect(t!.naicsCodes).toEqual([]);
        expect(t!.cpvCodes).toEqual([]);
        expect(t!.url).toContain('SimpleSearch_Keyword=2026-UWWTW-01281-RFB');
        expect(t!.description).toContain('INDUCTIVELY');
    });

    it('returns null when the openDate is unparseable', async () => {
        const { toNormalizedTender } = await import('./handler');
        expect(
            toNormalizedTender({
                title: 'x',
                description: null,
                number: '2026-UWMSN-01001-RFB',
                type: 'RFB',
                openDate: null,
                closeDate: null,
                status: null,
                contactName: null,
                contactEmail: null,
            }),
        ).toBeNull();
    });

    it('falls back to "UW System" when the bid number has an unknown BU code', async () => {
        const { toNormalizedTender } = await import('./handler');
        const t = toNormalizedTender({
            title: 'Something Weird',
            description: 'test',
            number: '2027-ZZZBU-99999-RFB',
            type: 'RFB',
            openDate: '5/1/2027',
            closeDate: '5/15/2027',
            status: 'Open',
            contactName: 'Test',
            contactEmail: 'test@wisc.edu',
        });
        expect(t).not.toBeNull();
        expect(t!.agency).toContain('UW System (ZZZBU)');
    });
});

describe('searchUwisc', () => {
    it('GETs the SciQuest search URL with expected params and parses rows', async () => {
        axiosGet.mockResolvedValueOnce({ data: fixtureHtml });
        const { searchUwisc } = await import('./handler');
        const rows = await searchUwisc('spectrometer');
        expect(rows.length).toBeGreaterThanOrEqual(3);

        const call = axiosGet.mock.calls[0];
        expect(call[0]).toBe('https://bids.sciquest.com/apps/Router/PublicEvent');
        expect(call[1].params.CustomerOrg).toBe('UWisconsin');
        expect(call[1].params.tab).toBe('PHX_NAV_SourcingAllOpps');
        expect(call[1].params.SimpleSearch_Keyword).toBe('spectrometer');
        expect(call[1].headers['User-Agent']).toMatch(/Chrome/);
    });

    it('retries on transient error and succeeds on the next attempt', async () => {
        axiosGet.mockRejectedValueOnce(new Error('ECONNRESET'));
        axiosGet.mockResolvedValueOnce({ data: fixtureHtml });
        const { searchUwisc } = await import('./handler');
        const rows = await searchUwisc('spectrometer');
        expect(rows.length).toBeGreaterThanOrEqual(3);
        expect(axiosGet).toHaveBeenCalledTimes(2);
    });

    it('throws after all retries are exhausted', async () => {
        axiosGet.mockRejectedValue(new Error('persistent network error'));
        const { searchUwisc } = await import('./handler');
        await expect(searchUwisc('spectrometer')).rejects.toThrow(/persistent network error/);
        expect(axiosGet).toHaveBeenCalledTimes(3);
    });
});

describe('fetch-uwisc handler', () => {
    it('runs all keywords in parallel, dedups, and stages to S3', async () => {
        axiosGet.mockResolvedValue({ data: fixtureHtml });
        const { handler, UWISC_KEYWORDS } = await import('./handler');

        const result = await handler({ executionId: 'exec-uwisc-1' });

        expect(result.source).toBe('uwisc');
        expect(result.stagedKey).toMatch(/tender-watch\/exec-uwisc-1\/fetch-uwisc\/output\.json/);
        // Each keyword returns the same fixture (>=3 unique rows) — dedup by number
        // means final count equals the fixture's unique row count, not
        // (rowsPerKeyword × keywordCount).
        expect(result.fetched).toBeGreaterThanOrEqual(3);
        expect(axiosGet).toHaveBeenCalledTimes(UWISC_KEYWORDS.length);
        expect(s3Send).toHaveBeenCalledTimes(1);
    });

    it('tolerates per-keyword failures — one bad keyword does not fail the run', async () => {
        axiosGet
            .mockRejectedValueOnce(new Error('boom'))
            .mockRejectedValueOnce(new Error('boom'))
            .mockRejectedValueOnce(new Error('boom'))
            .mockResolvedValue({ data: fixtureHtml });
        const { handler } = await import('./handler');
        const result = await handler({ executionId: 'exec-uwisc-2' });
        expect(result.source).toBe('uwisc');
        expect(result.fetched).toBeGreaterThanOrEqual(3);
        expect(result.error).toBeUndefined();
    });
});
