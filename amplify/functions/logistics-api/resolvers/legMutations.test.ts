import { describe, it, expect, vi, beforeEach } from 'vitest';

const send = vi.fn();
vi.mock('../lib/dynamodb.js', () => ({
  docClient: { send: (...a: unknown[]) => send(...a) },
  TABLE_NAME: () => 'TestTable',
}));

import { addLeg, updateLeg, removeLeg } from './legMutations.js';

beforeEach(() => send.mockReset());

const caseWithLeg = (legs: unknown[]) => ({
  Item: {
    PK: 'LOGISTICS#lc-1', SK: 'META', caseId: 'lc-1', caseType: 'SAMPLE',
    customerName: 'X', currentStage: 'DRAFT', enabledStages: [], legs, milestoneLog: [],
    customsRequired: false, isCustomerVisible: false, createdAt: 'x', updatedAt: 'x', createdBy: 'u',
  },
});

function evt(fieldName: string, args: Record<string, unknown>) {
  return { info: { fieldName, parentTypeName: 'Mutation' }, arguments: args, identity: { sub: 'u' } };
}

describe('leg mutations', () => {
  it('addLeg appends a leg with a generated id and validates direction', async () => {
    send.mockResolvedValueOnce(caseWithLeg([])).mockResolvedValueOnce({}).mockResolvedValueOnce(caseWithLeg([{}]));
    await addLeg(evt('addLeg', { caseId: 'lc-1', input: JSON.stringify({ direction: 'INBOUND', carrier: 'FedEx' }) }));
    const upd = send.mock.calls[1][0].input;
    expect(upd.ConditionExpression).toContain('updatedAt = :expectedUpdatedAt');
    expect(upd.ExpressionAttributeValues[':legs']).toHaveLength(1);
    expect(upd.ExpressionAttributeValues[':legs'][0].legId).toMatch(/^leg-/);
    expect(upd.ExpressionAttributeValues[':legs'][0].direction).toBe('INBOUND');
  });

  it('addLeg rejects an invalid direction', async () => {
    send.mockResolvedValueOnce(caseWithLeg([]));
    await expect(addLeg(evt('addLeg', { caseId: 'lc-1', input: JSON.stringify({ direction: 'SIDEWAYS' }) })))
      .rejects.toThrow(/direction/);
  });

  it('updateLeg edits an existing leg by id', async () => {
    send.mockResolvedValueOnce(caseWithLeg([{ legId: 'leg-1', direction: 'INBOUND' }]))
      .mockResolvedValueOnce({}).mockResolvedValueOnce(caseWithLeg([{}]));
    await updateLeg(evt('updateLeg', { caseId: 'lc-1', legId: 'leg-1', input: JSON.stringify({ customsStatus: 'RELEASED' }) }));
    const upd = send.mock.calls[1][0].input;
    expect(upd.ExpressionAttributeValues[':legs'][0].customsStatus).toBe('RELEASED');
  });

  it('updateLeg can clear optional fields with null', async () => {
    send.mockResolvedValueOnce(caseWithLeg([{ legId: 'leg-1', direction: 'INBOUND', trackingUrl: 'https://x.test', customsStatus: 'FILED' }]))
      .mockResolvedValueOnce({}).mockResolvedValueOnce(caseWithLeg([{}]));
    await updateLeg(evt('updateLeg', { caseId: 'lc-1', legId: 'leg-1', input: JSON.stringify({ trackingUrl: null, customsStatus: null }) }));
    const leg = send.mock.calls[1][0].input.ExpressionAttributeValues[':legs'][0];
    expect(leg.trackingUrl).toBeNull();
    expect(leg.customsStatus).toBeNull();
  });

  it('surfaces a concurrency error when legs changed after fetch', async () => {
    send.mockResolvedValueOnce(caseWithLeg([{ legId: 'leg-1', direction: 'INBOUND' }]))
      .mockRejectedValueOnce({ name: 'ConditionalCheckFailedException' });
    await expect(updateLeg(evt('updateLeg', { caseId: 'lc-1', legId: 'leg-1', input: JSON.stringify({ carrier: 'DHL' }) })))
      .rejects.toThrow(/updated by another user/i);
  });

  it('updateLeg throws when leg id not found', async () => {
    send.mockResolvedValueOnce(caseWithLeg([{ legId: 'leg-1' }]));
    await expect(updateLeg(evt('updateLeg', { caseId: 'lc-1', legId: 'nope', input: '{}' })))
      .rejects.toThrow(/leg not found/i);
  });

  it('removeLeg drops the leg by id', async () => {
    send.mockResolvedValueOnce(caseWithLeg([{ legId: 'leg-1' }, { legId: 'leg-2' }]))
      .mockResolvedValueOnce({}).mockResolvedValueOnce(caseWithLeg([{}]));
    await removeLeg(evt('removeLeg', { caseId: 'lc-1', legId: 'leg-1' }));
    const upd = send.mock.calls[1][0].input;
    expect(upd.ExpressionAttributeValues[':legs']).toHaveLength(1);
    expect(upd.ExpressionAttributeValues[':legs'][0].legId).toBe('leg-2');
  });

  it('removeLeg throws when leg id not found (no silent success)', async () => {
    send.mockResolvedValueOnce(caseWithLeg([{ legId: 'leg-1' }]));
    await expect(removeLeg(evt('removeLeg', { caseId: 'lc-1', legId: 'nope' })))
      .rejects.toThrow(/leg not found/i);
  });
});
