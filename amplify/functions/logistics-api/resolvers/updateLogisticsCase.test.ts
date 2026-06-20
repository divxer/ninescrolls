import { describe, it, expect, vi, beforeEach } from 'vitest';

const send = vi.fn();
vi.mock('../lib/dynamodb.js', () => ({
  docClient: { send: (...a: unknown[]) => send(...a) },
  TABLE_NAME: () => 'TestTable',
}));

import { updateLogisticsCase } from './updateLogisticsCase.js';

beforeEach(() => send.mockReset());

function evt(input: Record<string, unknown>) {
  return {
    info: { fieldName: 'updateLogisticsCase', parentTypeName: 'Mutation' },
    arguments: { caseId: 'lc-1', input: JSON.stringify(input) },
    identity: { sub: 'u-1', claims: { email: 'harvey@ninescrolls.com' } },
  };
}

describe('updateLogisticsCase', () => {
  it('updates whitelisted fields, refreshes GSI1SK, ignores frozen/unknown fields', async () => {
    send.mockResolvedValueOnce({}).mockResolvedValueOnce({ Item: { caseId: 'lc-1' } });
    await updateLogisticsCase(evt({
      customerName: 'BAE', customsRequired: true,
      caseType: 'HACK',            // unknown → ignored
      isCustomerVisible: true,     // Phase 2 frozen → ignored
    }));
    const upd = send.mock.calls[0][0].input;
    expect(upd.ExpressionAttributeValues[':customerName']).toBe('BAE');
    expect(upd.ExpressionAttributeValues[':customsRequired']).toBe(true);
    expect(upd.ExpressionAttributeValues[':gsi1sk']).toMatch(/#lc-1$/);
    expect(upd.ExpressionAttributeValues[':isCustomerVisible']).toBeUndefined();
    expect(JSON.stringify(upd)).not.toContain('HACK');
  });

  it('requires the case to already exist before updating', async () => {
    send.mockRejectedValueOnce({ name: 'ConditionalCheckFailedException' });
    await expect(updateLogisticsCase(evt({ customerName: 'BAE' })))
      .rejects.toThrow(/not found/i);
    const upd = send.mock.calls[0][0].input;
    expect(upd.ConditionExpression).toContain('attribute_exists');
  });

  it('allows clearing related entity fields with null', async () => {
    send.mockResolvedValueOnce({}).mockResolvedValueOnce({ Item: { caseId: 'lc-1' } });
    await updateLogisticsCase(evt({ relatedEntityType: null, relatedEntityId: null }));
    const upd = send.mock.calls[0][0].input;
    expect(upd.UpdateExpression).toContain('REMOVE relatedEntityType, relatedEntityId');
    expect(upd.ExpressionAttributeValues[':relatedEntityType']).toBeUndefined();
  });

  it('rejects an invalid relatedEntityType', async () => {
    await expect(updateLogisticsCase(evt({ relatedEntityType: 'BOGUS' })))
      .rejects.toThrow(/relatedEntityType/);
  });

  it('throws when no editable fields supplied', async () => {
    await expect(updateLogisticsCase(evt({}))).rejects.toThrow(/no.*fields/i);
  });
});
