import { beforeEach, describe, expect, it, vi } from 'vitest';

const send = vi.fn();
vi.mock('../lib/dynamodb.js', () => ({
  docClient: { send: (...args: unknown[]) => send(...args) },
  TABLE_NAME: () => 'TestTable',
}));

import {
  MAX_IMPORT_ROWS,
  pbGetHistoricalQuotation,
  pbImportHistoricalQuotations,
  pbListHistoricalQuotations,
} from './historicalQuotationResolvers.js';
import { contentHashFor, historicalIdFor, type HistoricalQuotationInput } from '../lib/historicalQuotation.js';

const historicalId = 'a'.repeat(64);
const ev = (args: Record<string, unknown>) => ({
  info: { fieldName: 'x', parentTypeName: 'Query' },
  arguments: args,
  identity: { sub: 'operator', groups: ['admin'] },
});

beforeEach(() => send.mockReset());

const row = (overrides: Partial<HistoricalQuotationInput & Record<string, unknown>> = {}) => {
  const value: HistoricalQuotationInput & Record<string, unknown> = {
    customerName: 'Customer', productName: 'Analyzer', configuration: 'Base',
    supplierId: 'sup-1', supplierQuoteText: 'RMB 100', supplierQuoteBasis: 'written',
    supplierEvidenceType: 'WRITTEN', supplierQuotedAt: '2025-01-02', customerQuoteText: 'USD 20',
    sourceQuotationNumber: 'Q-1', quotedAt: '2025-01-03', legacyStatus: 'sent',
    supplierAmountFen: 10000, customerAmountUsdCents: 2000, historicalFxRate: '5.0',
    historicalFxSource: 'evidence', historicalFxProvenance: 'CONFIRMED', historicalFxNote: null,
    sourceDocument: 'book.xlsx', sourceDocumentHash: 'b'.repeat(64), sourceRow: 2,
    importBatchId: 'HB-batch', dataQualityFlags: [], dataQualityNotes: [], ...overrides,
  };
  value.historicalId ??= historicalIdFor(value.sourceDocument, value.sourceRow);
  value.contentHash ??= contentHashFor(value);
  return value;
};

const importEvent = (rows: Array<Record<string, unknown>>, overrides: Record<string, unknown> = {}) => ev({ input: {
  importBatchId: 'HB-batch', sourceDocument: 'book.xlsx', sourceDocumentHash: 'b'.repeat(64), rows, ...overrides,
} });

