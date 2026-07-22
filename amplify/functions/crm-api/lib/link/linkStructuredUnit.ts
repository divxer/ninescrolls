import { GetCommand, QueryCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../dynamodb';
import { orgExists, recomputeRollupsForOrg } from '../orgStore';
import { markRollupApplied } from '../timelineStore';
import { generateUlid } from '../ulid';
import { manualMoveTimelineEvent, buildMovedItem, MOVE_ELIGIBILITY_CONDITION } from './manualMoveTimelineEvent';
import { orgActiveCheck, classifyLinkCancellation } from './orgFence';
import { readSourceEmailForUnit, backfillTargetPk } from './sourceEmail';
import { buildStructuredMarkerPut, accumulateMarker, sealMarker, deleteRepairMarkerFenced, type StructuredMarkerV2 } from '../repair/repairMarker';
import { replayStructuredSideEffects } from '../repair/replaySideEffects';
import type { TimelineEventItem, TimelineSource } from '../types';

// R5/R6: the unit is server-derived from a fully-validated representative — a client can only name
// an event, never assert a unit shape. gmail is allowed HERE (new contract); the handler's legacy
// transitional adapter (Task 10 Step 4) still refuses gmail via legacy args.
const ALLOWED_SOURCES = new Set<TimelineSource>(['rfq', 'lead', 'order', 'quote', 'logistics', 'gmail']);

// Paginated, eligibility-filtered unit read (3B + the R7 filters). Exported: the handler's
// transitional legacy-args adapter derives the representative from this same read.
export async function queryUnitEvents(unitKey: string): Promise<TimelineEventItem[]> {
  const events: TimelineEventItem[] = [];
  let startKey: Record<string, unknown> | undefined;
  do {
    const q = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME(), IndexName: 'GSI2',
      KeyConditionExpression: 'GSI2PK = :pk AND begins_with(GSI2SK, :tl)',
      FilterExpression: 'resolutionStatus = :unres AND voided = :false AND isInternalOnly = :false',
      ExpressionAttributeValues: { ':pk': `ORG#${unitKey}`, ':tl': 'TLEVENT#', ':unres': 'unresolved', ':false': false },
      ExclusiveStartKey: startKey,
    }));
    events.push(...((q.Items ?? []) as TimelineEventItem[]));
    startKey = q.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (startKey);
  return events;
}

// R7 per-event eligibility, mirrored in memory: the query filter excludes voided/internal rows in
// DynamoDB; source-mismatched siblings (and filter-lagged rows) are partitioned out HERE so they
// are counted skipped WITHOUT a write. The write-time ConditionExpression stays the authoritative
// guard against concurrent state changes.
const isEligible = (ev: TimelineEventItem, src: string) =>
  ev.resolutionStatus === 'unresolved' && !ev.voided && !ev.isInternalOnly && ev.source === src;

// The R7-conditioned Put for the first move — the movedItem is built by the SAME buildMovedItem as
// manualMoveTimelineEvent, so the two paths cannot drift.
function buildMoveTransactPut(event: TimelineEventItem, targetOrgId: string, email: string | null, nowIso: string, linkGeneration: string, src: string) {
  return { Put: {
    TableName: TABLE_NAME(), Item: buildMovedItem(event, targetOrgId, email, nowIso, linkGeneration),
    ConditionExpression: MOVE_ELIGIBILITY_CONDITION,
    ExpressionAttributeNames: { '#source': 'source' },
    ExpressionAttributeValues: { ':unres': 'unresolved', ':syn': event.orgId, ':false': false, ':src': src },
  } };
}

// Rollup/markRollupApplied for the transact-committed first move — best-effort, as 3B (the moved
// row carries rollupApplied:false, so the sweep repairs a crash here). Contact linking for the unit
// is the generational replay's effect (it receives customerEmail + generation), not this path's.
async function postMoveEffects(event: TimelineEventItem, targetOrgId: string): Promise<void> {
  try {
    await recomputeRollupsForOrg(targetOrgId);
    await markRollupApplied(event.id);
  } catch (err) {
    console.error(JSON.stringify({ event: 'crm.link.post_move_error', id: event.id, error: err instanceof Error ? err.message : String(err) }));
  }
}

