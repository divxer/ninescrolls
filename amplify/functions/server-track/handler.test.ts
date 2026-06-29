import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import {
    isPrivateIP,
    getCorsHeaders,
    validatePageTimeFlush,
    validatePageViewStore,
} from './handler';

// The handler lazily constructs AWS clients; stub the SDK so importing it (and
// any branch that touches a client) never reaches the network. The branches
// exercised below return before any I/O, so the stubs just need to exist.
vi.mock('@aws-sdk/client-dynamodb', () => ({ DynamoDBClient: vi.fn(() => ({})) }));
vi.mock('@aws-sdk/lib-dynamodb', () => ({
    DynamoDBDocumentClient: { from: vi.fn(() => ({ send: vi.fn() })) },
    GetCommand: class { input: unknown; constructor(i: unknown) { this.input = i; } },
    PutCommand: class { input: unknown; constructor(i: unknown) { this.input = i; } },
    UpdateCommand: class { input: unknown; constructor(i: unknown) { this.input = i; } },
}));
vi.mock('@aws-sdk/client-lambda', () => ({
    LambdaClient: vi.fn(() => ({ send: vi.fn() })),
    InvokeCommand: class { input: unknown; constructor(i: unknown) { this.input = i; } },
}));

// ─── Pure helpers (no mocking required) ──────────────────────────────────────

describe('isPrivateIP', () => {
    it('classifies RFC 1918 / reserved ranges as private', () => {
        for (const ip of ['10.0.0.1', '172.16.5.4', '172.31.255.255', '192.168.1.1',
            '127.0.0.1', '169.254.1.1', '100.64.0.1', '100.127.255.255']) {
            expect(isPrivateIP(ip), ip).toBe(true);
        }
    });

    it('classifies public addresses as not private', () => {
        for (const ip of ['8.8.8.8', '1.1.1.1', '172.15.0.1', '172.32.0.1',
            '192.169.0.1', '100.63.0.1', '100.128.0.1', '203.0.113.7']) {
            expect(isPrivateIP(ip), ip).toBe(false);
        }
    });

    it('returns false for malformed input (incl. IPv6 / non-numeric)', () => {
        for (const ip of ['', 'not-an-ip', '10.0.0', '10.0.0.0.1', '::1', 'a.b.c.d']) {
            expect(isPrivateIP(ip), ip).toBe(false);
        }
    });
});

describe('getCorsHeaders', () => {
    it('echoes an allowed origin', () => {
        expect(getCorsHeaders('https://www.ninescrolls.com')['Access-Control-Allow-Origin'])
            .toBe('https://www.ninescrolls.com');
    });

    it('falls back to the primary origin for a disallowed or missing origin', () => {
        expect(getCorsHeaders('https://evil.example.com')['Access-Control-Allow-Origin'])
            .toBe('https://ninescrolls.com');
        expect(getCorsHeaders(undefined)['Access-Control-Allow-Origin'])
            .toBe('https://ninescrolls.com');
    });

    it('always includes the standard CORS method/credential headers', () => {
        const h = getCorsHeaders('https://ninescrolls.com');
        expect(h['Access-Control-Allow-Methods']).toBe('POST,OPTIONS');
        expect(h['Access-Control-Allow-Credentials']).toBe('true');
    });
});

const validFlush = {
    pageViewId: 'pv1', sessionId: 's1', tabId: 't1', path: '/x',
    flushSequence: 1, activeSeconds: 5, idleSeconds: 2, hiddenSeconds: 1,
    wallClockSeconds: 8, flushReason: 'pagehide', isFinal: true,
    endedAt: 1_700_000_000_000, idleTimeoutMsUsed: 30_000,
};

describe('validatePageTimeFlush', () => {
    it('accepts a well-formed payload', () => {
        expect(validatePageTimeFlush({ ...validFlush })).toBeNull();
    });

    it.each([
        ['missing pageViewId', { pageViewId: '' }],
        ['missing sessionId', { sessionId: undefined }],
        ['missing tabId', { tabId: 123 }],
        ['missing path', { path: undefined }],
        ['invalid flushSequence', { flushSequence: 0 }],
        ['invalid flushSequence', { flushSequence: 1.5 }],
        ['invalid activeSeconds', { activeSeconds: -1 }],
        ['invalid idleSeconds', { idleSeconds: -1 }],
        ['invalid hiddenSeconds', { hiddenSeconds: -1 }],
        ['invalid flushReason', { flushReason: 'beforeunload' }],
        ['missing isFinal', { isFinal: 'yes' }],
        ['invalid endedAt', { endedAt: Infinity }],
        ['invalid idleTimeoutMsUsed', { idleTimeoutMsUsed: 0 }],
    ])('rejects with "%s"', (msg, override) => {
        expect(validatePageTimeFlush({ ...validFlush, ...override })).toBe(msg);
    });

    it('enforces the wall-clock >= sum-of-parts invariant (1s tolerance)', () => {
        // active+idle+hidden = 8; wallClock 6 (+1) < 8 → reject
        expect(validatePageTimeFlush({ ...validFlush, wallClockSeconds: 6 }))
            .toBe('wallClock < sum of parts');
        // wallClock 7 (+1) >= 8 → within tolerance
        expect(validatePageTimeFlush({ ...validFlush, wallClockSeconds: 7 })).toBeNull();
    });
});

