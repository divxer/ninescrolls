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

const sesSend = vi.fn().mockResolvedValue({ MessageId: 'mid-1' });
vi.mock('@aws-sdk/client-sesv2', () => ({
    SESv2Client: vi.fn().mockImplementation(() => ({ send: sesSend })),
    SendEmailCommand: class { input: any; constructor(input: any) { this.input = input; } },
}));

vi.stubEnv('INTELLIGENCE_TABLE', 'NineScrollsIntelligence');
vi.stubEnv('NOTIFICATION_FROM', 'info@ninescrolls.com');
vi.stubEnv('NOTIFICATION_TO', 'info@ninescrolls.com');

beforeEach(() => { mockGet.mockReset(); mockQuery.mockReset(); sesSend.mockClear(); });

describe('notify-high-priority handler', () => {
    it('sends one email per high-priority tender with score, agency, deadline', async () => {
        mockGet
            .mockResolvedValueOnce({ Item: {
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

        const { handler } = await import('./handler');
        const result = await handler({ highPriorityTenderIds: ['sam-1'] });

        expect(result.sent).toBe(1);
        const email = sesSend.mock.calls[0][0].input;
        expect(email.FromEmailAddress).toBe('info@ninescrolls.com');
        expect(email.Destination.ToAddresses).toContain('info@ninescrolls.com');
        const subject = email.Content.Simple.Subject.Data;
        expect(subject).toContain('Stanford');
        expect(subject).toContain('87');
        const body = email.Content.Simple.Body.Html.Data;
        expect(body).toContain('PECVD System');
        expect(body).toContain('https://sam.gov/opp/abc');
        expect(body).toContain('strong match');
    });

    it('does nothing when the list is empty', async () => {
        const { handler } = await import('./handler');
        const result = await handler({ highPriorityTenderIds: [] });
        expect(result.sent).toBe(0);
        expect(sesSend).not.toHaveBeenCalled();
    });
});
