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
    it('sends one SendGrid email for all high-priority tenders with score, agency, deadline', async () => {
        mockGet
            .mockResolvedValueOnce({ Item: {
                tenderId: 'sam-1', title: 'PECVD System', agency: 'Stanford',
                country: 'US', deadline: '2026-08-15', overallScore: 87,
                sourceUrl: 'https://sam.gov/opp/abc', estimatedValueUSD: 250000,
                description: 'desc text',
            } })
            .mockResolvedValueOnce({ Item: {
                tenderId: 'ted-1', title: 'ALD System', agency: 'TU Munich',
                country: 'DE', deadline: '2026-08-30', overallScore: 91,
                sourceUrl: 'https://ted.europa.eu/opp/abc', estimatedValueUSD: null,
                description: 'desc text',
            } });
        mockQuery
            .mockResolvedValueOnce({ Items: [{ productSlug: 'pluto-f', score: 87, reasoning: 'strong match', matchedKeywords: ['PECVD'] }] })
            .mockResolvedValueOnce({ Items: [] });
        fetchMock.mockResolvedValueOnce({ status: 202, text: async () => '' });

        const { handler } = await import('./handler');
        const result = await handler({ highPriorityTenderIds: ['sam-1', 'ted-1'] });

        expect(result).toEqual({ status: 'sent', count: 2 });
        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, opts] = fetchMock.mock.calls[0];
        expect(url).toBe('https://api.sendgrid.com/v3/mail/send');
        expect(opts.method).toBe('POST');
        expect(opts.headers.Authorization).toBe('Bearer SG.fake');
        const payload = JSON.parse(opts.body);
        expect(payload.personalizations[0].to[0].email).toBe('info@ninescrolls.com');
        expect(payload.from.email).toBe('noreply@ninescrolls.com');
        expect(payload.subject).toContain('2 high-priority');
        const body = payload.content[0].value;
        expect(body).toContain('PECVD System');
        expect(body).toContain('ALD System');
        expect(body).toContain('https://sam.gov/opp/abc');
        expect(body).toContain('strong match');
    });

    it('returns {status:"skipped", count:0} when no HP tenders supplied', async () => {
        const { handler } = await import('./handler');
        const result = await handler({ highPriorityTenderIds: [] });
        expect(result).toEqual({ status: 'skipped', count: 0 });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('throws when SENDGRID_API_KEY is unset', async () => {
        vi.stubEnv('SENDGRID_API_KEY', '');
        const { handler } = await import('./handler');
        await expect(handler({ highPriorityTenderIds: ['sam-1', 'sam-2'] })).rejects.toThrow(/SENDGRID_API_KEY/);
        expect(fetchMock).not.toHaveBeenCalled();
        vi.stubEnv('SENDGRID_API_KEY', 'SG.fake'); // restore for other tests
    });
});
