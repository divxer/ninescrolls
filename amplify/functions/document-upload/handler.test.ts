import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockPut = vi.fn().mockResolvedValue({});
const mockSend = vi.fn().mockImplementation((cmd: unknown) => {
    const name = (cmd as { constructor: { name: string } }).constructor.name;
    if (name === 'PutCommand') return mockPut();
    return Promise.resolve({});
});

vi.mock('@aws-sdk/client-dynamodb', () => ({
    DynamoDBClient: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@aws-sdk/lib-dynamodb', () => ({
    DynamoDBDocumentClient: { from: vi.fn().mockReturnValue({ send: mockSend }) },
    PutCommand: vi.fn().mockImplementation((p) => ({ ...p, constructor: { name: 'PutCommand' } })),
    UpdateCommand: vi.fn().mockImplementation((p) => ({ ...p, constructor: { name: 'UpdateCommand' } })),
}));

const mockS3Send = vi.fn().mockResolvedValue({});
vi.mock('@aws-sdk/client-s3', () => ({
    S3Client: vi.fn().mockImplementation(() => ({ send: mockS3Send })),
    PutObjectCommand: vi.fn().mockImplementation((p) => p),
    CopyObjectCommand: vi.fn().mockImplementation((p) => p),
    DeleteObjectCommand: vi.fn().mockImplementation((p) => p),
}));

vi.mock('@aws-sdk/s3-request-presigner', () => ({
    getSignedUrl: vi.fn().mockResolvedValue('https://s3.amazonaws.com/presigned-url'),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeEvent(body: Record<string, unknown>): APIGatewayProxyEventV2 {
    return {
        version: '2.0', routeKey: 'POST /api/documents', rawPath: '/api/documents',
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
// Tests
// ---------------------------------------------------------------------------
describe('document-upload handler', () => {
    let handler: typeof import('./handler').handler;

    beforeEach(async () => {
        vi.clearAllMocks();
        process.env.INTELLIGENCE_TABLE = 'NineScrolls-Intelligence';
        process.env.DOCUMENTS_BUCKET = 'ninescrolls-order-documents';

        const mod = await import('./handler');
        handler = mod.handler;
    });

    describe('getUploadUrl', () => {
        it('returns presigned URL for valid request', async () => {
            const event = makeEvent({
                action: 'getUploadUrl',
                orderId: 'ord-20260310-x7k9',
                fileName: 'quotation.pdf',
                mimeType: 'application/pdf',
            });
            const result = await handler(event, {} as never, (() => {}) as never);
            const body = JSON.parse((result as { body: string }).body);

            expect((result as { statusCode: number }).statusCode).toBe(200);
            expect(body.success).toBe(true);
            expect(body.uploadUrl).toContain('presigned-url');
            expect(body.s3Key).toMatch(/^temp\//);
            expect(body.expiresAt).toBeDefined();
        });

        it('rejects unsupported mime type', async () => {
            const event = makeEvent({
                action: 'getUploadUrl',
                orderId: 'ord-20260310-x7k9',
                fileName: 'virus.exe',
                mimeType: 'application/x-msdownload',
            });
            const result = await handler(event, {} as never, (() => {}) as never);
            expect((result as { statusCode: number }).statusCode).toBe(400);
            const body = JSON.parse((result as { body: string }).body);
            expect(body.error).toContain('Unsupported file type');
        });

        it('returns 400 when orderId missing', async () => {
            const event = makeEvent({
                action: 'getUploadUrl',
                fileName: 'quotation.pdf',
                mimeType: 'application/pdf',
            });
            const result = await handler(event, {} as never, (() => {}) as never);
            expect((result as { statusCode: number }).statusCode).toBe(400);
        });

        it('sanitizes fileName', async () => {
            const event = makeEvent({
                action: 'getUploadUrl',
                orderId: 'ord-20260310-x7k9',
                fileName: '../../../etc/passwd',
                mimeType: 'text/plain',
            });
            const result = await handler(event, {} as never, (() => {}) as never);
            const body = JSON.parse((result as { body: string }).body);

            expect((result as { statusCode: number }).statusCode).toBe(200);
            // Path traversal characters should be sanitized
            expect(body.s3Key).not.toContain('..');
        });
    });

    describe('confirmUpload', () => {
        const VALID_CONFIRM = {
            action: 'confirmUpload',
            orderId: 'ord-20260310-x7k9',
            s3Key: 'temp/ord-20260310-x7k9/abc123_quotation.pdf',
            fileName: 'quotation.pdf',
            mimeType: 'application/pdf',
            fileSize: 1024000,
            stage: 'QUOTING',
            docType: 'QUOTATION',
            description: 'Initial quotation',
            uploadedBy: 'admin',
        };

        it('confirms upload and creates document record', async () => {
            const event = makeEvent(VALID_CONFIRM);
            const result = await handler(event, {} as never, (() => {}) as never);
            const body = JSON.parse((result as { body: string }).body);

            expect((result as { statusCode: number }).statusCode).toBe(200);
            expect(body.success).toBe(true);
            expect(body.document.docId).toMatch(/^doc-[a-f0-9]{6}$/);
            expect(body.document.stage).toBe('QUOTING');
            expect(body.document.docType).toBe('QUOTATION');
        });

        it('rejects invalid stage', async () => {
            const event = makeEvent({ ...VALID_CONFIRM, stage: 'INVALID_STAGE' });
            const result = await handler(event, {} as never, (() => {}) as never);
            expect((result as { statusCode: number }).statusCode).toBe(400);
        });

        it('rejects invalid docType', async () => {
            const event = makeEvent({ ...VALID_CONFIRM, docType: 'INVALID_TYPE' });
            const result = await handler(event, {} as never, (() => {}) as never);
            expect((result as { statusCode: number }).statusCode).toBe(400);
        });

        it('rejects file too large', async () => {
            const event = makeEvent({ ...VALID_CONFIRM, fileSize: 100 * 1024 * 1024 });
            const result = await handler(event, {} as never, (() => {}) as never);
            expect((result as { statusCode: number }).statusCode).toBe(400);
            const body = JSON.parse((result as { body: string }).body);
            expect(body.error).toContain('too large');
        });

        it('returns 400 when required fields missing', async () => {
            const { s3Key: _, ...missing } = VALID_CONFIRM;
            const event = makeEvent(missing);
            const result = await handler(event, {} as never, (() => {}) as never);
            expect((result as { statusCode: number }).statusCode).toBe(400);
        });

        it('handles S3 copy failure', async () => {
            mockS3Send.mockRejectedValueOnce(new Error('S3 copy failed'));
            const event = makeEvent(VALID_CONFIRM);
            const result = await handler(event, {} as never, (() => {}) as never);
            expect((result as { statusCode: number }).statusCode).toBe(500);
            const body = JSON.parse((result as { body: string }).body);
            expect(body.error).toContain('expired');
        });
    });

    describe('general', () => {
        it('returns 400 for invalid action', async () => {
            const event = makeEvent({ action: 'deleteAll' });
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

        it('returns 400 for empty body', async () => {
            const event = makeEvent({});
            event.body = undefined as unknown as string;
            event.requestContext.http.method = 'POST';
            const result = await handler(event, {} as never, (() => {}) as never);
            expect((result as { statusCode: number }).statusCode).toBe(400);
        });
    });
});
