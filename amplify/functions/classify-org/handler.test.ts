import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — must be defined before handler import
// ---------------------------------------------------------------------------
const mockGet = vi.fn();
const mockPut = vi.fn();
const mockUpdate = vi.fn();
const mockSend = vi.fn().mockImplementation((cmd: unknown) => {
    const name = (cmd as { constructor: { name: string } }).constructor.name;
    if (name === 'GetCommand') return mockGet(cmd);
    if (name === 'PutCommand') return mockPut(cmd);
    if (name === 'UpdateCommand') return mockUpdate(cmd);
    return Promise.resolve({});
});

vi.mock('@aws-sdk/client-dynamodb', () => ({
    DynamoDBClient: vi.fn().mockImplementation(() => ({})),
}));
vi.mock('@aws-sdk/lib-dynamodb', () => ({
    DynamoDBDocumentClient: { from: vi.fn().mockReturnValue({ send: mockSend }) },
    GetCommand: vi.fn().mockImplementation((p) => ({ ...p, constructor: { name: 'GetCommand' } })),
    PutCommand: vi.fn().mockImplementation((p) => ({ ...p, constructor: { name: 'PutCommand' } })),
    UpdateCommand: vi.fn().mockImplementation((p) => ({ ...p, constructor: { name: 'UpdateCommand' } })),
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
    mockUpdate.mockReset();
    mockUpdate.mockResolvedValue({});
});

const CONDITIONAL_FAIL = () => {
    const err = new Error('conditional check failed');
    err.name = 'ConditionalCheckFailedException';
    return err;
};

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

describe('classify-org rename — atomic update + lossless legacy migration', () => {
    it('existing record: atomic SET displayName only — never a full-record Put that could clobber concurrent writes', async () => {
        // attribute_exists condition passes → record present
        const res = await handler(makeEvent({
            action: 'rename', orgName: 'v-abc123', displayName: 'Renamed',
        }), {} as never, vi.fn());

        expect(res.statusCode).toBe(200);
        expect(mockUpdate).toHaveBeenCalledTimes(1);
        const upd = mockUpdate.mock.calls[0][0] as Record<string, unknown>;
        expect(upd.UpdateExpression).toBe('SET displayName = :d');
        expect(upd.ConditionExpression).toBe('attribute_exists(orgName)');
        // No reads, no full-record writes
        expect(mockPut).not.toHaveBeenCalled();
        expect(mockGet).not.toHaveBeenCalled();
    });

    it('missing target: copies the legacy record VERBATIM (source/confidence/previousClassification preserved)', async () => {
        mockUpdate.mockRejectedValueOnce(CONDITIONAL_FAIL()); // target key: no record
        mockGet.mockResolvedValueOnce({ Item: MANUAL_RECORD }); // legacy record

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
        mockUpdate.mockRejectedValueOnce(CONDITIONAL_FAIL()); // target key: no record
        mockGet.mockResolvedValueOnce({}); // legacy: no record

        const res = await handler(makeEvent({
            action: 'rename', orgName: 'v-new-key', displayName: 'Renamed', fromOrgName: 'old-name',
        }), {} as never, vi.fn());

        expect(res.statusCode).toBe(200);
        const put = mockPut.mock.calls[0][0] as { Item: Record<string, unknown> };
        expect(put.Item).toMatchObject({ orgName: 'v-new-key', organizationType: 'unknown', isTargetCustomer: false });
    });

    it('race on the new key: retries the ATOMIC displayName update against the winner (no snapshot Put)', async () => {
        mockUpdate.mockRejectedValueOnce(CONDITIONAL_FAIL()); // target missing at first
        mockGet.mockResolvedValueOnce({ Item: MANUAL_RECORD }); // legacy record
        mockPut.mockRejectedValueOnce(CONDITIONAL_FAIL()); // winner appeared meanwhile
        // second Update (default resolve) succeeds against the winner

        const res = await handler(makeEvent({
            action: 'rename', orgName: 'v-new-key', displayName: 'Renamed', fromOrgName: 'old-name',
        }), {} as never, vi.fn());

        expect(res.statusCode).toBe(200);
        expect(mockUpdate).toHaveBeenCalledTimes(2);
        const finalUpd = mockUpdate.mock.calls[1][0] as Record<string, unknown>;
        expect(finalUpd.UpdateExpression).toBe('SET displayName = :d');
        // Exactly one Put attempt (the failed conditional create) — the winner
        // is never overwritten with a snapshot
        expect(mockPut).toHaveBeenCalledTimes(1);
    });

    it('created-then-deleted between attempts: fails loudly instead of looping', async () => {
        mockUpdate.mockRejectedValueOnce(CONDITIONAL_FAIL());
        mockGet.mockResolvedValueOnce({});
        mockPut.mockRejectedValueOnce(CONDITIONAL_FAIL());
        mockUpdate.mockRejectedValueOnce(CONDITIONAL_FAIL());

        const res = await handler(makeEvent({
            action: 'rename', orgName: 'v-new-key', displayName: 'Renamed',
        }), {} as never, vi.fn());

        expect(res.statusCode).toBe(500);
        expect(res.body).toContain('appeared and vanished');
    });
});
