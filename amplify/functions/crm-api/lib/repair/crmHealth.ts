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

const MERGE_REVIEW_LIMIT = 20;

// Task 12: merge-residual review queue — ONE bounded GSI1 Query on the needs_review partition
// (GSI1SK = mergedAt ⇒ oldest first). The admin acknowledges entries via Task 13's
// acknowledgeMergeRecon mutation; count is a floor (≤20), same no-Scan rule as the buckets.
async function mergeReview() {
  const res = await docClient.send(new QueryCommand({
    TableName: TABLE_NAME(), IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk',
    ExpressionAttributeValues: { ':pk': 'MERGE_RECON#needs_review' },
    ScanIndexForward: true, Limit: MERGE_REVIEW_LIMIT,
  }));
  const items = (res.Items ?? []) as Array<Record<string, unknown>>;
  return {
    count: items.length,
    markers: items.map((m) => ({
      fromOrgId: m.fromOrgId, toOrgId: m.toOrgId, version: m.version,
      residualsDetected: m.residualsDetected, residualSamples: m.residualSamples, probedAt: m.probedAt,
    })),
  };
}

export async function crmHealth(): Promise<Record<string, unknown>> {
  const [pending, stuck, review, repairState, hotState, coldState, dirtyState] = await Promise.all([
    bucket('CRM_REPAIR#pending'),
    bucket('CRM_REPAIR#stuck'),
    mergeReview(),
    readState('repair', 'drain'),
    readState('hot', 'existence'),
    readState('cold', 'existence'),
    readState('cold', 'dirty-rollups'),
  ]);
  return {
    repairPending: pending,
    repairStuck: stuck,
    mergeNeedsReviewCount: review.count,
    mergeReviewMarkers: review.markers,
    lastRepairSummary: repairState.lastSummary ?? null,
    lastHotSweep: withHasMore(hotState),
    lastColdSweep: withHasMore(coldState),
    lastDirtyRollupSweep: dirtyState.lastSummary ?? null,
  };
}
