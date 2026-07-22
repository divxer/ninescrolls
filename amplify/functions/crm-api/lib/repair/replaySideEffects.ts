import { GetCommand, UpdateCommand, QueryCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../dynamodb';
import { writeLinkAuditLog } from '../auditStore';
import { deterministicAuditId } from '../idGenerators';
import { SOURCE_PK } from '../link/sourceEmail';
import { orgActiveCheck, classifyLinkCancellation } from '../link/orgFence';
import { upsertContact } from '../contactStore';
import { recomputeRollupsForOrg } from '../orgStore';
import { markRollupApplied } from '../timelineStore';
import { reResolveVisitorSessions } from '../analytics/reResolveVisitorSessions';

export type BackfillStatus = 'written' | 'already_set' | 'superseded' | 'conflict' | 'no_source';

// Contract: NEVER throws out. transient dominates conflict/in_progress. Extra fields feed the
// happy-path orchestrators' return values; the drainer reads ok + errorType (+ churning on in_progress).
export interface ReplayResult {
  ok: boolean;
  errorType?: 'transient' | 'source_conflict' | 'in_progress' | 'target_unavailable';
  error?: string;
  reason?: string;                   // structural detail for target_unavailable (marker stays actionable)
  backfillStatus?: BackfillStatus;   // structured
  sessionsResolved?: number;         // analytics
  pending?: boolean;                 // analytics (retro hasMore)
  churning?: boolean;                // analytics: in_progress but re-failing the same sessions (no progress)
  retroSummary?: Record<string, unknown>; // analytics
}

// Task 8 (plan-review R2): callers migrate in Tasks 10/12 — the optional params keep every
// existing caller compiling (and byte-identical in behavior) at this task's checkpoint.
export interface ReplayStructuredArgs {
  sourceType: string; sourceEntityId: string; backfillPk: string | null;
  targetOrgId: string; unitKey: string; operator: string; createdAt: string;
  affectedEventIds: string[]; movedCount: number; contactStatus: string;
  generation?: string;              // NEW, optional: absent ⇒ legacy 3C semantics, byte-identical
  customerEmail?: string | null;    // NEW, optional: needed only for units that carry a contact email
}

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

// Drain-safe pk resolution (no `events`): pure for rfq/lead/order, a Get for logistics.
// Quote is unresolvable here (needs in-memory events) → caller MUST cache backfillPk at link time.
export async function resolveBackfillPk(sourceType: string, sourceEntityId: string): Promise<string | null> {
  if (SOURCE_PK[sourceType]) return SOURCE_PK[sourceType](sourceEntityId);
  if (sourceType === 'logistics') {
    const res = await docClient.send(new GetCommand({ TableName: TABLE_NAME(), Key: { PK: `LOGISTICS#${sourceEntityId}`, SK: 'META' } }));
    const rel = (res.Item as Record<string, unknown> | undefined)?.relatedOrderId as string | undefined;
    return rel ? `ORDER#${rel}` : null;
  }
  return null;
}

// Canonical-successor resolution (spec R10 final) — runs FIRST on every generational replay.
// R5: reads are STRONGLY CONSISTENT; only exact 'active' is applicable; successors are followed
// ONLY from exact 'archived' via the production `mergedInto` field. Any other/missing status is
// STRUCTURAL unavailability. Read FAILURES (network/throttle) are deliberately NOT caught here —
// they propagate and the caller classifies them 'transient' (retryable), so a wobbly read can
// never park a marker as blocked.
export type EffectiveTarget = { status: 'active'; orgId: string } | { status: 'unavailable'; reason: string };

async function readOrg(orgId: string): Promise<Record<string, unknown> | undefined> {
  const res = await docClient.send(new GetCommand({
    TableName: TABLE_NAME(), Key: { PK: `ORG#${orgId}`, SK: 'META' }, ConsistentRead: true,
  }));
  return res.Item as Record<string, unknown> | undefined;
}

export async function resolveEffectiveTarget(requestedOrgId: string): Promise<EffectiveTarget> {
  const visited = new Set<string>();
  let cur = requestedOrgId;
  for (let hop = 0; hop <= 5; hop++) {
    if (visited.has(cur)) return { status: 'unavailable', reason: `merge-chain cycle at ${cur}` };
    visited.add(cur);
    const org = await readOrg(cur);
    if (!org) return { status: 'unavailable', reason: `org ${cur} not found` };
    if (org.status === 'active') return { status: 'active', orgId: cur };
    if (org.status !== 'archived') return { status: 'unavailable', reason: `org ${cur} has non-navigable status '${String(org.status)}'` };
    if (!org.mergedInto) return { status: 'unavailable', reason: `org ${cur} archived without successor` };
    cur = org.mergedInto as string;
  }
  return { status: 'unavailable', reason: 'merge-chain depth limit (5) exceeded' };
}

// Thrown when a write-time org fence cancels: the effective org was archived between resolve and
// write. The orchestrating loop re-resolves ONCE and retries the remaining effects at the successor.
class FenceLostError extends Error {
  constructor(orgId: string) { super(`org ${orgId} fence lost at write time`); this.name = 'FenceLostError'; }
}

// BOTH branches executable: the legacy branch is the verbatim pre-existing 3C code (invariant #1);
// the generational branch stamps org+generation atomically (R9) behind the org-active fence (R5).
async function backfillByPk(pk: string, targetOrgId: string, generation?: string): Promise<BackfillStatus> {
  const generational = generation !== undefined;
  try {
    if (generational) {
      await docClient.send(new TransactWriteCommand({ TransactItems: [
        orgActiveCheck(targetOrgId),
        { Update: {
          TableName: TABLE_NAME(), Key: { PK: pk, SK: 'META' },
          UpdateExpression: 'SET matchedOrgId = :o, matchedOrgLinkGeneration = :gen',   // R9: org+generation atomically, one write
          ConditionExpression: '(attribute_not_exists(matchedOrgId) OR attribute_type(matchedOrgId, :nullType) OR matchedOrgId = :empty OR begins_with(matchedOrgId, :unres)) OR (attribute_exists(matchedOrgLinkGeneration) AND matchedOrgLinkGeneration < :gen)',
          ExpressionAttributeValues: { ':o': targetOrgId, ':empty': '', ':unres': 'unresolved-', ':nullType': 'NULL', ':gen': generation },
        } },
      ] }));
    } else {
      await docClient.send(new UpdateCommand({
        TableName: TABLE_NAME(), Key: { PK: pk, SK: 'META' },
        UpdateExpression: 'SET matchedOrgId = :o',
        ConditionExpression: 'attribute_not_exists(matchedOrgId) OR attribute_type(matchedOrgId, :nullType) OR matchedOrgId = :empty OR begins_with(matchedOrgId, :unres)',
        ExpressionAttributeValues: { ':o': targetOrgId, ':empty': '', ':unres': 'unresolved-', ':nullType': 'NULL' },
      }));
    }
    return 'written';
  } catch (err) {
    if (generational) {
      const cls = classifyLinkCancellation(err, 1);
      if (cls === 'org_fence') throw new FenceLostError(targetOrgId);
      if (cls === 'other') throw err;                        // malformed/absent reasons: propagate (transient), never guessed
      // cls === 'move_condition' falls through to the outcome mapping below
    } else if ((err as { name?: string }).name !== 'ConditionalCheckFailedException') {
      throw err;
    }
    const cur = (await docClient.send(new GetCommand({ TableName: TABLE_NAME(), Key: { PK: pk, SK: 'META' } }))).Item as Record<string, unknown> | undefined;
    const curGen = cur?.matchedOrgLinkGeneration as string | undefined;
    if (generational && curGen && curGen >= generation!) return 'superseded';       // R8: a later generation already ruled
    return (cur?.matchedOrgId as string | undefined) === targetOrgId ? 'already_set' : 'conflict';
  }
}

// audit CCFE = row already exists = idempotent success (NOT transient).
async function writeAuditIdempotent(args: Parameters<typeof writeLinkAuditLog>[0]): Promise<string | undefined> {
  try { await writeLinkAuditLog(args); return undefined; }
  catch (err) { return (err as { name?: string }).name === 'ConditionalCheckFailedException' ? undefined : msg(err); }
}

export async function replayStructuredSideEffects(args: ReplayStructuredArgs): Promise<ReplayResult> {
  // Generational replay (Task 8): resolve-first + fenced writes. The legacy path below stays
  // byte-identical when `generation` is absent (invariant #1).
  if (args.generation !== undefined) return replayStructuredGenerational(args, args.generation);

  let transientError: string | undefined;

  // 1. resolve pk (cached else drain-safe resolve)
  let pk = args.backfillPk;
  if (!pk) {
    try { pk = await resolveBackfillPk(args.sourceType, args.sourceEntityId); }
    catch (err) { return { ok: false, errorType: 'transient', error: msg(err) }; }
  }

  // 2. backfill
  let backfillStatus: BackfillStatus = 'no_source';
  if (pk) {
    try { backfillStatus = await backfillByPk(pk, args.targetOrgId); }
    catch (err) { transientError = msg(err); }
  }

  // 3. audit (deterministic id, always attempted so a conflict does not lose the audit)
  const auditErr = await writeAuditIdempotent({
    id: deterministicAuditId('manual_link_unit', args.unitKey, args.targetOrgId),
    operator: args.operator, reason: 'manual_link_unit', timestamp: args.createdAt, newOrgId: args.targetOrgId,
    details: { unitType: 'structured', unitKey: args.unitKey, targetOrgId: args.targetOrgId,
               affectedCount: args.movedCount, affectedEventIds: args.affectedEventIds,
               sourceBackfillStatus: backfillStatus, contactStatus: args.contactStatus },
  });
  transientError = transientError ?? auditErr;

  // 4. decide (transient dominates conflict)
  if (transientError) return { ok: false, errorType: 'transient', error: transientError, backfillStatus };
  if (backfillStatus === 'conflict') return { ok: false, errorType: 'source_conflict', backfillStatus };
  return { ok: true, backfillStatus };
}

// Timeline-event convergence on redirect (R5 blocker 2 — production merge does NOT move
// TimelineEvents): when the effective org differs from the requested one, the unit's events may
// already sit under the archived requested org (the foreground link moved them there). Page the
// requested org's timeline partition filtered `linkGeneration = :gen` (Task 10 stamps the
// attribute on every moved event; pre-Task-10 units simply match zero events) and issue a fenced
// conditional move per event; then dirty/repair BOTH orgs' rollups. All moves are conditional ⇒
// idempotent on retry.
async function redirectMovePass(requestedOrgId: string, effectiveOrgId: string, generation: string): Promise<void> {
  const nowIso = new Date().toISOString();
  const movedIds: string[] = [];
  let startKey: Record<string, unknown> | undefined;
  do {
    const q = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME(), IndexName: 'GSI2',
      KeyConditionExpression: 'GSI2PK = :pk AND begins_with(GSI2SK, :tl)',
      FilterExpression: 'linkGeneration = :gen',
      ExpressionAttributeValues: { ':pk': `ORG#${requestedOrgId}`, ':tl': 'TLEVENT#', ':gen': generation },
      ExclusiveStartKey: startKey,
    }));
    for (const ev of (q.Items ?? []) as Array<Record<string, unknown>>) {
      // The durable dirty mark (rollupApplied:false + rollupPendingOrgId) rides the fenced move
      // itself; the archived side's repair is legitimately unfenced (its org is archived).
      const movedItem = {
        ...ev, orgId: effectiveOrgId, GSI2PK: `ORG#${effectiveOrgId}`,
        rollupApplied: false, rollupPendingOrgId: requestedOrgId, updatedAt: nowIso,
      };
      try {
        await docClient.send(new TransactWriteCommand({ TransactItems: [
          orgActiveCheck(effectiveOrgId),
          { Put: {
            TableName: TABLE_NAME(), Item: movedItem,
            ConditionExpression: 'orgId = :requested AND linkGeneration = :gen',   // only THIS unit's events
            ExpressionAttributeValues: { ':requested': requestedOrgId, ':gen': generation },
          } },
        ] }));
        movedIds.push(String(ev.id));
      } catch (err) {
        const cls = classifyLinkCancellation(err, 1);
        if (cls === 'org_fence') throw new FenceLostError(effectiveOrgId);
        if (cls === 'move_condition') continue;              // already moved/superseded — idempotent skip
        throw err;                                            // malformed reasons / non-transact error → transient
      }
    }
    startKey = q.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (startKey);

  if (movedIds.length === 0) return;
  await recomputeRollupsForOrg(requestedOrgId);              // archived side — unfenced by design
  await recomputeRollupsForOrg(effectiveOrgId);
  for (const id of movedIds) await markRollupApplied(id);
}

