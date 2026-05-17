import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@aws-sdk/client-dynamodb', () => ({
    DynamoDBClient: vi.fn().mockImplementation(() => ({})),
}));
vi.mock('@aws-sdk/lib-dynamodb', () => ({
    DynamoDBDocumentClient: {
        from: vi.fn().mockReturnValue({ send: vi.fn().mockResolvedValue({}) }),
    },
    GetCommand: class { input: any; constructor(i: any) { this.input = i; } },
    PutCommand: class { input: any; constructor(i: any) { this.input = i; } },
    UpdateCommand: class { input: any; constructor(i: any) { this.input = i; } },
    QueryCommand: class { input: any; constructor(i: any) { this.input = i; } },
    BatchGetCommand: class { input: any; constructor(i: any) { this.input = i; } },
}));
vi.mock('@aws-sdk/client-bedrock-runtime', () => ({
    BedrockRuntimeClient: vi.fn().mockImplementation(() => ({ send: vi.fn() })),
    InvokeModelCommand: class { input: any; constructor(i: any) { this.input = i; } },
}));
vi.mock('@anthropic-ai/sdk', () => ({
    default: class { messages = { create: vi.fn() }; },
    Anthropic: class { messages = { create: vi.fn() }; },
}));

vi.stubEnv('INTELLIGENCE_TABLE', 'NineScrollsIntelligence-test');

beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
});

describe('tender-api dispatcher', () => {
    it('throws when AppSync identity is missing admin group', async () => {
        const { handler } = await import('./handler');
        await expect(handler({
            info: { fieldName: 'listTenders' },
            arguments: {},
            identity: { username: 'user1', groups: ['user'] },
        } as any)).rejects.toThrow(/admin group required/);
    });

    it('throws on unknown fieldName when admin', async () => {
        const { handler } = await import('./handler');
        await expect(handler({
            info: { fieldName: 'bogusOp' },
            arguments: {},
            identity: { username: 'admin1', groups: ['admin'] },
        } as any)).rejects.toThrow(/Unknown fieldName/);
    });

    it('reads fieldName from event root when info is absent (Amplify Gen 2 shape)', async () => {
        const { handler } = await import('./handler');
        await expect(handler({
            fieldName: 'bogusOp',
            arguments: {},
            identity: { username: 'admin1', groups: ['admin'] },
        } as any)).rejects.toThrow(/Unknown fieldName/);
    });
});

describe('listTenders', () => {
    it('queries GSI1 per requested status and merges results', async () => {
        const docMock = await import('@aws-sdk/lib-dynamodb');
        const sendMock = vi.fn();
        (docMock.DynamoDBDocumentClient.from as any).mockReturnValue({ send: sendMock });

        // Two parallel Queries (one per status)
        sendMock.mockResolvedValueOnce({ Items: [
            { tenderId: 't1', status: 'new', overallScore: 85, postedDate: '2026-05-10', country: 'US', title: 'A', agency: 'A' },
        ] });
        sendMock.mockResolvedValueOnce({ Items: [
            { tenderId: 't2', status: 'reviewing', overallScore: 70, postedDate: '2026-05-09', country: 'DE', title: 'B', agency: 'B' },
        ] });
        // totalActiveUnfiltered COUNT queries (4 active statuses × 1 each)
        sendMock.mockResolvedValue({ Count: 0 });

        const { handler } = await import('./handler');
        const result = await handler({
            info: { fieldName: 'listTenders' },
            arguments: { statuses: ['new', 'reviewing'], limit: 25 },
            identity: { username: 'admin', groups: ['admin'] },
        } as any);

        expect((result as any).items.length).toBe(2);
        // Default sort: score DESC
        expect((result as any).items[0].tenderId).toBe('t1');
    });

    it('filters by country in-memory', async () => {
        const docMock = await import('@aws-sdk/lib-dynamodb');
        const sendMock = vi.fn();
        (docMock.DynamoDBDocumentClient.from as any).mockReturnValue({ send: sendMock });

        sendMock.mockResolvedValueOnce({ Items: [
            { tenderId: 't1', status: 'new', overallScore: 85, country: 'US', title: 'A', agency: 'A' },
            { tenderId: 't2', status: 'new', overallScore: 80, country: 'DE', title: 'B', agency: 'B' },
        ] });
        sendMock.mockResolvedValue({ Count: 0 });

        const { handler } = await import('./handler');
        const result = await handler({
            info: { fieldName: 'listTenders' },
            arguments: { statuses: ['new'], countries: ['US'] },
            identity: { username: 'admin', groups: ['admin'] },
        } as any);

        expect((result as any).items.map((i: any) => i.tenderId)).toEqual(['t1']);
    });
});

