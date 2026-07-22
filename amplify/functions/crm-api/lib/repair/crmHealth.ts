import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../dynamodb';
import { readState } from '../sweep/sweepState';
import type { RepairMarkerItem, StructuredMarkerV2 } from './repairMarker';

const SAMPLE = 25;

// v2 stuck markers live in REASON-KEYED partitions (Task 9, R6: keyed, never filtered); the health
// stuck bucket must merge them with the legacy v1 partition or v2 stuck markers are invisible.
const STUCK_PARTITIONS = ['CRM_REPAIR#stuck', 'CRM_REPAIR#stuck#target_unavailable', 'CRM_REPAIR#stuck#other'] as const;

type HealthMarker = RepairMarkerItem & Partial<Pick<StructuredMarkerV2, 'stuckReasonClass' | 'generation'>>;

function toSample(m: HealthMarker) {
  return {
    unitType: m.unitType, unitKey: m.unitKey, targetOrgId: m.targetOrgId,
    attemptCount: m.attemptCount ?? 0, stuckReason: m.stuckReason ?? null,
    lastError: m.lastError ?? null, createdAt: m.createdAt,
    ...(m.stuckReasonClass ? { stuckReasonClass: m.stuckReasonClass } : {}),
  };
}

// One bounded KeyCondition Query per partition — no FilterExpression, no Scan.
async function bucketPage(pk: string) {
  const res = await docClient.send(new QueryCommand({
    TableName: TABLE_NAME(), IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk',
    ExpressionAttributeValues: { ':pk': pk },
    ScanIndexForward: true, Limit: SAMPLE,
  }));
  return { items: (res.Items ?? []) as HealthMarker[], more: !!res.LastEvaluatedKey };
}

async function bucket(pk: 'CRM_REPAIR#pending') {
  const page = await bucketPage(pk);
  // count is a floor (up to SAMPLE); `more` signals the true count exceeds the sample. No Scan.
  return { count: page.items.length, more: page.more, sample: page.items.map(toSample) };
}

// Stuck = the legacy v1 partition PLUS the reason-keyed v2 partitions, merged. Each partition keeps
// the per-query SAMPLE bound, so the merged result stays bounded (≤3×SAMPLE) and Scan-free.
async function stuckBucket() {
  const pages = await Promise.all(STUCK_PARTITIONS.map((pk) => bucketPage(pk)));
  return {
    count: pages.reduce((n, p) => n + p.items.length, 0),
    more: pages.some((p) => p.more),
    sample: pages.flatMap((p) => p.items.map(toSample)),
  };
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
    stuckBucket(),
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
