import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockScan = vi.fn();
const mockUpdate = vi.fn();
vi.mock('@aws-sdk/client-dynamodb', () => ({ DynamoDBClient: vi.fn().mockImplementation(() => ({})) }));
vi.mock('@aws-sdk/lib-dynamodb', () => ({
    DynamoDBDocumentClient: {
        from: vi.fn().mockReturnValue({
            send: vi.fn().mockImplementation((cmd: any) => {
                const n = cmd.constructor.name;
                if (n === 'ScanCommand') return mockScan(cmd);
                if (n === 'UpdateCommand') return mockUpdate(cmd);
                return Promise.resolve({});
            }),
        }),
    },
    ScanCommand: class { input: any; constructor(input: any) { this.input = input; } },
    UpdateCommand: class { input: any; constructor(input: any) { this.input = input; } },
}));
vi.mock('../../lib/tender-watch/keys', () => ({
    tenderItemKey: (tenderId: string) => ({ PK: `TENDER#${tenderId}`, SK: 'METADATA' }),
}));

vi.stubEnv('INTELLIGENCE_TABLE', 'NineScrollsIntelligence');

beforeEach(() => { mockScan.mockReset(); mockUpdate.mockReset(); });

describe('expire-old-tenders handler', () => {
    it('marks tenders whose deadline is in the past as expired', async () => {
        const past = '2020-01-01';
        const future = '2099-12-31';
        mockScan.mockResolvedValueOnce({
            Items: [
                { tenderId: 'sam-1', deadline: past, isExpired: false },
                { tenderId: 'ted-1', deadline: future, isExpired: false },
                { tenderId: 'sam-2', deadline: null, isExpired: false },
            ],
        });
        mockUpdate.mockResolvedValue({});

        const { handler } = await import('./handler');
        const result = await handler({});

        // The DDB filter excludes future/null deadlines, but tests can pass them anyway —
        // implementation should still only update past-deadline items.
        expect(result.expired).toBe(1);
        expect(mockUpdate).toHaveBeenCalledTimes(1);
        expect(mockUpdate.mock.calls[0][0].input.Key).toEqual({ PK: 'TENDER#sam-1', SK: 'METADATA' });
    });

    it('handles paginated Scan results', async () => {
        mockScan
            .mockResolvedValueOnce({ Items: [{ tenderId: 'a', deadline: '2020-01-01', isExpired: false }], LastEvaluatedKey: { PK: 'A' } })
            .mockResolvedValueOnce({ Items: [{ tenderId: 'b', deadline: '2020-01-01', isExpired: false }] });
        mockUpdate.mockResolvedValue({});

        const { handler } = await import('./handler');
        const result = await handler({});
        expect(result.expired).toBe(2);
    });
});
