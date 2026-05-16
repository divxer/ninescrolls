import { describe, it, expect, vi, beforeEach } from 'vitest';

// Minimal mocks for the SDK clients used elsewhere — needed to import the handler
// without making real AWS calls. We'll add per-test mock setup later as we build out operations.
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
    ScanCommand: class { input: any; constructor(i: any) { this.input = i; } },
    BatchGetCommand: class { input: any; constructor(i: any) { this.input = i; } },
}));
vi.mock('@aws-sdk/client-bedrock-runtime', () => ({
    BedrockRuntimeClient: vi.fn().mockImplementation(() => ({ send: vi.fn() })),
    InvokeModelCommand: class { input: any; constructor(i: any) { this.input = i; } },
}));
vi.mock('@aws-sdk/client-lambda', () => ({
    LambdaClient: vi.fn().mockImplementation(() => ({ send: vi.fn() })),
    InvokeCommand: class { input: any; constructor(i: any) { this.input = i; } },
}));
vi.mock('@anthropic-ai/sdk', () => ({
    default: class { messages = { create: vi.fn() }; },
    Anthropic: class { messages = { create: vi.fn() }; },
}));

vi.stubEnv('INTELLIGENCE_TABLE', 'NineScrollsIntelligence-test');

beforeEach(() => {
    vi.clearAllMocks();
});

