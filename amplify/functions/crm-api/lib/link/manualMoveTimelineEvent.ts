import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../dynamodb';
import { timelineEventKeys, contactIdForEmail } from '../keys';
import { normalizeEmail } from '../normalize';
import { recomputeRollupsForOrg } from '../orgStore';
import { markRollupApplied } from '../timelineStore';
import { upsertContact } from '../contactStore';
import type { TimelineEventItem } from '../types';

export type ContactStatus = 'linked' | 'missing_email' | 'enrichment_error';

export async function manualMoveTimelineEvent(args: {
  event: TimelineEventItem; targetOrgId: string; email: string | null;
  operator: string; nowIso: string; enrichmentError?: boolean;
}): Promise<{ moved: boolean; skipped: boolean; contactStatus: ContactStatus }> {
  const { event, targetOrgId, email } = args;
  const syntheticOrgId = event.orgId;

  const normEmail = email ? normalizeEmail(email) : null;
  const contactId = normEmail ? contactIdForEmail(normEmail) : (event.contactId ?? null);

  const keys = timelineEventKeys({
    id: event.id, orgId: targetOrgId, contactId, occurredAt: event.occurredAt,
    resolutionStatus: 'manually_linked', sourceEntityType: event.sourceEntityType, sourceEntityId: event.sourceEntityId,
  });
  const { GSI1PK: _g1p, GSI1SK: _g1s, ...rest } = event as TimelineEventItem & { GSI1PK?: string; GSI1SK?: string };
  void _g1p; void _g1s;
  const movedItem = {
    ...rest, ...keys,
    orgId: targetOrgId, resolutionStatus: 'manually_linked', resolutionReason: 'manual', confidence: 1,
    contactId, rollupApplied: false, rollupPendingOrgId: null, updatedAt: args.nowIso,
  } as TimelineEventItem;

  try {
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME(), Item: movedItem,
      ConditionExpression: 'resolutionStatus = :unres AND orgId = :syn',
      ExpressionAttributeValues: { ':unres': 'unresolved', ':syn': syntheticOrgId },
    }));
  } catch (err) {
    if ((err as { name?: string }).name === 'ConditionalCheckFailedException') {
      return { moved: false, skipped: true, contactStatus: 'missing_email' };
    }
    throw err;
  }

  let contactStatus: ContactStatus = args.enrichmentError ? 'enrichment_error' : 'missing_email';
  try {
    if (normEmail) {
      await upsertContact({ email: normEmail, orgId: targetOrgId, source: event.source, occurredAt: event.occurredAt });
      contactStatus = 'linked';
    }
    await recomputeRollupsForOrg(targetOrgId);
    await markRollupApplied(event.id);
  } catch (err) {
    console.error(JSON.stringify({ event: 'crm.link.post_move_error', id: event.id, error: err instanceof Error ? err.message : String(err) }));
  }
  return { moved: true, skipped: false, contactStatus };
}
