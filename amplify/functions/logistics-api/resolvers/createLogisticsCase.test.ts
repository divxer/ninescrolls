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

import { createLogisticsCase } from './createLogisticsCase.js';

beforeEach(() => {
  send.mockReset();
  emitTimelineEventToCrm.mockReset();
});

function evt(input: Record<string, unknown>) {
  return {
    info: { fieldName: 'createLogisticsCase', parentTypeName: 'Mutation' },
    arguments: { input: JSON.stringify(input) },
    identity: { sub: 'u-1', claims: { email: 'harvey@ninescrolls.com' } },
  };
}

describe('createLogisticsCase', () => {
  it('creates a DRAFT case with sequential caseNumber and enabled subset', async () => {
    // 1st send = counter UpdateCommand → returns seq; 2nd = PutCommand; 3rd = GetCommand (buildCaseResponse)
    send
      .mockResolvedValueOnce({ Attributes: { seq: 7 } })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ Item: { PK: 'LOGISTICS#lc-x', SK: 'META', caseId: 'lc-x', currentStage: 'DRAFT' } });

    const res = await createLogisticsCase(
      evt({ caseType: 'EQUIPMENT', customerName: 'HORIBA', customsRequired: true }),
    );

    const put = send.mock.calls[1][0].input;
    expect(put.Item.currentStage).toBe('DRAFT');
    expect(put.Item.caseType).toBe('EQUIPMENT');
    expect(put.Item.caseNumber).toMatch(/^NS-LOG-\d{4}-0007$/);
    expect(put.Item.enabledStages).toContain('FAT_PASSED');
    expect(put.Item.legs).toEqual([]);
    expect(put.Item.milestoneLog).toHaveLength(1);
    expect(put.Item.milestoneLog[0].action).toBe('CASE_CREATED');
    expect(put.Item.GSI1PK).toBe('LOGISTICS_CASES');
    expect(put.Item.GSI1SK).toMatch(/#lc-/);
    expect(put.ConditionExpression).toBe('attribute_not_exists(PK)');
    expect(res).not.toBeNull();
  });

  it('emits a logistics_milestone keyed off the related order matchedOrgId', async () => {
    // counter Update → Put → buildCaseResponse Get → ORDER META Get
    send
      .mockResolvedValueOnce({ Attributes: { seq: 3 } })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ Item: { PK: 'LOGISTICS#lc-x', SK: 'META', caseId: 'lc-x', currentStage: 'DRAFT' } })
      .mockResolvedValueOnce({ Item: { matchedOrgId: 'ORG#acme' } });

    await createLogisticsCase(
      evt({ caseType: 'EQUIPMENT', customerName: 'HORIBA', relatedOrderId: 'ord-9' }),
    );

    expect(emitTimelineEventToCrm).toHaveBeenCalledTimes(1);
    const emitArgs = emitTimelineEventToCrm.mock.calls[0][0];
    const initialEntry = send.mock.calls[1][0].input.Item.milestoneLog[0];
    expect(emitArgs.kind).toBe('logistics_milestone');
    expect(emitArgs.idInput.milestoneId).toBe(initialEntry.id);
    expect(initialEntry.id).toMatch(/^mlog-/);
    expect(emitArgs.idInput.stage).toBe('DRAFT');
    expect(emitArgs.summary).toMatch(/created/i);
    expect(emitArgs.summary).toMatch(/EQUIPMENT/);
    expect(emitArgs.isInternalOnly).toBe(initialEntry.internalOnly);
    expect(emitArgs.resolveInput.matchedOrgId).toBe('ORG#acme');

    // ORDER META lookup keyed off the related order id.
    const getInput = send.mock.calls[3][0].input;
    expect(getInput.Key).toEqual({ PK: 'ORDER#ord-9', SK: 'META' });
  });

  it('emits with undefined matchedOrgId when there is no relatedOrderId', async () => {
    send
      .mockResolvedValueOnce({ Attributes: { seq: 4 } })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ Item: { PK: 'LOGISTICS#lc-y', SK: 'META', caseId: 'lc-y', currentStage: 'DRAFT' } });

    await createLogisticsCase(evt({ caseType: 'SAMPLE', customerName: 'HORIBA' }));

    expect(emitTimelineEventToCrm).toHaveBeenCalledTimes(1);
    const emitArgs = emitTimelineEventToCrm.mock.calls[0][0];
    expect(emitArgs.resolveInput.matchedOrgId).toBeUndefined();
    // No ORDER META GetCommand issued.
    expect(send).toHaveBeenCalledTimes(3);
  });

  it('rejects an unknown caseType', async () => {
    await expect(createLogisticsCase(evt({ caseType: 'BOGUS', customerName: 'X' })))
      .rejects.toThrow(/caseType/);
  });

  it('rejects a missing customerName', async () => {
    await expect(createLogisticsCase(evt({ caseType: 'SAMPLE' })))
      .rejects.toThrow(/customerName/);
  });
});
