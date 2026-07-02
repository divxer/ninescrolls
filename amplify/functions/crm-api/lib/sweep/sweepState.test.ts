import { describe, it, expect, vi, beforeEach } from 'vitest';
const mockSend = vi.fn();
vi.mock('../dynamodb', () => ({ docClient: { send: (...a: unknown[]) => mockSend(...a) }, TABLE_NAME: () => 'T' }));
import { readState, acquireLease, persistPage, releaseLease, releaseLeaseKeepCursor, stateKey } from './sweepState';
beforeEach(() => mockSend.mockReset());

describe('sweepState', () => {
  it('stateKey namespaces by mode#pass', () => {
    expect(stateKey('cold', 'existence')).toEqual({ PK: 'CRM_SWEEP#cold#existence', SK: 'STATE' });
  });
  it('acquireLease succeeds when no active lease (conditional update) and returns a token', async () => {
    mockSend.mockResolvedValueOnce({}); // conditional update ok
    const token = await acquireLease('cold', 'existence', 120, '2026-06-30T00:00:00.000Z');
    expect(typeof token).toBe('string');
    const upd = mockSend.mock.calls[0][0].input;
    expect(upd.ConditionExpression).toMatch(/attribute_not_exists\(lease\)|leaseExpiresAt < :now/);
  });
  it('acquireLease returns null when an active lease is held (ConditionalCheckFailed)', async () => {
    mockSend.mockRejectedValueOnce(Object.assign(new Error('held'), { name: 'ConditionalCheckFailedException' }));
    expect(await acquireLease('cold', 'existence', 120, '2026-06-30T00:00:00.000Z')).toBeNull();
  });
  it('acquireLease leaseExpiresAt honors the max(2×timeout, 300s) floor', async () => {
    mockSend.mockResolvedValueOnce({}); // timeout 30s → 2×=60 < 300 floor → +300s
    await acquireLease('cold', 'existence', 30, '2026-06-30T00:00:00.000Z');
    expect(mockSend.mock.calls[0][0].input.ExpressionAttributeValues[':exp']).toBe('2026-06-30T00:05:00.000Z');
  });
  it('acquireLease leaseExpiresAt uses 2×timeout when above the floor', async () => {
    mockSend.mockResolvedValueOnce({}); // timeout 200s → 2×=400 > 300 → +400s
    await acquireLease('cold', 'existence', 200, '2026-06-30T00:00:00.000Z');
    expect(mockSend.mock.calls[0][0].input.ExpressionAttributeValues[':exp']).toBe('2026-06-30T00:06:40.000Z');
  });
  it('persistPage writes cursor + counters + heartbeat, conditioned on the lease token', async () => {
    mockSend.mockResolvedValueOnce({});
    await persistPage('cold', 'existence', 'tok', { cursor: { k: 1 }, hasMore: true, counters: { scanned: 10 }, leaseExpiresAt: 'later' });
    const upd = mockSend.mock.calls[0][0].input;
    expect(JSON.stringify(upd)).toContain('hasMore');
    expect(JSON.stringify(upd)).toContain('cursor');
    expect(upd.ConditionExpression).toBe('lease = :token');
    expect(upd.ExpressionAttributeValues[':token']).toBe('tok');
  });
  it('persistPage rejects when the lease token is stale (another owner re-acquired)', async () => {
    mockSend.mockRejectedValueOnce(Object.assign(new Error('stale'), { name: 'ConditionalCheckFailedException' }));
    await expect(persistPage('cold', 'existence', 'old', { cursor: {}, hasMore: true, counters: {}, leaseExpiresAt: 'x' })).rejects.toThrow();
  });
  it('releaseLease clears cursor + lease, conditioned on the lease token', async () => {
    mockSend.mockResolvedValueOnce({});
    await releaseLease('cold', 'existence', 'tok', { lastSummary: { scanned: 10 } });
    const upd = mockSend.mock.calls[0][0].input;
    expect(upd.ConditionExpression).toBe('lease = :token');
    expect(upd.ExpressionAttributeValues[':token']).toBe('tok');
  });
  it('releaseLeaseKeepCursor releases the lease but does NOT remove the cursor', async () => {
    mockSend.mockResolvedValueOnce({});
    await releaseLeaseKeepCursor('analytics', 'sessions', 'tok', { lastSummary: { emitted: 1 } });
    const upd = mockSend.mock.calls[0][0].input;
    expect(upd.ConditionExpression).toBe('lease = :token');
    expect(upd.ExpressionAttributeValues[':token']).toBe('tok');
    expect(upd.UpdateExpression).toContain('REMOVE lease, leaseExpiresAt');
    expect(upd.UpdateExpression).not.toContain('#c');
    expect(upd.UpdateExpression).not.toContain('cursor');
    expect(upd.ExpressionAttributeNames).toBeUndefined();
  });
  it('releaseLease rejects when the lease token is stale', async () => {
    mockSend.mockRejectedValueOnce(Object.assign(new Error('stale'), { name: 'ConditionalCheckFailedException' }));
    await expect(releaseLease('cold', 'existence', 'old', { lastSummary: {} })).rejects.toThrow();
  });
  it('stateKey supports the analytics rollup namespace', () => {
    expect(stateKey('analytics', 'sessions')).toEqual({ PK: 'CRM_SWEEP#analytics#sessions', SK: 'STATE' });
  });
  it('readState returns the stored item or a default', async () => {
    mockSend.mockResolvedValueOnce({ Item: { cursor: { k: 2 }, hasMore: true } });
    expect((await readState('cold', 'existence')).hasMore).toBe(true);
    mockSend.mockResolvedValueOnce({});
    expect((await readState('cold', 'existence')).cursor).toBeUndefined();
  });
});
