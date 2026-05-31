import { describe, it, expect, vi, beforeEach } from 'vitest';

const ddbPutMock = vi.fn().mockResolvedValue({});
vi.mock('@aws-sdk/client-dynamodb', () => ({
    DynamoDBClient: vi.fn().mockImplementation(() => ({})),
}));
vi.mock('@aws-sdk/lib-dynamodb', () => ({
    DynamoDBDocumentClient: { from: () => ({ send: (cmd: any) => ddbPutMock(cmd) }) },
    PutCommand: vi.fn().mockImplementation((args) => ({ __cmd: 'Put', ...args })),
}));

vi.stubEnv('INTELLIGENCE_TABLE', 'IntelligenceTable-test');

beforeEach(() => {
    ddbPutMock.mockReset();
    ddbPutMock.mockResolvedValue({});
});

describe('record-pipeline-run', () => {
    it('writes SUMMARY + 3 SOURCE rows on COMPLETE happy path with both notifies sent', async () => {
        const { handler } = await import('./handler');
        await handler({
            kind: 'COMPLETE',
            executionId: 'exec-1',
            startedAt: '2026-05-27T02:00:00.000Z',
            endedAt: '2026-05-27T02:02:14.000Z',
            stepFunctionExecutionArn: 'arn:aws:states:us-east-2:1:execution:tw:exec-1',
            fetchResults: [
                { source: 'sam', fetched: 11, stagedKey: 'k/sam' },
                { source: 'ted', fetched: 124, stagedKey: 'k/ted' },
                { source: 'calusource', fetched: 12, stagedKey: 'k/cal' },
                { source: 'uofa', fetched: 0, stagedKey: 'k/uofa' },
                { source: 'txesbd', fetched: 0, stagedKey: 'k/txesbd' },
                { source: 'nyscr', fetched: 0, stagedKey: 'k/nyscr' },
            ],
            normalized: {
                newTenderIds: [],
                skipped: 0,
                perSource: {
                    sam: { fetched: 11, normalized: 9, duplicates: 2 },
                    ted: { fetched: 124, normalized: 100, duplicates: 24 },
                    calusource: { fetched: 12, normalized: 12, duplicates: 0 },
                    uofa: { fetched: 0, normalized: 0, duplicates: 0 },
                },
            },
            prefilter: { candidates: [], candidatesCount: 12, perSource: { sam: { candidates: 8 }, ted: { candidates: 2 }, calusource: { candidates: 2 }, uofa: { candidates: 0 } } },
            matches: [
                { tenderId: 't1', source: 'sam', matches: [{ productSlug: 'rie-etcher', productCategory: 'RIE-ICP', score: 95 }], attempted: 1, llmTimeout: false, llmError: false },
                { tenderId: 't2', source: 'ted', matches: [], attempted: 1, llmTimeout: false, llmError: false },
                { tenderId: 't3', source: 'calusource', matches: [], attempted: 1, llmTimeout: false, llmError: false },
            ],
            classified: { tendersUpdated: 1, highPriorityTenderIds: ['t1'], digestTenderIds: ['t1'] },
            notifyHp: { status: 'sent', count: 1 },
            notifyDigest: { status: 'sent', count: 1 },
        });

        expect(ddbPutMock).toHaveBeenCalledTimes(7);
        const items = ddbPutMock.mock.calls.map(c => c[0].Item);
        const summary = items.find(i => i.SK === 'SUMMARY');
        expect(summary.status).toBe('SUCCESS');
        expect(summary.notificationStatus).toBe('SUCCESS');
        expect(summary.GSI5PK).toBe('PIPELINE_RUNS');
        expect(summary.GSI5SK).toBe('2026-05-27T02:00:00.000Z#exec-1');
        expect(summary.totalFetched).toBe(147);
        expect(summary.totalHighPriority).toBe(1);

        const samRow = items.find(i => i.SK === 'SOURCE#sam');
        expect(samRow.fetched).toBe(11);
        expect(samRow.normalized).toBe(9);
        expect(samRow.prefilterCandidates).toBe(8);
        expect(samRow.llmAttemptedCount).toBe(1);
        expect(samRow.llmAvgScore).toBe(95);
        expect(samRow.completedStages).toEqual(['fetch', 'normalize', 'prefilter', 'match', 'classify', 'notify']);
        expect(samRow.notified).toBe(1);
    });

    it('marks sources missing from fetchResults as failed (defensive)', async () => {
        const { handler } = await import('./handler');
        await handler({
            kind: 'COMPLETE',
            executionId: 'exec-miss',
            startedAt: '2026-05-27T02:00:00.000Z',
            endedAt: '2026-05-27T02:01:00.000Z',
            stepFunctionExecutionArn: 'arn:..',
            fetchResults: [{ source: 'sam', fetched: 1, stagedKey: 'k' }, { source: 'ted', fetched: 1, stagedKey: 'k' }],
            normalized: { newTenderIds: [], skipped: 0, perSource: {} },
            prefilter: { candidates: [], candidatesCount: 0, perSource: {} },
            matches: [],
            classified: { tendersUpdated: 0, highPriorityTenderIds: [], digestTenderIds: [] },
            notifyHp: { status: 'skipped' },
            notifyDigest: { status: 'skipped' },
        });
        const summary = ddbPutMock.mock.calls.map(c => c[0].Item).find(i => i.SK === 'SUMMARY');
        expect(summary.sourcesAttempted).toEqual(['sam', 'ted', 'calusource', 'uofa', 'txesbd', 'nyscr']);
        expect(summary.sourcesFailed).toContain('calusource');
        expect(summary.status).toBe('PARTIAL');
    });

    it('writes status=PARTIAL when one source failed', async () => {
        const { handler } = await import('./handler');
        await handler({
            kind: 'COMPLETE',
            executionId: 'exec-2',
            startedAt: '2026-05-27T02:00:00.000Z',
            endedAt: '2026-05-27T02:01:00.000Z',
            stepFunctionExecutionArn: 'arn:..',
            fetchResults: [
                { source: 'sam', fetched: 11, stagedKey: 'k/sam' },
                { source: 'ted', fetched: 0, stagedKey: null, errorName: 'Timeout', errorCause: 'after 30s' },
                { source: 'calusource', fetched: 12, stagedKey: 'k/cal' },
                { source: 'uofa', fetched: 3, stagedKey: 'k/uofa' },
                { source: 'txesbd', fetched: 5, stagedKey: 'k/txesbd' },
                { source: 'nyscr', fetched: 2, stagedKey: 'k/nyscr' },
            ],
            normalized: { newTenderIds: [], skipped: 0, perSource: {} },
            prefilter: { candidates: [], candidatesCount: 0, perSource: {} },
            matches: [],
            classified: { tendersUpdated: 0, highPriorityTenderIds: [], digestTenderIds: [] },
            notifyHp: { status: 'skipped' },
            notifyDigest: { status: 'skipped' },
        });

        const items = ddbPutMock.mock.calls.map(c => c[0].Item);
        const summary = items.find(i => i.SK === 'SUMMARY');
        expect(summary.status).toBe('PARTIAL');
        expect(summary.sourcesFailed).toEqual(['ted']);
        expect(summary.sourcesSucceeded).toEqual(['sam', 'calusource', 'uofa', 'txesbd', 'nyscr']);
        expect(summary.notificationStatus).toBe('SKIPPED');
    });

    it('writes notificationStatus=PARTIAL when one notify failed and one sent', async () => {
        const { handler } = await import('./handler');
        await handler({
            kind: 'COMPLETE',
            executionId: 'exec-3',
            startedAt: '2026-05-27T02:00:00.000Z',
            endedAt: '2026-05-27T02:01:00.000Z',
            stepFunctionExecutionArn: 'arn:..',
            fetchResults: [
                { source: 'sam', fetched: 1, stagedKey: 'k' },
                { source: 'ted', fetched: 1, stagedKey: 'k' },
                { source: 'calusource', fetched: 1, stagedKey: 'k' },
            ],
            normalized: { newTenderIds: [], skipped: 0, perSource: {} },
            prefilter: { candidates: [], candidatesCount: 0, perSource: {} },
            matches: [],
            classified: { tendersUpdated: 0, highPriorityTenderIds: [], digestTenderIds: [] },
            notifyHp: { status: 'failed', error: 'SES quota' },
            notifyDigest: { status: 'sent', count: 3 },
        });
        const summary = ddbPutMock.mock.calls.map(c => c[0].Item).find(i => i.SK === 'SUMMARY');
        expect(summary.notificationStatus).toBe('PARTIAL');
        expect(summary.notificationError).toContain('SES quota');
    });

    it('writes notified=null when fetch succeeded but notify failed', async () => {
        const { handler } = await import('./handler');
        await handler({
            kind: 'COMPLETE',
            executionId: 'exec-notify-failed',
            startedAt: '2026-05-27T02:00:00.000Z',
            endedAt: '2026-05-27T02:01:00.000Z',
            stepFunctionExecutionArn: 'arn:..',
            fetchResults: [
                { source: 'sam', fetched: 1, stagedKey: 'k' },
                { source: 'ted', fetched: 1, stagedKey: 'k' },
                { source: 'calusource', fetched: 1, stagedKey: 'k' },
            ],
            normalized: { newTenderIds: [], skipped: 0, perSource: {} },
            prefilter: { candidates: [], candidatesCount: 0, perSource: {} },
            matches: [
                { tenderId: 't1', source: 'sam', matches: [{ productSlug: 'x', productCategory: 'X', score: 90 }], attempted: 1, llmTimeout: false, llmError: false },
            ],
            classified: { tendersUpdated: 1, highPriorityTenderIds: ['t1'], digestTenderIds: ['t1'] },
            notifyHp: { status: 'failed', error: 'SES quota' },
            notifyDigest: { status: 'skipped' },
        });
        const samRow = ddbPutMock.mock.calls.map(c => c[0].Item).find(i => i.SK === 'SOURCE#sam');
        expect(samRow.highPriority).toBe(1);
        expect(samRow.notified).toBeNull();
    });

    it('writes completedStages=["fetch"] on a failed source', async () => {
        const { handler } = await import('./handler');
        await handler({
            kind: 'COMPLETE',
            executionId: 'exec-cs',
            startedAt: '2026-05-27T02:00:00.000Z',
            endedAt: '2026-05-27T02:01:00.000Z',
            stepFunctionExecutionArn: 'arn:..',
            fetchResults: [
                { source: 'sam', fetched: 0, stagedKey: null, errorName: 'Timeout', errorCause: 'after 30s' },
                { source: 'ted', fetched: 1, stagedKey: 'k' },
                { source: 'calusource', fetched: 1, stagedKey: 'k' },
            ],
            normalized: { newTenderIds: [], skipped: 0, perSource: {} },
            prefilter: { candidates: [], candidatesCount: 0, perSource: {} },
            matches: [],
            classified: { tendersUpdated: 0, highPriorityTenderIds: [], digestTenderIds: [] },
            notifyHp: { status: 'skipped' },
            notifyDigest: { status: 'skipped' },
        });
        const samRow = ddbPutMock.mock.calls.map(c => c[0].Item).find(i => i.SK === 'SOURCE#sam');
        expect(samRow.completedStages).toEqual(['fetch']);
        expect(samRow.status).toBe('FAILED');
    });

    it('treats Lambda structured-failure return (error field) as FAILED, not SUCCESS-with-zero', async () => {
        // When a fetch-* Lambda catches its own exception and returns
        // { fetched: 0, error: '...' } instead of throwing, the SF Tier-1 Pass
        // node is NOT triggered. Without this fix the SOURCE row was written as
        // status=SUCCESS / fetched=0 — silently masking upstream API regressions.
        const { handler } = await import('./handler');
        await handler({
            kind: 'COMPLETE',
            executionId: 'exec-lambda-error',
            startedAt: '2026-05-27T02:00:00.000Z',
            endedAt: '2026-05-27T02:00:30.000Z',
            stepFunctionExecutionArn: 'arn:..',
            fetchResults: [
                { source: 'sam', fetched: 92, stagedKey: 'k/sam' },
                { source: 'ted', fetched: 129, stagedKey: 'k/ted' },
                { source: 'calusource', fetched: 0, stagedKey: '', error: 'Request failed with status code 404' },
            ],
            normalized: { newTenderIds: [], skipped: 0, perSource: {} },
            prefilter: { candidates: [], candidatesCount: 0, perSource: {} },
            matches: [],
            classified: { tendersUpdated: 0, highPriorityTenderIds: [], digestTenderIds: [] },
            notifyHp: { status: 'skipped' },
            notifyDigest: { status: 'skipped' },
        });
        const items = ddbPutMock.mock.calls.map(c => c[0].Item);
        const summary = items.find(i => i.SK === 'SUMMARY');
        expect(summary.status).toBe('PARTIAL');
        expect(summary.sourcesFailed).toContain('calusource');
        expect(summary.sourcesSucceeded).toEqual(expect.arrayContaining(['sam', 'ted']));
        expect(summary.lastError).toContain('404');

        const calRow = items.find(i => i.SK === 'SOURCE#calusource');
        expect(calRow.status).toBe('FAILED');
        expect(calRow.completedStages).toEqual(['fetch']);
        expect(calRow.errorCause).toContain('404');
    });

    it('treats missing matches as an empty no-candidates run', async () => {
        const { handler } = await import('./handler');
        await handler({
            kind: 'COMPLETE',
            executionId: 'exec-no-candidates',
            startedAt: '2026-05-27T02:00:00.000Z',
            endedAt: '2026-05-27T02:01:00.000Z',
            stepFunctionExecutionArn: 'arn:..',
            fetchResults: [
                { source: 'sam', fetched: 1, stagedKey: 'k' },
                { source: 'ted', fetched: 1, stagedKey: 'k' },
                { source: 'calusource', fetched: 1, stagedKey: 'k' },
                { source: 'uofa', fetched: 1, stagedKey: 'k' },
                { source: 'txesbd', fetched: 1, stagedKey: 'k' },
                { source: 'nyscr', fetched: 1, stagedKey: 'k' },
            ],
            normalized: { newTenderIds: [], skipped: 0, perSource: {} },
            prefilter: { candidates: [], candidatesCount: 0, perSource: {} },
            classified: { tendersUpdated: 0, highPriorityTenderIds: [], digestTenderIds: [] },
            notifyHp: { status: 'skipped' },
            notifyDigest: { status: 'skipped' },
        });
        const summary = ddbPutMock.mock.calls.map(c => c[0].Item).find(i => i.SK === 'SUMMARY');
        expect(summary.status).toBe('SUCCESS');
        expect(summary.totalScored).toBe(0);
    });

    it('writes only SUMMARY on FAILED path', async () => {
        const { handler } = await import('./handler');
        await handler({
            kind: 'FAILED',
            executionId: 'exec-4',
            startedAt: '2026-05-27T02:00:00.000Z',
            endedAt: '2026-05-27T02:00:30.000Z',
            stepFunctionExecutionArn: 'arn:..',
            errorName: 'States.TaskFailed',
            errorCause: 'normalize-dedupe crashed',
        });
        expect(ddbPutMock).toHaveBeenCalledTimes(1);
        const summary = ddbPutMock.mock.calls[0][0].Item;
        expect(summary.SK).toBe('SUMMARY');
        expect(summary.status).toBe('FAILED');
        expect(summary.lastError).toContain('normalize-dedupe crashed');
        expect(summary.totalFetched).toBe(0);
    });

    it('still writes SUMMARY when SOURCE row writes throw on COMPLETE', async () => {
        const { handler } = await import('./handler');
        ddbPutMock.mockResolvedValueOnce({}).mockRejectedValue(new Error('Throughput exceeded'));
        await handler({
            kind: 'COMPLETE',
            executionId: 'exec-5',
            startedAt: '2026-05-27T02:00:00.000Z',
            endedAt: '2026-05-27T02:01:00.000Z',
            stepFunctionExecutionArn: 'arn:..',
            fetchResults: [{ source: 'sam', fetched: 1, stagedKey: 'k' }],
            normalized: { newTenderIds: [], skipped: 0, perSource: { sam: { fetched: 1, normalized: 1, duplicates: 0 } } },
            prefilter: { candidates: [], candidatesCount: 0, perSource: { sam: { candidates: 0 } } },
            matches: [],
            classified: { tendersUpdated: 0, highPriorityTenderIds: [], digestTenderIds: [] },
            notifyHp: { status: 'skipped' },
            notifyDigest: { status: 'skipped' },
        });
        expect(ddbPutMock).toHaveBeenCalledTimes(2);
        expect(ddbPutMock.mock.calls[0][0].Item.SK).toBe('SUMMARY');
    });
});