async function replayStructuredGenerational(args: ReplayStructuredArgs, generation: string): Promise<ReplayResult> {
  // 1. resolve pk (cached else drain-safe resolve) — same rule as the legacy path
  let pk = args.backfillPk;
  if (!pk) {
    try { pk = await resolveBackfillPk(args.sourceType, args.sourceEntityId); }
    catch (err) { return { ok: false, errorType: 'transient', error: msg(err) }; }
  }

  // 2. canonical-successor resolution FIRST — before ANY write. `unavailable` blocks the replay
  //    (marker survives as actionable — a potentially-unfinished repair is never a false success);
  //    a READ THROW is transient (retryable), never structural.
  let resolved: EffectiveTarget;
  try { resolved = await resolveEffectiveTarget(args.targetOrgId); }
  catch (err) { return { ok: false, errorType: 'transient', error: msg(err) }; }
  if (resolved.status === 'unavailable') return { ok: false, errorType: 'target_unavailable', reason: resolved.reason };
  let eff = resolved.orgId;

  // 3. effects, in order, every org-referencing write fenced on the CURRENT effective org.
  //    Fence cancellation ⇒ re-resolve ONCE and retry the remaining effects at the successor;
  //    a SECOND fence loss ⇒ transient (merge storm — retry next drain).
  // (object wrapper: assignments happen inside effect closures — keeps TS narrowing honest)
  const state = { backfillStatus: 'no_source' as BackfillStatus };
  let fenceRetried = false;

  const effects: Array<() => Promise<void>> = [
    async () => { if (pk) state.backfillStatus = await backfillByPk(pk, eff, generation); },
    async () => {
      if (!args.customerEmail) return;
      const res = await upsertContact({
        email: args.customerEmail, orgId: eff, source: args.sourceType, occurredAt: args.createdAt,
        linkGeneration: generation, activeOrgFence: true,
      });
      if (res.outcome === 'org_inactive') throw new FenceLostError(eff);
      // written | superseded | locked are ALL success for the contact effect (R8)
    },
    async () => {
      await writeLinkAuditLog({
        // INVARIANT #1: id derived only from COMMITTED values — the unit key, the org the effects
        // actually landed on (eff), and this action's generation.
        id: deterministicAuditId('manual_link_unit', args.unitKey, eff, generation),
        operator: args.operator, reason: 'manual_link_unit', timestamp: args.createdAt, newOrgId: eff,
        activeOrgFence: true,
        details: {
          unitType: 'structured', unitKey: args.unitKey, targetOrgId: eff, generation,
          ...(eff !== args.targetOrgId ? { requestedTargetOrgId: args.targetOrgId, effectiveTargetOrgId: eff } : {}),
          affectedCount: args.movedCount, affectedEventIds: args.affectedEventIds,
          sourceBackfillStatus: state.backfillStatus, contactStatus: args.contactStatus,
        },
      });
    },
    async () => { if (eff !== args.targetOrgId) await redirectMovePass(args.targetOrgId, eff, generation); },
  ];

  for (let i = 0; i < effects.length; ) {
    try { await effects[i](); i += 1; }
    catch (err) {
      const name = (err as { name?: string }).name;
      if (name === 'FenceLostError' || name === 'OrgInactiveError') {
        if (fenceRetried) return { ok: false, errorType: 'transient', error: 'org fence lost twice (merge in progress) — retry next drain', backfillStatus: state.backfillStatus };
        fenceRetried = true;
        let re: EffectiveTarget;
        try { re = await resolveEffectiveTarget(args.targetOrgId); }
        catch (e2) { return { ok: false, errorType: 'transient', error: msg(e2), backfillStatus: state.backfillStatus }; }
        if (re.status === 'unavailable') return { ok: false, errorType: 'target_unavailable', reason: re.reason, backfillStatus: state.backfillStatus };
        eff = re.orgId;
        continue;                                            // retry THIS effect and all remaining at the successor
      }
      return { ok: false, errorType: 'transient', error: msg(err), backfillStatus: state.backfillStatus };
    }
  }

  // 4. decide: superseded counts as ok (like already_set); conflict unchanged.
  if (state.backfillStatus === 'conflict') return { ok: false, errorType: 'source_conflict', backfillStatus: state.backfillStatus };
  return { ok: true, backfillStatus: state.backfillStatus };
}

