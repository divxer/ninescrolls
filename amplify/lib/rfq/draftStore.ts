import { GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import type { DraftCreateInput, NormalizedDraftPatch } from './draftContract';
import { DRAFT_FIELD_KEYS, applyNormalizedDraftPatch } from './draftContract';
import {
  decodeCredential, deriveDraftId, deriveDraftToken, encodeCredential, hashDraftToken,
  verifyDraftToken,
} from './draftCredentials';

export const DRAFT_TTL_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export type DraftItem = Record<string, unknown> & {
  PK: string; SK: 'META'; status: 'draft'; draftVersion: number;
  createdAt: string; lastActivityAt: string; expiresAt: string; TTL: number;
  draftTokenHash: string; GSI1PK: string; GSI1SK: string;
};

export function draftPk(rfqId: string): string {
  return `RFQ#${rfqId}`;
}

function expiryFrom(iso: string): { expiresAt: string; TTL: number } {
  const expiresAt = new Date(Date.parse(iso) + DRAFT_TTL_DAYS * DAY_MS).toISOString();
  return { expiresAt, TTL: Math.floor(Date.parse(expiresAt) / 1000) };
}

export function buildDraftItem(args: {
  rfqId: string; draftTokenHash: string; input: DraftCreateInput; now: string;
}): DraftItem {
  const { rfqId, draftTokenHash, input, now } = args;
  const { expiresAt, TTL } = expiryFrom(now);
  return {
    PK: draftPk(rfqId),
    SK: 'META',
    status: 'draft',
    draftVersion: 1,
    createdAt: now,
    lastActivityAt: now,
    expiresAt,
    TTL,
    draftTokenHash,
    GSI1PK: 'RFQ_STATUS#draft',
    GSI1SK: `${now}#${rfqId}`,
    ...input,
  };
}

export interface DraftStoreDeps {
  send: (command: unknown) => Promise<{ Item?: Record<string, unknown> }>;
  tableName: string;
  pepper: Buffer;
  keyVersion: number;
  resolvePepper: (keyVersion: number) => Buffer | undefined;
  now: () => string;
}

export interface CreateDraftResult {
  rfqId: string;
  draftToken: string;
  draftVersion: number;
}

/** Create a draft with a conditional put; the same nonce converges on one record. */
export async function createDraft(
  deps: DraftStoreDeps, nonceB64: string, input: DraftCreateInput,
): Promise<CreateDraftResult> {
  const nonce = decodeCredential(nonceB64);
  const rfqId = deriveDraftId(nonce);
  const token = deriveDraftToken(nonce);
  const draftTokenHash = hashDraftToken(deps.pepper, deps.keyVersion, token);
  const item = buildDraftItem({ rfqId, draftTokenHash, input, now: deps.now() });
  try {
    await deps.send(new PutCommand({
      TableName: deps.tableName,
      Item: item,
      ConditionExpression: 'attribute_not_exists(PK)',
    }));
    return { rfqId, draftToken: encodeCredential(token), draftVersion: 1 };
  } catch (err) {
    if ((err as { name?: string }).name !== 'ConditionalCheckFailedException') throw err;
    // Idempotent retry: same nonce already created this record — return its version.
    const existing = await deps.send(new GetCommand({
      TableName: deps.tableName, Key: { PK: draftPk(rfqId), SK: 'META' },
    }));
    const draftVersion = (existing.Item?.draftVersion as number) ?? 1;
    return { rfqId, draftToken: encodeCredential(token), draftVersion };
  }
}

export type DraftReadResult =
  | { ok: true; fields: Record<string, unknown>; draftVersion: number; lastActivityAt: string; expiresAt: string }
  | { ok: false };

const DRAFT_UNAVAILABLE: DraftReadResult = { ok: false };

function whitelist(item: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of DRAFT_FIELD_KEYS) if (k in item) out[k] = item[k];
  return out;
}

/**
 * Read + authenticate a draft. Every failure mode (missing, wrong token, expired,
 * non-draft) returns null after running the constant-time verifier, so timing and
 * outcome never disclose whether a draft exists.
 */
