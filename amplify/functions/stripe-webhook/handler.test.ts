import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — must be defined before handler import
// ---------------------------------------------------------------------------
vi.mock('$amplify/env/stripe-webhook', () => ({
    env: {
        STRIPE_SECRET_KEY: 'sk_test_x',
        STRIPE_WEBHOOK_SECRET: 'whsec_x',
        SENDGRID_API_KEY: 'SG.x',
        APP_URL: 'https://www.ninescrolls.com',
    },
}));

const mockConstructEvent = vi.fn();
const mockRetrieve = vi.fn();
vi.mock('stripe', () => ({
    default: vi.fn().mockImplementation(() => ({
        webhooks: { constructEvent: mockConstructEvent },
        checkout: { sessions: { retrieve: mockRetrieve } },
    })),
}));

const mockSgSend = vi.fn().mockResolvedValue([{}]);
vi.mock('@sendgrid/mail', () => ({
    setApiKey: vi.fn(),
    send: (...args: unknown[]) => mockSgSend(...args),
}));

const mockPut = vi.fn();
const mockSend = vi.fn().mockImplementation((cmd: unknown) => {
    const name = (cmd as { constructor: { name: string } }).constructor.name;
    if (name === 'PutCommand') return mockPut(cmd);
    return Promise.resolve({});
});

vi.mock('@aws-sdk/client-dynamodb', () => ({
    DynamoDBClient: vi.fn().mockImplementation(() => ({})),
}));
vi.mock('@aws-sdk/lib-dynamodb', () => ({
    DynamoDBDocumentClient: { from: vi.fn().mockReturnValue({ send: mockSend }) },
    PutCommand: vi.fn().mockImplementation((p) => ({ ...p, constructor: { name: 'PutCommand' } })),
}));