describe('pbImportHistoricalQuotations', () => {
  it('writes the complete manifest first, then independently imports valid rows despite a validation failure', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-07-14T12:00:00.000Z'));
    const good = row(); const bad = row({ sourceRow: 3, customerName: '' });
    send.mockResolvedValueOnce({ Item: { supplierId: 'sup-1' } }).mockResolvedValueOnce({}).mockResolvedValueOnce({});

    const result = await pbImportHistoricalQuotations(importEvent([bad, good])) as Array<Record<string, unknown>>;

    expect(send.mock.calls.map(call => call[0].constructor.name)).toEqual(['GetCommand', 'PutCommand', 'PutCommand']);
    expect(send.mock.calls[1][0].input).toMatchObject({
      ConditionExpression: 'attribute_not_exists(PK)', ReturnValuesOnConditionCheckFailure: 'ALL_OLD',
      Item: { PK: 'HISTIMPORT#HB-batch', SK: 'MANIFEST', importBatchId: 'HB-batch', sourceDocument: 'book.xlsx',
        sourceDocumentHash: 'b'.repeat(64), historicalIds: [good.historicalId, bad.historicalId].sort(), rowCount: 2,
        createdAt: '2026-07-14T12:00:00.000Z', createdBy: 'operator' },
    });
    expect(result.map(item => item.status)).toEqual(['FAILED', 'IMPORTED']);
    vi.useRealTimers();
  });

  it('accepts canonical manifest replay with reordered IDs and excludes stamps from equivalence', async () => {
    const a = row(); const b = row({ sourceRow: 3 });
    send.mockResolvedValueOnce({ Item: {} }).mockRejectedValueOnce(Object.assign(new Error(), {
      name: 'ConditionalCheckFailedException', Item: { importBatchId: 'HB-batch', sourceDocument: 'book.xlsx',
        sourceDocumentHash: 'b'.repeat(64), historicalIds: [b.historicalId, a.historicalId], rowCount: 2,
        createdAt: 'old', createdBy: 'someone-else' },
    })).mockResolvedValue({});
    await expect(pbImportHistoricalQuotations(importEvent([a, b]))).resolves.toEqual([
      expect.objectContaining({ status: 'IMPORTED' }), expect.objectContaining({ status: 'IMPORTED' }),
    ]);
  });

  it.each([
    ['added', (ids: string[]) => [...ids, 'extra']], ['removed', (ids: string[]) => ids.slice(1)],
    ['changed', (ids: string[]) => ['changed', ...ids.slice(1)]],
  ])('aborts a batch before row writes when replay has %s intended ID', async (_name, mutate) => {
    const value = row();
    send.mockResolvedValueOnce({ Item: {} }).mockRejectedValueOnce(Object.assign(new Error(), {
      name: 'ConditionalCheckFailedException', Item: { importBatchId: 'HB-batch', sourceDocument: 'book.xlsx',
        sourceDocumentHash: 'b'.repeat(64), historicalIds: mutate([value.historicalId as string]), rowCount: 1 },
    }));
    await expect(pbImportHistoricalQuotations(importEvent([value]))).rejects.toThrow(/^CONFLICT:/);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['document hash', { sourceDocumentHash: 'c'.repeat(64) }],
    ['source document', { sourceDocument: 'other.xlsx' }],
    ['batch id', { importBatchId: 'HB-other' }],
    ['row count', { rowCount: 2 }],
  ])('aborts before row writes when replay differs by canonical %s', async (_name, mutation) => {
    const value = row();
    send.mockResolvedValueOnce({ Item: {} }).mockRejectedValueOnce(Object.assign(new Error(), {
      name: 'ConditionalCheckFailedException', Item: { importBatchId: 'HB-batch', sourceDocument: 'book.xlsx',
        sourceDocumentHash: 'b'.repeat(64), historicalIds: [value.historicalId], rowCount: 1, ...mutation },
    }));
    await expect(pbImportHistoricalQuotations(importEvent([value]))).rejects.toThrow(/^CONFLICT:/);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('classifies atomic existing-item evidence as SKIPPED or CONFLICT without follow-up reads', async () => {
    const a = row(); const b = row({ sourceRow: 3 });
    send.mockResolvedValueOnce({ Item: {} }).mockResolvedValueOnce({})
      .mockRejectedValueOnce(Object.assign(new Error(), { name: 'ConditionalCheckFailedException', Item: { contentHash: a.contentHash } }))
      .mockRejectedValueOnce(Object.assign(new Error(), { name: 'ConditionalCheckFailedException', Item: { contentHash: 'different' } }));
    const result = await pbImportHistoricalQuotations(importEvent([a, b])) as Array<Record<string, unknown>>;
    expect(result.map(item => item.status)).toEqual(['SKIPPED', 'CONFLICT']);
    expect(send).toHaveBeenCalledTimes(4);
    for (const call of send.mock.calls.slice(2)) expect(call[0].input).toMatchObject({
      ConditionExpression: 'attribute_not_exists(PK)', ReturnValuesOnConditionCheckFailure: 'ALL_OLD',
    });
  });

  it('continues after an unexpected row write failure and recovers that row on manifest replay', async () => {
    const a = row(); const b = row({ sourceRow: 3 });
    send.mockResolvedValueOnce({ Item: {} }).mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error('temporary')).mockResolvedValueOnce({});
    await expect(pbImportHistoricalQuotations(importEvent([a, b]))).resolves.toEqual([
      expect.objectContaining({ status: 'FAILED' }), expect.objectContaining({ status: 'IMPORTED' }),
    ]);
    send.mockReset();
    send.mockResolvedValueOnce({ Item: {} }).mockRejectedValueOnce(Object.assign(new Error(), {
      name: 'ConditionalCheckFailedException', Item: { importBatchId: 'HB-batch', sourceDocument: 'book.xlsx',
        sourceDocumentHash: 'b'.repeat(64), historicalIds: [a.historicalId, b.historicalId], rowCount: 2 },
    })).mockResolvedValueOnce({}).mockRejectedValueOnce(Object.assign(new Error(), {
      name: 'ConditionalCheckFailedException', Item: { contentHash: b.contentHash },
    }));
    await expect(pbImportHistoricalQuotations(importEvent([a, b]))).resolves.toEqual([
      expect.objectContaining({ status: 'IMPORTED' }), expect.objectContaining({ status: 'SKIPPED' }),
    ]);
  });

  it('recomputes keys and stamps server actor/time while ignoring caller table keys and stamps', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-07-14T12:00:00.000Z'));
    const value = row({ PK: 'EVIL', SK: 'EVIL', GSI1PK: 'EVIL', GSI1SK: 'EVIL', importedBy: 'evil', importedAt: 'evil' });
    send.mockResolvedValueOnce({ Item: {} }).mockResolvedValueOnce({}).mockResolvedValueOnce({});
    await pbImportHistoricalQuotations(importEvent([value]));
    expect(send.mock.calls[2][0].input.Item).toMatchObject({ PK: `PHIST#${value.historicalId}`, SK: 'META',
      GSI1PK: 'HISTORICAL_QUOTATIONS', GSI1SK: `2025-01-03#${value.historicalId}`,
      importedBy: 'operator', importedAt: '2026-07-14T12:00:00.000Z' });
    vi.useRealTimers();
  });

  it('accepts matching predictions but rejects a forged prediction before any write', async () => {
    const matching = row();
    send.mockResolvedValueOnce({ Item: {} }).mockResolvedValueOnce({}).mockResolvedValueOnce({});
    await expect(pbImportHistoricalQuotations(importEvent([matching]))).resolves.toEqual([expect.objectContaining({ status: 'IMPORTED' })]);
    send.mockReset();
    await expect(pbImportHistoricalQuotations(importEvent([row({ historicalId: 'a'.repeat(64) })])))
      .rejects.toThrow(/^VALIDATION:.*prediction/);
    expect(send).not.toHaveBeenCalled();
  });

  it('accepts the shared cap and rejects cap+1 and unknown suppliers before any write', async () => {
    const rows = Array.from({ length: MAX_IMPORT_ROWS }, (_, i) => row({ sourceRow: i + 1 }));
    send.mockResolvedValueOnce({ Item: {} }).mockResolvedValue({});
    await expect(pbImportHistoricalQuotations(importEvent(rows))).resolves.toHaveLength(MAX_IMPORT_ROWS);
    send.mockReset();
    await expect(pbImportHistoricalQuotations(importEvent([...rows, row({ sourceRow: MAX_IMPORT_ROWS + 1 })])))
      .rejects.toThrow(/^VALIDATION:/);
    expect(send).not.toHaveBeenCalled();
    send.mockResolvedValueOnce({});
    await expect(pbImportHistoricalQuotations(importEvent([row()]))).rejects.toThrow(/^VALIDATION:.*supplier/);
    expect(send).toHaveBeenCalledTimes(1);
  });
});

