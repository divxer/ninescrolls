import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';

const send = vi.fn();
vi.mock('../lib/dynamodb.js', () => ({
  docClient: { send: (...a: unknown[]) => send(...a) },
  TABLE_NAME: () => 'TestTable',
}));

import { logisticsStats } from './logisticsStats.js';

beforeEach(() => send.mockReset());

describe('logisticsStats', () => {
  it('aggregates counts by type, stage, customs, and stalled via a GSI1 Query', async () => {
    const old = '2020-01-01T00:00:00Z';
    send.mockResolvedValueOnce({
      Items: [
        { caseType: 'EQUIPMENT', currentStage: 'IMPORT_CUSTOMS', updatedAt: old },
        { caseType: 'SAMPLE', currentStage: 'TESTING', updatedAt: new Date().toISOString() },
        { caseType: 'SAMPLE', currentStage: 'CLOSED', updatedAt: old },
      ],
      LastEvaluatedKey: undefined,
    });
    const s = await logisticsStats({ info: { fieldName: 'logisticsStats', parentTypeName: 'Query' }, arguments: {} });
    expect(send.mock.calls[0][0]).toBeInstanceOf(QueryCommand);
    const byType = JSON.parse(s.byType);
    const byStage = JSON.parse(s.byStage);
    expect(byType.SAMPLE).toBe(2);
    expect(byStage.IMPORT_CUSTOMS).toBe(1);
    expect(s.customsInProgress).toBe(1);
    expect(s.stalledCases).toBe(1); // EQUIPMENT/IMPORT_CUSTOMS is old & non-terminal; CLOSED excluded
    expect(s.totalActive).toBe(2);  // CLOSED excluded
  });
});
