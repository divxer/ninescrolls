import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureHtml = readFileSync(join(__dirname, 'fixtures', 'nyscr-microscope.html'), 'utf-8');

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

describe('parseMDYY', () => {
    it('converts M/D/YYYY to ISO YYYY-MM-DD', async () => {
        const { parseMDYY } = await import('./handler');
        expect(parseMDYY('5/22/2026')).toBe('2026-05-22');
        expect(parseMDYY('12/31/2025')).toBe('2025-12-31');
    });

    it('returns null on malformed/missing input', async () => {
        const { parseMDYY } = await import('./handler');
        expect(parseMDYY('')).toBeNull();
        expect(parseMDYY(null as any)).toBeNull();
        expect(parseMDYY(undefined as any)).toBeNull();
        expect(parseMDYY('not a date')).toBeNull();
    });
});

describe('parseNyscrHtml', () => {
    it('extracts both microscope rows from the real fixture', async () => {
        const { parseNyscrHtml } = await import('./handler');
        const rows = parseNyscrHtml(fixtureHtml);
        expect(rows.length).toBe(2);

        const flu = rows.find(r => r.title.includes('Fluorescence'));
        expect(flu).toBeDefined();
        expect(flu!.cr).toBe('2135447');
        expect(flu!.title).toBe('Fluorescence Microscope');
        expect(flu!.agency).toBe('State University of New York (SUNY)');
        expect(flu!.division).toBe('SUNY Binghamton');
        expect(flu!.issueDate).toBe('5/22/2026');
        expect(flu!.dueDate).toBe('6/15/2026');
        expect(flu!.location).toBe('Binghamton University School of Pharmacy');
        expect(flu!.category).toBe('Medical & Laboratory Equipment');
        expect(flu!.adType).toBe('General');

        const zeiss = rows.find(r => r.title.includes('Zeiss'));
        expect(zeiss).toBeDefined();
        expect(zeiss!.cr).toBe('2135248');
        expect(zeiss!.agency).toContain('Erie County');
        expect(zeiss!.adType).toMatch(/sole|single source/i);
    });

    it('returns empty array on a page with no cards', async () => {
        const { parseNyscrHtml } = await import('./handler');
        expect(parseNyscrHtml('<html><body><p>no results</p></body></html>')).toEqual([]);
    });
});

describe('toNormalizedTender', () => {
    it('emits valid NormalizedTender from a parsed row', async () => {
        const { toNormalizedTender, parseNyscrHtml } = await import('./handler');
        const rows = parseNyscrHtml(fixtureHtml);
        const flu = rows.find(r => r.title.includes('Fluorescence'))!;
        const t = toNormalizedTender(flu);

        expect(t).not.toBeNull();
        expect(t!.source).toBe('nyscr');
        expect(t!.externalId).toBe('2135447');
        expect(t!.title).toBe('Fluorescence Microscope');
        expect(t!.agency).toBe('State University of New York (SUNY) / SUNY Binghamton');
        expect(t!.country).toBe('US');
        expect(t!.language).toBe('en');
        expect(t!.postedDate).toBe('2026-05-22');
        expect(t!.deadline).toBe('2026-06-15');
        expect(t!.naicsCodes).toEqual([]);
        expect(t!.cpvCodes).toEqual([]);
        expect(t!.description).toContain('Fluorescence Microscope');
        expect(t!.description).toContain('Medical & Laboratory Equipment');
        expect(t!.url).toMatch(/^https:\/\/www\.nyscr\.ny\.gov\/Ads\/Search\?Status=Open&Keyword=2135447$/);
    });

    it('returns null when issue date is unparseable', async () => {
        const { toNormalizedTender } = await import('./handler');
        expect(toNormalizedTender({
            cr: 'X', title: 'T',
            agency: null, division: null,
            issueDate: '', dueDate: null,
            location: null, category: null, adType: null,
        })).toBeNull();
    });

    it('falls back to a sensible agency when both agency and division are blank', async () => {
        const { toNormalizedTender } = await import('./handler');
        const t = toNormalizedTender({
            cr: 'Y1', title: 'Mystery RFP',
            agency: null, division: null,
            issueDate: '5/29/2026', dueDate: null,
            location: null, category: null, adType: null,
        });
        expect(t).not.toBeNull();
        expect(t!.agency).toBeTruthy();
    });
});

describe('searchNyscr', () => {
    it('GETs the NYSCR search URL with expected params and parses rows', async () => {
        axiosGet.mockResolvedValueOnce({ data: fixtureHtml });
        const { searchNyscr } = await import('./handler');
        const rows = await searchNyscr('microscope');
        expect(rows.length).toBe(2);

        expect(axiosGet).toHaveBeenCalledTimes(1);
        const call = axiosGet.mock.calls[0];
        expect(call[0]).toBe('https://www.nyscr.ny.gov/Ads/Search');
        const cfg = call[1];
        expect(cfg.params.Status).toBe('Open');
        expect(cfg.params.Keyword).toBe('microscope');
        expect(cfg.params.Sort).toBe('-DateIssued');
        expect(cfg.params.Top).toBe(25);
    });

    it('retries on transient error and succeeds on the next attempt', async () => {
        axiosGet.mockRejectedValueOnce(new Error('ECONNRESET'));
        axiosGet.mockResolvedValueOnce({ data: fixtureHtml });
        const { searchNyscr } = await import('./handler');
        const rows = await searchNyscr('microscope');
        expect(rows.length).toBe(2);
        expect(axiosGet).toHaveBeenCalledTimes(2);
    });

    it('throws after retries are exhausted', async () => {
        axiosGet.mockRejectedValue(new Error('persistent network error'));
        const { searchNyscr } = await import('./handler');
        await expect(searchNyscr('microscope')).rejects.toThrow(/persistent network error/);
        expect(axiosGet).toHaveBeenCalledTimes(3);
    });
});

describe('fetch-nyscr handler', () => {
    it('fetches all keywords, dedups by CR#, stages to S3', async () => {
        axiosGet.mockResolvedValue({ data: fixtureHtml });
        const { handler } = await import('./handler');
        const result = await handler({ executionId: 'exec-nys-1' });

        expect(result.source).toBe('nyscr');
        expect(result.stagedKey).toMatch(/tender-watch\/exec-nys-1\/fetch-nyscr\/output\.json/);
        // Each of 10 keywords returns the same 2 rows; dedup by CR# → 2 unique total.
        expect(result.fetched).toBe(2);
        expect(axiosGet).toHaveBeenCalledTimes(10);
        expect(s3Send).toHaveBeenCalledTimes(1);
    });

    it('continues on per-keyword failure', async () => {
        // First keyword fails all 3 retries; rest succeed.
        axiosGet.mockRejectedValueOnce(new Error('boom'))
                .mockRejectedValueOnce(new Error('boom'))
                .mockRejectedValueOnce(new Error('boom'))
                .mockResolvedValue({ data: fixtureHtml });
        const { handler } = await import('./handler');
        const result = await handler({ executionId: 'exec-nys-2' });
        expect(result.source).toBe('nyscr');
        expect(result.fetched).toBe(2);
    });
});