const mockBridge = vi.fn().mockResolvedValue({});
vi.mock('../../lib/orders/invoke-order-api.js', () => ({
    invokeCreateStripeOrder: (...args: unknown[]) => mockBridge(...args),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const EVENT_CREATED_EPOCH = 1753212000; // stable Stripe event timestamp

function makeSession(overrides: Record<string, unknown> = {}) {
    return {
        id: 'cs_live_test123',
        payment_status: 'paid',
        payment_intent: 'pi_test123',
        amount_total: 799900,
        currency: 'usd',
        customer_details: { email: 'buyer@example.com', name: 'Test Buyer' },
        metadata: {
            contactEmail: 'buyer@example.com',
            contactFirstName: 'Test',
            contactLastName: 'Buyer',
            contactPhone: '5551234567',
            shippingLine1: '1 Main St',
            shippingCity: 'Boston',
            shippingState: 'MA',
            shippingPostalCode: '02135',
            shippingCountry: 'US',
        },
        line_items: {
            data: [{
                description: 'HY-4L - RF (13.56 MHz) Plasma Cleaner',
                quantity: 1,
                price: { unit_amount: 799900, currency: 'usd', product: { name: 'HY-4L' } },
            }],
        },
        ...overrides,
    };
}

function makeStripeEvent(type: string, session: Record<string, unknown>) {
    return { id: 'evt_test1', type, created: EVENT_CREATED_EPOCH, data: { object: session } };
}

function makeApiGatewayEvent() {
    return {
        body: '{}',
        isBase64Encoded: false,
        headers: { 'stripe-signature': 'sig' },
    };
}

let handler: (event: any) => Promise<{ statusCode: number; body: string }>;

beforeAll(async () => {
    // Module-level table wiring reads process.env at import time
    process.env.STRIPE_WEBHOOK_EVENTS_TABLE = 'events-table';
    process.env.STRIPE_ORDERS_TABLE = 'orders-table';
    handler = (await import('./handler')).handler as any;
});

beforeEach(() => {
    mockConstructEvent.mockReset();
    mockRetrieve.mockReset();
    mockSgSend.mockClear();
    mockSgSend.mockResolvedValue([{}]);
    mockPut.mockReset();
    mockPut.mockResolvedValue({});
    mockBridge.mockReset();
    mockBridge.mockResolvedValue({});
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('stripe-webhook handler', () => {
    it('skips unpaid delayed-payment sessions entirely (no persist, no emails, no bridge)', async () => {
        const session = makeSession({ payment_status: 'unpaid' });
        mockConstructEvent.mockReturnValue(makeStripeEvent('checkout.session.completed', session));
        mockRetrieve.mockResolvedValue(session);

        const res = await handler(makeApiGatewayEvent());

        expect(res.statusCode).toBe(200);
        expect(mockPut).not.toHaveBeenCalled();
        expect(mockSgSend).not.toHaveBeenCalled();
        expect(mockBridge).not.toHaveBeenCalled();
    });

    it('processes a paid session: persists, emails once, bridges with the event timestamp', async () => {
        const session = makeSession();
        mockConstructEvent.mockReturnValue(makeStripeEvent('checkout.session.completed', session));
        mockRetrieve.mockResolvedValue(session);

        const res = await handler(makeApiGatewayEvent());

        expect(res.statusCode).toBe(200);
        // Customer confirmation + sales notification
        expect(mockSgSend).toHaveBeenCalledTimes(2);
        expect(mockBridge).toHaveBeenCalledTimes(1);
        const payload = mockBridge.mock.calls[0][0] as Record<string, unknown>;
        expect(payload.stripeSessionId).toBe('cs_live_test123');
        expect(payload.amountTotalCents).toBe(799900);
        // paidAt comes from the Stripe event's created epoch, not processing time
        expect(payload.paidAt).toBe(new Date(EVENT_CREATED_EPOCH * 1000).toISOString());
    });

    it('handles checkout.session.async_payment_succeeded like a paid completion', async () => {
        const session = makeSession();
        mockConstructEvent.mockReturnValue(makeStripeEvent('checkout.session.async_payment_succeeded', session));
        mockRetrieve.mockResolvedValue(session);

        const res = await handler(makeApiGatewayEvent());

        expect(res.statusCode).toBe(200);
        expect(mockSgSend).toHaveBeenCalledTimes(2);
        expect(mockBridge).toHaveBeenCalledTimes(1);
    });

    it('on duplicate delivery: suppresses emails but still runs the idempotent bridge', async () => {
        const session = makeSession();
        mockConstructEvent.mockReturnValue(makeStripeEvent('checkout.session.completed', session));
        mockRetrieve.mockResolvedValue(session);
        // persistOrder's conditional Put fails → 'existing'
        const dup = new Error('exists');
        dup.name = 'ConditionalCheckFailedException';
        mockPut.mockRejectedValueOnce(dup);

        const res = await handler(makeApiGatewayEvent());

        expect(res.statusCode).toBe(200);
        expect(mockSgSend).not.toHaveBeenCalled();
        expect(mockBridge).toHaveBeenCalledTimes(1);
    });

    it('returns 500 when the bridge fails, so Stripe retries the delivery', async () => {
        const session = makeSession();
        mockConstructEvent.mockReturnValue(makeStripeEvent('checkout.session.completed', session));
        mockRetrieve.mockResolvedValue(session);
        mockBridge.mockRejectedValueOnce(new Error('order-api unavailable'));

        const res = await handler(makeApiGatewayEvent());

        expect(res.statusCode).toBe(500);
        // Emails were already sent on this first delivery; the retry will hit
        // the 'existing' branch and only re-run the bridge.
        expect(mockSgSend).toHaveBeenCalledTimes(2);
    });

    it('skips the bridge (without failing) when the session has no customer email', async () => {
        const session = makeSession({
            customer_details: { email: null, name: null },
            metadata: {},
        });
        mockConstructEvent.mockReturnValue(makeStripeEvent('checkout.session.completed', session));
        mockRetrieve.mockResolvedValue(session);

        const res = await handler(makeApiGatewayEvent());

        expect(res.statusCode).toBe(200);
        expect(mockBridge).not.toHaveBeenCalled();
    });

    it('skips the bridge (without failing) when the session amount is zero', async () => {
        const session = makeSession({ amount_total: 0 });
        mockConstructEvent.mockReturnValue(makeStripeEvent('checkout.session.completed', session));
        mockRetrieve.mockResolvedValue(session);

        const res = await handler(makeApiGatewayEvent());

        // A retry can never fix a zero amount — 200, not 500
        expect(res.statusCode).toBe(200);
        expect(mockBridge).not.toHaveBeenCalled();
    });

    it('rejects requests without a stripe-signature header', async () => {
        const res = await handler({ body: '{}', isBase64Encoded: false, headers: {} });
        expect(res.statusCode).toBe(400);
        expect(mockBridge).not.toHaveBeenCalled();
    });
});
