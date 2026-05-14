import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGet = vi.fn();
const mockUpdate = vi.fn();
vi.mock('@aws-sdk/client-dynamodb', () => ({ DynamoDBClient: vi.fn().mockImplementation(() => ({})) }));
vi.mock('@aws-sdk/lib-dynamodb', () => ({
    DynamoDBDocumentClient: {
        from: vi.fn().mockReturnValue({
            send: vi.fn().mockImplementation((cmd: any) => {
                const n = cmd.constructor.name;
                if (n === 'GetCommand') return mockGet(cmd);
                if (n === 'UpdateCommand') return mockUpdate(cmd);
                return Promise.resolve({});
            }),
        }),
    },
    GetCommand: class { input: any; constructor(input: any) { this.input = input; } },
    UpdateCommand: class { input: any; constructor(input: any) { this.input = input; } },
}));

vi.stubEnv('INTELLIGENCE_TABLE', 'NineScrollsIntelligence');

beforeEach(() => { mockGet.mockReset(); mockUpdate.mockReset(); });

describe('classify-and-store handler', () => {
    it('sets overallScore=max, isHighPriority=true, GSI3 when score >= 80', async () => {
        mockGet.mockResolvedValueOnce({ Item: { tenderId: 'sam-1', status: 'new', postedDate: '2026-05-10' } });
        mockUpdate.mockResolvedValue({});

        const { handler } = await import('./handler');
        const result = await handler({
            matchResults: [
                { tenderId: 'sam-1', matches: [
                    { productSlug: 'pluto-f', productCategory: 'PECVD', score: 87 },
                    { productSlug: 'hy20l', productCategory: 'AFM', score: 42 },
                ] },
            ],
        });

        expect(result.tendersUpdated).toBe(1);
        expect(result.highPriorityTenderIds).toEqual(['sam-1']);
        const update = mockUpdate.mock.calls[0][0].input;
        expect(update.Key).toEqual({ PK: 'TENDER#sam-1', SK: 'METADATA' });
        const expressionValues = update.ExpressionAttributeValues;
        expect(expressionValues[':overallScore']).toBe(87);
        expect(expressionValues[':isHighPriority']).toBe(true);
        expect(expressionValues[':gsi3pk']).toBe('TENDER_HIGH_PRIORITY');
        expect(expressionValues[':gsi3sk']).toBe('2026-05-10#sam-1');
        expect(expressionValues[':gsi1sk']).toMatch(/^013#2026-05-10#sam-1$/); // 100 - 87
    });

    it('clears GSI3 when no matches reach 80', async () => {
        mockGet.mockResolvedValueOnce({ Item: { tenderId: 'sam-2', status: 'new', postedDate: '2026-05-10' } });
        mockUpdate.mockResolvedValue({});

        const { handler } = await import('./handler');
        await handler({
            matchResults: [
                { tenderId: 'sam-2', matches: [{ productSlug: 'pluto-f', productCategory: 'PECVD', score: 45 }] },
            ],
        });

        const update = mockUpdate.mock.calls[0][0].input;
        expect(update.UpdateExpression).toContain('REMOVE');
        expect(update.UpdateExpression).toContain('GSI3PK');
    });

    it('skips tenders with no matches at all', async () => {
        const { handler } = await import('./handler');
        const result = await handler({
            matchResults: [{ tenderId: 'sam-3', matches: [] }],
        });
        expect(result.tendersUpdated).toBe(0);
        expect(mockUpdate).not.toHaveBeenCalled();
    });
});