describe('pbListHistoricalQuotations', () => {
  it('queries only the historical GSI partition newest-first with a bounded limit', async () => {
    send.mockResolvedValueOnce({ Items: [] });

    await pbListHistoricalQuotations(ev({ limit: 999 }));

    expect(send).toHaveBeenCalledOnce();
    expect(send.mock.calls[0][0].constructor.name).toBe('QueryCommand');
    expect(send.mock.calls[0][0].input).toMatchObject({
      TableName: 'TestTable',
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: { ':pk': 'HISTORICAL_QUOTATIONS' },
      ScanIndexForward: false,
      Limit: 200,
    });
    expect(send.mock.calls[0][0].input).not.toHaveProperty('FilterExpression');
  });

  it('round-trips the existing base64 JSON cursor shape', async () => {
    const startKey = { PK: `PHIST#${historicalId}`, SK: 'META', GSI1PK: 'HISTORICAL_QUOTATIONS', GSI1SK: `2025-01-01#${historicalId}` };
    const endKey = { ...startKey, GSI1SK: `2024-12-31#${historicalId}` };
    send.mockResolvedValueOnce({ Items: [], LastEvaluatedKey: endKey });

    const result = await pbListHistoricalQuotations(ev({
      nextToken: Buffer.from(JSON.stringify(startKey)).toString('base64'),
    })) as { nextToken: string };

    expect(send.mock.calls[0][0].input.ExclusiveStartKey).toEqual(startKey);
    expect(JSON.parse(Buffer.from(result.nextToken, 'base64').toString())).toEqual(endKey);
  });

  it('returns null-date rows indexed by supplier date or the floor key and strips table keys', async () => {
    send.mockResolvedValueOnce({ Items: [
      { PK: 'PHIST#supplier', SK: 'META', GSI1PK: 'HISTORICAL_QUOTATIONS', GSI1SK: '2024-02-03#supplier', historicalId: 'supplier', quotedAt: null, supplierQuotedAt: '2024-02-03' },
      { PK: 'PHIST#floor', SK: 'META', GSI1PK: 'HISTORICAL_QUOTATIONS', GSI1SK: '0000-00-00#floor', historicalId: 'floor', quotedAt: null, supplierQuotedAt: null },
    ] });

    const result = await pbListHistoricalQuotations(ev({})) as { items: Array<Record<string, unknown>> };

    expect(result.items).toEqual([
      { historicalId: 'supplier', quotedAt: null, supplierQuotedAt: '2024-02-03' },
      { historicalId: 'floor', quotedAt: null, supplierQuotedAt: null },
    ]);
  });

  it('rejects an invalid cursor before reading', async () => {
    await expect(pbListHistoricalQuotations(ev({ nextToken: 'garbage!!' })))
      .rejects.toThrow(/^VALIDATION:/);
    expect(send).not.toHaveBeenCalled();
  });
});

