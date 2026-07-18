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

/** Classify a submit attempt against any stored receipt. `binding` omitted on the pre-write probe. */
export async function checkReceipt(
  deps: ReceiptDeps, receiptId: string, binding?: string,
): Promise<CheckReceiptResult> {
  const res = await deps.send(new GetCommand({
    TableName: deps.tableName, Key: { PK: receiptId, SK: 'META' },
  }));
  const item = res.Item;
  if (!item) return { outcome: 'first-use' };
  if (Date.parse(deps.now()) >= Date.parse(item.replayExpiresAt as string)) {
    return { outcome: 'window-expired' }; // tombstone through TTL
  }
  if (binding && !bindingMatches(binding, item.binding as string)) return { outcome: 'conflict' };
  return {
    outcome: 'replay',
    result: {
      rfqId: item.rfqId as string,
      referenceNumber: item.referenceNumber as string,
      status: item.status as number,
    },
  };
}

/** Conditionally create the receipt (idempotency barrier). Throws if one already exists. */
export async function recordReceipt(
  deps: ReceiptDeps, receiptId: string,
  args: { opKind: SubmitOperationKind; binding: string; result: StoredResult },
): Promise<void> {
  const now = deps.now();
  const replayExpiresAt = new Date(Date.parse(now) + REPLAY_DAYS * DAY_MS).toISOString();
  const ttlExpiresAt = new Date(Date.parse(now) + TTL_DAYS * DAY_MS).toISOString();
  await deps.send(new PutCommand({
    TableName: deps.tableName,
    Item: {
      PK: receiptId, SK: 'META',
      opKind: args.opKind, binding: args.binding,
      rfqId: args.result.rfqId, referenceNumber: args.result.referenceNumber, status: args.result.status,
      createdAt: now, replayExpiresAt, TTL: Math.floor(Date.parse(ttlExpiresAt) / 1000),
    },
    ConditionExpression: 'attribute_not_exists(PK)',
  }));
}
