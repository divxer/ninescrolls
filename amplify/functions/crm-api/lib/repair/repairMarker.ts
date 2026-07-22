import { GetCommand, PutCommand, DeleteCommand, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../dynamodb';

export type RepairUnitType = 'structured' | 'analytics';

export interface RepairMarkerItem {
  PK: string; SK: 'STATE';
  GSI1PK: 'CRM_REPAIR#pending' | 'CRM_REPAIR#stuck'; GSI1SK: string;
  entityType: 'CRM_REPAIR';
  unitType: RepairUnitType; unitKey: string;
  targetOrgId: string; operator: string; createdAt: string;
  status: 'pending' | 'stuck'; stuckReason: 'source_conflict' | 'max_attempts' | null;
  attemptCount: number; lastAttemptAt: string | null; lastError: string | null;
  sourceType?: string; sourceEntityId?: string; backfillPk?: string | null;
  affectedEventIds?: string[]; movedCount?: number; contactStatus?: string;
}

export function repairMarkerKeys(unitType: RepairUnitType, unitKey: string) {
  return { PK: `CRM_REPAIR#${unitType}#${unitKey}`, SK: 'STATE' as const };
}

// Deterministic-PK Put — overwrites the same committed unit's metadata; never mints a duplicate.
// Reached ONLY after a durable commit (moved>0 / bridge upsert written), so targetOrgId is committed.
export async function putRepairMarker(args: {
  unitType: RepairUnitType; unitKey: string; targetOrgId: string; operator: string; createdAt: string;
  sourceType?: string; sourceEntityId?: string; backfillPk?: string | null;
  affectedEventIds?: string[]; movedCount?: number; contactStatus?: string;
}): Promise<void> {
  const item: RepairMarkerItem = {
    ...repairMarkerKeys(args.unitType, args.unitKey),
    GSI1PK: 'CRM_REPAIR#pending', GSI1SK: `${args.createdAt}#${args.unitKey}`,
    entityType: 'CRM_REPAIR',
    unitType: args.unitType, unitKey: args.unitKey,
    targetOrgId: args.targetOrgId, operator: args.operator, createdAt: args.createdAt,
    status: 'pending', stuckReason: null, attemptCount: 0, lastAttemptAt: null, lastError: null,
    ...(args.unitType === 'structured' ? {
      sourceType: args.sourceType, sourceEntityId: args.sourceEntityId, backfillPk: args.backfillPk ?? null,
      affectedEventIds: args.affectedEventIds ?? [], movedCount: args.movedCount ?? 0, contactStatus: args.contactStatus ?? 'missing_email',
    } : {}),
  };
  await docClient.send(new PutCommand({ TableName: TABLE_NAME(), Item: item }));
}

export async function deleteRepairMarker(unitType: RepairUnitType, unitKey: string): Promise<void> {
  await docClient.send(new DeleteCommand({ TableName: TABLE_NAME(), Key: repairMarkerKeys(unitType, unitKey) }));
}

// Terminal: move OFF the pending partition; never auto-retried (Health-read-only).
export async function markStuck(m: RepairMarkerItem, reason: 'source_conflict' | 'max_attempts', lastError: string, nowIso: string): Promise<void> {
  await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME(), Key: repairMarkerKeys(m.unitType, m.unitKey),
    UpdateExpression: 'SET GSI1PK = :g, #s = :st, stuckReason = :sr, lastError = :e, lastAttemptAt = :now, attemptCount = :a',
    ConditionExpression: 'attribute_exists(PK)',
    ExpressionAttributeNames: { '#s': 'status' },
    ExpressionAttributeValues: { ':g': 'CRM_REPAIR#stuck', ':st': 'stuck', ':sr': reason, ':e': lastError, ':now': nowIso, ':a': (m.attemptCount ?? 0) + 1 },
  }));
}

// Transient failure: stay pending, count the attempt.
export async function bumpAttempt(m: RepairMarkerItem, lastError: string, nowIso: string): Promise<void> {
  await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME(), Key: repairMarkerKeys(m.unitType, m.unitKey),
    UpdateExpression: 'SET attemptCount = :a, lastError = :e, lastAttemptAt = :now',
    ConditionExpression: 'attribute_exists(PK)',
    ExpressionAttributeValues: { ':a': (m.attemptCount ?? 0) + 1, ':e': lastError, ':now': nowIso },
  }));
}

