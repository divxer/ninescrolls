import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockScan, mockSend } = vi.hoisted(() => {
  const mockScan = vi.fn();
  const mockSend = vi.fn().mockImplementation((cmd: unknown) => {
    const name = (cmd as { constructor: { name: string } }).constructor.name;
    if (name === 'ScanCommand') return mockScan();
    return Promise.resolve({});
  });
  return { mockScan, mockSend };
});

vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: vi.fn().mockImplementation(() => ({})),
}));
vi.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: { from: vi.fn().mockReturnValue({ send: mockSend }) },
  ScanCommand: vi.fn().mockImplementation((p) => ({ ...p, constructor: { name: 'ScanCommand' } })),
}));

import { handler, countVerifiedPublications } from './handler';

const invoke = (args: Record<string, unknown> = {}) =>
  handler({ arguments: args } as never) as Promise<unknown[]>;

beforeEach(() => {
  process.env.EVIDENCE_TABLE = 'Evidence-test';
  mockScan.mockReset();
  mockSend.mockClear();
});

describe('evidence-api listPublishedEvidence', () => {
  it('scans the configured table with an EXACT published-only filter', async () => {
    mockScan.mockResolvedValueOnce({ Items: [], LastEvaluatedKey: undefined });
    await invoke();
    const sent = mockSend.mock.calls[0][0];
    expect(sent.TableName).toBe('Evidence-test');
    expect(sent.FilterExpression).toBe('#status = :published');
    expect(sent.ExpressionAttributeNames).toEqual({ '#status': 'status' });
    expect(sent.ExpressionAttributeValues).toEqual({ ':published': 'published' });
  });

  it('adds a server-side products membership filter when productSlug is given', async () => {
    mockScan.mockResolvedValueOnce({ Items: [], LastEvaluatedKey: undefined });
    await invoke({ productSlug: 'ald' });
    const sent = mockSend.mock.calls[0][0];
    expect(sent.FilterExpression).toBe('#status = :published AND contains(products, :slug)');
    expect(sent.ExpressionAttributeValues).toEqual({ ':published': 'published', ':slug': 'ald' });
  });

  it('drains LastEvaluatedKey across pages and accumulates published items', async () => {
    mockScan
      .mockResolvedValueOnce({ Items: [{ id: '1', type: 'application_note', status: 'published' }], LastEvaluatedKey: { id: '1' } })
      .mockResolvedValueOnce({ Items: [{ id: '2', type: 'publication', status: 'published' }], LastEvaluatedKey: undefined });
    const result = await invoke();
    expect(mockScan).toHaveBeenCalledTimes(2);
    expect((result as { id: string }[]).map((r) => r.id)).toEqual(['1', '2']);
    expect(mockSend.mock.calls[1][0].ExclusiveStartKey).toEqual({ id: '1' });
  });

  it('throws if EVIDENCE_TABLE is unset', async () => {
    delete process.env.EVIDENCE_TABLE;
    await expect(invoke()).rejects.toThrow(/EVIDENCE_TABLE/);
  });

  it('projects each record to a whitelist: strips slug + OEM meta, hoists safe meta fields', async () => {
    mockScan.mockResolvedValueOnce({
      Items: [{
        id: 'x',
        slug: 'pub-tailong-icp100a-nanomaterials-2020',
        type: 'publication',
        status: 'published',
        title: 'A paper',
        sourceUrl: 'https://doi.org/10.1/x',
        publishDate: '2026-07-18',
        products: ['icp-etcher'],
        meta: JSON.stringify({
          journal: 'Nanomaterials', year: 2020, doi: '10.1/x',
          manufacturerAsNamed: 'Tailong Electronics', instrumentAsNamed: 'ICP-100A',
          verification: 'quote', publicSummary: 'Etched structures.',
        }),
      }],
      LastEvaluatedKey: undefined,
    });
    const [rec] = (await invoke()) as Record<string, unknown>[];
    expect(rec).toEqual({
      id: 'x', type: 'publication', status: 'published', title: 'A paper',
      sourceUrl: 'https://doi.org/10.1/x', publishDate: '2026-07-18', products: ['icp-etcher'],
      journal: 'Nanomaterials', year: 2020, doi: '10.1/x', publicSummary: 'Etched structures.',
    });
    expect(rec).not.toHaveProperty('slug');
    expect(rec).not.toHaveProperty('meta');
    expect(JSON.stringify(rec)).not.toMatch(/tailong|ICP-100A/i);
  });

  it('omits publicSummary when the record has none (treatment A)', async () => {
    mockScan.mockResolvedValueOnce({
      Items: [{ id: 'y', type: 'publication', status: 'published', title: 'T',
        meta: JSON.stringify({ journal: 'J', year: 2024, doi: '10.2/y' }) }],
      LastEvaluatedKey: undefined,
    });
    const [rec] = (await invoke()) as Record<string, unknown>[];
    expect(rec).not.toHaveProperty('publicSummary');
    expect(rec.journal).toBe('J');
  });
});

describe('countVerifiedPublications', () => {
  it('counts active (non-archived) tier-A publications only', () => {
    const items = [
      { type: 'publication', status: 'published', meta: JSON.stringify({ verificationTier: 'A' }) }, // yes
      { type: 'publication', status: 'draft', meta: JSON.stringify({ verificationTier: 'A' }) },      // yes (held tier-A counts)
      { type: 'publication', status: 'draft', meta: JSON.stringify({ verificationTier: 'B' }) },       // no (tier-B)
      { type: 'publication', status: 'archived', meta: JSON.stringify({ verificationTier: 'A' }) },    // no (archived)
      { type: 'application_note', status: 'published', meta: JSON.stringify({ verificationTier: 'A' }) }, // no (not a publication)
    ];
    expect(countVerifiedPublications(items)).toBe(2);
  });
});

describe('evidence-api getEvidenceStats', () => {
  const invokeStats = () =>
    handler({ info: { fieldName: 'getEvidenceStats' } } as never) as Promise<Record<string, unknown>>;

  it('scans active publications and returns ONLY the verified count (no records/OEM)', async () => {
    mockScan.mockResolvedValueOnce({
      Items: [
        { type: 'publication', status: 'published', title: 'secret title',
          meta: JSON.stringify({ verificationTier: 'A', manufacturerAsNamed: 'Tailong Electronics' }) },
        { type: 'publication', status: 'draft', meta: JSON.stringify({ verificationTier: 'A' }) },
        { type: 'publication', status: 'draft', meta: JSON.stringify({ verificationTier: 'B' }) },
      ],
      LastEvaluatedKey: undefined,
    });
    const res = await invokeStats();

    const sent = mockSend.mock.calls[0][0];
    expect(sent.FilterExpression).toBe('#type = :publication AND #status <> :archived');
    expect(sent.ExpressionAttributeNames).toEqual({ '#status': 'status', '#type': 'type' });
    expect(sent.ExpressionAttributeValues).toEqual({ ':publication': 'publication', ':archived': 'archived' });

    expect(res).toEqual({ verifiedPublications: 2 });
    // A count only — no titles/OEM cross the boundary.
    expect(JSON.stringify(res)).not.toMatch(/tailong|secret/i);
  });
});
