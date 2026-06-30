import { PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from './dynamodb';
import { timelineId, type TimelineIdInput } from './timelineId';
import { timelineEventKeys } from './keys';
import { normalizeEmail } from './normalize';
import { resolveLinks, type ResolveInput } from './resolveLinks';
import { upsertContact } from './contactStore';
import { bumpOrgRollupOnCreate, recomputeRollupsForOrg } from './orgStore';
import { getTimelineEvent } from './timelineStore';
import type { TimelineEventItem, TimelineSource } from './types';

export type EmitArgs = {
  source: TimelineSource;
  kind: string;
  sourceEntityType: string;
  sourceEntityId: string;
  occurredAt: string;
  summary: string;
  idInput: TimelineIdInput;
  resolveInput: ResolveInput;
  isInternalOnly?: boolean;
  voided?: boolean;
  createdBy?: string | null;
  payload?: Record<string, unknown> | null;
};

// P1 never creates orgs, so the only sentinel is the per-event unresolved placeholder.
const isSentinelOrg = (orgId: string) => orgId.startsWith('unresolved-');

export async function emitTimelineEvent(args: EmitArgs): Promise<void> {
  const id = timelineId(args.idInput);
  const resolved = await resolveLinks(args.resolveInput);

  const orgId = resolved.orgId;

  let contactId = resolved.contactId;
  const email = args.resolveInput.email ? normalizeEmail(args.resolveInput.email) : null;
  if (email && !isSentinelOrg(orgId)) {
    contactId = await upsertContact({ email, orgId, source: args.source, occurredAt: args.occurredAt });
  }

  const nowIso = new Date().toISOString();
  const buildItem = (createdAt: string, rollupApplied: boolean, rollupPendingOrgId: string | null): TimelineEventItem => ({
    ...timelineEventKeys({ id, orgId, contactId, occurredAt: args.occurredAt, resolutionStatus: resolved.resolutionStatus, sourceEntityType: args.sourceEntityType, sourceEntityId: args.sourceEntityId }),
    entityType: 'TIMELINE_EVENT',
    id, orgId, resolutionStatus: resolved.resolutionStatus, resolutionReason: resolved.resolutionReason, confidence: resolved.confidence,
    contactId: contactId ?? null, occurredAt: args.occurredAt,
    source: args.source, kind: args.kind, summary: args.summary,
    sourceEntityType: args.sourceEntityType, sourceEntityId: args.sourceEntityId,
    isInternalOnly: args.isInternalOnly ?? false, voided: args.voided ?? false,
    createdBy: args.createdBy ?? null, payload: args.payload ?? null,
    rollupApplied, rollupPendingOrgId,
    direction: null, externalId: null, threadId: null, from: null, to: null, subject: null, bodySnippet: null,
    createdAt, updatedAt: nowIso,
  }) as TimelineEventItem;

  // Mark the event's rollup as fully applied — ONLY after every needed recompute/bump succeeded.
  const markRollupClean = () => docClient.send(new UpdateCommand({
    TableName: TABLE_NAME(), Key: { PK: `TLEVENT#${id}`, SK: 'A' },
    UpdateExpression: 'SET rollupApplied = :t REMOVE rollupPendingOrgId',
    ExpressionAttributeValues: { ':t': true },
  }));

  try {
    // First write: rollupApplied=false is the durable "rollup not yet applied" marker.
    await docClient.send(new PutCommand({ TableName: TABLE_NAME(), Item: buildItem(nowIso, false, null), ConditionExpression: 'attribute_not_exists(PK)' }));
  } catch (err: unknown) {
    if ((err as { name?: string }).name !== 'ConditionalCheckFailedException') throw err;
    // Duplicate re-emit. Decide whether rollups need repair.
    const existing = await getTimelineEvent(id);
    const oldOrgId = existing?.orgId;
    const linkMoved = !!oldOrgId && oldOrgId !== orgId;
    const rollupFieldsChanged = !!existing && (
      existing.kind !== args.kind ||
      existing.occurredAt !== args.occurredAt ||
      existing.voided !== (args.voided ?? false) ||
      existing.isInternalOnly !== (args.isInternalOnly ?? false)
    );
    const pendingFromBefore = (existing?.rollupPendingOrgId ?? null) as string | null;
    const needsRepair = linkMoved || rollupFieldsChanged || existing?.rollupApplied !== true || !!pendingFromBefore;

    if (!needsRepair) {
      // Pure metadata refresh (e.g. summary/payload) with no rollup impact — overwrite, stay clean.
      await docClient.send(new PutCommand({ TableName: TABLE_NAME(), Item: buildItem(existing?.createdAt ?? nowIso, true, null) }));
      return;
    }

    // Durable repair ordering: write rollupApplied=false FIRST, recording any org that still needs
    // recompute — the old org on a link move, OR a pending org left by a previously-crashed attempt.
    // Recompute, THEN mark clean. A crash before markRollupClean leaves a durable false + pending org.
    const pendingOrgId = linkMoved ? oldOrgId! : pendingFromBefore;
    await docClient.send(new PutCommand({ TableName: TABLE_NAME(), Item: buildItem(existing?.createdAt ?? nowIso, false, pendingOrgId) }));
    if (pendingOrgId) await recomputeRollupsForOrg(pendingOrgId);
    await recomputeRollupsForOrg(orgId);
    await markRollupClean();
    return;
  }

  // New event: apply the rollup, THEN mark clean. A crash in between leaves rollupApplied=false.
  await bumpOrgRollupOnCreate({ orgId, kind: args.kind, occurredAt: args.occurredAt, isInternalOnly: args.isInternalOnly ?? false });
  await markRollupClean();
}
