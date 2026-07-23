import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — must be defined before handler import
// ---------------------------------------------------------------------------
const mockGet = vi.fn();
const mockPut = vi.fn();
const mockSend = vi.fn().mockImplementation((cmd: unknown) => {
    const name = (cmd as { constructor: { name: string } }).constructor.name;
    if (name === 'GetCommand') return mockGet(cmd);
    if (name === 'PutCommand') return mockPut(cmd);
    return Promise.resolve({});
});

vi.mock('@aws-sdk/client-dynamodb', () => ({
    DynamoDBClient: vi.fn().mockImplementation(() => ({})),
}));
vi.mock('@aws-sdk/lib-dynamodb', () => ({
    DynamoDBDocumentClient: { from: vi.fn().mockReturnValue({ send: mockSend }) },
    GetCommand: vi.fn().mockImplementation((p) => ({ ...p, constructor: { name: 'GetCommand' } })),
    PutCommand: vi.fn().mockImplementation((p) => ({ ...p, constructor: { name: 'PutCommand' } })),
    ScanCommand: vi.fn().mockImplementation((p) => ({ ...p, constructor: { name: 'ScanCommand' } })),
    DeleteCommand: vi.fn().mockImplementation((p) => ({ ...p, constructor: { name: 'DeleteCommand' } })),
}));
vi.mock('@aws-sdk/client-bedrock-runtime', () => ({
    BedrockRuntimeClient: vi.fn().mockImplementation(() => ({ send: vi.fn() })),
    InvokeModelCommand: vi.fn(),
}));

let handler: any;

const TOKEN = 'test-admin-secret';

function makeEvent(body: Record<string, unknown>) {
    return {
        httpMethod: 'POST',
        headers: { origin: 'https://ninescrolls.com' },
        body: JSON.stringify({ ...body, adminToken: TOKEN }),
    };
}

beforeAll(async () => {
    process.env.ORG_CLASSIFICATION_TABLE = 'org-classification-table';
    process.env.ADMIN_API_SECRET = TOKEN;
    handler = (await import('./handler')).handler;
});

beforeEach(() => {
    mockGet.mockReset();
    mockPut.mockReset();
    mockPut.mockResolvedValue({});
});

const MANUAL_RECORD = {
    orgName: 'v-abc123',
    organizationType: 'enterprise',
    isTargetCustomer: true,
    confidence: 1,
    reason: 'Manually marked',
    source: 'manual',
    previousClassification: {
        organizationType: 'telecom_isp', isTargetCustomer: false, confidence: 0.9, reason: 'AI', source: 'ai',
    },
};

describe('classify-org admin actions — strict cache reads', () => {
    it('undo: a DynamoDB read failure returns 500, NOT the 404 "No manual override found"', async () => {
        mockGet.mockRejectedValueOnce(new Error('ProvisionedThroughputExceededException'));

        const res = await handler(makeEvent({ action: 'undo', orgName: 'v-abc123' }), {} as never, vi.fn());

        expect(res.statusCode).toBe(500);
        expect(res.body).not.toContain('No manual override found');
    });

    it('undo: a genuinely missing record still returns the definitive 404', async () => {
        mockGet.mockResolvedValueOnce({}); // no Item

        const res = await handler(makeEvent({ action: 'undo', orgName: 'v-abc123' }), {} as never, vi.fn());

        expect(res.statusCode).toBe(404);
        expect(JSON.parse(res.body).error).toBe('No manual override found');
    });

    it('get-override: a read failure returns 500 instead of found:false', async () => {
        mockGet.mockRejectedValueOnce(new Error('network'));

        const res = await handler(makeEvent({ action: 'get-override', orgName: 'v-abc123' }), {} as never, vi.fn());

        expect(res.statusCode).toBe(500);
    });
});

describe('classify-org rename — lossless legacy migration', () => {
    it('copies the legacy record VERBATIM onto the new key (source/confidence/previousClassification preserved)', async () => {
        mockGet
            .mockResolvedValueOnce({}) // target key: no record
            .mockResolvedValueOnce({ Item: MANUAL_RECORD }); // legacy record

        const res = await handler(makeEvent({
            action: 'rename', orgName: 'v-new-key', displayName: 'InnateControl visitor',
            fromOrgName: 'Cloudflare, Inc. · Needham, Massachusetts',
        }), {} as never, vi.fn());

        expect(res.statusCode).toBe(200);
        const put = mockPut.mock.calls[0][0] as { Item: Record<string, unknown>; ConditionExpression?: string };
        expect(put.Item).toMatchObject({
            orgName: 'v-new-key',
            displayName: 'InnateControl visitor',
            organizationType: 'enterprise',
            isTargetCustomer: true,
            confidence: 1,
            source: 'manual',
            reason: 'Manually marked',
        });
        expect(put.Item.previousClassification).toEqual(MANUAL_RECORD.previousClassification);
        // Conditional: a concurrent write to the new key must not be clobbered
        expect(put.ConditionExpression).toBe('attribute_not_exists(orgName)');
    });

    it('falls back to the default record only when no legacy record exists either', async () => {
        mockGet
            .mockResolvedValueOnce({}) // target key: no record
            .mockResolvedValueOnce({}); // legacy: no record

        const res = await handler(makeEvent({
            action: 'rename', orgName: 'v-new-key', displayName: 'Renamed', fromOrgName: 'old-name',
        }), {} as never, vi.fn());

        expect(res.statusCode).toBe(200);
        const put = mockPut.mock.calls[0][0] as { Item: Record<string, unknown> };
        expect(put.Item).toMatchObject({ orgName: 'v-new-key', organizationType: 'unknown', isTargetCustomer: false });
    });

    it('race on the new key: merges displayName onto the winner instead of clobbering', async () => {
        mockGet
            .mockResolvedValueOnce({}) // target key: no record (stale read)
            .mockResolvedValueOnce({ Item: MANUAL_RECORD }); // legacy record
        const conflict = new Error('exists');
        conflict.name = 'ConditionalCheckFailedException';
        mockPut.mockRejectedValueOnce(conflict);
        mockGet.mockResolvedValueOnce({ Item: { orgName: 'v-new-key', organizationType: 'university', isTargetCustomer: true, confidence: 0.8, reason: 'winner', source: 'ai' } });

        const res = await handler(makeEvent({
            action: 'rename', orgName: 'v-new-key', displayName: 'Renamed', fromOrgName: 'old-name',
        }), {} as never, vi.fn());

        expect(res.statusCode).toBe(200);
        const finalPut = mockPut.mock.calls[1][0] as { Item: Record<string, unknown> };
        expect(finalPut.Item).toMatchObject({ organizationType: 'university', reason: 'winner', displayName: 'Renamed' });
    });

    it('existing record under the target key: just adds displayName (unchanged behavior)', async () => {
        mockGet.mockResolvedValueOnce({ Item: MANUAL_RECORD });

        const res = await handler(makeEvent({
            action: 'rename', orgName: 'v-abc123', displayName: 'Renamed',
        }), {} as never, vi.fn());

        expect(res.statusCode).toBe(200);
        const put = mockPut.mock.calls[0][0] as { Item: Record<string, unknown> };
        expect(put.Item).toMatchObject({ ...MANUAL_RECORD, displayName: 'Renamed' });
    });
});