export async function linkStructuredUnit(args: { representativeEventId: string; targetOrgId: string; operator: string }): Promise<Record<string, unknown>> {
  if (!(await orgExists(args.targetOrgId))) throw new Error(`invalid target org: ${args.targetOrgId}`);

  // R5/R6: server-derived unit from a strongly-read, FULLY-validated representative
  const rep = (await docClient.send(new GetCommand({
    TableName: TABLE_NAME(), Key: { PK: `TLEVENT#${args.representativeEventId}`, SK: 'A' }, ConsistentRead: true,
  }))).Item as TimelineEventItem | undefined;
  if (!rep || rep.resolutionStatus !== 'unresolved' || rep.voided || rep.isInternalOnly
      || !rep.orgId.startsWith('unresolved-') || !ALLOWED_SOURCES.has(rep.source)) {
    throw new Error('invalid representative event');
  }
  const unitKey = rep.orgId, sourceType = rep.source, sourceEntityId = rep.sourceEntityId;
  const generation = generateUlid();
  const nowIso = new Date().toISOString();
  const customerEmail = sourceType === 'gmail'
    ? ((rep.payload?.customerEmail as string | undefined) ?? null) : null;

  // paginated, eligibility-filtered unit read (as 3B, plus the R7 filters)
  const queried = await queryUnitEvents(unitKey);
  if (queried.length === 0) {
    // No backfill from a possibly-stale request target (3B invariant): an empty synthetic
    // partition proves only that SOME prior request moved the events, not that it moved them HERE.
    return { alreadyLinked: true, affected: 0, moved: 0, skipped: 0, errors: 0 };
  }
  const events = queried.filter((ev) => isEligible(ev, sourceType));
  let skipped = queried.length - events.length;
  if (events.length === 0) return { affected: queried.length, moved: 0, skipped, errors: 0 };

  let backfillPk: string | null = null;
  try { backfillPk = await backfillTargetPk(sourceType, sourceEntityId, events); } catch { /* drainer re-resolves */ }
  let sourceEmail: string | null = customerEmail; let enrichmentError = false;
  if (!sourceEmail) { try { sourceEmail = await readSourceEmailForUnit(sourceType, sourceEntityId, events); } catch { enrichmentError = true; } }

  // R6/R8: FIRST eligible move + building-marker in ONE transaction (loser aborts → no marker)
  const [first, ...rest] = events;
  const firstMove = buildMoveTransactPut(first, args.targetOrgId, sourceEmail, nowIso, generation, sourceType);
  const marker = buildStructuredMarkerPut({ unitKey, generation, targetOrgId: args.targetOrgId, operator: args.operator,
    createdAt: nowIso, sourceType, sourceEntityId, backfillPk, customerEmail: sourceEmail,
    movedCount: 1, affectedEventIdsSample: [first.id], contactStatus: enrichmentError ? 'enrichment_error' : 'missing_email' });
  let moved = 0, errors = 0; let markerHandle: StructuredMarkerV2 | null = null;
  try {
    // R6: position 0 is ALWAYS the org-active fence; 1 = event move; 2 = marker
    await docClient.send(new TransactWriteCommand({ TransactItems: [orgActiveCheck(args.targetOrgId), firstMove, marker] }));
    moved = 1; markerHandle = marker.Put.Item as unknown as StructuredMarkerV2;
    await postMoveEffects(first, args.targetOrgId);       // rollup/markRollupApplied — best-effort, as 3B
  } catch (err) {
    const cls = classifyLinkCancellation(err, 1);         // POSITIONAL CancellationReasons mapping (org-fence index 0, move index given)
    if (cls === 'org_fence') throw new Error(`target org ${args.targetOrgId} is not active (being merged?) — retry against its successor`);
    if (cls === 'move_condition') { skipped += 1; }       // loser path
    else throw err;
  }
  if (!markerHandle) return { affected: queried.length, moved: 0, skipped, errors };

  for (const ev of rest) {                                // remaining moves: per-event conditional, fenced accumulate
    try {
      const r = await manualMoveTimelineEvent({ event: ev, targetOrgId: args.targetOrgId, email: sourceEmail, operator: args.operator, nowIso, enrichmentError, representativeSource: sourceType, linkGeneration: generation });
      if (r.moved) {
        moved += 1;
        const acc = await accumulateMarker(markerHandle, { movedCountDelta: 1, newSampleIds: [ev.id], contactStatus: r.contactStatus }, nowIso);
        if (acc.lost) {
          // plan-review fix: version fence lost = another actor (aged→drained) owns the marker.
          // ABORT immediately: stop moving; unmoved events stay unresolved and re-surface (convergent).
          return { affected: queried.length, moved, skipped, errors, sourceBackfillStatus: 'not_attempted', contactStatus: markerHandle.contactStatus, postCommitStatus: 'post_commit_failed' };
        }
      }
      else if (r.skipped) skipped += 1;
    } catch { errors += 1; }
  }

  // Invariant #10: nothing below throws — the moves are durable; post-commit failure is a status.
  let postCommitStatus: 'ok' | 'post_commit_failed' = 'ok';
  const replay = await replayStructuredSideEffects({ sourceType, sourceEntityId, backfillPk, targetOrgId: args.targetOrgId,
    unitKey, operator: args.operator, createdAt: nowIso, generation, customerEmail: sourceEmail,
    movedCount: moved, affectedEventIds: markerHandle.affectedEventIdsSample, contactStatus: markerHandle.contactStatus ?? 'missing_email' });
  if (replay.ok) {
    const del = await deleteRepairMarkerFenced(markerHandle);
    if (del.lost) postCommitStatus = 'post_commit_failed';       // another actor owns it now — fine
  } else {
    postCommitStatus = 'post_commit_failed';
    const seal = await sealMarker(markerHandle, nowIso);          // building → pending: publish to the drainer
    if (seal.lost) { /* aged/raced — the other actor published or handled it */ }
  }
  return { affected: queried.length, moved, skipped, errors, sourceBackfillStatus: replay.backfillStatus ?? 'not_attempted', contactStatus: markerHandle.contactStatus, postCommitStatus };
}
