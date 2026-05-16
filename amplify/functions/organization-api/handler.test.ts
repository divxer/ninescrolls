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

    it('uses latestLeadDate field name for lead source (regression: schema field-name mismatch)', async () => {
        const docMock = await import('@aws-sdk/lib-dynamodb');
        const sendMock = vi.fn();
        (docMock.DynamoDBDocumentClient.from as any).mockReturnValue({ send: sendMock });

        const capturedItems: any[] = [];
        sendMock.mockImplementation(async (cmd: any) => {
            if (cmd.constructor.name === 'PutCommand') {
                capturedItems.push(cmd.input?.Item);
            }
            return {};
        });

        vi.stubEnv('AWS_LAMBDA_FUNCTION_NAME', 'organization-api-test');

        const { handler } = await import('./handler');
        await handler({
            action: 'upsertFromSubmission',
            source: 'lead',
            email: 'lab@stanford.edu',
            submittedAt: NOW_ISO,
            scoreDelta: 2,
        } as any);

        // The META Item should have latestLeadDate (mixed case), not latestLEADDate
        const metaItem = capturedItems.find(i => i?.SK === 'META');
        expect(metaItem).toBeDefined();
        expect(metaItem.latestLeadDate).toBe(NOW_ISO);
        expect((metaItem as any).latestLEADDate).toBeUndefined();
    });

    it('uses latestOrderDate field name for order source', async () => {
        const docMock = await import('@aws-sdk/lib-dynamodb');
        const sendMock = vi.fn();
        (docMock.DynamoDBDocumentClient.from as any).mockReturnValue({ send: sendMock });

        const capturedItems: any[] = [];
        sendMock.mockImplementation(async (cmd: any) => {
            if (cmd.constructor.name === 'PutCommand') {
                capturedItems.push(cmd.input?.Item);
            }
            return {};
        });

        vi.stubEnv('AWS_LAMBDA_FUNCTION_NAME', 'organization-api-test');

        const { handler } = await import('./handler');
        await handler({
            action: 'upsertFromSubmission',
            source: 'order',
            email: 'procurement@stanford.edu',
            submittedAt: NOW_ISO,
            scoreDelta: 15,
            orderValueUSD: 50000,
        } as any);

        const metaItem = capturedItems.find(i => i?.SK === 'META');
        expect(metaItem).toBeDefined();
        expect(metaItem.latestOrderDate).toBe(NOW_ISO);
        expect(metaItem.totalOrderValueUSD).toBe(50000);
        expect(metaItem.orderCount).toBe(1);
        expect(metaItem.hasActiveInquiry).toBe(false); // order path
    });

    it('writes GSI3 keys when initial scoreDelta crosses LEAD_SCORE_THRESHOLD', async () => {
        const docMock = await import('@aws-sdk/lib-dynamodb');
        const sendMock = vi.fn();
        (docMock.DynamoDBDocumentClient.from as any).mockReturnValue({ send: sendMock });

        const capturedItems: any[] = [];
        sendMock.mockImplementation(async (cmd: any) => {
            if (cmd.constructor.name === 'PutCommand') {
                capturedItems.push(cmd.input?.Item);
            }
            return {};
        });

        vi.stubEnv('AWS_LAMBDA_FUNCTION_NAME', 'organization-api-test');

        const { handler } = await import('./handler');
        await handler({
            action: 'upsertFromSubmission',
            source: 'rfq',
            email: 'procurement@stanford.edu',
            submittedAt: NOW_ISO,
            scoreDelta: 16, // funded + immediate RFQ
        } as any);

        const metaItem = capturedItems.find(i => i?.SK === 'META');
        expect(metaItem.GSI3PK).toBe('ORG_LEAD_SCORE');
        expect(metaItem.GSI3SK).toMatch(/^09984#stanford\.edu$/); // invertedScoreToken(16) = '09984'
    });

    it('does not write GSI3 keys for new Org below threshold', async () => {
        const docMock = await import('@aws-sdk/lib-dynamodb');
        const sendMock = vi.fn();
        (docMock.DynamoDBDocumentClient.from as any).mockReturnValue({ send: sendMock });

        const capturedItems: any[] = [];
        sendMock.mockImplementation(async (cmd: any) => {
            if (cmd.constructor.name === 'PutCommand') {
                capturedItems.push(cmd.input?.Item);
            }
            return {};
        });

        vi.stubEnv('AWS_LAMBDA_FUNCTION_NAME', 'organization-api-test');

        const { handler } = await import('./handler');
        await handler({
            action: 'upsertFromSubmission',
            source: 'lead',
            email: 'someone@stanford.edu',
            submittedAt: NOW_ISO,
            scoreDelta: 2, // below threshold
        } as any);

        const metaItem = capturedItems.find(i => i?.SK === 'META');
        expect(metaItem.GSI3PK).toBeUndefined();
        expect(metaItem.GSI3SK).toBeUndefined();
    });

    it('upsert succeeds even if self-invoke classify fails', async () => {
        const docMock = await import('@aws-sdk/lib-dynamodb');
        const sendMock = vi.fn().mockResolvedValue({});
        (docMock.DynamoDBDocumentClient.from as any).mockReturnValue({ send: sendMock });

        // Lambda self-invoke throws
        const lambdaMock = await import('@aws-sdk/client-lambda');
        const lambdaSend = vi.fn().mockRejectedValue(new Error('Lambda quota exceeded'));
        (lambdaMock.LambdaClient as any).mockImplementation(() => ({ send: lambdaSend }));

        vi.stubEnv('AWS_LAMBDA_FUNCTION_NAME', 'organization-api-test');

        const { handler } = await import('./handler');
        const result = await handler({
            action: 'upsertFromSubmission',
            source: 'rfq',
            email: 'harvey@stanford.edu',
            submittedAt: NOW_ISO,
            scoreDelta: 8,
        } as any);

        // Upsert returned matchedOrgId despite classify invocation failure
        expect(result).toEqual({ matchedOrgId: 'stanford.edu' });
        expect(lambdaSend).toHaveBeenCalled();
    });
});

