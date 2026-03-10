import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — must be defined before handler import
// ---------------------------------------------------------------------------
const mockGet = vi.fn();
const mockPut = vi.fn();
const mockUpdate = vi.fn();
const mockQuery = vi.fn();
const mockDelete = vi.fn();
const mockScan = vi.fn();

const mockSend = vi.fn().mockImplementation((cmd: unknown) => {
    const name = (cmd as { constructor: { name: string } }).constructor.name;
    if (name === 'GetCommand') return mockGet();
    if (name === 'PutCommand') return mockPut();
    if (name === 'UpdateCommand') return mockUpdate();
    if (name === 'QueryCommand') return mockQuery();
    if (name === 'DeleteCommand') return mockDelete();
    if (name === 'ScanCommand') return mockScan();
    return Promise.resolve({});
});

vi.mock('@aws-sdk/client-dynamodb', () => ({
    DynamoDBClient: vi.fn().mockImplementation(() => ({})),
    ConditionalCheckFailedException: class extends Error { constructor() { super('ConditionalCheckFailedException'); this.name = 'ConditionalCheckFailedException'; } },
}));

vi.mock('@aws-sdk/lib-dynamodb', () => ({
    DynamoDBDocumentClient: { from: vi.fn().mockReturnValue({ send: mockSend }) },
    GetCommand: vi.fn().mockImplementation((p) => ({ ...p, constructor: { name: 'GetCommand' } })),
    PutCommand: vi.fn().mockImplementation((p) => ({ ...p, constructor: { name: 'PutCommand' } })),
    UpdateCommand: vi.fn().mockImplementation((p) => ({ ...p, constructor: { name: 'UpdateCommand' } })),
    QueryCommand: vi.fn().mockImplementation((p) => ({ ...p, constructor: { name: 'QueryCommand' } })),
    DeleteCommand: vi.fn().mockImplementation((p) => ({ ...p, constructor: { name: 'DeleteCommand' } })),
    ScanCommand: vi.fn().mockImplementation((p) => ({ ...p, constructor: { name: 'ScanCommand' } })),
}));

const mockS3Send = vi.fn().mockResolvedValue({});
vi.mock('@aws-sdk/client-s3', () => ({
    S3Client: vi.fn().mockImplementation(() => ({ send: mockS3Send })),
    PutObjectCommand: vi.fn(),
    CopyObjectCommand: vi.fn(),
    DeleteObjectCommand: vi.fn(),
    GetObjectCommand: vi.fn(),
}));

vi.mock('@aws-sdk/s3-request-presigner', () => ({
    getSignedUrl: vi.fn().mockResolvedValue('https://s3.example.com/presigned'),
}));

const mockFetch = vi.fn().mockResolvedValue({ ok: true });
global.fetch = mockFetch;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeAppSyncEvent(fieldName: string, args: Record<string, unknown> = {}, parentType = 'Query') {
    return {
        info: { fieldName, parentTypeName: parentType },
        arguments: args,
        identity: { sub: 'user-123', claims: { email: 'admin@ninescrolls.com' } },
    };
}

const SAMPLE_ORDER = {
    PK: 'ORDER#ord-20260310-abcd',
    SK: 'META',
    orderId: 'ord-20260310-abcd',
    status: 'INQUIRY',
    institution: 'Stanford University',
    department: 'MSE',
    productModel: 'TL-ICP-300',
    productName: 'ICP System',
    configuration: '8-inch chamber',
    quoteNumber: 'Q-2026-001',
    quoteAmount: 150000,
    notes: '',
    matchedOrgId: 'org-stanford',
    source: 'MANUAL',
    createdAt: '2026-03-10T12:00:00Z',
    updatedAt: '2026-03-10T12:00:00Z',
    createdBy: 'admin@ninescrolls.com',
    feedbackScheduleCreated: false,
    GSI1PK: 'ORDER_STATUS#INQUIRY',
    GSI1SK: '2026-03-10T12:00:00Z#ord-20260310-abcd',
};

const SAMPLE_CONTACT = {
    PK: 'ORDER#ord-20260310-abcd',
    SK: 'CONTACT#ct-abc123',
    contactId: 'ct-abc123',
    contactName: 'Dr. Jane Smith',
    contactEmail: 'jane@stanford.edu',
    contactPhone: '+1-650-555-1234',
    role: 'PI',
    department: 'MSE',
    isPrimary: true,
    feedbackInvite: true,
    notes: '',
};