describe('pbGetHistoricalQuotation', () => {
  it('strongly consistently gets PHIST#<historicalId>/META and strips table keys', async () => {
    send.mockResolvedValueOnce({ Item: {
      PK: `PHIST#${historicalId}`, SK: 'META', GSI1PK: 'HISTORICAL_QUOTATIONS',
      GSI1SK: `2025-01-01#${historicalId}`, historicalId, quotedAt: '2025-01-01',
    } });

    const result = await pbGetHistoricalQuotation(ev({ historicalId })) as Record<string, unknown>;

    expect(send.mock.calls[0][0].constructor.name).toBe('GetCommand');
    expect(send.mock.calls[0][0].input).toEqual({
      TableName: 'TestTable', Key: { PK: `PHIST#${historicalId}`, SK: 'META' }, ConsistentRead: true,
    });
    expect(result).toEqual({ historicalId, quotedAt: '2025-01-01' });
  });

  it('maps a missing historical quotation to typed NOT_FOUND', async () => {
    send.mockResolvedValueOnce({});
    await expect(pbGetHistoricalQuotation(ev({ historicalId }))).rejects.toThrow(/^NOT_FOUND:/);
  });

  it.each(['', 'abc', 'A'.repeat(64), `${'a'.repeat(63)}g`, `PHIST#${historicalId}`])(
    'rejects malformed historicalId %j before reading',
    async (invalidId) => {
      await expect(pbGetHistoricalQuotation(ev({ historicalId: invalidId }))).rejects.toThrow(/^VALIDATION:/);
      expect(send).not.toHaveBeenCalled();
    },
  );
});
