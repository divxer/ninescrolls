import { describe, it, expect, vi, beforeEach } from 'vitest';
import fixture from './fixtures/ted-sample.json';

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

// Speed up retry delays in tests so the suite stays fast — the production
// helper sleeps 1s + 2s between attempts. Replace it with a no-op for tests.
vi.mock('node:timers/promises', async () => ({ setTimeout: async () => {} }));
// The handler uses a local sleep() that wraps global setTimeout — we monkey
// patch global setTimeout to fire immediately, so retries don't actually wait.
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

describe('fetch-ted handler', () => {
    it('fetches CPV-filtered notices and normalizes them', async () => {
        axiosPost.mockResolvedValueOnce({ data: fixture });
        const { handler } = await import('./handler');

        const result = await handler({ executionId: 'exec-2' });

        expect(result.source).toBe('ted');
        expect(result.fetched).toBe(2);

        const putCall = s3Send.mock.calls.find((c) => c[0].__cmd === 'PutObject');
        const body = JSON.parse(putCall![0].Body);
        expect(body[0]).toMatchObject({
            source: 'ted',
            externalId: 'TED-2026-100001',
            title: 'Atomic Layer Deposition system for nanoelectronics research',
            country: 'DE',
            language: 'en',
            postedDate: '2026-05-12',
            deadline: '2026-08-30',
            cpvCodes: ['38540000', '38500000'],
            naicsCodes: [],
            estimatedValue: { amount: 480000, currency: 'EUR' },
        });
    });

    it('retries transient 5xx then succeeds on a subsequent attempt', async () => {
        const transient = Object.assign(new Error('upstream 503'), { response: { status: 503 } });
        axiosPost
            .mockRejectedValueOnce(transient)
            .mockRejectedValueOnce(transient)
            .mockResolvedValueOnce({ data: fixture });
        const { handler } = await import('./handler');

        const result = await handler({ executionId: 'exec-2' });

        expect(axiosPost).toHaveBeenCalledTimes(3);
        expect(result.fetched).toBe(2);
        expect(result.error).toBeUndefined();
    });

    it('does NOT retry non-retryable 4xx errors', async () => {
        const clientErr = Object.assign(new Error('bad request'), { response: { status: 400 } });
        axiosPost.mockRejectedValueOnce(clientErr);
        const { handler } = await import('./handler');

        const result = await handler({ executionId: 'exec-2' });

        expect(axiosPost).toHaveBeenCalledTimes(1);
        expect(result.fetched).toBe(0);
        expect(result.error).toContain('bad request');
    });

    it('returns fetched=0 + error after exhausting retries on persistent failure', async () => {
        const transient = Object.assign(new Error('upstream timeout'), { response: { status: 504 } });
        axiosPost.mockRejectedValue(transient);
        const { handler } = await import('./handler');

        const result = await handler({ executionId: 'exec-2' });

        expect(axiosPost).toHaveBeenCalledTimes(3); // MAX_RETRIES_PER_PAGE
        expect(result.fetched).toBe(0);
        expect(result.error).toContain('upstream timeout');
    });

    it('treats network errors (no .response) as retryable', async () => {
        const networkErr = new Error('ECONNRESET'); // no .response → status undefined
        axiosPost
            .mockRejectedValueOnce(networkErr)
            .mockResolvedValueOnce({ data: fixture });
        const { handler } = await import('./handler');

        const result = await handler({ executionId: 'exec-2' });

        expect(axiosPost).toHaveBeenCalledTimes(2);
        expect(result.fetched).toBe(2);
    });
});
