import { describe, it, expect, vi, beforeEach } from 'vitest';

const send = vi.fn();
vi.mock('../lib/dynamodb.js', () => ({
  docClient: { send: (...a: unknown[]) => send(...a) },
  TABLE_NAME: () => 'TestTable',
}));

import { getLogisticsCase } from './getLogisticsCase.js';

beforeEach(() => send.mockReset());

describe('getLogisticsCase', () => {
  it('returns the case response without DDB keys', async () => {
    send.mockResolvedValueOnce({
      Item: { PK: 'LOGISTICS#lc-1', SK: 'META', GSI1PK: 'x', GSI1SK: 'y', caseId: 'lc-1', currentStage: 'DRAFT' },
    });
    const res = await getLogisticsCase({
      info: { fieldName: 'getLogisticsCase', parentTypeName: 'Query' },
      arguments: { caseId: 'lc-1' },
    });
    expect(res?.caseId).toBe('lc-1');
    expect((res as Record<string, unknown>).PK).toBeUndefined();
  });

  it('throws when caseId missing', async () => {
    await expect(getLogisticsCase({
      info: { fieldName: 'getLogisticsCase', parentTypeName: 'Query' }, arguments: {},
    })).rejects.toThrow(/caseId/);
  });
});
