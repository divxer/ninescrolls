import { describe, it, expect, vi, beforeEach } from 'vitest';
import { matchesAnyConfig } from './handler';

const mockQuery = vi.fn();
const mockBatchGet = vi.fn();
vi.mock('@aws-sdk/client-dynamodb', () => ({
    DynamoDBClient: vi.fn().mockImplementation(() => ({})),
}));
vi.mock('@aws-sdk/lib-dynamodb', () => ({
    DynamoDBDocumentClient: {
        from: vi.fn().mockReturnValue({
            send: vi.fn().mockImplementation((cmd: any) => {
                const n = cmd.constructor.name;
                if (n === 'QueryCommand') return mockQuery(cmd);
                if (n === 'BatchGetCommand') return mockBatchGet(cmd);
                return Promise.resolve({});
            }),
        }),
    },
    QueryCommand: class { input: any; constructor(input: any) { this.input = input; } },
    BatchGetCommand: class { input: any; constructor(input: any) { this.input = input; } },
}));

vi.stubEnv('INTELLIGENCE_TABLE', 'NineScrollsIntelligence');

beforeEach(() => {
    mockQuery.mockReset();
    mockBatchGet.mockReset();
});

describe('matchesAnyConfig (pure logic)', () => {
    const pecvd = {
        productCategory: 'PECVD',
        productSlugs: ['pluto-f'],
        keywords: ['PECVD', 'plasma-enhanced chemical vapor deposition'],
        synonyms: ['plasma enhanced cvd'],
        blacklist: ['advertisement'],
        naicsCodes: ['334516', '334519'],
        cpvCodes: ['38540000'],
        isActive: true,
    };

    it('passes a tender that matches keyword and NAICS', () => {
        const r = matchesAnyConfig(
            { title: 'PECVD System for Cleanroom', description: '', naicsCodes: ['334516'], cpvCodes: [] },
            [pecvd],
        );
        expect(r.matchedCategories).toContain('PECVD');
        expect(r.matchedKeywords).toContain('PECVD');
    });

    it('rejects a tender that matches keyword but is on the blacklist', () => {
        const r = matchesAnyConfig(
            { title: 'PECVD advertisement campaign', description: '', naicsCodes: ['334516'], cpvCodes: [] },
            [pecvd],
        );
        expect(r.matchedCategories).toEqual([]);
    });

    it('rejects a tender with no code match and no keyword match', () => {
        const r = matchesAnyConfig(
            { title: 'Pool cleaning services', description: '', naicsCodes: ['561720'], cpvCodes: [] },
            [pecvd],
        );
        expect(r.matchedCategories).toEqual([]);
    });

    it('passes when NAICS is empty in config (no code restriction)', () => {
        const noCodes = { ...pecvd, naicsCodes: [], cpvCodes: [] };
        const r = matchesAnyConfig(
            { title: 'plasma enhanced cvd machine', description: '', naicsCodes: [], cpvCodes: [] },
            [noCodes],
        );
        expect(r.matchedCategories).toContain('PECVD');
        expect(r.matchedKeywords).toContain('plasma enhanced cvd');
    });

    it('matches synonyms case-insensitively', () => {
        const r = matchesAnyConfig(
            { title: 'plasma enhanced CVD tool', description: '', naicsCodes: ['334516'], cpvCodes: [] },
            [pecvd],
        );
        expect(r.matchedKeywords).toContain('plasma enhanced cvd');
    });

    it('matches by CPV code when keyword is absent but description mentions related work', () => {
        const r = matchesAnyConfig(
            { title: 'Equipment supply', description: 'Various', naicsCodes: [], cpvCodes: ['38540000'] },
            [pecvd],
        );
        // CPV alone is not enough — keyword/synonym must also hit. Otherwise too noisy.
        expect(r.matchedCategories).toEqual([]);
    });
});

describe('prefilter-by-keyword handler', () => {
    it('returns only tenders that pass at least one config', async () => {
        mockQuery.mockResolvedValueOnce({
            Items: [
                {
                    productCategory: 'PECVD',
                    productSlugs: ['pluto-f'],
                    keywords: ['PECVD'],
                    synonyms: [],
                    blacklist: [],
                    naicsCodes: ['334516'],
                    cpvCodes: [],
                    isActive: true,
                },
            ],
        });
        mockBatchGet.mockResolvedValueOnce({
            Responses: {
                NineScrollsIntelligence: [
                    { tenderId: 'sam-1', title: 'PECVD System', description: '', naicsCodes: ['334516'], cpvCodes: [] },
                    { tenderId: 'sam-2', title: 'HVAC Service Contract', description: '', naicsCodes: ['238220'], cpvCodes: [] },
                ],
            },
        });

        const { handler } = await import('./handler');
        const result = await handler({ newTenderIds: ['sam-1', 'sam-2'] });

        expect(result.candidates).toHaveLength(1);
        expect(result.candidatesCount).toBe(1);
        expect(result.candidates[0].tenderId).toBe('sam-1');
        expect(result.candidates[0].matchedKeywords).toContain('PECVD');
    });

    it('returns empty candidates when there are no new tenders', async () => {
        const { handler } = await import('./handler');
        const result = await handler({ newTenderIds: [] });
        expect(result.candidates).toEqual([]);
        expect(result.candidatesCount).toBe(0);
    });
});
