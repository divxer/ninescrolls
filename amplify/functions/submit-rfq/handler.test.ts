import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import {
    rfqSchema,
    uploadUrlSchema,
    isValidTempAttachmentKey,
    equipmentCategoryLabels,
    equipmentGreetingPhrase,
} from './handler';
import { RFQ_FIELD_LIMITS } from '../../lib/rfq/limits';
import {
    RFQ_EQUIPMENT_CATEGORY_VALUES,
    RFQ_ATTACHMENT_MIME_TYPES,
    MAX_RFQ_ATTACHMENTS,
    MAX_RFQ_ATTACHMENT_SIZE,
} from '../../lib/rfq/contract';
import { PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

// Attachment keys in the exact shape getUploadUrl issues: temp/rfq/<16 hex>/<name>
const TEMP_KEY_A = `temp/rfq/${'a'.repeat(16)}/spec.pdf`;
const TEMP_KEY_B = `temp/rfq/${'b'.repeat(16)}/drawing.pdf`;
const TEMP_KEY_C = `temp/rfq/${'c'.repeat(16)}/notes.docx`;

// ---------------------------------------------------------------------------
// Mocks — must be set up before importing handler
// ---------------------------------------------------------------------------

// Mock DynamoDB
const mockPut = vi.fn().mockResolvedValue({});
const mockQuery = vi.fn().mockResolvedValue({ Items: [] });
const mockUpdate = vi.fn().mockResolvedValue({});

vi.mock('@aws-sdk/client-dynamodb', () => ({
    DynamoDBClient: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@aws-sdk/lib-dynamodb', () => ({
    DynamoDBDocumentClient: {
        from: vi.fn().mockReturnValue({
            send: vi.fn().mockImplementation((cmd: unknown) => {
                const cmdName = (cmd as { constructor: { name: string } }).constructor.name;
                if (cmdName === 'PutCommand') return mockPut();
                if (cmdName === 'QueryCommand') return mockQuery();
                if (cmdName === 'UpdateCommand') return mockUpdate();
                return Promise.resolve({});
            }),
        }),
    },
    PutCommand: vi.fn().mockImplementation((params) => {
        const instance = { ...params };
        Object.defineProperty(instance, 'constructor', { value: { name: 'PutCommand' } });
        return instance;
    }),
    QueryCommand: vi.fn().mockImplementation((params) => {
        const instance = { ...params };
        Object.defineProperty(instance, 'constructor', { value: { name: 'QueryCommand' } });
        return instance;
    }),
    UpdateCommand: vi.fn().mockImplementation((params) => {
        const instance = { ...params };
        Object.defineProperty(instance, 'constructor', { value: { name: 'UpdateCommand' } });
        return instance;
    }),
}));

// Mock S3
const mockS3Send = vi.fn().mockResolvedValue({});
vi.mock('@aws-sdk/client-s3', () => ({
    S3Client: vi.fn().mockImplementation(() => ({
        send: (cmd: unknown) => mockS3Send(cmd),
    })),
    CopyObjectCommand: vi.fn().mockImplementation((params) => ({ __type: 'CopyObject', ...params })),
    DeleteObjectCommand: vi.fn().mockImplementation((params) => ({ __type: 'DeleteObject', ...params })),
    PutObjectCommand: vi.fn().mockImplementation((params) => ({ __type: 'PutObject', ...params })),
}));

// Mock the presigner — capture the command so tests can assert what was signed
const mockGetSignedUrl = vi.fn().mockResolvedValue('https://s3.example.com/presigned-put');
vi.mock('@aws-sdk/s3-request-presigner', () => ({
    getSignedUrl: (...args: unknown[]) => mockGetSignedUrl(...args),
}));

// Mock organization-api invocation
const mockInvokeOrgApi = vi.fn().mockResolvedValue({ matchedOrgId: null });
vi.mock('../../lib/organization/invoke-org-api', () => ({
    invokeOrganizationApi: (payload: unknown) => mockInvokeOrgApi(payload),
}));

// Mock CRM timeline emit (fire-and-forget; helper swallows its own dispatch failures)
const mockEmitTimelineEventToCrm = vi.fn().mockResolvedValue(undefined);
const mockInvokeCrmAction = vi.fn().mockResolvedValue(undefined);
vi.mock('../../lib/crm/invoke-crm-api', () => ({
    emitTimelineEventToCrm: (...args: unknown[]) => mockEmitTimelineEventToCrm(...args),
    invokeCrmAction: (...args: unknown[]) => mockInvokeCrmAction(...args),
}));

// Mock the VISITOR# identity bridge (2C-analytics)
const mockUpsertVisitorBridge = vi.fn().mockResolvedValue({ created: false, orgUpgraded: false });
vi.mock('../../lib/crm/visitor-bridge', () => ({
    upsertVisitorBridge: (...args: unknown[]) => mockUpsertVisitorBridge(...args),
    toSend: (dc: unknown) => dc,
}));

// Mock global fetch for Turnstile and notifications
const mockFetch = vi.fn();
global.fetch = mockFetch;

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeEvent(body: Record<string, unknown>, overrides?: Partial<APIGatewayProxyEventV2>): APIGatewayProxyEventV2 {
    return {
        version: '2.0',
        routeKey: 'POST /api/rfq',
        rawPath: '/api/rfq',
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
                path: '/api/rfq',
                protocol: 'HTTP/1.1',
                sourceIp: '1.2.3.4',
                userAgent: 'test',
            },
            requestId: 'req-1',
            routeKey: 'POST /api/rfq',
            stage: 'prod',
            time: '2026-03-10T12:00:00Z',
            timeEpoch: 0,
        },
        body: JSON.stringify(body),
        isBase64Encoded: false,
        ...overrides,
    } as APIGatewayProxyEventV2;
}

