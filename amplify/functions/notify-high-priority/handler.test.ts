import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGet = vi.fn();
const mockQuery = vi.fn();
vi.mock('@aws-sdk/client-dynamodb', () => ({ DynamoDBClient: vi.fn().mockImplementation(() => ({})) }));
vi.mock('@aws-sdk/lib-dynamodb', () => ({
    DynamoDBDocumentClient: {
        from: vi.fn().mockReturnValue({
            send: vi.fn().mockImplementation((cmd: any) => {
                const n = cmd.constructor.name;
                if (n === 'GetCommand') return mockGet(cmd);
                if (n === 'QueryCommand') return mockQuery(cmd);
                return Promise.resolve({});
            }),
        }),
    },
    GetCommand: class { input: any; constructor(input: any) { this.input = input; } },
    QueryCommand: class { input: any; constructor(input: any) { this.input = input; } },
}));

vi.stubEnv('INTELLIGENCE_TABLE', 'NineScrollsIntelligence');
vi.stubEnv('SENDGRID_API_KEY', 'SG.fake');

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

beforeEach(() => {
    mockGet.mockReset();
    mockQuery.mockReset();
    fetchMock.mockReset();
});

describe('notify-high-priority handler', () => {
    it('sends one SendGrid email per high-priority tender with score, agency, deadline', async () => {
        mockGet.mockResolvedValueOnce({ Item: {
            tenderId: 'sam-1', title: 'PECVD System', agency: 'Stanford',
            country: 'US', deadline: '2026-08-15', overallScore: 87,
            sourceUrl: 'https://sam.gov/opp/abc', estimatedValueUSD: 250000,
            description: 'desc text',
        } });
        mockQuery.mockResolvedValueOnce({
            Items: [
                { productSlug: 'pluto-f', score: 87, reasoning: 'strong match', matchedKeywords: ['PECVD'] },
            ],
        });
        fetchMock.mockResolvedValueOnce({ status: 202, text: async () => '' });

        const { handler } = await import('./handler');
        const result = await handler({ highPriorityTenderIds: ['sam-1'] });

        expect(result.sent).toBe(1);
        expect(result.failed).toBe(0);
        const [url, opts] = fetchMock.mock.calls[0];
        expect(url).toBe('https://api.sendgrid.com/v3/mail/send');
        expect(opts.method).toBe('POST');
        expect(opts.headers.Authorization).toBe('Bearer SG.fake');
        const payload = JSON.parse(opts.body);
        expect(payload.personalizations[0].to[0].email).toBe('info@ninescrolls.com');
        expect(payload.from.email).toBe('noreply@ninescrolls.com');
        expect(payload.subject).toContain('Stanford');
        expect(payload.subject).toContain('87');
        const body = payload.content[0].value;
        expect(body).toContain('PECVD System');
        expect(body).toContain('https://sam.gov/opp/abc');
        expect(body).toContain('strong match');
    });

    it('does nothing when the list is empty', async () => {
        const { handler } = await import('./handler');
        const result = await handler({ highPriorityTenderIds: [] });
        expect(result.sent).toBe(0);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('returns failed=N when SENDGRID_API_KEY is unset', async () => {
        vi.stubEnv('SENDGRID_API_KEY', '');
        const { handler } = await import('./handler');
        const result = await handler({ highPriorityTenderIds: ['sam-1', 'sam-2'] });
        expect(result.sent).toBe(0);
        expect(result.failed).toBe(2);
        expect(fetchMock).not.toHaveBeenCalled();
        vi.stubEnv('SENDGRID_API_KEY', 'SG.fake'); // restore for other tests
    });
});
