import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../dynamodb';
import { orgExists } from '../orgStore';
import { manualMoveTimelineEvent, type ContactStatus } from './manualMoveTimelineEvent';
import { readSourceEmailForUnit, backfillTargetPk } from './sourceEmail';
import { putRepairMarker, deleteRepairMarker } from '../repair/repairMarker';
import { replayStructuredSideEffects } from '../repair/replaySideEffects';
import type { TimelineEventItem } from '../types';

export async function linkStructuredUnit(args: { sourceType: string; sourceEntityId: string; targetOrgId: string; operator: string }): Promise<Record<string, unknown>> {
  if (!(await orgExists(args.targetOrgId))) throw new Error(`invalid target org: ${args.targetOrgId}`);
  const syntheticOrgId = `unresolved-${args.sourceType}-${args.sourceEntityId}`;
  const nowIso = new Date().toISOString();

  const events: TimelineEventItem[] = [];
  let startKey: Record<string, unknown> | undefined;
  do {
    const q = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME(), IndexName: 'GSI2',
      KeyConditionExpression: 'GSI2PK = :pk AND begins_with(GSI2SK, :tl)',
      FilterExpression: 'resolutionStatus = :unres',
      ExpressionAttributeValues: { ':pk': `ORG#${syntheticOrgId}`, ':tl': 'TLEVENT#', ':unres': 'unresolved' },
      ExclusiveStartKey: startKey,
    }));
    events.push(...((q.Items ?? []) as TimelineEventItem[]));
    startKey = q.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (startKey);
  if (events.length === 0) {
    // Do NOT backfill the source here. An empty synthetic partition only tells us the events
    // were already moved by *some* prior request — it carries no proof that THIS request's
    // targetOrgId is the org they actually moved to. A stale admin resubmitting the same unit
    // with a different (now-outdated) target could otherwise clobber a correct matchedOrgId,
    // or, when the source is still unresolved (the exact case a "repair" would want to fix),
    // write the wrong org because the stale target is indistinguishable from a fresh one.
    // Recovering a missing structured backfill is deferred to a later sweep/health job (3C);
    // it also self-heals whenever a new event re-queues the unit through the moved>0 path below.
    return { alreadyLinked: true, affected: 0, moved: 0, skipped: 0, errors: 0 };
  }

  let sourceEmail: string | null = null;
  let enrichmentError = false;
  try {
    sourceEmail = await readSourceEmailForUnit(args.sourceType, args.sourceEntityId, events);
  } catch {
    enrichmentError = true;
  }

  let moved = 0, skipped = 0, errors = 0;
  let contactStatus: ContactStatus = enrichmentError ? 'enrichment_error' : 'missing_email';
  const affectedEventIds: string[] = [];
  for (const ev of events) {
    try {
      const r = await manualMoveTimelineEvent({ event: ev, targetOrgId: args.targetOrgId, email: sourceEmail, operator: args.operator, nowIso, enrichmentError });
      if (r.moved) { moved += 1; affectedEventIds.push(ev.id); contactStatus = r.contactStatus; }
      else if (r.skipped) skipped += 1;
    } catch { errors += 1; }
  }

  if (moved === 0) return { affected: events.length, moved: 0, skipped, errors };

  // Resolve the backfill PK best-effort for caching. logistics does a Get that CAN throw; if it does,
  // the marker is still written with backfillPk:null and the drainer re-resolves (spec §5).
  let backfillPk: string | null = null;
  try { backfillPk = await backfillTargetPk(args.sourceType, args.sourceEntityId, events); } catch { /* drainer re-resolves */ }

  let postCommitStatus: 'ok' | 'post_commit_failed' = 'ok';

  // Marker written AFTER the durable commit (moved>0), BEFORE the fragile side effects, carrying the committed target.
  try {
    await putRepairMarker({
      unitType: 'structured', unitKey: syntheticOrgId, targetOrgId: args.targetOrgId, operator: args.operator, createdAt: nowIso,
      sourceType: args.sourceType, sourceEntityId: args.sourceEntityId, backfillPk,
      affectedEventIds, movedCount: moved, contactStatus,
    });
  } catch (err) {
    postCommitStatus = 'post_commit_failed';
    console.error(JSON.stringify({ event: 'crm.link.marker_put_error', unitKey: syntheticOrgId, error: err instanceof Error ? err.message : String(err) }));
  }

  const replay = await replayStructuredSideEffects({
    sourceType: args.sourceType, sourceEntityId: args.sourceEntityId, backfillPk, targetOrgId: args.targetOrgId,
    unitKey: syntheticOrgId, operator: args.operator, createdAt: nowIso, affectedEventIds, movedCount: moved, contactStatus,
  });
  if (replay.ok) {
    try { await deleteRepairMarker('structured', syntheticOrgId); }
    catch { postCommitStatus = 'post_commit_failed'; }
  } else {
    postCommitStatus = 'post_commit_failed';
  }

  return { affected: events.length, moved, skipped, errors, sourceBackfillStatus: replay.backfillStatus ?? 'not_attempted', contactStatus, postCommitStatus };
}
