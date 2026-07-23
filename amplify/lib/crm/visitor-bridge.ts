import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';

// The VISITOR# identity bridge (spec §2.1). PROVENANCE RULE (structural): matchedOrgId may ONLY be
// populated from RFQ/Lead identity matching — orgSource records which. No code path may ever write
// an IP-derived org here; that is what keeps "IP-org never resolves a session" enforceable.
export interface VisitorBridge {
  PK: string; SK: 'STATE';
  matchedOrgId: string | null;
  orgSource: 'rfq_match' | 'lead_match' | 'order_match' | 'manual' | null;
  email: string | null;
  // Record the source of the last MATERIAL change — the no-op short-circuit intentionally skips last-touch updates.
  sourceEntityType: 'rfq' | 'lead' | 'order';
  sourceEntityId: string;
  firstSeenAt: string; updatedAt: string;
}

export type Send = (cmd: unknown) => Promise<{ Item?: Record<string, unknown> }>;

// Adapter: wrap a DocumentClient-like object as the DI'd Send. Confines the unavoidable
// command-type cast to one place, next to the type it satisfies.
export const toSend = (dc: { send: (...a: never[]) => unknown }): Send =>
  ((c) => dc.send(c as never)) as Send;

export async function readVisitorBridge(send: Send, tableName: string, visitorId: string): Promise<VisitorBridge | null> {
  if (!visitorId) return null;
  const res = await send(new GetCommand({ TableName: tableName, Key: { PK: `VISITOR#${visitorId}`, SK: 'STATE' } }));
  return (res.Item as VisitorBridge | undefined) ?? null;
}

export interface UpsertBridgeInput {
  visitorId: string; matchedOrgId: string | null; email: string | null;
  sourceEntityType: 'rfq' | 'lead' | 'order'; sourceEntityId: string; now: string;
}

// Never-downgrade + latest-real-wins: a real matchedOrgId is never replaced by null, but a
// DIFFERENT real org does replace it (latest identity evidence wins); email fills when null.
// Returns { created, orgUpgraded, orgChanged }:
//   orgUpgraded — unresolved→resolved transition (new bridge with a real org, or null→real)
//   orgChanged  — resolved→different-resolved transition (real A → real B)
// Both are resolution changes; callers should retro-resolve sessions on either.
export async function upsertVisitorBridge(send: Send, tableName: string, input: UpsertBridgeInput, attempt = 0): Promise<{ created: boolean; orgUpgraded: boolean; orgChanged: boolean }> {
  if (!input.visitorId) return { created: false, orgUpgraded: false, orgChanged: false };
  const incomingOrg = input.matchedOrgId || null;   // '' → null (unmatched-order convention)
  const incomingEmail = input.email || null;        // '' → null (same normalization as org)
  const orgSource = input.sourceEntityType === 'rfq'
    ? 'rfq_match' as const
    : input.sourceEntityType === 'lead'
      ? 'lead_match' as const
      : 'order_match' as const;
  const existing = await readVisitorBridge(send, tableName, input.visitorId);

  if (!existing) {
    try {
      await send(new PutCommand({
        TableName: tableName,
        Item: {
          PK: `VISITOR#${input.visitorId}`, SK: 'STATE',
          matchedOrgId: incomingOrg, orgSource: incomingOrg ? orgSource : null,
          email: incomingEmail,
          sourceEntityType: input.sourceEntityType, sourceEntityId: input.sourceEntityId,
          firstSeenAt: input.now, updatedAt: input.now,
        },
        ConditionExpression: 'attribute_not_exists(PK)',
      }));
    } catch (err) {
      // Create race: the one-time backfill can race live submissions on first-time visitors —
      // the losing creator re-reads the winner's row and flows into the merge path below.
      if ((err as { name?: string }).name === 'ConditionalCheckFailedException' && attempt < 2) {
        return upsertVisitorBridge(send, tableName, input, attempt + 1);
      }
      throw err;
    }
    return { created: true, orgUpgraded: !!incomingOrg, orgChanged: false };
  }

  const manualLocked = existing.orgSource === 'manual';                 // manual links are never overwritten by rfq/lead upserts
  const nextOrg = manualLocked ? existing.matchedOrgId : (incomingOrg ?? existing.matchedOrgId); // never downgrade real→null
  const nextOrgSource = manualLocked ? 'manual' : (incomingOrg ? orgSource : existing.orgSource); // provenance follows the org
  const nextEmail = (existing.email || null) ?? incomingEmail;          // fill-when-null only ('' counts as fillable)
  const orgUpgraded = !existing.matchedOrgId && !!incomingOrg;          // unresolved→resolved transition
  const orgChanged = !!existing.matchedOrgId && !!nextOrg && nextOrg !== existing.matchedOrgId; // real→different-real
  const changed = nextOrg !== existing.matchedOrgId || nextEmail !== existing.email || nextOrgSource !== existing.orgSource;
  if (!changed) return { created: false, orgUpgraded: false, orgChanged: false };

  try {
    await send(new PutCommand({
      TableName: tableName,
      Item: {
        ...existing,
        matchedOrgId: nextOrg, orgSource: nextOrgSource, email: nextEmail,
        sourceEntityType: input.sourceEntityType, sourceEntityId: input.sourceEntityId,
        updatedAt: input.now,
      },
      // Stale-read protection: if a racing writer changed the bridge after our read, re-read and merge.
      // Legacy bridge rows may lack updatedAt; those are allowed only while updatedAt is still absent.
      // updatedAt is an ISO timestamp — millisecond-granularity collisions are accepted at this concurrency.
      ConditionExpression: 'attribute_not_exists(updatedAt) OR updatedAt = :expectedUpdatedAt',
      ExpressionAttributeValues: { ':expectedUpdatedAt': existing.updatedAt ?? '__missing__' },
    }));
  } catch (err) {
    if ((err as { name?: string }).name === 'ConditionalCheckFailedException' && attempt < 2) {
      return upsertVisitorBridge(send, tableName, input, attempt + 1);
    }
    throw err;
  }
  return { created: false, orgUpgraded, orgChanged };
}

