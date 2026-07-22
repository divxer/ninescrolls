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
    TransactWriteCommand: class { input: any; constructor(i: any) { this.input = i; } },
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

    it('sorts merged results across types by lastActivityAt DESC', async () => {
        const docMock = await import('@aws-sdk/lib-dynamodb');
        const sendMock = vi.fn();
        (docMock.DynamoDBDocumentClient.from as any).mockReturnValue({ send: sendMock });

        // First query (university) returns OLDER item
        sendMock.mockResolvedValueOnce({ Items: [
            { orgId: 'old.edu', type: 'university', lastActivityAt: '2026-01-01T00:00:00Z', leadScore: 5 },
        ] });
        // Second query (company) returns NEWER item — without explicit sort, it would
        // come second; with the fix, it should sort first.
        sendMock.mockResolvedValueOnce({ Items: [
            { orgId: 'newer.com', type: 'company', lastActivityAt: '2026-05-15T00:00:00Z', leadScore: 12 },
        ] });
        sendMock.mockResolvedValue({});

        const { handler } = await import('./handler');
        const result: any = await handler({
            info: { fieldName: 'listOrganizations' },
            arguments: { types: ['university', 'company'], statuses: ['active'], limit: 25 },
            identity: { username: 'admin', groups: ['admin'] },
        } as any);

        expect(result.items[0].orgId).toBe('newer.com'); // newer activity first
        expect(result.items[1].orgId).toBe('old.edu');
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
        // GSI2 Query for related items. NOTE: real items written by
        // submit-rfq / submit-lead / convert-rfq-to-order have NO entityType
        // attribute — handler must discriminate by PK prefix only.
        sendMock.mockResolvedValueOnce({ Items: [
            { PK: 'RFQ#r1', rfqId: 'r1', submittedAt: '2026-05-10' },
            { PK: 'ORDER#o1', orderId: 'o1', quoteDate: '2026-04-01' },
            { PK: 'LEAD#l1', leadId: 'l1', submittedAt: '2026-03-15' },
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

describe('admin mutations', () => {
    beforeEach(() => {
        vi.resetModules();
    });

    it('updateOrganizationStatus sets status, adminNotes, tags', async () => {
        const docMock = await import('@aws-sdk/lib-dynamodb');
        const sendMock = vi.fn();
        (docMock.DynamoDBDocumentClient.from as any).mockReturnValue({ send: sendMock });
        sendMock.mockResolvedValueOnce({ Attributes: { orgId: 'stanford.edu', status: 'archived' } });

        const { handler } = await import('./handler');
        const result: any = await handler({
            info: { fieldName: 'updateOrganizationStatus' },
            arguments: { orgId: 'stanford.edu', status: 'archived', adminNotes: 'Out of season', tags: ['cold'] },
            identity: { username: 'admin', groups: ['admin'] },
        } as any);

        expect(result.status).toBe('archived');
        const updateCmd = sendMock.mock.calls[0][0];
        expect(updateCmd.input.UpdateExpression).toContain('status');
        expect(updateCmd.input.UpdateExpression).toContain('adminNotes');
        expect(updateCmd.input.UpdateExpression).toContain('tags');
    });

    it('updateOrganizationStatus rejects invalid status', async () => {
        const { handler } = await import('./handler');
        await expect(handler({
            info: { fieldName: 'updateOrganizationStatus' },
            arguments: { orgId: 'stanford.edu', status: 'bogus' },
            identity: { username: 'admin', groups: ['admin'] },
        } as any)).rejects.toThrow(/invalid status/);
    });

    it('updateOrganizationOwner sets ownerSalesRep', async () => {
        const docMock = await import('@aws-sdk/lib-dynamodb');
        const sendMock = vi.fn();
        (docMock.DynamoDBDocumentClient.from as any).mockReturnValue({ send: sendMock });
        sendMock.mockResolvedValueOnce({ Attributes: { orgId: 'stanford.edu', ownerSalesRep: 'sales@ninescrolls.com' } });

        const { handler } = await import('./handler');
        const result: any = await handler({
            info: { fieldName: 'updateOrganizationOwner' },
            arguments: { orgId: 'stanford.edu', ownerSalesRep: 'sales@ninescrolls.com' },
            identity: { username: 'admin', groups: ['admin'] },
        } as any);

        expect(result.ownerSalesRep).toBe('sales@ninescrolls.com');
    });

    it('reclassifyOrganization is no-op within RECLASSIFY_COOLDOWN_DAYS unless force=true', async () => {
        const docMock = await import('@aws-sdk/lib-dynamodb');
        const sendMock = vi.fn();
        (docMock.DynamoDBDocumentClient.from as any).mockReturnValue({ send: sendMock });
        // GetItem returns recently classified Org
        sendMock.mockResolvedValueOnce({ Item: {
            orgId: 'stanford.edu',
            type: 'university',
            aiClassifiedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        } });

        const { handler } = await import('./handler');
        const result: any = await handler({
            info: { fieldName: 'reclassifyOrganization' },
            arguments: { orgId: 'stanford.edu', force: false },
            identity: { username: 'admin', groups: ['admin'] },
        } as any);

        expect(result.orgId).toBe('stanford.edu');
        // No UpdateCommand should have been called — only the GetItem
        const updateCalls = sendMock.mock.calls.filter((c: any) => c[0].constructor.name === 'UpdateCommand');
        expect(updateCalls.length).toBe(0);
    });

    it('reclassifyOrganization with force=true bypasses cooldown and invokes classifyOrg', async () => {
        const docMock = await import('@aws-sdk/lib-dynamodb');
        const sendMock = vi.fn();
        (docMock.DynamoDBDocumentClient.from as any).mockReturnValue({ send: sendMock });
        // GetItem returns recently-classified Org
        sendMock.mockResolvedValueOnce({ Item: {
            orgId: 'stanford.edu',
            type: 'university',
            aiClassifiedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        } });
        // classifyOrg internals: GetItem (existing) again, then UpdateCommand
        sendMock.mockResolvedValueOnce({ Item: { orgId: 'stanford.edu', type: 'university' } });
        sendMock.mockResolvedValue({});

        const bedrockMock = await import('@aws-sdk/client-bedrock-runtime');
        const bedrockSend = vi.fn().mockResolvedValueOnce({
            body: { transformToString: vi.fn().mockResolvedValue(JSON.stringify({
                content: [{ type: 'text', text: JSON.stringify({
                    displayName: 'Stanford University',
                    type: 'university',
                    country: 'US',
                    industry: 'Higher education',
                }) }],
            })) },
        });
        (bedrockMock.BedrockRuntimeClient as any).mockImplementation(() => ({ send: bedrockSend }));

        const { handler } = await import('./handler');
        const result: any = await handler({
            info: { fieldName: 'reclassifyOrganization' },
            arguments: { orgId: 'stanford.edu', force: true },
            identity: { username: 'admin', groups: ['admin'] },
        } as any);

        // Bedrock was called (cooldown bypassed)
        expect(bedrockSend).toHaveBeenCalled();
        // Result is the new classification, not the cached META item
        expect(result.aiProvider).toBe('bedrock');
    });

    it('updateOrganizationOwner with null ownerSalesRep REMOVEs the field', async () => {
        const docMock = await import('@aws-sdk/lib-dynamodb');
        const sendMock = vi.fn();
        (docMock.DynamoDBDocumentClient.from as any).mockReturnValue({ send: sendMock });
        sendMock.mockResolvedValueOnce({ Attributes: { orgId: 'stanford.edu' } });

        const { handler } = await import('./handler');
        await handler({
            info: { fieldName: 'updateOrganizationOwner' },
            arguments: { orgId: 'stanford.edu', ownerSalesRep: null },
            identity: { username: 'admin', groups: ['admin'] },
        } as any);

        const updateCmd = sendMock.mock.calls[0][0];
        expect(updateCmd.input.UpdateExpression).toContain('REMOVE ownerSalesRep');
        expect(updateCmd.input.UpdateExpression).not.toContain(':owner');
    });
});

describe('mergeOrganization', () => {
    beforeEach(() => {
        vi.resetModules();
    });

    function makeOrgMeta(overrides: Record<string, any> = {}) {
        return {
            PK: `ORG#${overrides.orgId ?? 'src.com'}`,
            SK: 'META',
            entityType: 'ORGANIZATION',
            orgId: overrides.orgId ?? 'src.com',
            displayName: overrides.displayName ?? 'Source',
            primaryDomain: overrides.primaryDomain ?? overrides.orgId ?? 'src.com',
            aliasDomains: [],
            type: 'unknown',
            status: 'active',
            leadScore: 0,
            rfqCount: 0,
            orderCount: 0,
            leadCount: 0,
            totalOrderValueUSD: 0,
            contactCount: 0,
            hasActiveInquiry: false,
            firstSeenAt: '2026-01-01T00:00:00.000Z',
            lastActivityAt: '2026-01-01T00:00:00.000Z',
            ...overrides,
        };
    }

    // Task 8 helpers: the archive + re-points now ride TransactWriteCommands — extract them.
    function transactCallsOf(sendMock: any) {
        return sendMock.mock.calls.filter((c: any) => c[0].constructor.name === 'TransactWriteCommand');
    }
    function repointTransactsOf(sendMock: any, pkRe = /^(RFQ|ORDER|LEAD)#/) {
        return transactCallsOf(sendMock).filter((c: any) =>
            c[0].input.TransactItems?.[1]?.Update?.Key?.PK?.match(pkRe));
    }
    function archiveTransactOf(sendMock: any, sourceOrgId: string) {
        return transactCallsOf(sendMock).find((c: any) => {
            const u = c[0].input.TransactItems?.[1]?.Update;
            return u?.Key?.PK === `ORG#${sourceOrgId}` && (u?.UpdateExpression as string)?.includes('mergedInto');
        });
    }

    it('happy path: archives source atomically, rewrites GSI2 items (fenced), aggregates counts', async () => {
        const docMock = await import('@aws-sdk/lib-dynamodb');
        const sendMock = vi.fn();
        (docMock.DynamoDBDocumentClient.from as any).mockReturnValue({ send: sendMock });

        const sourceMeta = makeOrgMeta({
            orgId: 'gelest.com',
            primaryDomain: 'gelest.com',
            rfqCount: 2, orderCount: 1, leadCount: 1, totalOrderValueUSD: 10000,
            contactCount: 3, leadScore: 5, hasActiveInquiry: true,
            firstSeenAt: '2026-01-01T00:00:00.000Z',
            lastActivityAt: '2026-03-15T00:00:00.000Z',
            latestRFQDate: '2026-03-15T00:00:00.000Z',
        });
        const targetMeta = makeOrgMeta({
            orgId: 'mcgc.com',
            primaryDomain: 'mcgc.com',
            aliasDomains: ['mitsubishichem.com'],
            rfqCount: 1, orderCount: 0, leadCount: 0, totalOrderValueUSD: 0,
            contactCount: 1, leadScore: 3,
            firstSeenAt: '2026-02-01T00:00:00.000Z',
            lastActivityAt: '2026-02-10T00:00:00.000Z',
            latestRFQDate: '2026-02-10T00:00:00.000Z',
        });
        // GetItem(source), GetItem(target)
        sendMock.mockResolvedValueOnce({ Item: sourceMeta });
        sendMock.mockResolvedValueOnce({ Item: targetMeta });
        // Archive TransactWriteCommand
        sendMock.mockResolvedValueOnce({});
        // Phases: fresh strong reads of source + effective target
        sendMock.mockResolvedValueOnce({ Item: sourceMeta });
        sendMock.mockResolvedValueOnce({ Item: targetMeta });
        // GSI2 Query for linked items
        sendMock.mockResolvedValueOnce({ Items: [
            { PK: 'RFQ#r1', SK: 'META', submittedAt: '2026-03-15T00:00:00.000Z' },
            { PK: 'ORDER#o1', SK: 'META', quoteDate: '2026-03-10T00:00:00.000Z' },
            { PK: 'LEAD#l1', SK: 'META', submittedAt: '2026-02-20T00:00:00.000Z' },
        ] });
        // Fenced re-point transaction x3
        sendMock.mockResolvedValueOnce({});
        sendMock.mockResolvedValueOnce({});
        sendMock.mockResolvedValueOnce({});
        // ORG_DOMAIN_LOOKUP Query — empty
        sendMock.mockResolvedValueOnce({ Items: [] });
        // UpdateItem effective-target META (aggregation)
        sendMock.mockResolvedValueOnce({ Attributes: {
            orgId: 'mcgc.com',
            rfqCount: 3, orderCount: 1, leadCount: 1,
            leadScore: 8,
            aliasDomains: ['mitsubishichem.com', 'gelest.com'],
        } });
        // UpdateItem source META mergePhase='complete'
        sendMock.mockResolvedValueOnce({});

        const { handler } = await import('./handler');
        const result: any = await handler({
            info: { fieldName: 'mergeOrganization' },
            arguments: { sourceOrgId: 'gelest.com', targetOrgId: 'mcgc.com' },
            identity: { username: 'admin', groups: ['admin'] },
        } as any);

        expect(result.orgId).toBe('mcgc.com');
        expect(result.rfqCount).toBe(3);
        expect(result.leadScore).toBe(8);

        // Inspect the 3 linked-item rewrites (each fenced on the effective target being active)
        const linkedUpdates = repointTransactsOf(sendMock);
        expect(linkedUpdates.length).toBe(3);
        for (const call of linkedUpdates) {
            expect(call[0].input.TransactItems[0].ConditionCheck.Key).toEqual({ PK: 'ORG#mcgc.com', SK: 'META' });
            expect(call[0].input.TransactItems[0].ConditionCheck.ConditionExpression).toBe('#s = :active');
            const v = call[0].input.TransactItems[1].Update.ExpressionAttributeValues;
            expect(v[':target']).toBe('mcgc.com');
            expect(v[':gsi2pk']).toBe('ORG#mcgc.com');
            expect(v[':gsi2sk']).toMatch(/^(RFQ|ORDER|LEAD)#/);
        }

        // Target META update has aggregated counts
        const targetUpdate = sendMock.mock.calls.find((c: any) => {
            const cmd = c[0];
            return cmd.constructor.name === 'UpdateCommand'
                && cmd.input.Key?.PK === 'ORG#mcgc.com'
                && cmd.input.Key?.SK === 'META';
        });
        expect(targetUpdate).toBeDefined();
        const tv = targetUpdate![0].input.ExpressionAttributeValues;
        expect(tv[':rfqCount']).toBe(3);
        expect(tv[':orderCount']).toBe(1);
        expect(tv[':leadCount']).toBe(1);
        expect(tv[':leadScore']).toBe(8);
        expect(tv[':totalOrderValue']).toBe(10000);
        // aliasDomains union includes source primary + source aliases (target primary excluded)
        expect(tv[':aliases']).toContain('gelest.com');
        expect(tv[':aliases']).toContain('mitsubishichem.com');
        expect(tv[':aliases']).not.toContain('mcgc.com');
        // firstSeen = min, lastActivity = max
        expect(tv[':firstSeenAt']).toBe('2026-01-01T00:00:00.000Z');
        expect(tv[':lastActivityAt']).toBe('2026-03-15T00:00:00.000Z');
        expect(tv[':hasActiveInquiry']).toBe(true);

        // Source META archive (inside the atomic archive transaction)
        const sourceArchive = archiveTransactOf(sendMock, 'gelest.com');
        expect(sourceArchive).toBeDefined();
        const archiveUpdate = sourceArchive![0].input.TransactItems[1].Update;
        const sExpr = archiveUpdate.UpdateExpression as string;
        expect(sExpr).toContain('mergedInto');
        expect(sExpr).toContain('mergedAt');
        expect(sExpr).toContain('REMOVE GSI1PK, GSI1SK, GSI3PK, GSI3SK');
        expect(archiveUpdate.ExpressionAttributeValues[':archived']).toBe('archived');
        expect(archiveUpdate.ExpressionAttributeValues[':target']).toBe('mcgc.com');
    });

    it('idempotent re-merge into same target: returns target unchanged, no writes', async () => {
        const docMock = await import('@aws-sdk/lib-dynamodb');
        const sendMock = vi.fn();
        (docMock.DynamoDBDocumentClient.from as any).mockReturnValue({ send: sendMock });

        // Source: already archived + merged into mcgc.com
        sendMock.mockResolvedValueOnce({ Item: makeOrgMeta({
            orgId: 'gelest.com',
            status: 'archived',
            mergedInto: 'mcgc.com',
        }) });
        // Target
        const targetMeta = makeOrgMeta({ orgId: 'mcgc.com', leadScore: 12 });
        sendMock.mockResolvedValueOnce({ Item: targetMeta });

        const { handler } = await import('./handler');
        const result: any = await handler({
            info: { fieldName: 'mergeOrganization' },
            arguments: { sourceOrgId: 'gelest.com', targetOrgId: 'mcgc.com' },
            identity: { username: 'admin', groups: ['admin'] },
        } as any);

        expect(result.orgId).toBe('mcgc.com');
        // No UpdateCommand was executed
        const updates = sendMock.mock.calls.filter((c: any) => c[0].constructor.name === 'UpdateCommand');
        expect(updates.length).toBe(0);
    });

    it('throws when source is already merged into a DIFFERENT target', async () => {
        const docMock = await import('@aws-sdk/lib-dynamodb');
        const sendMock = vi.fn();
        (docMock.DynamoDBDocumentClient.from as any).mockReturnValue({ send: sendMock });

        sendMock.mockResolvedValueOnce({ Item: makeOrgMeta({
            orgId: 'gelest.com',
            status: 'archived',
            mergedInto: 'other.com',
        }) });
        sendMock.mockResolvedValueOnce({ Item: makeOrgMeta({ orgId: 'mcgc.com' }) });

        const { handler } = await import('./handler');
        await expect(handler({
            info: { fieldName: 'mergeOrganization' },
            arguments: { sourceOrgId: 'gelest.com', targetOrgId: 'mcgc.com' },
            identity: { username: 'admin', groups: ['admin'] },
        } as any)).rejects.toThrow(/already merged into other\.com/);
    });

    it('throws on self-merge', async () => {
        const { handler } = await import('./handler');
        await expect(handler({
            info: { fieldName: 'mergeOrganization' },
            arguments: { sourceOrgId: 'gelest.com', targetOrgId: 'gelest.com' },
            identity: { username: 'admin', groups: ['admin'] },
        } as any)).rejects.toThrow(/merge an Org into itself/);
    });

    it('throws when source or target Org is missing', async () => {
        const docMock = await import('@aws-sdk/lib-dynamodb');
        const sendMock = vi.fn();
        (docMock.DynamoDBDocumentClient.from as any).mockReturnValue({ send: sendMock });

        // Source missing
        sendMock.mockResolvedValueOnce({ Item: undefined });
        sendMock.mockResolvedValueOnce({ Item: makeOrgMeta({ orgId: 'mcgc.com' }) });

        const { handler } = await import('./handler');
        await expect(handler({
            info: { fieldName: 'mergeOrganization' },
            arguments: { sourceOrgId: 'ghost.com', targetOrgId: 'mcgc.com' },
            identity: { username: 'admin', groups: ['admin'] },
        } as any)).rejects.toThrow(/Organization not found: ghost\.com/);
    });

    it('crosses GSI3 threshold: writes GSI3PK/SK when leadScore sum >= threshold', async () => {
        const docMock = await import('@aws-sdk/lib-dynamodb');
        const sendMock = vi.fn();
        (docMock.DynamoDBDocumentClient.from as any).mockReturnValue({ send: sendMock });

        // Source leadScore=5, target leadScore=7 → sum=12 (crosses threshold of 10)
        const srcMeta = makeOrgMeta({ orgId: 'src.com', leadScore: 5 });
        const tgtMeta = makeOrgMeta({ orgId: 'tgt.com', leadScore: 7 }); // not yet indexed
        sendMock.mockResolvedValueOnce({ Item: srcMeta });
        sendMock.mockResolvedValueOnce({ Item: tgtMeta });
        // Archive transaction
        sendMock.mockResolvedValueOnce({});
        // Phase reads
        sendMock.mockResolvedValueOnce({ Item: srcMeta });
        sendMock.mockResolvedValueOnce({ Item: tgtMeta });
        // GSI2 linked query — empty
        sendMock.mockResolvedValueOnce({ Items: [] });
        // Lookup query — empty
        sendMock.mockResolvedValueOnce({ Items: [] });
        // Target META update
        sendMock.mockResolvedValueOnce({ Attributes: { orgId: 'tgt.com', leadScore: 12 } });
        // Source META mergePhase='complete'
        sendMock.mockResolvedValueOnce({});

        const { handler } = await import('./handler');
        await handler({
            info: { fieldName: 'mergeOrganization' },
            arguments: { sourceOrgId: 'src.com', targetOrgId: 'tgt.com' },
            identity: { username: 'admin', groups: ['admin'] },
        } as any);

        const targetUpdate = sendMock.mock.calls.find((c: any) => {
            const cmd = c[0];
            return cmd.constructor.name === 'UpdateCommand'
                && cmd.input.Key?.PK === 'ORG#tgt.com'
                && cmd.input.Key?.SK === 'META';
        });
        expect(targetUpdate).toBeDefined();
        const expr = targetUpdate![0].input.UpdateExpression as string;
        expect(expr).toContain('GSI3PK = :gsi3pk');
        expect(expr).toContain('GSI3SK = :gsi3sk');
        const v = targetUpdate![0].input.ExpressionAttributeValues;
        expect(v[':gsi3pk']).toBe('ORG_LEAD_SCORE');
        expect(v[':gsi3sk']).toMatch(/^09988#tgt\.com$/); // invertedScoreToken(12) = '09988'
    });

    it('aliasDomains cap: truncates union and logs warn when over cap', async () => {
        const docMock = await import('@aws-sdk/lib-dynamodb');
        const sendMock = vi.fn();
        (docMock.DynamoDBDocumentClient.from as any).mockReturnValue({ send: sendMock });

        // Build 90 aliases on target and 30 unique on source → union 120 > cap 100
        const targetAliases = Array.from({ length: 90 }, (_, i) => `t${i}.com`);
        const sourceAliases = Array.from({ length: 30 }, (_, i) => `s${i}.com`);

        const srcMeta = makeOrgMeta({
            orgId: 'src.com',
            primaryDomain: 'src.com',
            aliasDomains: sourceAliases,
        });
        const tgtMeta = makeOrgMeta({
            orgId: 'tgt.com',
            primaryDomain: 'tgt.com',
            aliasDomains: targetAliases,
        });
        sendMock.mockResolvedValueOnce({ Item: srcMeta });
        sendMock.mockResolvedValueOnce({ Item: tgtMeta });
        sendMock.mockResolvedValueOnce({});                       // archive transaction
        sendMock.mockResolvedValueOnce({ Item: srcMeta });        // phase reads
        sendMock.mockResolvedValueOnce({ Item: tgtMeta });
        sendMock.mockResolvedValueOnce({ Items: [] });
        sendMock.mockResolvedValueOnce({ Items: [] });
        sendMock.mockResolvedValueOnce({ Attributes: { orgId: 'tgt.com' } });
        sendMock.mockResolvedValueOnce({});                       // mergePhase='complete'

        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const { handler } = await import('./handler');
        await handler({
            info: { fieldName: 'mergeOrganization' },
            arguments: { sourceOrgId: 'src.com', targetOrgId: 'tgt.com' },
            identity: { username: 'admin', groups: ['admin'] },
        } as any);

        const targetUpdate = sendMock.mock.calls.find((c: any) => {
            const cmd = c[0];
            return cmd.constructor.name === 'UpdateCommand'
                && cmd.input.Key?.PK === 'ORG#tgt.com'
                && cmd.input.Key?.SK === 'META';
        });
        const aliases = targetUpdate![0].input.ExpressionAttributeValues[':aliases'] as string[];
        expect(aliases.length).toBe(100); // capped

        const warnedMerge = warnSpy.mock.calls.find((c) =>
            typeof c[0] === 'string' && (c[0] as string).includes('org.merge.alias-cap-exceeded'),
        );
        expect(warnedMerge).toBeDefined();
        warnSpy.mockRestore();
    });

    it('skips re-aggregation on retry when target already merged this source (CCFE on mergedSources)', async () => {
        // Simulates a partial-failure retry: previous run aggregated target +
        // wrote source orgId to target.mergedSources, but Lambda timed out
        // before archiving source. Re-running must NOT double-aggregate.
        const docMock = await import('@aws-sdk/lib-dynamodb');
        const sendMock = vi.fn();
        (docMock.DynamoDBDocumentClient.from as any).mockReturnValue({ send: sendMock });

        const srcMeta = {
            PK: 'ORG#src.com', SK: 'META', orgId: 'src.com', status: 'active',
            primaryDomain: 'src.com', leadScore: 8, rfqCount: 1, orderCount: 0, leadCount: 0,
            firstSeenAt: '2026-04-01T00:00:00Z', lastActivityAt: '2026-04-15T00:00:00Z',
        };
        const tgtMeta = {
            PK: 'ORG#tgt.com', SK: 'META', orgId: 'tgt.com', status: 'active',
            primaryDomain: 'tgt.com', leadScore: 20, rfqCount: 5, orderCount: 2, leadCount: 1,
            mergedSources: new Set(['src.com']),
            firstSeenAt: '2026-03-01T00:00:00Z', lastActivityAt: '2026-05-01T00:00:00Z',
        };
        // 1. GetItem source (still active — archive step never ran)
        sendMock.mockResolvedValueOnce({ Item: srcMeta });
        // 2. GetItem target (already has src.com in mergedSources)
        sendMock.mockResolvedValueOnce({ Item: tgtMeta });
        // 3. Archive transaction (source is active — archives now)
        sendMock.mockResolvedValueOnce({});
        // 4-5. Phase reads (source, effective target)
        sendMock.mockResolvedValueOnce({ Item: srcMeta });
        sendMock.mockResolvedValueOnce({ Item: tgtMeta });
        // 6. GSI2 Query for linked items (already moved on previous run, returns 0)
        sendMock.mockResolvedValueOnce({ Items: [] });
        // 7. Query for ORG_DOMAIN_LOOKUP pointing at src.com (already repointed previously, returns 0)
        sendMock.mockResolvedValueOnce({ Items: [] });
        // 8. UpdateCommand target — CCFE because mergedSources already contains src.com
        const ccfe = new Error('The conditional request failed');
        (ccfe as any).name = 'ConditionalCheckFailedException';
        sendMock.mockRejectedValueOnce(ccfe);
        // 9. GetItem target (after CCFE) — still active, already aggregated
        sendMock.mockResolvedValueOnce({ Item: {
            PK: 'ORG#tgt.com', SK: 'META', orgId: 'tgt.com', status: 'active', leadScore: 28, rfqCount: 6,
        } });
        // 10. UpdateCommand source — mergePhase='complete'
        sendMock.mockResolvedValueOnce({});

        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const { handler } = await import('./handler');
        const result: any = await handler({
            info: { fieldName: 'mergeOrganization' },
            arguments: { sourceOrgId: 'src.com', targetOrgId: 'tgt.com' },
            identity: { username: 'admin', groups: ['admin'] },
        } as any);

        // Returns the re-fetched target state — already-aggregated counts
        expect(result.leadScore).toBe(28);
        expect(result.rfqCount).toBe(6);

        // Confirm CCFE was logged as retry-safety event
        const warnedRetry = warnSpy.mock.calls.find((c) =>
            typeof c[0] === 'string' && (c[0] as string).includes('org.merge.target-already-aggregated'),
        );
        expect(warnedRetry).toBeDefined();

        // Source archive must still have happened (atomically, inside the archive transaction)
        const sourceArchive = archiveTransactOf(sendMock, 'src.com');
        expect(sourceArchive).toBeDefined();
        warnSpy.mockRestore();
    });
});

// -----------------------------------------------------------------------------------------------
// Task 8 — merge boundary (spec R10 final). WHY THIS IS SAFE vs crm-api generational replays:
// already-applied replays supersede on their own stamp; not-yet-applied replays are fenced at
// write time and redirected (or blocked, never falsely completed); archive-FIRST makes the fence
// airtight and the re-drain catches the fenced-in-flight window. Clock skew never decides a merge
// outcome because no stamp comparison is involved; merge NEVER touches the stamps themselves.
// -----------------------------------------------------------------------------------------------
describe('mergeOrganization — Task 8 merge boundary', () => {
    beforeEach(() => {
        vi.resetModules();
    });

    function makeOrgMeta(overrides: Record<string, any> = {}) {
        return {
            PK: `ORG#${overrides.orgId ?? 'src.com'}`, SK: 'META', entityType: 'ORGANIZATION',
            orgId: overrides.orgId ?? 'src.com',
            primaryDomain: overrides.primaryDomain ?? overrides.orgId ?? 'src.com',
            aliasDomains: [], type: 'unknown', status: 'active',
            leadScore: 0, rfqCount: 0, orderCount: 0, leadCount: 0,
            totalOrderValueUSD: 0, contactCount: 0, hasActiveInquiry: false,
            firstSeenAt: '2026-01-01T00:00:00.000Z', lastActivityAt: '2026-01-01T00:00:00.000Z',
            ...overrides,
        };
    }

    async function bindSend() {
        const docMock = await import('@aws-sdk/lib-dynamodb');
        const sendMock = vi.fn();
        (docMock.DynamoDBDocumentClient.from as any).mockReturnValue({ send: sendMock });
        return sendMock;
    }
    const mergeEvent = (sourceOrgId: string, targetOrgId: string) => ({
        info: { fieldName: 'mergeOrganization' },
        arguments: { sourceOrgId, targetOrgId },
        identity: { username: 'admin', groups: ['admin'] },
    } as any);
    const transactCalls = (sendMock: any) =>
        sendMock.mock.calls.filter((c: any) => c[0].constructor.name === 'TransactWriteCommand');
    const updateCalls = (sendMock: any) =>
        sendMock.mock.calls.filter((c: any) => c[0].constructor.name === 'UpdateCommand');
    const cancelErr = (codes: string[]) => Object.assign(new Error('cancelled'), {
        name: 'TransactionCanceledException', CancellationReasons: codes.map((Code) => ({ Code })),
    });
    // Every UpdateExpression issued anywhere in the run (plain updates + transact items)
    function allUpdateExpressions(sendMock: any): string[] {
        const exprs: string[] = [];
        for (const c of sendMock.mock.calls) {
            const cmd = c[0];
            if (cmd.constructor.name === 'UpdateCommand' && cmd.input.UpdateExpression) exprs.push(cmd.input.UpdateExpression);
            if (cmd.constructor.name === 'TransactWriteCommand') {
                for (const t of cmd.input.TransactItems ?? []) {
                    if (t.Update?.UpdateExpression) exprs.push(t.Update.UpdateExpression);
                }
            }
        }
        return exprs;
    }

    it('(a)+(g) ONE atomic archive transaction: [target-active check, source archive incl. mergePhase, MERGE_RECON upsert that scrubs stale probe/ack fields]', async () => {
        const sendMock = await bindSend();
        const src = makeOrgMeta({ orgId: 'src.com' });
        const tgt = makeOrgMeta({ orgId: 'tgt.com' });
        sendMock.mockResolvedValueOnce({ Item: src });
        sendMock.mockResolvedValueOnce({ Item: tgt });
        sendMock.mockResolvedValueOnce({});                       // archive tx
        sendMock.mockResolvedValueOnce({ Item: src });
        sendMock.mockResolvedValueOnce({ Item: tgt });
        sendMock.mockResolvedValueOnce({ Items: [] });
        sendMock.mockResolvedValueOnce({ Items: [] });
        sendMock.mockResolvedValueOnce({ Attributes: { orgId: 'tgt.com' } });
        sendMock.mockResolvedValueOnce({});                       // complete

        const { handler } = await import('./handler');
        await handler(mergeEvent('src.com', 'tgt.com'));

        const tx = transactCalls(sendMock)[0][0].input.TransactItems;
        expect(tx).toHaveLength(3);
        // [0] target fence
        expect(tx[0].ConditionCheck.Key).toEqual({ PK: 'ORG#tgt.com', SK: 'META' });
        expect(tx[0].ConditionCheck.ConditionExpression).toBe('#s = :active');
        // [1] source archive — production expression retained + mergedInto + mergePhase, conditioned on EXACT active state
        const arch = tx[1].Update;
        expect(arch.Key).toEqual({ PK: 'ORG#src.com', SK: 'META' });
        expect(arch.UpdateExpression).toContain('mergedInto = :target');
        expect(arch.UpdateExpression).toContain('mergedAt = :now');
        expect(arch.UpdateExpression).toContain('mergePhase = :ph');
        expect(arch.UpdateExpression).toContain('REMOVE GSI1PK, GSI1SK, GSI3PK, GSI3SK');
        expect(arch.ConditionExpression).toBe('#st = :active');
        expect(arch.ExpressionAttributeValues[':ph']).toBe('archived');
        // [2] MERGE_RECON visibility marker upsert — discoverable + scrubs stale probe/ack metadata
        const marker = tx[2].Update;
        expect(marker.Key).toEqual({ PK: 'MERGE_RECON#src.com', SK: 'TO#tgt.com' });
        expect(marker.ExpressionAttributeValues[':probe']).toBe('pending_probe');
        expect(marker.ExpressionAttributeValues[':gpk']).toBe('MERGE_RECON#pending_probe');
        expect(marker.ExpressionAttributeValues[':et']).toBe('MERGE_RECON');
        expect(marker.UpdateExpression).toContain('lagHorizonAt = :horizon');
        expect(marker.UpdateExpression).toContain('version = if_not_exists(version, :zero) + :one');
        expect(marker.UpdateExpression).toContain('REMOVE probedAt, acknowledgedBy, acknowledgedAt');
    });

    it('(b) archive happens BEFORE the first re-point write', async () => {
        const sendMock = await bindSend();
        const src = makeOrgMeta({ orgId: 'src.com' });
        const tgt = makeOrgMeta({ orgId: 'tgt.com' });
        sendMock.mockResolvedValueOnce({ Item: src });
        sendMock.mockResolvedValueOnce({ Item: tgt });
        sendMock.mockResolvedValueOnce({});                       // archive tx
        sendMock.mockResolvedValueOnce({ Item: src });
        sendMock.mockResolvedValueOnce({ Item: tgt });
        sendMock.mockResolvedValueOnce({ Items: [{ PK: 'RFQ#r1', SK: 'META', submittedAt: '2026-03-01T00:00:00Z' }] });
        sendMock.mockResolvedValueOnce({});                       // fenced re-point
        sendMock.mockResolvedValueOnce({ Items: [] });
        sendMock.mockResolvedValueOnce({ Attributes: { orgId: 'tgt.com' } });
        sendMock.mockResolvedValueOnce({});                       // complete

        const { handler } = await import('./handler');
        await handler(mergeEvent('src.com', 'tgt.com'));

        const calls = sendMock.mock.calls;
        const archiveIdx = calls.findIndex((c: any) =>
            c[0].constructor.name === 'TransactWriteCommand'
            && c[0].input.TransactItems?.[1]?.Update?.Key?.PK === 'ORG#src.com');
        const repointIdx = calls.findIndex((c: any) =>
            c[0].constructor.name === 'TransactWriteCommand'
            && c[0].input.TransactItems?.[1]?.Update?.Key?.PK === 'RFQ#r1');
        expect(archiveIdx).toBeGreaterThanOrEqual(0);
        expect(repointIdx).toBeGreaterThan(archiveIdx);
    });

    it('(c)+(h) crash-after-archive ⇒ retry RESUMES the phases, never re-upserts the marker, flips mergePhase=complete LAST', async () => {
        const sendMock = await bindSend();
        const src = makeOrgMeta({ orgId: 'src.com' });
        const tgt = makeOrgMeta({ orgId: 'tgt.com' });
        // ---- call 1: crashes right after the archive transaction commits
        sendMock.mockResolvedValueOnce({ Item: src });
        sendMock.mockResolvedValueOnce({ Item: tgt });
        sendMock.mockResolvedValueOnce({});                       // archive tx COMMITTED
        sendMock.mockRejectedValueOnce(new Error('simulated crash'));  // first phase read dies

        const { handler } = await import('./handler');
        await expect(handler(mergeEvent('src.com', 'tgt.com'))).rejects.toThrow('simulated crash');
        const callsAfterCrash = sendMock.mock.calls.length;

        // ---- call 2 (retry): source now archived+mergedInto+mergePhase='archived' ⇒ RESUME
        const archivedSrc = makeOrgMeta({ orgId: 'src.com', status: 'archived', mergedInto: 'tgt.com', mergePhase: 'archived' });
        sendMock.mockResolvedValueOnce({ Item: archivedSrc });
        sendMock.mockResolvedValueOnce({ Item: tgt });
        sendMock.mockResolvedValueOnce({ Item: tgt });            // resolveEffectiveTargetOrg('tgt.com') → active
        sendMock.mockResolvedValueOnce({ Item: archivedSrc });    // phase reads
        sendMock.mockResolvedValueOnce({ Item: tgt });
        sendMock.mockResolvedValueOnce({ Items: [] });
        sendMock.mockResolvedValueOnce({ Items: [] });
        sendMock.mockResolvedValueOnce({ Attributes: { orgId: 'tgt.com' } });
        sendMock.mockResolvedValueOnce({});                       // complete

        const result: any = await handler(mergeEvent('src.com', 'tgt.com'));
        expect(result.orgId).toBe('tgt.com');

        const retryCalls = sendMock.mock.calls.slice(callsAfterCrash);
        // (h) the retry NEVER re-runs the archive transaction / marker upsert
        const retryTransactsTouchingMarkerOrArchive = retryCalls.filter((c: any) =>
            c[0].constructor.name === 'TransactWriteCommand'
            && c[0].input.TransactItems?.some((t: any) =>
                String(t.Update?.Key?.PK ?? '').startsWith('MERGE_RECON#')
                || (t.Update?.Key?.PK === 'ORG#src.com' && String(t.Update?.UpdateExpression).includes('mergedInto'))));
        expect(retryTransactsTouchingMarkerOrArchive).toHaveLength(0);
        // (c) mergePhase='complete' is the LAST write of the retry, after the aggregation
        const lastWrite = retryCalls.filter((c: any) => c[0].constructor.name !== 'GetCommand' && c[0].constructor.name !== 'QueryCommand').at(-1)!;
        expect(lastWrite[0].constructor.name).toBe('UpdateCommand');
        expect(lastWrite[0].input.Key).toEqual({ PK: 'ORG#src.com', SK: 'META' });
        expect(lastWrite[0].input.UpdateExpression).toContain('mergePhase = :complete');
        expect(lastWrite[0].input.ExpressionAttributeValues[':complete']).toBe('complete');
    });

    it('(d) merging INTO an archived target throws (R5 — no chains ending in a dead org)', async () => {
        const sendMock = await bindSend();
        sendMock.mockResolvedValueOnce({ Item: makeOrgMeta({ orgId: 'src.com' }) });
        sendMock.mockResolvedValueOnce({ Item: makeOrgMeta({ orgId: 'tgt.com', status: 'archived' }) });
        const { handler } = await import('./handler');
        await expect(handler(mergeEvent('src.com', 'tgt.com'))).rejects.toThrow(/not active/);
        expect(transactCalls(sendMock)).toHaveLength(0);          // rejected BEFORE any write
    });

    it('(e) regression guard: merge NEVER touches matchedOrgLinkGeneration / lastLinkGeneration', async () => {
        const sendMock = await bindSend();
        const src = makeOrgMeta({ orgId: 'src.com' });
        const tgt = makeOrgMeta({ orgId: 'tgt.com' });
        sendMock.mockResolvedValueOnce({ Item: src });
        sendMock.mockResolvedValueOnce({ Item: tgt });
        sendMock.mockResolvedValueOnce({});
        sendMock.mockResolvedValueOnce({ Item: src });
        sendMock.mockResolvedValueOnce({ Item: tgt });
        sendMock.mockResolvedValueOnce({ Items: [
            { PK: 'RFQ#r1', SK: 'META', submittedAt: '2026-03-01T00:00:00Z' },
            { PK: 'LEAD#l1', SK: 'META', submittedAt: '2026-03-02T00:00:00Z' },
        ] });
        sendMock.mockResolvedValueOnce({});
        sendMock.mockResolvedValueOnce({});
        sendMock.mockResolvedValueOnce({ Items: [{ PK: 'ORG_DOMAIN_LOOKUP', SK: 'DOMAIN#alias.com' }] });
        sendMock.mockResolvedValueOnce({});
        sendMock.mockResolvedValueOnce({ Attributes: { orgId: 'tgt.com' } });
        sendMock.mockResolvedValueOnce({});

        const { handler } = await import('./handler');
        await handler(mergeEvent('src.com', 'tgt.com'));

        for (const expr of allUpdateExpressions(sendMock)) {
            expect(expr).not.toContain('matchedOrgLinkGeneration');
            expect(expr).not.toContain('lastLinkGeneration');
        }
        // and the record re-point rewrites exactly matchedOrgId + GSI2 keys
        const repoint = transactCalls(sendMock).find((c: any) => c[0].input.TransactItems?.[1]?.Update?.Key?.PK === 'RFQ#r1');
        expect(repoint[0].input.TransactItems[1].Update.UpdateExpression)
            .toBe('SET matchedOrgId = :target, GSI2PK = :gsi2pk, GSI2SK = :gsi2sk');
    });

    it('(f) same-pair re-merge: mergePhase=complete (or legacy absent) ⇒ pinned early-return; mergePhase=archived ⇒ RESUMES', async () => {
        // complete ⇒ early-return, zero writes
        let sendMock = await bindSend();
        sendMock.mockResolvedValueOnce({ Item: makeOrgMeta({ orgId: 'src.com', status: 'archived', mergedInto: 'tgt.com', mergePhase: 'complete' }) });
        sendMock.mockResolvedValueOnce({ Item: makeOrgMeta({ orgId: 'tgt.com', leadScore: 9 }) });
        let { handler } = await import('./handler');
        const early: any = await handler(mergeEvent('src.com', 'tgt.com'));
        expect(early.orgId).toBe('tgt.com');
        expect(updateCalls(sendMock)).toHaveLength(0);
        expect(transactCalls(sendMock)).toHaveLength(0);

        // archived ⇒ resumes (aggregation + complete DO run)
        vi.resetModules();
        sendMock = await bindSend();
        const archivedSrc = makeOrgMeta({ orgId: 'src.com', status: 'archived', mergedInto: 'tgt.com', mergePhase: 'archived' });
        const tgt = makeOrgMeta({ orgId: 'tgt.com' });
        sendMock.mockResolvedValueOnce({ Item: archivedSrc });
        sendMock.mockResolvedValueOnce({ Item: tgt });
        sendMock.mockResolvedValueOnce({ Item: tgt });            // resolve → active
        sendMock.mockResolvedValueOnce({ Item: archivedSrc });
        sendMock.mockResolvedValueOnce({ Item: tgt });
        sendMock.mockResolvedValueOnce({ Items: [] });
        sendMock.mockResolvedValueOnce({ Items: [] });
        sendMock.mockResolvedValueOnce({ Attributes: { orgId: 'tgt.com' } });
        sendMock.mockResolvedValueOnce({});                       // complete
        ({ handler } = await import('./handler'));
        const resumed: any = await handler(mergeEvent('src.com', 'tgt.com'));
        expect(resumed.orgId).toBe('tgt.com');
        const completes = updateCalls(sendMock).filter((c: any) => (c[0].input.UpdateExpression as string).includes('mergePhase = :complete'));
        expect(completes).toHaveLength(1);
    });

    it('CHAINED RESUME (R9): A→B crashed after archive, B→C completed — retry finishes A\'s phases against ACTIVE C; A.mergedInto stays B', async () => {
        const sendMock = await bindSend();
        const a = makeOrgMeta({ orgId: 'a.com', status: 'archived', mergedInto: 'b.com', mergePhase: 'archived' });
        const b = makeOrgMeta({ orgId: 'b.com', status: 'archived', mergedInto: 'c.com', mergePhase: 'complete' });
        const c = makeOrgMeta({ orgId: 'c.com' });
        sendMock.mockResolvedValueOnce({ Item: a });              // top read source
        sendMock.mockResolvedValueOnce({ Item: b });              // top read requested target
        sendMock.mockResolvedValueOnce({ Item: b });              // resolve('b.com') hop 1 → archived→c
        sendMock.mockResolvedValueOnce({ Item: c });              // resolve hop 2 → ACTIVE c
        sendMock.mockResolvedValueOnce({ Item: a });              // phase reads
        sendMock.mockResolvedValueOnce({ Item: c });
        sendMock.mockResolvedValueOnce({ Items: [{ PK: 'RFQ#a1', SK: 'META', submittedAt: '2026-03-01T00:00:00Z' }] });
        sendMock.mockResolvedValueOnce({});                       // fenced re-point ON C
        sendMock.mockResolvedValueOnce({ Items: [] });
        sendMock.mockResolvedValueOnce({ Item: b });              // Phase C guard: requested target's mergedSources (absent → aggregate)
        sendMock.mockResolvedValueOnce({ Attributes: { orgId: 'c.com' } });
        sendMock.mockResolvedValueOnce({});                       // complete on A

        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        const { handler } = await import('./handler');
        const result: any = await handler(mergeEvent('a.com', 'b.com'));
        expect(result.orgId).toBe('c.com');

        // target-usage matrix: the record re-point is fenced on C and re-points TO C
        const repoint = transactCalls(sendMock).find((tc: any) => tc[0].input.TransactItems?.[1]?.Update?.Key?.PK === 'RFQ#a1');
        expect(repoint[0].input.TransactItems[0].ConditionCheck.Key).toEqual({ PK: 'ORG#c.com', SK: 'META' });
        expect(repoint[0].input.TransactItems[1].Update.ExpressionAttributeValues[':target']).toBe('c.com');
        // aggregation lands on C
        const agg = updateCalls(sendMock).find((uc: any) => uc[0].input.Key?.PK === 'ORG#c.com');
        expect(agg).toBeDefined();
        // A.mergedInto stays 'b.com' — no retry write touches it; only mergePhase flips on A
        const aWrites = updateCalls(sendMock).filter((uc: any) => uc[0].input.Key?.PK === 'ORG#a.com');
        expect(aWrites).toHaveLength(1);
        expect(aWrites[0][0].input.UpdateExpression).toContain('mergePhase = :complete');
        expect(aWrites[0][0].input.UpdateExpression).not.toContain('mergedInto');
        // logs record BOTH targets when they differ
        const resumedLog = logSpy.mock.calls.find((lc) => typeof lc[0] === 'string' && (lc[0] as string).includes('org.merge.resumed'));
        expect(resumedLog).toBeDefined();
        expect(resumedLog![0]).toContain('"requestedTargetOrgId":"b.com"');
        expect(resumedLog![0]).toContain('"effectiveTargetOrgId":"c.com"');
        logSpy.mockRestore();
    });

    it('CHAINED RESUME unavailable successor ⇒ explicit error, source stays incomplete', async () => {
        const sendMock = await bindSend();
        sendMock.mockResolvedValueOnce({ Item: makeOrgMeta({ orgId: 'a.com', status: 'archived', mergedInto: 'b.com', mergePhase: 'archived' }) });
        sendMock.mockResolvedValueOnce({ Item: makeOrgMeta({ orgId: 'b.com', status: 'archived' }) }); // archived WITHOUT successor
        sendMock.mockResolvedValueOnce({ Item: makeOrgMeta({ orgId: 'b.com', status: 'archived' }) }); // resolve read
        const { handler } = await import('./handler');
        await expect(handler(mergeEvent('a.com', 'b.com'))).rejects.toThrow(/successor of b\.com unavailable/);
        // mergePhase never flipped to complete
        expect(updateCalls(sendMock)).toHaveLength(0);
    });

    it('archive cancellation index 0 with an ACTIVE source = genuine non-active-target rejection', async () => {
        const sendMock = await bindSend();
        const src = makeOrgMeta({ orgId: 'src.com' });
        sendMock.mockResolvedValueOnce({ Item: src });
        sendMock.mockResolvedValueOnce({ Item: makeOrgMeta({ orgId: 'tgt.com' }) });  // read said active…
        sendMock.mockRejectedValueOnce(cancelErr(['ConditionalCheckFailed', 'None', 'None'])); // …archived at write time
        sendMock.mockResolvedValueOnce({ Item: src });            // source re-read: still ACTIVE
        const { handler } = await import('./handler');
        await expect(handler(mergeEvent('src.com', 'tgt.com'))).rejects.toThrow(/not active/);
    });

    it('archive cancellation index 0 with OUR archive already committed ⇒ chained-resume path (reads source FIRST)', async () => {
        const sendMock = await bindSend();
        const src = makeOrgMeta({ orgId: 'src.com' });
        const archivedSrc = makeOrgMeta({ orgId: 'src.com', status: 'archived', mergedInto: 'tgt.com', mergePhase: 'archived' });
        const tgtArchived = makeOrgMeta({ orgId: 'tgt.com', status: 'archived', mergedInto: 'succ.com' });
        const succ = makeOrgMeta({ orgId: 'succ.com' });
        sendMock.mockResolvedValueOnce({ Item: src });
        sendMock.mockResolvedValueOnce({ Item: makeOrgMeta({ orgId: 'tgt.com' }) });
        sendMock.mockRejectedValueOnce(cancelErr(['ConditionalCheckFailed', 'ConditionalCheckFailed', 'None']));
        sendMock.mockResolvedValueOnce({ Item: archivedSrc });    // source read: OUR prior archive committed
        sendMock.mockResolvedValueOnce({ Item: tgtArchived });    // resolve('tgt.com') → archived → succ
        sendMock.mockResolvedValueOnce({ Item: succ });           // → ACTIVE succ.com
        sendMock.mockResolvedValueOnce({ Item: archivedSrc });    // phase reads
        sendMock.mockResolvedValueOnce({ Item: succ });
        sendMock.mockResolvedValueOnce({ Items: [] });
        sendMock.mockResolvedValueOnce({ Items: [] });
        sendMock.mockResolvedValueOnce({ Item: tgtArchived });    // Phase C guard: requested target's mergedSources (absent → aggregate)
        sendMock.mockResolvedValueOnce({ Attributes: { orgId: 'succ.com' } });
        sendMock.mockResolvedValueOnce({});                       // complete
        const { handler } = await import('./handler');
        const result: any = await handler(mergeEvent('src.com', 'tgt.com'));
        expect(result.orgId).toBe('succ.com');
    });

    it('archive cancellation index 1: competing SAME-pair merge — archived phase ⇒ resume; complete ⇒ early-return', async () => {
        // competitor archived (phases unfinished) ⇒ this call RESUMES them
        let sendMock = await bindSend();
        const archivedSrc = makeOrgMeta({ orgId: 'src.com', status: 'archived', mergedInto: 'tgt.com', mergePhase: 'archived' });
        const tgt = makeOrgMeta({ orgId: 'tgt.com' });
        sendMock.mockResolvedValueOnce({ Item: makeOrgMeta({ orgId: 'src.com' }) });
        sendMock.mockResolvedValueOnce({ Item: tgt });
        sendMock.mockRejectedValueOnce(cancelErr(['None', 'ConditionalCheckFailed', 'None']));
        sendMock.mockResolvedValueOnce({ Item: archivedSrc });    // source read after cancellation
        sendMock.mockResolvedValueOnce({ Item: tgt });            // resolve → active
        sendMock.mockResolvedValueOnce({ Item: archivedSrc });
        sendMock.mockResolvedValueOnce({ Item: tgt });
        sendMock.mockResolvedValueOnce({ Items: [] });
        sendMock.mockResolvedValueOnce({ Items: [] });
        sendMock.mockResolvedValueOnce({ Attributes: { orgId: 'tgt.com' } });
        sendMock.mockResolvedValueOnce({});
        let { handler } = await import('./handler');
        const resumed: any = await handler(mergeEvent('src.com', 'tgt.com'));
        expect(resumed.orgId).toBe('tgt.com');

        // competitor COMPLETED ⇒ pinned early-return success
        vi.resetModules();
        sendMock = await bindSend();
        sendMock.mockResolvedValueOnce({ Item: makeOrgMeta({ orgId: 'src.com' }) });
        sendMock.mockResolvedValueOnce({ Item: tgt });
        sendMock.mockRejectedValueOnce(cancelErr(['None', 'ConditionalCheckFailed', 'None']));
        sendMock.mockResolvedValueOnce({ Item: makeOrgMeta({ orgId: 'src.com', status: 'archived', mergedInto: 'tgt.com', mergePhase: 'complete' }) });
        sendMock.mockResolvedValueOnce({ Item: tgt });            // re-read target for the return value
        ({ handler } = await import('./handler'));
        const early: any = await handler(mergeEvent('src.com', 'tgt.com'));
        expect(early.orgId).toBe('tgt.com');
        expect(updateCalls(sendMock)).toHaveLength(0);            // nothing written by the loser
    });

    it('archive cancellation index 1: competing DIFFERENT-target merge won ⇒ explicit error naming the winner', async () => {
        const sendMock = await bindSend();
        sendMock.mockResolvedValueOnce({ Item: makeOrgMeta({ orgId: 'src.com' }) });
        sendMock.mockResolvedValueOnce({ Item: makeOrgMeta({ orgId: 'tgt.com' }) });
        sendMock.mockRejectedValueOnce(cancelErr(['None', 'ConditionalCheckFailed', 'None']));
        sendMock.mockResolvedValueOnce({ Item: makeOrgMeta({ orgId: 'src.com', status: 'archived', mergedInto: 'other.com', mergePhase: 'complete' }) });
        const { handler } = await import('./handler');
        await expect(handler(mergeEvent('src.com', 'tgt.com'))).rejects.toThrow(/already merged into other\.com/);
    });

    it('C→D MID-RESUME: phase fence lost ⇒ re-resolve ONCE and re-enter against the new successor', async () => {
        const sendMock = await bindSend();
        const archivedSrc = makeOrgMeta({ orgId: 'a.com', status: 'archived', mergedInto: 'b.com', mergePhase: 'archived' });
        const b = makeOrgMeta({ orgId: 'b.com' });
        const bArchived = makeOrgMeta({ orgId: 'b.com', status: 'archived', mergedInto: 'd.com' });
        const d = makeOrgMeta({ orgId: 'd.com' });
        sendMock.mockResolvedValueOnce({ Item: archivedSrc });    // top source
        sendMock.mockResolvedValueOnce({ Item: b });              // top target
        sendMock.mockResolvedValueOnce({ Item: b });              // resolve → b active
        sendMock.mockResolvedValueOnce({ Item: archivedSrc });    // phase reads (attempt 1, at b)
        sendMock.mockResolvedValueOnce({ Item: b });
        sendMock.mockResolvedValueOnce({ Items: [{ PK: 'RFQ#a1', SK: 'META', submittedAt: '2026-03-01T00:00:00Z' }] });
        sendMock.mockRejectedValueOnce(cancelErr(['ConditionalCheckFailed', 'None']));  // fence lost: b archived mid-resume
        sendMock.mockResolvedValueOnce({ Item: bArchived });      // re-resolve: b → d
        sendMock.mockResolvedValueOnce({ Item: d });              // d ACTIVE
        sendMock.mockResolvedValueOnce({ Item: archivedSrc });    // phase reads (attempt 2, at d)
        sendMock.mockResolvedValueOnce({ Item: d });
        sendMock.mockResolvedValueOnce({ Items: [{ PK: 'RFQ#a1', SK: 'META', submittedAt: '2026-03-01T00:00:00Z' }] });
        sendMock.mockResolvedValueOnce({});                       // fenced re-point ON D succeeds
        sendMock.mockResolvedValueOnce({ Items: [] });
        sendMock.mockResolvedValueOnce({ Item: bArchived });      // Phase C guard: requested target's mergedSources (absent → aggregate)
        sendMock.mockResolvedValueOnce({ Attributes: { orgId: 'd.com' } });
        sendMock.mockResolvedValueOnce({});                       // complete
        const { handler } = await import('./handler');
        const result: any = await handler(mergeEvent('a.com', 'b.com'));
        expect(result.orgId).toBe('d.com');
        const lastRepoint = transactCalls(sendMock).filter((tc: any) => tc[0].input.TransactItems?.[1]?.Update?.Key?.PK === 'RFQ#a1').at(-1)!;
        expect(lastRepoint[0].input.TransactItems[0].ConditionCheck.Key).toEqual({ PK: 'ORG#d.com', SK: 'META' });
    });

    it('SECOND fence loss mid-phases ⇒ abort with a retryable error, mergePhase stays archived (no complete write)', async () => {
        const sendMock = await bindSend();
        const archivedSrc = makeOrgMeta({ orgId: 'a.com', status: 'archived', mergedInto: 'b.com', mergePhase: 'archived' });
        const b = makeOrgMeta({ orgId: 'b.com' });
        sendMock.mockResolvedValueOnce({ Item: archivedSrc });
        sendMock.mockResolvedValueOnce({ Item: b });
        sendMock.mockResolvedValueOnce({ Item: b });              // resolve → b active
        sendMock.mockResolvedValueOnce({ Item: archivedSrc });    // attempt 1
        sendMock.mockResolvedValueOnce({ Item: b });
        sendMock.mockResolvedValueOnce({ Items: [{ PK: 'RFQ#a1', SK: 'META', submittedAt: '2026-03-01T00:00:00Z' }] });
        sendMock.mockRejectedValueOnce(cancelErr(['ConditionalCheckFailed', 'None']));
        sendMock.mockResolvedValueOnce({ Item: b });              // re-resolve: still "active" (storm)
        sendMock.mockResolvedValueOnce({ Item: archivedSrc });    // attempt 2
        sendMock.mockResolvedValueOnce({ Item: b });
        sendMock.mockResolvedValueOnce({ Items: [{ PK: 'RFQ#a1', SK: 'META', submittedAt: '2026-03-01T00:00:00Z' }] });
        sendMock.mockRejectedValueOnce(cancelErr(['ConditionalCheckFailed', 'None']));
        const { handler } = await import('./handler');
        await expect(handler(mergeEvent('a.com', 'b.com'))).rejects.toThrow(/fence lost twice/);
        const completes = updateCalls(sendMock).filter((c: any) => String(c[0].input.UpdateExpression).includes('mergePhase = :complete'));
        expect(completes).toHaveLength(0);
    });

    it('idempotent phase re-run: a write-condition cancellation (index 1) means already re-pointed — skip and continue', async () => {
        const sendMock = await bindSend();
        const archivedSrc = makeOrgMeta({ orgId: 'a.com', status: 'archived', mergedInto: 'b.com', mergePhase: 'archived' });
        const b = makeOrgMeta({ orgId: 'b.com' });
        sendMock.mockResolvedValueOnce({ Item: archivedSrc });
        sendMock.mockResolvedValueOnce({ Item: b });
        sendMock.mockResolvedValueOnce({ Item: b });              // resolve
        sendMock.mockResolvedValueOnce({ Item: archivedSrc });
        sendMock.mockResolvedValueOnce({ Item: b });
        sendMock.mockResolvedValueOnce({ Items: [{ PK: 'RFQ#a1', SK: 'META', submittedAt: '2026-03-01T00:00:00Z' }] });
        sendMock.mockRejectedValueOnce(cancelErr(['None', 'ConditionalCheckFailed']));  // already moved by the crashed run
        sendMock.mockResolvedValueOnce({ Items: [] });
        sendMock.mockResolvedValueOnce({ Attributes: { orgId: 'b.com' } });
        sendMock.mockResolvedValueOnce({});                       // complete
        const { handler } = await import('./handler');
        const result: any = await handler(mergeEvent('a.com', 'b.com'));
        expect(result.orgId).toBe('b.com');
        const completes = updateCalls(sendMock).filter((c: any) => String(c[0].input.UpdateExpression).includes('mergePhase = :complete'));
        expect(completes).toHaveLength(1);
    });
});

// -----------------------------------------------------------------------------------------------
// Review fix (Task 8 follow-up): chained-resume double-aggregation. `mergedSources` is per-target:
// src→T aggregates onto T (T.mergedSources += src) then crashes before complete; T→U completes,
// folding T's counts (already including src's) into U; the retry of src→T resumes against U whose
// mergedSources lacks src — WITHOUT the guard, src's counts would be added to U a SECOND time.
// -----------------------------------------------------------------------------------------------
describe('mergeOrganization — chained-resume aggregation guard', () => {
    beforeEach(() => {
        vi.resetModules();
    });

    async function bindSend() {
        const docMock = await import('@aws-sdk/lib-dynamodb');
        const sendMock = vi.fn();
        (docMock.DynamoDBDocumentClient.from as any).mockReturnValue({ send: sendMock });
        return sendMock;
    }
    const mergeEvent = (sourceOrgId: string, targetOrgId: string) => ({
        info: { fieldName: 'mergeOrganization' },
        arguments: { sourceOrgId, targetOrgId },
        identity: { username: 'admin', groups: ['admin'] },
    } as any);
    const orgMeta = (orgId: string, overrides: Record<string, any> = {}) => ({
        PK: `ORG#${orgId}`, SK: 'META', entityType: 'ORGANIZATION', orgId,
        primaryDomain: orgId, aliasDomains: [], type: 'unknown', status: 'active',
        leadScore: 0, rfqCount: 0, orderCount: 0, leadCount: 0,
        totalOrderValueUSD: 0, contactCount: 0, hasActiveInquiry: false,
        firstSeenAt: '2026-01-01T00:00:00.000Z', lastActivityAt: '2026-01-01T00:00:00.000Z',
        ...overrides,
    });

    it('src→T crash-after-aggregation, T→U completes, retry src→T ⇒ src counts land in U exactly ONCE (Phase C skipped on the chained resume)', async () => {
        const sendMock = await bindSend();
        const { handler } = await import('./handler');
        const aggUpdatesOn = (orgId: string, from = 0) =>
            sendMock.mock.calls.slice(from).filter((c: any) =>
                c[0].constructor.name === 'UpdateCommand'
                && c[0].input.Key?.PK === `ORG#${orgId}`
                && c[0].input.ExpressionAttributeValues?.[':rfqCount'] !== undefined);

        // ---- call 1: src→T — aggregation onto T COMMITS, crash before mergePhase='complete'
        const src = orgMeta('src.com', { rfqCount: 2, leadScore: 4 });
        const t0 = orgMeta('t.com', { rfqCount: 1, leadScore: 3 });
        sendMock.mockResolvedValueOnce({ Item: src });
        sendMock.mockResolvedValueOnce({ Item: t0 });
        sendMock.mockResolvedValueOnce({});                       // archive tx (src archived → T)
        sendMock.mockResolvedValueOnce({ Item: src });            // phase reads
        sendMock.mockResolvedValueOnce({ Item: t0 });
        sendMock.mockResolvedValueOnce({ Items: [] });
        sendMock.mockResolvedValueOnce({ Items: [] });
        sendMock.mockResolvedValueOnce({ Attributes: { orgId: 't.com', rfqCount: 3, leadScore: 7 } }); // aggregation onto T
        sendMock.mockRejectedValueOnce(new Error('crash before complete'));
        await expect(handler(mergeEvent('src.com', 't.com'))).rejects.toThrow('crash before complete');
        // src's counts flowed into T exactly once
        const call1Agg = aggUpdatesOn('t.com');
        expect(call1Agg).toHaveLength(1);
        expect(call1Agg[0][0].input.ExpressionAttributeValues[':rfqCount']).toBe(3);   // 1 + 2 (src)
        expect(call1Agg[0][0].input.ExpressionAttributeValues[':leadScore']).toBe(7);  // 3 + 4 (src)
        const afterCall1 = sendMock.mock.calls.length;

        // ---- call 2: T→U completes fully — T's counts (already including src's) fold into U
        const t1 = orgMeta('t.com', { rfqCount: 3, leadScore: 7, mergedSources: new Set(['src.com']) });
        const u0 = orgMeta('u.com', { rfqCount: 5, leadScore: 10 });
        sendMock.mockResolvedValueOnce({ Item: t1 });
        sendMock.mockResolvedValueOnce({ Item: u0 });
        sendMock.mockResolvedValueOnce({});                       // archive tx (T archived → U)
        sendMock.mockResolvedValueOnce({ Item: t1 });
        sendMock.mockResolvedValueOnce({ Item: u0 });
        sendMock.mockResolvedValueOnce({ Items: [] });
        sendMock.mockResolvedValueOnce({ Items: [] });
        sendMock.mockResolvedValueOnce({ Attributes: { orgId: 'u.com', rfqCount: 8, leadScore: 17 } }); // aggregation onto U
        sendMock.mockResolvedValueOnce({});                       // complete on T
        const call2: any = await handler(mergeEvent('t.com', 'u.com'));
        expect(call2.rfqCount).toBe(8);
        const call2Agg = aggUpdatesOn('u.com', afterCall1);
        expect(call2Agg).toHaveLength(1);
        expect(call2Agg[0][0].input.ExpressionAttributeValues[':rfqCount']).toBe(8);   // 5 + 3 — src's 2 in there ONCE
        const afterCall2 = sendMock.mock.calls.length;

        // ---- call 3: retry src→T — chained resume against U; U.mergedSources lacks src.com but
        //      T.mergedSources HAS it ⇒ Phase C must be SKIPPED, U keeps rfqCount 8.
        const srcArchived = orgMeta('src.com', { status: 'archived', mergedInto: 't.com', mergePhase: 'archived', rfqCount: 2, leadScore: 4 });
        const tArchived = orgMeta('t.com', {
            status: 'archived', mergedInto: 'u.com', mergePhase: 'complete',
            rfqCount: 3, leadScore: 7, mergedSources: new Set(['src.com']),
        });
        const u1 = orgMeta('u.com', { rfqCount: 8, leadScore: 17, mergedSources: new Set(['t.com']) });
        sendMock.mockResolvedValueOnce({ Item: srcArchived });    // top source read
        sendMock.mockResolvedValueOnce({ Item: tArchived });      // top target read
        sendMock.mockResolvedValueOnce({ Item: tArchived });      // resolve('t.com') → archived → u
        sendMock.mockResolvedValueOnce({ Item: u1 });             // → ACTIVE u.com
        sendMock.mockResolvedValueOnce({ Item: srcArchived });    // phase reads
        sendMock.mockResolvedValueOnce({ Item: u1 });
        sendMock.mockResolvedValueOnce({ Items: [] });            // GSI2 residuals
        sendMock.mockResolvedValueOnce({ Items: [] });            // lookup residuals
        sendMock.mockResolvedValueOnce({ Item: tArchived });      // GUARD: requested target's retained mergedSources
        sendMock.mockResolvedValueOnce({});                       // complete on src
        const call3: any = await handler(mergeEvent('src.com', 't.com'));

        // src's counts appear in U exactly once: NO second aggregation write on U
        expect(aggUpdatesOn('u.com', afterCall2)).toHaveLength(0);
        expect(call3.rfqCount).toBe(8);                            // U unchanged — not 10
        expect(call3.leadScore).toBe(17);                          // not 21
        // the resume still finishes: mergePhase='complete' flips on src as the last write
        const call3Writes = sendMock.mock.calls.slice(afterCall2).filter((c: any) => c[0].constructor.name === 'UpdateCommand');
        expect(call3Writes).toHaveLength(1);
        expect(call3Writes[0][0].input.Key).toEqual({ PK: 'ORG#src.com', SK: 'META' });
        expect(call3Writes[0][0].input.UpdateExpression).toContain('mergePhase = :complete');
    });

    it('chained resume where the requested target did NOT absorb the source still aggregates onto the successor', async () => {
        const sendMock = await bindSend();
        const { handler } = await import('./handler');
        // A→B archived (phases never ran, B.mergedSources lacks a.com); B→C completed; retry A→B.
        const aArchived = orgMeta('a.com', { status: 'archived', mergedInto: 'b.com', mergePhase: 'archived', rfqCount: 2 });
        const bArchived = orgMeta('b.com', { status: 'archived', mergedInto: 'c.com', mergePhase: 'complete', mergedSources: new Set(['x.com']) });
        const c0 = orgMeta('c.com', { rfqCount: 5 });
        sendMock.mockResolvedValueOnce({ Item: aArchived });
        sendMock.mockResolvedValueOnce({ Item: bArchived });
        sendMock.mockResolvedValueOnce({ Item: bArchived });      // resolve → b archived → c
        sendMock.mockResolvedValueOnce({ Item: c0 });             // c ACTIVE
        sendMock.mockResolvedValueOnce({ Item: aArchived });      // phase reads
        sendMock.mockResolvedValueOnce({ Item: c0 });
        sendMock.mockResolvedValueOnce({ Items: [] });
        sendMock.mockResolvedValueOnce({ Items: [] });
        sendMock.mockResolvedValueOnce({ Item: bArchived });      // GUARD read: b.mergedSources lacks a.com
        sendMock.mockResolvedValueOnce({ Attributes: { orgId: 'c.com', rfqCount: 7 } }); // aggregation PROCEEDS onto C
        sendMock.mockResolvedValueOnce({});                       // complete on a
        const result: any = await handler(mergeEvent('a.com', 'b.com'));
        expect(result.rfqCount).toBe(7);                          // 5 + 2 — aggregated exactly once, onto C
        const agg = sendMock.mock.calls.filter((cl: any) =>
            cl[0].constructor.name === 'UpdateCommand' && cl[0].input.Key?.PK === 'ORG#c.com');
        expect(agg).toHaveLength(1);
        expect(agg[0][0].input.ExpressionAttributeValues[':rfqCount']).toBe(7);
    });
});