export async function replayAnalyticsSideEffects(args: {
  visitorId: string; targetOrgId: string; operator: string; createdAt: string;
}): Promise<ReplayResult> {
  let transientError: string | undefined;
  let summary: Record<string, unknown> = {};
  let hasMore = false;

  try {
    const retro = await reResolveVisitorSessions({ visitorId: args.visitorId });
    summary = (retro?.summary ?? {}) as Record<string, unknown>;
    hasMore = summary.hasMore === true;
  } catch (err) { transientError = msg(err); }

  const auditErr = await writeAuditIdempotent({
    id: deterministicAuditId('manual_link_visitor', args.visitorId, args.targetOrgId),
    operator: args.operator, reason: 'manual_link_visitor', timestamp: args.createdAt, newOrgId: args.targetOrgId,
    details: { unitType: 'analytics', unitKey: args.visitorId, targetOrgId: args.targetOrgId, retroSummary: summary },
  });
  transientError = transientError ?? auditErr;

  // Preserve linkVisitor's existing return expression exactly (no behavior change vs 3B).
  const sessionsResolved = Number(summary.resolved ?? summary.emitted ?? 0);
  // errorType stays 'in_progress' for BOTH legit multi-page and churning retros, so linkVisitor's
  // "in_progress = keep, not post_commit_failed" contract is unchanged. `churning` is a drainer-only
  // flag distinguishing forward progress (touch) from re-failing the same sessions (age into stuck).
  const churning = summary.churning === true;
  if (transientError) return { ok: false, errorType: 'transient', error: transientError, sessionsResolved, pending: hasMore, retroSummary: summary };
  if (hasMore) return {
    ok: false, errorType: 'in_progress', churning,
    error: churning ? `retro churning: ${summary.errors ?? '?'} session(s) failing` : undefined,
    sessionsResolved, pending: true, retroSummary: summary,
  };
  return { ok: true, sessionsResolved, pending: false, retroSummary: summary };
}
