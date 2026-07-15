import { beforeEach, describe, expect, it, vi } from 'vitest';

const send = vi.fn();
vi.mock('../lib/dynamodb.js', () => ({
  docClient: { send: (...args: unknown[]) => send(...args) },
  TABLE_NAME: () => 'TestTable',
}));

import {
  pbGetHistoricalQuotation,
  pbListHistoricalQuotations,
} from './historicalQuotationResolvers.js';

const historicalId = 'a'.repeat(64);
const ev = (args: Record<string, unknown>) => ({
  info: { fieldName: 'x', parentTypeName: 'Query' },
  arguments: args,
  identity: { sub: 'operator', groups: ['admin'] },
});

beforeEach(() => send.mockReset());

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
