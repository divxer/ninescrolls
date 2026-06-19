import { describe, it, expect, vi, beforeEach } from 'vitest';

const send = vi.fn();
vi.mock('../lib/dynamodb.js', () => ({
  docClient: { send: (...a: unknown[]) => send(...a) },
  TABLE_NAME: () => 'TestTable',
}));

import { createLogisticsCase } from './createLogisticsCase.js';

beforeEach(() => send.mockReset());

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
    expect(res).not.toBeNull();
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
