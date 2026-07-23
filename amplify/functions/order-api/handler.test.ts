import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — must be defined before handler import
// ---------------------------------------------------------------------------
const mockGet = vi.fn();
const mockPut = vi.fn();
const mockUpdate = vi.fn();
const mockQuery = vi.fn();
const mockDelete = vi.fn();
const mockScan = vi.fn();
const mockTransact = vi.fn();

const mockSend = vi.fn().mockImplementation((cmd: unknown) => {
    const name = (cmd as { constructor: { name: string } }).constructor.name;
    if (name === 'GetCommand') return mockGet(cmd);
    if (name === 'PutCommand') return mockPut();
    if (name === 'UpdateCommand') return mockUpdate();
    if (name === 'QueryCommand') return mockQuery(cmd);
    if (name === 'DeleteCommand') return mockDelete();
    if (name === 'ScanCommand') return mockScan();
    if (name === 'TransactWriteCommand') return mockTransact(cmd);
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
    TransactWriteCommand: vi.fn().mockImplementation((p) => ({ ...p, constructor: { name: 'TransactWriteCommand' } })),
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

// Org-api + CRM emit mocks (createOrder org upsert + order_created emit — Plan 2A)
const mockInvokeOrgApi = vi.fn().mockResolvedValue({ matchedOrgId: null });
vi.mock('../../lib/organization/invoke-org-api', () => ({
    invokeOrganizationApi: (payload: unknown) => mockInvokeOrgApi(payload),
}));

// CRM timeline emit (fire-and-forget; helper swallows its own dispatch failures)
const mockEmitTimelineEventToCrm = vi.fn().mockResolvedValue(undefined);
const mockInvokeCrmAction = vi.fn().mockResolvedValue(undefined);
vi.mock('../../lib/crm/invoke-crm-api', () => ({
    emitTimelineEventToCrm: (...args: unknown[]) => mockEmitTimelineEventToCrm(...args),
    invokeCrmAction: (...args: unknown[]) => mockInvokeCrmAction(...args),
}));

// VISITOR# identity bridge (createStripeOrder links paid orders to first-party visitors)
const mockUpsertVisitorBridge = vi.fn().mockResolvedValue({ created: false, orgUpgraded: false });
vi.mock('../../lib/crm/visitor-bridge', () => ({
    toSend: (dc: unknown) => dc,
    upsertVisitorBridge: (...args: unknown[]) => mockUpsertVisitorBridge(...args),
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
        // routeOrders sets a persistent mockImplementation; beforeEach only clears
        // call history, so reset query/scan mocks between tests.
        afterEach(() => {
            mockQuery.mockReset();
            mockScan.mockReset();
        });

        type Row = Record<string, unknown> & { GSI1SK: string; orderId: string };

        function makeOrder(status: string, orderId: string, createdAt: string, extra: Record<string, unknown> = {}): Row {
            return {
                ...SAMPLE_ORDER,
                PK: `ORDER#${orderId}`,
                SK: 'META',
                orderId,
                status,
                createdAt,
                updatedAt: createdAt,
                GSI1PK: `ORDER_STATUS#${status}`,
                GSI1SK: `${createdAt}#${orderId}`,
                ...extra,
            } as Row;
        }

        // Minimal GSI1 emulator: honors ScanIndexForward:false (GSI1SK desc),
        // GSI1SK < :w, ExclusiveStartKey, and Limit/pageSize truncation with a
        // LastEvaluatedKey. Contact queries (PK ORDER#…) return empty. This lets
        // the composite-cursor pagination be exercised end-to-end against a store
        // that actually responds to the `< watermark` boundary.
        function routeOrders(
            partitions: Record<string, Row[] | Error>,
            opts: { pageSize?: number } = {},
        ) {
            mockQuery.mockImplementation((cmd: {
                ExpressionAttributeValues?: Record<string, string>;
                ExclusiveStartKey?: { GSI1SK?: string };
                Limit?: number;
            }) => {
                const values = cmd.ExpressionAttributeValues ?? {};
                const pk = String(values[':pk'] ?? '');
                if (pk.startsWith('ORDER#')) return Promise.resolve({ Items: [] }); // contacts
                if (!pk.startsWith('ORDER_STATUS#')) return Promise.resolve({ Items: [] });
                const st = pk.replace('ORDER_STATUS#', '');
                const rows = partitions[st];
                if (rows instanceof Error) return Promise.reject(rows);
                let arr = (rows ?? []).slice().sort((a, b) => (a.GSI1SK < b.GSI1SK ? 1 : a.GSI1SK > b.GSI1SK ? -1 : 0));
                const w = values[':w'];
                if (w) arr = arr.filter((o) => o.GSI1SK < w);
                if (cmd.ExclusiveStartKey?.GSI1SK) {
                    const idx = arr.findIndex((o) => o.GSI1SK === cmd.ExclusiveStartKey!.GSI1SK);
                    arr = idx >= 0 ? arr.slice(idx + 1) : arr;
                }
                const pageSize = cmd.Limit ?? opts.pageSize ?? Infinity;
                const page = arr.slice(0, pageSize);
                const more = arr.length > pageSize;
                return Promise.resolve({
                    Items: page,
                    ...(more ? { LastEvaluatedKey: { GSI1PK: pk, GSI1SK: page[page.length - 1].GSI1SK, PK: page[page.length - 1].PK as string, SK: 'META' } } : {}),
                });
            });
        }

        const statusPartitionQueries = () => mockQuery.mock.calls
            .map((c: [{ ExpressionAttributeValues?: Record<string, string>; ScanIndexForward?: boolean; Limit?: number; KeyConditionExpression?: string; ExclusiveStartKey?: unknown }]) => c[0])
            .filter((q) => String(q.ExpressionAttributeValues?.[':pk'] ?? '').startsWith('ORDER_STATUS#'));

        // --- typed (status) path: unchanged -----------------------------------
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

        it('search combined with status filters within the GSI1 bucket', async () => {
            mockQuery
                .mockResolvedValueOnce({
                    Items: [
                        { ...SAMPLE_ORDER, orderId: 'ord-1', poNumber: 'PO-2026-GH-001' },
                        { ...SAMPLE_ORDER, orderId: 'ord-2', poNumber: 'PO-2026-OTHER' },
                    ],
                }) // GSI1 query
                .mockResolvedValueOnce({ Items: [] }); // contacts

            const result = await handler(
                makeAppSyncEvent('listOrders', { status: 'PO_RECEIVED', search: 'GH-001' }),
                {} as any,
                vi.fn(),
            );

            expect(result.items).toHaveLength(1);
            expect(result.items[0].orderId).toBe('ord-1');
        });

        // --- unfiltered path: merge status partitions, never scan -------------
        it('queries every status partition on GSI1 and never scans (unfiltered)', async () => {
            routeOrders({
                INQUIRY: [makeOrder('INQUIRY', 'o-inq', '2026-07-01T00:00:00Z')],
                SHIPPED: [makeOrder('SHIPPED', 'o-shp', '2026-07-02T00:00:00Z')],
            });

            const result = await handler(makeAppSyncEvent('listOrders', { limit: 50 }), {} as any, vi.fn());

            expect(mockScan).not.toHaveBeenCalled();
            const pks = statusPartitionQueries().map((q) => q.ExpressionAttributeValues?.[':pk']);
            expect(new Set(pks)).toEqual(new Set([
                'ORDER_STATUS#INQUIRY', 'ORDER_STATUS#QUOTING', 'ORDER_STATUS#QUOTE_SENT',
                'ORDER_STATUS#PO_RECEIVED', 'ORDER_STATUS#IN_PRODUCTION', 'ORDER_STATUS#SHIPPED',
                'ORDER_STATUS#INSTALLED', 'ORDER_STATUS#CLOSED', 'ORDER_STATUS#DECLINED',
            ]));
            statusPartitionQueries().forEach((q) => {
                expect(q.ScanIndexForward).toBe(false);
                expect(q.Limit).toBe(50);
            });
            expect(result.items).toHaveLength(2);
        });

        it('merges and orders by createdAt/GSI1SK descending across statuses', async () => {
            routeOrders({
                INQUIRY: [makeOrder('INQUIRY', 'o-old', '2026-07-01T00:00:00Z')],
                SHIPPED: [makeOrder('SHIPPED', 'o-new', '2026-07-09T00:00:00Z')],
                CLOSED: [makeOrder('CLOSED', 'o-mid', '2026-07-05T00:00:00Z')],
            });

            const result = await handler(makeAppSyncEvent('listOrders', {}), {} as any, vi.fn());

            expect(result.items.map((o: { orderId: string }) => o.orderId)).toEqual(['o-new', 'o-mid', 'o-old']);
        });

        it('throws when any status partition fails in the paginated unfiltered list', async () => {
            routeOrders({
                INQUIRY: new Error('DDB throttled'),
                SHIPPED: [makeOrder('SHIPPED', 'o-new', '2026-07-09T00:00:00Z')],
                CLOSED: [makeOrder('CLOSED', 'o-mid', '2026-07-05T00:00:00Z')],
            });

            await expect(handler(makeAppSyncEvent('listOrders', {}), {} as any, vi.fn()))
                .rejects.toThrow(/order status partition query failed/i);
        });

        it('throws when every status partition fails', async () => {
            const partitions: Record<string, Row[] | Error> = {};
            ['INQUIRY', 'QUOTING', 'QUOTE_SENT', 'PO_RECEIVED', 'IN_PRODUCTION', 'SHIPPED', 'INSTALLED', 'CLOSED', 'DECLINED']
                .forEach((s) => { partitions[s] = new Error('fail'); });
            routeOrders(partitions);

            await expect(handler(makeAppSyncEvent('listOrders', {}), {} as any, vi.fn()))
                .rejects.toThrow(/order status partition query failed/i);
        });

        it('paginates via a composite watermark cursor without skipping overflow rows', async () => {
            // Global createdAt order: o5 > o4 > o3 > o2 > o1. INQUIRY holds o5,o3,o1;
            // SHIPPED holds o4,o2. With limit 2, o3 is fetched on page 1 (INQUIRY
            // returns o5,o3) but not returned — it must resurface on page 2, not vanish.
            routeOrders({
                INQUIRY: [
                    makeOrder('INQUIRY', 'o5', '2026-07-05T00:00:00Z'),
                    makeOrder('INQUIRY', 'o3', '2026-07-03T00:00:00Z'),
                    makeOrder('INQUIRY', 'o1', '2026-07-01T00:00:00Z'),
                ],
                SHIPPED: [
                    makeOrder('SHIPPED', 'o4', '2026-07-04T00:00:00Z'),
                    makeOrder('SHIPPED', 'o2', '2026-07-02T00:00:00Z'),
                ],
            });

            const page1 = await handler(makeAppSyncEvent('listOrders', { limit: 2 }), {} as any, vi.fn());
            expect(page1.items.map((o: { orderId: string }) => o.orderId)).toEqual(['o5', 'o4']);
            expect(page1.nextToken).not.toBeNull();

            mockQuery.mockClear();
            const page2 = await handler(makeAppSyncEvent('listOrders', { limit: 2, nextToken: page1.nextToken }), {} as any, vi.fn());
            // page 2 resumes every partition below the watermark (o4's GSI1SK).
            statusPartitionQueries().forEach((q) => {
                expect(q.KeyConditionExpression).toContain('GSI1SK < :w');
                expect(q.ExpressionAttributeValues?.[':w']).toBe('2026-07-04T00:00:00Z#o4');
            });
            expect(page2.items.map((o: { orderId: string }) => o.orderId)).toEqual(['o3', 'o2']);
            expect(page2.nextToken).not.toBeNull();

            mockQuery.mockClear();
            const page3 = await handler(makeAppSyncEvent('listOrders', { limit: 2, nextToken: page2.nextToken }), {} as any, vi.fn());
            expect(page3.items.map((o: { orderId: string }) => o.orderId)).toEqual(['o1']);
            expect(page3.nextToken).toBeNull();
        });

        it('returns nextToken null when the unfiltered result fits in one page', async () => {
            routeOrders({
                INQUIRY: [makeOrder('INQUIRY', 'o-a', '2026-07-01T00:00:00Z')],
                SHIPPED: [makeOrder('SHIPPED', 'o-b', '2026-07-02T00:00:00Z')],
            });

            const result = await handler(makeAppSyncEvent('listOrders', { limit: 50 }), {} as any, vi.fn());

            expect(result.items).toHaveLength(2);
            expect(result.nextToken).toBeNull();
        });

        // --- unfiltered search: exhaust partitions (B1) ----------------------
        it('finds an older matching order outside the newest window (unfiltered search)', async () => {
            routeOrders({
                INQUIRY: [
                    makeOrder('INQUIRY', 'n3', '2026-07-09T00:00:00Z', { quoteNumber: 'Q-NOPE-3' }),
                    makeOrder('INQUIRY', 'n2', '2026-07-08T00:00:00Z', { quoteNumber: 'Q-NOPE-2' }),
                    makeOrder('INQUIRY', 'n1', '2026-01-01T00:00:00Z', { quoteNumber: 'Q-FINDME-1' }),
                ],
            });

            const result = await handler(
                makeAppSyncEvent('listOrders', { search: 'FINDME', limit: 1 }),
                {} as any,
                vi.fn(),
            );

            expect(mockScan).not.toHaveBeenCalled();
            expect(result.items).toHaveLength(1);
            expect(result.items[0].orderId).toBe('n1');
            expect(result.nextToken).toBeNull();
            // search must not cap partitions to a bounded newest-N Limit
            statusPartitionQueries().forEach((q) => expect(q.Limit).toBeUndefined());
        });

        it('follows LastEvaluatedKey across pages when searching a partition', async () => {
            routeOrders({
                INQUIRY: [
                    makeOrder('INQUIRY', 'a', '2026-07-09T00:00:00Z', { quoteNumber: 'Q-NOPE' }),
                    makeOrder('INQUIRY', 'b', '2026-07-08T00:00:00Z', { quoteNumber: 'Q-MATCH-B' }),
                    makeOrder('INQUIRY', 'c', '2026-07-07T00:00:00Z', { quoteNumber: 'Q-MATCH-C' }),
                ],
            }, { pageSize: 2 });

            const result = await handler(
                makeAppSyncEvent('listOrders', { search: 'MATCH', limit: 50 }),
                {} as any,
                vi.fn(),
            );

            expect(result.items.map((o: { orderId: string }) => o.orderId)).toEqual(['b', 'c']);
            const inqCalls = statusPartitionQueries().filter((q) => q.ExpressionAttributeValues?.[':pk'] === 'ORDER_STATUS#INQUIRY');
            expect(inqCalls.length).toBeGreaterThanOrEqual(2);
            expect(inqCalls.some((q) => q.ExclusiveStartKey)).toBe(true);
        });

        it('continues unfiltered search past twenty DynamoDB pages', async () => {
            routeOrders({
                INQUIRY: Array.from({ length: 21 }, (_, i) => makeOrder(
                    'INQUIRY',
                    `search-page-${String(i + 1).padStart(2, '0')}`,
                    `2026-07-${String(31 - i).padStart(2, '0')}T00:00:00Z`,
                    { quoteNumber: i === 20 ? 'Q-DEEP-MATCH' : `Q-NOPE-${i}` },
                )),
            }, { pageSize: 1 });

            const result = await handler(
                makeAppSyncEvent('listOrders', { search: 'DEEP-MATCH', limit: 10 }),
                {} as any,
                vi.fn(),
            );

            expect(result.items.map((o: { orderId: string }) => o.orderId)).toEqual(['search-page-21']);
            const inqCalls = statusPartitionQueries().filter((q) => q.ExpressionAttributeValues?.[':pk'] === 'ORDER_STATUS#INQUIRY');
            expect(inqCalls).toHaveLength(21);
        });

        it('throws when any status partition fails during unfiltered search', async () => {
            routeOrders({
                INQUIRY: new Error('DDB throttled'),
                SHIPPED: [makeOrder('SHIPPED', 'o-new', '2026-07-09T00:00:00Z', { quoteNumber: 'Q-MATCH' })],
            });

            await expect(handler(
                makeAppSyncEvent('listOrders', { search: 'MATCH', limit: 10 }),
                {} as any,
                vi.fn(),
            )).rejects.toThrow(/order status partition search query failed/i);
        });

        it('returns empty with null token when unfiltered search matches nothing', async () => {
            routeOrders({
                INQUIRY: [makeOrder('INQUIRY', 'o-1', '2026-07-01T00:00:00Z', { quoteNumber: 'Q-1' })],
            });

            const result = await handler(
                makeAppSyncEvent('listOrders', { search: 'nomatch' }),
                {} as any,
                vi.fn(),
            );

            expect(result.items).toHaveLength(0);
            expect(result.nextToken).toBeNull();
        });
    });

    // -----------------------------------------------------------------------
    // listLeads — unfiltered path must merge GSI1 type partitions, never scan
    // -----------------------------------------------------------------------
    describe('listLeads', () => {
        // Restore query/scan mocks after each test: these tests set a persistent
        // mockImplementation, and beforeEach only clears call history (not impls).
        afterEach(() => {
            mockQuery.mockReset();
            mockScan.mockReset();
        });

        function makeLead(type: string, leadId: string, submittedAt: string) {
            return {
                PK: `LEAD#${leadId}`,
                SK: 'META',
                GSI1PK: `LEAD_TYPE#${type}`,
                GSI1SK: `${submittedAt}#${leadId}`,
                leadId,
                type,
                email: `${leadId}@example.com`,
                submittedAt,
            };
        }

        // Route each parallel GSI1 partition query to its type's rows (or error) by :pk.
        function routeByType(rowsByType: Record<string, Record<string, unknown>[] | Error>) {
            mockQuery.mockImplementation((cmd: { ExpressionAttributeValues?: Record<string, string> }) => {
                const pk = cmd.ExpressionAttributeValues?.[':pk'] ?? '';
                const type = pk.replace('LEAD_TYPE#', '');
                const rows = rowsByType[type];
                if (rows instanceof Error) return Promise.reject(rows);
                return Promise.resolve({ Items: rows ?? [] });
            });
        }

        it('queries GSI1 per type and never scans for the unfiltered list', async () => {
            routeByType({
                contact: [makeLead('contact', 'lead-contact-1', '2026-07-01T00:00:00Z')],
                download_gate: [makeLead('download_gate', 'lead-downloadgate-20260709-02d9a453', '2026-07-09T00:00:00Z')],
                newsletter: [makeLead('newsletter', 'lead-newsletter-1', '2026-07-05T00:00:00Z')],
            });

            const result = await handler(makeAppSyncEvent('listLeads', { limit: 7 }), {} as any, vi.fn());

            expect(mockScan).not.toHaveBeenCalled();
            expect(mockQuery).toHaveBeenCalledTimes(3);
            const queried = mockQuery.mock.calls.map((c: [{ IndexName?: string; ExpressionAttributeValues?: Record<string, string>; ScanIndexForward?: boolean; Limit?: number }]) => ({
                index: c[0].IndexName,
                pk: c[0].ExpressionAttributeValues?.[':pk'],
                scanIndexForward: c[0].ScanIndexForward,
                limit: c[0].Limit,
            }));
            expect(queried).toEqual(expect.arrayContaining([
                { index: 'GSI1', pk: 'LEAD_TYPE#contact', scanIndexForward: false, limit: 7 },
                { index: 'GSI1', pk: 'LEAD_TYPE#download_gate', scanIndexForward: false, limit: 7 },
                { index: 'GSI1', pk: 'LEAD_TYPE#newsletter', scanIndexForward: false, limit: 7 },
            ]));
            expect(result.items).toHaveLength(3);
            expect(result.nextToken).toBeNull();
        });

        it('returns the newest lead across all types first', async () => {
            routeByType({
                contact: [makeLead('contact', 'lead-contact-1', '2026-07-01T00:00:00Z')],
                download_gate: [makeLead('download_gate', 'lead-downloadgate-20260709-02d9a453', '2026-07-09T00:00:00Z')],
                newsletter: [makeLead('newsletter', 'lead-newsletter-1', '2026-07-05T00:00:00Z')],
            });

            const result = await handler(makeAppSyncEvent('listLeads'), {} as any, vi.fn());

            expect(result.items.map((l: { type: string }) => l.type)).toEqual([
                'download_gate', 'newsletter', 'contact',
            ]);
            expect(result.items[0].leadId).toBe('lead-downloadgate-20260709-02d9a453');
        });

        it('tolerates one failed type partition and still returns the others', async () => {
            routeByType({
                contact: new Error('DDB throttled'),
                download_gate: [makeLead('download_gate', 'lead-dg-1', '2026-07-09T00:00:00Z')],
                newsletter: [makeLead('newsletter', 'lead-nl-1', '2026-07-05T00:00:00Z')],
            });

            const result = await handler(makeAppSyncEvent('listLeads'), {} as any, vi.fn());

            expect(result.items).toHaveLength(2);
            expect(result.items.map((l: { type: string }) => l.type)).toEqual(['download_gate', 'newsletter']);
        });

        it('throws when every type partition fails', async () => {
            routeByType({
                contact: new Error('fail'),
                download_gate: new Error('fail'),
                newsletter: new Error('fail'),
            });

            await expect(handler(makeAppSyncEvent('listLeads'), {} as any, vi.fn()))
                .rejects.toThrow(/all lead type partition queries failed/i);
        });

        it('breaks submittedAt ties deterministically by leadId descending', async () => {
            const ts = '2026-07-09T00:00:00Z';
            routeByType({
                // Supplied in ascending leadId order to prove the resolver re-sorts.
                download_gate: [
                    makeLead('download_gate', 'lead-downloadgate-20260709-02d9a453', ts),
                    makeLead('download_gate', 'lead-downloadgate-20260709-ff0011aa', ts),
                ],
                contact: [],
                newsletter: [],
            });

            const result = await handler(makeAppSyncEvent('listLeads'), {} as any, vi.fn());

            expect(result.items.map((l: { leadId: string }) => l.leadId)).toEqual([
                'lead-downloadgate-20260709-ff0011aa',
                'lead-downloadgate-20260709-02d9a453',
            ]);
        });

        it('queries a single GSI1 partition when type is provided (typed path unchanged)', async () => {
            mockQuery.mockResolvedValueOnce({
                Items: [makeLead('download_gate', 'lead-dg-typed', '2026-07-09T00:00:00Z')],
            });

            const result = await handler(
                makeAppSyncEvent('listLeads', { type: 'download_gate', limit: 10 }),
                {} as any,
                vi.fn(),
            );

            expect(mockScan).not.toHaveBeenCalled();
            expect(mockQuery).toHaveBeenCalledTimes(1);
            expect(mockQuery.mock.calls[0][0].ExpressionAttributeValues[':pk']).toBe('LEAD_TYPE#download_gate');
            expect(result.items).toHaveLength(1);
            expect(result.items[0].type).toBe('download_gate');
        });

        it('preserves typed path pagination tokens and ExclusiveStartKey', async () => {
            const lastKey = {
                PK: 'LEAD#lead-dg-page-1',
                SK: 'META',
                GSI1PK: 'LEAD_TYPE#download_gate',
                GSI1SK: '2026-07-09T00:00:00Z#lead-dg-page-1',
            };
            mockQuery
                .mockResolvedValueOnce({
                    Items: [makeLead('download_gate', 'lead-dg-page-1', '2026-07-09T00:00:00Z')],
                    LastEvaluatedKey: lastKey,
                })
                .mockResolvedValueOnce({
                    Items: [makeLead('download_gate', 'lead-dg-page-2', '2026-07-08T00:00:00Z')],
                });

            const firstPage = await handler(
                makeAppSyncEvent('listLeads', { type: 'download_gate', limit: 1 }),
                {} as any,
                vi.fn(),
            );
            const secondPage = await handler(
                makeAppSyncEvent('listLeads', { type: 'download_gate', limit: 1, nextToken: firstPage.nextToken }),
                {} as any,
                vi.fn(),
            );

            expect(firstPage.nextToken).toBe(Buffer.from(JSON.stringify(lastKey)).toString('base64'));
            expect(mockQuery).toHaveBeenCalledTimes(2);
            expect(mockQuery.mock.calls[1][0].ExclusiveStartKey).toEqual(lastKey);
            expect(secondPage.items[0].leadId).toBe('lead-dg-page-2');
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
            // QUOTE_SENT expired-quotes query
            mockQuery.mockResolvedValueOnce({ Items: [] });
            // Stalled+velocity GSI1 queries (8 unique statuses), all empty.
            // Use Once-variants to avoid the default leaking into later tests.
            for (let i = 0; i < 8; i++) {
                mockQuery.mockResolvedValueOnce({ Items: [] });
            }

            const result = await handler(
                makeAppSyncEvent('orderStats'),
                {} as any,
                vi.fn(),
            );

            expect(result.totalActive).toBe(3);
            expect(result.byStatus.INQUIRY).toBe(3);
            expect(result.stalledOrderId).toBeNull();
            expect(result.avgPoToProductionDays).toBeNull();
        });

        it('surfaces the most-stalled active order', async () => {
            const now = new Date();
            const daysAgo = (n: number) => new Date(now.getTime() - n * 86400000).toISOString();

            const originalImpl = mockSend.getMockImplementation();
            mockSend.mockReset();
            mockSend.mockImplementation((cmd: { Select?: string; ExpressionAttributeValues?: Record<string, string> }) => {
                const pk = cmd.ExpressionAttributeValues?.[':pk'];
                // COUNT queries → 0 for everything (we're only testing stalled surfacing)
                if (cmd.Select === 'COUNT') return Promise.resolve({ Count: 0 });
                // QUOTING bucket has a 45-day stalled order; QUOTE_SENT has a 20-day one.
                if (pk === 'ORDER_STATUS#QUOTING') {
                    return Promise.resolve({
                        Items: [
                            { orderId: 'ord-stalled', institution: 'Acme U', quoteNumber: 'Q-STALE', updatedAt: daysAgo(45) },
                            { orderId: 'ord-fresh', institution: 'Fresh U', updatedAt: daysAgo(2) },
                        ],
                    });
                }
                if (pk === 'ORDER_STATUS#QUOTE_SENT') {
                    return Promise.resolve({ Items: [{ orderId: 'ord-mild', institution: 'Mild U', updatedAt: daysAgo(20) }] });
                }
                return Promise.resolve({ Items: [] });
            });

            try {
                const result = await handler(
                    makeAppSyncEvent('orderStats'),
                    {} as any,
                    vi.fn(),
                );
                expect(result.stalledOrderId).toBe('ord-stalled');
                expect(result.stalledStatus).toBe('QUOTING');
                expect(result.stalledQuoteNumber).toBe('Q-STALE');
                expect(result.stalledInstitution).toBe('Acme U');
                expect(result.stalledDaysSinceLastUpdate).toBeGreaterThanOrEqual(44);
                expect(result.stalledDaysSinceLastUpdate).toBeLessThanOrEqual(46);
            } finally {
                mockSend.mockReset();
                if (originalImpl) mockSend.mockImplementation(originalImpl);
            }
        });

        it('returns null stalled fields when nothing exceeds the 14-day threshold', async () => {
            const now = new Date();
            const daysAgo = (n: number) => new Date(now.getTime() - n * 86400000).toISOString();

            const originalImpl = mockSend.getMockImplementation();
            mockSend.mockReset();
            mockSend.mockImplementation((cmd: { Select?: string; ExpressionAttributeValues?: Record<string, string> }) => {
                if (cmd.Select === 'COUNT') return Promise.resolve({ Count: 0 });
                const pk = cmd.ExpressionAttributeValues?.[':pk'];
                if (pk === 'ORDER_STATUS#QUOTING') {
                    return Promise.resolve({ Items: [{ orderId: 'ord-x', institution: 'X U', updatedAt: daysAgo(10) }] });
                }
                return Promise.resolve({ Items: [] });
            });

            try {
                const result = await handler(makeAppSyncEvent('orderStats'), {} as any, vi.fn());
                expect(result.stalledOrderId).toBeNull();
                expect(result.stalledDaysSinceLastUpdate).toBeNull();
            } finally {
                mockSend.mockReset();
                if (originalImpl) mockSend.mockImplementation(originalImpl);
            }
        });

        it('averages PO→Production days across orders with both dates', async () => {
            const originalImpl = mockSend.getMockImplementation();
            mockSend.mockReset();
            mockSend.mockImplementation((cmd: { Select?: string; ExpressionAttributeValues?: Record<string, string> }) => {
                if (cmd.Select === 'COUNT') return Promise.resolve({ Count: 0 });
                const pk = cmd.ExpressionAttributeValues?.[':pk'];
                // 5-day gap and 15-day gap → avg 10
                if (pk === 'ORDER_STATUS#IN_PRODUCTION') {
                    return Promise.resolve({
                        Items: [
                            { orderId: 'a', poDate: '2026-03-01', productionStartDate: '2026-03-06' },
                            { orderId: 'b', poDate: '2026-03-01', productionStartDate: '2026-03-16' },
                            { orderId: 'c', poDate: '2026-03-01' }, // missing prod date → skipped
                        ],
                    });
                }
                return Promise.resolve({ Items: [] });
            });

            try {
                const result = await handler(makeAppSyncEvent('orderStats'), {} as any, vi.fn());
                expect(result.avgPoToProductionDays).toBe(10);
            } finally {
                mockSend.mockReset();
                if (originalImpl) mockSend.mockImplementation(originalImpl);
            }
        });

        it('counts QUOTE_SENT orders with past quoteValidUntil as expiredQuotes', async () => {
            // Save and replace the dispatch impl so the QUOTE_SENT GSI1 query
            // returns expired-quote items. Restore in `finally` so subsequent
            // tests keep the original constructor-name dispatch.
            const originalImpl = mockSend.getMockImplementation();
            mockSend.mockReset();
            mockSend.mockImplementation((cmd: { Select?: string; ExpressionAttributeValues?: Record<string, string> }) => {
                const pk = cmd.ExpressionAttributeValues?.[':pk'];
                if (pk === 'ORDER_STATUS#QUOTE_SENT') {
                    if (cmd.Select === 'COUNT') {
                        return Promise.resolve({ Count: 3 });
                    }
                    return Promise.resolve({
                        Count: 3,
                        Items: [
                            { quoteValidUntil: '2020-01-01' }, // expired
                            { quoteValidUntil: '2020-06-15' }, // expired
                            { quoteValidUntil: '2099-01-01' }, // future, not expired
                        ],
                    });
                }
                return Promise.resolve({ Count: 0, Items: [] });
            });

            try {
                const result = await handler(
                    makeAppSyncEvent('orderStats'),
                    {} as any,
                    vi.fn(),
                );
                expect(result.expiredQuotes).toBe(2);
                expect(result.byStatus.QUOTE_SENT).toBe(3);
            } finally {
                mockSend.mockReset();
                if (originalImpl) mockSend.mockImplementation(originalImpl);
            }
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

        it('persists quoteValidUntil', async () => {
            mockPut.mockResolvedValue({});
            mockGet.mockResolvedValue({
                Item: {
                    PK: 'ORDER#x', SK: 'META', orderId: 'x', status: 'INQUIRY',
                    institution: 'I', productModel: 'ICP',
                    createdAt: 't', updatedAt: 't', createdBy: 'a', source: 'MANUAL',
                    feedbackScheduleCreated: false,
                    quoteDate: '2026-05-01', quoteValidUntil: '2026-06-01',
                },
            });
            mockQuery.mockResolvedValue({ Items: [] });

            await handler(
                makeAppSyncEvent('createOrder', {
                    input: JSON.stringify({
                        institution: 'I',
                        productModel: 'ICP',
                        quoteDate: '2026-05-01',
                        quoteValidUntil: '2026-06-01',
                        primaryContact: { contactName: 'N', contactEmail: 'e@x.com', role: 'PI' },
                    }),
                }, 'Mutation'),
                {} as any,
                vi.fn(),
            );

            const orderItemPut = mockSend.mock.calls.find((c: unknown[]) => {
                const arg = c[0] as { Item?: { quoteValidUntil?: string; SK?: string } };
                return arg.Item?.SK === 'META' && arg.Item?.quoteValidUntil === '2026-06-01';
            });
            expect(orderItemPut).toBeTruthy();
        });

        it('rejects createOrder when quoteValidUntil is before quoteDate', async () => {
            await expect(handler(
                makeAppSyncEvent('createOrder', {
                    input: JSON.stringify({
                        institution: 'I',
                        productModel: 'ICP',
                        quoteDate: '2026-06-01',
                        quoteValidUntil: '2026-05-01',
                        primaryContact: { contactName: 'N', contactEmail: 'e@x.com', role: 'PI' },
                    }),
                }, 'Mutation'),
                {} as any,
                vi.fn(),
            )).rejects.toThrow(/quoteValidUntil/);
        });

        it('rejects createOrder when quoteValidUntil is malformed', async () => {
            await expect(handler(
                makeAppSyncEvent('createOrder', {
                    input: JSON.stringify({
                        institution: 'I',
                        productModel: 'ICP',
                        quoteValidUntil: '2026/06/01',
                        primaryContact: { contactName: 'N', contactEmail: 'e@x.com', role: 'PI' },
                    }),
                }, 'Mutation'),
                {} as any,
                vi.fn(),
            )).rejects.toThrow(/YYYY-MM-DD/);
        });

        it('upserts org from primary contact email, backfills matchedOrgId, and emits order_created', async () => {
            mockPut.mockResolvedValue({});
            mockUpdate.mockResolvedValue({});
            mockGet.mockResolvedValueOnce({ Item: { ...SAMPLE_ORDER, source: 'MANUAL' } });
            mockQuery.mockResolvedValueOnce({ Items: [SAMPLE_CONTACT] });
            mockInvokeOrgApi.mockResolvedValueOnce({ matchedOrgId: 'org-stanford' });

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

            expect(mockInvokeOrgApi).toHaveBeenCalledWith(expect.objectContaining({
                action: 'upsertFromSubmission',
                source: 'order',
                email: 'jane@stanford.edu',
            }));

            // matchedOrgId backfilled onto ORDER#<id>/META
            const orgBackfill = mockUpdate.mock.calls.length > 0
                ? mockSend.mock.calls.find((c: unknown[]) => {
                    const arg = c[0] as { Key?: { SK?: string }; ExpressionAttributeValues?: Record<string, unknown> };
                    return arg.Key?.SK === 'META'
                        && arg.ExpressionAttributeValues
                        && Object.values(arg.ExpressionAttributeValues).includes('org-stanford');
                })
                : undefined;
            expect(orgBackfill).toBeTruthy();

            expect(mockEmitTimelineEventToCrm).toHaveBeenCalledWith(expect.objectContaining({
                kind: 'order_created',
                resolveInput: expect.objectContaining({ matchedOrgId: 'org-stanford' }),
            }));
        });

        it('P2C-T8b: matchedOrgId backfill write carries a ConditionExpression that refuses to overwrite a stamped or real-org record', async () => {
            mockPut.mockResolvedValue({});
            mockUpdate.mockResolvedValue({});
            mockGet.mockResolvedValueOnce({ Item: { ...SAMPLE_ORDER, source: 'MANUAL' } });
            mockQuery.mockResolvedValueOnce({ Items: [SAMPLE_CONTACT] });
            mockInvokeOrgApi.mockResolvedValueOnce({ matchedOrgId: 'org-stanford' });

            await handler(
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

            const backfillCall = mockSend.mock.calls.find((c: unknown[]) => {
                const arg = c[0] as { Key?: { SK?: string }; UpdateExpression?: string };
                return arg.Key?.SK === 'META' && (arg.UpdateExpression ?? '').includes('matchedOrgId');
            });
            expect(backfillCall).toBeDefined();
            const params = backfillCall![0] as { ConditionExpression?: string; ExpressionAttributeValues: Record<string, string> };
            expect(params.ConditionExpression).toContain('attribute_not_exists(matchedOrgLinkGeneration)');
            expect(params.ConditionExpression).toContain('attribute_type(matchedOrgId, :nullType)');
            expect(params.ConditionExpression).toMatch(/attribute_not_exists\(matchedOrgId\)|matchedOrgId = :empty|begins_with\(matchedOrgId, :unres\)/);
            expect(params.ExpressionAttributeValues[':nullType']).toBe('NULL');
            expect(params.ExpressionAttributeValues[':empty']).toBe('');
            expect(params.ExpressionAttributeValues[':unres']).toBe('unresolved-');
        });

        it('P2C-T8b: a CCFE on the matchedOrgId backfill is swallowed as a no-op — createOrder still returns the order', async () => {
            mockPut.mockResolvedValue({});
            mockGet.mockResolvedValueOnce({ Item: { ...SAMPLE_ORDER, source: 'MANUAL' } });
            mockQuery.mockResolvedValueOnce({ Items: [SAMPLE_CONTACT] });
            mockInvokeOrgApi.mockResolvedValueOnce({ matchedOrgId: 'org-stanford' });
            mockUpdate.mockRejectedValueOnce(Object.assign(new Error('linked'), { name: 'ConditionalCheckFailedException' }));

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
            expect(result.orderId).toBeDefined();
        });

        it('skips org invoke when no primary contact email and emits with null matchedOrgId', async () => {
            // Force a missing primary email by stubbing validation? createOrder requires contactEmail,
            // so we simulate the no-email path by ensuring org-api is not called for an empty email.
            mockPut.mockResolvedValue({});
            mockGet.mockResolvedValueOnce({ Item: { ...SAMPLE_ORDER, source: 'MANUAL' } });
            mockQuery.mockResolvedValueOnce({ Items: [SAMPLE_CONTACT] });

            await handler(
                makeAppSyncEvent('createOrder', {
                    input: JSON.stringify({
                        institution: 'Stanford University',
                        productModel: 'TL-ICP-300',
                        primaryContact: {
                            contactName: 'Dr. Jane Smith',
                            contactEmail: '   ',
                            role: 'PI',
                        },
                    }),
                }, 'Mutation'),
                {} as any,
                vi.fn(),
            );

            expect(mockInvokeOrgApi).not.toHaveBeenCalled();
            expect(mockEmitTimelineEventToCrm).toHaveBeenCalledWith(expect.objectContaining({
                kind: 'order_created',
                resolveInput: expect.objectContaining({ matchedOrgId: undefined }),
            }));
        });

        it('still creates order and emits when org-api invoke rejects (non-fatal)', async () => {
            mockPut.mockResolvedValue({});
            mockGet.mockResolvedValueOnce({ Item: { ...SAMPLE_ORDER, source: 'MANUAL' } });
            mockQuery.mockResolvedValueOnce({ Items: [SAMPLE_CONTACT] });
            mockInvokeOrgApi.mockRejectedValueOnce(new Error('org-api down'));

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

            // order still returned despite org-api failure
            expect(result).toBeDefined();
            expect(result.orderId).toBeDefined();

            expect(mockEmitTimelineEventToCrm).toHaveBeenCalledWith(expect.objectContaining({
                kind: 'order_created',
                resolveInput: expect.objectContaining({ matchedOrgId: undefined }),
            }));
        });

        it('P2C-T8b (creation-path pin): the initial ORDER Put sets matchedOrgId unconditionally on a fresh PK — no guard needed or applied', async () => {
            mockPut.mockResolvedValue({});
            mockGet.mockResolvedValueOnce({ Item: { ...SAMPLE_ORDER, source: 'MANUAL' } });
            mockQuery.mockResolvedValueOnce({ Items: [SAMPLE_CONTACT] });

            await handler(
                makeAppSyncEvent('createOrder', {
                    input: JSON.stringify({
                        institution: 'Stanford University',
                        productModel: 'TL-ICP-300',
                        primaryContact: {
                            contactName: 'Dr. Jane Smith',
                            contactEmail: '   ',
                            role: 'PI',
                        },
                    }),
                }, 'Mutation'),
                {} as any,
                vi.fn(),
            );

            const creationPut = mockSend.mock.calls.find((c: unknown[]) => {
                const arg = c[0] as { Item?: { SK?: string; matchedOrgId?: unknown }; ConditionExpression?: string };
                return arg.Item?.SK === 'META' && arg.Item?.matchedOrgId === '';
            });
            expect(creationPut).toBeDefined();
            // A fresh PK Put — no ConditionExpression exists to guard, and none is added by Task 8b.
            expect((creationPut![0] as { ConditionExpression?: string }).ConditionExpression).toBeUndefined();
        });
    });

    // -----------------------------------------------------------------------
    // updateOrder
    // -----------------------------------------------------------------------
    // -----------------------------------------------------------------------
    // createStripeOrder (internal-only: not in the GraphQL schema, reachable
    // only via direct Lambda invoke from stripe-webhook)
    // -----------------------------------------------------------------------
    describe('createStripeOrder', () => {
        const STRIPE_INPUT = {
            stripeSessionId: 'cs_live_test123',
            paymentIntentId: 'pi_test123',
            amountTotalCents: 799900,
            currency: 'usd',
            customerEmail: 'buyer@innatecontrol.com',
            customerName: 'Junqing Qiao',
            contactFirstName: 'Junqing',
            contactLastName: 'Qiao',
            contactPhone: '5085020875',
            productName: 'HY-4L - RF (13.56 MHz) Plasma Cleaner',
            quantity: 1,
            shippingAddress: '128 Parsons St, Brighton, MA, 02135, US',
            paidAt: '2026-07-22T19:38:45.572Z',
        };

        function makeDirectInvokeEvent(input: unknown) {
            // Direct Lambda invoke shape: no info wrapper, no identity
            return { fieldName: 'createStripeOrder', arguments: { input } };
        }

        beforeEach(() => {
            // The global beforeEach only clears calls (vi.clearAllMocks) —
            // unconsumed mockResolvedValueOnce queues would leak across tests.
            mockGet.mockReset();
            mockQuery.mockReset();
            mockPut.mockReset();
            mockTransact.mockReset();
            mockPut.mockResolvedValue({});
            mockTransact.mockResolvedValue({});
            mockUpsertVisitorBridge.mockReset();
            mockUpsertVisitorBridge.mockResolvedValue({ created: false, orgUpgraded: false });
        });

        function transactItems(call: unknown[]): Record<string, unknown>[] {
            const arg = call[0] as { TransactItems?: Array<{ Put?: { Item: Record<string, unknown> } }> };
            return (arg.TransactItems ?? []).map((t) => t.Put?.Item ?? {});
        }

        it('creates marker + order + contact + log in ONE atomic transaction', async () => {
            // Response is built from the in-memory items — no reads needed
            const result = await handler(
                makeDirectInvokeEvent(STRIPE_INPUT) as any,
                {} as any,
                vi.fn(),
            );

            expect(result).toBeDefined();
            // No standalone Puts — everything durable goes through the transaction
            expect(mockPut).not.toHaveBeenCalled();
            expect(mockTransact).toHaveBeenCalledTimes(1);

            const items = transactItems(mockTransact.mock.calls[0]);
            expect(items).toHaveLength(4); // marker + META + CONTACT + LOG

            const marker = items.find((it) => it.PK === 'STRIPE_SESSION#cs_live_test123');
            expect(marker).toBeTruthy();
            expect(marker!.orderId).toBeDefined();

            const meta = items.find((it) => it.SK === 'META' && String(it.PK).startsWith('ORDER#'))!;
            expect(meta.status).toBe('PO_RECEIVED');
            expect(meta.GSI1PK).toBe('ORDER_STATUS#PO_RECEIVED');
            expect(meta.source).toBe('STRIPE');
            expect(meta.stripeSessionId).toBe('cs_live_test123');
            expect(meta.quoteAmount).toBe(7999);
            expect(meta.poDate).toBe('2026-07-22');
            expect(meta.GSI4PK).toBe('EMAIL#buyer@innatecontrol.com');
            // Marker and order are bound inside the same transaction
            expect(marker!.orderId).toBe(meta.orderId);

            expect(items.find((it) => String(it.SK).startsWith('CONTACT#'))).toBeTruthy();
            expect(items.find((it) => String(it.SK).startsWith('LOG#'))).toBeTruthy();
        });

        function makeCancel(reasons?: Array<{ Code: string }>) {
            const cancel = new Error('Transaction cancelled') as Error & { CancellationReasons?: Array<{ Code: string }> };
            cancel.name = 'TransactionCanceledException';
            if (reasons) cancel.CancellationReasons = reasons;
            return cancel;
        }
        // Realistic AWS shape: marker (item 0) condition failed, other items 'None'
        const MARKER_EXISTS_REASONS = [
            { Code: 'ConditionalCheckFailed' }, { Code: 'None' }, { Code: 'None' }, { Code: 'None' },
        ];

        it('is idempotent: marker ConditionalCheckFailed returns the original order via consistent reads', async () => {
            mockTransact.mockRejectedValueOnce(makeCancel(MARKER_EXISTS_REASONS));
            mockGet
                .mockResolvedValueOnce({ Item: { PK: 'STRIPE_SESSION#cs_live_test123', orderId: 'ord-20260722-d169' } })
                .mockResolvedValueOnce({ Item: { ...SAMPLE_ORDER, orderId: 'ord-20260722-d169', status: 'PO_RECEIVED', source: 'STRIPE', matchedOrgId: 'org-1' } });
            mockQuery.mockResolvedValueOnce({ Items: [SAMPLE_CONTACT] });

            const result = await handler(
                makeDirectInvokeEvent(STRIPE_INPUT) as any,
                {} as any,
                vi.fn(),
            ) as Record<string, unknown>;

            expect(result.orderId).toBe('ord-20260722-d169');
            // No partial writes on the duplicate path
            expect(mockPut).not.toHaveBeenCalled();
            // Every duplicate-path read must be strongly consistent so a
            // concurrent loser can't miss the winner's just-committed records
            for (const call of mockGet.mock.calls) {
                expect((call[0] as { ConsistentRead?: boolean }).ConsistentRead).toBe(true);
            }
            expect((mockQuery.mock.calls[0][0] as { ConsistentRead?: boolean }).ConsistentRead).toBe(true);
        });

        it('rethrows on TransactionConflict without treating it as a duplicate', async () => {
            // A loser racing the winner's in-flight transaction gets
            // TransactionConflict — nothing was written; Stripe must retry.
            mockTransact.mockRejectedValueOnce(makeCancel([
                { Code: 'TransactionConflict' }, { Code: 'None' }, { Code: 'None' }, { Code: 'None' },
            ]));

            await expect(handler(
                makeDirectInvokeEvent(STRIPE_INPUT) as any,
                {} as any,
                vi.fn(),
            )).rejects.toThrow('Transaction cancelled');
            // Short-circuits on the cancellation reason — no marker lookup at all
            expect(mockGet).not.toHaveBeenCalled();
        });

        it('rethrows when cancelled without reasons and no marker exists on a consistent read', async () => {
            mockTransact.mockRejectedValueOnce(makeCancel()); // SDK gave no reasons
            mockGet.mockResolvedValueOnce({}); // consistent marker lookup → not found

            await expect(handler(
                makeDirectInvokeEvent(STRIPE_INPUT) as any,
                {} as any,
                vi.fn(),
            )).rejects.toThrow('Transaction cancelled');
            expect((mockGet.mock.calls[0][0] as { ConsistentRead?: boolean }).ConsistentRead).toBe(true);
        });

        it('throws when the marker points at a missing order (never reports silent success)', async () => {
            mockTransact.mockRejectedValueOnce(makeCancel(MARKER_EXISTS_REASONS));
            mockGet
                .mockResolvedValueOnce({ Item: { PK: 'STRIPE_SESSION#cs_live_test123', orderId: 'ord-gone' } })
                .mockResolvedValueOnce({}); // consistent META read → order missing

            await expect(handler(
                makeDirectInvokeEvent(STRIPE_INPUT) as any,
                {} as any,
                vi.fn(),
            )).rejects.toThrow(/missing order/);
        });

        it('duplicate path self-heals the VISITOR# bridge from stored META (no org re-upsert)', async () => {
            mockTransact.mockRejectedValueOnce(makeCancel(MARKER_EXISTS_REASONS));
            mockGet
                .mockResolvedValueOnce({ Item: { PK: 'STRIPE_SESSION#cs_live_test123', orderId: 'ord-20260722-d169' } })
                .mockResolvedValueOnce({
                    Item: {
                        ...SAMPLE_ORDER, orderId: 'ord-20260722-d169', status: 'PO_RECEIVED', source: 'STRIPE',
                        visitorId: '550e8400-e29b-41d4-a716-446655440000', matchedOrgId: 'org-innate',
                    },
                });
            mockQuery.mockResolvedValueOnce({ Items: [SAMPLE_CONTACT] });
            // Bridge unchanged (all flags false) — the bridge-ok-but-reResolve-
            // failed crash window looks exactly like this on retry

            const result = await handler(
                makeDirectInvokeEvent(STRIPE_INPUT) as any,
                {} as any,
                vi.fn(),
            ) as Record<string, unknown>;

            expect(result.orderId).toBe('ord-20260722-d169');
            // Bridge healed from the STORED order's identity, not re-derived
            expect(mockUpsertVisitorBridge).toHaveBeenCalledTimes(1);
            const bridgeInput = mockUpsertVisitorBridge.mock.calls[0][2] as Record<string, unknown>;
            expect(bridgeInput.visitorId).toBe('550e8400-e29b-41d4-a716-446655440000');
            expect(bridgeInput.matchedOrgId).toBe('org-innate');
            expect(bridgeInput.sourceEntityType).toBe('order');
            expect(bridgeInput.sourceEntityId).toBe('ord-20260722-d169');
            // Email restored from the stored primary contact, not the retry request
            expect(bridgeInput.email).toBe('jane@stanford.edu');
            // reResolve fires UNCONDITIONALLY on the heal path — an unchanged
            // bridge must still cover the reResolve-failed crash window
            expect(mockInvokeCrmAction).toHaveBeenCalledWith(
                expect.objectContaining({ action: 'reResolveVisitorSessions', maxSessions: 10 }),
                { sync: true }, // Event invoke would swallow failures and close the retry window; maxSessions bounds the sync wait to the caller's budget
            );
            // The NON-idempotent org score upsert must NOT run again
            expect(mockInvokeOrgApi).not.toHaveBeenCalled();
        });

        it('duplicate-path bridge failure rethrows so Stripe keeps retrying', async () => {
            mockTransact.mockRejectedValueOnce(makeCancel(MARKER_EXISTS_REASONS));
            mockGet
                .mockResolvedValueOnce({ Item: { PK: 'STRIPE_SESSION#cs_live_test123', orderId: 'ord-20260722-d169' } })
                .mockResolvedValueOnce({
                    Item: { ...SAMPLE_ORDER, orderId: 'ord-20260722-d169', visitorId: '550e8400-e29b-41d4-a716-446655440000' },
                });
            mockQuery.mockResolvedValueOnce({ Items: [SAMPLE_CONTACT] });
            mockUpsertVisitorBridge.mockRejectedValueOnce(new Error('bridge down'));

            await expect(handler(
                makeDirectInvokeEvent(STRIPE_INPUT) as any,
                {} as any,
                vi.fn(),
            )).rejects.toThrow('bridge down');
        });

        it('duplicate path without a stored visitorId skips the bridge quietly', async () => {
            mockTransact.mockRejectedValueOnce(makeCancel(MARKER_EXISTS_REASONS));
            mockGet
                .mockResolvedValueOnce({ Item: { PK: 'STRIPE_SESSION#cs_live_test123', orderId: 'ord-old' } })
                .mockResolvedValueOnce({ Item: { ...SAMPLE_ORDER, orderId: 'ord-old', status: 'PO_RECEIVED', source: 'STRIPE' } });
            mockQuery.mockResolvedValueOnce({ Items: [] });

            const result = await handler(
                makeDirectInvokeEvent(STRIPE_INPUT) as any,
                {} as any,
                vi.fn(),
            ) as Record<string, unknown>;

            expect(result.orderId).toBe('ord-old');
            expect(mockUpsertVisitorBridge).not.toHaveBeenCalled();
        });

        it('stores visitorId on META and upserts the VISITOR# bridge (order source)', async () => {
            mockUpsertVisitorBridge.mockResolvedValueOnce({ created: true, orgUpgraded: false });

            await handler(
                makeDirectInvokeEvent({ ...STRIPE_INPUT, visitorId: '550e8400-e29b-41d4-a716-446655440000' }) as any,
                {} as any,
                vi.fn(),
            );

            const items = transactItems(mockTransact.mock.calls[0]);
            const meta = items.find((it) => it.SK === 'META' && String(it.PK).startsWith('ORDER#'))!;
            expect(meta.visitorId).toBe('550e8400-e29b-41d4-a716-446655440000');

            expect(mockUpsertVisitorBridge).toHaveBeenCalledTimes(1);
            const bridgeInput = mockUpsertVisitorBridge.mock.calls[0][2] as Record<string, unknown>;
            expect(bridgeInput.visitorId).toBe('550e8400-e29b-41d4-a716-446655440000');
            expect(bridgeInput.sourceEntityType).toBe('order');
            expect(bridgeInput.sourceEntityId).toBe(meta.orderId);
            expect(bridgeInput.email).toBe('buyer@innatecontrol.com');
            // New bridge → retro-resolve this visitor's sessions
            expect(mockInvokeCrmAction).toHaveBeenCalledWith(
                expect.objectContaining({ action: 'reResolveVisitorSessions', visitorId: '550e8400-e29b-41d4-a716-446655440000' }),
                { sync: true },
            );
        });

        it('skips the bridge when no visitorId is provided (or it fails sanitation)', async () => {
            await handler(makeDirectInvokeEvent(STRIPE_INPUT) as any, {} as any, vi.fn());
            await handler(makeDirectInvokeEvent({ ...STRIPE_INPUT, visitorId: '<bad id>' }) as any, {} as any, vi.fn());
            expect(mockUpsertVisitorBridge).not.toHaveBeenCalled();
        });

        it('create-path bridge failure rethrows (webhook 500 → Stripe retry → duplicate self-heal)', async () => {
            mockUpsertVisitorBridge.mockRejectedValueOnce(new Error('bridge down'));

            await expect(handler(
                makeDirectInvokeEvent({ ...STRIPE_INPUT, visitorId: '550e8400-e29b-41d4-a716-446655440000' }) as any,
                {} as any,
                vi.fn(),
            )).rejects.toThrow('bridge down');

            // The idempotent CRM timeline emit ran BEFORE the throwing link —
            // a bridge outage must not starve the order_created event
            expect(mockEmitTimelineEventToCrm).toHaveBeenCalledTimes(1);
        });

        it('throws when required fields are missing', async () => {
            await expect(handler(
                makeDirectInvokeEvent({ stripeSessionId: 'cs_x' }) as any,
                {} as any,
                vi.fn(),
            )).rejects.toThrow(/required/);
        });

        it('accepts a JSON-string input payload', async () => {
            const result = await handler(
                makeDirectInvokeEvent(JSON.stringify(STRIPE_INPUT)) as any,
                {} as any,
                vi.fn(),
            );
            expect(result).toBeDefined();
        });
    });

    describe('updateOrder', () => {
        it('writes QUOTE_VALIDITY_UPDATED log when validUntil changes', async () => {
            mockGet.mockResolvedValue({
                Item: {
                    PK: 'ORDER#x', SK: 'META', orderId: 'x', status: 'QUOTE_SENT',
                    institution: 'I', productModel: 'ICP',
                    createdAt: 't', updatedAt: 't', createdBy: 'a', source: 'MANUAL',
                    feedbackScheduleCreated: false,
                    quoteDate: '2026-05-01', quoteValidUntil: '2026-05-31',
                },
            });
            mockUpdate.mockResolvedValue({});
            mockPut.mockResolvedValue({});
            mockQuery.mockResolvedValue({ Items: [] });

            await handler(
                makeAppSyncEvent('updateOrder', {
                    orderId: 'x',
                    input: JSON.stringify({ quoteValidUntil: '2026-06-15' }),
                }, 'Mutation'),
                {} as any,
                vi.fn(),
            );

            const logPut = mockSend.mock.calls
                .map((c: unknown[]) => c[0] as { Item?: { action?: string; detail?: string } })
                .find((arg) => arg?.Item?.action === 'QUOTE_VALIDITY_UPDATED');
            expect(logPut).toBeTruthy();
            const detail = (logPut?.Item as { detail?: string } | undefined)?.detail ?? '';
            expect(detail).toContain('2026-05-31');
            expect(detail).toContain('2026-06-15');
        });

        it('rejects updateOrder with validUntil before stored quoteDate', async () => {
            mockGet.mockResolvedValue({
                Item: {
                    PK: 'ORDER#x', SK: 'META', orderId: 'x', status: 'QUOTE_SENT',
                    institution: 'I', productModel: 'ICP',
                    createdAt: 't', updatedAt: 't', createdBy: 'a', source: 'MANUAL',
                    feedbackScheduleCreated: false,
                    quoteDate: '2026-05-15',
                },
            });
            await expect(handler(
                makeAppSyncEvent('updateOrder', {
                    orderId: 'x',
                    input: JSON.stringify({ quoteValidUntil: '2026-05-01' }),
                }, 'Mutation'),
                {} as any,
                vi.fn(),
            )).rejects.toThrow(/quoteValidUntil/);
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

        it('emits order_stage_changed with the stable LOG id, toStatus, timestamp, and matchedOrgId', async () => {
            mockGet.mockResolvedValueOnce({ Item: SAMPLE_ORDER });
            mockUpdate.mockResolvedValue({});
            mockPut.mockResolvedValue({});
            mockGet.mockResolvedValueOnce({ Item: { ...SAMPLE_ORDER, status: 'QUOTING' } });
            mockQuery.mockResolvedValueOnce({ Items: [SAMPLE_CONTACT] });

            await handler(
                makeAppSyncEvent('updateOrderStatus', {
                    orderId: 'ord-20260310-abcd',
                    newStatus: 'QUOTING',
                }, 'Mutation'),
                {} as any,
                vi.fn(),
            );

            // Find the LOG PutCommand the resolver wrote (STATUS_CHANGE).
            const logItem = mockSend.mock.calls
                .map((c: unknown[]) => c[0] as { Item?: { action?: string; id?: string; SK?: string } })
                .find((arg) => arg?.Item?.action === 'STATUS_CHANGE')?.Item as
                    { id?: string; SK?: string } | undefined;
            expect(logItem?.id).toMatch(/^olog-/);

            expect(mockEmitTimelineEventToCrm).toHaveBeenCalledWith(expect.objectContaining({
                kind: 'order_stage_changed',
                idInput: expect.objectContaining({
                    orderLogId: logItem?.id,
                    toStatus: 'QUOTING',
                }),
                occurredAt: expect.any(String),
                resolveInput: expect.objectContaining({ matchedOrgId: 'org-stanford' }),
            }));

            // occurredAt must equal the LOG entry timestamp (the resolver's `now`).
            const emitArg = mockEmitTimelineEventToCrm.mock.calls.find(
                (c: unknown[]) => (c[0] as { kind?: string })?.kind === 'order_stage_changed',
            )?.[0] as { occurredAt?: string; idInput?: { occurredAt?: string } } | undefined;
            const logTimestamp = mockSend.mock.calls
                .map((c: unknown[]) => c[0] as { Item?: { action?: string; timestamp?: string } })
                .find((arg) => arg?.Item?.action === 'STATUS_CHANGE')?.Item?.timestamp;
            expect(emitArg?.occurredAt).toBe(logTimestamp);
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

        it('queries RFQ status buckets before sorting unfiltered RFQs by submittedAt', async () => {
            const pendingRfq = {
                ...SAMPLE_RFQ,
                PK: 'RFQ#rfq-20260309-old001',
                rfqId: 'rfq-20260309-old001',
                status: 'pending',
                submittedAt: '2026-03-09T12:00:00Z',
            };
            const declinedRfq = {
                ...SAMPLE_RFQ,
                PK: 'RFQ#rfq-20260308-declined',
                rfqId: 'rfq-20260308-declined',
                status: 'declined',
                submittedAt: '2026-03-08T12:00:00Z',
            };
            const convertedRfq = {
                ...SAMPLE_RFQ,
                PK: 'RFQ#rfq-20260311-new001',
                rfqId: 'rfq-20260311-new001',
                status: 'converted',
                submittedAt: '2026-03-11T12:00:00Z',
            };

            mockQuery
                .mockResolvedValueOnce({ Items: [pendingRfq] })
                .mockResolvedValueOnce({ Items: [declinedRfq] })
                .mockResolvedValueOnce({ Items: [convertedRfq] });

            const result = await handler(
                makeAppSyncEvent('listRfqs', { limit: 2 }),
                {} as any,
                vi.fn(),
            );

            expect(mockScan).not.toHaveBeenCalled();
            expect(mockQuery).toHaveBeenCalledTimes(3);
            expect(mockQuery.mock.calls.map(([cmd]) => cmd.ExpressionAttributeValues[':pk'])).toEqual([
                'RFQ_STATUS#pending',
                'RFQ_STATUS#declined',
                'RFQ_STATUS#converted',
            ]);
            expect(mockQuery.mock.calls.map(([cmd]) => cmd.IndexName)).toEqual(['GSI1', 'GSI1', 'GSI1']);
            expect(mockQuery.mock.calls.map(([cmd]) => cmd.ScanIndexForward)).toEqual([false, false, false]);
            expect(mockQuery.mock.calls.map(([cmd]) => cmd.Limit)).toEqual([2, 2, 2]);
            expect(result.items).toHaveLength(2);
            expect(result.items.map((item: typeof SAMPLE_RFQ) => item.rfqId)).toEqual([
                'rfq-20260311-new001',
                'rfq-20260309-old001',
            ]);
        });

        it('degrades to the succeeding status buckets when one partition query fails', async () => {
            const pendingRfq = {
                ...SAMPLE_RFQ,
                PK: 'RFQ#rfq-20260309-pend01',
                rfqId: 'rfq-20260309-pend01',
                status: 'pending',
                submittedAt: '2026-03-09T12:00:00Z',
            };
            const convertedRfq = {
                ...SAMPLE_RFQ,
                PK: 'RFQ#rfq-20260311-conv01',
                rfqId: 'rfq-20260311-conv01',
                status: 'converted',
                submittedAt: '2026-03-11T12:00:00Z',
            };

            mockQuery
                .mockResolvedValueOnce({ Items: [pendingRfq] })                            // pending
                .mockRejectedValueOnce(new Error('ProvisionedThroughputExceededException')) // declined
                .mockResolvedValueOnce({ Items: [convertedRfq] });                         // converted

            const result = await handler(
                makeAppSyncEvent('listRfqs', {}),
                {} as any,
                vi.fn(),
            );

            expect(mockQuery).toHaveBeenCalledTimes(3);
            expect(result.items.map((item: typeof SAMPLE_RFQ) => item.rfqId)).toEqual([
                'rfq-20260311-conv01',
                'rfq-20260309-pend01',
            ]);
        });

        it('throws when every status bucket query fails', async () => {
            mockQuery
                .mockRejectedValueOnce(new Error('boom-pending'))
                .mockRejectedValueOnce(new Error('boom-declined'))
                .mockRejectedValueOnce(new Error('boom-converted'));

            await expect(handler(
                makeAppSyncEvent('listRfqs', {}),
                {} as any,
                vi.fn(),
            )).rejects.toThrow();
        });

        it('breaks submittedAt ties by rfqId descending for a deterministic order', async () => {
            const tsShared = '2026-03-10T00:00:00Z';
            const lowIdRfq = {
                ...SAMPLE_RFQ,
                PK: 'RFQ#rfq-20260310-aaa111',
                rfqId: 'rfq-20260310-aaa111',
                status: 'pending',
                submittedAt: tsShared,
            };
            const highIdRfq = {
                ...SAMPLE_RFQ,
                PK: 'RFQ#rfq-20260310-zzz999',
                rfqId: 'rfq-20260310-zzz999',
                status: 'converted',
                submittedAt: tsShared,
            };

            mockQuery
                .mockResolvedValueOnce({ Items: [lowIdRfq] }) // pending
                .mockResolvedValueOnce({ Items: [] })         // declined
                .mockResolvedValueOnce({ Items: [highIdRfq] }); // converted

            const result = await handler(
                makeAppSyncEvent('listRfqs', {}),
                {} as any,
                vi.fn(),
            );

            expect(result.items.map((item: typeof SAMPLE_RFQ) => item.rfqId)).toEqual([
                'rfq-20260310-zzz999',
                'rfq-20260310-aaa111',
            ]);
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

        it('P2C-T8b (creation-path pin): matchedOrgId is set only on the initial ORDER Put (fresh PK) — this resolver never backfills/updates it', async () => {
            mockGet.mockResolvedValueOnce({ Item: SAMPLE_RFQ });
            mockPut.mockResolvedValue({});
            mockUpdate.mockResolvedValue({});
            mockGet.mockResolvedValueOnce({
                Item: { ...SAMPLE_ORDER, source: 'RFQ_WEBSITE', rfqId: 'rfq-20260310-abc123' },
            });
            mockQuery.mockResolvedValueOnce({ Items: [SAMPLE_CONTACT] });

            await handler(
                makeAppSyncEvent('convertRfqToOrder', { rfqId: 'rfq-20260310-abc123' }, 'Mutation'),
                {} as any,
                vi.fn(),
            );

            const creationPut = mockSend.mock.calls.find((c: unknown[]) => {
                const arg = c[0] as { Item?: { SK?: string; matchedOrgId?: unknown } };
                return arg.Item?.SK === 'META' && arg.Item?.matchedOrgId === SAMPLE_RFQ.matchedOrgId;
            });
            expect(creationPut).toBeDefined();
            expect((creationPut![0] as { ConditionExpression?: string }).ConditionExpression).toBeUndefined();

            // No UpdateCommand ever touches matchedOrgId in this resolver — it is creation-only.
            const matchedOrgIdUpdate = mockSend.mock.calls.find((c: unknown[]) => {
                const arg = c[0] as { UpdateExpression?: string };
                return (arg.UpdateExpression ?? '').includes('matchedOrgId');
            });
            expect(matchedOrgIdUpdate).toBeUndefined();
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
    // confirmDocumentUpload
    // -----------------------------------------------------------------------
    describe('confirmDocumentUpload', () => {
        it('emits quote_sent when a QUOTATION document is confirmed', async () => {
            mockPut.mockResolvedValue({});
            // GetCommand on ORDER#<id>/META → order carries a matchedOrgId
            mockGet.mockResolvedValueOnce({ Item: { ...SAMPLE_ORDER, matchedOrgId: 'org-stanford' } });

            await handler(
                makeAppSyncEvent('confirmDocumentUpload', {
                    orderId: 'ord-20260310-abcd',
                    s3Key: 'temp/ord-20260310-abcd/quote.pdf',
                    fileName: 'quote.pdf',
                    mimeType: 'application/pdf',
                    fileSize: 1024,
                    stage: 'QUOTING',
                    docType: 'QUOTATION',
                }, 'Mutation'),
                {} as any,
                vi.fn(),
            );

            // Recover the docId from the ORDER_DOCUMENT PutCommand the resolver wrote.
            const docItem = mockSend.mock.calls
                .map((c: unknown[]) => c[0] as { Item?: { docId?: string; SK?: string } })
                .find((arg) => typeof arg?.Item?.SK === 'string' && arg.Item.SK.startsWith('DOC#'))?.Item as
                    { docId?: string } | undefined;
            expect(docItem?.docId).toMatch(/^doc-/);

            expect(mockEmitTimelineEventToCrm).toHaveBeenCalledWith(expect.objectContaining({
                source: 'quote',
                kind: 'quote_sent',
                sourceEntityId: docItem?.docId,
                occurredAt: expect.any(String),
                resolveInput: expect.objectContaining({ matchedOrgId: 'org-stanford' }),
            }));
            // The operator (admin) email must NOT leak into resolution — link is matchedOrgId only.
            const quoteArg = mockEmitTimelineEventToCrm.mock.calls.find(
                (c: unknown[]) => (c[0] as { kind?: string })?.kind === 'quote_sent',
            )?.[0] as { resolveInput?: { email?: string } } | undefined;
            expect(quoteArg?.resolveInput?.email).toBeUndefined();

            // occurredAt must equal the document's uploadedAt (the resolver's `now`).
            const emitArg = mockEmitTimelineEventToCrm.mock.calls.find(
                (c: unknown[]) => (c[0] as { kind?: string })?.kind === 'quote_sent',
            )?.[0] as { occurredAt?: string } | undefined;
            const uploadedAt = mockSend.mock.calls
                .map((c: unknown[]) => c[0] as { Item?: { uploadedAt?: string; SK?: string } })
                .find((arg) => typeof arg?.Item?.SK === 'string' && arg.Item.SK.startsWith('DOC#'))?.Item?.uploadedAt;
            expect(emitArg?.occurredAt).toBe(uploadedAt);
        });

        it('does NOT emit quote_sent for a non-QUOTATION document', async () => {
            mockPut.mockResolvedValue({});
            mockGet.mockResolvedValue({ Item: { ...SAMPLE_ORDER, matchedOrgId: 'org-stanford' } });

            await handler(
                makeAppSyncEvent('confirmDocumentUpload', {
                    orderId: 'ord-20260310-abcd',
                    s3Key: 'temp/ord-20260310-abcd/po.pdf',
                    fileName: 'po.pdf',
                    mimeType: 'application/pdf',
                    fileSize: 1024,
                    stage: 'PO_RECEIVED',
                    docType: 'PURCHASE_ORDER',
                }, 'Mutation'),
                {} as any,
                vi.fn(),
            );

            expect(mockEmitTimelineEventToCrm).not.toHaveBeenCalled();
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