const SAMPLE_RFQ = {
    PK: 'RFQ#rfq-20260310-abc123',
    SK: 'META',
    rfqId: 'rfq-20260310-abc123',
    referenceNumber: 'RFQ-20260310-ABC1',
    status: 'pending',
    name: 'Dr. Jane Smith',
    email: 'jane@stanford.edu',
    institution: 'Stanford University',
    department: 'MSE',
    role: 'PI',
    equipmentCategory: 'ICP',
    specificModel: 'TL-ICP-300',
    submittedAt: '2026-03-10T12:00:00Z',
    matchedOrgId: 'org-stanford',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('order-api handler', () => {
    let handler: typeof import('./handler').handler;

    beforeEach(async () => {
        vi.clearAllMocks();
        process.env.INTELLIGENCE_TABLE = 'NineScrolls-Intelligence';
        process.env.DOCUMENTS_BUCKET = 'ninescrolls-order-documents';
        process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';

        const mod = await import('./handler');
        handler = mod.handler;
    });

    // -----------------------------------------------------------------------
    // Router
    // -----------------------------------------------------------------------
    describe('router', () => {
        it('throws for unknown fieldName', async () => {
            await expect(handler(makeAppSyncEvent('nonExistentField'), {} as any, vi.fn()))
                .rejects.toThrow('No resolver for field: nonExistentField');
        });
    });

    // -----------------------------------------------------------------------
    // getOrder
    // -----------------------------------------------------------------------
    describe('getOrder', () => {
        it('returns order with contacts', async () => {
            mockGet.mockResolvedValueOnce({ Item: SAMPLE_ORDER });
            mockQuery.mockResolvedValueOnce({ Items: [SAMPLE_CONTACT] });

            const result = await handler(
                makeAppSyncEvent('getOrder', { orderId: 'ord-20260310-abcd' }),
                {} as any,
                vi.fn(),
            );

            expect(result).toBeDefined();
            expect(result.orderId).toBe('ord-20260310-abcd');
            expect(result.status).toBe('INQUIRY');
            expect(result.institution).toBe('Stanford University');
            expect(result.contacts).toHaveLength(1);
            expect(result.contacts[0].contactName).toBe('Dr. Jane Smith');
        });

        it('throws when order not found', async () => {
            mockGet.mockResolvedValueOnce({ Item: undefined });

            await expect(handler(
                makeAppSyncEvent('getOrder', { orderId: 'nonexistent' }),
                {} as any,
                vi.fn(),
            )).rejects.toThrow('Order not found');
        });
    });

    // -----------------------------------------------------------------------
    // listOrders
    // -----------------------------------------------------------------------
    describe('listOrders', () => {
        it('queries GSI1 when status is provided', async () => {
            mockQuery
                .mockResolvedValueOnce({ Items: [SAMPLE_ORDER] })     // GSI1 query
                .mockResolvedValueOnce({ Items: [SAMPLE_CONTACT] });  // contacts

            const result = await handler(
                makeAppSyncEvent('listOrders', { status: 'INQUIRY', limit: 10 }),
                {} as any,
                vi.fn(),
            );

            expect(result.items).toHaveLength(1);
            expect(result.items[0].orderId).toBe('ord-20260310-abcd');
            expect(result.nextToken).toBeNull();
        });

        it('scans when no status filter', async () => {
            mockScan.mockResolvedValueOnce({ Items: [SAMPLE_ORDER] });
            mockQuery.mockResolvedValueOnce({ Items: [SAMPLE_CONTACT] });

            const result = await handler(
                makeAppSyncEvent('listOrders', {}),
                {} as any,
                vi.fn(),
            );

            expect(result.items).toHaveLength(1);
        });
    });

    // -----------------------------------------------------------------------
    // getOrderLogs
    // -----------------------------------------------------------------------
    describe('getOrderLogs', () => {
        it('returns logs sorted by timestamp desc', async () => {
            mockQuery.mockResolvedValueOnce({
                Items: [
                    { action: 'STATUS_CHANGE', fromStatus: 'INQUIRY', toStatus: 'QUOTING', operator: 'admin', timestamp: '2026-03-11T10:00:00Z' },
                    { action: 'ORDER_CREATED', toStatus: 'INQUIRY', operator: 'admin', timestamp: '2026-03-10T12:00:00Z' },
                ],
            });

            const result = await handler(
                makeAppSyncEvent('getOrderLogs', { orderId: 'ord-20260310-abcd' }),
                {} as any,
                vi.fn(),
            );

            expect(result).toHaveLength(2);
            expect(result[0].action).toBe('STATUS_CHANGE');
        });
    });

    // -----------------------------------------------------------------------
    // orderStats
    // -----------------------------------------------------------------------
    describe('orderStats', () => {
        it('aggregates counts by status', async () => {
            // Mock COUNT queries for each status (9 statuses)
            for (let i = 0; i < 9; i++) {
                mockQuery.mockResolvedValueOnce({ Count: i === 0 ? 3 : 0 });
            }
            // INSTALLED orders for avgDaysToInstall
            mockQuery.mockResolvedValueOnce({ Items: [] });
            // Active status queries for delivery dates (3 statuses)
            mockQuery.mockResolvedValueOnce({ Items: [] });
            mockQuery.mockResolvedValueOnce({ Items: [] });
            mockQuery.mockResolvedValueOnce({ Items: [] });

            const result = await handler(
                makeAppSyncEvent('orderStats'),
                {} as any,
                vi.fn(),
            );

            expect(result.totalActive).toBe(3);
            expect(JSON.parse(result.byStatus).INQUIRY).toBe(3);
        });
    });

    // -----------------------------------------------------------------------
    // createOrder
    // -----------------------------------------------------------------------
    describe('createOrder', () => {
        it('creates order with primary contact', async () => {
            mockPut.mockResolvedValue({});
            // For buildFullOrderResponse
            mockGet.mockResolvedValueOnce({
                Item: { ...SAMPLE_ORDER, source: 'MANUAL' },
            });
            mockQuery.mockResolvedValueOnce({ Items: [SAMPLE_CONTACT] });

            const result = await handler(
                makeAppSyncEvent('createOrder', {
                    input: JSON.stringify({
                        institution: 'Stanford University',
                        productModel: 'TL-ICP-300',
                        primaryContact: {
                            contactName: 'Dr. Jane Smith',
                            contactEmail: 'jane@stanford.edu',
                            role: 'PI',
                        },
                    }),
                }, 'Mutation'),
                {} as any,
                vi.fn(),
            );

            expect(result).toBeDefined();
            expect(mockPut).toHaveBeenCalledTimes(3); // ORDER + CONTACT + LOG
        });

        it('throws when required fields missing', async () => {
            await expect(handler(
                makeAppSyncEvent('createOrder', { input: JSON.stringify({}) }, 'Mutation'),
                {} as any,
                vi.fn(),
            )).rejects.toThrow('institution, productModel, and primaryContact are required');
        });
    });

    // -----------------------------------------------------------------------
    // updateOrderStatus
    // -----------------------------------------------------------------------
    describe('updateOrderStatus', () => {
        it('transitions INQUIRY -> QUOTING', async () => {
            // fetchOrder
            mockGet.mockResolvedValueOnce({ Item: SAMPLE_ORDER });
            // Update + LOG
            mockUpdate.mockResolvedValue({});
            mockPut.mockResolvedValue({});
            // buildFullOrderResponse
            mockGet.mockResolvedValueOnce({ Item: { ...SAMPLE_ORDER, status: 'QUOTING' } });
            mockQuery.mockResolvedValueOnce({ Items: [SAMPLE_CONTACT] });

            const result = await handler(
                makeAppSyncEvent('updateOrderStatus', {
                    orderId: 'ord-20260310-abcd',
                    newStatus: 'QUOTING',
                }, 'Mutation'),
                {} as any,
                vi.fn(),
            );

            expect(result).toBeDefined();
            expect(mockUpdate).toHaveBeenCalled();
        });

        it('throws on invalid transition', async () => {
            mockGet.mockResolvedValueOnce({ Item: SAMPLE_ORDER });

            await expect(handler(
                makeAppSyncEvent('updateOrderStatus', {
                    orderId: 'ord-20260310-abcd',
                    newStatus: 'SHIPPED',
                }, 'Mutation'),
                {} as any,
                vi.fn(),
            )).rejects.toThrow('Invalid status transition');
        });

        it('throws when order not found', async () => {
            mockGet.mockResolvedValueOnce({ Item: undefined });

            await expect(handler(
                makeAppSyncEvent('updateOrderStatus', {
                    orderId: 'nonexistent',
                    newStatus: 'QUOTING',
                }, 'Mutation'),
                {} as any,
                vi.fn(),
            )).rejects.toThrow('Order not found');
        });
    });

    // -----------------------------------------------------------------------
    // addContact
    // -----------------------------------------------------------------------
    describe('addContact', () => {
        it('adds a contact to an order', async () => {
            mockGet.mockResolvedValueOnce({ Item: SAMPLE_ORDER });
            mockPut.mockResolvedValue({});

            const result = await handler(
                makeAppSyncEvent('addContact', {
                    orderId: 'ord-20260310-abcd',
                    input: JSON.stringify({
                        contactName: 'John Doe',
                        contactEmail: 'john@stanford.edu',
                        role: 'RESEARCHER',
                    }),
                }, 'Mutation'),
                {} as any,
                vi.fn(),
            );

            expect(result.contactName).toBe('John Doe');
            expect(result.role).toBe('RESEARCHER');
            expect(mockPut).toHaveBeenCalledTimes(2); // CONTACT + LOG
        });
    });

    // -----------------------------------------------------------------------
    // removeContact
    // -----------------------------------------------------------------------
    describe('removeContact', () => {
        it('removes a contact', async () => {
            mockGet.mockResolvedValueOnce({ Item: SAMPLE_CONTACT });
            mockDelete.mockResolvedValue({});
            mockPut.mockResolvedValue({});

            const result = await handler(
                makeAppSyncEvent('removeContact', {
                    orderId: 'ord-20260310-abcd',
                    contactId: 'ct-abc123',
                }, 'Mutation'),
                {} as any,
                vi.fn(),
            );

            expect(result).toBe(true);
        });

        it('throws when contact not found', async () => {
            mockGet.mockResolvedValueOnce({ Item: undefined });

            await expect(handler(
                makeAppSyncEvent('removeContact', {
                    orderId: 'ord-20260310-abcd',
                    contactId: 'nonexistent',
                }, 'Mutation'),
                {} as any,
                vi.fn(),
            )).rejects.toThrow('Contact not found');
        });
    });

    // -----------------------------------------------------------------------
    // declineInquiry
    // -----------------------------------------------------------------------
    describe('declineInquiry', () => {
        it('declines an inquiry order', async () => {
            mockGet.mockResolvedValueOnce({ Item: SAMPLE_ORDER });
            mockUpdate.mockResolvedValue({});
            mockPut.mockResolvedValue({});
            // buildFullOrderResponse
            mockGet.mockResolvedValueOnce({ Item: { ...SAMPLE_ORDER, status: 'DECLINED' } });
            mockQuery.mockResolvedValueOnce({ Items: [] });

            const result = await handler(
                makeAppSyncEvent('declineInquiry', {
                    orderId: 'ord-20260310-abcd',
                    reason: 'Equipment not in our product line',
                }, 'Mutation'),
                {} as any,
                vi.fn(),
            );

            expect(result).toBeDefined();
        });

        it('throws when order is not INQUIRY', async () => {
            mockGet.mockResolvedValueOnce({ Item: { ...SAMPLE_ORDER, status: 'QUOTING' } });

            await expect(handler(
                makeAppSyncEvent('declineInquiry', {
                    orderId: 'ord-20260310-abcd',
                    reason: 'Test',
                }, 'Mutation'),
                {} as any,
                vi.fn(),
            )).rejects.toThrow('Only INQUIRY orders can be declined');
        });
    });

    // -----------------------------------------------------------------------
    // listRfqs
    // -----------------------------------------------------------------------
    describe('listRfqs', () => {
        it('lists pending RFQs', async () => {
            mockQuery.mockResolvedValueOnce({ Items: [SAMPLE_RFQ] });

            const result = await handler(
                makeAppSyncEvent('listRfqs', { status: 'pending' }),
                {} as any,
                vi.fn(),
            );

            expect(result.items).toHaveLength(1);
            expect(result.items[0].rfqId).toBe('rfq-20260310-abc123');
        });
    });

    // -----------------------------------------------------------------------
    // getRfq
    // -----------------------------------------------------------------------
    describe('getRfq', () => {
        it('returns an RFQ', async () => {
            mockGet.mockResolvedValueOnce({ Item: SAMPLE_RFQ });

            const result = await handler(
                makeAppSyncEvent('getRfq', { rfqId: 'rfq-20260310-abc123' }),
                {} as any,
                vi.fn(),
            );

            expect(result.rfqId).toBe('rfq-20260310-abc123');
            expect(result.institution).toBe('Stanford University');
        });

        it('throws when RFQ not found', async () => {
            mockGet.mockResolvedValueOnce({ Item: undefined });

            await expect(handler(
                makeAppSyncEvent('getRfq', { rfqId: 'nonexistent' }),
                {} as any,
                vi.fn(),
            )).rejects.toThrow('RFQ not found');
        });
    });

    // -----------------------------------------------------------------------
    // declineRfq
    // -----------------------------------------------------------------------
    describe('declineRfq', () => {
        it('declines a pending RFQ', async () => {
            mockGet.mockResolvedValueOnce({ Item: SAMPLE_RFQ });
            mockUpdate.mockResolvedValue({});

            const result = await handler(
                makeAppSyncEvent('declineRfq', {
                    rfqId: 'rfq-20260310-abc123',
                    reason: 'Not in product line',
                }, 'Mutation'),
                {} as any,
                vi.fn(),
            );

            expect(result.status).toBe('declined');
        });

        it('throws when RFQ already converted', async () => {
            mockGet.mockResolvedValueOnce({ Item: { ...SAMPLE_RFQ, status: 'converted' } });

            await expect(handler(
                makeAppSyncEvent('declineRfq', { rfqId: 'rfq-20260310-abc123' }, 'Mutation'),
                {} as any,
                vi.fn(),
            )).rejects.toThrow('RFQ is already converted');
        });
    });

    // -----------------------------------------------------------------------
    // convertRfqToOrder
    // -----------------------------------------------------------------------
    describe('convertRfqToOrder', () => {
        it('converts a pending RFQ to an order', async () => {
            mockGet.mockResolvedValueOnce({ Item: SAMPLE_RFQ });
            mockPut.mockResolvedValue({});
            mockUpdate.mockResolvedValue({});
            // buildFullOrderResponse
            mockGet.mockResolvedValueOnce({
                Item: { ...SAMPLE_ORDER, source: 'RFQ_WEBSITE', rfqId: 'rfq-20260310-abc123' },
            });
            mockQuery.mockResolvedValueOnce({ Items: [SAMPLE_CONTACT] });

            const result = await handler(
                makeAppSyncEvent('convertRfqToOrder', {
                    rfqId: 'rfq-20260310-abc123',
                }, 'Mutation'),
                {} as any,
                vi.fn(),
            );

            expect(result).toBeDefined();
            expect(result.source).toBe('RFQ_WEBSITE');
        });

        it('throws when RFQ not pending', async () => {
            mockGet.mockResolvedValueOnce({ Item: { ...SAMPLE_RFQ, status: 'converted' } });

            await expect(handler(
                makeAppSyncEvent('convertRfqToOrder', { rfqId: 'rfq-20260310-abc123' }, 'Mutation'),
                {} as any,
                vi.fn(),
            )).rejects.toThrow('RFQ is already converted');
        });
    });

    // -----------------------------------------------------------------------
    // getDocumentUploadUrl
    // -----------------------------------------------------------------------
    describe('getDocumentUploadUrl', () => {
        it('returns presigned URL', async () => {
            const result = await handler(
                makeAppSyncEvent('getDocumentUploadUrl', {
                    orderId: 'ord-20260310-abcd',
                    fileName: 'spec.pdf',
                    mimeType: 'application/pdf',
                }),
                {} as any,
                vi.fn(),
            );

            expect(result.uploadUrl).toBe('https://s3.example.com/presigned');
            expect(result.s3Key).toContain('temp/ord-20260310-abcd/');
            expect(result.expiresAt).toBeDefined();
        });

        it('throws for unsupported mime type', async () => {
            await expect(handler(
                makeAppSyncEvent('getDocumentUploadUrl', {
                    orderId: 'ord-20260310-abcd',
                    fileName: 'virus.exe',
                    mimeType: 'application/x-executable',
                }),
                {} as any,
                vi.fn(),
            )).rejects.toThrow('Unsupported file type');
        });
    });

    // -----------------------------------------------------------------------
    // deleteDocument
    // -----------------------------------------------------------------------
    describe('deleteDocument', () => {
        it('deletes a document', async () => {
            mockQuery.mockResolvedValueOnce({
                Items: [{
                    PK: 'ORDER#ord-20260310-abcd',
                    SK: 'DOC#INQUIRY#doc-abc123',
                    docId: 'doc-abc123',
                    fileName: 'spec.pdf',
                    s3Key: 'orders/ord-20260310-abcd/INQUIRY/doc-abc123_spec.pdf',
                    stage: 'INQUIRY',
                    docType: 'REQUIREMENTS',
                }],
            });
            mockDelete.mockResolvedValue({});
            mockPut.mockResolvedValue({});

            const result = await handler(
                makeAppSyncEvent('deleteDocument', {
                    orderId: 'ord-20260310-abcd',
                    docId: 'doc-abc123',
                }, 'Mutation'),
                {} as any,
                vi.fn(),
            );

            expect(result).toBe(true);
        });
    });
});