describe('getTender', () => {
    it('returns bundle with tender + matches + log', async () => {
        const docMock = await import('@aws-sdk/lib-dynamodb');
        const sendMock = vi.fn();
        (docMock.DynamoDBDocumentClient.from as any).mockReturnValue({ send: sendMock });

        // GetCommand META
        sendMock.mockResolvedValueOnce({ Item: { tenderId: 't1', title: 'X', agency: 'A', source: 'ted', sourceUrl: 'http://x' } });
        // Query matches
        sendMock.mockResolvedValueOnce({ Items: [
            { tenderId: 't1', productSlug: 'ald-system', score: 85, reasoning: 'good fit' },
        ] });
        // Query log
        sendMock.mockResolvedValueOnce({ Items: [
            { tenderId: 't1', toStatus: 'new', changedBy: 'cron', changedAt: '2026-05-10T00:00:00Z' },
        ] });

        const { handler } = await import('./handler');
        const result: any = await handler({
            info: { fieldName: 'getTender' },
            arguments: { tenderId: 't1' },
            identity: { username: 'admin', groups: ['admin'] },
        } as any);

        expect(result.tender.tenderId).toBe('t1');
        expect(result.matches).toHaveLength(1);
        expect(result.log).toHaveLength(1);
    });

    it('throws 404 when tender META missing', async () => {
        const docMock = await import('@aws-sdk/lib-dynamodb');
        const sendMock = vi.fn();
        (docMock.DynamoDBDocumentClient.from as any).mockReturnValue({ send: sendMock });
        sendMock.mockResolvedValueOnce({ Item: undefined });

        const { handler } = await import('./handler');
        await expect(handler({
            info: { fieldName: 'getTender' },
            arguments: { tenderId: 'ghost' },
            identity: { username: 'admin', groups: ['admin'] },
        } as any)).rejects.toThrow(/not found/);
    });
});

describe('listTenderKeywordConfigs', () => {
    it('queries GSI1 by default (active only)', async () => {
        const docMock = await import('@aws-sdk/lib-dynamodb');
        const sendMock = vi.fn();
        (docMock.DynamoDBDocumentClient.from as any).mockReturnValue({ send: sendMock });
        sendMock.mockResolvedValueOnce({ Items: [
            { productCategory: 'ALD', isActive: true, keywords: ['atomic'], synonyms: [], blacklist: [], productSlugs: ['ald-system'], naicsCodes: [], cpvCodes: [] },
        ] });

        const { handler } = await import('./handler');
        const result: any = await handler({
            info: { fieldName: 'listTenderKeywordConfigs' },
            arguments: {},
            identity: { username: 'admin', groups: ['admin'] },
        } as any);

        expect(result.length).toBe(1);
        // Verify GSI1 was used
        const cmd = sendMock.mock.calls[0][0];
        expect(cmd.input.IndexName).toBe('GSI1');
    });

    it('queries base table when includeInactive=true', async () => {
        const docMock = await import('@aws-sdk/lib-dynamodb');
        const sendMock = vi.fn();
        (docMock.DynamoDBDocumentClient.from as any).mockReturnValue({ send: sendMock });
        sendMock.mockResolvedValueOnce({ Items: [
            { productCategory: 'ALD', isActive: true, keywords: [], synonyms: [], blacklist: [], productSlugs: [], naicsCodes: [], cpvCodes: [] },
            { productCategory: 'Old', isActive: false, keywords: [], synonyms: [], blacklist: [], productSlugs: [], naicsCodes: [], cpvCodes: [] },
        ] });

        const { handler } = await import('./handler');
        const result: any = await handler({
            info: { fieldName: 'listTenderKeywordConfigs' },
            arguments: { includeInactive: true },
            identity: { username: 'admin', groups: ['admin'] },
        } as any);

        expect(result.length).toBe(2);
        const cmd = sendMock.mock.calls[0][0];
        expect(cmd.input.IndexName).toBeUndefined();
    });
});

