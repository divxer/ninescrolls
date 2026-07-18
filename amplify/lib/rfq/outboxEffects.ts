// amplify/lib/rfq/outboxEffects.ts

export type OutboxEffectName =
  | 'org-upsert' | 'visitor-bridge' | 'crm-emit'
  | 'attachment-move' | 'confirmation-email' | 'internal-email';

/** Frozen, NOT caller-supplied — the two-branch DAG. Callers pass no edges. */
export const EFFECT_SUCCESSORS: Readonly<Record<OutboxEffectName, readonly OutboxEffectName[]>> =
  Object.freeze({
    'org-upsert': Object.freeze(['visitor-bridge', 'crm-emit']),
    'visitor-bridge': Object.freeze([]),
    'crm-emit': Object.freeze([]),
    'attachment-move': Object.freeze(['confirmation-email', 'internal-email']),
    'confirmation-email': Object.freeze([]),
    'internal-email': Object.freeze([]),
  }) as Readonly<Record<OutboxEffectName, readonly OutboxEffectName[]>>;

const ROOTS_WITH_ATTACHMENTS: readonly OutboxEffectName[] = Object.freeze(['org-upsert', 'attachment-move']);
const ROOTS_WITHOUT_ATTACHMENTS: readonly OutboxEffectName[] =
  Object.freeze(['org-upsert', 'confirmation-email', 'internal-email']);

/** The fixed root tuple — one of exactly two shapes; never an arbitrary set. */
export function submitRootEffects(hasAttachments: boolean): readonly OutboxEffectName[] {
  return hasAttachments ? ROOTS_WITH_ATTACHMENTS : ROOTS_WITHOUT_ATTACHMENTS;
}

// Typed durable inputs (only attachment-move has one).
export interface AttachmentMoveInput { tempKeys: string[] }

// Re-validate temp keys at the builder boundary (the handler validates at the schema and
// again in moveAttachments; the outbox persists them, so it must not trust the caller).
const TEMP_ATTACHMENT_KEY_RE = /^temp\/rfq\/[a-f0-9]{16}\/[a-zA-Z0-9._-]{1,200}$/;
export function isValidTempAttachmentKey(key: unknown): key is string {
  return typeof key === 'string' && TEMP_ATTACHMENT_KEY_RE.test(key) && !key.includes('..');
}

// Typed durable results — shapes verified against the real helpers.
export interface OrgUpsertResult { matchedOrgId: string | null }
export interface VisitorBridgeResult { created: boolean; orgUpgraded: boolean }
// The CRM helper's 202 means the Lambda ACCEPTED the event, NOT that the projection
// succeeded (invoke-crm-api.ts:8-11); the strongest durable fact is acceptance. The
// P4b-2 crm-emit effect MUST call with { sync: true } so a dispatch/FunctionError
// propagates and completion runs only after acceptance — never the default swallow path.
export interface CrmEmitResult { accepted: true }
export interface AttachmentMoveResult { movedKeys: string[]; failedKeys: string[] }
// Claim-before-send guarantees at most ONE automatic attempt, never delivery/acceptance.
// The result records the attempt time + an explicit outcome (a sync failure or ambiguous
// timeout is 'failed'/'unknown', not silent success).
export type EmailOutcome = 'accepted' | 'failed' | 'unknown';
export interface EmailResult { attemptedAt: string; outcome: EmailOutcome }

export type EmailEffectName = 'confirmation-email' | 'internal-email';
export function isEmailEffect(effect: OutboxEffectName): effect is EmailEffectName {
  return effect === 'confirmation-email' || effect === 'internal-email';
}

export type OutboxEffectStatus = 'pending' | 'processing' | 'send-claimed' | 'done';

export interface OutboxEffectItem {
  PK: string;
  SK: string;
  effect: OutboxEffectName;
  status: OutboxEffectStatus;
  successors: readonly OutboxEffectName[];
  version: number;
  attempts: number;
  leaseOwner: string | null;
  leaseExpiresAt: number | null; // epoch ms
  createdAt: string;
  claimedAt?: string;
  completedAt?: string;
  input?: AttachmentMoveInput;
  result?: OrgUpsertResult | VisitorBridgeResult | CrmEmitResult | AttachmentMoveResult | EmailResult;
}

export function outboxEffectKey(rfqId: string, effect: OutboxEffectName): { PK: string; SK: string } {
  return { PK: `RFQ#${rfqId}`, SK: `OUTBOX#${effect}` };
}

/** Build a fresh root/successor effect item (status 'pending', version 0, no lease). */
export function buildOutboxEffectItem(args: {
  rfqId: string; effect: OutboxEffectName; now: string; input?: AttachmentMoveInput;
}): OutboxEffectItem {
  const { rfqId, effect, now, input } = args;
  // Input boundary: only attachment-move may carry input; it MUST carry a non-empty,
  // shape-valid tempKeys list. A silently-ignored input on another effect is a bug.
  if (input && effect !== 'attachment-move') {
    throw new Error(`input is only valid for attachment-move, not ${effect}`);
  }
  if (effect === 'attachment-move') {
    if (!input || input.tempKeys.length === 0) throw new Error('attachment-move requires a non-empty tempKeys input');
    for (const k of input.tempKeys) {
      if (!isValidTempAttachmentKey(k)) throw new Error(`invalid temp attachment key: ${String(k).slice(0, 80)}`);
    }
  }
  const item: OutboxEffectItem = {
    ...outboxEffectKey(rfqId, effect),
    effect,
    status: 'pending',
    successors: [...EFFECT_SUCCESSORS[effect]],
    version: 0,
    attempts: 0,
    leaseOwner: null,
    leaseExpiresAt: null,
    createdAt: now,
  };
  if (effect === 'attachment-move' && input) item.input = input;
  return item;
}