async function loadLiveDraft(
  deps: DraftStoreDeps, rfqId: string, tokenB64: string,
): Promise<Record<string, unknown> | null> {
  let token: Buffer;
  try { token = decodeCredential(tokenB64); } catch { return null; }
  const res = await deps.send(new GetCommand({
    TableName: deps.tableName, Key: { PK: draftPk(rfqId), SK: 'META' },
  }));
  const item = res.Item;
  const authed = verifyDraftToken(item?.draftTokenHash as string | undefined, token, deps.resolvePepper);
  if (!item || !authed || item.status !== 'draft') return null;
  if (Date.parse(item.expiresAt as string) <= Date.parse(deps.now())) return null;
  return item;
}

/** Whitelisted, authenticated draft read; DraftUnavailable on any failure. */
export async function getDraft(
  deps: DraftStoreDeps, rfqId: string, tokenB64: string,
): Promise<DraftReadResult> {
  const item = await loadLiveDraft(deps, rfqId, tokenB64);
  if (!item) return DRAFT_UNAVAILABLE;
  return {
    ok: true,
    fields: whitelist(item),
    draftVersion: item.draftVersion as number,
    lastActivityAt: item.lastActivityAt as string,
    expiresAt: item.expiresAt as string,
  };
}

export type DraftUpdateResult =
  | { status: 'updated'; fields: Record<string, unknown>; draftVersion: number }
  | { status: 'noop'; draftVersion: number }
  | { status: 'conflict'; fields: Record<string, unknown>; draftVersion: number }
  | { status: 'unavailable' };

/**
 * Apply a normalized patch under an optimistic-concurrency condition on
 * draftVersion. A no-op writes nothing; a stale version returns the current
 * draft; content changes bump version/activity/expiry atomically.
 */
export async function updateDraft(
  deps: DraftStoreDeps, rfqId: string, tokenB64: string,
  expectedVersion: number, patch: NormalizedDraftPatch,
): Promise<DraftUpdateResult> {
  const item = await loadLiveDraft(deps, rfqId, tokenB64);
  if (!item) return { status: 'unavailable' };
  const currentVersion = item.draftVersion as number;
  if (currentVersion !== expectedVersion) {
    return { status: 'conflict', fields: whitelist(item), draftVersion: currentVersion };
  }
  const currentFields = whitelist(item) as DraftCreateInput;
  const next = applyNormalizedDraftPatch(currentFields, patch);
  if (JSON.stringify(next) === JSON.stringify(currentFields)) {
    return { status: 'noop', draftVersion: currentVersion };
  }

  const now = deps.now();
  const { expiresAt, TTL } = expiryFrom(now);
  const sets = ['draftVersion = :nv', 'lastActivityAt = :la', 'expiresAt = :ea', '#ttl = :ttl', 'GSI1SK = :g1sk'];
  const values: Record<string, unknown> = {
    ':nv': currentVersion + 1, ':la': now, ':ea': expiresAt, ':ttl': TTL,
    ':g1sk': `${now}#${rfqId}`, ':ev': expectedVersion, ':draft': 'draft',
  };
  for (const [k, v] of Object.entries(patch.set)) { sets.push(`${k} = :s_${k}`); values[`:s_${k}`] = v; }
  const removeClause = patch.remove.length ? ` REMOVE ${patch.remove.join(', ')}` : '';
  try {
    await deps.send(new UpdateCommand({
      TableName: deps.tableName, Key: { PK: draftPk(rfqId), SK: 'META' },
      UpdateExpression: `SET ${sets.join(', ')}${removeClause}`,
      ConditionExpression: 'draftVersion = :ev AND #status = :draft',
      ExpressionAttributeNames: { '#ttl': 'TTL', '#status': 'status' },
      ExpressionAttributeValues: values,
    }));
  } catch (err) {
    if ((err as { name?: string }).name !== 'ConditionalCheckFailedException') throw err;
    const fresh = await loadLiveDraft(deps, rfqId, tokenB64);
    if (!fresh) return { status: 'unavailable' };
    return { status: 'conflict', fields: whitelist(fresh), draftVersion: fresh.draftVersion as number };
  }
  return { status: 'updated', fields: next as Record<string, unknown>, draftVersion: currentVersion + 1 };
}