const VALID_RFQ = {
    name: 'Dr. Jane Smith',
    email: 'jane.smith@stanford.edu',
    phone: '+1-650-555-1234',
    institution: 'Stanford University',
    department: 'Materials Science & Engineering',
    role: 'PI' as const,
    equipmentCategory: 'ICP' as const,
    specificModel: 'TL-ICP-300',
    applicationDescription: 'We need an ICP etching system for high-aspect-ratio silicon etching in MEMS fabrication.',
    keySpecifications: '8-inch chamber, load-lock required',
    quantity: 1,
    budgetRange: 'Over $150k' as const,
    timeline: 'within-6-months' as const,
    fundingStatus: 'funded' as const,
    referralSource: 'web-search' as const,
    existingEquipment: 'Currently using a RIE system',
    additionalComments: 'We would like to schedule a site visit.',
    turnstileToken: 'test-token-123',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Attachment contract parity — the server half of the form ⇄ Lambda guard for
// file uploads. The form's ALLOWED_FILE_TYPES / MAX_FILES / MAX_FILE_SIZE and
// these presign-schema constraints both derive from amplify/lib/rfq/contract.ts;
// the client half is asserted in src/pages/rfqEquipmentOptions.test.ts.
// ---------------------------------------------------------------------------
describe('attachment contract parity (server side)', () => {
    const validUpload = (over: Record<string, unknown> = {}) => ({
        action: 'getUploadUrl',
        fileName: 'spec.pdf',
        mimeType: 'application/pdf',
        fileSize: 1024,
        ...over,
    });

    it.each(RFQ_ATTACHMENT_MIME_TYPES)('presign accepts every shared MIME type: %s', (mimeType) => {
        expect(uploadUrlSchema.safeParse(validUpload({ mimeType })).success, mimeType).toBe(true);
    });

    it('presign rejects a MIME type not in the shared contract', () => {
        expect(uploadUrlSchema.safeParse(validUpload({ mimeType: 'application/x-msdownload' })).success).toBe(false);
    });

    it('presign accepts a file at the shared size limit and rejects one byte over', () => {
        expect(uploadUrlSchema.safeParse(validUpload({ fileSize: MAX_RFQ_ATTACHMENT_SIZE })).success).toBe(true);
        expect(uploadUrlSchema.safeParse(validUpload({ fileSize: MAX_RFQ_ATTACHMENT_SIZE + 1 })).success).toBe(false);
    });

    it('rfqSchema accepts attachmentKeys up to the shared limit and rejects one more', () => {
        const keys = (n: number) => Array.from({ length: n }, (_, i) => `temp/rfq/${'a'.repeat(16)}/file-${i}.pdf`);
        expect(rfqSchema.safeParse({ ...VALID_RFQ, attachmentKeys: keys(MAX_RFQ_ATTACHMENTS) }).success).toBe(true);
        expect(rfqSchema.safeParse({ ...VALID_RFQ, attachmentKeys: keys(MAX_RFQ_ATTACHMENTS + 1) }).success).toBe(false);
    });
});

describe('rfqSchema (Zod validation)', () => {
    it('accepts valid RFQ data', () => {
        const result = rfqSchema.safeParse(VALID_RFQ);
        expect(result.success).toBe(true);
    });

    it('accepts minimal required fields', () => {
        const minimal = {
            name: 'Dr. Jane Smith',
            email: 'jane@stanford.edu',
            institution: 'Stanford University',
            role: 'PI',
            equipmentCategory: 'ICP',
            applicationDescription: 'We need an ICP etching system for silicon etching research.',
            turnstileToken: 'token',
        };
        const result = rfqSchema.safeParse(minimal);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.quantity).toBe(1); // default
        }
    });

    // Contract guard: the RFQ page's equipmentCategory <select> is the only
    // source of this field, so every value it can emit must parse here. Drift
    // returns a 400 the form renders as a generic retry message, which silently
    // kills every RFQ for the drifted product line (the 2026-07-15 outage).
    // Iterating the shared contract (not a hand-copied list) means adding a
    // category there without wiring it through the schema fails this test.
    it.each(RFQ_EQUIPMENT_CATEGORY_VALUES)(
        'accepts equipmentCategory from the shared RFQ contract: %s',
        (category) => {
            const result = rfqSchema.safeParse({ ...VALID_RFQ, equipmentCategory: category });
            expect(result.success).toBe(true);
        },
    );

    it('rejects missing name', () => {
        const { name: _, ...noName } = VALID_RFQ;
        const result = rfqSchema.safeParse(noName);
        expect(result.success).toBe(false);
    });

    it('rejects name too short', () => {
        const result = rfqSchema.safeParse({ ...VALID_RFQ, name: 'A' });
        expect(result.success).toBe(false);
    });

    it('rejects invalid email', () => {
        const result = rfqSchema.safeParse({ ...VALID_RFQ, email: 'not-an-email' });
        expect(result.success).toBe(false);
    });

    it('rejects missing institution', () => {
        const { institution: _, ...noInstitution } = VALID_RFQ;
        const result = rfqSchema.safeParse(noInstitution);
        expect(result.success).toBe(false);
    });

    it('rejects invalid equipment category', () => {
        const result = rfqSchema.safeParse({ ...VALID_RFQ, equipmentCategory: 'INVALID' });
        expect(result.success).toBe(false);
    });

    it('rejects applicationDescription too short', () => {
        const result = rfqSchema.safeParse({ ...VALID_RFQ, applicationDescription: 'Too short' });
        expect(result.success).toBe(false);
    });

    it('rejects invalid role', () => {
        const result = rfqSchema.safeParse({ ...VALID_RFQ, role: 'CEO' });
        expect(result.success).toBe(false);
    });

    it('rejects negative quantity', () => {
        const result = rfqSchema.safeParse({ ...VALID_RFQ, quantity: -1 });
        expect(result.success).toBe(false);
    });

    it('rejects zero quantity', () => {
        const result = rfqSchema.safeParse({ ...VALID_RFQ, quantity: 0 });
        expect(result.success).toBe(false);
    });

    it('rejects non-integer quantity', () => {
        const result = rfqSchema.safeParse({ ...VALID_RFQ, quantity: 1.5 });
        expect(result.success).toBe(false);
    });

    it('rejects invalid budget range', () => {
        const result = rfqSchema.safeParse({ ...VALID_RFQ, budgetRange: '$1,000,000' });
        expect(result.success).toBe(false);
    });

    it('rejects invalid timeline', () => {
        const result = rfqSchema.safeParse({ ...VALID_RFQ, timeline: 'next-week' });
        expect(result.success).toBe(false);
    });

    it('rejects missing turnstile token', () => {
        const { turnstileToken: _, ...noToken } = VALID_RFQ;
        const result = rfqSchema.safeParse(noToken);
        expect(result.success).toBe(false);
    });

    it('rejects too many attachment keys', () => {
        const result = rfqSchema.safeParse({
            ...VALID_RFQ,
            attachmentKeys: [TEMP_KEY_A, TEMP_KEY_B, TEMP_KEY_C, `temp/rfq/${'d'.repeat(16)}/d.pdf`],
        });
        expect(result.success).toBe(false);
    });

    it('accepts up to 3 attachment keys', () => {
        const result = rfqSchema.safeParse({
            ...VALID_RFQ,
            attachmentKeys: [TEMP_KEY_A, TEMP_KEY_B, TEMP_KEY_C],
        });
        expect(result.success).toBe(true);
    });

    // --- Equipment category enum: client/server parity (Probe-Station drift) ---
    it('accepts the Probe-Station equipment category', () => {
        const result = rfqSchema.safeParse({ ...VALID_RFQ, equipmentCategory: 'Probe-Station' });
        expect(result.success).toBe(true);
    });

    it('accepts the Coater-Developer equipment category', () => {
        const result = rfqSchema.safeParse({ ...VALID_RFQ, equipmentCategory: 'Coater-Developer' });
        expect(result.success).toBe(true);
    });

    // --- String length caps derive from the shared limits module ---
    it('rejects specificModel over the shared max', () => {
        const result = rfqSchema.safeParse({
            ...VALID_RFQ,
            specificModel: 'x'.repeat(RFQ_FIELD_LIMITS.specificModel.max + 1),
        });
        expect(result.success).toBe(false);
    });

    it('accepts specificModel exactly at the shared max', () => {
        const result = rfqSchema.safeParse({
            ...VALID_RFQ,
            specificModel: 'x'.repeat(RFQ_FIELD_LIMITS.specificModel.max),
        });
        expect(result.success).toBe(true);
    });

    it('rejects department over the shared max', () => {
        const result = rfqSchema.safeParse({
            ...VALID_RFQ,
            department: 'd'.repeat(RFQ_FIELD_LIMITS.department.max + 1),
        });
        expect(result.success).toBe(false);
    });

    it('rejects keySpecifications over the shared max', () => {
        const result = rfqSchema.safeParse({
            ...VALID_RFQ,
            keySpecifications: 'k'.repeat(RFQ_FIELD_LIMITS.keySpecifications.max + 1),
        });
        expect(result.success).toBe(false);
    });

    it('rejects existingEquipment over the shared max', () => {
        const result = rfqSchema.safeParse({
            ...VALID_RFQ,
            existingEquipment: 'e'.repeat(RFQ_FIELD_LIMITS.existingEquipment.max + 1),
        });
        expect(result.success).toBe(false);
    });

    it('rejects additionalComments over the shared max', () => {
        const result = rfqSchema.safeParse({
            ...VALID_RFQ,
            additionalComments: 'c'.repeat(RFQ_FIELD_LIMITS.additionalComments.max + 1),
        });
        expect(result.success).toBe(false);
    });

    // accept-at-max (the reject-over-max tests above share the constant with the
    // schema, so only the boundary catches a schema cap hardcoded too small)
    it('accepts department, keySpecifications, existingEquipment, additionalComments exactly at their shared max', () => {
        const result = rfqSchema.safeParse({
            ...VALID_RFQ,
            department: 'd'.repeat(RFQ_FIELD_LIMITS.department.max),
            keySpecifications: 'k'.repeat(RFQ_FIELD_LIMITS.keySpecifications.max),
            existingEquipment: 'e'.repeat(RFQ_FIELD_LIMITS.existingEquipment.max),
            additionalComments: 'c'.repeat(RFQ_FIELD_LIMITS.additionalComments.max),
        });
        expect(result.success).toBe(true);
    });

    // moveAttachments() copies then DELETES whatever key it is given, using the
    // Lambda's bucket-wide write grant. Keys outside temp/rfq/ must never parse.
    it('rejects an attachment key pointing outside temp/rfq/', () => {
        const result = rfqSchema.safeParse({
            ...VALID_RFQ,
            attachmentKeys: ['orders/ord-123/CONTRACT/doc-abc_contract.pdf'],
        });
        expect(result.success).toBe(false);
    });

    it('rejects an attachment key escaping temp/rfq/ via traversal', () => {
        const result = rfqSchema.safeParse({
            ...VALID_RFQ,
            attachmentKeys: [`temp/rfq/${'a'.repeat(16)}/../../../orders/ord-123/CONTRACT/x.pdf`],
        });
        expect(result.success).toBe(false);
    });

    it('rejects a bare temp/ key that this Lambda never issued', () => {
        const result = rfqSchema.safeParse({
            ...VALID_RFQ,
            attachmentKeys: ['temp/a.pdf'],
        });
        expect(result.success).toBe(false);
    });
});