describe('organization-api dispatcher', () => {
    it('throws when AppSync event identity is missing admin group', async () => {
        const { handler } = await import('./handler');
        await expect(handler({
            info: { fieldName: 'listOrganizations' },
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

    it('does not require admin for direct Lambda invoke (action path)', async () => {
        const { handler } = await import('./handler');
        // Use an unknown action so we get a clean "Unknown action" error rather than DDB calls
        await expect(handler({ action: 'bogus-action' } as any)).rejects.toThrow(/Unknown action/);
    });

    it('routes AppSync event with stray top-level action key through requireAdmin (not direct-invoke)', async () => {
        // Defense against an AppSync resolver event accidentally getting an `action` key
        // at the top level — must NOT bypass requireAdmin.
        const { handler } = await import('./handler');
        await expect(handler({
            action: 'upsertFromSubmission', // attacker / misconfiguration
            info: { fieldName: 'listOrganizations' },
            arguments: {},
            identity: { username: 'user1', groups: ['user'] }, // no admin
        } as any)).rejects.toThrow(/admin group required/);
    });
});

import { classifyEmailDomain } from '../../lib/organization/etld';

describe('upsertFromSubmission', () => {
    const NOW_ISO = '2026-05-16T12:00:00.000Z';
    beforeEach(() => {
        vi.setSystemTime(new Date(NOW_ISO));
        // Reset module cache so each test can rebind DynamoDBDocumentClient.from
        // before the handler module captures it at import time.
        vi.resetModules();
    });

    it('returns matchedOrgId=null for free-mail submissions', async () => {
        const { handler } = await import('./handler');
        const result = await handler({
            action: 'upsertFromSubmission',
            source: 'rfq',
            email: 'harvey@gmail.com',
            submittedAt: NOW_ISO,
            scoreDelta: 8,
        } as any);
        expect(result).toEqual({ matchedOrgId: null });
    });

    it('returns matchedOrgId=null for invalid email format', async () => {
        const { handler } = await import('./handler');
        const result = await handler({
            action: 'upsertFromSubmission',
            source: 'rfq',
            email: 'not-an-email',
            submittedAt: NOW_ISO,
            scoreDelta: 8,
        } as any);
        expect(result).toEqual({ matchedOrgId: null });
    });

    it('creates a new Org on first submission (PutItem succeeds)', async () => {
        const docMock = await import('@aws-sdk/lib-dynamodb');
        const sendMock = vi.fn();
        (docMock.DynamoDBDocumentClient.from as any).mockReturnValue({ send: sendMock });

        // PutItem on alias lookup query (first GSI2 check returns no items)
        sendMock.mockImplementationOnce(async (cmd: any) => {
            const name = cmd.constructor.name;
            if (name === 'QueryCommand') return { Items: [] };
            return {};
        });
        // PutItem on META (succeeds — new Org)
        sendMock.mockImplementationOnce(async () => ({}));
        // (alias lookup write happens later; mock subsequent calls as success)
        sendMock.mockResolvedValue({});

        // Lambda self-invoke for classify
        const lambdaMock = await import('@aws-sdk/client-lambda');
        const lambdaSend = vi.fn().mockResolvedValue({});
        (lambdaMock.LambdaClient as any).mockImplementation(() => ({ send: lambdaSend }));

        vi.stubEnv('AWS_LAMBDA_FUNCTION_NAME', 'organization-api-test');

        const { handler } = await import('./handler');
        const result = await handler({
            action: 'upsertFromSubmission',
            source: 'rfq',
            email: 'harvey@stanford.edu',
            institution: 'Stanford University',
            submittedAt: NOW_ISO,
            scoreDelta: 8,
        } as any);

        expect(result).toEqual({ matchedOrgId: 'stanford.edu' });
        // PutItem META should have been invoked
        const putCalls = sendMock.mock.calls.filter(
            (c: any) => c[0].constructor.name === 'PutCommand',
        );
        expect(putCalls.length).toBeGreaterThanOrEqual(1);
    });

    it('falls back to UpdateItem when PutItem hits ConditionalCheckFailedException', async () => {
        const docMock = await import('@aws-sdk/lib-dynamodb');
        const sendMock = vi.fn();
        (docMock.DynamoDBDocumentClient.from as any).mockReturnValue({ send: sendMock });

        // Query alias lookup — no hit
        sendMock.mockImplementationOnce(async () => ({ Items: [] }));
        // PutItem META — fails because Org already exists
        const err = new Error('The conditional request failed');
        (err as any).name = 'ConditionalCheckFailedException';
        sendMock.mockImplementationOnce(async () => { throw err; });
        // UpdateItem META — succeeds
        sendMock.mockResolvedValueOnce({ Attributes: { leadScore: 13 } });
        // Subsequent calls
        sendMock.mockResolvedValue({});

        const { handler } = await import('./handler');
        const result = await handler({
            action: 'upsertFromSubmission',
            source: 'rfq',
            email: 'lab@cs.mit.edu',
            submittedAt: NOW_ISO,
            scoreDelta: 5,
        } as any);

        expect(result).toEqual({ matchedOrgId: 'mit.edu' });
        const updateCalls = sendMock.mock.calls.filter(
            (c: any) => c[0].constructor.name === 'UpdateCommand',
        );
        expect(updateCalls.length).toBeGreaterThanOrEqual(1);
    });

    it('uses canonical orgId from alias lookup hit', async () => {
        const docMock = await import('@aws-sdk/lib-dynamodb');
        const sendMock = vi.fn();
        (docMock.DynamoDBDocumentClient.from as any).mockReturnValue({ send: sendMock });

        // Query alias lookup — hit on a different canonical orgId
        sendMock.mockImplementationOnce(async () => ({
            Items: [{ entityType: 'ORG_DOMAIN_LOOKUP', orgId: 'special-mit.edu' }],
        }));
        // PutItem META — assume Org exists, gets CCFE
        const err = new Error('CCFE');
        (err as any).name = 'ConditionalCheckFailedException';
        sendMock.mockImplementationOnce(async () => { throw err; });
        // UpdateItem META
        sendMock.mockResolvedValueOnce({ Attributes: { leadScore: 15 } });
        sendMock.mockResolvedValue({});

        const { handler } = await import('./handler');
        const result = await handler({
            action: 'upsertFromSubmission',
            source: 'rfq',
            email: 'someone@media.mit.edu',
            submittedAt: NOW_ISO,
            scoreDelta: 8,
        } as any);

        expect(result.matchedOrgId).toBe('special-mit.edu');
    });
});
