import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';

// ---------------------------------------------------------------------------
// Mocks — must be set up before importing handler
// ---------------------------------------------------------------------------

const mockPut = vi.fn().mockResolvedValue({});
const mockGet = vi.fn().mockResolvedValue({ Item: undefined });
const mockUpdate = vi.fn().mockResolvedValue({});

vi.mock('@aws-sdk/client-dynamodb', () => ({
    DynamoDBClient: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@aws-sdk/lib-dynamodb', () => ({
    DynamoDBDocumentClient: {
        from: vi.fn().mockReturnValue({
            send: vi.fn().mockImplementation((cmd: unknown) => {
                const cmdName = (cmd as { constructor: { name: string } }).constructor.name;
                if (cmdName === 'PutCommand') return mockPut(cmd);
                if (cmdName === 'GetCommand') return mockGet(cmd);
                if (cmdName === 'UpdateCommand') return mockUpdate(cmd);
                return Promise.resolve({});
            }),
        }),
    },
    PutCommand: vi.fn().mockImplementation((params) => {
        const instance = { ...params };
        Object.defineProperty(instance, 'constructor', { value: { name: 'PutCommand' } });
        return instance;
    }),
    GetCommand: vi.fn().mockImplementation((params) => {
        const instance = { ...params };
        Object.defineProperty(instance, 'constructor', { value: { name: 'GetCommand' } });
        return instance;
    }),
    UpdateCommand: vi.fn().mockImplementation((params) => {
        const instance = { ...params };
        Object.defineProperty(instance, 'constructor', { value: { name: 'UpdateCommand' } });
        return instance;
    }),
}));

const mockInvokeOrgApi = vi.fn().mockResolvedValue({ matchedOrgId: null });
vi.mock('../../lib/organization/invoke-org-api', () => ({
    invokeOrganizationApi: (payload: unknown) => mockInvokeOrgApi(payload),
}));

const mockEmitTimelineEventToCrm = vi.fn().mockResolvedValue(undefined);
vi.mock('../../lib/crm/invoke-crm-api', () => ({
    emitTimelineEventToCrm: (...args: unknown[]) => mockEmitTimelineEventToCrm(...args),
}));

// Mock global fetch (Turnstile, SendGrid, HubSpot)
const mockFetch = vi.fn();
global.fetch = mockFetch;

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeEvent(body: Record<string, unknown>, overrides?: Partial<APIGatewayProxyEventV2>): APIGatewayProxyEventV2 {
    return {
        version: '2.0',
        routeKey: 'POST /api/lead',
        rawPath: '/api/lead',
        rawQueryString: '',
        headers: {
            'content-type': 'application/json',
            origin: 'https://ninescrolls.com',
        },
        requestContext: {
            accountId: '123',
            apiId: 'api',
            domainName: 'test.execute-api.us-east-1.amazonaws.com',
            domainPrefix: 'test',
            http: {
                method: 'POST',
                path: '/api/lead',
                protocol: 'HTTP/1.1',
                sourceIp: '1.2.3.4',
                userAgent: 'test',
            },
            requestId: 'req-1',
            routeKey: 'POST /api/lead',
            stage: 'prod',
            time: '2026-05-16T12:00:00Z',
            timeEpoch: 0,
        },
        body: JSON.stringify(body),
        isBase64Encoded: false,
        ...overrides,
    } as APIGatewayProxyEventV2;
}

const VALID_CONTACT = {
    type: 'contact',
    name: 'Dr. Jane Smith',
    email: 'jane@stanford.edu',
    organization: 'Stanford University',
    message: 'We are evaluating ICP etching systems.',
    turnstileToken: 'test-token',
};

const VALID_NEWSLETTER = {
    type: 'newsletter',
    email: 'subscriber@stanford.edu',
    source: 'footer',
};