describe('updateTenderStatus', () => {
    it('updates status + writes log entry on success', async () => {
        const docMock = await import('@aws-sdk/lib-dynamodb');
        const sendMock = vi.fn();
        (docMock.DynamoDBDocumentClient.from as any).mockReturnValue({ send: sendMock });
        // GetCommand current META
        sendMock.mockResolvedValueOnce({ Item: { tenderId: 't1', status: 'new', updatedAt: '2026-05-10T00:00:00Z' } });
        // UpdateCommand
        sendMock.mockResolvedValueOnce({ Attributes: { tenderId: 't1', status: 'reviewing', updatedAt: '2026-05-11T00:00:00Z' } });
        // PutCommand log
        sendMock.mockResolvedValueOnce({});

        const { handler } = await import('./handler');
        const result: any = await handler({
            info: { fieldName: 'updateTenderStatus' },
            arguments: { tenderId: 't1', toStatus: 'reviewing', note: 'looks promising' },
            identity: { username: 'admin', groups: ['admin'] },
        } as any);

        expect(result.status).toBe('reviewing');
        // Verify log PutCommand was made
        const putCmds = sendMock.mock.calls.filter((c: any) => c[0].constructor.name === 'PutCommand');
        expect(putCmds.length).toBeGreaterThanOrEqual(1);
    });

    it('throws Conflict on ConditionalCheckFailedException', async () => {
        const docMock = await import('@aws-sdk/lib-dynamodb');
        const sendMock = vi.fn();
        (docMock.DynamoDBDocumentClient.from as any).mockReturnValue({ send: sendMock });
        sendMock.mockResolvedValueOnce({ Item: { tenderId: 't1', status: 'new', updatedAt: '2026-05-10T00:00:00Z' } });
        const ccfe = new Error('CCFE');
        (ccfe as any).name = 'ConditionalCheckFailedException';
        sendMock.mockRejectedValueOnce(ccfe);

        const { handler } = await import('./handler');
        await expect(handler({
            info: { fieldName: 'updateTenderStatus' },
            arguments: { tenderId: 't1', toStatus: 'reviewing' },
            identity: { username: 'admin', groups: ['admin'] },
        } as any)).rejects.toThrow(/Conflict|modified/);
    });

    it('updates assignedTo when provided alongside status', async () => {
        const docMock = await import('@aws-sdk/lib-dynamodb');
        const sendMock = vi.fn();
        (docMock.DynamoDBDocumentClient.from as any).mockReturnValue({ send: sendMock });
        sendMock.mockResolvedValueOnce({ Item: { tenderId: 't1', status: 'new', updatedAt: '2026-05-10T00:00:00Z' } });
        sendMock.mockResolvedValueOnce({ Attributes: { tenderId: 't1', status: 'pursuing', assignedTo: 'alice' } });
        sendMock.mockResolvedValueOnce({});

        const { handler } = await import('./handler');
        const result: any = await handler({
            info: { fieldName: 'updateTenderStatus' },
            arguments: { tenderId: 't1', toStatus: 'pursuing', assignedTo: 'alice' },
            identity: { username: 'admin', groups: ['admin'] },
        } as any);

        expect(result.assignedTo).toBe('alice');
    });
});

