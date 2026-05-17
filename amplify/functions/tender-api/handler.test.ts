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
