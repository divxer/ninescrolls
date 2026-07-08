import { QueryCommand, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../dynamodb';
import { orgExists } from '../orgStore';
import { manualMoveTimelineEvent, type ContactStatus } from './manualMoveTimelineEvent';
import { writeLinkAuditLog } from '../auditStore';
import { readSourceEmailForUnit, backfillTargetPk } from './sourceEmail';
import type { TimelineEventItem } from '../types';

type BackfillStatus = 'written' | 'already_set' | 'conflict' | 'no_source' | 'not_applicable';

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

  let sourceBackfillStatus: BackfillStatus | 'not_attempted' = 'not_attempted';
  let postCommitStatus: 'ok' | 'post_commit_failed' = 'ok';

  // split so a backfill failure does NOT suppress the audit attempt (and vice versa)
  try {
    sourceBackfillStatus = await backfillSource(args.sourceType, args.sourceEntityId, args.targetOrgId, events);
  } catch (err) {
    postCommitStatus = 'post_commit_failed';
    console.error(JSON.stringify({ event: 'crm.link.post_commit_error', unitKey: syntheticOrgId, phase: 'backfill', error: err instanceof Error ? err.message : String(err) }));
  }

  try {
    await writeLinkAuditLog({
      operator: args.operator, reason: 'manual_link_unit', timestamp: nowIso, newOrgId: args.targetOrgId,
      details: { unitType: 'structured', unitKey: syntheticOrgId, targetOrgId: args.targetOrgId, affectedCount: moved, affectedEventIds, sourceBackfillStatus, contactStatus },
    });
  } catch (err) {
    postCommitStatus = 'post_commit_failed';
    console.error(JSON.stringify({ event: 'crm.link.post_commit_error', unitKey: syntheticOrgId, phase: 'audit', error: err instanceof Error ? err.message : String(err) }));
  }

  return { affected: events.length, moved, skipped, errors, sourceBackfillStatus, contactStatus, postCommitStatus };
}

async function backfillSource(sourceType: string, sourceEntityId: string, targetOrgId: string, events: TimelineEventItem[]): Promise<BackfillStatus> {
  const pk = await backfillTargetPk(sourceType, sourceEntityId, events);
  if (!pk) return 'no_source';
  try {
    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME(), Key: { PK: pk, SK: 'META' },
      UpdateExpression: 'SET matchedOrgId = :o',
      ConditionExpression: 'attribute_not_exists(matchedOrgId) OR attribute_type(matchedOrgId, :nullType) OR matchedOrgId = :empty OR begins_with(matchedOrgId, :unres)',
      ExpressionAttributeValues: { ':o': targetOrgId, ':empty': '', ':unres': 'unresolved-', ':nullType': 'NULL' },
    }));
    return 'written';
  } catch (err) {
    if ((err as { name?: string }).name !== 'ConditionalCheckFailedException') throw err;
    const cur = (await docClient.send(new GetCommand({ TableName: TABLE_NAME(), Key: { PK: pk, SK: 'META' } }))).Item as Record<string, unknown> | undefined;
    return (cur?.matchedOrgId as string | undefined) === targetOrgId ? 'already_set' : 'conflict';
  }
}