describe('classifyOrg', () => {
    beforeEach(() => {
        // Reset module cache so each test can rebind DynamoDBDocumentClient.from
        // and BedrockRuntimeClient before the handler module captures them at import time.
        vi.resetModules();
    });

    function bedrockBody(json: object) {
        const text = JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(json) }] });
        return { body: { transformToString: vi.fn().mockResolvedValue(text) } };
    }

    it('classifies an Org via Bedrock and writes back type + country + GSI1PK', async () => {
        const docMock = await import('@aws-sdk/lib-dynamodb');
        const sendMock = vi.fn();
        (docMock.DynamoDBDocumentClient.from as any).mockReturnValue({ send: sendMock });
        // GetItem returns existing Org
        sendMock.mockImplementationOnce(async () => ({
            Item: {
                orgId: 'stanford.edu',
                displayName: 'stanford.edu',
                type: 'unknown',
                aliasDomains: [],
            },
        }));
        // UpdateItem
        sendMock.mockResolvedValue({});

        const bedrockMock = await import('@aws-sdk/client-bedrock-runtime');
        const bedrockSend = vi.fn().mockResolvedValueOnce(bedrockBody({
            displayName: 'Stanford University',
            type: 'university',
            country: 'US',
            industry: 'Higher education',
        }));
        (bedrockMock.BedrockRuntimeClient as any).mockImplementation(() => ({ send: bedrockSend }));

        const { handler } = await import('./handler');
        const result = await handler({
            action: 'classifyOrg',
            orgId: 'stanford.edu',
            institution: 'Stanford University',
        } as any);

        expect((result as any).type).toBe('university');
        expect((result as any).displayName).toBe('Stanford University');
        const updateCmd = sendMock.mock.calls.find((c: any) => c[0].constructor.name === 'UpdateCommand');
        expect(updateCmd).toBeDefined();
        const expr = updateCmd![0].input.UpdateExpression as string;
        expect(expr).toContain('GSI1PK');
    });

    it('falls back to Anthropic when Bedrock fails', async () => {
        const docMock = await import('@aws-sdk/lib-dynamodb');
        const sendMock = vi.fn();
        (docMock.DynamoDBDocumentClient.from as any).mockReturnValue({ send: sendMock });
        sendMock.mockImplementationOnce(async () => ({ Item: { orgId: 'mit.edu', type: 'unknown' } }));
        sendMock.mockResolvedValue({});

        const bedrockMock = await import('@aws-sdk/client-bedrock-runtime');
        const bedrockSend = vi.fn().mockRejectedValueOnce(new Error('Bedrock unavailable'));
        (bedrockMock.BedrockRuntimeClient as any).mockImplementation(() => ({ send: bedrockSend }));

        const anthropicMock = await import('@anthropic-ai/sdk');
        const create = vi.fn().mockResolvedValueOnce({
            content: [{ type: 'text', text: JSON.stringify({
                displayName: 'MIT',
                type: 'university',
                country: 'US',
                industry: null,
            }) }],
        });
        (anthropicMock.default as any) = class { messages = { create }; };

        const { handler } = await import('./handler');
        const result = await handler({
            action: 'classifyOrg',
            orgId: 'mit.edu',
        } as any);

        expect((result as any).aiProvider).toBe('anthropic');
    });

    it('no-ops on both providers failing (does not throw)', async () => {
        const docMock = await import('@aws-sdk/lib-dynamodb');
        const sendMock = vi.fn();
        (docMock.DynamoDBDocumentClient.from as any).mockReturnValue({ send: sendMock });
        sendMock.mockImplementationOnce(async () => ({ Item: { orgId: 'unknown.example', type: 'unknown' } }));
        sendMock.mockResolvedValue({});

        const bedrockMock = await import('@aws-sdk/client-bedrock-runtime');
        const bedrockSend = vi.fn().mockRejectedValueOnce(new Error('Bedrock down'));
        (bedrockMock.BedrockRuntimeClient as any).mockImplementation(() => ({ send: bedrockSend }));

        const anthropicMock = await import('@anthropic-ai/sdk');
        const create = vi.fn().mockRejectedValueOnce(new Error('Anthropic 500'));
        (anthropicMock.default as any) = class { messages = { create }; };

        const { handler } = await import('./handler');
        const result = await handler({
            action: 'classifyOrg',
            orgId: 'unknown.example',
        } as any);

        expect((result as any).aiProvider).toBeNull();
        // No UpdateItem on type/country
        const updateCalls = sendMock.mock.calls.filter((c: any) =>
            c[0].constructor.name === 'UpdateCommand' && (c[0].input.UpdateExpression as string).includes('type'));
        expect(updateCalls.length).toBe(0);
    });
});

