import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGet = vi.fn();
const mockQuery = vi.fn();
const mockPut = vi.fn();
vi.mock('@aws-sdk/client-dynamodb', () => ({ DynamoDBClient: vi.fn().mockImplementation(() => ({})) }));
vi.mock('@aws-sdk/lib-dynamodb', () => ({
    DynamoDBDocumentClient: {
        from: vi.fn().mockReturnValue({
            send: vi.fn().mockImplementation((cmd: any) => {
                const n = cmd.constructor.name;
                if (n === 'GetCommand') return mockGet(cmd);
                if (n === 'QueryCommand') return mockQuery(cmd);
                if (n === 'PutCommand') return mockPut(cmd);
                return Promise.resolve({});
            }),
        }),
    },
    GetCommand: class { input: any; constructor(input: any) { this.input = input; } },
    QueryCommand: class { input: any; constructor(input: any) { this.input = input; } },
    PutCommand: class { input: any; constructor(input: any) { this.input = input; } },
}));

const mockBedrockSend = vi.fn();
vi.mock('@aws-sdk/client-bedrock-runtime', () => ({
    BedrockRuntimeClient: vi.fn().mockImplementation(() => ({ send: mockBedrockSend })),
    InvokeModelCommand: class { input: any; constructor(input: any) { this.input = input; } },
}));

const mockAnthropic = vi.fn();
vi.mock('@anthropic-ai/sdk', () => ({
    default: class { messages = { create: mockAnthropic }; },
    Anthropic: class { messages = { create: mockAnthropic }; },
}));

vi.stubEnv('INTELLIGENCE_TABLE', 'NineScrollsIntelligence');
vi.stubEnv('BEDROCK_MODEL_ID', 'us.anthropic.claude-haiku-4-5-20251001-v1:0');
vi.stubEnv('CLAUDE_MODEL', 'claude-haiku-4-5-20251001');
vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test');

beforeEach(() => {
    mockGet.mockReset(); mockQuery.mockReset(); mockPut.mockReset();
    mockBedrockSend.mockReset(); mockAnthropic.mockReset();
});

function bedrockOk(body: object) {
    const json = JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(body) }] });
    return { body: { transformToString: vi.fn().mockResolvedValue(json) } };
}

describe('match-with-llm handler', () => {
    it('writes MATCH items for scores >= 30 and skips lower scores', async () => {
        mockGet.mockResolvedValueOnce({
            Item: { tenderId: 'sam-1', title: 'PECVD System', description: 'desc' },
        });
        mockQuery.mockResolvedValueOnce({
            Items: [
                { productCategory: 'PECVD', productSlugs: ['pluto-f'], isActive: true },
                { productCategory: 'AFM', productSlugs: ['hy20l'], isActive: true },
            ],
        });
        mockBedrockSend.mockResolvedValueOnce(bedrockOk([
            { category: 'PECVD', score: 87, reasoning: 'strong PECVD match', matchedKeywords: ['PECVD'] },
            { category: 'AFM', score: 15, reasoning: 'not relevant', matchedKeywords: [] },
        ]));
        mockPut.mockResolvedValue({});

        const { handler } = await import('./handler');
        const result = await handler({ tenderId: 'sam-1' });

        expect(result.tenderId).toBe('sam-1');
        expect(result.matches).toHaveLength(1);
        expect(result.matches[0]).toMatchObject({ productSlug: 'pluto-f', score: 87 });
        expect(mockPut).toHaveBeenCalledTimes(1);
        const item = mockPut.mock.calls[0][0].input.Item;
        expect(item.PK).toBe('TENDER#sam-1');
        expect(item.SK).toBe('MATCH#pluto-f');
        expect(item.entityType).toBe('TENDER_MATCH');
        expect(item.score).toBe(87);
    });

    it('falls back to Anthropic API on Bedrock failure', async () => {
        mockGet.mockResolvedValueOnce({ Item: { tenderId: 'sam-2', title: 'ALD', description: '' } });
        mockQuery.mockResolvedValueOnce({ Items: [{ productCategory: 'ALD', productSlugs: ['ald-tool'], isActive: true }] });
        mockBedrockSend.mockRejectedValueOnce(new Error('Bedrock down'));
        mockAnthropic.mockResolvedValueOnce({
            content: [{ type: 'text', text: JSON.stringify([{ category: 'ALD', score: 75, reasoning: 'ok', matchedKeywords: ['ALD'] }]) }],
        });
        mockPut.mockResolvedValue({});

        const { handler } = await import('./handler');
        const result = await handler({ tenderId: 'sam-2' });
        expect(result.matches[0].score).toBe(75);
        expect(mockAnthropic).toHaveBeenCalled();
    });

    it('strips markdown code fences from LLM response', async () => {
        mockGet.mockResolvedValueOnce({ Item: { tenderId: 'sam-fence', title: 'X', description: '' } });
        mockQuery.mockResolvedValueOnce({ Items: [{ productCategory: 'PECVD', productSlugs: ['pluto-f'], isActive: true }] });

        // Wrap the JSON in a markdown code fence — what real Claude often returns.
        const fenced = '```json\n' + JSON.stringify([
            { category: 'PECVD', score: 91, reasoning: 'fenced response', matchedKeywords: ['PECVD'] },
        ]) + '\n```';
        const json = JSON.stringify({ content: [{ type: 'text', text: fenced }] });
        mockBedrockSend.mockResolvedValueOnce({
            body: { transformToString: vi.fn().mockResolvedValue(json) },
        });
        mockPut.mockResolvedValue({});

        const { handler } = await import('./handler');
        const result = await handler({ tenderId: 'sam-fence' });

        expect(result.matches).toHaveLength(1);
        expect(result.matches[0].score).toBe(91);
    });

    it('returns empty matches when both providers fail', async () => {
        mockGet.mockResolvedValueOnce({ Item: { tenderId: 'sam-3', title: 'X', description: '' } });
        mockQuery.mockResolvedValueOnce({ Items: [{ productCategory: 'PECVD', productSlugs: ['pluto-f'], isActive: true }] });
        mockBedrockSend.mockRejectedValueOnce(new Error('throttle'));
        mockAnthropic.mockRejectedValueOnce(new Error('500'));

        const { handler } = await import('./handler');
        const result = await handler({ tenderId: 'sam-3' });
        expect(result.matches).toEqual([]);
        expect(result.error).toBeDefined();
    });
});