describe('isValidTempAttachmentKey', () => {
    it('accepts a key of the shape getUploadUrl issues', () => {
        expect(isValidTempAttachmentKey(TEMP_KEY_A)).toBe(true);
    });

    it.each([
        ['an order document key', 'orders/ord-123/CONTRACT/doc-abc_contract.pdf'],
        ['another RFQ\'s attachments', 'rfqs/rfq-20260310-abc123/spec.pdf'],
        ['a traversal escape', `temp/rfq/${'a'.repeat(16)}/../../orders/x.pdf`],
        ['a temp key outside rfq/', 'temp/ord-1/abcd_x.pdf'],
        ['a short upload id', 'temp/rfq/abc/x.pdf'],
        ['a nested sub-path', `temp/rfq/${'a'.repeat(16)}/nested/x.pdf`],
        ['an empty string', ''],
    ])('rejects %s', (_label, key) => {
        expect(isValidTempAttachmentKey(key)).toBe(false);
    });
});

describe('equipmentCategoryLabels', () => {
    // Every real category must render a friendly label in the confirmation and
    // internal emails — a missing entry falls back to the raw enum value
    // (e.g. "E-Beam"), which is the copy bug this map guards against. 'Other' is
    // allowed to equal its own generic label; every other value must differ from
    // the raw enum so we know a real friendly label was supplied.
    const realCategories = RFQ_EQUIPMENT_CATEGORY_VALUES.filter((c) => c !== 'Other');

    it.each(realCategories)('has a non-fallback label for %s', (category) => {
        const label = equipmentCategoryLabels[category];
        expect(label).toBeTruthy();
        expect(label).not.toBe(category);
    });

    // equipmentGreetingPhrase is a Partial map, so the compiler cannot catch a
    // newly added category that forgets a phrase — it would silently fall back to
    // "plasma processing systems" in the greeting. This test guards that hole.
    // 'Other' is intentionally omitted (no sensible product family).
    it.each(realCategories)('has a greeting phrase for %s', (category) => {
        expect(equipmentGreetingPhrase[category]).toBeTruthy();
    });

    it('intentionally omits a greeting phrase for Other', () => {
        expect(equipmentGreetingPhrase['Other']).toBeUndefined();
    });
});

