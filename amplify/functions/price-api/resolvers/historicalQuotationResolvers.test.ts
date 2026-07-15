import { beforeEach, describe, expect, it, vi } from 'vitest';
import { marshall } from '@aws-sdk/util-dynamodb';

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
  pbRollbackHistoricalQuotationImport,
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
      name: 'ConditionalCheckFailedException', Item: marshall({ importBatchId: 'HB-batch', sourceDocument: 'book.xlsx',
        sourceDocumentHash: 'b'.repeat(64), historicalIds: [b.historicalId, a.historicalId], rowCount: 2,
        createdAt: 'old', createdBy: 'someone-else' }),
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
      name: 'ConditionalCheckFailedException', Item: marshall({ importBatchId: 'HB-batch', sourceDocument: 'book.xlsx',
        sourceDocumentHash: 'b'.repeat(64), historicalIds: mutate([value.historicalId as string]), rowCount: 1 }),
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
      name: 'ConditionalCheckFailedException', Item: marshall({ importBatchId: 'HB-batch', sourceDocument: 'book.xlsx',
        sourceDocumentHash: 'b'.repeat(64), historicalIds: [value.historicalId], rowCount: 1, ...mutation }),
    }));
    await expect(pbImportHistoricalQuotations(importEvent([value]))).rejects.toThrow(/^CONFLICT:/);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('classifies atomic existing-item evidence as SKIPPED or CONFLICT without follow-up reads', async () => {
    const a = row(); const b = row({ sourceRow: 3 });
    send.mockResolvedValueOnce({ Item: {} }).mockResolvedValueOnce({})
      .mockRejectedValueOnce(Object.assign(new Error(), { name: 'ConditionalCheckFailedException', Item: marshall({ contentHash: a.contentHash }) }))
      .mockRejectedValueOnce(Object.assign(new Error(), { name: 'ConditionalCheckFailedException', Item: marshall({ contentHash: 'different' }) }));
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
      name: 'ConditionalCheckFailedException', Item: marshall({ importBatchId: 'HB-batch', sourceDocument: 'book.xlsx',
        sourceDocumentHash: 'b'.repeat(64), historicalIds: [a.historicalId, b.historicalId], rowCount: 2 }),
    })).mockResolvedValueOnce({}).mockRejectedValueOnce(Object.assign(new Error(), {
      name: 'ConditionalCheckFailedException', Item: marshall({ contentHash: b.contentHash }),
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

describe('pbRollbackHistoricalQuotationImport', () => {
  const id1 = '1'.repeat(64); const id2 = '2'.repeat(64);
  const manifest = { PK: 'HISTIMPORT#HB-batch', SK: 'MANIFEST', importBatchId: 'HB-batch',
    sourceDocumentHash: 'b'.repeat(64), historicalIds: [id1, id2], rowCount: 2 };
  const live = (id: string, extra: Record<string, unknown> = {}) => ({ PK: `PHIST#${id}`, SK: 'META',
    recordType: 'HISTORICAL_QUOTATION', importBatchId: 'HB-batch', historicalId: id,
    contentHash: `${id[0]}`.repeat(64), sourceDocument: 'book.xlsx', ...extra });
  const rollback = (mode: 'PREVIEW' | 'APPLY', extra: Record<string, unknown> = {}) => ev({ input: {
    importBatchId: 'HB-batch', mode, ...extra,
  } });

  it('previews every manifest id consistently and writes nothing', async () => {
    send.mockResolvedValueOnce({ Item: manifest }).mockResolvedValueOnce({ Item: live(id1) }).mockResolvedValueOnce({});
    const result = await pbRollbackHistoricalQuotationImport(rollback('PREVIEW')) as Record<string, unknown>;
    expect(send.mock.calls.map(c => c[0].constructor.name)).toEqual(['GetCommand', 'GetCommand', 'GetCommand']);
    expect(send.mock.calls.every(c => c[0].input.ConsistentRead === true)).toBe(true);
    expect(result).toMatchObject({ matchedCount: 1, deletableCount: 1, blockedCount: 0,
      historicalIds: [id1, id2], sourceDocuments: ['book.xlsx'], warnings: expect.any(Array), rollbackToken: expect.any(String) });
  });

  it('fails a missing manifest loudly without writes', async () => {
    send.mockResolvedValueOnce({});
    await expect(pbRollbackHistoricalQuotationImport(rollback('PREVIEW'))).rejects.toThrow(/^NOT_FOUND:/);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('rejects malformed manifest ids before constructing a PHIST key', async () => {
    send.mockResolvedValueOnce({ Item: { ...manifest, historicalIds: ['../PHIST#evil'] } });
    await expect(pbRollbackHistoricalQuotationImport(rollback('PREVIEW'))).rejects.toThrow(/^CONFLICT:/);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('blocks a loaded record whose historicalId does not equal the manifest id', async () => {
    send.mockResolvedValueOnce({ Item: { ...manifest, historicalIds: [id1] } })
      .mockResolvedValueOnce({ Item: live(id1, { historicalId: id2 }) });
    await expect(pbRollbackHistoricalQuotationImport(rollback('PREVIEW'))).resolves.toMatchObject({
      historicalIds: [id1], deletableCount: 0, blockedCount: 1,
    });
  });

  it('rejects absent or stale tokens before any delete', async () => {
    for (const token of [undefined, 'stale']) {
      send.mockReset();
      send.mockResolvedValueOnce({ Item: manifest }).mockResolvedValueOnce({ Item: live(id1) }).mockResolvedValueOnce({});
      await expect(pbRollbackHistoricalQuotationImport(rollback('APPLY', { rollbackToken: token, reason: 'bad import' })))
        .rejects.toThrow(token ? /^CONFLICT:/ : /^VALIDATION:/);
      expect(send.mock.calls.some(c => c[0].constructor.name === 'DeleteCommand')).toBe(false);
    }
  });

  it('iterates manifest intent, atomically conditions every delete, and audits all eleven fields', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-07-14T12:00:00.000Z'));
    send.mockResolvedValueOnce({ Item: manifest }).mockResolvedValueOnce({ Item: live(id1) }).mockResolvedValueOnce({});
    const preview = await pbRollbackHistoricalQuotationImport(rollback('PREVIEW')) as { rollbackToken: string };
    send.mockReset();
    send.mockResolvedValueOnce({ Item: manifest }).mockResolvedValueOnce({ Item: live(id1) }).mockResolvedValueOnce({})
      .mockResolvedValueOnce({}) // immutable rollback intent
      .mockResolvedValueOnce({}).mockRejectedValueOnce(Object.assign(new Error(), { name: 'ConditionalCheckFailedException' }))
      .mockResolvedValueOnce({});
    const result = await pbRollbackHistoricalQuotationImport(rollback('APPLY', {
      rollbackToken: preview.rollbackToken, reason: 'incorrect workbook', requestedAt: '2026-07-14T11:59:00.000Z',
    })) as { results: Array<{ status: string }> };
    const deletes = send.mock.calls.filter(c => c[0].constructor.name === 'DeleteCommand');
    expect(deletes).toHaveLength(2);
    for (const call of deletes) expect(call[0].input).toMatchObject({
      ConditionExpression: 'recordType = :recordType AND importBatchId = :batch AND begins_with(PK, :prefix) AND SK = :meta',
      ExpressionAttributeValues: { ':recordType': 'HISTORICAL_QUOTATION', ':batch': 'HB-batch', ':prefix': 'PHIST#', ':meta': 'META' },
    });
    expect(deletes.every(c => c[0].input.Key.PK.startsWith('PHIST#'))).toBe(true);
    expect(result.results.map(r => r.status)).toEqual(['DELETED', 'ALREADY_ABSENT']);
    const intent = send.mock.calls.find(c => c[0].input.Item?.SK?.startsWith('ROLLBACK_INTENT#'))?.[0].input;
    expect(intent).toMatchObject({ ConditionExpression: 'attribute_not_exists(PK)', Item: {
      PK: 'HISTIMPORT#HB-batch', importBatchId: 'HB-batch', requestedBy: 'operator', confirmedBy: 'operator',
      reason: 'incorrect workbook', rollbackToken: preview.rollbackToken, intendedHistoricalIds: [id1, id2],
      matchedCount: 1, sourceDocumentHash: 'b'.repeat(64),
    } });
    const audit = send.mock.calls.at(-1)?.[0].input;
    expect(audit.ConditionExpression).toBe('attribute_not_exists(PK)');
    expect(Object.keys(audit.Item).sort()).toEqual([
      'PK', 'SK', 'completedAt', 'confirmedBy', 'deletedCount', 'deletedHistoricalIds', 'failedCount',
      'importBatchId', 'matchedCount', 'reason', 'requestedAt', 'requestedBy', 'sourceDocumentHash',
    ].sort());
    expect(audit.Item).toMatchObject({ PK: 'HISTIMPORT#HB-batch', SK: 'ROLLBACK#2026-07-14T12:00:00.000Z',
      importBatchId: 'HB-batch', requestedBy: 'operator', confirmedBy: 'operator',
      requestedAt: '2026-07-14T11:59:00.000Z', completedAt: '2026-07-14T12:00:00.000Z', reason: 'incorrect workbook',
      matchedCount: 1, deletedCount: 1, failedCount: 0, deletedHistoricalIds: [id1], sourceDocumentHash: 'b'.repeat(64) });
    vi.useRealTimers();
  });

  it('leaves immutable intent evidence when the final audit write fails after deletion', async () => {
    send.mockResolvedValueOnce({ Item: { ...manifest, historicalIds: [id1] } }).mockResolvedValueOnce({ Item: live(id1) });
    const preview = await pbRollbackHistoricalQuotationImport(rollback('PREVIEW')) as { rollbackToken: string };
    send.mockReset();
    send.mockResolvedValueOnce({ Item: { ...manifest, historicalIds: [id1] } }).mockResolvedValueOnce({ Item: live(id1) })
      .mockResolvedValueOnce({}).mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('audit unavailable'));
    await expect(pbRollbackHistoricalQuotationImport(rollback('APPLY', {
      rollbackToken: preview.rollbackToken, reason: 'correction',
    }))).rejects.toThrow('audit unavailable');
    const puts = send.mock.calls.filter(c => c[0].constructor.name === 'PutCommand');
    expect(puts[0][0].input).toMatchObject({ ConditionExpression: 'attribute_not_exists(PK)',
      Item: { SK: expect.stringMatching(/^ROLLBACK_INTENT#/) } });
    expect(send.mock.calls.findIndex(c => c[0].constructor.name === 'DeleteCommand')).toBeGreaterThan(
      send.mock.calls.findIndex(c => c[0].input.Item?.SK?.startsWith('ROLLBACK_INTENT#')),
    );
  });

  it.each([
    ['recordType', { recordType: 'OTHER' }], ['importBatchId', { importBatchId: 'other' }],
    ['PK', { PK: 'HISTIMPORT#evil' }], ['SK', { SK: 'MANIFEST' }],
  ])('reports BLOCKED when live %s violates deletion invariants', async (_field, mutation) => {
    const bad = live(id1, mutation);
    send.mockResolvedValueOnce({ Item: { ...manifest, historicalIds: [id1] } }).mockResolvedValueOnce({ Item: bad });
    const preview = await pbRollbackHistoricalQuotationImport(rollback('PREVIEW')) as Record<string, unknown>;
    expect(preview).toMatchObject({ deletableCount: 0, blockedCount: 1 });
    expect(send.mock.calls.some(c => c[0].constructor.name === 'DeleteCommand')).toBe(false);
  });

  it('rolls back a truncated manifest by deleting 11 live rows and reporting 10 absent rows', async () => {
    const ids = Array.from({ length: 21 }, (_, i) => i.toString(16).padStart(64, '0'));
    const batchManifest = { ...manifest, historicalIds: ids, rowCount: 21 };
    const present = new Set(ids.slice(0, 11));
    send.mockImplementation(async (command) => {
      if (!command) return {};
      const { Key, Item } = command.input;
      if (command.constructor.name === 'GetCommand' && Key.SK === 'MANIFEST') return { Item: batchManifest };
      if (command.constructor.name === 'GetCommand') {
        const id = Key.PK.slice('PHIST#'.length);
        return present.has(id) ? { Item: live(id, { contentHash: id }) } : {};
      }
      if (command.constructor.name === 'DeleteCommand') {
        const id = Key.PK.slice('PHIST#'.length);
        if (!present.delete(id)) throw Object.assign(new Error(), { name: 'ConditionalCheckFailedException' });
        return {};
      }
      if (command.constructor.name === 'PutCommand' && Item.SK.startsWith('ROLLBACK')) return {};
      throw new Error(`unexpected ${command.constructor.name}`);
    });
    const preview = await pbRollbackHistoricalQuotationImport(rollback('PREVIEW')) as { rollbackToken: string };
    const applied = await pbRollbackHistoricalQuotationImport(rollback('APPLY', {
      rollbackToken: preview.rollbackToken, reason: 'truncated import',
    })) as { results: Array<{ status: string }> };
    expect(applied.results.filter(r => r.status === 'DELETED')).toHaveLength(11);
    expect(applied.results.filter(r => r.status === 'ALREADY_ABSENT')).toHaveLength(10);
    expect(applied.results.filter(r => r.status === 'FAILED')).toHaveLength(0);
  });

  it.each([
    ['recordType', { recordType: 'OTHER' }], ['importBatchId', { importBatchId: 'other' }],
    ['PK prefix', { PK: 'HISTIMPORT#evil' }], ['SK', { SK: 'MANIFEST' }],
  ])('uses returned low-level failure Item to report wrong %s as BLOCKED at APPLY', async (_name, mutation) => {
    const oneManifest = { ...manifest, historicalIds: [id1] };
    const bad = live(id1, mutation);
    send.mockResolvedValueOnce({ Item: oneManifest }).mockResolvedValueOnce({ Item: bad });
    const preview = await pbRollbackHistoricalQuotationImport(rollback('PREVIEW')) as { rollbackToken: string };
    send.mockReset();
    send.mockResolvedValueOnce({ Item: oneManifest }).mockResolvedValueOnce({ Item: bad })
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(Object.assign(new Error(), {
        name: 'ConditionalCheckFailedException', Item: marshall(bad),
      })).mockResolvedValueOnce({});
    const applied = await pbRollbackHistoricalQuotationImport(rollback('APPLY', {
      rollbackToken: preview.rollbackToken, reason: 'unsafe row',
    })) as { results: Array<{ status: string }> };
    expect(applied.results).toEqual([{ historicalId: id1, status: 'BLOCKED' }]);
  });

  it('rejects a stale token after partial APPLY and converges after a fresh PREVIEW', async () => {
    const state = new Map([[id1, live(id1)], [id2, live(id2)]]);
    let failId2Once = true;
    send.mockImplementation(async (command) => {
      if (!command) return {};
      const { Key, Item } = command.input;
      if (command.constructor.name === 'GetCommand' && Key.SK === 'MANIFEST') return { Item: manifest };
      if (command.constructor.name === 'GetCommand') return { Item: state.get(Key.PK.slice(6)) };
      if (command.constructor.name === 'PutCommand' && Item.SK.startsWith('ROLLBACK')) return {};
      if (command.constructor.name === 'DeleteCommand') {
        const id = Key.PK.slice(6);
        if (id === id2 && failId2Once) { failId2Once = false; throw new Error('temporary'); }
        if (!state.delete(id)) throw Object.assign(new Error(), { name: 'ConditionalCheckFailedException' });
        return {};
      }
      throw new Error(`unexpected ${command.constructor.name}`);
    });
    const firstPreview = await pbRollbackHistoricalQuotationImport(rollback('PREVIEW')) as { rollbackToken: string };
    const partial = await pbRollbackHistoricalQuotationImport(rollback('APPLY', {
      rollbackToken: firstPreview.rollbackToken, reason: 'correct batch',
    })) as { results: Array<{ status: string }> };
    expect(partial.results.map(r => r.status)).toEqual(['DELETED', 'FAILED']);
    await expect(pbRollbackHistoricalQuotationImport(rollback('APPLY', {
      rollbackToken: firstPreview.rollbackToken, reason: 'retry',
    }))).rejects.toThrow(/^CONFLICT:.*stale/);
    const secondPreview = await pbRollbackHistoricalQuotationImport(rollback('PREVIEW')) as { rollbackToken: string };
    expect(secondPreview.rollbackToken).not.toBe(firstPreview.rollbackToken);
    const recovered = await pbRollbackHistoricalQuotationImport(rollback('APPLY', {
      rollbackToken: secondPreview.rollbackToken, reason: 'retry',
    })) as { results: Array<{ status: string }> };
    expect(recovered.results.map(r => r.status)).toEqual(['ALREADY_ABSENT', 'DELETED']);
    expect(state.size).toBe(0);
  });
});
