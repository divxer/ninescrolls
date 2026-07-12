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
const segmentUrls = () => fetchUrls().filter((u) => u.includes('api.segment.io'));
// Decode the JSON payloads POSTed to Segment (in call order), so tests can
// assert the actual event type/name/properties, not just the endpoint.
const segmentPayloads = () => vi.mocked(fetch).mock.calls
    .filter((c) => String(c[0]).includes('api.segment.io'))
    .map((c) => JSON.parse((c[1] as { body: string }).body) as Record<string, unknown>);

// Fetch stub for the page_view path: Segment always responds 200; IP-lookup
// providers respond only when a public IP triggers lookupIP().
function stubPageViewFetch(opts: { companyType?: string; org?: string; segmentStatus?: number } = {}) {
    const segStatus = opts.segmentStatus ?? 200;
    vi.stubGlobal('fetch', vi.fn((url: string) => {
        if (url.includes('api.segment.io')) return Promise.resolve({ status: segStatus, text: async () => '' });
        if (url.includes('ipinfo.io')) {
            return Promise.resolve({ ok: true, json: async () => ({
                ip: '8.8.8.8', country: 'US', city: 'Austin', org: opts.org ?? 'Org',
                company: opts.companyType ? { type: opts.companyType } : undefined,
            }) });
        }
        if (url.includes('ipapi.co')) return Promise.resolve({ ok: true, json: async () => ({ ip: '8.8.8.8' }) });
        return Promise.resolve({ status: 200, text: async () => '' });
    }));
}

function pvEvent(propsOverride: Record<string, unknown> = {}, context?: unknown): APIGatewayProxyEvent {
    return {
        httpMethod: 'POST',
        headers: { origin: 'https://ninescrolls.com' },
        queryStringParameters: null,
        body: JSON.stringify({
            type: 'track', event: 'page_view_store', anonymousId: 'a',
            properties: {
                pageViewId: 'pv9', eventName: 'Page View', eventType: 'page_view',
                pathname: '/x', behaviorScore: 12, ...propsOverride,
            },
            ...(context ? { context } : {}),
        }),
        isBase64Encoded: false,
        requestContext: {},
    } as unknown as APIGatewayProxyEvent;
}

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

