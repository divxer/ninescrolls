// amplify/lib/rfq/effectTransitions.ts
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import type { TransactWriteCommandInput } from '@aws-sdk/lib-dynamodb';
import { outboxEffectKey, type OutboxEffectName } from './outboxEffects';
import {
  EFFECT_SUCCESSORS, buildOutboxEffectItem, isEmailEffect,
  type AttachmentMoveResult, type CrmEmitResult,
  type OrgUpsertResult, type VisitorBridgeResult,
} from './outboxEffects';
import { MAX_RFQ_ATTACHMENTS } from './contract';

type TransactItem = NonNullable<TransactWriteCommandInput['TransactItems']>[number];

const MAX_ORG_ID_LEN = 256;
const MAX_MOVED_KEY_LEN = 256;

// These builders are the trust boundary between the P4b-2 worker (which passes results
// derived from helpers / DynamoDB streams as effectively `unknown`) and what gets durably
// persisted + backfilled onto the RFQ. TypeScript types alone don't survive a cast, so we
// validate at runtime and fail closed rather than persist a malformed/oversized result.
function assertNonEmptyString(v: unknown, label: string): void {
  if (typeof v !== 'string' || v.length === 0) throw new Error(`${label} must be a non-empty string`);
}
function assertIsoTime(v: unknown, label: string): void {
  if (typeof v !== 'string' || !Number.isFinite(Date.parse(v))) throw new Error(`${label} must be an ISO timestamp`);
}
function assertNonNegSafeInt(v: unknown, label: string): void {
  if (!Number.isSafeInteger(v) || (v as number) < 0) throw new Error(`${label} must be a non-negative safe integer`);
}

/** Fail closed if a completion result is malformed, mismatched to its effect, or oversized. */
function assertValidCompletionResult(p: CompletionParams): void {
  const r = p.result as unknown;
  if (r === null || typeof r !== 'object') throw new Error(`${p.effect} result must be an object`);
  const rec = r as Record<string, unknown>;
  switch (p.effect) {
    case 'org-upsert':
      if (!(rec.matchedOrgId === null
        || (typeof rec.matchedOrgId === 'string' && rec.matchedOrgId.length > 0 && rec.matchedOrgId.length <= MAX_ORG_ID_LEN))) {
        throw new Error('org-upsert result.matchedOrgId must be null or a bounded non-empty string');
      }
      break;
    case 'visitor-bridge':
      if (typeof rec.created !== 'boolean' || typeof rec.orgUpgraded !== 'boolean') {
        throw new Error('visitor-bridge result requires boolean created/orgUpgraded');
      }
      break;
    case 'crm-emit':
      if (rec.accepted !== true) throw new Error('crm-emit result.accepted must be true');
      break;
    case 'attachment-move': {
      const moved = rec.movedKeys, failed = rec.failedKeys;
      if (!Array.isArray(moved) || !Array.isArray(failed)) {
        throw new Error('attachment-move result requires movedKeys/failedKeys arrays');
      }
      // moved+failed partition the ≤MAX validated temp keys, so total is bounded.
      if (moved.length + failed.length > MAX_RFQ_ATTACHMENTS) {
        throw new Error(`attachment-move movedKeys+failedKeys exceeds MAX_RFQ_ATTACHMENTS (${MAX_RFQ_ATTACHMENTS})`);
      }
      const destPrefix = `rfqs/${p.rfqId}/`;
      for (const k of moved) {
        if (typeof k !== 'string' || !k.startsWith(destPrefix) || k.length > MAX_MOVED_KEY_LEN || k.includes('..')) {
          throw new Error(`attachment-move movedKeys must be bounded rfqs/${p.rfqId}/ keys`);
        }
      }
      for (const k of failed) if (typeof k !== 'string' || k.length > MAX_MOVED_KEY_LEN) {
        throw new Error('attachment-move failedKeys must be bounded strings');
      }
      break;
    }
  }
}

export interface ClaimParams {
  tableName: string; rfqId: string; effect: OutboxEffectName; owner: string; leaseMs: number;
  now: string; from: 'pending' | 'expired-lease'; expectedVersion: number;
}

