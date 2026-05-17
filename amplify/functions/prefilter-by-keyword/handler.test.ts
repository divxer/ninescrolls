import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockQuery = vi.fn();
const mockBatchGet = vi.fn();
vi.mock('@aws-sdk/client-dynamodb', () => ({
    DynamoDBClient: vi.fn().mockImplementation(() => ({})),
}));
vi.mock('@aws-sdk/lib-dynamodb', () => ({
    DynamoDBDocumentClient: {
        from: vi.fn().mockReturnValue({
            send: vi.fn().mockImplementation((cmd: any) => {
                const n = cmd.constructor.name;
                if (n === 'QueryCommand') return mockQuery(cmd);
                if (n === 'BatchGetCommand') return mockBatchGet(cmd);
                return Promise.resolve({});
            }),
        }),
    },
    QueryCommand: class { input: any; constructor(input: any) { this.input = input; } },
    BatchGetCommand: class { input: any; constructor(input: any) { this.input = input; } },
}));

vi.stubEnv('INTELLIGENCE_TABLE', 'NineScrollsIntelligence');

beforeEach(() => {
    mockQuery.mockReset();
    mockBatchGet.mockReset();
});

describe('prefilter-by-keyword handler', () => {
    it('returns only tenders that pass at least one config', async () => {
        mockQuery.mockResolvedValueOnce({
            Items: [
                {
                    productCategory: 'PECVD',
                    productSlugs: ['pluto-f'],
                    keywords: ['PECVD'],
                    synonyms: [],
                    blacklist: [],
                    naicsCodes: ['334516'],
                    cpvCodes: [],
                    isActive: true,
                },
            ],
        });
        mockBatchGet.mockResolvedValueOnce({
            Responses: {
                NineScrollsIntelligence: [
                    { tenderId: 'sam-1', title: 'PECVD System', description: '', naicsCodes: ['334516'], cpvCodes: [] },
                    { tenderId: 'sam-2', title: 'HVAC Service Contract', description: '', naicsCodes: ['238220'], cpvCodes: [] },
                ],
            },
        });

        const { handler } = await import('./handler');
        const result = await handler({ newTenderIds: ['sam-1', 'sam-2'] });

        expect(result.candidates).toHaveLength(1);
        expect(result.candidatesCount).toBe(1);
        expect(result.candidates[0].tenderId).toBe('sam-1');
        expect(result.candidates[0].matchedKeywords).toContain('PECVD');
    });

    it('returns empty candidates when there are no new tenders', async () => {
        const { handler } = await import('./handler');
        const result = await handler({ newTenderIds: [] });
        expect(result.candidates).toEqual([]);
        expect(result.candidatesCount).toBe(0);
    });
});