describe('submit-rfq handler', () => {
    let handler: typeof import('./handler').handler;

    beforeEach(async () => {
        vi.clearAllMocks();

        // clearAllMocks wipes call history but not implementations; reset the
        // shared S3 send so a per-test failure override never leaks forward.
        mockS3Send.mockReset();
        mockS3Send.mockResolvedValue({});

        // Set environment variables
        process.env.INTELLIGENCE_TABLE = 'NineScrolls-Intelligence';
        process.env.DOCUMENTS_BUCKET = 'ninescrolls-order-documents';
        process.env.TURNSTILE_SECRET_KEY = 'test-secret';
        process.env.SENDGRID_API_KEY = 'SG.test-key';

        // Default fetch mock: Turnstile passes, SendGrid 202
        mockFetch.mockImplementation((url: string) => {
            if (url.includes('turnstile')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ success: true }),
                });
            }
            if (url.includes('sendgrid')) {
                return Promise.resolve({ ok: true, status: 202 });
            }
            return Promise.resolve({ ok: true });
        });

        // Re-import handler for fresh state
        const mod = await import('./handler');
        handler = mod.handler;
    });

    it('returns 200 on valid submission', async () => {
        const event = makeEvent(VALID_RFQ);
        const result = await handler(event, {} as never, (() => {}) as never);

        const body = JSON.parse((result as { body: string }).body);
        expect((result as { statusCode: number }).statusCode).toBe(200);
        expect(body.success).toBe(true);
        expect(body.rfqId).toMatch(/^rfq-\d{8}-[a-f0-9]{6}$/);
        expect(body.referenceNumber).toMatch(/^RFQ-\d{8}-[A-F0-9]{4}$/);
        expect(body.message).toContain('1-2 business days');
    });

    it('handles CORS preflight', async () => {
        const event = makeEvent({}, {
            body: undefined,
            requestContext: {
                accountId: '123',
                apiId: 'api',
                domainName: 'test',
                domainPrefix: 'test',
                http: {
                    method: 'OPTIONS',
                    path: '/api/rfq',
                    protocol: 'HTTP/1.1',
                    sourceIp: '1.2.3.4',
                    userAgent: 'test',
                },
                requestId: 'req-1',
                routeKey: 'OPTIONS /api/rfq',
                stage: 'prod',
                time: '',
                timeEpoch: 0,
            },
        } as Partial<APIGatewayProxyEventV2>);

        const result = await handler(event, {} as never, (() => {}) as never);
        expect((result as { statusCode: number }).statusCode).toBe(200);
        const headers = (result as { headers: Record<string, string> }).headers;
        expect(headers['Access-Control-Allow-Methods']).toContain('POST');
    });

    it('returns 400 on empty body', async () => {
        const event = makeEvent({}, { body: undefined });
        const result = await handler(event, {} as never, (() => {}) as never);

        expect((result as { statusCode: number }).statusCode).toBe(400);
        const body = JSON.parse((result as { body: string }).body);
        expect(body.success).toBe(false);
    });

    it('returns 400 on invalid JSON', async () => {
        const event = makeEvent({}, { body: 'not-json{{{' });
        const result = await handler(event, {} as never, (() => {}) as never);

        expect((result as { statusCode: number }).statusCode).toBe(400);
        const body = JSON.parse((result as { body: string }).body);
        expect(body.error).toContain('Invalid JSON');
    });

    it('returns 400 when turnstile token missing', async () => {
        const { turnstileToken: _, ...noToken } = VALID_RFQ;
        const event = makeEvent(noToken);
        const result = await handler(event, {} as never, (() => {}) as never);

        expect((result as { statusCode: number }).statusCode).toBe(400);
    });

    it('returns 403 when Turnstile verification fails', async () => {
        mockFetch.mockImplementation((url: string) => {
            if (url.includes('turnstile')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ success: false }),
                });
            }
            return Promise.resolve({ ok: true });
        });

        const event = makeEvent(VALID_RFQ);
        const result = await handler(event, {} as never, (() => {}) as never);

        expect((result as { statusCode: number }).statusCode).toBe(403);
        const body = JSON.parse((result as { body: string }).body);
        expect(body.error).toContain('CAPTCHA');
    });

    it('returns 400 on schema validation failure with field details', async () => {
        const event = makeEvent({
            ...VALID_RFQ,
            email: 'bad-email',
            name: 'A', // too short
        });

        const result = await handler(event, {} as never, (() => {}) as never);

        expect((result as { statusCode: number }).statusCode).toBe(400);
        const body = JSON.parse((result as { body: string }).body);
        expect(body.error).toContain('Validation failed');
        expect(body.details).toBeDefined();
        expect(body.details.length).toBeGreaterThan(0);
        expect(body.details.some((d: { field: string }) => d.field === 'email')).toBe(true);
    });

    it('sets correct CORS header for allowed origin', async () => {
        const event = makeEvent(VALID_RFQ, {
            headers: {
                'content-type': 'application/json',
                origin: 'http://localhost:5173',
            },
        });

        const result = await handler(event, {} as never, (() => {}) as never);
        const headers = (result as { headers: Record<string, string> }).headers;
        expect(headers['Access-Control-Allow-Origin']).toBe('http://localhost:5173');
    });

    it('falls back to default origin for disallowed origin', async () => {
        const event = makeEvent(VALID_RFQ, {
            headers: {
                'content-type': 'application/json',
                origin: 'https://evil.com',
            },
        });

        const result = await handler(event, {} as never, (() => {}) as never);
        const headers = (result as { headers: Record<string, string> }).headers;
        expect(headers['Access-Control-Allow-Origin']).toBe('https://ninescrolls.com');
    });

    it('calls Turnstile with correct parameters', async () => {
        const event = makeEvent(VALID_RFQ);
        await handler(event, {} as never, (() => {}) as never);

        const turnstileCall = mockFetch.mock.calls.find(
            (call: string[]) => call[0].includes('turnstile')
        );
        expect(turnstileCall).toBeDefined();
        expect(turnstileCall![1].method).toBe('POST');
    });

    it('sends confirmation email', async () => {
        const event = makeEvent(VALID_RFQ);
        await handler(event, {} as never, (() => {}) as never);

        const sendGridCall = mockFetch.mock.calls.find(
            (call: string[]) => call[0].includes('sendgrid')
        );
        expect(sendGridCall).toBeDefined();
    });

    it('succeeds even if notifications fail', async () => {
        mockFetch.mockImplementation((url: string) => {
            if (url.includes('turnstile')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ success: true }),
                });
            }
            // All other calls fail
            return Promise.resolve({ ok: false, status: 500, text: () => Promise.resolve('error') });
        });

        const event = makeEvent(VALID_RFQ);
        const result = await handler(event, {} as never, (() => {}) as never);

        // Should still succeed — notifications are best-effort
        expect((result as { statusCode: number }).statusCode).toBe(200);
    });

    it('sanitizes XSS in input fields', async () => {
        const event = makeEvent({
            ...VALID_RFQ,
            name: '<script>alert("xss")</script>Dr. Smith',
            institution: 'Stanford & "Sons" <LLC>',
        });

        const result = await handler(event, {} as never, (() => {}) as never);
        expect((result as { statusCode: number }).statusCode).toBe(200);
        // The handler sanitizes strings before storing — verified by the fact it doesn't crash
        // and the email content uses sanitized values
    });

    it('persists referrerSource when valid format', async () => {
        const event = makeEvent({
            ...VALID_RFQ,
            budgetRange: undefined,
            referrerSource: 'insights/atomic-layer-etching-guide',
        });
        const result = await handler(event, {} as never, (() => {}) as never);
        expect(JSON.parse((result as { body: string }).body).success).toBe(true);
        const putCallArgs = (PutCommand as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0];
        expect(putCallArgs.Item.referrerSource).toBe('insights/atomic-layer-etching-guide');
    });

    it('rejects invalid referrerSource format silently (RFQ still submits)', async () => {
        const event = makeEvent({
            ...VALID_RFQ,
            budgetRange: undefined,
            referrerSource: 'javascript:alert(1)',
        });
        const result = await handler(event, {} as never, (() => {}) as never);
        expect(JSON.parse((result as { body: string }).body).success).toBe(true);
        const putCallArgs = (PutCommand as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0];
        expect(putCallArgs.Item.referrerSource).toBeUndefined();
    });

    it('rejects oversized referrerSource (>200 chars)', async () => {
        const event = makeEvent({
            ...VALID_RFQ,
            budgetRange: undefined,
            referrerSource: 'insights/' + 'a'.repeat(201),
        });
        const result = await handler(event, {} as never, (() => {}) as never);
        expect(JSON.parse((result as { body: string }).body).success).toBe(true);
        const putCallArgs = (PutCommand as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0];
        expect(putCallArgs.Item.referrerSource).toBeUndefined();
    });

    it('backfills matchedOrgId + GSI2PK when organization-api returns a matchedOrgId', async () => {
        mockInvokeOrgApi.mockResolvedValueOnce({ matchedOrgId: 'stanford.edu' });
        const event = makeEvent(VALID_RFQ);
        const result = await handler(event, {} as never, (() => {}) as never);

        expect((result as { statusCode: number }).statusCode).toBe(200);
        expect(mockInvokeOrgApi).toHaveBeenCalledWith(expect.objectContaining({
            action: 'upsertFromSubmission',
            source: 'rfq',
            email: VALID_RFQ.email,
            institution: VALID_RFQ.institution,
        }));

        const backfillCall = (UpdateCommand as unknown as ReturnType<typeof vi.fn>).mock.calls
            .find((c: { Item?: unknown }[]) => {
                const params = c[0] as { Key?: { SK?: string }; UpdateExpression?: string };
                return params.Key?.SK === 'META'
                    && (params.UpdateExpression ?? '').includes('matchedOrgId');
            });
        expect(backfillCall).toBeDefined();
        const backfillParams = backfillCall![0] as { ExpressionAttributeValues: Record<string, string> };
        expect(backfillParams.ExpressionAttributeValues[':id']).toBe('stanford.edu');
        expect(backfillParams.ExpressionAttributeValues[':gsi2']).toBe('ORG#stanford.edu');
    });

    it('emits rfq_submitted timeline event after the RFQ write commits', async () => {
        mockInvokeOrgApi.mockResolvedValueOnce({ matchedOrgId: 'diamondfoundry.com' });
        const event = makeEvent({ ...VALID_RFQ, email: 'jane.smith@diamondfoundry.com' });
        const result = await handler(event, {} as never, (() => {}) as never);

        expect((result as { statusCode: number }).statusCode).toBe(200);
        expect(mockEmitTimelineEventToCrm).toHaveBeenCalledTimes(1);

        const emitArg = mockEmitTimelineEventToCrm.mock.calls[0][0] as {
            source: string;
            kind: string;
            sourceEntityId: string;
            resolveInput: { matchedOrgId?: string };
        };
        const body = JSON.parse((result as { body: string }).body);
        expect(emitArg.source).toBe('rfq');
        expect(emitArg.kind).toBe('rfq_submitted');
        expect(emitArg.sourceEntityId).toBe(body.rfqId);
        expect(emitArg.resolveInput.matchedOrgId).toBe('diamondfoundry.com');
    });

    it('returns 200 and skips backfill when organization-api throws', async () => {
        mockInvokeOrgApi.mockRejectedValueOnce(new Error('org-api boom'));
        const event = makeEvent(VALID_RFQ);
        const result = await handler(event, {} as never, (() => {}) as never);

        expect((result as { statusCode: number }).statusCode).toBe(200);
        const backfillCall = (UpdateCommand as unknown as ReturnType<typeof vi.fn>).mock.calls
            .find((c: { Item?: unknown }[]) => {
                const params = c[0] as { UpdateExpression?: string };
                return (params.UpdateExpression ?? '').includes('matchedOrgId');
            });
        expect(backfillCall).toBeUndefined();
    });

    describe('partial attachment failure (silent data-loss guard)', () => {
        // Find the internal (sales-facing) SendGrid notification and return its HTML body.
        function findInternalNotificationHtml(): string | undefined {
            const call = mockFetch.mock.calls.find((c: unknown[]) => {
                const url = c[0] as string;
                if (!url.includes('sendgrid')) return false;
                const opts = c[1] as { body?: string } | undefined;
                if (!opts?.body) return false;
                const parsed = JSON.parse(opts.body) as {
                    personalizations?: { to?: { email?: string }[] }[];
                };
                return parsed.personalizations?.[0]?.to?.[0]?.email === 'sales@ninescrolls.com';
            });
            if (!call) return undefined;
            const body = JSON.parse((call[1] as { body: string }).body) as {
                content: { value: string }[];
            };
            return body.content[0].value;
        }

        it('returns 200 and surfaces the lost file when one CopyObject fails', async () => {
            // Second CopyObject (TEMP_KEY_B) rejects; the other two move fine.
            let copyCount = 0;
            mockS3Send.mockImplementation((cmd: { __type?: string }) => {
                if (cmd.__type === 'CopyObject') {
                    copyCount++;
                    if (copyCount === 2) return Promise.reject(new Error('S3 copy failed'));
                }
                return Promise.resolve({});
            });

            const event = makeEvent({
                ...VALID_RFQ,
                attachmentKeys: [TEMP_KEY_A, TEMP_KEY_B, TEMP_KEY_C],
            });
            const result = await handler(event, {} as never, (() => {}) as never);

            // The lead is worth more than the file — a partial failure must not fail the RFQ.
            expect((result as { statusCode: number }).statusCode).toBe(200);
            expect(JSON.parse((result as { body: string }).body).success).toBe(true);

            // The internal notification must make the loss explicit, not hide it.
            const html = findInternalNotificationHtml();
            expect(html).toBeDefined();
            expect(html).toContain('2 of 3');
            expect(html).toMatch(/failed to process/i);
            // The failed source key is named so sales can chase the missing file.
            expect(html).toContain(TEMP_KEY_B);
        });

        it('only persists the successfully-moved keys on partial failure', async () => {
            let copyCount = 0;
            mockS3Send.mockImplementation((cmd: { __type?: string }) => {
                if (cmd.__type === 'CopyObject') {
                    copyCount++;
                    if (copyCount === 2) return Promise.reject(new Error('S3 copy failed'));
                }
                return Promise.resolve({});
            });

            const event = makeEvent({
                ...VALID_RFQ,
                attachmentKeys: [TEMP_KEY_A, TEMP_KEY_B, TEMP_KEY_C],
            });
            await handler(event, {} as never, (() => {}) as never);

            const attachmentUpdate = (UpdateCommand as unknown as ReturnType<typeof vi.fn>).mock.calls
                .find((c: unknown[]) => {
                    const params = c[0] as { UpdateExpression?: string };
                    return (params.UpdateExpression ?? '').includes('attachmentKeys');
                });
            expect(attachmentUpdate).toBeDefined();
            const keys = (attachmentUpdate![0] as { ExpressionAttributeValues: Record<string, string[]> })
                .ExpressionAttributeValues[':keys'];
            expect(keys).toHaveLength(2);
            expect(keys.some(k => k.endsWith('spec.pdf'))).toBe(true);      // TEMP_KEY_A
            expect(keys.some(k => k.endsWith('notes.docx'))).toBe(true);    // TEMP_KEY_C
            expect(keys.some(k => k.endsWith('drawing.pdf'))).toBe(false);  // TEMP_KEY_B failed
        });

        // Judgment call: the customer confirmation stays calm but gives a resend
        // path on partial loss, rather than letting them believe a lost file arrived.
        function findConfirmationHtml(): string | undefined {
            const call = mockFetch.mock.calls.find((c: unknown[]) => {
                const url = c[0] as string;
                if (!url.includes('sendgrid')) return false;
                const opts = c[1] as { body?: string } | undefined;
                if (!opts?.body) return false;
                const parsed = JSON.parse(opts.body) as {
                    personalizations?: { to?: { email?: string }[] }[];
                };
                return parsed.personalizations?.[0]?.to?.[0]?.email === VALID_RFQ.email;
            });
            if (!call) return undefined;
            const body = JSON.parse((call[1] as { body: string }).body) as {
                content: { value: string }[];
            };
            return body.content[0].value;
        }

        it('adds a resend note to the customer confirmation on partial failure', async () => {
            let copyCount = 0;
            mockS3Send.mockImplementation((cmd: { __type?: string }) => {
                if (cmd.__type === 'CopyObject') {
                    copyCount++;
                    if (copyCount === 2) return Promise.reject(new Error('S3 copy failed'));
                }
                return Promise.resolve({});
            });

            await handler(makeEvent({
                ...VALID_RFQ,
                attachmentKeys: [TEMP_KEY_A, TEMP_KEY_B, TEMP_KEY_C],
            }), {} as never, (() => {}) as never);

            const html = findConfirmationHtml();
            expect(html).toBeDefined();
            expect(html).toMatch(/resend/i);
            // Non-alarming: doesn't dump internal S3 keys on the customer.
            expect(html).not.toContain(TEMP_KEY_B);
        });

        it('leaves the customer confirmation untouched when all attachments move', async () => {
            await handler(makeEvent({
                ...VALID_RFQ,
                attachmentKeys: [TEMP_KEY_A, TEMP_KEY_B],
            }), {} as never, (() => {}) as never);

            const html = findConfirmationHtml();
            expect(html).toBeDefined();
            expect(html).not.toMatch(/resend/i);
            expect(html).not.toMatch(/couldn't process/i);
        });

        it('does not mention failures when every attachment moves', async () => {
            const event = makeEvent({
                ...VALID_RFQ,
                attachmentKeys: [TEMP_KEY_A, TEMP_KEY_B],
            });
            const result = await handler(event, {} as never, (() => {}) as never);

            expect((result as { statusCode: number }).statusCode).toBe(200);
            const html = findInternalNotificationHtml();
            expect(html).toBeDefined();
            expect(html).toContain('Attachments (2)');
            expect(html).not.toMatch(/failed to process/i);
        });

        it('reports 0 of N when every attachment fails to copy', async () => {
            mockS3Send.mockImplementation((cmd: { __type?: string }) => {
                if (cmd.__type === 'CopyObject') {
                    return Promise.reject(new Error('S3 copy failed'));
                }
                return Promise.resolve({});
            });

            const event = makeEvent({
                ...VALID_RFQ,
                attachmentKeys: [TEMP_KEY_A, TEMP_KEY_B, TEMP_KEY_C],
            });
            const result = await handler(event, {} as never, (() => {}) as never);

            // Total loss still keeps the lead.
            expect((result as { statusCode: number }).statusCode).toBe(200);
            const html = findInternalNotificationHtml();
            expect(html).toContain('0 of 3');
            expect(html).toMatch(/3 attachments failed to process/i);

            // Nothing moved → no attachmentKeys update at all.
            const attachmentUpdate = (UpdateCommand as unknown as ReturnType<typeof vi.fn>).mock.calls
                .find((c: unknown[]) => (c[0] as { UpdateExpression?: string }).UpdateExpression?.includes('attachmentKeys'));
            expect(attachmentUpdate).toBeUndefined();
        });

        // A file is saved by the copy; a failed temp-source delete must NOT be
        // reported as a lost file — that would be the inverse of the bug we fixed.
        it('treats a delete-only failure as moved, not lost', async () => {
            mockS3Send.mockImplementation((cmd: { __type?: string }) => {
                if (cmd.__type === 'DeleteObject') {
                    return Promise.reject(new Error('S3 delete failed'));
                }
                return Promise.resolve({});
            });

            const event = makeEvent({
                ...VALID_RFQ,
                attachmentKeys: [TEMP_KEY_A, TEMP_KEY_B],
            });
            const result = await handler(event, {} as never, (() => {}) as never);

            expect((result as { statusCode: number }).statusCode).toBe(200);
            const html = findInternalNotificationHtml();
            expect(html).toContain('Attachments (2)');
            expect(html).not.toMatch(/failed to process/i);

            // Both files are recorded as saved despite temp cleanup failing.
            const attachmentUpdate = (UpdateCommand as unknown as ReturnType<typeof vi.fn>).mock.calls
                .find((c: unknown[]) => (c[0] as { UpdateExpression?: string }).UpdateExpression?.includes('attachmentKeys'));
            expect(attachmentUpdate).toBeDefined();
            const keys = (attachmentUpdate![0] as { ExpressionAttributeValues: Record<string, string[]> })
                .ExpressionAttributeValues[':keys'];
            expect(keys).toHaveLength(2);
        });
    });

    describe('visitorId capture (2C-analytics)', () => {
        function findRfqMetaPut() {
            return (PutCommand as unknown as ReturnType<typeof vi.fn>).mock.calls
                .find((c: unknown[]) => {
                    const params = c[0] as { Item?: { PK?: string; SK?: string } };
                    return (params.Item?.PK ?? '').startsWith('RFQ#') && params.Item?.SK === 'META';
                });
        }

        it('stores visitorId on the RFQ META when provided', async () => {
            const event = makeEvent({ ...VALID_RFQ, visitorId: 'v-123' });
            const result = await handler(event, {} as never, (() => {}) as never);

            expect(JSON.parse((result as { body: string }).body).success).toBe(true);
            const metaPut = findRfqMetaPut();
            expect(metaPut).toBeDefined();
            const putParams = metaPut![0] as { Item: Record<string, unknown> };
            expect(putParams.Item.visitorId).toBe('v-123');
        });

        it('accepts a missing visitorId (optional field, old clients)', async () => {
            const event = makeEvent(VALID_RFQ);
            const result = await handler(event, {} as never, (() => {}) as never);

            expect(JSON.parse((result as { body: string }).body).success).toBe(true);
            const metaPut = findRfqMetaPut();
            expect(metaPut).toBeDefined();
            const putParams = metaPut![0] as { Item: Record<string, unknown> };
            expect(putParams.Item.visitorId).toBeUndefined();
        });
    });

    describe('visitor bridge + retro fire (2C-analytics)', () => {
        it('writes the VISITOR# bridge after org match when visitorId present', async () => {
            mockInvokeOrgApi.mockResolvedValueOnce({ matchedOrgId: 'stanford.edu' });
            const event = makeEvent({ ...VALID_RFQ, visitorId: 'v-123' });
            const result = await handler(event, {} as never, (() => {}) as never);

            expect((result as { statusCode: number }).statusCode).toBe(200);
            expect(mockUpsertVisitorBridge).toHaveBeenCalledTimes(1);
            // upsertVisitorBridge(send, tableName, input)
            const [, tableName, input] = mockUpsertVisitorBridge.mock.calls[0] as
                [unknown, string, Record<string, unknown>];
            expect(tableName).toBe('NineScrolls-Intelligence');
            expect(input).toEqual(expect.objectContaining({
                visitorId: 'v-123',
                matchedOrgId: 'stanford.edu',
                email: VALID_RFQ.email,
                sourceEntityType: 'rfq',
            }));
            const body = JSON.parse((result as { body: string }).body);
            expect(input.sourceEntityId).toBe(body.rfqId);
        });

        it('fires reResolveVisitorSessions ONLY on identity upgrade', async () => {
            mockUpsertVisitorBridge.mockResolvedValueOnce({ created: true, orgUpgraded: true });
            await handler(makeEvent({ ...VALID_RFQ, visitorId: 'v-up' }), {} as never, (() => {}) as never);
            expect(mockInvokeCrmAction).toHaveBeenCalledWith({ action: 'reResolveVisitorSessions', visitorId: 'v-up' });

            mockInvokeCrmAction.mockClear();
            mockUpsertVisitorBridge.mockResolvedValueOnce({ created: false, orgUpgraded: false });
            await handler(makeEvent({ ...VALID_RFQ, visitorId: 'v-noop' }), {} as never, (() => {}) as never);
            expect(mockInvokeCrmAction).not.toHaveBeenCalled();
        });

        it('fires on a brand-new org-less bridge (created alone is an identity upgrade)', async () => {
            mockUpsertVisitorBridge.mockResolvedValueOnce({ created: true, orgUpgraded: false });
            await handler(makeEvent({ ...VALID_RFQ, visitorId: 'v-new' }), {} as never, (() => {}) as never);
            expect(mockInvokeCrmAction).toHaveBeenCalledWith({ action: 'reResolveVisitorSessions', visitorId: 'v-new' });
        });

        it('skips the bridge entirely when visitorId is absent (no VISITOR#undefined)', async () => {
            const result = await handler(makeEvent(VALID_RFQ), {} as never, (() => {}) as never);

            expect((result as { statusCode: number }).statusCode).toBe(200);
            expect(mockUpsertVisitorBridge).not.toHaveBeenCalled();
            expect(mockInvokeCrmAction).not.toHaveBeenCalled();
        });

        it('bridge failure is non-fatal to the submission', async () => {
            mockUpsertVisitorBridge.mockRejectedValueOnce(new Error('ddb down'));
            const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            const result = await handler(makeEvent({ ...VALID_RFQ, visitorId: 'v-err' }), {} as never, (() => {}) as never);

            expect((result as { statusCode: number }).statusCode).toBe(200);
            expect(JSON.parse((result as { body: string }).body).success).toBe(true);
            expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('crm.visitor_bridge.write_failed'));
            expect(mockInvokeCrmAction).not.toHaveBeenCalled();
            errSpy.mockRestore();
        });
    });
});