// Progress (analytics retro hasMore): stay pending, not an error.
export async function touchInProgress(m: RepairMarkerItem, nowIso: string): Promise<void> {
  await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME(), Key: repairMarkerKeys(m.unitType, m.unitKey),
    UpdateExpression: 'SET lastAttemptAt = :now',
    ConditionExpression: 'attribute_exists(PK)',
    ExpressionAttributeValues: { ':now': nowIso },
  }));
}

export async function queryPendingMarkers(limit: number): Promise<{ markers: RepairMarkerItem[]; hasMore: boolean }> {
  const res = await docClient.send(new QueryCommand({
    TableName: TABLE_NAME(), IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk',
    ExpressionAttributeValues: { ':pk': 'CRM_REPAIR#pending' },
    ScanIndexForward: true, // oldest-first (GSI1SK = createdAt#unitKey)
    Limit: limit,
  }));
  return { markers: (res.Items ?? []) as RepairMarkerItem[], hasMore: !!res.LastEvaluatedKey };
}

// ---------------------------------------------------------------------------
// v2 — structured markers: generation-suffixed PKs, building→pending→stuck
// lifecycle, version fencing on every transition, bounded fields.
//
// The v1 functions above (putRepairMarker/deleteRepairMarker/markStuck/
// bumpAttempt/touchInProgress/queryPendingMarkers) are UNCHANGED and remain
// the live API for ANALYTICS markers and for STRUCTURED callers until they
// migrate (linkStructuredUnit.ts in Task 10, reconcileRepair.ts in Task 12).
// Do not route them through the v2 fenced helpers below.
// ---------------------------------------------------------------------------

export interface StructuredMarkerV2 extends Omit<RepairMarkerItem, 'status' | 'stuckReason'> {
  generation: string; version: number;
  status: 'building' | 'pending' | 'stuck';
  stuckReason?: string; stuckReasonClass?: 'target_unavailable' | 'other';   // R5: recovery pass queries by class
  customerEmail: string | null; movedCount: number; affectedEventIdsSample: string[];
}
// Stuck markers live in GSI1PK 'CRM_REPAIR#stuck#<reasonClass>' — REASON-KEYED partitions
// (R6: Limit precedes FilterExpression, so a shared partition + filter starves recovery);
// markStuckV2(marker, reason, reasonClass, now) sets stuckReason + stuckReasonClass + the keyed
// GSI1PK; republishStuckFenced flips stuck→pending (version-fenced) for normal draining.
export const SAMPLE_CAP = 100;

export function structuredMarkerKey(unitKey: string, generation: string) {
  return { PK: `CRM_REPAIR#structured#${unitKey}#${generation}`, SK: 'STATE' as const };
}

// Built for TransactWriteItems (Task 10): the Put rides the same transaction as the FIRST move.
export function buildStructuredMarkerPut(args: {
  unitKey: string; generation: string; targetOrgId: string; operator: string; createdAt: string;
  sourceType: string; sourceEntityId: string; backfillPk: string | null;
  customerEmail: string | null; movedCount: number; affectedEventIdsSample: string[]; contactStatus: string;
}) {
  return { Put: {
    TableName: TABLE_NAME(),
    Item: {
      ...structuredMarkerKey(args.unitKey, args.generation),
      GSI1PK: 'CRM_REPAIR#building', GSI1SK: `${args.createdAt}#${args.unitKey}`,
      entityType: 'CRM_REPAIR', unitType: 'structured' as const,
      unitKey: args.unitKey, generation: args.generation, version: 1,
      targetOrgId: args.targetOrgId, operator: args.operator, createdAt: args.createdAt,
      status: 'building' as const, stuckReason: null, attemptCount: 0, lastAttemptAt: null, lastError: null,
      sourceType: args.sourceType, sourceEntityId: args.sourceEntityId, backfillPk: args.backfillPk,
      customerEmail: args.customerEmail, movedCount: args.movedCount,
      affectedEventIdsSample: args.affectedEventIdsSample.slice(0, SAMPLE_CAP), contactStatus: args.contactStatus,
    },
    ConditionExpression: 'attribute_not_exists(PK)',   // R8: ULID collision aborts, never overwrites
  }};
}

const fenced = (m: StructuredMarkerV2) => ({ ':v': m.version });