describe('listOrganizations', () => {
    beforeEach(() => {
        vi.resetModules();
    });

    it('queries GSI1 per requested type and merges results', async () => {
        const docMock = await import('@aws-sdk/lib-dynamodb');
        const sendMock = vi.fn();
        (docMock.DynamoDBDocumentClient.from as any).mockReturnValue({ send: sendMock });

        // Two parallel Queries (one per type)
        sendMock.mockResolvedValueOnce({ Items: [
            { orgId: 'stanford.edu', type: 'university', lastActivityAt: '2026-05-15T10:00:00Z', leadScore: 30 },
        ] });
        sendMock.mockResolvedValueOnce({ Items: [
            { orgId: 'amat.com', type: 'company', lastActivityAt: '2026-05-14T10:00:00Z', leadScore: 12 },
        ] });
        // Optional totalActiveCount Query
        sendMock.mockResolvedValueOnce({ Count: 2 });

        const { handler } = await import('./handler');
        const result = await handler({
            info: { fieldName: 'listOrganizations' },
            arguments: { types: ['university', 'company'], statuses: ['active'], limit: 25 },
            identity: { username: 'admin', groups: ['admin'] },
        } as any);

        expect((result as any).items.length).toBe(2);
        // Default sort=activity DESC: stanford (newer) first
        expect((result as any).items[0].orgId).toBe('stanford.edu');
    });
});

describe('getOrganization', () => {
    beforeEach(() => {
        vi.resetModules();
    });

    it('returns a bundle with Org meta + grouped timeline', async () => {
        const docMock = await import('@aws-sdk/lib-dynamodb');
        const sendMock = vi.fn();
        (docMock.DynamoDBDocumentClient.from as any).mockReturnValue({ send: sendMock });

        // GetItem META
        sendMock.mockResolvedValueOnce({ Item: {
            orgId: 'stanford.edu', displayName: 'Stanford', type: 'university',
        } });
        // GSI2 Query for related items
        sendMock.mockResolvedValueOnce({ Items: [
            { entityType: 'RFQ_SUBMISSION', rfqId: 'r1', submittedAt: '2026-05-10' },
            { entityType: 'ORDER', orderId: 'o1', quoteDate: '2026-04-01' },
            { entityType: 'LEAD_SUBMISSION', leadId: 'l1', submittedAt: '2026-03-15' },
        ] });

        const { handler } = await import('./handler');
        const result: any = await handler({
            info: { fieldName: 'getOrganization' },
            arguments: { orgId: 'stanford.edu' },
            identity: { username: 'admin', groups: ['admin'] },
        } as any);

        expect(result.organization.orgId).toBe('stanford.edu');
        expect(result.recentRfqs).toHaveLength(1);
        expect(result.recentOrders).toHaveLength(1);
        expect(result.recentLeads).toHaveLength(1);
        expect(result.recentTenders).toEqual([]);
    });

    it('throws 404 if Org does not exist', async () => {
        const docMock = await import('@aws-sdk/lib-dynamodb');
        const sendMock = vi.fn();
        (docMock.DynamoDBDocumentClient.from as any).mockReturnValue({ send: sendMock });
        sendMock.mockResolvedValueOnce({ Item: undefined });

        const { handler } = await import('./handler');
        await expect(handler({
            info: { fieldName: 'getOrganization' },
            arguments: { orgId: 'fake.example' },
            identity: { username: 'admin', groups: ['admin'] },
        } as any)).rejects.toThrow(/not found/);
    });
});
