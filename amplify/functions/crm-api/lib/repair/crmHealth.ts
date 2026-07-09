import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../dynamodb';
import { readState } from '../sweep/sweepState';
import type { RepairMarkerItem } from './repairMarker';

const SAMPLE = 25;

function toSample(m: RepairMarkerItem) {
  return {
    unitType: m.unitType, unitKey: m.unitKey, targetOrgId: m.targetOrgId,
    attemptCount: m.attemptCount ?? 0, stuckReason: m.stuckReason ?? null,
    lastError: m.lastError ?? null, createdAt: m.createdAt,
  };
}

async function bucket(pk: 'CRM_REPAIR#pending' | 'CRM_REPAIR#stuck') {
  const res = await docClient.send(new QueryCommand({
    TableName: TABLE_NAME(), IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk',
    ExpressionAttributeValues: { ':pk': pk },
    ScanIndexForward: true, Limit: SAMPLE,
  }));
  const items = (res.Items ?? []) as RepairMarkerItem[];
  // count is a floor (up to SAMPLE); `more` signals the true count exceeds the sample. No Scan.
  return { count: items.length, more: !!res.LastEvaluatedKey, sample: items.map(toSample) };
}

function withHasMore(s: { lastSummary?: Record<string, unknown>; hasMore?: boolean }) {
  return s.lastSummary ? { ...s.lastSummary, hasMore: s.hasMore ?? false } : null;
}

export async function crmHealth(): Promise<Record<string, unknown>> {
  const [pending, stuck, repairState, hotState, coldState, dirtyState] = await Promise.all([
    bucket('CRM_REPAIR#pending'),
    bucket('CRM_REPAIR#stuck'),
    readState('repair', 'drain'),
    readState('hot', 'existence'),
    readState('cold', 'existence'),
    readState('cold', 'dirty-rollups'),
  ]);
  return {
    repairPending: pending,
    repairStuck: stuck,
    lastRepairSummary: repairState.lastSummary ?? null,
    lastHotSweep: withHasMore(hotState),
    lastColdSweep: withHasMore(coldState),
    lastDirtyRollupSweep: dirtyState.lastSummary ?? null,
  };
}
