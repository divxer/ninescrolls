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

    it('happy path: rewrites GSI2 items, aggregates counts, archives source', async () => {
        const docMock = await import('@aws-sdk/lib-dynamodb');
        const sendMock = vi.fn();
        (docMock.DynamoDBDocumentClient.from as any).mockReturnValue({ send: sendMock });

        // GetItem(source), GetItem(target)
        sendMock.mockResolvedValueOnce({ Item: makeOrgMeta({
            orgId: 'gelest.com',
            primaryDomain: 'gelest.com',
            rfqCount: 2, orderCount: 1, leadCount: 1, totalOrderValueUSD: 10000,
            contactCount: 3, leadScore: 5, hasActiveInquiry: true,
            firstSeenAt: '2026-01-01T00:00:00.000Z',
            lastActivityAt: '2026-03-15T00:00:00.000Z',
            latestRFQDate: '2026-03-15T00:00:00.000Z',
        }) });
        sendMock.mockResolvedValueOnce({ Item: makeOrgMeta({
            orgId: 'mcgc.com',
            primaryDomain: 'mcgc.com',
            aliasDomains: ['mitsubishichem.com'],
            rfqCount: 1, orderCount: 0, leadCount: 0, totalOrderValueUSD: 0,
            contactCount: 1, leadScore: 3,
            firstSeenAt: '2026-02-01T00:00:00.000Z',
            lastActivityAt: '2026-02-10T00:00:00.000Z',
            latestRFQDate: '2026-02-10T00:00:00.000Z',
        }) });
        // GSI2 Query for linked items
        sendMock.mockResolvedValueOnce({ Items: [
            { PK: 'RFQ#r1', SK: 'META', submittedAt: '2026-03-15T00:00:00.000Z' },
            { PK: 'ORDER#o1', SK: 'META', quoteDate: '2026-03-10T00:00:00.000Z' },
            { PK: 'LEAD#l1', SK: 'META', submittedAt: '2026-02-20T00:00:00.000Z' },
        ] });
        // UpdateItem x3 for each linked item
        sendMock.mockResolvedValueOnce({});
        sendMock.mockResolvedValueOnce({});
        sendMock.mockResolvedValueOnce({});
        // ORG_DOMAIN_LOOKUP Query — empty
        sendMock.mockResolvedValueOnce({ Items: [] });
        // UpdateItem target META
        sendMock.mockResolvedValueOnce({ Attributes: {
            orgId: 'mcgc.com',
            rfqCount: 3, orderCount: 1, leadCount: 1,
            leadScore: 8,
            aliasDomains: ['mitsubishichem.com', 'gelest.com'],
        } });
        // UpdateItem source META archive
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

        // Inspect the 3 linked-item rewrites
        const linkedUpdates = sendMock.mock.calls.filter((c: any) => {
            const cmd = c[0];
            return cmd.constructor.name === 'UpdateCommand'
                && cmd.input.Key?.PK?.match(/^(RFQ|ORDER|LEAD)#/);
        });
        expect(linkedUpdates.length).toBe(3);
        for (const call of linkedUpdates) {
            const v = call[0].input.ExpressionAttributeValues;
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

        // Source META archive update
        const sourceArchive = sendMock.mock.calls.find((c: any) => {
            const cmd = c[0];
            return cmd.constructor.name === 'UpdateCommand'
                && cmd.input.Key?.PK === 'ORG#gelest.com'
                && cmd.input.Key?.SK === 'META';
        });
        expect(sourceArchive).toBeDefined();
        const sExpr = sourceArchive![0].input.UpdateExpression as string;
        expect(sExpr).toContain('mergedInto');
        expect(sExpr).toContain('mergedAt');
        expect(sExpr).toContain('REMOVE GSI1PK, GSI1SK, GSI3PK, GSI3SK');
        expect(sourceArchive![0].input.ExpressionAttributeValues[':archived']).toBe('archived');
        expect(sourceArchive![0].input.ExpressionAttributeValues[':target']).toBe('mcgc.com');
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
        sendMock.mockResolvedValueOnce({ Item: makeOrgMeta({
            orgId: 'src.com', leadScore: 5,
        }) });
        sendMock.mockResolvedValueOnce({ Item: makeOrgMeta({
            orgId: 'tgt.com', leadScore: 7, // not yet indexed
        }) });
        // GSI2 linked query — empty
        sendMock.mockResolvedValueOnce({ Items: [] });
        // Lookup query — empty
        sendMock.mockResolvedValueOnce({ Items: [] });
        // Target META update
        sendMock.mockResolvedValueOnce({ Attributes: { orgId: 'tgt.com', leadScore: 12 } });
        // Source META archive
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

        sendMock.mockResolvedValueOnce({ Item: makeOrgMeta({
            orgId: 'src.com',
            primaryDomain: 'src.com',
            aliasDomains: sourceAliases,
        }) });
        sendMock.mockResolvedValueOnce({ Item: makeOrgMeta({
            orgId: 'tgt.com',
            primaryDomain: 'tgt.com',
            aliasDomains: targetAliases,
        }) });
        sendMock.mockResolvedValueOnce({ Items: [] });
        sendMock.mockResolvedValueOnce({ Items: [] });
        sendMock.mockResolvedValueOnce({ Attributes: { orgId: 'tgt.com' } });
        sendMock.mockResolvedValueOnce({});

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

        // 1. GetItem source (still active — archive step never ran)
        sendMock.mockResolvedValueOnce({ Item: {
            PK: 'ORG#src.com', SK: 'META', orgId: 'src.com', status: 'active',
            primaryDomain: 'src.com', leadScore: 8, rfqCount: 1, orderCount: 0, leadCount: 0,
            firstSeenAt: '2026-04-01T00:00:00Z', lastActivityAt: '2026-04-15T00:00:00Z',
        } });
        // 2. GetItem target (already has src.com in mergedSources)
        sendMock.mockResolvedValueOnce({ Item: {
            PK: 'ORG#tgt.com', SK: 'META', orgId: 'tgt.com', status: 'active',
            primaryDomain: 'tgt.com', leadScore: 20, rfqCount: 5, orderCount: 2, leadCount: 1,
            mergedSources: new Set(['src.com']),
            firstSeenAt: '2026-03-01T00:00:00Z', lastActivityAt: '2026-05-01T00:00:00Z',
        } });
        // 3. GSI2 Query for linked items (already moved on previous run, returns 0)
        sendMock.mockResolvedValueOnce({ Items: [] });
        // 4. Query for ORG_DOMAIN_LOOKUP pointing at src.com (already repointed previously, returns 0)
        sendMock.mockResolvedValueOnce({ Items: [] });
        // 5. UpdateCommand target — CCFE because mergedSources already contains src.com
        const ccfe = new Error('The conditional request failed');
        (ccfe as any).name = 'ConditionalCheckFailedException';
        sendMock.mockRejectedValueOnce(ccfe);
        // 6. GetItem target (after CCFE) — return current state
        sendMock.mockResolvedValueOnce({ Item: {
            PK: 'ORG#tgt.com', SK: 'META', orgId: 'tgt.com', leadScore: 28, rfqCount: 6, // already aggregated
        } });
        // 7. UpdateCommand source — archive (idempotent SET)
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

        // Source archive must still have been attempted
        const sourceArchive = sendMock.mock.calls.find((c: any) => {
            const cmd = c[0];
            return cmd.constructor.name === 'UpdateCommand'
                && cmd.input.Key?.PK === 'ORG#src.com'
                && (cmd.input.UpdateExpression as string).includes('mergedInto');
        });
        expect(sourceArchive).toBeDefined();
        warnSpy.mockRestore();
    });
});