export async function accumulateMarker(m: StructuredMarkerV2, d: { movedCountDelta: number; newSampleIds: string[]; contactStatus?: string }, nowIso: string): Promise<{ lost: boolean }> {
  const sample = [...m.affectedEventIdsSample, ...d.newSampleIds].slice(0, SAMPLE_CAP);
  const res = await fencedUpdate(m, 'SET movedCount = movedCount + :d, affectedEventIdsSample = :sample, version = :nv, lastAttemptAt = :now' + (d.contactStatus ? ', contactStatus = :cs' : ''), {
    ':d': d.movedCountDelta, ':sample': sample, ':now': nowIso, ...(d.contactStatus ? { ':cs': d.contactStatus } : {}),
  });
  if (!res.lost) {
    // Sync the in-memory handle with the EXACT fields just written (version is advanced inside
    // fencedUpdate): the next accumulate must extend THIS sample, not the original array —
    // otherwise the stored sample collapses to ~original+latest-delta instead of growing to the cap.
    m.affectedEventIdsSample = sample;
    m.movedCount += d.movedCountDelta;
    m.lastAttemptAt = nowIso;
    if (d.contactStatus) m.contactStatus = d.contactStatus;
  }
  return res;
}
export async function sealMarker(m: StructuredMarkerV2, nowIso: string): Promise<{ lost: boolean }> {
  return fencedUpdate(m, 'SET GSI1PK = :g, #s = :st, version = :nv, lastAttemptAt = :now',
    { ':g': 'CRM_REPAIR#pending', ':st': 'pending', ':now': nowIso }, { '#s': 'status' });
}
export async function deleteRepairMarkerFenced(m: StructuredMarkerV2): Promise<{ lost: boolean }> {
  try {
    await docClient.send(new DeleteCommand({ TableName: TABLE_NAME(), Key: structuredMarkerKey(m.unitKey, m.generation),
      ConditionExpression: 'version = :v', ExpressionAttributeValues: fenced(m) }));
    return { lost: false };
  } catch (err) {
    if ((err as { name?: string }).name === 'ConditionalCheckFailedException') return { lost: true };
    throw err;
  }
}
async function fencedUpdate(m: StructuredMarkerV2, expr: string, values: Record<string, unknown>, names?: Record<string, string>): Promise<{ lost: boolean }> {
  try {
    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME(), Key: structuredMarkerKey(m.unitKey, m.generation),
      UpdateExpression: expr, ConditionExpression: 'attribute_exists(PK) AND version = :v',
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: { ...values, ...fenced(m), ':nv': m.version + 1 },
    }));
    m.version += 1;                        // keep the in-memory handle fenceable for the next call
    return { lost: false };
  } catch (err) {
    if ((err as { name?: string }).name === 'ConditionalCheckFailedException') return { lost: true };
    throw err;
  }
}
export async function queryBuildingOlderThan(cutoffIso: string, limit: number, startKey?: Record<string, unknown>): Promise<{ markers: StructuredMarkerV2[]; lastKey?: Record<string, unknown> }> {
  const res = await docClient.send(new QueryCommand({
    TableName: TABLE_NAME(), IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk AND GSI1SK < :cut',
    ExpressionAttributeValues: { ':pk': 'CRM_REPAIR#building', ':cut': `${cutoffIso}#￿` },
    ScanIndexForward: true, Limit: limit, ExclusiveStartKey: startKey,
  }));
  return { markers: (res.Items ?? []) as StructuredMarkerV2[], lastKey: res.LastEvaluatedKey as Record<string, unknown> | undefined };
}

// plan-review fix: promotion has its OWN condition — must still be building, same version, AND
// past the age cutoff (a fresh foreground seal/accumulate must never be clobbered by the ager).
export async function promoteAbandonedBuilding(m: StructuredMarkerV2, cutoffIso: string, nowIso: string): Promise<{ lost: boolean }> {
  try {
    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME(), Key: structuredMarkerKey(m.unitKey, m.generation),
      UpdateExpression: 'SET GSI1PK = :g, #s = :pending, version = :nv, lastAttemptAt = :now',
      ConditionExpression: 'attribute_exists(PK) AND #s = :building AND version = :v AND createdAt < :cut',
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues: { ':g': 'CRM_REPAIR#pending', ':pending': 'pending', ':building': 'building', ':v': m.version, ':nv': m.version + 1, ':now': nowIso, ':cut': cutoffIso },
    }));
    return { lost: false };
  } catch (err) {
    if ((err as { name?: string }).name === 'ConditionalCheckFailedException') return { lost: true };
    throw err;
  }
}

