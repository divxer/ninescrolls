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

  const q = await docClient.send(new QueryCommand({
    TableName: TABLE_NAME(), IndexName: 'GSI2',
    KeyConditionExpression: 'GSI2PK = :pk AND begins_with(GSI2SK, :tl)',
    FilterExpression: 'resolutionStatus = :unres',
    ExpressionAttributeValues: { ':pk': `ORG#${syntheticOrgId}`, ':tl': 'TLEVENT#', ':unres': 'unresolved' },
  }));
  const events = (q.Items ?? []) as TimelineEventItem[];
  if (events.length === 0) return { alreadyLinked: true, affected: 0, moved: 0, skipped: 0, errors: 0 };

  const sourceEmail = await readSourceEmailForUnit(args.sourceType, args.sourceEntityId, events);

  let moved = 0, skipped = 0, errors = 0; let contactStatus: ContactStatus = 'missing_email';
  const affectedEventIds: string[] = [];
  for (const ev of events) {
    try {
      const r = await manualMoveTimelineEvent({ event: ev, targetOrgId: args.targetOrgId, email: sourceEmail, operator: args.operator, nowIso });
      if (r.moved) { moved += 1; affectedEventIds.push(ev.id); contactStatus = r.contactStatus; }
      else if (r.skipped) skipped += 1;
    } catch { errors += 1; }
  }

  if (moved === 0) return { affected: events.length, moved: 0, skipped, errors };

  const sourceBackfillStatus = await backfillSource(args.sourceType, args.sourceEntityId, args.targetOrgId, events);

  await writeLinkAuditLog({
    operator: args.operator, reason: 'manual_link_unit', timestamp: nowIso, newOrgId: args.targetOrgId,
    details: { unitType: 'structured', unitKey: syntheticOrgId, targetOrgId: args.targetOrgId, affectedCount: moved, affectedEventIds, sourceBackfillStatus, contactStatus },
  });

  return { affected: events.length, moved, skipped, errors, sourceBackfillStatus, contactStatus };
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
