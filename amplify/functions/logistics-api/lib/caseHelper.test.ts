import { describe, it, expect, vi, beforeEach } from 'vitest';

const send = vi.fn();
vi.mock('./dynamodb.js', () => ({
  docClient: { send: (...a: unknown[]) => send(...a) },
  TABLE_NAME: () => 'TestTable',
}));

import { fetchCase } from './caseHelper.js';

beforeEach(() => send.mockReset());

describe('fetchCase', () => {
  it('returns the META item for a caseId', async () => {
    send.mockResolvedValueOnce({ Item: { caseId: 'lc-1', SK: 'META', currentStage: 'DRAFT' } });
    const c = await fetchCase('lc-1');
    expect(c?.caseId).toBe('lc-1');
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('returns null when not found', async () => {
    send.mockResolvedValueOnce({});
    expect(await fetchCase('missing')).toBeNull();
  });
});
