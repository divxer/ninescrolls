import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@aws-sdk/client-dynamodb', () => ({
    DynamoDBClient: vi.fn().mockImplementation(() => ({})),
}));
vi.mock('@aws-sdk/lib-dynamodb', () => ({
    DynamoDBDocumentClient: {
        from: vi.fn().mockReturnValue({ send: vi.fn().mockResolvedValue({}) }),
    },
    GetCommand: class { input: any; constructor(i: any) { this.input = i; } },
    PutCommand: class { input: any; constructor(i: any) { this.input = i; } },
    UpdateCommand: class { input: any; constructor(i: any) { this.input = i; } },
    QueryCommand: class { input: any; constructor(i: any) { this.input = i; } },
    BatchGetCommand: class { input: any; constructor(i: any) { this.input = i; } },
}));
vi.mock('@aws-sdk/client-bedrock-runtime', () => ({
    BedrockRuntimeClient: vi.fn().mockImplementation(() => ({ send: vi.fn() })),
    InvokeModelCommand: class { input: any; constructor(i: any) { this.input = i; } },
}));
vi.mock('@anthropic-ai/sdk', () => ({
    default: class { messages = { create: vi.fn() }; },
    Anthropic: class { messages = { create: vi.fn() }; },
}));

vi.stubEnv('INTELLIGENCE_TABLE', 'NineScrollsIntelligence-test');

beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
});

describe('tender-api dispatcher', () => {
    it('throws when AppSync identity is missing admin group', async () => {
        const { handler } = await import('./handler');
        await expect(handler({
            info: { fieldName: 'listTenders' },
            arguments: {},
            identity: { username: 'user1', groups: ['user'] },
        } as any)).rejects.toThrow(/admin group required/);
    });

    it('throws on unknown fieldName when admin', async () => {
        const { handler } = await import('./handler');
        await expect(handler({
            info: { fieldName: 'bogusOp' },
            arguments: {},
            identity: { username: 'admin1', groups: ['admin'] },
        } as any)).rejects.toThrow(/Unknown fieldName/);
    });

    it('reads fieldName from event root when info is absent (Amplify Gen 2 shape)', async () => {
        const { handler } = await import('./handler');
        await expect(handler({
            fieldName: 'bogusOp',
            arguments: {},
            identity: { username: 'admin1', groups: ['admin'] },
        } as any)).rejects.toThrow(/Unknown fieldName/);
    });
});

describe('listTenders', () => {
    it('queries GSI1 per requested status and merges results', async () => {
        const docMock = await import('@aws-sdk/lib-dynamodb');
        const sendMock = vi.fn();
        (docMock.DynamoDBDocumentClient.from as any).mockReturnValue({ send: sendMock });

        // Two parallel Queries (one per status)
        sendMock.mockResolvedValueOnce({ Items: [
            { tenderId: 't1', status: 'new', overallScore: 85, postedDate: '2026-05-10', country: 'US', title: 'A', agency: 'A' },
        ] });
        sendMock.mockResolvedValueOnce({ Items: [
            { tenderId: 't2', status: 'reviewing', overallScore: 70, postedDate: '2026-05-09', country: 'DE', title: 'B', agency: 'B' },
        ] });
        // totalActiveUnfiltered COUNT queries (4 active statuses × 1 each)
        sendMock.mockResolvedValue({ Count: 0 });

        const { handler } = await import('./handler');
        const result = await handler({
            info: { fieldName: 'listTenders' },
            arguments: { statuses: ['new', 'reviewing'], limit: 25 },
            identity: { username: 'admin', groups: ['admin'] },
        } as any);

        expect((result as any).items.length).toBe(2);
        // Default sort: score DESC
        expect((result as any).items[0].tenderId).toBe('t1');
    });

    it('filters by country in-memory', async () => {
        const docMock = await import('@aws-sdk/lib-dynamodb');
        const sendMock = vi.fn();
        (docMock.DynamoDBDocumentClient.from as any).mockReturnValue({ send: sendMock });

        sendMock.mockResolvedValueOnce({ Items: [
            { tenderId: 't1', status: 'new', overallScore: 85, country: 'US', title: 'A', agency: 'A' },
            { tenderId: 't2', status: 'new', overallScore: 80, country: 'DE', title: 'B', agency: 'B' },
        ] });
        sendMock.mockResolvedValue({ Count: 0 });

        const { handler } = await import('./handler');
        const result = await handler({
            info: { fieldName: 'listTenders' },
            arguments: { statuses: ['new'], countries: ['US'] },
            identity: { username: 'admin', groups: ['admin'] },
        } as any);

        expect((result as any).items.map((i: any) => i.tenderId)).toEqual(['t1']);
    });
});
