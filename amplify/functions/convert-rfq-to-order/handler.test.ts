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
});
