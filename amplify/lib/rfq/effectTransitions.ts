// amplify/lib/rfq/effectTransitions.ts
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import type { TransactWriteCommandInput } from '@aws-sdk/lib-dynamodb';
import { outboxEffectKey, type OutboxEffectName } from './outboxEffects';
import {
  EFFECT_SUCCESSORS, buildOutboxEffectItem, isEmailEffect,
  type AttachmentMoveResult, type CrmEmitResult,
  type OrgUpsertResult, type VisitorBridgeResult,
} from './outboxEffects';

type TransactItem = NonNullable<TransactWriteCommandInput['TransactItems']>[number];

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
