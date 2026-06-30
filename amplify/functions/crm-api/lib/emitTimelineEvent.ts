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
  const buildItem = (createdAt: string, rollupApplied: boolean): TimelineEventItem => ({
    ...timelineEventKeys({ id, orgId, contactId, occurredAt: args.occurredAt, resolutionStatus: resolved.resolutionStatus, sourceEntityType: args.sourceEntityType, sourceEntityId: args.sourceEntityId }),
    entityType: 'TIMELINE_EVENT',
    id, orgId, resolutionStatus: resolved.resolutionStatus, resolutionReason: resolved.resolutionReason, confidence: resolved.confidence,
    contactId: contactId ?? null, occurredAt: args.occurredAt,
    source: args.source, kind: args.kind, summary: args.summary,
    sourceEntityType: args.sourceEntityType, sourceEntityId: args.sourceEntityId,
    isInternalOnly: args.isInternalOnly ?? false, voided: args.voided ?? false,
    createdBy: args.createdBy ?? null, payload: args.payload ?? null,
    rollupApplied,
    direction: null, externalId: null, threadId: null, from: null, to: null, subject: null, bodySnippet: null,
    createdAt, updatedAt: nowIso,
  }) as TimelineEventItem;

  try {
    await docClient.send(new PutCommand({ TableName: TABLE_NAME(), Item: buildItem(nowIso, false), ConditionExpression: 'attribute_not_exists(PK)' }));
  } catch (err: unknown) {
    if ((err as { name?: string }).name !== 'ConditionalCheckFailedException') throw err;
    const existing = await getTimelineEvent(id);
    const oldOrgId = existing?.orgId;
    const linkMoved = !!oldOrgId && oldOrgId !== orgId;
    // A re-emit can change rollup-affecting fields (voided/kind/occurredAt/isInternalOnly) on the
    // same org — those must trigger a recompute or the persisted counters/dates go stale.
    const rollupFieldsChanged = !!existing && (
      existing.kind !== args.kind ||
      existing.occurredAt !== args.occurredAt ||
      existing.voided !== (args.voided ?? false) ||
      existing.isInternalOnly !== (args.isInternalOnly ?? false)
    );
    // The original bump may have landed before the rollupApplied mark crashed; recompute (not an
    // incremental re-bump) is authoritative and safe whether or not the first bump ran.
    const needsCompensation = !linkMoved && existing?.rollupApplied !== true;
    const willRecomputeSameOrg = !linkMoved && (rollupFieldsChanged || needsCompensation);
    const finalApplied = linkMoved || willRecomputeSameOrg ? true : (existing?.rollupApplied ?? true);
    await docClient.send(new PutCommand({ TableName: TABLE_NAME(), Item: buildItem(existing?.createdAt ?? nowIso, finalApplied) }));
    if (linkMoved) {
      await recomputeRollupsForOrg(oldOrgId!);
      await recomputeRollupsForOrg(orgId);
    } else if (willRecomputeSameOrg) {
      await recomputeRollupsForOrg(orgId);
    }
    return;
  }

  await bumpOrgRollupOnCreate({ orgId, kind: args.kind, occurredAt: args.occurredAt, isInternalOnly: args.isInternalOnly ?? false });
  await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME(), Key: { PK: `TLEVENT#${id}`, SK: 'A' },
    UpdateExpression: 'SET rollupApplied = :t', ExpressionAttributeValues: { ':t': true },
  }));
}
