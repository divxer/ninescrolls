import { describe, it, expect, vi, beforeEach } from 'vitest';
const mockSend = vi.fn();
vi.mock('../dynamodb', () => ({ docClient: { send: (...a: unknown[]) => mockSend(...a) }, TABLE_NAME: () => 'T' }));
import { timelineByOrg, encodeToken, decodeToken } from './timelineByOrg';

beforeEach(() => mockSend.mockReset());
const input = () => mockSend.mock.calls[0][0].input;

describe('timelineByOrg query', () => {
  it('scopes to TLEVENT# via begins_with KEY condition (not entityType filter) and reads GSI2 descending', async () => {
    mockSend.mockResolvedValueOnce({ Items: [], LastEvaluatedKey: undefined });
    await timelineByOrg({ orgId: 'acme.com' });
    const q = input();
    expect(q.IndexName).toBe('GSI2');
    expect(q.KeyConditionExpression).toBe('GSI2PK = :pk AND begins_with(GSI2SK, :tl)');
    expect(q.ExpressionAttributeValues[':pk']).toBe('ORG#acme.com');
    expect(q.ExpressionAttributeValues[':tl']).toBe('TLEVENT#');
    expect(q.ScanIndexForward).toBe(false);
  });

  it('default view filters voided=false AND isInternalOnly=false', async () => {
    mockSend.mockResolvedValueOnce({ Items: [] });
    await timelineByOrg({ orgId: 'acme.com' });
    const q = input();
    expect(q.FilterExpression).toBe('voided = :false AND isInternalOnly = :false');
    expect(q.ExpressionAttributeValues[':false']).toBe(false);
  });

  it('includeInternalOnly=true drops the internal filter but keeps voided=false', async () => {
    mockSend.mockResolvedValueOnce({ Items: [] });
    await timelineByOrg({ orgId: 'acme.com', includeInternalOnly: true });
    const q = input();
    expect(q.FilterExpression).toBe('voided = :false');
  });

  it('clamps limit: default 50, max 100, min 1', async () => {
    mockSend.mockResolvedValue({ Items: [] });
    await timelineByOrg({ orgId: 'a' }); expect(input().Limit).toBe(50);
    mockSend.mockClear(); await timelineByOrg({ orgId: 'a', limit: 999 }); expect(input().Limit).toBe(100);
    mockSend.mockClear(); await timelineByOrg({ orgId: 'a', limit: 0 }); expect(input().Limit).toBe(1);
  });

  it('nextToken round-trips an opaque base64 of LastEvaluatedKey', async () => {
    const key = { GSI2PK: 'ORG#a', GSI2SK: 'TLEVENT#z', PK: 'TLEVENT#z', SK: 'A' };
    mockSend.mockResolvedValueOnce({ Items: [], LastEvaluatedKey: key });
    const out = await timelineByOrg({ orgId: 'a' });
    expect(out.nextToken).toBe(encodeToken(key));
    expect(decodeToken(out.nextToken!)).toEqual(key);
    mockSend.mockClear(); mockSend.mockResolvedValueOnce({ Items: [] });
    await timelineByOrg({ orgId: 'a', nextToken: out.nextToken });
    expect(input().ExclusiveStartKey).toEqual(key);
  });

  it('no LastEvaluatedKey → nextToken undefined (end of history)', async () => {
    mockSend.mockResolvedValueOnce({ Items: [{ id: 'tev-1' }] });
    const out = await timelineByOrg({ orgId: 'a' });
    expect(out.nextToken).toBeUndefined();
    expect(out.items).toEqual([{ id: 'tev-1' }]);
  });
});
