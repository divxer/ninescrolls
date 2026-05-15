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

vi.stubEnv('INTELLIGENCE_TABLE', 'NineScrollsIntelligence');
vi.stubEnv('SENDGRID_API_KEY', 'SG.fake');

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

beforeEach(() => {
    mockBatchGet.mockReset();
    fetchMock.mockReset();
});

describe('notify-daily-digest handler', () => {
    it('sends a single SendGrid email grouped by country when tenders exist', async () => {
        mockBatchGet.mockResolvedValueOnce({
            Responses: {
                NineScrollsIntelligence: [
                    { tenderId: 'sam-1', title: 'PECVD System', agency: 'Stanford', country: 'US', overallScore: 87, sourceUrl: 'https://sam.gov/1', deadline: '2026-08-01' },
                    { tenderId: 'sam-2', title: 'ALD Tool', agency: 'MIT', country: 'US', overallScore: 64, sourceUrl: 'https://sam.gov/2', deadline: '2026-09-01' },
                    { tenderId: 'ted-1', title: 'AFM Microscope', agency: 'TU Munich', country: 'DE', overallScore: 72, sourceUrl: 'https://ted.eu/1', deadline: '2026-07-15' },
                ],
            },
        });
        fetchMock.mockResolvedValueOnce({ status: 202, text: async () => '' });

        const { handler } = await import('./handler');
        const result = await handler({ digestTenderIds: ['sam-1', 'sam-2', 'ted-1'] });

        expect(result.sent).toBe(1);
        const [url, opts] = fetchMock.mock.calls[0];
        expect(url).toBe('https://api.sendgrid.com/v3/mail/send');
        const payload = JSON.parse(opts.body);
        expect(payload.from.email).toBe('noreply@ninescrolls.com');
        const html = payload.content[0].value;
        expect(html).toContain('US');
        expect(html).toContain('DE');
        expect(html).toContain('Stanford');
        expect(html).toContain('TU Munich');
    });

    it('does not send when the list is empty', async () => {
        const { handler } = await import('./handler');
        const result = await handler({ digestTenderIds: [] });
        expect(result.sent).toBe(0);
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
