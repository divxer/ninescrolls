import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — must be defined before handler import
// ---------------------------------------------------------------------------
const mockGet = vi.fn();
const mockPut = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockSend = vi.fn().mockImplementation((cmd: unknown) => {
    const name = (cmd as { constructor: { name: string } }).constructor.name;
    if (name === 'GetCommand') return mockGet(cmd);
    if (name === 'PutCommand') return mockPut(cmd);
    if (name === 'UpdateCommand') return mockUpdate(cmd);
    if (name === 'DeleteCommand') return mockDelete(cmd);
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
    mockDelete.mockReset();
    mockDelete.mockResolvedValue({});
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

describe('classify-org override/undo — displayName (rename) preservation', () => {
    const RENAMED_AI_RECORD = {
        orgName: 'v-abc123',
        displayName: 'InnateControl visitor',
        organizationType: 'telecom_isp',
        isTargetCustomer: false,
        confidence: 0.9,
        reason: 'AI classified',
        source: 'ai',
        provider: 'bedrock',
        ttl: 1753000000,
    };

    it('override on a renamed record: field-level Update only — displayName untouched, ttl/provider removed', async () => {
        mockGet.mockResolvedValueOnce({ Item: RENAMED_AI_RECORD });

        const res = await handler(makeEvent({
            action: 'override', orgName: 'v-abc123', isTargetCustomer: true, organizationType: 'enterprise',
        }), {} as never, vi.fn());

        expect(res.statusCode).toBe(200);
        // NEVER a full-record Put (which would drop displayName)
        expect(mockPut).not.toHaveBeenCalled();
        expect(mockUpdate).toHaveBeenCalledTimes(1);
        const u = mockUpdate.mock.calls[0][0] as Record<string, any>;
        expect(u.UpdateExpression).not.toContain('displayName');
        expect(u.UpdateExpression).toContain('REMOVE #ttl, provider');
        expect(u.ExpressionAttributeValues[':src']).toBe('manual');
        expect(u.ExpressionAttributeValues[':it']).toBe(true);
        // previousClassification captured from the existing record
        expect(u.ExpressionAttributeValues[':prev']).toMatchObject({ organizationType: 'telecom_isp', source: 'ai' });
    });

    it('undo restore: field-level Update — displayName untouched, previousClassification removed', async () => {
        mockGet.mockResolvedValueOnce({
            Item: {
                ...RENAMED_AI_RECORD,
                source: 'manual',
                previousClassification: { organizationType: 'telecom_isp', isTargetCustomer: false, confidence: 0.9, reason: 'AI', source: 'ai', provider: 'bedrock' },
            },
        });

        const res = await handler(makeEvent({ action: 'undo', orgName: 'v-abc123' }), {} as never, vi.fn());

        expect(res.statusCode).toBe(200);
        expect(mockPut).not.toHaveBeenCalled();
        const u = mockUpdate.mock.calls[0][0] as Record<string, any>;
        expect(u.UpdateExpression).not.toContain('displayName');
        expect(u.UpdateExpression).toContain('REMOVE previousClassification');
        expect(u.ExpressionAttributeValues[':src']).toBe('ai');
        expect(u.ExpressionAttributeValues[':p']).toBe('bedrock');
        // CAS on the read snapshot: a NEWER override committed between read
        // and restore must not be overwritten with stale data
        expect(u.ConditionExpression).toContain('#src = :manual');
    });

    it('override stamps a UUID revision token (CAS basis for later undos)', async () => {
        mockGet.mockResolvedValueOnce({ Item: RENAMED_AI_RECORD });
        await handler(makeEvent({ action: 'override', orgName: 'v-abc123', isTargetCustomer: true }), {} as never, vi.fn());
        const u = mockUpdate.mock.calls[0][0] as Record<string, any>;
        expect(u.UpdateExpression).toContain('revision = :rev');
        expect(u.ExpressionAttributeValues[':rev']).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('undo CAS prefers the revision token over classifiedAt (same-millisecond overrides cannot collide)', async () => {
        mockGet.mockResolvedValueOnce({
            Item: {
                orgName: 'v-abc123', organizationType: 'enterprise', isTargetCustomer: true, confidence: 1,
                reason: 'M', source: 'manual', classifiedAt: 'T-SAME-MS', revision: 'rev-A',
                previousClassification: { organizationType: 'telecom_isp', isTargetCustomer: false, confidence: 0.9, reason: 'AI', source: 'ai' },
            },
        });
        const res = await handler(makeEvent({ action: 'undo', orgName: 'v-abc123' }), {} as never, vi.fn());
        expect(res.statusCode).toBe(200);
        const u = mockUpdate.mock.calls[0][0] as Record<string, any>;
        // revision equality — NOT the collidable classifiedAt timestamp
        expect(u.ConditionExpression).toContain('revision = :readRev');
        expect(u.ConditionExpression).not.toContain('classifiedAt = :readAt');
        expect(u.ExpressionAttributeValues[':readRev']).toBe('rev-A');
    });

    it('undo restore race: a newer override landing mid-flight re-dispatches against the fresh record', async () => {
        const prevA = { organizationType: 'telecom_isp', isTargetCustomer: false, confidence: 0.9, reason: 'AI', source: 'ai' };
        const manualV1 = { orgName: 'v-abc123', organizationType: 'enterprise', isTargetCustomer: true, confidence: 1, reason: 'M1', source: 'manual', classifiedAt: 'T1', previousClassification: prevA };
        const manualV2 = { orgName: 'v-abc123', organizationType: 'hospital', isTargetCustomer: true, confidence: 1, reason: 'M2', source: 'manual', classifiedAt: 'T2', previousClassification: { ...manualV1, source: 'manual' } };
        mockGet.mockResolvedValueOnce({ Item: manualV1 }); // initial read
        const conflict = new Error('conditional');
        conflict.name = 'ConditionalCheckFailedException';
        mockUpdate.mockRejectedValueOnce(conflict); // newer override (V2) landed → CAS fails
        mockGet.mockResolvedValueOnce({ Item: manualV2 }); // re-read: the fresh record
        // second restore succeeds

        const res = await handler(makeEvent({ action: 'undo', orgName: 'v-abc123' }), {} as never, vi.fn());

        expect(res.statusCode).toBe(200);
        expect(mockUpdate).toHaveBeenCalledTimes(2);
        const second = mockUpdate.mock.calls[1][0] as Record<string, any>;
        // Re-dispatch operated on the FRESH record's snapshot, not the stale one
        expect(second.ExpressionAttributeValues[':readAt']).toBe('T2');
    });

    it('undo with no previousClassification but a saved rename: neutralizes instead of deleting the rename', async () => {
        mockGet.mockResolvedValueOnce({
            Item: { orgName: 'v-abc123', displayName: 'InnateControl visitor', organizationType: 'enterprise', isTargetCustomer: true, confidence: 1, reason: 'Manual', source: 'manual' },
        });

        const res = await handler(makeEvent({ action: 'undo', orgName: 'v-abc123' }), {} as never, vi.fn());

        expect(res.statusCode).toBe(200);
        // No DeleteCommand — the record (and its displayName) survives
        expect(mockUpdate).toHaveBeenCalledTimes(1);
        const u = mockUpdate.mock.calls[0][0] as Record<string, any>;
        expect(u.UpdateExpression).not.toContain('displayName');
        expect(u.ExpressionAttributeValues[':ot']).toBe('unknown');
        // CAS: source + the displayName being preserved + revision token
        expect(u.ConditionExpression).toContain('#src = :manual AND displayName = :dn');
        expect(u.ExpressionAttributeValues[':dn']).toBe('InnateControl visitor');
        expect(JSON.parse(res.body)).toMatchObject({ undone: true, deleted: false, displayName: 'InnateControl visitor' });
    });

    it('undo with no previousClassification and no rename still deletes the record entirely', async () => {
        mockGet.mockResolvedValueOnce({
            Item: { orgName: 'v-abc123', organizationType: 'enterprise', isTargetCustomer: true, confidence: 1, reason: 'Manual', source: 'manual' },
        });

        const res = await handler(makeEvent({ action: 'undo', orgName: 'v-abc123' }), {} as never, vi.fn());

        expect(res.statusCode).toBe(200);
        expect(mockUpdate).not.toHaveBeenCalled();
        expect(JSON.parse(res.body)).toMatchObject({ undone: true, deleted: true });
        // Delete is CONDITIONAL on the state the decision was based on — a
        // concurrent rename/override between read and delete must fence it out
        const d = mockDelete.mock.calls[0][0] as Record<string, any>;
        expect(d.ConditionExpression).toBe('#src = :manual AND attribute_not_exists(previousClassification) AND attribute_not_exists(displayName)');
    });

    it('undo delete race: a rename landing between read and delete re-dispatches into the neutralize branch', async () => {
        const bare = { orgName: 'v-abc123', organizationType: 'enterprise', isTargetCustomer: true, confidence: 1, reason: 'Manual', source: 'manual' };
        mockGet.mockResolvedValueOnce({ Item: bare }); // initial read: deletable
        const conflict = new Error('conditional');
        conflict.name = 'ConditionalCheckFailedException';
        mockDelete.mockRejectedValueOnce(conflict); // rename landed displayName meanwhile
        mockGet.mockResolvedValueOnce({ Item: { ...bare, displayName: 'InnateControl visitor' } }); // re-read

        const res = await handler(makeEvent({ action: 'undo', orgName: 'v-abc123' }), {} as never, vi.fn());

        expect(res.statusCode).toBe(200);
        // Second dispatch neutralized instead of deleting — rename survives
        expect(mockUpdate).toHaveBeenCalledTimes(1);
        expect(JSON.parse(res.body)).toMatchObject({ undone: true, deleted: false, displayName: 'InnateControl visitor' });
    });

    it('undo delete race: record vanishing concurrently reports the reached goal state', async () => {
        const bare = { orgName: 'v-abc123', organizationType: 'enterprise', isTargetCustomer: true, confidence: 1, reason: 'Manual', source: 'manual' };
        mockGet.mockResolvedValueOnce({ Item: bare });
        const conflict = new Error('conditional');
        conflict.name = 'ConditionalCheckFailedException';
        mockDelete.mockRejectedValueOnce(conflict);
        mockGet.mockResolvedValueOnce({}); // re-read: gone

        const res = await handler(makeEvent({ action: 'undo', orgName: 'v-abc123' }), {} as never, vi.fn());

        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body)).toMatchObject({ undone: true, deleted: true });
    });

    it('undo exhausting the conflict retries returns a retryable 409', async () => {
        const bare = { orgName: 'v-abc123', organizationType: 'enterprise', isTargetCustomer: true, confidence: 1, reason: 'Manual', source: 'manual' };
        const conflict = () => Object.assign(new Error('conditional'), { name: 'ConditionalCheckFailedException' });
        mockGet.mockResolvedValue({ Item: bare }); // every read: still deletable
        mockDelete.mockRejectedValue(conflict()); // every delete: fenced out

        const res = await handler(makeEvent({ action: 'undo', orgName: 'v-abc123' }), {} as never, vi.fn());

        expect(res.statusCode).toBe(409);
        expect(JSON.parse(res.body).error).toContain('Conflict');
    });
});

describe('classify-org security-proxy short-circuit', () => {
    it('returns deterministic corporate_proxy without AI and without caching', async () => {
        mockGet.mockResolvedValue({}); // cache miss
        const res = await handler(makeEvent({ orgName: 'Menlo Security, Inc.', city: 'Taipei', country: 'TW' }), {} as never, vi.fn());
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.organizationType).toBe('corporate_proxy');
        expect(body.isTargetCustomer).toBe(false);
        expect(body.confidence).toBe(1.0);
        // Deterministic — never written to the AI cache
        expect(mockPut).not.toHaveBeenCalled();
    });

    it('beats a stale AI cache entry (pre-fix "enterprise" classification)', async () => {
        mockGet.mockResolvedValue({ Item: {
            orgName: 'Menlo Security, Inc.', organizationType: 'enterprise',
            isTargetCustomer: false, confidence: 0.95,
            reason: 'cybersecurity company, does not conduct R&D', source: 'ai',
        } });
        const res = await handler(makeEvent({ orgName: 'Menlo Security, Inc.' }), {} as never, vi.fn());
        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body).organizationType).toBe('corporate_proxy');
    });

    it('manual override still wins over the short-circuit', async () => {
        mockGet.mockResolvedValue({ Item: {
            orgName: 'Zscaler, Inc.', organizationType: 'enterprise',
            isTargetCustomer: true, confidence: 1,
            reason: 'admin says so', source: 'manual',
        } });
        const res = await handler(makeEvent({ orgName: 'Zscaler, Inc.' }), {} as never, vi.fn());
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.organizationType).toBe('enterprise');
        expect(body.source).toBe('manual');
    });
});
