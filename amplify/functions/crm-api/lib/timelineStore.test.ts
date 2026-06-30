import { describe, it, expect, vi, beforeEach } from 'vitest';
const mockSend = vi.fn();
vi.mock('./dynamodb', () => ({ docClient: { send: (...a: unknown[]) => mockSend(...a) }, TABLE_NAME: () => 'T' }));
import { markRollupApplied } from './timelineStore';
beforeEach(() => mockSend.mockReset());

describe('markRollupApplied', () => {
  it('sets rollupApplied=true and removes rollupPendingOrgId for the event', async () => {
    mockSend.mockResolvedValueOnce({});
    await markRollupApplied('tev-rfq-rfq-1-submitted');
    const upd = mockSend.mock.calls[0][0].input;
    expect(upd.Key).toEqual({ PK: 'TLEVENT#tev-rfq-rfq-1-submitted', SK: 'A' });
    expect(upd.UpdateExpression).toBe('SET rollupApplied = :t REMOVE rollupPendingOrgId');
    expect(upd.ExpressionAttributeValues).toEqual({ ':t': true });
  });
});
