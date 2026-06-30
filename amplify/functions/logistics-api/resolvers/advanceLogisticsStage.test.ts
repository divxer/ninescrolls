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
    expect(upd.ConditionExpression).toContain('#currentStage = :expectedStage');
    expect(upd.UpdateExpression).toContain('list_append');
    // Listing partition is constant; only the recency sort key is refreshed.
    expect(upd.ExpressionAttributeValues[':gsi1sk']).toMatch(/#lc-1$/);
    expect(upd.UpdateExpression).not.toContain('GSI1PK');
    expect(upd.ExpressionAttributeValues[':log'][0].toStage).toBe('PRODUCTION');
    expect(res?.currentStage).toBe('PRODUCTION');
  });

  it('surfaces a concurrency error when the stage changed after fetch', async () => {
    send
      .mockResolvedValueOnce({ Item: { ...baseCase } })
      .mockRejectedValueOnce({ name: 'ConditionalCheckFailedException' });
    await expect(advanceLogisticsStage(evt({ caseId: 'lc-1', targetStage: 'PRODUCTION' })))
      .rejects.toThrow(/updated by another user/i);
  });

  it('rejects a stage not enabled for the case type', async () => {
    send.mockResolvedValueOnce({ Item: { ...baseCase } });
    await expect(advanceLogisticsStage(evt({ caseId: 'lc-1', targetStage: 'TESTING' })))
      .rejects.toThrow(/not enabled/i);
  });

  it('rejects a stage that is not in the case stored enabledStages', async () => {
    send.mockResolvedValueOnce({ Item: { ...baseCase, enabledStages: ['PRODUCTION'] } });
    await expect(advanceLogisticsStage(evt({ caseId: 'lc-1', targetStage: 'FAT_PASSED' })))
      .rejects.toThrow(/not enabled/i);
  });

  it('throws when the case does not exist', async () => {
    send.mockResolvedValueOnce({ Item: null });
    await expect(advanceLogisticsStage(evt({ caseId: 'missing', targetStage: 'PRODUCTION' })))
      .rejects.toThrow(/not found/i);
  });

  it('omits the detail field entirely when no note is provided (no undefined written to DynamoDB)', async () => {
    send
      .mockResolvedValueOnce({ Item: { ...baseCase } })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ Item: { ...baseCase, currentStage: 'PRODUCTION' } });
    await advanceLogisticsStage(evt({ caseId: 'lc-1', targetStage: 'PRODUCTION' }));

    // The DocumentClient rejects undefined values (no removeUndefinedValues), so a blank
    // Note must not produce a detail:undefined key on the appended milestone entry.
    const appendedEntry = send.mock.calls[1][0].input.ExpressionAttributeValues[':log'][0];
    expect('detail' in appendedEntry).toBe(false);
    expect(Object.values(appendedEntry)).not.toContain(undefined);
  });

  it('keeps the detail field when a note is provided', async () => {
    send
      .mockResolvedValueOnce({ Item: { ...baseCase } })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ Item: { ...baseCase, currentStage: 'PRODUCTION' } });
    await advanceLogisticsStage(evt({ caseId: 'lc-1', targetStage: 'PRODUCTION', detail: 'kickoff' }));
    const appendedEntry = send.mock.calls[1][0].input.ExpressionAttributeValues[':log'][0];
    expect(appendedEntry.detail).toBe('kickoff');
  });
});
