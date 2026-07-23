import { describe, it, expect, vi, beforeEach } from 'vitest';
import { upsertVisitorBridge, readVisitorBridge, upsertManualVisitorBridge, type VisitorBridge, type Send } from './visitor-bridge';

const send = vi.fn();
beforeEach(() => send.mockReset());
const T = 'TBL';
const base = { visitorId: 'v-1', email: 'a@lab.edu', sourceEntityType: 'rfq' as const, sourceEntityId: 'rfq-1', now: '2026-07-01T00:00:00.000Z' };

describe('upsertVisitorBridge (upgrade-only + provenance)', () => {
  it('creates a new bridge with orgSource provenance and reports created+orgUpgraded', async () => {
    send.mockResolvedValueOnce({ Item: undefined });            // read: no bridge
    send.mockResolvedValueOnce({});                              // write ok
    const r = await upsertVisitorBridge(send, T, { ...base, matchedOrgId: 'lab.edu' });
    expect(r).toEqual({ created: true, orgUpgraded: true, orgChanged: false });
    const put = send.mock.calls[1][0].input;
    expect(put.Item).toMatchObject({ PK: 'VISITOR#v-1', SK: 'STATE', matchedOrgId: 'lab.edu', orgSource: 'rfq_match', email: 'a@lab.edu' });
  });
  it('upgrades null→real org (orgUpgraded true) and stamps the new provenance', async () => {
    send.mockResolvedValueOnce({ Item: { PK: 'VISITOR#v-1', SK: 'STATE', matchedOrgId: null, orgSource: null, email: 'a@lab.edu', firstSeenAt: 'x' } });
    send.mockResolvedValueOnce({});
    const r = await upsertVisitorBridge(send, T, { ...base, sourceEntityType: 'lead', matchedOrgId: 'lab.edu' });
    expect(r).toEqual({ created: false, orgUpgraded: true, orgChanged: false });
    expect(send.mock.calls[1][0].input.Item).toMatchObject({ matchedOrgId: 'lab.edu', orgSource: 'lead_match' });
  });
  it('NEVER downgrades a real org: incoming null org leaves org untouched (fills email only)', async () => {
    send.mockResolvedValueOnce({ Item: { PK: 'VISITOR#v-1', SK: 'STATE', matchedOrgId: 'lab.edu', orgSource: 'rfq_match', email: null, firstSeenAt: 'x' } });
    send.mockResolvedValueOnce({});
    const r = await upsertVisitorBridge(send, T, { ...base, matchedOrgId: null });
    expect(r).toEqual({ created: false, orgUpgraded: false, orgChanged: false });
    expect(send.mock.calls[1][0].input.Item).toMatchObject({ matchedOrgId: 'lab.edu', orgSource: 'rfq_match', email: 'a@lab.edu' });
  });
  it('latest-real-wins: real→different-real updates org + provenance (orgChanged true — callers must re-resolve)', async () => {
    send.mockResolvedValueOnce({ Item: { PK: 'VISITOR#v-1', SK: 'STATE', matchedOrgId: 'old.edu', orgSource: 'lead_match', email: 'a@lab.edu', firstSeenAt: 'x' } });
    send.mockResolvedValueOnce({});
    const r = await upsertVisitorBridge(send, T, { ...base, matchedOrgId: 'new.edu' });
    expect(r).toEqual({ created: false, orgUpgraded: false, orgChanged: true });
    expect(send.mock.calls[1][0].input.Item).toMatchObject({ matchedOrgId: 'new.edu', orgSource: 'rfq_match' });
  });
  it('no-op when nothing would change: skips the write entirely', async () => {
    send.mockResolvedValueOnce({ Item: { PK: 'VISITOR#v-1', SK: 'STATE', matchedOrgId: 'lab.edu', orgSource: 'rfq_match', email: 'a@lab.edu', firstSeenAt: 'x' } });
    const r = await upsertVisitorBridge(send, T, { ...base, matchedOrgId: 'lab.edu' });
    expect(r).toEqual({ created: false, orgUpgraded: false, orgChanged: false });
    expect(send).toHaveBeenCalledTimes(1); // read only
  });
  it('guards against a blank visitorId (no VISITOR#undefined keys)', async () => {
    const r = await upsertVisitorBridge(send, T, { ...base, visitorId: '', matchedOrgId: 'lab.edu' });
    expect(r).toEqual({ created: false, orgUpgraded: false, orgChanged: false });
    expect(send).not.toHaveBeenCalled();
  });
  it('create race: losing creator re-reads the winner and merges (winner org survives)', async () => {
    send.mockResolvedValueOnce({ Item: undefined });                     // read: no bridge yet
    send.mockRejectedValueOnce(Object.assign(new Error('exists'), { name: 'ConditionalCheckFailedException' })); // create loses race
    send.mockResolvedValueOnce({ Item: { PK: 'VISITOR#v-1', SK: 'STATE', matchedOrgId: 'lab.edu', orgSource: 'rfq_match', email: null, updatedAt: 'w' } }); // re-read: winner row
    send.mockResolvedValueOnce({});                                      // merged update ok
    const r = await upsertVisitorBridge(send, T, { ...base, matchedOrgId: null });
    expect(r).toEqual({ created: false, orgUpgraded: false, orgChanged: false });
    expect(send.mock.calls.at(-1)![0].input.Item).toMatchObject({ matchedOrgId: 'lab.edu', orgSource: 'rfq_match', email: 'a@lab.edu' });
  });
  it('retry exhaustion: three consecutive conditional failures rethrow', async () => {
    const item = { PK: 'VISITOR#v-1', SK: 'STATE', matchedOrgId: null, orgSource: null, email: null, updatedAt: 'u' };
    const ccfe = () => Object.assign(new Error('stale'), { name: 'ConditionalCheckFailedException' });
    send.mockResolvedValueOnce({ Item: item }).mockRejectedValueOnce(ccfe())
        .mockResolvedValueOnce({ Item: item }).mockRejectedValueOnce(ccfe())
        .mockResolvedValueOnce({ Item: item }).mockRejectedValueOnce(ccfe());
    await expect(upsertVisitorBridge(send, T, { ...base, matchedOrgId: 'lab.edu' })).rejects.toThrow('stale');
    expect(send).toHaveBeenCalledTimes(6); // 3 attempts x (read + write)
  });
  it('does not overwrite an existing email with a different incoming email', async () => {
    send.mockResolvedValueOnce({ Item: { PK: 'VISITOR#v-1', SK: 'STATE', matchedOrgId: null, orgSource: null, email: 'first@lab.edu', firstSeenAt: 'x', updatedAt: 'u' } });
    send.mockResolvedValueOnce({});
    const r = await upsertVisitorBridge(send, T, { ...base, email: 'second@lab.edu', matchedOrgId: 'lab.edu' });
    expect(r).toEqual({ created: false, orgUpgraded: true, orgChanged: false });
    expect(send.mock.calls[1][0].input.Item).toMatchObject({ email: 'first@lab.edu', matchedOrgId: 'lab.edu' });
  });
  it('a non-conditional error rethrows immediately without retry', async () => {
    send.mockResolvedValueOnce({ Item: { PK: 'VISITOR#v-1', SK: 'STATE', matchedOrgId: null, orgSource: null, email: null, updatedAt: 'u' } });
    send.mockRejectedValueOnce(Object.assign(new Error('boom'), { name: 'InternalServerError' }));
    await expect(upsertVisitorBridge(send, T, { ...base, matchedOrgId: 'lab.edu' })).rejects.toThrow('boom');
    expect(send).toHaveBeenCalledTimes(2); // read + failed write, no retry
  });
  it('stale writer cannot downgrade a real org written by a racing submitter', async () => {
    send.mockResolvedValueOnce({ Item: { PK: 'VISITOR#v-1', SK: 'STATE', matchedOrgId: null, orgSource: null, email: null, updatedAt: 'old' } });
    send.mockRejectedValueOnce(Object.assign(new Error('stale'), { name: 'ConditionalCheckFailedException' }));
    send.mockResolvedValueOnce({ Item: { PK: 'VISITOR#v-1', SK: 'STATE', matchedOrgId: 'lab.edu', orgSource: 'lead_match', email: null, updatedAt: 'new' } });
    send.mockResolvedValueOnce({});
    const r = await upsertVisitorBridge(send, T, { ...base, matchedOrgId: null, email: 'a@lab.edu' });
    expect(r).toEqual({ created: false, orgUpgraded: false, orgChanged: false });
    expect(send.mock.calls.at(-1)![0].input.Item).toMatchObject({ matchedOrgId: 'lab.edu', orgSource: 'lead_match', email: 'a@lab.edu' });
  });
});

