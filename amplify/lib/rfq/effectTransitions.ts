// amplify/lib/rfq/effectTransitions.ts
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import type { TransactWriteCommandInput } from '@aws-sdk/lib-dynamodb';
import { outboxEffectKey, type OutboxEffectName } from './outboxEffects';
import {
  EFFECT_SUCCESSORS, buildOutboxEffectItem, isEmailEffect, isValidTempAttachmentKey,
  type AttachmentMoveResult, type CrmEmitResult,
  type OrgUpsertResult, type VisitorBridgeResult,
} from './outboxEffects';
import { MAX_RFQ_ATTACHMENTS } from './contract';

type TransactItem = NonNullable<TransactWriteCommandInput['TransactItems']>[number];

const MAX_ORG_ID_LEN = 256;
const MAX_LEASE_MS = 60 * 60 * 1000; // 1h — a lease should never legitimately exceed this
// Destination filename charset mirrors the handler's TEMP_ATTACHMENT_KEY_RE basename: a
// single path segment (no '/'), no control chars, 1..200 chars. This rejects empty
// suffixes, nested paths, and control characters in one shot.
const MOVED_FILENAME_RE = /^[a-zA-Z0-9._-]{1,200}$/;
// Strict ISO-8601 UTC (exactly what Date.prototype.toISOString produces), so a loose
// `Date.parse`-acceptable value like '2026-07-18' or 'Jan 1 2026' is rejected.
const ISO_UTC_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;

// These builders are the trust boundary between the P4b-2 worker (which passes results
// derived from helpers / DynamoDB streams as effectively `unknown`) and what gets durably
// persisted + backfilled onto the RFQ. TypeScript types don't survive a cast, so we parse
// at runtime, fail closed, and persist ONLY a freshly-normalized copy — never the caller's
// object — so a post-build mutation cannot reach the transaction.
function assertNonEmptyString(v: unknown, label: string): void {
  if (typeof v !== 'string' || v.length === 0) throw new Error(`${label} must be a non-empty string`);
}
function assertIsoTime(v: unknown, label: string): void {
  if (typeof v !== 'string' || !ISO_UTC_RE.test(v) || !Number.isFinite(Date.parse(v))) {
    throw new Error(`${label} must be a strict ISO-8601 UTC timestamp`);
  }
}
/** Non-negative safe integer whose successor is still safe (version fencing does `+1`). */
function assertVersion(v: unknown, label: string): void {
  if (!Number.isSafeInteger(v) || (v as number) < 0 || (v as number) >= Number.MAX_SAFE_INTEGER) {
    throw new Error(`${label} must be a non-negative safe integer below MAX_SAFE_INTEGER`);
  }
}
function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
}
function assertExactKeys(rec: Record<string, unknown>, allowed: readonly string[], label: string): void {
  for (const k of Object.keys(rec)) {
    if (!allowed.includes(k)) throw new Error(`${label} has unexpected property '${k}'`);
  }
}

type NormalizedResult = OrgUpsertResult | VisitorBridgeResult | CrmEmitResult | AttachmentMoveResult;

/**
 * Strict fail-closed parser: requires a plain own-property object with the EXACT field set
 * for the effect, strict value/key formats, and unique+disjoint attachment arrays. Returns
 * a brand-new normalized object (fresh nested arrays) so the caller can never mutate what
 * gets persisted. Anything unexpected throws — nothing is coerced or silently dropped.
 */
