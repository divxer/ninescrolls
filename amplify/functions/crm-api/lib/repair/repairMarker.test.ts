import { describe, it, expect, vi, beforeEach } from 'vitest';
const send = vi.fn();
vi.mock('../dynamodb', () => ({ docClient: { send: (...a: unknown[]) => send(...a) }, TABLE_NAME: () => 'T' }));
import { putRepairMarker, deleteRepairMarker, markStuck, bumpAttempt, touchInProgress, queryPendingMarkers, repairMarkerKeys } from './repairMarker';

beforeEach(() => { send.mockReset(); send.mockResolvedValue({}); });

describe('repairMarker', () => {
  it('put writes a pending marker with deterministic PK + GSI1 pending partition', async () => {
    await putRepairMarker({ unitType: 'structured', unitKey: 'unresolved-rfq-1', targetOrgId: 'acme.com',
      operator: 'op', createdAt: '2026-07-08T00:00:00.000Z', sourceType: 'rfq', sourceEntityId: '1',
      backfillPk: 'RFQ#1', affectedEventIds: ['e1'], movedCount: 1, contactStatus: 'linked' });
    const item = send.mock.calls[0][0].input.Item;
    expect(item.PK).toBe('CRM_REPAIR#structured#unresolved-rfq-1');
    expect(item.SK).toBe('STATE');
    expect(item.GSI1PK).toBe('CRM_REPAIR#pending');
    expect(item.GSI1SK).toBe('2026-07-08T00:00:00.000Z#unresolved-rfq-1');
    expect(item.status).toBe('pending');
    expect(item.attemptCount).toBe(0);
    expect(item.backfillPk).toBe('RFQ#1');
  });
  it('analytics put omits structured fields', async () => {
    await putRepairMarker({ unitType: 'analytics', unitKey: 'v1', targetOrgId: 'acme.com', operator: 'op', createdAt: '2026-07-08T00:00:00.000Z' });
    const item = send.mock.calls[0][0].input.Item;
    expect(item.PK).toBe('CRM_REPAIR#analytics#v1');
    expect(item.backfillPk ?? null).toBeNull();
  });
  it('delete removes by deterministic key', async () => {
    await deleteRepairMarker('analytics', 'v1');
    expect(send.mock.calls[0][0].input.Key).toEqual({ PK: 'CRM_REPAIR#analytics#v1', SK: 'STATE' });
  });
  it('markStuck moves the marker to the stuck partition with a reason', async () => {
    await markStuck({ unitType: 'structured', unitKey: 'unresolved-rfq-1', attemptCount: 4 } as never, 'source_conflict', 'source_conflict', '2026-07-08T01:00:00.000Z');
    const u = send.mock.calls[0][0].input;
    expect(u.Key).toEqual({ PK: 'CRM_REPAIR#structured#unresolved-rfq-1', SK: 'STATE' });
    expect(u.ExpressionAttributeValues[':g']).toBe('CRM_REPAIR#stuck');
    expect(u.ExpressionAttributeValues[':st']).toBe('stuck');
    expect(u.ExpressionAttributeValues[':sr']).toBe('source_conflict');
  });
  it('bumpAttempt increments attemptCount and stays pending', async () => {
    await bumpAttempt({ unitType: 'analytics', unitKey: 'v1', attemptCount: 1 } as never, 'boom', '2026-07-08T01:00:00.000Z');
    const u = send.mock.calls[0][0].input;
    expect(u.ExpressionAttributeValues[':a']).toBe(2);
    expect(u.ExpressionAttributeValues[':e']).toBe('boom');
  });
  it('queryPendingMarkers Queries GSI1 pending oldest-first with a limit', async () => {
    send.mockResolvedValueOnce({ Items: [{ unitKey: 'a' }], LastEvaluatedKey: { x: 1 } });
    const r = await queryPendingMarkers(50);
    const q = send.mock.calls[0][0].input;
    expect(q.IndexName).toBe('GSI1');
    expect(q.ExpressionAttributeValues[':pk']).toBe('CRM_REPAIR#pending');
    expect(q.ScanIndexForward).toBe(true);
    expect(q.Limit).toBe(50);
    expect(r.markers).toHaveLength(1);
    expect(r.hasMore).toBe(true);
  });
  it('repairMarkerKeys builds the deterministic PK', () => {
    expect(repairMarkerKeys('structured', 'u1')).toEqual({ PK: 'CRM_REPAIR#structured#u1', SK: 'STATE' });
  });
});
