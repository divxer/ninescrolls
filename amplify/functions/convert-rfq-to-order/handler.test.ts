import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockGet = vi.fn();
const mockPut = vi.fn();
const mockUpdate = vi.fn();
const mockSend = vi.fn().mockImplementation((cmd: unknown) => {
    const name = (cmd as { constructor: { name: string } }).constructor.name;
    if (name === 'GetCommand') return mockGet();
    if (name === 'PutCommand') return mockPut();
    if (name === 'UpdateCommand') return mockUpdate();
    return Promise.resolve({});
});

vi.mock('@aws-sdk/client-dynamodb', () => ({
    DynamoDBClient: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@aws-sdk/lib-dynamodb', () => ({
    DynamoDBDocumentClient: { from: vi.fn().mockReturnValue({ send: mockSend }) },
    GetCommand: vi.fn().mockImplementation((p) => ({ ...p, constructor: { name: 'GetCommand' } })),
    PutCommand: vi.fn().mockImplementation((p) => ({ ...p, constructor: { name: 'PutCommand' } })),
    UpdateCommand: vi.fn().mockImplementation((p) => ({ ...p, constructor: { name: 'UpdateCommand' } })),
    QueryCommand: vi.fn().mockImplementation((p) => ({ ...p, constructor: { name: 'QueryCommand' } })),
}));

vi.mock('@aws-sdk/client-s3', () => ({
    S3Client: vi.fn().mockImplementation(() => ({ send: vi.fn().mockResolvedValue({}) })),
    CopyObjectCommand: vi.fn(),
}));

const mockInvokeOrgApi = vi.fn().mockResolvedValue({ matchedOrgId: null });
vi.mock('../../lib/organization/invoke-org-api', () => ({
    invokeOrganizationApi: (payload: unknown) => mockInvokeOrgApi(payload),
}));

// Mock CRM timeline emit (fire-and-forget; helper swallows its own dispatch failures)
const mockEmitTimelineEventToCrm = vi.fn().mockResolvedValue(undefined);
vi.mock('../../lib/crm/invoke-crm-api', () => ({
    emitTimelineEventToCrm: (...args: unknown[]) => mockEmitTimelineEventToCrm(...args),
}));

const mockFetch = vi.fn().mockResolvedValue({ ok: true });
global.fetch = mockFetch;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeEvent(body: Record<string, unknown>): APIGatewayProxyEventV2 {
    return {
        version: '2.0', routeKey: 'POST /api/rfq/convert', rawPath: '/api/rfq/convert',
        rawQueryString: '', headers: { origin: 'https://ninescrolls.com' },
        requestContext: {
            accountId: '1', apiId: 'a', domainName: 't', domainPrefix: 't',
            http: { method: 'POST', path: '/', protocol: 'HTTP/1.1', sourceIp: '1.2.3.4', userAgent: 'test' },
            requestId: 'r', routeKey: 'r', stage: 'prod', time: '', timeEpoch: 0,
        },
        body: JSON.stringify(body), isBase64Encoded: false,
    } as APIGatewayProxyEventV2;
}