describe('bulkUpdateTenderStatus', () => {
    it('updates each tender and returns success count', async () => {
        const docMock = await import('@aws-sdk/lib-dynamodb');
        const sendMock = vi.fn();
        (docMock.DynamoDBDocumentClient.from as any).mockReturnValue({ send: sendMock });
        // For each tender: Get + Update + Put = 3 calls
        for (const tid of ['t1', 't2']) {
            sendMock.mockResolvedValueOnce({ Item: { tenderId: tid, status: 'new', updatedAt: '2026-05-10T00:00:00Z' } });
            sendMock.mockResolvedValueOnce({ Attributes: {} });
            sendMock.mockResolvedValueOnce({});
        }

        const { handler } = await import('./handler');
        const result = await handler({
            info: { fieldName: 'bulkUpdateTenderStatus' },
            arguments: { tenderIds: ['t1', 't2'], toStatus: 'reviewing' },
            identity: { username: 'admin', groups: ['admin'] },
        } as any);

        expect(result).toBe(2);
    });

    it('throws when more than 50 ids are passed', async () => {
        const { handler } = await import('./handler');
        await expect(handler({
            info: { fieldName: 'bulkUpdateTenderStatus' },
            arguments: { tenderIds: Array.from({ length: 51 }, (_, i) => `t${i}`), toStatus: 'reviewing' },
            identity: { username: 'admin', groups: ['admin'] },
        } as any)).rejects.toThrow(/bulk update limit/);
    });
});

describe('upsertTenderKeywordConfig', () => {
    it('writes config with GSI1 active key when isActive', async () => {
        const docMock = await import('@aws-sdk/lib-dynamodb');
        const sendMock = vi.fn();
        (docMock.DynamoDBDocumentClient.from as any).mockReturnValue({ send: sendMock });
        sendMock.mockResolvedValueOnce({});

        const { handler } = await import('./handler');
        await handler({
            info: { fieldName: 'upsertTenderKeywordConfig' },
            arguments: {
                productCategory: 'ALD',
                productSlugs: ['ald-system'],
                keywords: ['ALD'],
                synonyms: ['atomic layer deposition'],
                blacklist: [],
                naicsCodes: [],
                cpvCodes: [],
                isActive: true,
            },
            identity: { username: 'admin', groups: ['admin'] },
        } as any);

        const put = sendMock.mock.calls[0][0];
        expect(put.input.Item.GSI1PK).toBe('TENDER_KEYWORD_CONFIG_ACTIVE');
    });

    it('omits GSI1 key when isActive=false', async () => {
        const docMock = await import('@aws-sdk/lib-dynamodb');
        const sendMock = vi.fn();
        (docMock.DynamoDBDocumentClient.from as any).mockReturnValue({ send: sendMock });
        sendMock.mockResolvedValueOnce({});

        const { handler } = await import('./handler');
        await handler({
            info: { fieldName: 'upsertTenderKeywordConfig' },
            arguments: {
                productCategory: 'OldCat',
                productSlugs: [], keywords: [], synonyms: [], blacklist: [], naicsCodes: [], cpvCodes: [],
                isActive: false,
            },
            identity: { username: 'admin', groups: ['admin'] },
        } as any);

        const put = sendMock.mock.calls[0][0];
        expect(put.input.Item.GSI1PK).toBeUndefined();
    });
});

describe('runPrefilterPreview', () => {
    it('uses configOverride when provided', async () => {
        const docMock = await import('@aws-sdk/lib-dynamodb');
        const sendMock = vi.fn();
        (docMock.DynamoDBDocumentClient.from as any).mockReturnValue({ send: sendMock });

        const { handler } = await import('./handler');
        const result: any = await handler({
            info: { fieldName: 'runPrefilterPreview' },
            arguments: {
                title: 'atomic layer deposition tool',
                description: '',
                configOverride: {
                    productCategory: 'ALD',
                    productSlugs: ['ald-system'],
                    keywords: ['atomic layer deposition'],
                    synonyms: [],
                    blacklist: [],
                    naicsCodes: [],
                    cpvCodes: [],
                    isActive: true,
                },
            },
            identity: { username: 'admin', groups: ['admin'] },
        } as any);

        expect(result.passed).toBe(true);
        expect(result.matchedCategories).toEqual(['ALD']);
    });

    it('loads saved active configs when configOverride is omitted', async () => {
        const docMock = await import('@aws-sdk/lib-dynamodb');
        const sendMock = vi.fn();
        (docMock.DynamoDBDocumentClient.from as any).mockReturnValue({ send: sendMock });
        sendMock.mockResolvedValueOnce({ Items: [
            { productCategory: 'PECVD', isActive: true, keywords: ['PECVD'], synonyms: [], blacklist: [], naicsCodes: [], cpvCodes: [], productSlugs: ['p1'] },
        ] });

        const { handler } = await import('./handler');
        const result: any = await handler({
            info: { fieldName: 'runPrefilterPreview' },
            arguments: { title: 'PECVD reactor for university', description: '' },
            identity: { username: 'admin', groups: ['admin'] },
        } as any);

        expect(result.passed).toBe(true);
        expect(result.matchedCategories).toEqual(['PECVD']);
    });
});