describe('validatePageViewStore', () => {
    it('accepts a well-formed payload', () => {
        expect(validatePageViewStore({
            pageViewId: 'pv1', eventName: 'page_view_store', eventType: 'page_view_store',
        })).toBeNull();
    });

    it.each([
        ['missing pageViewId', { pageViewId: '', eventName: 'e', eventType: 't' }],
        ['missing eventName', { pageViewId: 'p', eventName: '', eventType: 't' }],
        ['missing eventType', { pageViewId: 'p', eventName: 'e', eventType: '' }],
    ])('rejects with "%s"', (msg, payload) => {
        expect(validatePageViewStore(payload)).toBe(msg);
    });
});

// ─── Handler dispatch / validation branches ──────────────────────────────────
// These paths all return before any DynamoDB / fetch I/O, so no live mocks fire.

function makeEvent(overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent {
    return {
        httpMethod: 'POST',
        headers: { origin: 'https://ninescrolls.com' },
        queryStringParameters: null,
        body: null,
        isBase64Encoded: false,
        requestContext: {},
        ...overrides,
    } as unknown as APIGatewayProxyEvent;
}

async function loadHandler(env: Record<string, string> = {}) {
    vi.resetModules();
    vi.stubEnv('SEGMENT_WRITE_KEY', 'SG.test-key');
    for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
    const mod = await import('./handler');
    return mod.handler;
}

async function invoke(handler: Awaited<ReturnType<typeof loadHandler>>, event: APIGatewayProxyEvent) {
    return (await handler(event, {} as Context, () => undefined)) as APIGatewayProxyResult;
}

describe('handler dispatch/validation', () => {
    beforeEach(() => {
        vi.unstubAllEnvs();
        vi.stubGlobal('fetch', vi.fn());
    });

    it('answers CORS preflight (OPTIONS) with 200 and CORS headers', async () => {
        const handler = await loadHandler();
        const res = await invoke(handler, makeEvent({ httpMethod: 'OPTIONS' }));
        expect(res.statusCode).toBe(200);
        expect(res.body).toBe('');
        expect(res.headers?.['Access-Control-Allow-Origin']).toBe('https://ninescrolls.com');
    });

    it('rejects non-POST/GET methods with 405', async () => {
        const handler = await loadHandler();
        const res = await invoke(handler, makeEvent({ httpMethod: 'GET' }));
        expect(res.statusCode).toBe(405);
    });

    it('returns 500 when SEGMENT_WRITE_KEY is not configured', async () => {
        const handler = await loadHandler({ SEGMENT_WRITE_KEY: '' });
        const res = await invoke(handler, makeEvent({ body: JSON.stringify({ type: 'page', anonymousId: 'a' }) }));
        expect(res.statusCode).toBe(500);
    });

    it('returns 400 for an invalid event type', async () => {
        const handler = await loadHandler();
        const res = await invoke(handler, makeEvent({ body: JSON.stringify({ type: 'bogus', anonymousId: 'a' }) }));
        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toMatch(/Invalid type/);
    });

    it('returns 400 when neither anonymousId nor userId is present', async () => {
        const handler = await loadHandler();
        const res = await invoke(handler, makeEvent({ body: JSON.stringify({ type: 'page' }) }));
        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toMatch(/anonymousId or userId/);
    });

    it('returns 400 for a page_time_flush with invalid properties (before any DDB write)', async () => {
        const handler = await loadHandler();
        const res = await invoke(handler, makeEvent({
            body: JSON.stringify({
                type: 'track', event: 'page_time_flush', anonymousId: 'a',
                properties: { sessionId: 's1' }, // missing pageViewId etc.
            }),
        }));
        expect(res.statusCode).toBe(400);
        const body = JSON.parse(res.body);
        expect(body.success).toBe(false);
        expect(body.validationError).toBe('missing pageViewId');
    });

    it('returns 400 for a page_view_store with invalid properties (before any DDB write)', async () => {
        const handler = await loadHandler();
        const res = await invoke(handler, makeEvent({
            body: JSON.stringify({
                type: 'track', event: 'page_view_store', anonymousId: 'a',
                properties: { pageViewId: '', eventName: 'e', eventType: 't' },
            }),
        }));
        expect(res.statusCode).toBe(400);
    });
});
