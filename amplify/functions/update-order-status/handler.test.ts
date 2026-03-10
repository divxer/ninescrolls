import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { isValidTransition } from './handler';

// ---------------------------------------------------------------------------
// Mocks — use vi.hoisted to avoid the hoisting issue
// ---------------------------------------------------------------------------
const { mockGet, mockPut, mockUpdate, mockQuery, MockConditionalCheckFailedException } = vi.hoisted(() => {
    class _MockConditionalCheckFailedException extends Error {
        constructor() {
            super('ConditionalCheckFailed');
            this.name = 'ConditionalCheckFailedException';
        }
    }
    return {
        mockGet: vi.fn(),
        mockPut: vi.fn(),
        mockUpdate: vi.fn(),
        mockQuery: vi.fn(),
        MockConditionalCheckFailedException: _MockConditionalCheckFailedException,
    };
});

vi.mock('@aws-sdk/client-dynamodb', () => ({
    DynamoDBClient: vi.fn().mockImplementation(() => ({})),
    ConditionalCheckFailedException: MockConditionalCheckFailedException,
}));

vi.mock('@aws-sdk/lib-dynamodb', () => ({
    DynamoDBDocumentClient: {
        from: vi.fn().mockReturnValue({
            send: vi.fn().mockImplementation((cmd: unknown) => {
                const name = (cmd as { constructor: { name: string } }).constructor.name;
                if (name === 'GetCommand') return mockGet();
                if (name === 'PutCommand') return mockPut();
                if (name === 'UpdateCommand') return mockUpdate();
                if (name === 'QueryCommand') return mockQuery();
                return Promise.resolve({});
            }),
        }),
    },
    GetCommand: vi.fn().mockImplementation((p) => ({ ...p, constructor: { name: 'GetCommand' } })),
    PutCommand: vi.fn().mockImplementation((p) => ({ ...p, constructor: { name: 'PutCommand' } })),
    UpdateCommand: vi.fn().mockImplementation((p) => ({ ...p, constructor: { name: 'UpdateCommand' } })),
    QueryCommand: vi.fn().mockImplementation((p) => ({ ...p, constructor: { name: 'QueryCommand' } })),
}));

const mockFetch = vi.fn().mockResolvedValue({ ok: true });
global.fetch = mockFetch;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeEvent(body: Record<string, unknown>): APIGatewayProxyEventV2 {
    return {
        version: '2.0', routeKey: 'POST /api/orders/status', rawPath: '/api/orders/status',
        rawQueryString: '', headers: { origin: 'https://ninescrolls.com' },
        requestContext: {
            accountId: '1', apiId: 'a', domainName: 't', domainPrefix: 't',
            http: { method: 'POST', path: '/', protocol: 'HTTP/1.1', sourceIp: '1.2.3.4', userAgent: 'test' },
            requestId: 'r', routeKey: 'r', stage: 'prod', time: '', timeEpoch: 0,
        },
        body: JSON.stringify(body), isBase64Encoded: false,
    } as APIGatewayProxyEventV2;
}

