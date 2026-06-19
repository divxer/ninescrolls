import { describe, it, expect, vi, beforeEach } from 'vitest';

const send = vi.fn();
vi.mock('../lib/dynamodb.js', () => ({
  docClient: { send: (...a: unknown[]) => send(...a) },
  TABLE_NAME: () => 'TestTable',
}));

import { advanceLogisticsStage } from './advanceLogisticsStage.js';

beforeEach(() => send.mockReset());

const baseCase = {
  PK: 'LOGISTICS#lc-1', SK: 'META', GSI1PK: 'LOGISTICS_CASES', GSI1SK: 'x',
  caseId: 'lc-1', caseNumber: 'NS-LOG-2026-0001', caseType: 'EQUIPMENT',
  customerName: 'HORIBA', customsRequired: true, currentStage: 'DRAFT',
  enabledStages: ['PRODUCTION', 'FAT_PASSED'], legs: [], milestoneLog: [],
  isCustomerVisible: false, createdAt: 'x', updatedAt: 'x', createdBy: 'u',
};

function evt(args: Record<string, unknown>) {
  return {
    info: { fieldName: 'advanceLogisticsStage', parentTypeName: 'Mutation' },
    arguments: args,
    identity: { sub: 'u-1', claims: { email: 'harvey@ninescrolls.com' } },
  };
}

describe('advanceLogisticsStage', () => {
  it('advances to an enabled stage and appends a log entry', async () => {
    send
      .mockResolvedValueOnce({ Item: { ...baseCase } })            // fetchCase
      .mockResolvedValueOnce({})                                   // UpdateCommand
      .mockResolvedValueOnce({ Item: { ...baseCase, currentStage: 'PRODUCTION' } }); // build response
    const res = await advanceLogisticsStage(evt({ caseId: 'lc-1', targetStage: 'PRODUCTION', detail: 'kickoff' }));
    const upd = send.mock.calls[1][0].input;
    expect(upd.ExpressionAttributeValues[':stage']).toBe('PRODUCTION');
    // Listing partition is constant; only the recency sort key is refreshed.
    expect(upd.ExpressionAttributeValues[':gsi1sk']).toMatch(/#lc-1$/);
    expect(upd.UpdateExpression).not.toContain('GSI1PK');
    expect(upd.ExpressionAttributeValues[':log'][0].toStage).toBe('PRODUCTION');
    expect(res?.currentStage).toBe('PRODUCTION');
  });

  it('rejects a stage not enabled for the case type', async () => {
    send.mockResolvedValueOnce({ Item: { ...baseCase } });
    await expect(advanceLogisticsStage(evt({ caseId: 'lc-1', targetStage: 'TESTING' })))
      .rejects.toThrow(/not enabled/i);
  });

  it('throws when the case does not exist', async () => {
    send.mockResolvedValueOnce({ Item: null });
    await expect(advanceLogisticsStage(evt({ caseId: 'missing', targetStage: 'PRODUCTION' })))
      .rejects.toThrow(/not found/i);
  });
});
