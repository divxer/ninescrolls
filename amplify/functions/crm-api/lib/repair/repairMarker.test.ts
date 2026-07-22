import { describe, it, expect, vi, beforeEach } from 'vitest';
const send = vi.fn();
vi.mock('../dynamodb', () => ({ docClient: { send: (...a: unknown[]) => send(...a) }, TABLE_NAME: () => 'T' }));
import {
  putRepairMarker, deleteRepairMarker, markStuck, bumpAttempt, touchInProgress, queryPendingMarkers, repairMarkerKeys,
  buildStructuredMarkerPut, structuredMarkerKey, accumulateMarker, sealMarker, deleteRepairMarkerFenced,
  queryBuildingOlderThan, promoteAbandonedBuilding, markStuckV2, queryStuckByReason, republishStuckFenced,
  bumpAttemptFenced, SAMPLE_CAP, type StructuredMarkerV2,
  mergeReconKey, acknowledgeMergeReconFenced,
} from './repairMarker';

beforeEach(() => { send.mockReset(); send.mockResolvedValue({}); });

function markerAt(version: number): StructuredMarkerV2 {
  return {
    PK: `CRM_REPAIR#structured#u1#gen1`, SK: 'STATE',
    GSI1PK: 'CRM_REPAIR#building', GSI1SK: 'createdAt#u1',
    entityType: 'CRM_REPAIR', unitType: 'structured', unitKey: 'u1', generation: 'gen1', version,
    targetOrgId: 'acme.com', operator: 'op', createdAt: 'createdAt',
    status: 'building', stuckReason: undefined, stuckReasonClass: undefined,
    attemptCount: 0, lastAttemptAt: null, lastError: null,
    sourceType: 'gmail', sourceEntityId: 'mid', backfillPk: null,
    customerEmail: 'a@x.com', movedCount: 0, affectedEventIdsSample: [], contactStatus: 'missing_email',
  } as unknown as StructuredMarkerV2;
}
function manyIds(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `e${i}`);
}

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
  it('touchInProgress bumps lastAttemptAt only, keeps the marker pending', async () => {
    await touchInProgress({ unitType: 'analytics', unitKey: 'v1' } as never, '2026-07-08T02:00:00.000Z');
    const u = send.mock.calls[0][0].input;
    expect(u.Key).toEqual({ PK: 'CRM_REPAIR#analytics#v1', SK: 'STATE' });
    expect(u.UpdateExpression).toContain('lastAttemptAt = :now');
    expect(u.UpdateExpression).not.toContain('GSI1PK'); // stays pending, not moved to stuck
    expect(u.ExpressionAttributeValues[':now']).toBe('2026-07-08T02:00:00.000Z');
  });
  it('markStuck / bumpAttempt / touchInProgress guard on attribute_exists(PK) (no zombie upsert)', async () => {
    await markStuck({ unitType: 'analytics', unitKey: 'v1', attemptCount: 0 } as never, 'max_attempts', 'e', 't');
    expect(send.mock.calls.at(-1)![0].input.ConditionExpression).toBe('attribute_exists(PK)');
    await bumpAttempt({ unitType: 'analytics', unitKey: 'v1', attemptCount: 0 } as never, 'e', 't');
    expect(send.mock.calls.at(-1)![0].input.ConditionExpression).toBe('attribute_exists(PK)');
    await touchInProgress({ unitType: 'analytics', unitKey: 'v1' } as never, 't');
    expect(send.mock.calls.at(-1)![0].input.ConditionExpression).toBe('attribute_exists(PK)');
  });
  it('regression: putRepairMarker for analytics markers keeps the unchanged 3C shape (v1 API untouched)', async () => {
    await putRepairMarker({ unitType: 'analytics', unitKey: 'v2', targetOrgId: 'acme.com', operator: 'op', createdAt: '2026-07-08T00:00:00.000Z' });
    const item = send.mock.calls[0][0].input.Item;
    expect(item.PK).toBe('CRM_REPAIR#analytics#v2');
    expect(item.GSI1PK).toBe('CRM_REPAIR#pending');
    expect(item.status).toBe('pending');
    expect(item.version).toBeUndefined();     // analytics markers have no version fence
    expect(item.generation).toBeUndefined();  // and no generation suffix
  });
});

