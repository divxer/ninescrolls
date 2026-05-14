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
            language: 'de',
            postedDate: '2026-05-12',
            deadline: '2026-08-30',
            cpvCodes: ['38540000', '38500000'],
            naicsCodes: [],
            estimatedValue: { amount: 480000, currency: 'EUR' },
        });
    });

    it('returns fetched=0 + error on upstream failure', async () => {
        axiosPost.mockRejectedValueOnce(new Error('timeout'));
        const { handler } = await import('./handler');
        const result = await handler({ executionId: 'exec-2' });
        expect(result.fetched).toBe(0);
        expect(result.error).toContain('timeout');
    });
});