export interface UpsertManualBridgeInput {
  visitorId: string; matchedOrgId: string; now: string;
}

// Admin-initiated manual link (spec §2.1 round 2). CONDITIONAL: only writes orgSource='manual' when the
// bridge has no real org yet, so two admins racing the same visitor cannot last-writer-win. A bridge row
// can store matchedOrgId as a DynamoDB NULL (null is written as a NULL attribute, not omitted), so the
// condition must also allow attribute_type(matchedOrgId, 'NULL') — otherwise a null-org bridge is
// mis-classified as already-resolved and the manual write is rejected.
export async function upsertManualVisitorBridge(send: Send, tableName: string, input: UpsertManualBridgeInput): Promise<{ written: boolean; existingOrgId: string | null }> {
  const existing = await readVisitorBridge(send, tableName, input.visitorId);
  const item = {
    PK: `VISITOR#${input.visitorId}`, SK: 'STATE' as const,
    matchedOrgId: input.matchedOrgId, orgSource: 'manual' as const,
    email: existing?.email ?? null,
    sourceEntityType: existing?.sourceEntityType ?? 'rfq', sourceEntityId: existing?.sourceEntityId ?? 'manual',
    firstSeenAt: existing?.firstSeenAt ?? input.now, updatedAt: input.now,
  };
  try {
    await send(new PutCommand({
      TableName: tableName, Item: item,
      ConditionExpression: 'attribute_not_exists(PK) OR attribute_not_exists(matchedOrgId) OR attribute_type(matchedOrgId, :nullType) OR matchedOrgId = :empty',
      ExpressionAttributeValues: { ':empty': '', ':nullType': 'NULL' },
    }));
    return { written: true, existingOrgId: input.matchedOrgId };
  } catch (err) {
    if ((err as { name?: string }).name === 'ConditionalCheckFailedException') {
      const now = await readVisitorBridge(send, tableName, input.visitorId);
      return { written: false, existingOrgId: now?.matchedOrgId ?? null };
    }
    throw err;
  }
}