function parseCompletionResult(effect: CompletionParams['effect'], rfqId: string, result: unknown): NormalizedResult {
  if (!isPlainObject(result)) throw new Error(`${effect} result must be a plain object`);
  switch (effect) {
    case 'org-upsert': {
      assertExactKeys(result, ['matchedOrgId'], 'org-upsert result');
      const id = result.matchedOrgId;
      if (!(id === null || (typeof id === 'string' && id.length > 0 && id.length <= MAX_ORG_ID_LEN))) {
        throw new Error('org-upsert result.matchedOrgId must be null or a bounded non-empty string');
      }
      return { matchedOrgId: id };
    }
    case 'visitor-bridge': {
      assertExactKeys(result, ['created', 'orgUpgraded'], 'visitor-bridge result');
      if (typeof result.created !== 'boolean' || typeof result.orgUpgraded !== 'boolean') {
        throw new Error('visitor-bridge result requires boolean created/orgUpgraded');
      }
      return { created: result.created, orgUpgraded: result.orgUpgraded };
    }
    case 'crm-emit': {
      assertExactKeys(result, ['accepted'], 'crm-emit result');
      if (result.accepted !== true) throw new Error('crm-emit result.accepted must be true');
      return { accepted: true };
    }
    case 'attachment-move': {
      assertExactKeys(result, ['movedKeys', 'failedKeys'], 'attachment-move result');
      const moved = result.movedKeys, failed = result.failedKeys;
      if (!Array.isArray(moved) || !Array.isArray(failed)) {
        throw new Error('attachment-move result requires movedKeys/failedKeys arrays');
      }
      if (moved.length + failed.length > MAX_RFQ_ATTACHMENTS) {
        throw new Error(`attachment-move keys exceed MAX_RFQ_ATTACHMENTS (${MAX_RFQ_ATTACHMENTS})`);
      }
      const destPrefix = `rfqs/${rfqId}/`;
      const seen = new Set<string>();
      const movedKeys: string[] = [];
      for (const k of moved) {
        if (typeof k !== 'string' || !k.startsWith(destPrefix) || k.includes('..')
          || !MOVED_FILENAME_RE.test(k.slice(destPrefix.length))) {
          throw new Error(`attachment-move movedKeys must be strict rfqs/${rfqId}/<filename> keys`);
        }
        if (seen.has(k)) throw new Error('attachment-move keys must be unique and disjoint');
        seen.add(k); movedKeys.push(k);
      }
      const failedKeys: string[] = [];
      for (const k of failed) {
        if (!isValidTempAttachmentKey(k)) throw new Error('attachment-move failedKeys must be valid temp/rfq/ keys');
        if (seen.has(k)) throw new Error('attachment-move keys must be unique and disjoint');
        seen.add(k); failedKeys.push(k);
      }
      return { movedKeys, failedKeys };
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
  assertVersion(p.expectedVersion, 'expectedVersion');
  if (!Number.isSafeInteger(p.leaseMs) || p.leaseMs <= 0 || p.leaseMs > MAX_LEASE_MS) {
    throw new Error(`leaseMs must be a positive safe integer <= ${MAX_LEASE_MS}`);
  }
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

/**
 * Optional RFQ#/META backfill patch, built from the NORMALIZED parsed result (never the
 * caller's object), so the backfill can't carry post-build-mutated data.
 */
function rfqBackfill(
  effect: CompletionParams['effect'], parsed: NormalizedResult,
): { UpdateExpression: string; values: Record<string, unknown> } | null {
  if (effect === 'org-upsert' && (parsed as OrgUpsertResult).matchedOrgId !== null) {
    const id = (parsed as OrgUpsertResult).matchedOrgId;
    return {
      UpdateExpression: 'SET matchedOrgId = :id, GSI2PK = :gsi2',
      values: { ':id': id, ':gsi2': `ORG#${id}` },
    };
  }
  if (effect === 'attachment-move') {
    return { UpdateExpression: 'SET attachmentKeys = :keys', values: { ':keys': (parsed as AttachmentMoveResult).movedKeys } };
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
  assertVersion(p.claimedVersion, 'claimedVersion');
  // Parse into a fresh normalized object; everything below persists ONLY `parsed`.
  const parsed = parseCompletionResult(p.effect, p.rfqId, p.result);
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
          ':cv': p.claimedVersion, ':nv': p.claimedVersion + 1, ':result': parsed, ':now': p.now,
        },
      },
    },
  ];

  const backfill = rfqBackfill(p.effect, parsed);
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
