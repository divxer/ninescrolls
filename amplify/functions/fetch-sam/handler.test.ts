import { describe, it, expect, vi, beforeEach } from 'vitest';
import fixture from './fixtures/sam-sample.json';

const axiosGet = vi.fn();
vi.mock('axios', () => ({ default: { get: axiosGet }, get: axiosGet }));

const s3Send = vi.fn().mockResolvedValue({});
vi.mock('@aws-sdk/client-s3', () => ({
    S3Client: vi.fn().mockImplementation(() => ({ send: s3Send })),
    PutObjectCommand: vi.fn().mockImplementation((args) => ({ __cmd: 'PutObject', ...args })),
    GetObjectCommand: vi.fn().mockImplementation((args) => ({ __cmd: 'GetObject', ...args })),
}));

vi.stubEnv('STAGING_BUCKET', 'tender-watch-raw-test');
vi.stubEnv('SAM_API_KEY', 'fake-test-key');

beforeEach(() => {
    axiosGet.mockReset();
    s3Send.mockClear();
});

// Match the array in handler.ts — keep these in sync.
const NAICS_WHITELIST = ['334516', '334519', '333242', '541380'];

describe('fetch-sam handler', () => {
    it('fetches once per NAICS code in NAICS_WHITELIST (NOT comma-separated)', async () => {
        // Return the same fixture for every call (any duplicates are deduped by noticeId).
        axiosGet.mockResolvedValue({ data: fixture });
        const { handler } = await import('./handler');

        await handler({ executionId: 'exec-1' });

        // One call per NAICS in the whitelist.
        expect(axiosGet).toHaveBeenCalledTimes(NAICS_WHITELIST.length);
        for (let i = 0; i < NAICS_WHITELIST.length; i++) {
            const call = axiosGet.mock.calls[i];
            expect(call[0]).toBe('https://api.sam.gov/opportunities/v2/search');
            expect(call[1].params.ncode).toBe(NAICS_WHITELIST[i]);
            expect(typeof call[1].params.ncode).toBe('string');
            // CRITICAL: never re-introduce comma-separated ncode (SAM API rejects it).
            expect(call[1].params.ncode).not.toContain(',');
        }
    });

    it('dedupes noticeIds across NAICS iterations (single opp tagged with multiple NAICS)', async () => {
        // Same fixture (2 opportunities) returned 4 times — one per NAICS.
        axiosGet.mockResolvedValue({ data: fixture });
        const { handler } = await import('./handler');

        const result = await handler({ executionId: 'exec-1' });

        // Only the PECVD entry passes the filter (HVAC contract has type and active set but no
        // semiconductor relevance — the filter only screens on active+type, so both pass through
        // here and the result count is 2). What matters is no duplicates across iterations.
        expect(result.fetched).toBe(2);

        const putCall = s3Send.mock.calls.find((c) => c[0].__cmd === 'PutObject');
        expect(putCall).toBeDefined();
        const body = JSON.parse(putCall![0].Body);

        const noticeIds = body.map((b: { externalId: string }) => b.externalId);
        const uniqueIds = new Set(noticeIds);
        expect(uniqueIds.size).toBe(noticeIds.length);
    });

    it('normalizes the first opportunity to the expected shape', async () => {
        axiosGet.mockResolvedValue({ data: fixture });
        const { handler } = await import('./handler');

        await handler({ executionId: 'exec-1' });

        const putCall = s3Send.mock.calls.find((c) => c[0].__cmd === 'PutObject');
        const body = JSON.parse(putCall![0].Body);
        expect(body[0]).toMatchObject({
            source: 'sam',
            externalId: 'abcdef01234567890',
            title: 'PECVD Deposition System for University Cleanroom',
            country: 'US',
            language: 'en',
            postedDate: '2026-05-10',
            deadline: '2026-08-15',
            naicsCodes: ['334516'],
            cpvCodes: [],
        });
    });

    it('retries on transient 5xx and succeeds on the second attempt', async () => {
        const err = Object.assign(new Error('upstream 503'), { response: { status: 503 } });
        // First call rejects 503, every subsequent call resolves with the fixture.
        // Across 4 NAICS we expect: 1 fail + 1 retry-succeed + 3 first-try-succeed = 5 total.
        axiosGet.mockRejectedValueOnce(err).mockResolvedValue({ data: fixture });
        const { handler } = await import('./handler');

        const result = await handler({ executionId: 'exec-1' });

        // Retry kicks in on the first NAICS, succeeds on the second try, then 3 more NAICS succeed first-try.
        expect(axiosGet).toHaveBeenCalledTimes(NAICS_WHITELIST.length + 1);
        expect(result.error).toBeUndefined();
        expect(result.fetched).toBeGreaterThan(0);
    });

    it('returns fetched=0 with an error when SAM API rejects with non-retryable error', async () => {
        const err = Object.assign(new Error('upstream 400'), { response: { status: 400 } });
        axiosGet.mockRejectedValue(err);
        const { handler } = await import('./handler');

        const result = await handler({ executionId: 'exec-1' });

        expect(result.fetched).toBe(0);
        expect(result.error).toContain('upstream 400');
    });

    it('returns fetched=0 with an error when retries are exhausted on 5xx', async () => {
        const err = Object.assign(new Error('upstream 503'), { response: { status: 503 } });
        axiosGet.mockRejectedValue(err);
        const { handler } = await import('./handler');

        const result = await handler({ executionId: 'exec-1' });

        expect(result.fetched).toBe(0);
        expect(result.error).toContain('upstream 503');
        // 3 attempts on the first NAICS, then handler bails out.
        expect(axiosGet).toHaveBeenCalledTimes(3);
    });
});
