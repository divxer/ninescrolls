import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockBatchGet = vi.fn();
vi.mock('@aws-sdk/client-dynamodb', () => ({ DynamoDBClient: vi.fn().mockImplementation(() => ({})) }));
vi.mock('@aws-sdk/lib-dynamodb', () => ({
    DynamoDBDocumentClient: {
        from: vi.fn().mockReturnValue({
            send: vi.fn().mockImplementation((cmd: any) => {
                if (cmd.constructor.name === 'BatchGetCommand') return mockBatchGet(cmd);
                return Promise.resolve({});
            }),
        }),
    },
    BatchGetCommand: class { input: any; constructor(input: any) { this.input = input; } },
}));

const sesSend = vi.fn().mockResolvedValue({ MessageId: 'mid' });
vi.mock('@aws-sdk/client-sesv2', () => ({
    SESv2Client: vi.fn().mockImplementation(() => ({ send: sesSend })),
    SendEmailCommand: class { input: any; constructor(input: any) { this.input = input; } },
}));

vi.stubEnv('INTELLIGENCE_TABLE', 'NineScrollsIntelligence');
vi.stubEnv('NOTIFICATION_FROM', 'info@ninescrolls.com');
vi.stubEnv('NOTIFICATION_TO', 'info@ninescrolls.com');

beforeEach(() => { mockBatchGet.mockReset(); sesSend.mockClear(); });

describe('notify-daily-digest handler', () => {
    it('sends a single grouped email when tenders exist', async () => {
        mockBatchGet.mockResolvedValueOnce({
            Responses: {
                NineScrollsIntelligence: [
                    { tenderId: 'sam-1', title: 'PECVD System', agency: 'Stanford', country: 'US', overallScore: 87, sourceUrl: 'https://sam.gov/1', deadline: '2026-08-01' },
                    { tenderId: 'sam-2', title: 'ALD Tool', agency: 'MIT', country: 'US', overallScore: 64, sourceUrl: 'https://sam.gov/2', deadline: '2026-09-01' },
                    { tenderId: 'ted-1', title: 'AFM Microscope', agency: 'TU Munich', country: 'DE', overallScore: 72, sourceUrl: 'https://ted.eu/1', deadline: '2026-07-15' },
                ],
            },
        });

        const { handler } = await import('./handler');
        const result = await handler({ digestTenderIds: ['sam-1', 'sam-2', 'ted-1'] });

        expect(result.sent).toBe(1);
        const html = sesSend.mock.calls[0][0].input.Content.Simple.Body.Html.Data;
        expect(html).toContain('US');
        expect(html).toContain('DE');
        expect(html).toContain('Stanford');
        expect(html).toContain('TU Munich');
    });

    it('does not send when the list is empty', async () => {
        const { handler } = await import('./handler');
        const result = await handler({ digestTenderIds: [] });
        expect(result.sent).toBe(0);
        expect(sesSend).not.toHaveBeenCalled();
    });
});