describe('translateTenderDescription', () => {
    function bedrockBody(text: string) {
        const wrap = JSON.stringify({ content: [{ type: 'text', text }] });
        return { body: { transformToString: vi.fn().mockResolvedValue(wrap) } };
    }

    it('returns cached descriptionEn without calling Bedrock', async () => {
        const docMock = await import('@aws-sdk/lib-dynamodb');
        const sendMock = vi.fn();
        (docMock.DynamoDBDocumentClient.from as any).mockReturnValue({ send: sendMock });
        sendMock.mockResolvedValueOnce({ Item: { tenderId: 't1', descriptionEn: 'already translated' } });

        const bedrockMock = await import('@aws-sdk/client-bedrock-runtime');
        const bedrockSend = vi.fn();
        (bedrockMock.BedrockRuntimeClient as any).mockImplementation(() => ({ send: bedrockSend }));

        const { handler } = await import('./handler');
        const result = await handler({
            info: { fieldName: 'translateTenderDescription' },
            arguments: { tenderId: 't1' },
            identity: { username: 'admin', groups: ['admin'] },
        } as any);

        expect(result).toBe('already translated');
        expect(bedrockSend).not.toHaveBeenCalled();
    });

    it('translates via Bedrock when no cached value and updates item', async () => {
        const docMock = await import('@aws-sdk/lib-dynamodb');
        const sendMock = vi.fn();
        (docMock.DynamoDBDocumentClient.from as any).mockReturnValue({ send: sendMock });
        sendMock.mockResolvedValueOnce({ Item: { tenderId: 't1', description: 'Descrizione tecnica', language: 'it' } });
        sendMock.mockResolvedValueOnce({});  // UpdateCommand to cache

        const bedrockMock = await import('@aws-sdk/client-bedrock-runtime');
        const bedrockSend = vi.fn().mockResolvedValueOnce(bedrockBody('Technical description'));
        (bedrockMock.BedrockRuntimeClient as any).mockImplementation(() => ({ send: bedrockSend }));

        const { handler } = await import('./handler');
        const result = await handler({
            info: { fieldName: 'translateTenderDescription' },
            arguments: { tenderId: 't1' },
            identity: { username: 'admin', groups: ['admin'] },
        } as any);

        expect(result).toBe('Technical description');
        expect(bedrockSend).toHaveBeenCalled();
    });

    it('force=true re-translates even when cached', async () => {
        const docMock = await import('@aws-sdk/lib-dynamodb');
        const sendMock = vi.fn();
        (docMock.DynamoDBDocumentClient.from as any).mockReturnValue({ send: sendMock });
        sendMock.mockResolvedValueOnce({ Item: { tenderId: 't1', description: 'src', language: 'it', descriptionEn: 'stale' } });
        sendMock.mockResolvedValueOnce({});

        const bedrockMock = await import('@aws-sdk/client-bedrock-runtime');
        const bedrockSend = vi.fn().mockResolvedValueOnce(bedrockBody('fresh'));
        (bedrockMock.BedrockRuntimeClient as any).mockImplementation(() => ({ send: bedrockSend }));

        const { handler } = await import('./handler');
        const result = await handler({
            info: { fieldName: 'translateTenderDescription' },
            arguments: { tenderId: 't1', force: true },
            identity: { username: 'admin', groups: ['admin'] },
        } as any);

        expect(result).toBe('fresh');
    });
});
