import { PutCommand, DeleteCommand, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
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
