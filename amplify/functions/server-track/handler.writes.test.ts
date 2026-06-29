import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';

// Controllable AWS SDK send fns shared across module reloads (hoisted above the
// vi.mock factories). Dispatch in tests by `cmd.constructor.name`.
const { mockSend, mockLambdaSend } = vi.hoisted(() => ({
    mockSend: vi.fn(),
    mockLambdaSend: vi.fn(),
}));

vi.mock('@aws-sdk/client-dynamodb', () => ({ DynamoDBClient: vi.fn(() => ({})) }));
vi.mock('@aws-sdk/lib-dynamodb', () => ({
    DynamoDBDocumentClient: { from: vi.fn(() => ({ send: (c: unknown) => mockSend(c) })) },
    GetCommand: class { input: unknown; constructor(i: unknown) { this.input = i; } },
    PutCommand: class { input: unknown; constructor(i: unknown) { this.input = i; } },
    UpdateCommand: class { input: unknown; constructor(i: unknown) { this.input = i; } },
}));
vi.mock('@aws-sdk/client-lambda', () => ({
    LambdaClient: vi.fn(() => ({ send: (c: unknown) => mockLambdaSend(c) })),
    InvokeCommand: class { input: unknown; constructor(i: unknown) { this.input = i; } },
}));

const VALID_FLUSH = {
    pageViewId: 'pv1', sessionId: 's1', tabId: 't1', path: '/page',
    title: 'Page', flushSequence: 1, activeSeconds: 5, idleSeconds: 2,
    hiddenSeconds: 1, wallClockSeconds: 8, flushReason: 'pagehide',
    isFinal: true, endedAt: 1_700_000_000_000, idleTimeoutMsUsed: 30_000,
    visitorId: 'v1', isBot: false,
};

function ptfEvent(propsOverride: Record<string, unknown> = {}): APIGatewayProxyEvent {
    return {
        httpMethod: 'POST',
        headers: { origin: 'https://ninescrolls.com' },
        queryStringParameters: null,
        body: JSON.stringify({
            type: 'track', event: 'page_time_flush', anonymousId: 'a',
            properties: { ...VALID_FLUSH, ...propsOverride },
        }),
        isBase64Encoded: false,
        requestContext: {},
    } as unknown as APIGatewayProxyEvent;
}

// Env that reaches writePageTimeFlush and actually performs the DDB write.
// GRAPHQL_* left unset → notifyAppSync no-ops; CLASSIFY_ORG_FUNCTION_NAME unset
// unless a test opts into AI classification.
async function loadHandler(env: Record<string, string> = {}) {
    vi.resetModules();
    vi.stubEnv('SEGMENT_WRITE_KEY', 'SG.test-key');
    vi.stubEnv('ANALYTICS_EVENT_TABLE', 'test-table');
    vi.stubEnv('ENABLE_DDB_WRITE', 'true');
    // Neutralize ambient/CI values so notifyAppSync + AI classify stay inert
    // unless a test opts in — a GRAPHQL_ENDPOINT set in the environment would
    // otherwise make notifyAppSync hit fetch and break the call-count assertions.
    vi.stubEnv('GRAPHQL_ENDPOINT', '');
    vi.stubEnv('GRAPHQL_API_KEY', '');
    vi.stubEnv('CLASSIFY_ORG_FUNCTION_NAME', '');
    for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
    return (await import('./handler')).handler;
}

async function invoke(handler: Awaited<ReturnType<typeof loadHandler>>, event: APIGatewayProxyEvent) {
    return (await handler(event, {} as Context, () => undefined)) as APIGatewayProxyResult;
}

const cmds = (name: string) =>
    mockSend.mock.calls.map(([c]) => c).filter((c) => (c as { constructor: { name: string } }).constructor.name === name);
const putItem = () => (cmds('PutCommand')[0] as { input: { Item: Record<string, unknown> } }).input.Item;
const putCmd = () => cmds('PutCommand')[0] as { input: { ConditionExpression?: string } };
const fetchUrls = () => vi.mocked(fetch).mock.calls.map((c) => String(c[0]));

beforeEach(() => {
    vi.unstubAllEnvs();
    mockSend.mockReset();
    mockLambdaSend.mockReset();
    mockSend.mockResolvedValue({});
    vi.stubGlobal('fetch', vi.fn());
});

