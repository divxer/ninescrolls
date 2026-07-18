import crypto from 'node:crypto';
import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import type { SubmitOperationKind } from './submitReceipt';

const DAY_MS = 24 * 60 * 60 * 1000;
const REPLAY_DAYS = 7;
const TTL_DAYS = 90;

export interface ReceiptDeps {
  send: (command: unknown) => Promise<{ Item?: Record<string, unknown> }>;
  tableName: string;
  now: () => string;
}

export interface StoredResult { rfqId: string; referenceNumber: string; status: number }

export interface ReceiptItem {
  PK: string; SK: 'META'; opKind: SubmitOperationKind; binding: string; rfqId: string;
  referenceNumber: string; status: number; createdAt: string; replayExpiresAt: string; TTL: number;
}

/** Shared receipt-item builder — the single source for recordReceipt AND the submit transaction. */
export function buildReceiptItem(
  receiptId: string,
  args: { opKind: SubmitOperationKind; binding: string; result: StoredResult; now: string },
): ReceiptItem {
  // Enforce on write the same invariants validStoredReceipt() enforces on read, so a
  // malformed receipt can never be persisted (fail closed at the write boundary).
  if (typeof receiptId !== 'string' || receiptId.length === 0) throw new TypeError('receiptId must be a non-empty string');
  if (!/^[0-9a-f]{64}$/.test(args.binding)) throw new TypeError('binding must be 64 hex chars');
  if (!Number.isFinite(Date.parse(args.now))) throw new TypeError('now must be an ISO timestamp');
  if (typeof args.result.rfqId !== 'string' || args.result.rfqId.length === 0) throw new TypeError('result.rfqId must be non-empty');
  if (typeof args.result.referenceNumber !== 'string' || args.result.referenceNumber.length === 0) throw new TypeError('result.referenceNumber must be non-empty');
  if (!Number.isSafeInteger(args.result.status)) throw new TypeError('result.status must be a safe integer');
  const replayExpiresAt = new Date(Date.parse(args.now) + REPLAY_DAYS * DAY_MS).toISOString();
  const ttlExpiresAt = new Date(Date.parse(args.now) + TTL_DAYS * DAY_MS).toISOString();
  return {
    PK: receiptId, SK: 'META', opKind: args.opKind, binding: args.binding,
    rfqId: args.result.rfqId, referenceNumber: args.result.referenceNumber, status: args.result.status,
    createdAt: args.now, replayExpiresAt, TTL: Math.floor(Date.parse(ttlExpiresAt) / 1000),
  };
}

export type CheckReceiptResult =
  | { outcome: 'first-use' }
  | { outcome: 'replay'; result: StoredResult }
  | { outcome: 'conflict' }
  | { outcome: 'window-expired' };

function bindingMatches(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

function validStoredReceipt(item: Record<string, unknown>): item is Record<string, unknown> & {
  binding: string; replayExpiresAt: string; rfqId: string; referenceNumber: string; status: number;
} {
  return typeof item.binding === 'string' && /^[0-9a-f]{64}$/.test(item.binding)
    && typeof item.replayExpiresAt === 'string' && Number.isFinite(Date.parse(item.replayExpiresAt))
    && typeof item.rfqId === 'string' && item.rfqId.length > 0
    && typeof item.referenceNumber === 'string' && item.referenceNumber.length > 0
    && typeof item.status === 'number' && Number.isSafeInteger(item.status);
}

/** Classify a submit attempt against any stored receipt using its request binding. */
export async function checkReceipt(
  deps: ReceiptDeps, receiptId: string, binding: string,
): Promise<CheckReceiptResult> {
  const res = await deps.send(new GetCommand({
    TableName: deps.tableName, Key: { PK: receiptId, SK: 'META' },
    ConsistentRead: true,
  }));
  const item = res.Item;
  if (!item) return { outcome: 'first-use' };
  if (!validStoredReceipt(item)) throw new Error('Invalid stored receipt');
  if (Date.parse(deps.now()) >= Date.parse(item.replayExpiresAt as string)) {
    return { outcome: 'window-expired' }; // tombstone through TTL
  }
  if (!/^[0-9a-f]{64}$/.test(binding)) throw new TypeError('Invalid request binding');
  if (!bindingMatches(binding, item.binding)) return { outcome: 'conflict' };
  return {
    outcome: 'replay',
    result: {
      rfqId: item.rfqId,
      referenceNumber: item.referenceNumber,
      status: item.status,
    },
  };
}

/** Conditionally create the receipt (idempotency barrier). Throws if one already exists. */
export async function recordReceipt(
  deps: ReceiptDeps, receiptId: string,
  args: { opKind: SubmitOperationKind; binding: string; result: StoredResult },
): Promise<void> {
  await deps.send(new PutCommand({
    TableName: deps.tableName,
    Item: buildReceiptItem(receiptId, { ...args, now: deps.now() }),
    ConditionExpression: 'attribute_not_exists(PK)',
  }));
}