/**
 * Acquire (or re-acquire an expired) lease on an effect: pending|stale-processing →
 * processing. Bumps version so a stale worker's completion (holding the old version)
 * later cancels. Timestamps are epoch ms (numbers) so `leaseExpiresAt < :nowMs` is a
 * real numeric comparison.
 */
export function buildEffectClaimItems(p: ClaimParams): UpdateCommand {
  assertNonEmptyString(p.owner, 'owner');
  assertIsoTime(p.now, 'now');
  assertNonNegSafeInt(p.expectedVersion, 'expectedVersion');
  if (!Number.isFinite(p.leaseMs) || p.leaseMs <= 0) throw new Error('leaseMs must be a positive number');
  const nowMs = Date.parse(p.now);
  const values: Record<string, unknown> = {
    ':processing': 'processing', ':owner': p.owner, ':exp': nowMs + p.leaseMs,
    ':ev': p.expectedVersion, ':nv': p.expectedVersion + 1, ':now': p.now, ':one': 1,
  };
  const condition = p.from === 'pending'
    ? (values[':pending'] = 'pending', 'attribute_exists(PK) AND #status = :pending AND #version = :ev')
    : (values[':nowMs'] = nowMs, '#status = :processing AND leaseExpiresAt < :nowMs AND #version = :ev');
  return new UpdateCommand({
    TableName: p.tableName,
    Key: outboxEffectKey(p.rfqId, p.effect),
    // `version` is a DynamoDB reserved word — alias it (as draftStore aliases #status/#ttl).
    UpdateExpression:
      'SET #status = :processing, leaseOwner = :owner, leaseExpiresAt = :exp, #version = :nv, claimedAt = :now ADD attempts :one',
    ConditionExpression: condition,
    ExpressionAttributeNames: { '#status': 'status', '#version': 'version' },
    ExpressionAttributeValues: values,
  });
}

/**
 * Discriminated union — each non-email effect is locked to its own result type, so a
 * caller cannot pair (e.g.) an org effect with an attachment result. Email effects are
 * DELIBERATELY absent: they must use the claim-before-send latch (buildEmailClaimItems /
 * buildEmailFinalizeItems), never this normal completion path.
 */
type CompletionResult =
  | { effect: 'org-upsert'; result: OrgUpsertResult }
  | { effect: 'attachment-move'; result: AttachmentMoveResult }
  | { effect: 'visitor-bridge'; result: VisitorBridgeResult }
  | { effect: 'crm-emit'; result: CrmEmitResult };

export type CompletionParams = {
  tableName: string; rfqId: string; owner: string; claimedVersion: number; now: string;
} & CompletionResult;

/** Optional RFQ#/META backfill patch for the effects that project a result onto the RFQ. */
function rfqBackfill(p: CompletionParams): { UpdateExpression: string; values: Record<string, unknown> } | null {
  if (p.effect === 'org-upsert' && p.result.matchedOrgId !== null) {
    return {
      UpdateExpression: 'SET matchedOrgId = :id, GSI2PK = :gsi2',
      values: { ':id': p.result.matchedOrgId, ':gsi2': `ORG#${p.result.matchedOrgId}` },
    };
  }
  if (p.effect === 'attachment-move') {
    return { UpdateExpression: 'SET attachmentKeys = :keys', values: { ':keys': p.result.movedKeys } };
  }
  return null;
}

/**
 * Complete a normal effect atomically: conditionally mark done (fenced on the claimed
 * version), persist the typed result, backfill the RFQ where required, and create the
 * effect's successors (attribute_not_exists → safe on retry). A stale worker's version
 * fails clause 1, cancelling the whole transaction — no double result/backfill/successor.
 */