// R5 blocker 3: blocked markers must be discoverable and recoverable — moves the marker into a
// REASON-KEYED stuck partition (GSI1PK = 'CRM_REPAIR#stuck#<reasonClass>') so a recovery pass can
// Query by class with NO FilterExpression (R6: Limit is applied before filters, so a shared
// partition + filter would starve recovery under load).
export async function markStuckV2(m: StructuredMarkerV2, reason: string, reasonClass: 'target_unavailable' | 'other', nowIso: string): Promise<{ lost: boolean }> {
  return fencedUpdate(m, 'SET GSI1PK = :g, #s = :st, stuckReason = :reason, stuckReasonClass = :reasonClass, version = :nv, lastAttemptAt = :now',
    { ':g': `CRM_REPAIR#stuck#${reasonClass}`, ':st': 'stuck', ':reason': reason, ':reasonClass': reasonClass, ':now': nowIso },
    { '#s': 'status' });
}

export async function queryStuckByReason(reasonClass: string, limit: number, startKey?: Record<string, unknown>): Promise<{ markers: StructuredMarkerV2[]; lastKey?: Record<string, unknown> }> {
  const res = await docClient.send(new QueryCommand({
    TableName: TABLE_NAME(), IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk',
    ExpressionAttributeValues: { ':pk': `CRM_REPAIR#stuck#${reasonClass}` },
    ScanIndexForward: true, Limit: limit, ExclusiveStartKey: startKey,
  }));
  return { markers: (res.Items ?? []) as StructuredMarkerV2[], lastKey: res.LastEvaluatedKey as Record<string, unknown> | undefined };
}

// Task 12: transient failure on a v2 marker — stay pending, count the attempt. The v1 bumpAttempt
// targets the un-suffixed v1 PK and is unfenced; v2 markers need the generation-suffixed key + fence.
export async function bumpAttemptFenced(m: StructuredMarkerV2, lastError: string, nowIso: string): Promise<{ lost: boolean }> {
  return fencedUpdate(m, 'SET attemptCount = :a, lastError = :e, version = :nv, lastAttemptAt = :now',
    { ':a': (m.attemptCount ?? 0) + 1, ':e': lastError, ':now': nowIso });
}

// Recovery: flip a stuck marker back into normal draining (stuck→pending), version-fenced.
export async function republishStuckFenced(m: StructuredMarkerV2, nowIso: string): Promise<{ lost: boolean }> {
  return fencedUpdate(m, 'SET GSI1PK = :g, #s = :st, version = :nv, lastAttemptAt = :now',
    { ':g': 'CRM_REPAIR#pending', ':st': 'pending', ':now': nowIso }, { '#s': 'status' });
}

// ---------------------------------------------------------------------------
// Task 13 (R9): MERGE_RECON needs_review → acknowledged — the operator's sign-off on Task 12's
// merge-residual review queue. Mirrors organization-api's mergeReconKey (PK/SK convention).
// ---------------------------------------------------------------------------

export function mergeReconKey(fromOrgId: string, toOrgId: string) {
  return { PK: `MERGE_RECON#${fromOrgId}`, SK: `TO#${toOrgId}` };
}

export type AcknowledgeMergeReconResult = { ok: true } | { ok: false; notFound: true } | { ok: false; raced: true };

// Strong-read the marker for its current version, then a version-fenced flip out of the
// needs_review partition. Retention: acknowledged markers are KEPT INDEFINITELY (evidence for a
// future merge-integrity arc) — this function never deletes or TTLs a marker.
export async function acknowledgeMergeReconFenced(fromOrgId: string, toOrgId: string, actor: string): Promise<AcknowledgeMergeReconResult> {
  const key = mergeReconKey(fromOrgId, toOrgId);
  const read = await docClient.send(new GetCommand({ TableName: TABLE_NAME(), Key: key, ConsistentRead: true }));
  const marker = read.Item as { version?: number } | undefined;
  if (!marker) return { ok: false, notFound: true };

  const nowIso = new Date().toISOString();
  try {
    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME(), Key: key,
      UpdateExpression: 'SET #st = :ack, GSI1PK = :ackPk, acknowledgedBy = :actor, acknowledgedAt = :now, updatedAt = :now, version = version + :one',
      ConditionExpression: '#st = :review AND version = :v',
      ExpressionAttributeNames: { '#st': 'state' },
      ExpressionAttributeValues: {
        ':ack': 'acknowledged', ':ackPk': 'MERGE_RECON#acknowledged',
        ':actor': actor, ':now': nowIso, ':one': 1,
        ':review': 'needs_review', ':v': marker.version,
      },
    }));
    return { ok: true };
  } catch (err) {
    if ((err as { name?: string }).name === 'ConditionalCheckFailedException') return { ok: false, raced: true };
    throw err;
  }
}
