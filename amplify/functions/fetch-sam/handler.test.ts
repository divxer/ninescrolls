import { describe, it, expect, vi, beforeEach } from 'vitest';
import fixture from './fixtures/sam-sample.json';

const axiosGet = vi.fn();
vi.mock('axios', () => ({ default: { get: axiosGet }, get: axiosGet }));

const ssmSend = vi.fn().mockResolvedValue({ Parameter: { Value: 'fake-key' } });
vi.mock('@aws-sdk/client-ssm', () => ({
    SSMClient: vi.fn().mockImplementation(() => ({ send: ssmSend })),
    GetParameterCommand: vi.fn().mockImplementation((args) => ({ __cmd: 'GetParameter', ...args })),
}));

const s3Send = vi.fn().mockResolvedValue({});
vi.mock('@aws-sdk/client-s3', () => ({
    S3Client: vi.fn().mockImplementation(() => ({ send: s3Send })),
    PutObjectCommand: vi.fn().mockImplementation((args) => ({ __cmd: 'PutObject', ...args })),
    GetObjectCommand: vi.fn().mockImplementation((args) => ({ __cmd: 'GetObject', ...args })),
}));

vi.stubEnv('STAGING_BUCKET', 'tender-watch-raw-test');
vi.stubEnv('SAM_API_KEY_PARAM', '/tender-watch/sam/api-key');

beforeEach(() => {
    axiosGet.mockReset();
    s3Send.mockClear();
});

describe('fetch-sam handler', () => {
    it('fetches, normalizes, and stages every opportunity', async () => {
        axiosGet.mockResolvedValueOnce({ data: fixture });
        const { handler } = await import('./handler');

        const result = await handler({ executionId: 'exec-1' });

        expect(result.source).toBe('sam');
        expect(result.fetched).toBe(2);
        expect(result.stagedKey).toMatch(/tender-watch\/exec-1\/fetch-sam\/output\.json/);

        const putCall = s3Send.mock.calls.find((c) => c[0].__cmd === 'PutObject');
        expect(putCall).toBeDefined();
        const body = JSON.parse(putCall![0].Body);
        expect(body).toHaveLength(2);
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

    it('returns fetched=0 and an error field when the SAM API rejects', async () => {
        axiosGet.mockRejectedValueOnce(new Error('upstream 503'));
        const { handler } = await import('./handler');

        const result = await handler({ executionId: 'exec-1' });

        expect(result.fetched).toBe(0);
        expect(result.error).toContain('upstream 503');
    });
});