const VALID_DOWNLOAD_GATE = {
    type: 'download_gate',
    fullName: 'Dr. Jane Smith',
    email: 'jane@stanford.edu',
    organization: 'Stanford University',
    researchAreas: 'Plasma etching',
    intent: 'Actively looking to buy',
    fileName: 'ICP-Etcher-Datasheet.pdf',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('submit-lead handler', () => {
    let handler: typeof import('./handler').handler;

    beforeEach(async () => {
        vi.clearAllMocks();
        mockInvokeOrgApi.mockResolvedValue({ matchedOrgId: null });
        mockGet.mockResolvedValue({ Item: undefined });

        process.env.INTELLIGENCE_TABLE = 'NineScrolls-Intelligence';
        process.env.NEWSLETTER_SUBSCRIBERS_TABLE = 'NewsletterSubscribers';
        process.env.TURNSTILE_SECRET_KEY = 'test-secret';
        process.env.SENDGRID_API_KEY = 'SG.test-key';

        mockFetch.mockImplementation((url: string) => {
            if (url.includes('turnstile')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ success: true }),
                });
            }
            return Promise.resolve({ ok: true, status: 202, json: () => Promise.resolve({}) });
        });

        const mod = await import('./handler');
        handler = mod.handler;
    });

    it('invokes organization-api with source=lead and contact organization', async () => {
        const event = makeEvent(VALID_CONTACT);
        const result = await handler(event, {} as never, (() => {}) as never);

        expect((result as { statusCode: number }).statusCode).toBe(200);
        expect(mockInvokeOrgApi).toHaveBeenCalledWith(expect.objectContaining({
            action: 'upsertFromSubmission',
            source: 'lead',
            email: VALID_CONTACT.email,
            institution: VALID_CONTACT.organization,
        }));
    });

    it('omits institution when type is newsletter', async () => {
        const event = makeEvent(VALID_NEWSLETTER);
        const result = await handler(event, {} as never, (() => {}) as never);

        expect((result as { statusCode: number }).statusCode).toBe(200);
        expect(mockInvokeOrgApi).toHaveBeenCalledWith(expect.objectContaining({
            action: 'upsertFromSubmission',
            source: 'lead',
            email: VALID_NEWSLETTER.email,
            institution: undefined,
        }));
    });

    it('backfills matchedOrgId + GSI2PK when organization-api returns a matchedOrgId', async () => {
        mockInvokeOrgApi.mockResolvedValueOnce({ matchedOrgId: 'stanford.edu' });
        const event = makeEvent(VALID_CONTACT);
        const result = await handler(event, {} as never, (() => {}) as never);

        expect((result as { statusCode: number }).statusCode).toBe(200);
        const backfillCall = (UpdateCommand as unknown as ReturnType<typeof vi.fn>).mock.calls
            .find((c: { Item?: unknown }[]) => {
                const params = c[0] as { UpdateExpression?: string; Key?: { PK?: string } };
                return (params.UpdateExpression ?? '').includes('matchedOrgId')
                    && (params.Key?.PK ?? '').startsWith('LEAD#');
            });
        expect(backfillCall).toBeDefined();
        const backfillParams = backfillCall![0] as { ExpressionAttributeValues: Record<string, string> };
        expect(backfillParams.ExpressionAttributeValues[':id']).toBe('stanford.edu');
        expect(backfillParams.ExpressionAttributeValues[':gsi2']).toBe('ORG#stanford.edu');
    });

    it.each([
        { name: 'contact', body: VALID_CONTACT, summaryRe: /Contact/i },
        { name: 'download_gate', body: VALID_DOWNLOAD_GATE, summaryRe: /Downloaded/i },
        { name: 'newsletter', body: VALID_NEWSLETTER, summaryRe: /Newsletter/i },
    ])('emits lead_captured timeline event after the lead write commits ($name)', async ({ body: leadBody, summaryRe }) => {
        mockInvokeOrgApi.mockResolvedValueOnce({ matchedOrgId: 'stanford.edu' });
        const event = makeEvent(leadBody);
        const result = await handler(event, {} as never, (() => {}) as never);

        expect((result as { statusCode: number }).statusCode).toBe(200);
        expect(mockEmitTimelineEventToCrm).toHaveBeenCalledTimes(1);

        const emitArg = mockEmitTimelineEventToCrm.mock.calls[0][0] as {
            source: string;
            kind: string;
            sourceEntityId: string;
            summary: string;
            resolveInput: { matchedOrgId?: string };
        };
        const responseBody = JSON.parse((result as { body: string }).body);
        expect(emitArg.source).toBe('lead');
        expect(emitArg.kind).toBe('lead_captured');
        expect(emitArg.sourceEntityId).toBe(responseBody.leadId);
        expect(emitArg.summary).toMatch(summaryRe);
        expect(emitArg.resolveInput.matchedOrgId).toBe('stanford.edu');
    });

    it('returns 200 and skips backfill when organization-api throws', async () => {
        mockInvokeOrgApi.mockRejectedValueOnce(new Error('org-api boom'));
        const event = makeEvent(VALID_CONTACT);
        const result = await handler(event, {} as never, (() => {}) as never);

        expect((result as { statusCode: number }).statusCode).toBe(200);
        const backfillCall = (UpdateCommand as unknown as ReturnType<typeof vi.fn>).mock.calls
            .find((c: { Item?: unknown }[]) => {
                const params = c[0] as { UpdateExpression?: string };
                return (params.UpdateExpression ?? '').includes('matchedOrgId');
            });
        expect(backfillCall).toBeUndefined();
    });
});