// ---------------------------------------------------------------------------
// State machine unit tests (pure function, no mocks needed)
// ---------------------------------------------------------------------------
describe('isValidTransition', () => {
    const FORWARD = [
        ['INQUIRY', 'QUOTING'],
        ['QUOTING', 'QUOTE_SENT'],
        ['QUOTE_SENT', 'PO_RECEIVED'],
        ['PO_RECEIVED', 'IN_PRODUCTION'],
        ['IN_PRODUCTION', 'SHIPPED'],
        ['SHIPPED', 'INSTALLED'],
        ['INSTALLED', 'CLOSED'],
    ] as const;

    it.each(FORWARD)('allows %s → %s', (from, to) => {
        expect(isValidTransition(from, to)).toBe(true);
    });

    it('allows INQUIRY → DECLINED (special path)', () => {
        expect(isValidTransition('INQUIRY', 'DECLINED')).toBe(true);
    });

    it('rejects backward transitions', () => {
        expect(isValidTransition('QUOTING', 'INQUIRY')).toBe(false);
        expect(isValidTransition('INSTALLED', 'SHIPPED')).toBe(false);
    });

    it('rejects skipping states', () => {
        expect(isValidTransition('INQUIRY', 'QUOTE_SENT')).toBe(false);
        expect(isValidTransition('QUOTING', 'PO_RECEIVED')).toBe(false);
        expect(isValidTransition('INQUIRY', 'INSTALLED')).toBe(false);
    });

    it('rejects DECLINED from non-INQUIRY states', () => {
        expect(isValidTransition('QUOTING', 'DECLINED')).toBe(false);
        expect(isValidTransition('PO_RECEIVED', 'DECLINED')).toBe(false);
        expect(isValidTransition('INSTALLED', 'DECLINED')).toBe(false);
    });

    it('rejects same-state transitions', () => {
        expect(isValidTransition('INQUIRY', 'INQUIRY')).toBe(false);
        expect(isValidTransition('QUOTING', 'QUOTING')).toBe(false);
    });

    it('rejects transitions from terminal states', () => {
        expect(isValidTransition('CLOSED', 'INQUIRY')).toBe(false);
        expect(isValidTransition('DECLINED', 'QUOTING')).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Handler tests
// ---------------------------------------------------------------------------
describe('update-order-status handler', () => {
    let handler: typeof import('./handler').handler;

    beforeEach(async () => {
        vi.clearAllMocks();
        process.env.INTELLIGENCE_TABLE = 'NineScrolls-Intelligence';
        process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';

        mockUpdate.mockResolvedValue({});
        mockPut.mockResolvedValue({});
        mockGet.mockResolvedValue({
            Item: {
                orderId: 'ord-20260310-x7k9', status: 'SHIPPED',
                productModel: 'TL-ICP-300', institution: 'Stanford University',
                feedbackScheduleCreated: false,
            },
        });
        mockQuery.mockResolvedValue({
            Items: [{
                contactId: 'ct-abc123', contactName: 'Dr. Jane Smith',
                contactEmail: 'jane@stanford.edu', role: 'PI', feedbackInvite: true,
            }],
        });

        const mod = await import('./handler');
        handler = mod.handler;
    });

    it('updates status successfully', async () => {
        const event = makeEvent({
            orderId: 'ord-20260310-x7k9',
            currentStatus: 'INQUIRY',
            newStatus: 'QUOTING',
            operator: 'admin',
        });
        const result = await handler(event, {} as never, (() => {}) as never);
        const body = JSON.parse((result as { body: string }).body);

        expect((result as { statusCode: number }).statusCode).toBe(200);
        expect(body.success).toBe(true);
        expect(body.newStatus).toBe('QUOTING');
    });

    it('returns 400 for invalid transition', async () => {
        const event = makeEvent({
            orderId: 'ord-20260310-x7k9',
            currentStatus: 'INQUIRY',
            newStatus: 'INSTALLED',
            operator: 'admin',
        });
        const result = await handler(event, {} as never, (() => {}) as never);
        expect((result as { statusCode: number }).statusCode).toBe(400);
    });

    it('returns 400 when declining without reason', async () => {
        const event = makeEvent({
            orderId: 'ord-20260310-x7k9',
            currentStatus: 'INQUIRY',
            newStatus: 'DECLINED',
            operator: 'admin',
        });
        const result = await handler(event, {} as never, (() => {}) as never);
        expect((result as { statusCode: number }).statusCode).toBe(400);
        const body = JSON.parse((result as { body: string }).body);
        expect(body.error).toContain('declineReason');
    });

    it('allows DECLINED with reason', async () => {
        const event = makeEvent({
            orderId: 'ord-20260310-x7k9',
            currentStatus: 'INQUIRY',
            newStatus: 'DECLINED',
            declineReason: 'Budget mismatch',
            operator: 'admin',
        });
        const result = await handler(event, {} as never, (() => {}) as never);
        expect((result as { statusCode: number }).statusCode).toBe(200);
    });

    it('returns 409 on concurrent modification (ConditionalCheckFailedException)', async () => {
        mockUpdate.mockRejectedValueOnce(new MockConditionalCheckFailedException());

        const event = makeEvent({
            orderId: 'ord-20260310-x7k9',
            currentStatus: 'INQUIRY',
            newStatus: 'QUOTING',
            operator: 'admin',
        });
        const result = await handler(event, {} as never, (() => {}) as never);
        expect((result as { statusCode: number }).statusCode).toBe(409);
        const body = JSON.parse((result as { body: string }).body);
        expect(body.error).toContain('another user');
    });

    it('creates FEEDBACK_SCHEDULE when transitioning to INSTALLED', async () => {
        const event = makeEvent({
            orderId: 'ord-20260310-x7k9',
            currentStatus: 'SHIPPED',
            newStatus: 'INSTALLED',
            statusDate: '2026-03-10',
            operator: 'admin',
        });
        const result = await handler(event, {} as never, (() => {}) as never);
        const body = JSON.parse((result as { body: string }).body);

        expect((result as { statusCode: number }).statusCode).toBe(200);
        expect(body.feedbackSchedulesCreated).toBeGreaterThan(0);
    });

    it('skips FEEDBACK_SCHEDULE if already created (idempotency)', async () => {
        mockGet.mockResolvedValue({
            Item: {
                orderId: 'ord-20260310-x7k9', status: 'SHIPPED',
                productModel: 'TL-ICP-300', institution: 'Stanford',
                feedbackScheduleCreated: true,
            },
        });

        const event = makeEvent({
            orderId: 'ord-20260310-x7k9',
            currentStatus: 'SHIPPED',
            newStatus: 'INSTALLED',
            statusDate: '2026-03-10',
            operator: 'admin',
        });
        const result = await handler(event, {} as never, (() => {}) as never);
        const body = JSON.parse((result as { body: string }).body);

        expect((result as { statusCode: number }).statusCode).toBe(200);
        expect(body.feedbackSchedulesCreated).toBe(0);
    });

    it('returns 400 for missing required fields', async () => {
        const event = makeEvent({ orderId: 'ord-123' });
        const result = await handler(event, {} as never, (() => {}) as never);
        expect((result as { statusCode: number }).statusCode).toBe(400);
    });

    it('handles CORS preflight', async () => {
        const event = makeEvent({});
        event.requestContext.http.method = 'OPTIONS';
        event.body = undefined as unknown as string;
        const result = await handler(event, {} as never, (() => {}) as never);
        expect((result as { statusCode: number }).statusCode).toBe(200);
    });

    it('sends Slack notification', async () => {
        const event = makeEvent({
            orderId: 'ord-20260310-x7k9',
            currentStatus: 'INQUIRY',
            newStatus: 'QUOTING',
            operator: 'admin',
        });
        await handler(event, {} as never, (() => {}) as never);
        expect(mockFetch).toHaveBeenCalled();
    });
});
