import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';

const send = vi.fn();
vi.mock('../lib/dynamodb.js', () => ({
  docClient: { send: (...a: unknown[]) => send(...a) },
  TABLE_NAME: () => 'TestTable',
}));

import { listLogisticsCases } from './listLogisticsCases.js';

beforeEach(() => send.mockReset());

function item(over: Record<string, unknown>) {
  return {
    PK: `LOGISTICS#${over.caseId}`, SK: 'META', GSI1PK: 'LOGISTICS_CASES', GSI1SK: 'y',
    caseId: 'lc-x', caseType: 'EQUIPMENT', currentStage: 'IN_TRANSIT',
    customsRequired: true, updatedAt: '2026-06-01T00:00:00Z', legs: [], milestoneLog: [],
    ...over,
  };
}

function evt(args: Record<string, unknown>) {
  return { info: { fieldName: 'listLogisticsCases', parentTypeName: 'Query' }, arguments: args };
}

describe('listLogisticsCases', () => {
  it('always Queries the LOGISTICS_CASES listing partition and never Scans', async () => {
    send.mockResolvedValueOnce({ Items: [item({ caseId: 'lc-1' })], LastEvaluatedKey: undefined });
    const res = await listLogisticsCases(evt({}));

    // P0: every command issued must be a QueryCommand, none a ScanCommand.
    for (const call of send.mock.calls) {
      expect(call[0]).toBeInstanceOf(QueryCommand);
      expect(call[0]).not.toBeInstanceOf(ScanCommand);
    }
    const cmd = send.mock.calls[0][0].input;
    expect(cmd.IndexName).toBe('GSI1');
    expect(cmd.ExpressionAttributeValues[':pk']).toBe('LOGISTICS_CASES');
    expect(cmd.ScanIndexForward).toBe(false);
    expect(res.items[0].caseId).toBe('lc-1');
    expect((res.items[0] as Record<string, unknown>).PK).toBeUndefined();
    expect(res.nextToken).toBeNull();
  });

  it('filters by stage in-memory over the listing Query (still no Scan)', async () => {
    send.mockResolvedValueOnce({
      Items: [item({ caseId: 'lc-1', currentStage: 'IN_TRANSIT' }), item({ caseId: 'lc-2', currentStage: 'DELIVERED' })],
      LastEvaluatedKey: undefined,
    });
    const res = await listLogisticsCases(evt({ stage: 'IN_TRANSIT' }));
    expect(send.mock.calls[0][0]).toBeInstanceOf(QueryCommand);
    expect(res.items).toHaveLength(1);
    expect(res.items[0].currentStage).toBe('IN_TRANSIT');
  });

  it('filters by caseType in-memory', async () => {
    send.mockResolvedValueOnce({
      Items: [item({ caseId: 'lc-1', caseType: 'SAMPLE' }), item({ caseId: 'lc-2', caseType: 'EQUIPMENT' })],
      LastEvaluatedKey: undefined,
    });
    const res = await listLogisticsCases(evt({ caseType: 'SAMPLE' }));
    expect(res.items).toHaveLength(1);
    expect(res.items[0].caseType).toBe('SAMPLE');
  });

  it('treats AppSync null args (unset variables) as "no filter" — does not drop cases', async () => {
    // AppSync sends explicitly-unset GraphQL variables as `null`, not `undefined`.
    // The customsRequired filter must treat null like undefined, or every case is dropped.
    send.mockResolvedValueOnce({
      Items: [item({ caseId: 'lc-1', customsRequired: true })],
      LastEvaluatedKey: undefined,
    });
    const res = await listLogisticsCases(evt({
      stage: null, caseType: null, customsRequired: null, search: null, limit: 50, nextToken: null,
    }));
    expect(res.items).toHaveLength(1);
    expect(res.items[0].caseId).toBe('lc-1');
  });

  it('still filters when customsRequired is an explicit boolean', async () => {
    send.mockResolvedValueOnce({
      Items: [item({ caseId: 'lc-1', customsRequired: true }), item({ caseId: 'lc-2', customsRequired: false })],
      LastEvaluatedKey: undefined,
    });
    const res = await listLogisticsCases(evt({ customsRequired: false }));
    expect(res.items).toHaveLength(1);
    expect(res.items[0].caseId).toBe('lc-2');
  });

  it('bounds each DynamoDB page to the requested limit so overflow items are not dropped', async () => {
    send.mockResolvedValueOnce({
      Items: [item({ caseId: 'lc-1' }), item({ caseId: 'lc-2' })],
      LastEvaluatedKey: { PK: 'LOGISTICS#lc-2', SK: 'META' },
    });
    const res = await listLogisticsCases(evt({ limit: 2 }));
    expect(send.mock.calls[0][0].input.Limit).toBe(2);
    expect(res.items.map((it) => it.caseId)).toEqual(['lc-1', 'lc-2']);
    expect(res.nextToken).toBeTruthy();
  });

  it('filters by relatedOrderId (exact, trimmed)', async () => {
    send.mockResolvedValueOnce({
      Items: [
        item({ caseId: 'lc-1', relatedOrderId: 'ord-1' }),
        item({ caseId: 'lc-2', relatedOrderId: 'ord-2' }),
        item({ caseId: 'lc-3' }), // no relatedOrderId
      ],
      LastEvaluatedKey: undefined,
    });
    const res = await listLogisticsCases(evt({ relatedOrderId: '  ord-1  ' }));
    expect(res.items.map((it) => it.caseId)).toEqual(['lc-1']);
  });

  it('treats a null relatedOrderId (AppSync unset) as no filter', async () => {
    send.mockResolvedValueOnce({
      Items: [item({ caseId: 'lc-1', relatedOrderId: 'ord-1' }), item({ caseId: 'lc-2' })],
      LastEvaluatedKey: undefined,
    });
    const res = await listLogisticsCases(evt({ relatedOrderId: null }));
    expect(res.items).toHaveLength(2);
  });
});