const PENDING_RFQ = {
    PK: 'RFQ#rfq-20260310-abc123', SK: 'META',
    rfqId: 'rfq-20260310-abc123', referenceNumber: 'RFQ-20260310-ABC1',
    status: 'pending', name: 'Dr. Jane Smith', email: 'jane@stanford.edu',
    phone: '+1-650-555-1234', institution: 'Stanford University',
    department: 'MSE', role: 'PI', equipmentCategory: 'ICP',
    specificModel: 'TL-ICP-300', keySpecifications: '8-inch chamber',
    submittedAt: '2026-03-10T12:00:00Z', matchedOrgId: 'org-stanford',
    attachmentKeys: ['rfqs/rfq-20260310-abc123/spec.pdf'],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('convert-rfq-to-order handler', () => {
    let handler: typeof import('./handler').handler;

    beforeEach(async () => {
        vi.clearAllMocks();
        process.env.INTELLIGENCE_TABLE = 'NineScrolls-Intelligence';
        process.env.DOCUMENTS_BUCKET = 'ninescrolls-order-documents';
        process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';

        mockGet.mockResolvedValue({ Item: PENDING_RFQ });
        mockPut.mockResolvedValue({});
        mockUpdate.mockResolvedValue({});
        mockInvokeOrgApi.mockResolvedValue({ matchedOrgId: null });
        mockEmitTimelineEventToCrm.mockResolvedValue(undefined);

        const mod = await import('./handler');
        handler = mod.handler;
    });

    it('converts a pending RFQ to an order', async () => {
        const event = makeEvent({ rfqId: 'rfq-20260310-abc123', operator: 'admin' });
        const result = await handler(event, {} as never, (() => {}) as never);
        const body = JSON.parse((result as { body: string }).body);

        expect((result as { statusCode: number }).statusCode).toBe(200);
        expect(body.success).toBe(true);
        expect(body.orderId).toMatch(/^ord-\d{8}-[a-f0-9]{4}$/);
        expect(body.rfqId).toBe('rfq-20260310-abc123');
    });

    it('returns 400 when rfqId is missing', async () => {
        const event = makeEvent({ operator: 'admin' });
        const result = await handler(event, {} as never, (() => {}) as never);
        expect((result as { statusCode: number }).statusCode).toBe(400);
    });

    it('returns 404 when RFQ not found', async () => {
        mockGet.mockResolvedValue({ Item: undefined });
        const event = makeEvent({ rfqId: 'rfq-nonexistent', operator: 'admin' });
        const result = await handler(event, {} as never, (() => {}) as never);
        expect((result as { statusCode: number }).statusCode).toBe(404);
    });

    it('returns 409 when RFQ is already converted', async () => {
        mockGet.mockResolvedValue({ Item: { ...PENDING_RFQ, status: 'converted' } });
        const event = makeEvent({ rfqId: 'rfq-20260310-abc123', operator: 'admin' });
        const result = await handler(event, {} as never, (() => {}) as never);
        expect((result as { statusCode: number }).statusCode).toBe(409);
    });

    it('returns 409 when RFQ is declined', async () => {
        mockGet.mockResolvedValue({ Item: { ...PENDING_RFQ, status: 'declined' } });
        const event = makeEvent({ rfqId: 'rfq-20260310-abc123', operator: 'admin' });
        const result = await handler(event, {} as never, (() => {}) as never);
        expect((result as { statusCode: number }).statusCode).toBe(409);
    });

    it('handles CORS preflight', async () => {
        const event = makeEvent({});
        event.requestContext.http.method = 'OPTIONS';
        event.body = undefined as unknown as string;
        const result = await handler(event, {} as never, (() => {}) as never);
        expect((result as { statusCode: number }).statusCode).toBe(200);
    });

    it('sends Slack notification on success', async () => {
        const event = makeEvent({ rfqId: 'rfq-20260310-abc123', operator: 'admin' });
        await handler(event, {} as never, (() => {}) as never);

        const slackCall = mockFetch.mock.calls.find(
            (call: string[]) => call[0].includes('slack')
        );
        expect(slackCall).toBeDefined();
    });

    it('allows overriding productModel', async () => {
        const event = makeEvent({
            rfqId: 'rfq-20260310-abc123',
            operator: 'admin',
            productModel: 'TL-ICP-500',
        });
        const result = await handler(event, {} as never, (() => {}) as never);
        expect((result as { statusCode: number }).statusCode).toBe(200);
    });

    it('invokes organization-api with source=order and orderValueUSD', async () => {
        const event = makeEvent({
            rfqId: 'rfq-20260310-abc123',
            operator: 'admin',
            quoteAmount: 150000,
        });
        const result = await handler(event, {} as never, (() => {}) as never);
        expect((result as { statusCode: number }).statusCode).toBe(200);
        expect(mockInvokeOrgApi).toHaveBeenCalledWith(expect.objectContaining({
            action: 'upsertFromSubmission',
            source: 'order',
            email: PENDING_RFQ.email,
            institution: PENDING_RFQ.institution,
            orderValueUSD: 150000,
        }));
    });

    it('returns 200 even when organization-api throws', async () => {
        mockInvokeOrgApi.mockRejectedValueOnce(new Error('org-api boom'));
        const event = makeEvent({ rfqId: 'rfq-20260310-abc123', operator: 'admin' });
        const result = await handler(event, {} as never, (() => {}) as never);
        expect((result as { statusCode: number }).statusCode).toBe(200);
    });

    it('emits order_created with the org-api matchedOrgId (finalMatchedOrgId)', async () => {
        // RFQ had no prior match; org-api upsert resolves the org → emit must use that value.
        mockGet.mockResolvedValue({ Item: { ...PENDING_RFQ, matchedOrgId: undefined } });
        mockInvokeOrgApi.mockResolvedValueOnce({ matchedOrgId: 'org-stanford-upserted' });

        const event = makeEvent({ rfqId: 'rfq-20260310-abc123', operator: 'admin' });
        const result = await handler(event, {} as never, (() => {}) as never);
        const body = JSON.parse((result as { body: string }).body);

        expect((result as { statusCode: number }).statusCode).toBe(200);
        expect(mockEmitTimelineEventToCrm).toHaveBeenCalledTimes(1);

        const emitArg = mockEmitTimelineEventToCrm.mock.calls[0][0] as {
            kind: string;
            sourceEntityId: string;
            resolveInput: { matchedOrgId?: string };
            payload: { rfqId?: string | null };
        };
        expect(emitArg.kind).toBe('order_created');
        expect(emitArg.sourceEntityId).toBe(body.orderId);
        expect(emitArg.payload.rfqId).toBe('rfq-20260310-abc123');
        // finalMatchedOrgId = orgResult.matchedOrgId (org-api won)
        expect(emitArg.resolveInput.matchedOrgId).toBe('org-stanford-upserted');
    });

    it('falls back to the RFQ existing matchedOrgId when org-api returns null', async () => {
        // RFQ already matched; org-api returns null → emit must keep the RFQ's existing value.
        mockGet.mockResolvedValue({ Item: { ...PENDING_RFQ, matchedOrgId: 'org-stanford' } });
        mockInvokeOrgApi.mockResolvedValueOnce({ matchedOrgId: null });

        const event = makeEvent({ rfqId: 'rfq-20260310-abc123', operator: 'admin' });
        const result = await handler(event, {} as never, (() => {}) as never);

        expect((result as { statusCode: number }).statusCode).toBe(200);
        expect(mockEmitTimelineEventToCrm).toHaveBeenCalledTimes(1);

        const emitArg = mockEmitTimelineEventToCrm.mock.calls[0][0] as {
            resolveInput: { matchedOrgId?: string };
        };
        // finalMatchedOrgId = rfq.matchedOrgId (org-api returned null)
        expect(emitArg.resolveInput.matchedOrgId).toBe('org-stanford');
    });

    it('P2C-T8b: matchedOrgId backfill write carries a ConditionExpression that refuses to overwrite a stamped or real-org record', async () => {
        mockGet.mockResolvedValue({ Item: { ...PENDING_RFQ, matchedOrgId: undefined } });
        mockInvokeOrgApi.mockResolvedValueOnce({ matchedOrgId: 'org-stanford-upserted' });

        const event = makeEvent({ rfqId: 'rfq-20260310-abc123', operator: 'admin' });
        await handler(event, {} as never, (() => {}) as never);

        const backfillCall = mockSend.mock.calls.find((c: unknown[]) => {
            const arg = c[0] as { Key?: { SK?: string }; UpdateExpression?: string };
            return arg.Key?.SK === 'META' && (arg.UpdateExpression ?? '').includes('matchedOrgId');
        });
        expect(backfillCall).toBeDefined();
        const params = backfillCall![0] as { ConditionExpression?: string; ExpressionAttributeValues: Record<string, string> };
        expect(params.ConditionExpression).toContain('attribute_not_exists(matchedOrgLinkGeneration)');
        expect(params.ConditionExpression).toContain('attribute_type(matchedOrgId, :nullType)');
        expect(params.ConditionExpression).toMatch(/attribute_not_exists\(matchedOrgId\)|matchedOrgId = :empty|begins_with\(matchedOrgId, :unres\)/);
        expect(params.ExpressionAttributeValues[':nullType']).toBe('NULL');
        expect(params.ExpressionAttributeValues[':empty']).toBe('');
        expect(params.ExpressionAttributeValues[':unres']).toBe('unresolved-');
    });

    it('P2C-T8b: a CCFE on the matchedOrgId backfill is swallowed as a no-op — the conversion itself still succeeds', async () => {
        mockGet.mockResolvedValue({ Item: { ...PENDING_RFQ, matchedOrgId: undefined } });
        mockInvokeOrgApi.mockResolvedValueOnce({ matchedOrgId: 'org-stanford-upserted' });
        mockUpdate.mockRejectedValueOnce(Object.assign(new Error('linked'), { name: 'ConditionalCheckFailedException' }));

        const event = makeEvent({ rfqId: 'rfq-20260310-abc123', operator: 'admin' });
        const result = await handler(event, {} as never, (() => {}) as never);

        expect((result as { statusCode: number }).statusCode).toBe(200);
        expect(JSON.parse((result as { body: string }).body).success).toBe(true);
    });

    it('P2C-T8b (creation-path pin): the initial ORDER Put sets matchedOrgId unconditionally on a fresh PK — no guard needed or applied', async () => {
        const event = makeEvent({ rfqId: 'rfq-20260310-abc123', operator: 'admin' });
        await handler(event, {} as never, (() => {}) as never);

        const creationPut = mockSend.mock.calls.find((c: unknown[]) => {
            const arg = c[0] as { Item?: { SK?: string; matchedOrgId?: unknown } };
            return arg.Item?.SK === 'META' && arg.Item?.matchedOrgId === PENDING_RFQ.matchedOrgId;
        });
        expect(creationPut).toBeDefined();
        expect((creationPut![0] as { ConditionExpression?: string }).ConditionExpression).toBeUndefined();
    });
});