export function buildEffectCompletionItems(p: CompletionParams): TransactItem[] {
  // Defense in depth: email effects must never reach normal completion (the type union
  // already excludes them; this guards a widened/`as`-cast call site).
  if (isEmailEffect(p.effect)) {
    throw new Error(`${p.effect} must use the email claim-before-send latch, not buildEffectCompletionItems`);
  }
  assertNonEmptyString(p.owner, 'owner');
  assertIsoTime(p.now, 'now');
  assertNonNegSafeInt(p.claimedVersion, 'claimedVersion');
  assertValidCompletionResult(p);
  const items: TransactItem[] = [
    {
      Update: {
        TableName: p.tableName,
        Key: outboxEffectKey(p.rfqId, p.effect),
        // `result` and `version` are DynamoDB reserved words — alias both.
        UpdateExpression: 'SET #status = :done, #result = :result, completedAt = :now, #version = :nv',
        ConditionExpression: '#status = :processing AND leaseOwner = :owner AND #version = :cv',
        ExpressionAttributeNames: { '#status': 'status', '#version': 'version', '#result': 'result' },
        ExpressionAttributeValues: {
          ':done': 'done', ':processing': 'processing', ':owner': p.owner,
          ':cv': p.claimedVersion, ':nv': p.claimedVersion + 1, ':result': p.result, ':now': p.now,
        },
      },
    },
  ];

  const backfill = rfqBackfill(p);
  if (backfill) {
    items.push({
      Update: {
        TableName: p.tableName,
        Key: { PK: `RFQ#${p.rfqId}`, SK: 'META' },
        UpdateExpression: backfill.UpdateExpression,
        ConditionExpression: 'attribute_exists(PK) AND #status = :pendingRfq',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: { ...backfill.values, ':pendingRfq': 'pending' },
      },
    });
  }

  for (const successor of EFFECT_SUCCESSORS[p.effect]) {
    items.push({
      Put: {
        TableName: p.tableName,
        Item: buildOutboxEffectItem({ rfqId: p.rfqId, effect: successor, now: p.now }) as unknown as Record<string, unknown>,
        ConditionExpression: 'attribute_not_exists(PK)',
      },
    });
  }
  return items;
}

// EmailEffectName/EmailOutcome are new symbols, not previously imported.
import type { EmailEffectName, EmailOutcome } from './outboxEffects';

/**
 * At-most-once latch: pending → send-claimed, committed BEFORE the send. Conditioned
 * only on `status = pending` — there is intentionally NO lease-expiry re-claim, so a
 * crash while send-claimed is terminal and the email is never re-attempted.
 */
export function buildEmailClaimItems(p: {
  tableName: string; rfqId: string; effect: EmailEffectName; owner: string; now: string;
}): UpdateCommand {
  assertNonEmptyString(p.owner, 'owner');
  assertIsoTime(p.now, 'now');
  return new UpdateCommand({
    TableName: p.tableName,
    Key: outboxEffectKey(p.rfqId, p.effect),
    UpdateExpression: 'SET #status = :claimed, claimedAt = :now, leaseOwner = :owner',
    ConditionExpression: '#status = :pending',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: { ':pending': 'pending', ':claimed': 'send-claimed', ':owner': p.owner, ':now': p.now },
  });
}

/**
 * send-claimed → done after the single send attempt, recording attemptedAt + the
 * observed outcome (`accepted`/`failed`/`unknown`). The latch guarantees at most one
 * attempt, not delivery — so a non-success outcome is recorded, never retried.
 */
export function buildEmailFinalizeItems(p: {
  tableName: string; rfqId: string; effect: EmailEffectName; owner: string; now: string;
  attemptedAt: string; outcome: EmailOutcome;
}): UpdateCommand {
  assertNonEmptyString(p.owner, 'owner');
  assertIsoTime(p.now, 'now');
  assertIsoTime(p.attemptedAt, 'attemptedAt');
  if (!['accepted', 'failed', 'unknown'].includes(p.outcome)) throw new Error('outcome must be accepted|failed|unknown');
  return new UpdateCommand({
    TableName: p.tableName,
    Key: outboxEffectKey(p.rfqId, p.effect),
    // `result` is a DynamoDB reserved word — alias it.
    UpdateExpression: 'SET #status = :done, #result = :result, completedAt = :now',
    ConditionExpression: '#status = :claimed AND leaseOwner = :owner',
    ExpressionAttributeNames: { '#status': 'status', '#result': 'result' },
    ExpressionAttributeValues: {
      ':claimed': 'send-claimed', ':owner': p.owner, ':done': 'done',
      ':result': { attemptedAt: p.attemptedAt, outcome: p.outcome }, ':now': p.now,
    },
  });
}
