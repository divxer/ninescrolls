import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NormalizedTender } from '../../lib/tender-watch/types';

const mockQuery = vi.fn();
const mockPut = vi.fn();
vi.mock('@aws-sdk/client-dynamodb', () => ({
    DynamoDBClient: vi.fn().mockImplementation(() => ({})),
}));
vi.mock('@aws-sdk/lib-dynamodb', () => ({
    DynamoDBDocumentClient: {
        from: vi.fn().mockReturnValue({
            send: vi.fn().mockImplementation((cmd: any) => {
                const name = cmd.constructor.name;
                if (name === 'QueryCommand') return mockQuery(cmd);
                if (name === 'PutCommand') return mockPut(cmd);
                return Promise.resolve({});
            }),
        }),
    },
    QueryCommand: class { input: any; constructor(input: any) { this.input = input; } },
    PutCommand: class { input: any; constructor(input: any) { this.input = input; } },
}));

const s3Get = vi.fn();
vi.mock('@aws-sdk/client-s3', () => ({
    S3Client: vi.fn().mockImplementation(() => ({
        send: vi.fn().mockImplementation((cmd: any) => {
            if (cmd.constructor.name === 'GetObjectCommand') return s3Get(cmd);
            return Promise.resolve({});
        }),
    })),
    GetObjectCommand: class { input: any; constructor(input: any) { this.input = input; } },
    PutObjectCommand: class { input: any; constructor(input: any) { this.input = input; } },
}));

vi.stubEnv('INTELLIGENCE_TABLE', 'NineScrollsIntelligence');
vi.stubEnv('STAGING_BUCKET', 'tender-watch-raw-test');

beforeEach(() => {
    mockQuery.mockReset();
    mockPut.mockReset();
    s3Get.mockReset();
});

function makeTender(externalId: string, source: 'sam' | 'ted', title: string): NormalizedTender {
    return {
        source,
        externalId,
        url: `https://example.com/${externalId}`,
        title,
        agency: 'Test Agency',
        country: source === 'sam' ? 'US' : 'DE',
        language: 'en',
        description: 'desc',
        postedDate: '2026-05-12',
        deadline: '2026-08-15',
        naicsCodes: [],
        cpvCodes: [],
        rawPayload: {},
    };
}

function s3JsonBody(payload: unknown) {
    const text = JSON.stringify(payload);
    return { Body: { transformToString: vi.fn().mockResolvedValue(text) } };
}

describe('normalize-dedupe handler', () => {
    it('writes new tenders and skips duplicates by sourceTenderHash', async () => {
        s3Get.mockResolvedValueOnce(s3JsonBody([makeTender('111', 'sam', 'PECVD System')]));
        s3Get.mockResolvedValueOnce(s3JsonBody([makeTender('222', 'ted', 'PECVD System')]));

        // First tender: hash not in DDB. Second tender: hash already present (same title+agency+deadline → same hash).
        mockQuery
            .mockResolvedValueOnce({ Items: [] })
            .mockResolvedValueOnce({ Items: [{ PK: 'TENDER#sam-111' }] });

        mockPut.mockResolvedValue({});

        const { handler } = await import('./handler');
        const result = await handler({
            executionId: 'exec-3',
            fetchOutputs: [
                { source: 'sam', stagedKey: 'k1', fetched: 1 },
                { source: 'ted', stagedKey: 'k2', fetched: 1 },
            ],
        });

        expect(result.newTenderIds).toEqual(['sam-111']);
        expect(result.skipped).toBe(1);
        expect(mockPut).toHaveBeenCalledTimes(1);
        const putItem = mockPut.mock.calls[0][0].input.Item;
        expect(putItem.PK).toBe('TENDER#sam-111');
        expect(putItem.SK).toBe('METADATA');
        expect(putItem.GSI1PK).toBe('TENDER_STATUS#new');
        expect(putItem.GSI2PK).toMatch(/^TENDER_HASH#/);
        expect(putItem.status).toBe('new');
        expect(putItem.overallScore).toBe(0);
        expect(putItem.isHighPriority).toBe(false);
    });

    it('ignores fetch outputs with fetched=0', async () => {
        const { handler } = await import('./handler');
        const result = await handler({
            executionId: 'exec-3',
            fetchOutputs: [
                { source: 'sam', stagedKey: '', fetched: 0, error: 'upstream' },
                { source: 'ted', stagedKey: '', fetched: 0 },
            ],
        });
        expect(result.newTenderIds).toEqual([]);
        expect(s3Get).not.toHaveBeenCalled();
    });
});
