import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSend = vi.fn();
vi.mock('../dynamodb', () => ({ docClient: { send: (...a: unknown[]) => mockSend(...a) }, TABLE_NAME: () => 'T' }));
const upsert = vi.fn();
const readBridge = vi.fn();
vi.mock('../../../../lib/crm/visitor-bridge', () => ({
  upsertVisitorBridge: (...a: unknown[]) => upsert(...a),
  readVisitorBridge: (...a: unknown[]) => readBridge(...a),
  toSend: (dc: { send: (c: unknown) => unknown }) => (c: unknown) => dc.send(c), // passthrough adapter
}));

import { backfillVisitorBridge } from './backfillVisitorBridge';

beforeEach(() => {
  mockSend.mockReset();
  upsert.mockReset();
  readBridge.mockReset();
  upsert.mockResolvedValue({ created: true, orgUpgraded: false });
  readBridge.mockResolvedValue(null); // default: no existing bridge
});

describe('backfillVisitorBridge', () => {
  it('scans RFQ/LEAD METAs with visitorId and upgrade-writes bridges; returns cursor', async () => {
    mockSend.mockResolvedValueOnce({ Items: [
      { PK: 'RFQ#r-1', SK: 'META', visitorId: 'v-1', matchedOrgId: 'lab.edu', email: 'a@lab.edu', submittedAt: 't1' },
      { PK: 'LEAD#l-1', SK: 'META', visitorId: 'v-2', matchedOrgId: '', email: 'b@x.com', submittedAt: 't2' },
    ], LastEvaluatedKey: { k: 1 } });
    const out = await backfillVisitorBridge({});
    const scan = mockSend.mock.calls[0][0].input;
    expect(scan.TableName).toBe('T');
    expect(scan.FilterExpression).toContain('begins_with(PK, :rfq) OR begins_with(PK, :lead)');
    expect(scan.FilterExpression).toContain('SK = :meta');
    expect(scan.FilterExpression).toContain('attribute_exists(visitorId)');
    expect(scan.ExpressionAttributeValues).toEqual({ ':rfq': 'RFQ#', ':lead': 'LEAD#', ':meta': 'META' });
    expect(scan.Limit).toBe(200); // operator-tunable default
    expect(upsert).toHaveBeenCalledTimes(2);
    expect(upsert.mock.calls[0][1]).toBe('T');
    expect(upsert.mock.calls[0][2]).toMatchObject({ visitorId: 'v-1', matchedOrgId: 'lab.edu', email: 'a@lab.edu', sourceEntityType: 'rfq', sourceEntityId: 'r-1', now: 't1' });
    expect(upsert.mock.calls[1][2]).toMatchObject({ visitorId: 'v-2', matchedOrgId: null, email: 'b@x.com', sourceEntityType: 'lead', sourceEntityId: 'l-1', now: 't2' });
    expect(out).toMatchObject({ processed: 2, upgraded: 2, hasMore: true, nextCursor: { k: 1 } });
  });

  it('passes cursor/limit through to the Scan and counts upgrades only when created or orgUpgraded', async () => {
    mockSend.mockResolvedValueOnce({ Items: [
      { PK: 'RFQ#r-2', SK: 'META', visitorId: 'v-3', matchedOrgId: 'x.edu', email: 'c@x.edu', submittedAt: 't3' },
      { PK: 'LEAD#l-2', SK: 'META', visitorId: 'v-4', matchedOrgId: null, email: null }, // legacy: no submittedAt
    ] });
    upsert
      .mockResolvedValueOnce({ created: false, orgUpgraded: true })
      .mockResolvedValueOnce({ created: false, orgUpgraded: false });
    const out = await backfillVisitorBridge({ cursor: { PK: 'RFQ#r-1', SK: 'META' }, limit: 25 });
    const scan = mockSend.mock.calls[0][0].input;
    expect(scan.ExclusiveStartKey).toEqual({ PK: 'RFQ#r-1', SK: 'META' });
    expect(scan.Limit).toBe(25);
    // submittedAt fallback: a row without it gets a real ISO now, not undefined
    expect(upsert.mock.calls[1][2].now).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(out).toMatchObject({ processed: 2, upgraded: 1, hasMore: false });
    expect(out.nextCursor).toBeUndefined();
  });

  it('never regresses a live bridge: rows whose bridge already has a real org are skipped', async () => {
    mockSend.mockResolvedValueOnce({ Items: [
      { PK: 'LEAD#l-9', SK: 'META', visitorId: 'v-9', matchedOrgId: 'old.edu', email: 'z@old.edu', submittedAt: 't0' },
    ] });
    readBridge.mockResolvedValueOnce({ matchedOrgId: 'live.edu' }); // live submission already resolved this visitor
    const out = await backfillVisitorBridge({});
    expect(upsert).not.toHaveBeenCalled();
    expect(out).toMatchObject({ processed: 1, upgraded: 0, hasMore: false });
  });
  it('NO retro fire during backfill (spec §5 default)', async () => {
    // structural: the module imports upsertVisitorBridge only — no invokeCrmAction import exists.
    mockSend.mockResolvedValueOnce({ Items: [] });
    const out = await backfillVisitorBridge({});
    expect(upsert).not.toHaveBeenCalled();
    expect(out).toMatchObject({ processed: 0, upgraded: 0, hasMore: false });
  });
});