describe('writePageTimeFlush (via page_time_flush branch)', () => {
    it('happy path: private IP → single Put, no enrichment, 200', async () => {
        const handler = await loadHandler();
        const res = await invoke(handler, ptfEvent({ ip: '10.0.0.1' }));

        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body)).toEqual({ success: true });
        // Private IP skips the parent-check / IP-lookup entirely.
        expect(cmds('PutCommand')).toHaveLength(1);
        expect(cmds('GetCommand')).toHaveLength(0);
        expect(cmds('UpdateCommand')).toHaveLength(0);
        expect(fetch).not.toHaveBeenCalled();

        // The authoritative write must carry the idempotency guard.
        expect(putCmd().input.ConditionExpression).toBe('attribute_not_exists(id)');

        const item = putItem();
        expect(item.id).toBe('ptf-pv1-1');
        expect(item.eventType).toBe('page_time_flush');
        expect(item.pathname).toBe('/page');
        expect(item.activeSeconds).toBe(5);
        expect(item.ip).toBe('10.0.0.1');
        expect(item.organizationType).toBeUndefined();
    });

    it('idempotent duplicate: Put ConditionalCheckFailedException → 200 success', async () => {
        const handler = await loadHandler();
        mockSend.mockImplementation((cmd) => {
            if ((cmd as { constructor: { name: string } }).constructor.name === 'PutCommand') {
                return Promise.reject(Object.assign(new Error('exists'), { name: 'ConditionalCheckFailedException' }));
            }
            return Promise.resolve({});
        });
        const res = await invoke(handler, ptfEvent({ ip: '10.0.0.1' }));
        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body)).toEqual({ success: true });
    });

    it('DDB write failure (non-conditional) → 502 success:false', async () => {
        const handler = await loadHandler();
        mockSend.mockImplementation((cmd) => {
            if ((cmd as { constructor: { name: string } }).constructor.name === 'PutCommand') {
                return Promise.reject(new Error('DDB down'));
            }
            return Promise.resolve({});
        });
        const res = await invoke(handler, ptfEvent({ ip: '10.0.0.1' }));
        expect(res.statusCode).toBe(502);
        expect(JSON.parse(res.body)).toEqual({ success: false });
    });

    it('feature flag off (ENABLE_DDB_WRITE!=="true") → no DDB write, still 200', async () => {
        const handler = await loadHandler({ ENABLE_DDB_WRITE: 'false' });
        const res = await invoke(handler, ptfEvent({ ip: '10.0.0.1' }));
        expect(res.statusCode).toBe(200);
        expect(cmds('PutCommand')).toHaveLength(0);
    });

    it('orphan flush, public education IP → IP lookup + Put + categorical target Update(B)', async () => {
        const handler = await loadHandler();
        // Parent page_view missing → orphan path → fallback IP lookup.
        mockSend.mockImplementation((cmd) => {
            const name = (cmd as { constructor: { name: string } }).constructor.name;
            if (name === 'GetCommand') return Promise.resolve({}); // no Item
            return Promise.resolve({});
        });
        vi.stubGlobal('fetch', vi.fn((url: string) => {
            if (url.includes('ipinfo.io')) {
                return Promise.resolve({ ok: true, json: async () => ({
                    ip: '8.8.8.8', country: 'US', city: 'Stanford',
                    org: 'AS32 Stanford University', company: { type: 'education' },
                }) });
            }
            return Promise.resolve({ ok: true, json: async () => ({ ip: '8.8.8.8' }) });
        }));

        const res = await invoke(handler, ptfEvent({ ip: '8.8.8.8', isBot: false }));

        expect(res.statusCode).toBe(200);
        expect(cmds('GetCommand')).toHaveLength(1);
        // Both IP providers are queried in parallel.
        const urls = fetchUrls();
        expect(urls).toHaveLength(2);
        expect(urls.some((u) => u.includes('ipinfo.io/8.8.8.8'))).toBe(true);
        expect(urls.some((u) => u.includes('ipapi.co/8.8.8.8'))).toBe(true);
        const item = putItem();
        expect(item.organizationType).toBe('education');
        expect(item.orgName).toBe('Stanford University'); // AS prefix stripped
        // education → categorical target → Update with leadTier B
        const update = cmds('UpdateCommand')[0] as { input: { ExpressionAttributeValues: Record<string, unknown> } };
        expect(update).toBeDefined();
        expect(update.input.ExpressionAttributeValues[':isTgt']).toBe(true);
        expect(update.input.ExpressionAttributeValues[':leadTier']).toBe('B');
        expect(mockLambdaSend).not.toHaveBeenCalled(); // education skips AI
    });

    it('orphan flush, business IP → AI classify Lambda → AI enrichment Update', async () => {
        const handler = await loadHandler({ CLASSIFY_ORG_FUNCTION_NAME: 'classify-fn' });
        mockSend.mockImplementation((cmd) => {
            const name = (cmd as { constructor: { name: string } }).constructor.name;
            if (name === 'GetCommand') return Promise.resolve({}); // orphan
            return Promise.resolve({});
        });
        vi.stubGlobal('fetch', vi.fn((url: string) => {
            if (url.includes('ipinfo.io')) {
                return Promise.resolve({ ok: true, json: async () => ({
                    ip: '8.8.8.8', country: 'US', city: 'Austin',
                    org: 'Acme Corp', company: { type: 'business' },
                }) });
            }
            return Promise.resolve({ ok: true, json: async () => ({ ip: '8.8.8.8' }) });
        }));
        // classify-org Lambda returns a confident education classification.
        mockLambdaSend.mockResolvedValue({
            Payload: Buffer.from(JSON.stringify({
                statusCode: 200,
                body: JSON.stringify({
                    organizationType: 'education', isTargetCustomer: true,
                    confidence: 0.9, reason: 'looks academic', provider: 'bedrock',
                }),
            })),
        });

        const res = await invoke(handler, ptfEvent({ ip: '8.8.8.8', isBot: false }));

        expect(res.statusCode).toBe(200);
        // Both IP providers queried, then classify-org invoked once (confident, no retry).
        const urls = fetchUrls();
        expect(urls.some((u) => u.includes('ipinfo.io/8.8.8.8'))).toBe(true);
        expect(urls.some((u) => u.includes('ipapi.co/8.8.8.8'))).toBe(true);
        expect(mockLambdaSend).toHaveBeenCalledTimes(1);
        const lambdaCall = mockLambdaSend.mock.calls[0][0] as { input: { FunctionName: string; Payload: string } };
        expect(lambdaCall.input.FunctionName).toBe('classify-fn');
        const classifyBody = JSON.parse(JSON.parse(lambdaCall.input.Payload).body);
        expect(classifyBody.orgName).toBe('Acme Corp');
        const update = cmds('UpdateCommand')[0] as { input: { ExpressionAttributeValues: Record<string, unknown> } };
        expect(update).toBeDefined();
        expect(update.input.ExpressionAttributeValues[':aiOrgType']).toBe('education');
        expect(update.input.ExpressionAttributeValues[':isTgt']).toBe(true);
        expect(update.input.ExpressionAttributeValues[':leadTier']).toBe('B');
    });
});