describe('writePageView (via page_view_store branch)', () => {
    it('happy path: private IP → single Put (pv-<id>), one Segment page event, 200', async () => {
        const handler = await loadHandler();
        stubPageViewFetch();
        const res = await invoke(handler, pvEvent({ ip: '10.0.0.1' }));

        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body)).toEqual({ success: true, segmentForwarded: true });
        expect(cmds('PutCommand')).toHaveLength(1);
        expect(cmds('GetCommand')).toHaveLength(0);
        expect(cmds('UpdateCommand')).toHaveLength(0);

        const put = putCmd() as { input: { ConditionExpression?: string; Item: Record<string, unknown> } };
        expect(put.input.Item.id).toBe('pv-pv9');
        expect(put.input.ConditionExpression).toBe('attribute_not_exists(id)');

        // Private IP → no IP-lookup; the ONLY fetch is the single Segment "page" call.
        expect(fetchUrls()).toEqual(['https://api.segment.io/v1/page']);
        const [page] = segmentPayloads();
        expect(page.type).toBe('page');
        expect(page.name).toBe('/x');
    });

    it('idempotent duplicate: Put ConditionalCheckFailedException → 200 duplicate:true', async () => {
        const handler = await loadHandler();
        stubPageViewFetch();
        mockSend.mockImplementation((cmd) => {
            if ((cmd as { constructor: { name: string } }).constructor.name === 'PutCommand') {
                return Promise.reject(Object.assign(new Error('exists'), { name: 'ConditionalCheckFailedException' }));
            }
            return Promise.resolve({});
        });
        const res = await invoke(handler, pvEvent({ ip: '10.0.0.1' }));
        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body)).toEqual({ success: true, duplicate: true });
    });

    it('non-page_view event → Segment "track" event named after eventName', async () => {
        const handler = await loadHandler();
        stubPageViewFetch();
        const res = await invoke(handler, pvEvent({
            ip: '10.0.0.1', eventType: 'rfq_submit', eventName: 'RFQ Submitted',
        }));
        expect(res.statusCode).toBe(200);
        expect(segmentUrls()).toEqual(['https://api.segment.io/v1/track']);
        const [track] = segmentPayloads();
        expect(track.type).toBe('track');
        expect(track.event).toBe('RFQ Submitted');
    });

    it('merges UTM campaign from client context into the persisted record', async () => {
        const handler = await loadHandler();
        stubPageViewFetch();
        await invoke(handler, pvEvent(
            { ip: '10.0.0.1' },
            { campaign: { source: 'google', medium: 'cpc', name: 'spring_sale' } },
        ));
        const item = putItem();
        expect(item.utmSource).toBe('google');
        expect(item.utmMedium).toBe('cpc');
        expect(item.utmCampaign).toBe('spring_sale');
    });

    it('persists ad click IDs parsed from client context page.search', async () => {
        const handler = await loadHandler();
        stubPageViewFetch();
        await invoke(handler, pvEvent(
            { ip: '10.0.0.1' },
            { page: { search: '?gclid=Cj0KCQjw_abc-123&gbraid=0AAAqq&utm_source=google' } },
        ));
        const item = putItem();
        expect(item.gclid).toBe('Cj0KCQjw_abc-123');
        expect(item.gbraid).toBe('0AAAqq');
        expect(item.wbraid).toBeUndefined();
        expect(item.msclkid).toBeUndefined();
    });

    it('omits click-ID attributes when the landing URL has none', async () => {
        const handler = await loadHandler();
        stubPageViewFetch();
        await invoke(handler, pvEvent({ ip: '10.0.0.1' }, { page: { search: '?utm_source=google' } }));
        const item = putItem();
        expect(item.gclid).toBeUndefined();
        expect(item.gbraid).toBeUndefined();
    });

    it('public education IP → categorical target → 2nd "Target Customer Detected" Segment event, no Update', async () => {
        const handler = await loadHandler();
        stubPageViewFetch({ companyType: 'education', org: 'AS32 Stanford University' });
        const res = await invoke(handler, pvEvent({ ip: '8.8.8.8' }));

        expect(res.statusCode).toBe(200);
        expect(fetchUrls().some((u) => u.includes('ipinfo.io/8.8.8.8'))).toBe(true);
        expect(fetchUrls().some((u) => u.includes('ipapi.co/8.8.8.8'))).toBe(true);
        // education is categorical (not in AI set) → no DDB Update in writePageView.
        expect(cmds('UpdateCommand')).toHaveLength(0);
        const item = putItem();
        expect(item.organizationType).toBe('education');
        // page event + Target Customer Detected track event.
        expect(segmentUrls()).toEqual([
            'https://api.segment.io/v1/page',
            'https://api.segment.io/v1/track',
        ]);
        const [, tc] = segmentPayloads();
        expect(tc.type).toBe('track');
        expect(tc.event).toBe('Target Customer Detected');
        const tcProps = tc.properties as Record<string, unknown>;
        expect(tcProps.organizationType).toBe('education');
        expect(tcProps.orgName).toBe('Stanford University');
        expect(tcProps.leadTier).toBe('B');
    });

    it('public business IP → classify-org Lambda → AI Update + Target Customer Segment event', async () => {
        const handler = await loadHandler({ CLASSIFY_ORG_FUNCTION_NAME: 'classify-fn' });
        stubPageViewFetch({ companyType: 'business', org: 'Acme Corp' });
        mockLambdaSend.mockResolvedValue({
            Payload: Buffer.from(JSON.stringify({
                statusCode: 200,
                body: JSON.stringify({
                    organizationType: 'education', isTargetCustomer: true,
                    confidence: 0.9, reason: 'academic', provider: 'bedrock',
                }),
            })),
        });
        const res = await invoke(handler, pvEvent({ ip: '8.8.8.8' }));

        expect(res.statusCode).toBe(200);
        expect(mockLambdaSend).toHaveBeenCalledTimes(1);
        const update = cmds('UpdateCommand')[0] as { input: { Key: Record<string, unknown>; ExpressionAttributeValues: Record<string, unknown> } };
        expect(update.input.Key.id).toBe('pv-pv9');
        expect(update.input.ExpressionAttributeValues[':aiOrgType']).toBe('education');
        expect(update.input.ExpressionAttributeValues[':isTgt']).toBe(true);
        expect(segmentUrls()).toEqual([
            'https://api.segment.io/v1/page',
            'https://api.segment.io/v1/track',
        ]);
        const [, tc] = segmentPayloads();
        expect(tc.event).toBe('Target Customer Detected');
        const tcProps = tc.properties as Record<string, unknown>;
        expect(tcProps.organizationType).toBe('education'); // AI-refined type
        expect(tcProps.leadTier).toBe('B');
    });

    it('AI classify null then retries after 2s, succeeds on second invoke', async () => {
        const handler = await loadHandler({ CLASSIFY_ORG_FUNCTION_NAME: 'classify-fn' });
        stubPageViewFetch({ companyType: 'business', org: 'Acme Corp' });
        // First invoke: non-200 → classifyOrgViaLambda returns null → triggers retry.
        mockLambdaSend.mockResolvedValueOnce({ Payload: Buffer.from(JSON.stringify({ statusCode: 500, body: '{}' })) });
        mockLambdaSend.mockResolvedValueOnce({
            Payload: Buffer.from(JSON.stringify({
                statusCode: 200,
                body: JSON.stringify({
                    organizationType: 'education', isTargetCustomer: true,
                    confidence: 0.8, reason: 'retry hit', provider: 'anthropic',
                }),
            })),
        });

        vi.useFakeTimers();
        try {
            const pending = invoke(handler, pvEvent({ ip: '8.8.8.8' }));
            await vi.advanceTimersByTimeAsync(2000); // step over the retry sleep
            const res = await pending;
            expect(res.statusCode).toBe(200);
        } finally {
            vi.useRealTimers();
        }

        expect(mockLambdaSend).toHaveBeenCalledTimes(2);
        const update = cmds('UpdateCommand')[0] as { input: { ExpressionAttributeValues: Record<string, unknown> } };
        expect(update.input.ExpressionAttributeValues[':provider']).toBe('anthropic');
    });
});