describe('readVisitorBridge', () => {
  it('returns the item or null', async () => {
    send.mockResolvedValueOnce({ Item: { PK: 'VISITOR#v-1', SK: 'STATE', matchedOrgId: 'lab.edu' } });
    expect(((await readVisitorBridge(send, T, 'v-1')) as VisitorBridge).matchedOrgId).toBe('lab.edu');
    send.mockResolvedValueOnce({});
    expect(await readVisitorBridge(send, T, 'v-1')).toBeNull();
  });
});

const sendWith = (existing: unknown) => {
  const calls: unknown[] = [];
  const send: Send = async (cmd: unknown) => { calls.push(cmd); const c = cmd as { input: { Key?: unknown } }; return c.input?.Key ? { Item: existing as Record<string, unknown> } : {}; };
  return { send, calls };
};

describe('manual visitor bridge provenance', () => {
  it('upsertManualVisitorBridge writes orgSource=manual CONDITIONALLY (only when no real org)', async () => {
    const { send, calls } = sendWith(null);
    const r = await upsertManualVisitorBridge(send, 'T', { visitorId: 'v1', matchedOrgId: 'acme.com', now: '2026-07-08T00:00:00Z' });
    const putCmd = calls.find((c) => (c as { input: { Item?: unknown } }).input.Item) as { input: { Item: Record<string, unknown>; ConditionExpression: string } };
    expect(putCmd.input.Item.orgSource).toBe('manual');
    expect(putCmd.input.Item.matchedOrgId).toBe('acme.com');
    expect(putCmd.input.ConditionExpression).toContain('attribute_type(matchedOrgId, :nullType)');
    expect(r).toEqual({ written: true, existingOrgId: 'acme.com' });
  });

  it('writes over an existing bridge whose matchedOrgId is NULL (round-2 P1 — attribute_type NULL allowed)', async () => {
    const { send, calls } = sendWith({ PK: 'VISITOR#v1', SK: 'STATE', matchedOrgId: null, orgSource: null });
    const r = await upsertManualVisitorBridge(send, 'T', { visitorId: 'v1', matchedOrgId: 'acme.com', now: 'n' });
    const putCmd = calls.find((c) => (c as { input: { Item?: unknown } }).input.Item) as { input: { ExpressionAttributeValues: Record<string, unknown> } };
    expect(putCmd.input.ExpressionAttributeValues[':nullType']).toBe('NULL');
    expect(r).toEqual({ written: true, existingOrgId: 'acme.com' });
  });

  it('concurrent manual link loses the race → written:false, returns the winner org (no clobber)', async () => {
    const winner = { PK: 'VISITOR#v1', SK: 'STATE', matchedOrgId: 'winner.com', orgSource: 'manual' };
    let putN = 0;
    const send: Send = async (cmd: unknown) => {
      const c = cmd as { input: { Key?: unknown; Item?: unknown } };
      if (c.input.Item) { putN += 1; throw Object.assign(new Error('x'), { name: 'ConditionalCheckFailedException' }); }
      return { Item: (putN === 0 ? null : winner) as Record<string, unknown> };
    };
    const r = await upsertManualVisitorBridge(send, 'T', { visitorId: 'v1', matchedOrgId: 'loser.com', now: 'n' });
    expect(r).toEqual({ written: false, existingOrgId: 'winner.com' });
  });

  it('a later rfq_match upsert does NOT overwrite a manual bridge org', async () => {
    const manual = { PK: 'VISITOR#v1', SK: 'STATE', matchedOrgId: 'acme.com', orgSource: 'manual', email: null, sourceEntityType: 'rfq', sourceEntityId: 'x', firstSeenAt: 't', updatedAt: 't' };
    const { send, calls } = sendWith(manual);
    await upsertVisitorBridge(send, 'T', { visitorId: 'v1', matchedOrgId: 'other.com', email: null, sourceEntityType: 'rfq', sourceEntityId: 'r9', now: '2026-07-08T01:00:00Z' });
    const puts = calls.filter((c) => (c as { input: { Item?: unknown } }).input.Item) as Array<{ input: { Item: Record<string, unknown> } }>;
    if (puts.length) { expect(puts[0].input.Item.matchedOrgId).toBe('acme.com'); expect(puts[0].input.Item.orgSource).toBe('manual'); }
  });
});