describe('repairMarker v2 (structured)', () => {
  it('buildStructuredMarkerPut: generation-suffixed PK, building status, version 1, bounded sample, attribute_not_exists', () => {
    const p = buildStructuredMarkerPut({ unitKey: 'unresolved-gmail-b@x.com', generation: '01J0AAAA…', targetOrgId: 'acme.com',
      operator: 'op', createdAt: 't', sourceType: 'gmail', sourceEntityId: 'mid', backfillPk: null,
      customerEmail: 'b@x.com', movedCount: 0, affectedEventIdsSample: [], contactStatus: 'missing_email' });
    expect(p.Put.Item.PK).toBe('CRM_REPAIR#structured#unresolved-gmail-b@x.com#01J0AAAA…');
    expect(p.Put.Item.status).toBe('building');
    expect(p.Put.Item.GSI1PK).toBe('CRM_REPAIR#building');
    expect(p.Put.Item.version).toBe(1);
    expect(p.Put.ConditionExpression).toBe('attribute_not_exists(PK)');
  });
  it('buildStructuredMarkerPut: caps the initial sample at SAMPLE_CAP', () => {
    const p = buildStructuredMarkerPut({ unitKey: 'u1', generation: 'g1', targetOrgId: 'acme.com',
      operator: 'op', createdAt: 't', sourceType: 'gmail', sourceEntityId: 'mid', backfillPk: null,
      customerEmail: 'a@x.com', movedCount: 0, affectedEventIdsSample: manyIds(150), contactStatus: 'missing_email' });
    expect(p.Put.Item.affectedEventIdsSample.length).toBeLessThanOrEqual(SAMPLE_CAP);
  });
  it('structuredMarkerKey builds the generation-suffixed key', () => {
    expect(structuredMarkerKey('u1', 'g1')).toEqual({ PK: 'CRM_REPAIR#structured#u1#g1', SK: 'STATE' });
  });
  it('accumulate: fenced on version, bumps it, caps the sample at 100', async () => {
    await accumulateMarker(markerAt(3), { movedCountDelta: 2, newSampleIds: manyIds(150) }, 'tNow');
    const u = send.mock.calls[0][0].input;
    expect(u.ConditionExpression).toContain('version = :v');
    expect(u.ExpressionAttributeValues[':v']).toBe(3);
    expect(u.ExpressionAttributeValues[':sample'].length).toBeLessThanOrEqual(100);
  });
  // Finding-3 regression: a successful accumulate must sync the in-memory handle with the row it
  // just wrote — otherwise every subsequent accumulate rebuilds its sample from the ORIGINAL array
  // and the stored sample collapses to ~original+latest-delta instead of growing to the cap.
  it('accumulate: success updates the handle, so sequential accumulates GROW the sample to the cap', async () => {
    const ids = (from: number, n: number) => Array.from({ length: n }, (_, i) => `e${from + i}`);
    const m = markerAt(1);
    await accumulateMarker(m, { movedCountDelta: 40, newSampleIds: ids(0, 40), contactStatus: 'linked' }, 't1');
    await accumulateMarker(m, { movedCountDelta: 40, newSampleIds: ids(40, 40) }, 't2');
    await accumulateMarker(m, { movedCountDelta: 40, newSampleIds: ids(80, 40) }, 't3');
    const third = send.mock.calls[2][0].input;
    expect(third.ExpressionAttributeValues[':sample']).toEqual(ids(0, 100));  // EXACTLY the first 100, in order
    expect(third.ExpressionAttributeValues[':v']).toBe(3);                    // fence advanced per write
    expect(m.affectedEventIdsSample).toEqual(ids(0, 100));                    // handle mirrors the stored row
    expect(m.movedCount).toBe(120);
    expect(m.contactStatus).toBe('linked');
  });
  it('accumulate: a LOST fence leaves the handle untouched (no phantom local state)', async () => {
    const m = markerAt(2);
    send.mockRejectedValueOnce(Object.assign(new Error('ccfe'), { name: 'ConditionalCheckFailedException' }));
    const r = await accumulateMarker(m, { movedCountDelta: 5, newSampleIds: ['x1'], contactStatus: 'linked' }, 't1');
    expect(r.lost).toBe(true);
    expect(m.affectedEventIdsSample).toEqual([]);
    expect(m.movedCount).toBe(0);
    expect(m.contactStatus).toBe('missing_email');
    expect(m.version).toBe(2);
  });
  it('accumulate: CCFE surfaces as lost=true and does not throw', async () => {
    send.mockRejectedValueOnce(Object.assign(new Error('ccfe'), { name: 'ConditionalCheckFailedException' }));
    const r = await accumulateMarker(markerAt(3), { movedCountDelta: 1, newSampleIds: [] }, 'tNow');
    expect(r.lost).toBe(true);
  });
  it('seal: building→pending is a fenced transition into the pending partition', async () => {
    await sealMarker(markerAt(4), 'tNow');
    const u = send.mock.calls[0][0].input;
    expect(u.ExpressionAttributeValues[':g']).toBe('CRM_REPAIR#pending');
    expect(u.ExpressionAttributeValues[':st']).toBe('pending');
    expect(u.ConditionExpression).toContain('version = :v');
  });
  it('every transition (markStuckV2/deleteRepairMarkerFenced) is version-fenced; CCFE surfaces as lost=true', async () => {
    send.mockRejectedValueOnce(Object.assign(new Error('ccfe'), { name: 'ConditionalCheckFailedException' }));
    const r = await deleteRepairMarkerFenced(markerAt(2));
    expect(r.lost).toBe(true);
  });
  it('queryBuildingOlderThan returns aged building markers (bounded Limit)', async () => {
    send.mockResolvedValueOnce({ Items: [{ unitKey: 'u' }] });
    await queryBuildingOlderThan('cutoffIso', 25);
    const q = send.mock.calls[0][0].input;
    expect(q.ExpressionAttributeValues[':pk']).toBe('CRM_REPAIR#building');
    expect(q.Limit).toBe(25);
  });
  it('promoteAbandonedBuilding: building→pending fenced on version AND createdAt < cutoff', async () => {
    await promoteAbandonedBuilding(markerAt(2), 'cutoffIso', 'tNow');
    const u = send.mock.calls[0][0].input;
    expect(u.ConditionExpression).toContain('#s = :building');
    expect(u.ConditionExpression).toContain('version = :v');
    expect(u.ConditionExpression).toContain('createdAt < :cut');
    expect(u.ExpressionAttributeValues[':g']).toBe('CRM_REPAIR#pending');
  });
  it('promoteAbandonedBuilding: CCFE surfaces as lost=true (fresh foreground seal wins)', async () => {
    send.mockRejectedValueOnce(Object.assign(new Error('ccfe'), { name: 'ConditionalCheckFailedException' }));
    const r = await promoteAbandonedBuilding(markerAt(2), 'cutoffIso', 'tNow');
    expect(r.lost).toBe(true);
  });
  // R5 blocker 3 — blocked markers must be discoverable and recoverable:
  it('markStuckV2 records stuckReason and moves the marker into the REASON-KEYED stuck partition', async () => {
    await markStuckV2(markerAt(2), 'org a.com archived without successor', 'target_unavailable', 'tNow');
    const u = send.mock.calls[0][0].input;
    expect(u.ExpressionAttributeValues[':g']).toBe('CRM_REPAIR#stuck#target_unavailable');   // R6: keyed, never filtered
    expect(u.ExpressionAttributeValues[':reason']).toMatch(/without successor/);
    expect(u.ConditionExpression).toContain('version = :v');
  });
  it('queryStuckByReason queries a REASON-KEYED partition — no FilterExpression (R6: Limit precedes filters)', async () => {
    send.mockResolvedValueOnce({ Items: [{ unitKey: 'u', stuckReasonClass: 'target_unavailable' }] });
    await queryStuckByReason('target_unavailable', 25);
    const q = send.mock.calls[0][0].input;
    expect(q.ExpressionAttributeValues[':pk']).toBe('CRM_REPAIR#stuck#target_unavailable');
    expect(q.FilterExpression).toBeUndefined();
    expect(q.Limit).toBe(25);
  });
  it('republishStuckFenced: stuck→pending is version-fenced; CCFE surfaces as lost=true', async () => {
    await republishStuckFenced(markerAt(3), 'tNow');
    const u = send.mock.calls[0][0].input;
    expect(u.ExpressionAttributeValues[':g']).toBe('CRM_REPAIR#pending');
    expect(u.ConditionExpression).toContain('version = :v');
  });
  it('republishStuckFenced: CCFE surfaces as lost=true', async () => {
    send.mockRejectedValueOnce(Object.assign(new Error('ccfe'), { name: 'ConditionalCheckFailedException' }));
    const r = await republishStuckFenced(markerAt(3), 'tNow');
    expect(r.lost).toBe(true);
  });
  // Task 12 — the drainer's v2 transient bump: v1 bumpAttempt targets the un-suffixed v1 PK, so
  // v2 markers need the generation-suffixed key + version fence.
  it('bumpAttemptFenced counts the attempt on the GENERATION-SUFFIXED key, version-fenced; CCFE = lost', async () => {
    await bumpAttemptFenced(markerAt(2), 'boom', 'tNow');
    const u = send.mock.calls[0][0].input;
    expect(u.Key).toEqual(structuredMarkerKey('u1', 'gen1'));
    expect(u.ConditionExpression).toContain('version = :v');
    expect(u.ExpressionAttributeValues[':a']).toBe(1);
    expect(u.ExpressionAttributeValues[':e']).toBe('boom');
    send.mockRejectedValueOnce(Object.assign(new Error('ccfe'), { name: 'ConditionalCheckFailedException' }));
    const r = await bumpAttemptFenced(markerAt(2), 'boom', 'tNow');
    expect(r.lost).toBe(true);
  });
});