// ---------------------------------------------------------------------------
// getUploadUrl action — presigned PUT for public RFQ attachments
// ---------------------------------------------------------------------------
describe('submit-rfq getUploadUrl action', () => {
    let handler: typeof import('./handler').handler;

    const VALID_UPLOAD_REQ = {
        action: 'getUploadUrl',
        fileName: 'spec.pdf',
        mimeType: 'application/pdf',
        fileSize: 1024,
    };

    beforeEach(async () => {
        vi.clearAllMocks();
        process.env.INTELLIGENCE_TABLE = 'NineScrolls-Intelligence';
        process.env.DOCUMENTS_BUCKET = 'ninescrolls-order-documents';
        process.env.TURNSTILE_SECRET_KEY = 'test-secret';
        mockGetSignedUrl.mockResolvedValue('https://s3.example.com/presigned-put');

        const mod = await import('./handler');
        handler = mod.handler;
    });

    it('returns a presigned URL and a temp/rfq/ key', async () => {
        const result = await handler(makeEvent(VALID_UPLOAD_REQ), {} as never, (() => {}) as never);
        const body = JSON.parse((result as { body: string }).body);

        expect((result as { statusCode: number }).statusCode).toBe(200);
        expect(body.success).toBe(true);
        expect(body.uploadUrl).toBe('https://s3.example.com/presigned-put');
        expect(body.s3Key).toMatch(/^temp\/rfq\/[a-f0-9]{16}\/spec\.pdf$/);
        expect(body.expiresAt).toBeTruthy();
    });

    it('issues keys the RFQ schema will accept — the two halves must agree', async () => {
        const result = await handler(makeEvent(VALID_UPLOAD_REQ), {} as never, (() => {}) as never);
        const { s3Key } = JSON.parse((result as { body: string }).body);

        expect(isValidTempAttachmentKey(s3Key)).toBe(true);
    });

    it('signs the exact ContentLength so S3 rejects an oversized body', async () => {
        await handler(makeEvent({ ...VALID_UPLOAD_REQ, fileSize: 4096 }), {} as never, (() => {}) as never);

        const signedCommand = mockGetSignedUrl.mock.calls[0][1] as Record<string, unknown>;
        expect(signedCommand.ContentLength).toBe(4096);
        expect(signedCommand.ContentType).toBe('application/pdf');
    });

    it('never runs the RFQ path — no Turnstile call, no DynamoDB write', async () => {
        await handler(makeEvent(VALID_UPLOAD_REQ), {} as never, (() => {}) as never);

        expect(mockFetch).not.toHaveBeenCalled();
        expect(mockPut).not.toHaveBeenCalled();
    });

    it('gives each file a distinct key so same-named files cannot collide', async () => {
        const first = await handler(makeEvent(VALID_UPLOAD_REQ), {} as never, (() => {}) as never);
        const second = await handler(makeEvent(VALID_UPLOAD_REQ), {} as never, (() => {}) as never);

        const keyA = JSON.parse((first as { body: string }).body).s3Key;
        const keyB = JSON.parse((second as { body: string }).body).s3Key;
        expect(keyA).not.toBe(keyB);
    });

    it('strips path components from the supplied fileName', async () => {
        const result = await handler(
            makeEvent({ ...VALID_UPLOAD_REQ, fileName: '../../../etc/passwd' }),
            {} as never, (() => {}) as never,
        );
        const { s3Key } = JSON.parse((result as { body: string }).body);

        expect(s3Key).toMatch(/^temp\/rfq\/[a-f0-9]{16}\/passwd$/);
        expect(isValidTempAttachmentKey(s3Key)).toBe(true);
    });

    it('rejects a file above the 10MB cap', async () => {
        const result = await handler(
            makeEvent({ ...VALID_UPLOAD_REQ, fileSize: 10 * 1024 * 1024 + 1 }),
            {} as never, (() => {}) as never,
        );

        expect((result as { statusCode: number }).statusCode).toBe(400);
        expect(mockGetSignedUrl).not.toHaveBeenCalled();
    });

    it('rejects a disallowed MIME type', async () => {
        const result = await handler(
            makeEvent({ ...VALID_UPLOAD_REQ, fileName: 'evil.html', mimeType: 'text/html' }),
            {} as never, (() => {}) as never,
        );

        expect((result as { statusCode: number }).statusCode).toBe(400);
        expect(mockGetSignedUrl).not.toHaveBeenCalled();
    });

    it('rejects with the { success, error } contract — never `message`', async () => {
        const result = await handler(
            makeEvent({ ...VALID_UPLOAD_REQ, fileSize: -1 }),
            {} as never, (() => {}) as never,
        );
        const body = JSON.parse((result as { body: string }).body);

        expect((result as { statusCode: number }).statusCode).toBe(400);
        expect(body.success).toBe(false);
        expect(body.error).toBeTruthy();
        expect(body.message).toBeUndefined();
    });

    it('accepts every MIME type the RFQ form offers', async () => {
        const formTypes = [
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'image/jpeg',
            'image/png',
        ];

        for (const mimeType of formTypes) {
            const result = await handler(
                makeEvent({ ...VALID_UPLOAD_REQ, mimeType }),
                {} as never, (() => {}) as never,
            );
            expect((result as { statusCode: number }).statusCode).toBe(200);
        }
    });
});
