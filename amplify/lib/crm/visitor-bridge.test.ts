import { describe, it, expect, vi, beforeEach } from 'vitest';
import { upsertVisitorBridge, readVisitorBridge, type VisitorBridge } from './visitor-bridge';

const send = vi.fn();
beforeEach(() => send.mockReset());
const T = 'TBL';
const base = { visitorId: 'v-1', email: 'a@lab.edu', sourceEntityType: 'rfq' as const, sourceEntityId: 'rfq-1', now: '2026-07-01T00:00:00.000Z' };

describe('upsertVisitorBridge (upgrade-only + provenance)', () => {
  it('creates a new bridge with orgSource provenance and reports created+orgUpgraded', async () => {
    send.mockResolvedValueOnce({ Item: undefined });            // read: no bridge
    send.mockResolvedValueOnce({});                              // write ok
    const r = await upsertVisitorBridge(send, T, { ...base, matchedOrgId: 'lab.edu' });
    expect(r).toEqual({ created: true, orgUpgraded: true });
    const put = send.mock.calls[1][0].input;
    expect(put.Item).toMatchObject({ PK: 'VISITOR#v-1', SK: 'STATE', matchedOrgId: 'lab.edu', orgSource: 'rfq_match', email: 'a@lab.edu' });
  });
  it('upgrades null→real org (orgUpgraded true) and stamps the new provenance', async () => {
    send.mockResolvedValueOnce({ Item: { PK: 'VISITOR#v-1', SK: 'STATE', matchedOrgId: null, orgSource: null, email: 'a@lab.edu', firstSeenAt: 'x' } });
    send.mockResolvedValueOnce({});
    const r = await upsertVisitorBridge(send, T, { ...base, sourceEntityType: 'lead', matchedOrgId: 'lab.edu' });
    expect(r).toEqual({ created: false, orgUpgraded: true });
    expect(send.mock.calls[1][0].input.Item).toMatchObject({ matchedOrgId: 'lab.edu', orgSource: 'lead_match' });
  });
  it('NEVER downgrades a real org: incoming null org leaves org untouched (fills email only)', async () => {
    send.mockResolvedValueOnce({ Item: { PK: 'VISITOR#v-1', SK: 'STATE', matchedOrgId: 'lab.edu', orgSource: 'rfq_match', email: null, firstSeenAt: 'x' } });
    send.mockResolvedValueOnce({});
    const r = await upsertVisitorBridge(send, T, { ...base, matchedOrgId: null });
    expect(r).toEqual({ created: false, orgUpgraded: false });
    expect(send.mock.calls[1][0].input.Item).toMatchObject({ matchedOrgId: 'lab.edu', orgSource: 'rfq_match', email: 'a@lab.edu' });
  });
  it('latest-real-wins: real→different-real updates org + provenance (orgUpgraded false — no unresolved→resolved transition)', async () => {
    send.mockResolvedValueOnce({ Item: { PK: 'VISITOR#v-1', SK: 'STATE', matchedOrgId: 'old.edu', orgSource: 'lead_match', email: 'a@lab.edu', firstSeenAt: 'x' } });
    send.mockResolvedValueOnce({});
    const r = await upsertVisitorBridge(send, T, { ...base, matchedOrgId: 'new.edu' });
    expect(r).toEqual({ created: false, orgUpgraded: false });
    expect(send.mock.calls[1][0].input.Item).toMatchObject({ matchedOrgId: 'new.edu', orgSource: 'rfq_match' });
  });
  it('no-op when nothing would change: skips the write entirely', async () => {
    send.mockResolvedValueOnce({ Item: { PK: 'VISITOR#v-1', SK: 'STATE', matchedOrgId: 'lab.edu', orgSource: 'rfq_match', email: 'a@lab.edu', firstSeenAt: 'x' } });
    const r = await upsertVisitorBridge(send, T, { ...base, matchedOrgId: 'lab.edu' });
    expect(r).toEqual({ created: false, orgUpgraded: false });
    expect(send).toHaveBeenCalledTimes(1); // read only
  });
  it('guards against a blank visitorId (no VISITOR#undefined keys)', async () => {
    const r = await upsertVisitorBridge(send, T, { ...base, visitorId: '', matchedOrgId: 'lab.edu' });
    expect(r).toEqual({ created: false, orgUpgraded: false });
    expect(send).not.toHaveBeenCalled();
  });
  it('create race: losing creator re-reads the winner and merges (winner org survives)', async () => {
    send.mockResolvedValueOnce({ Item: undefined });                     // read: no bridge yet
    send.mockRejectedValueOnce(Object.assign(new Error('exists'), { name: 'ConditionalCheckFailedException' })); // create loses race
    send.mockResolvedValueOnce({ Item: { PK: 'VISITOR#v-1', SK: 'STATE', matchedOrgId: 'lab.edu', orgSource: 'rfq_match', email: null, updatedAt: 'w' } }); // re-read: winner row
    send.mockResolvedValueOnce({});                                      // merged update ok
    const r = await upsertVisitorBridge(send, T, { ...base, matchedOrgId: null });
    expect(r).toEqual({ created: false, orgUpgraded: false });
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
    expect(r).toEqual({ created: false, orgUpgraded: true });
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
    expect(r).toEqual({ created: false, orgUpgraded: false });
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
