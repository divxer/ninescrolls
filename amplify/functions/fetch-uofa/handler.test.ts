import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureHtml = readFileSync(join(__dirname, 'fixtures', 'uofa-open-2026-05.html'), 'utf-8');

const axiosGet = vi.fn();
vi.mock('axios', () => ({ default: { get: axiosGet }, get: axiosGet }));

const s3Send = vi.fn().mockResolvedValue({});
vi.mock('@aws-sdk/client-s3', () => ({
    S3Client: vi.fn().mockImplementation(() => ({ send: s3Send })),
    PutObjectCommand: vi.fn().mockImplementation((args) => ({ __cmd: 'PutObject', ...args })),
}));

vi.stubEnv('STAGING_BUCKET', 'tender-watch-raw-test');

// Patch setTimeout so retry backoffs fire immediately in tests.
const originalSetTimeout = globalThis.setTimeout;
globalThis.setTimeout = ((fn: () => void) => {
    fn();
    return 0 as unknown as ReturnType<typeof originalSetTimeout>;
}) as typeof globalThis.setTimeout;

beforeEach(() => {
    axiosGet.mockReset();
    s3Send.mockClear();
});

describe('parseUofaHtml', () => {
    it('extracts all bid rows with expected fields', async () => {
        const { parseUofaHtml } = await import('./handler');
        const rows = parseUofaHtml(fixtureHtml);

        expect(rows.length).toBe(3);

        const byId = Object.fromEntries(rows.map(r => [r.externalId, r]));

        expect(byId['L342602'].title).toMatch(/Water Treatment Program/i);
        expect(byId['L342602'].closeDateIso).toBe('2026-06-23T21:30:00Z');
        expect(byId['L342602'].contactName).toBe('Rocio Torres');
        expect(byId['L342602'].contactEmail).toBe('rociotorres@arizona.edu');
        expect(byId['L342602'].documentUrl).toMatch(/^https:\/\/vendors\.arizona\.edu\/sites\/default\/files\/.+\.pdf$/);

        expect(byId['L252601'].title).toMatch(/Search Firms/i);
        expect(byId['L252601'].closeDateIso).toBe('2026-06-03T21:00:00Z');
        expect(byId['L252601'].contactName).toBe('Jessica Padilla');

        expect(byId['L192611'].title).toMatch(/Brand Strategy and Creative Development/i);
        expect(byId['L192611'].contactName).toBe('Celeste Kanzig');
    });

    it('returns empty array on a page with no bid rows', async () => {
        const { parseUofaHtml } = await import('./handler');
        expect(parseUofaHtml('<html><body><p>No bids</p></body></html>')).toEqual([]);
    });
});

describe('toNormalizedTender', () => {
    it('emits a valid NormalizedTender from a parsed row', async () => {
        const { toNormalizedTender } = await import('./handler');
        const t = toNormalizedTender({
            externalId: 'L342602',
            title: 'Request for Proposals for a Water Treatment Program',
            documentUrl: 'https://vendors.arizona.edu/sites/default/files/2026-05/RFP.pdf',
            contactName: 'Rocio Torres',
            contactEmail: 'rociotorres@arizona.edu',
            closeDateIso: '2026-06-23T21:30:00Z',
        }, new Date('2026-05-30T12:00:00Z'));

        expect(t).not.toBeNull();
        expect(t!.source).toBe('uofa');
        expect(t!.externalId).toBe('L342602');
        expect(t!.country).toBe('US');
        expect(t!.language).toBe('en');
        expect(t!.agency).toBe('University of Arizona');
        expect(t!.postedDate).toBe('2026-05-30');
        expect(t!.deadline).toBe('2026-06-23');
        expect(t!.naicsCodes).toEqual([]);
        expect(t!.cpvCodes).toEqual([]);
        expect(t!.url).toMatch(/^https:\/\/vendors\.arizona\.edu\/sites\//);
    });

    it('falls back to listing-page URL when no document link is present', async () => {
        const { toNormalizedTender } = await import('./handler');
        const t = toNormalizedTender({
            externalId: 'X1',
            title: 'A bid',
            documentUrl: null,
            contactName: null,
            contactEmail: null,
            closeDateIso: null,
        }, new Date('2026-05-30T12:00:00Z'));

        expect(t).not.toBeNull();
        expect(t!.url).toBe('https://vendors.arizona.edu/rfpb-opportunities');
        expect(t!.deadline).toBeNull();
    });

    it('returns null when title is empty (Zod validation fails)', async () => {
        const { toNormalizedTender } = await import('./handler');
        const t = toNormalizedTender({
            externalId: 'X2',
            title: '',
            documentUrl: null,
            contactName: null,
            contactEmail: null,
            closeDateIso: null,
        }, new Date('2026-05-30T12:00:00Z'));
        expect(t).toBeNull();
    });
});

describe('fetch-uofa handler', () => {
    it('fetches HTML, parses bids, stages to S3, and returns FetchOutput', async () => {
        axiosGet.mockResolvedValueOnce({ data: fixtureHtml });
        const { handler } = await import('./handler');

        const result = await handler({ executionId: 'exec-uofa-1' });

        expect(result.source).toBe('uofa');
        expect(result.fetched).toBe(3);
        expect(result.stagedKey).toMatch(/tender-watch\/exec-uofa-1\/fetch-uofa\/output\.json/);
        expect(s3Send).toHaveBeenCalledTimes(1);
    });

    it('returns error output when all retries fail', async () => {
        axiosGet.mockRejectedValue(new Error('network down'));
        const { handler } = await import('./handler');

        const result = await handler({ executionId: 'exec-uofa-2' });

        expect(result.source).toBe('uofa');
        expect(result.fetched).toBe(0);
        expect(result.stagedKey).toBe('');
        expect(result.error).toMatch(/network down/);
        expect(s3Send).not.toHaveBeenCalled();
    });
});
