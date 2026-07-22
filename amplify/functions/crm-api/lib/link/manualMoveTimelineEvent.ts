import { TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../dynamodb';
import { timelineEventKeys, contactIdForEmail } from '../keys';
import { normalizeEmail } from '../normalize';
import { recomputeRollupsForOrg } from '../orgStore';
import { markRollupApplied } from '../timelineStore';
import { upsertContact } from '../contactStore';
import { orgActiveCheck, classifyLinkCancellation } from './orgFence';
import type { TimelineEventItem } from '../types';

export type ContactStatus = 'linked' | 'missing_email' | 'enrichment_error';

// R7 eligibility condition — shared VERBATIM by the transact first-move (linkStructuredUnit) and
// the per-event path below, so the two conditions cannot drift. Values expected:
// :unres='unresolved', :syn=<the event's synthetic org>, :false=false, :src=<the unit's source>;
// names: {'#source':'source'} (SOURCE is a DynamoDB reserved word).
export const MOVE_ELIGIBILITY_CONDITION =
  'resolutionStatus = :unres AND orgId = :syn AND voided = :false AND isInternalOnly = :false AND #source = :src';

// Shared moved-item construction (Task 10): the transact first-move and the per-event path build
// the SAME item so the two paths cannot drift. Stamps `linkGeneration` — the queryable
// unit-membership attribute Task 8's redirect-move pass filters by when a later merge strands the
// unit's events under an archived org.
export function buildMovedItem(
  event: TimelineEventItem, targetOrgId: string, email: string | null, nowIso: string, linkGeneration: string,
): TimelineEventItem & { linkGeneration: string } {
  const normEmail = email ? normalizeEmail(email) : null;
  const contactId = normEmail ? contactIdForEmail(normEmail) : (event.contactId ?? null);
  const keys = timelineEventKeys({
    id: event.id, orgId: targetOrgId, contactId, occurredAt: event.occurredAt,
    resolutionStatus: 'manually_linked', sourceEntityType: event.sourceEntityType, sourceEntityId: event.sourceEntityId,
  });
  const { GSI1PK: _g1p, GSI1SK: _g1s, ...rest } = event as TimelineEventItem & { GSI1PK?: string; GSI1SK?: string };
  void _g1p; void _g1s;
  return {
    ...rest, ...keys,
    orgId: targetOrgId, resolutionStatus: 'manually_linked', resolutionReason: 'manual', confidence: 1,
    contactId, rollupApplied: false, rollupPendingOrgId: null, linkGeneration, updatedAt: nowIso,
  } as TimelineEventItem & { linkGeneration: string };
}

// v2 (Task 10): a fenced 2-item transaction [org-active check, conditional move] with POSITIONAL
// cancellation classification — index 0 (org fence) throws the explicit merged-org error, the
// move's own condition (index 1) is the loser/skip path, anything else propagates (transient).
export async function manualMoveTimelineEvent(args: {
  event: TimelineEventItem; targetOrgId: string; email: string | null;
  operator: string; nowIso: string; enrichmentError?: boolean;
  representativeSource?: string; linkGeneration: string;
}): Promise<{ moved: boolean; skipped: boolean; contactStatus: ContactStatus }> {
  const { event, targetOrgId, email } = args;
  const syntheticOrgId = event.orgId;
  const src = args.representativeSource ?? event.source;

  const normEmail = email ? normalizeEmail(email) : null;
  const movedItem = buildMovedItem(event, targetOrgId, email, args.nowIso, args.linkGeneration);

  try {
    await docClient.send(new TransactWriteCommand({ TransactItems: [
      orgActiveCheck(targetOrgId),
      { Put: {
        TableName: TABLE_NAME(), Item: movedItem,
        ConditionExpression: MOVE_ELIGIBILITY_CONDITION,
        ExpressionAttributeNames: { '#source': 'source' },
        ExpressionAttributeValues: { ':unres': 'unresolved', ':syn': syntheticOrgId, ':false': false, ':src': src },
      } },
    ] }));
  } catch (err) {
    const cls = classifyLinkCancellation(err, 1);
    if (cls === 'org_fence') throw new Error(`target org ${targetOrgId} is not active (being merged?) — retry against its successor`);
    if (cls === 'move_condition') return { moved: false, skipped: true, contactStatus: 'missing_email' };
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