describe('mergeReconKey / acknowledgeMergeReconFenced (Task 13, R9)', () => {
  it('mergeReconKey builds the PK/SK pair matching organization-api\'s convention', () => {
    expect(mergeReconKey('src.com', 'tgt.com')).toEqual({ PK: 'MERGE_RECON#src.com', SK: 'TO#tgt.com' });
  });

  it('strong-reads the marker, then a fenced flip needs_review→acknowledged with the server-derived actor', async () => {
    send.mockResolvedValueOnce({ Item: { version: 3, state: 'needs_review' } }); // Get
    send.mockResolvedValueOnce({}); // Update
    const r = await acknowledgeMergeReconFenced('src.com', 'tgt.com', 'admin@x.com');
    expect(r).toEqual({ ok: true });

    const getCall = send.mock.calls[0][0].input;
    expect(getCall.Key).toEqual({ PK: 'MERGE_RECON#src.com', SK: 'TO#tgt.com' });
    expect(getCall.ConsistentRead).toBe(true);

    const u = send.mock.calls[1][0].input;
    expect(u.Key).toEqual({ PK: 'MERGE_RECON#src.com', SK: 'TO#tgt.com' });
    expect(u.ConditionExpression).toBe('#st = :review AND version = :v');
    expect(u.ExpressionAttributeValues[':v']).toBe(3);
    expect(u.ExpressionAttributeValues[':review']).toBe('needs_review');
    expect(u.ExpressionAttributeValues[':ack']).toBe('acknowledged');
    expect(u.ExpressionAttributeValues[':ackPk']).toBe('MERGE_RECON#acknowledged'); // proves exclusion from the needs_review GSI1 partition crmHealth queries
    expect(u.ExpressionAttributeValues[':actor']).toBe('admin@x.com');
    expect(u.UpdateExpression).toContain('version = version + :one');
  });

  it('missing marker ⇒ {ok:false, notFound:true}, no write attempted', async () => {
    send.mockResolvedValueOnce({}); // Get: no Item
    const r = await acknowledgeMergeReconFenced('src.com', 'tgt.com', 'admin@x.com');
    expect(r).toEqual({ ok: false, notFound: true });
    expect(send).toHaveBeenCalledTimes(1); // only the Get — no Update
  });

  it('lost version fence (raced acknowledge/re-probe) ⇒ {ok:false, raced:true}, does not throw', async () => {
    send.mockResolvedValueOnce({ Item: { version: 5, state: 'needs_review' } }); // Get
    send.mockRejectedValueOnce(Object.assign(new Error('ccfe'), { name: 'ConditionalCheckFailedException' })); // Update races
    const r = await acknowledgeMergeReconFenced('src.com', 'tgt.com', 'admin@x.com');
    expect(r).toEqual({ ok: false, raced: true });
  });

  it('a non-CCFE write failure propagates (not swallowed as raced)', async () => {
    send.mockResolvedValueOnce({ Item: { version: 1, state: 'needs_review' } });
    send.mockRejectedValueOnce(new Error('network blip'));
    await expect(acknowledgeMergeReconFenced('src.com', 'tgt.com', 'admin@x.com')).rejects.toThrow('network blip');
  });
});
