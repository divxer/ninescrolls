import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../dynamodb';
import { writeLinkAuditLog } from '../auditStore';
import { deterministicAuditId } from '../idGenerators';

export type BackfillStatus = 'written' | 'already_set' | 'conflict' | 'no_source';

// Contract: NEVER throws out. transient dominates conflict/in_progress. Extra fields feed the
// happy-path orchestrators' return values; the drainer only reads ok + errorType.
export interface ReplayResult {
  ok: boolean;
  errorType?: 'transient' | 'source_conflict' | 'in_progress';
  error?: string;
  backfillStatus?: BackfillStatus;   // structured
  sessionsResolved?: number;         // analytics
  pending?: boolean;                 // analytics (retro hasMore)
  retroSummary?: Record<string, unknown>; // analytics
}

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const SOURCE_PK: Record<string, (id: string) => string> = { rfq: (id) => `RFQ#${id}`, lead: (id) => `LEAD#${id}`, order: (id) => `ORDER#${id}` };

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

async function backfillByPk(pk: string, targetOrgId: string): Promise<BackfillStatus> {
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

// audit CCFE = row already exists = idempotent success (NOT transient).
async function writeAuditIdempotent(args: Parameters<typeof writeLinkAuditLog>[0]): Promise<string | undefined> {
  try { await writeLinkAuditLog(args); return undefined; }
  catch (err) { return (err as { name?: string }).name === 'ConditionalCheckFailedException' ? undefined : msg(err); }
}

export async function replayStructuredSideEffects(args: {
  sourceType: string; sourceEntityId: string; backfillPk: string | null;
  targetOrgId: string; unitKey: string; operator: string; createdAt: string;
  affectedEventIds: string[]; movedCount: number; contactStatus: string;
}): Promise<ReplayResult> {
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
