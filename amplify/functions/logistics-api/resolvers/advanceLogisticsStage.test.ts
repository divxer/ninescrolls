import { describe, it, expect, vi, beforeEach } from 'vitest';

const send = vi.fn();
vi.mock('../lib/dynamodb.js', () => ({
  docClient: { send: (...a: unknown[]) => send(...a) },
  TABLE_NAME: () => 'TestTable',
}));

const emitTimelineEventToCrm = vi.fn();
vi.mock('../../../lib/crm/invoke-crm-api', () => ({
  emitTimelineEventToCrm: (...a: unknown[]) => emitTimelineEventToCrm(...a),
}));

import { advanceLogisticsStage } from './advanceLogisticsStage.js';

beforeEach(() => {
  send.mockReset();
  emitTimelineEventToCrm.mockReset();
});

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

  it('emits a logistics_milestone, keying off the related order matchedOrgId', async () => {
    const related = { ...baseCase, relatedOrderId: 'ord-9' };
    send
      .mockResolvedValueOnce({ Item: { ...related } })                              // fetchCase
      .mockResolvedValueOnce({})                                                    // UpdateCommand
      .mockResolvedValueOnce({ Item: { ...related, currentStage: 'PRODUCTION' } })  // buildCaseResponse
      .mockResolvedValueOnce({ Item: { matchedOrgId: 'ORG#acme' } });              // GetCommand ORDER META
    await advanceLogisticsStage(evt({ caseId: 'lc-1', targetStage: 'PRODUCTION' }));

    expect(emitTimelineEventToCrm).toHaveBeenCalledTimes(1);
    const emitArgs = emitTimelineEventToCrm.mock.calls[0][0];
    const appendedEntry = send.mock.calls[1][0].input.ExpressionAttributeValues[':log'][0];
    expect(emitArgs.kind).toBe('logistics_milestone');
    expect(emitArgs.idInput.milestoneId).toBe(appendedEntry.id);
    expect(appendedEntry.id).toMatch(/^mlog-/);
    expect(emitArgs.idInput.stage).toBe('PRODUCTION');
    expect(emitArgs.isInternalOnly).toBe(false);
    expect(emitArgs.resolveInput.matchedOrgId).toBe('ORG#acme');

    // ORDER META lookup keyed off the related order id.
    const getInput = send.mock.calls[3][0].input;
    expect(getInput.Key).toEqual({ PK: 'ORDER#ord-9', SK: 'META' });
  });

  it('emits with undefined matchedOrgId when the case has no relatedOrderId', async () => {
    send
      .mockResolvedValueOnce({ Item: { ...baseCase } })                                 // fetchCase
      .mockResolvedValueOnce({})                                                        // UpdateCommand
      .mockResolvedValueOnce({ Item: { ...baseCase, currentStage: 'PRODUCTION' } });    // buildCaseResponse
    await advanceLogisticsStage(evt({ caseId: 'lc-1', targetStage: 'PRODUCTION' }));

    expect(emitTimelineEventToCrm).toHaveBeenCalledTimes(1);
    const emitArgs = emitTimelineEventToCrm.mock.calls[0][0];
    expect(emitArgs.resolveInput.matchedOrgId).toBeUndefined();
    // No ORDER META GetCommand was issued.
    expect(send).toHaveBeenCalledTimes(3);
  });

  it('passes an internalOnly milestone through to isInternalOnly', async () => {
    send
      .mockResolvedValueOnce({ Item: { ...baseCase } })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ Item: { ...baseCase, currentStage: 'PRODUCTION' } });
    await advanceLogisticsStage(evt({ caseId: 'lc-1', targetStage: 'PRODUCTION', internalOnly: true }));

    const emitArgs = emitTimelineEventToCrm.mock.calls[0][0];
    expect(emitArgs.isInternalOnly).toBe(true);
  });
});
