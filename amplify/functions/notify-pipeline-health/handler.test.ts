import { describe, it, expect, vi, beforeEach } from 'vitest';

const ddbQueryMock = vi.fn();
const ddbBatchGetMock = vi.fn();
const ddbPutMock = vi.fn().mockResolvedValue({});
const sesSendMock = vi.fn().mockResolvedValue({ MessageId: 'm1' });

vi.mock('@aws-sdk/client-dynamodb', () => ({ DynamoDBClient: vi.fn().mockImplementation(() => ({})) }));
vi.mock('@aws-sdk/lib-dynamodb', () => ({
    DynamoDBDocumentClient: { from: () => ({
        send: (cmd: any) => {
            if (cmd.__cmd === 'Query') return ddbQueryMock(cmd);
            if (cmd.__cmd === 'BatchGet') return ddbBatchGetMock(cmd);
            if (cmd.__cmd === 'Put') return ddbPutMock(cmd);
            return Promise.resolve({});
        },
    }) },
    QueryCommand: vi.fn().mockImplementation((args) => ({ __cmd: 'Query', input: args })),
    BatchGetCommand: vi.fn().mockImplementation((args) => ({ __cmd: 'BatchGet', input: args })),
    PutCommand: vi.fn().mockImplementation((args) => ({ __cmd: 'Put', ...args })),
}));
vi.mock('@aws-sdk/client-sesv2', () => ({
    SESv2Client: vi.fn().mockImplementation(() => ({ send: (cmd: any) => sesSendMock(cmd) })),
    SendEmailCommand: vi.fn().mockImplementation((args) => ({ __cmd: 'SendEmail', ...args })),
}));

vi.stubEnv('INTELLIGENCE_TABLE', 'IntelligenceTable-test');
vi.stubEnv('ALERT_EMAIL_TO', 'info@ninescrolls.com');
vi.stubEnv('ALERT_EMAIL_FROM', 'info@ninescrolls.com');
vi.stubEnv('ZERO_FETCH_ALERT_SOURCES', 'sam,ted,calusource');

beforeEach(() => {
    ddbQueryMock.mockReset();
    ddbBatchGetMock.mockReset();
    ddbPutMock.mockReset();
    ddbPutMock.mockResolvedValue({});
    sesSendMock.mockClear();
});

function summary(overrides: Partial<any> = {}): any {
    return {
        PK: 'RUN#' + (overrides.executionId ?? 'e'),
        SK: 'SUMMARY',
        executionId: overrides.executionId ?? 'e',
        startedAt: '2026-05-27T02:00:00.000Z',
        endedAt: '2026-05-27T02:02:00.000Z',
        durationMs: 120000,
        status: 'SUCCESS',
        notificationStatus: 'SUCCESS',
        notificationError: null,
        sourcesAttempted: ['sam', 'ted', 'calusource'],
        sourcesSucceeded: ['sam', 'ted', 'calusource'],
        sourcesFailed: [],
        totalFetched: 147,
        totalHighPriority: 0,
        stepFunctionExecutionArn: 'arn:aws:states:us-east-2:1:execution:tw:e',
        ...overrides,
    };
}

function sourceRow(src: string, overrides: Partial<any> = {}): any {
    return {
        PK: 'RUN#e',
        SK: 'SOURCE#' + src,
        source: src,
        status: 'SUCCESS',
        fetched: 10,
        normalized: 10,
        prefilterCandidates: 0,
        scored: 0,
        highPriority: 0,
        llmAttemptedCount: 0,
        llmTimeoutCount: 0,
        llmErrorCount: 0,
        ...overrides,
    };
}

describe('notify-pipeline-health', () => {
    it('Rule 1: no run in 48h sends CRITICAL email', async () => {
        ddbQueryMock.mockResolvedValueOnce({ Items: [] });
        const { handler } = await import('./handler');
        await handler({});
        expect(sesSendMock).toHaveBeenCalledTimes(1);
        const body = sesSendMock.mock.calls[0][0].Content.Simple.Body.Text.Data;
        expect(body).toMatch(/no pipeline run/i);
        expect(sesSendMock.mock.calls[0][0].Content.Simple.Subject.Data).toMatch(/CRITICAL/);
    });

    it('Rule 2: latest FAILED sends CRITICAL email', async () => {
        ddbQueryMock.mockResolvedValueOnce({ Items: [summary({ status: 'FAILED', lastError: 'normalize crash' })] });
        const { handler } = await import('./handler');
        await handler({});
        const body = sesSendMock.mock.calls[0][0].Content.Simple.Body.Text.Data;
        expect(body).toMatch(/FAILED/);
        expect(body).toMatch(/normalize crash/);
    });

    it('Rule 5: source SUCCESS but fetched=0 sends CRITICAL email', async () => {
        ddbQueryMock.mockResolvedValueOnce({ Items: [summary()] });
        ddbBatchGetMock.mockResolvedValueOnce({ Responses: { 'IntelligenceTable-test': [
            sourceRow('sam'),
            sourceRow('ted', { fetched: 0 }),
            sourceRow('calusource'),
        ] } });
        const { handler } = await import('./handler');
        await handler({});
        const body = sesSendMock.mock.calls[0][0].Content.Simple.Body.Text.Data;
        expect(body).toMatch(/ted.*0 records/i);
    });

    it('Healthy run sends no email', async () => {
        ddbQueryMock.mockResolvedValueOnce({ Items: [summary()] });
        ddbBatchGetMock.mockResolvedValueOnce({ Responses: { 'IntelligenceTable-test': [
            sourceRow('sam'), sourceRow('ted'), sourceRow('calusource'),
        ] } });
        const { handler } = await import('./handler');
        await handler({});
        expect(sesSendMock).not.toHaveBeenCalled();
    });

    it('Idempotency: second invocation same day same scope sends no duplicate', async () => {
        ddbQueryMock.mockResolvedValue({ Items: [summary({ status: 'FAILED', lastError: 'crash' })] });
        ddbPutMock.mockResolvedValueOnce({}).mockRejectedValueOnce(Object.assign(new Error('cond'), { name: 'ConditionalCheckFailedException' }));
        const { handler } = await import('./handler');
        await handler({});
        await handler({});
        expect(sesSendMock).toHaveBeenCalledTimes(1);
    });
});
