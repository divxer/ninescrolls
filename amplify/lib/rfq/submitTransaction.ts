// amplify/lib/rfq/submitTransaction.ts
import type { TransactWriteCommandInput } from '@aws-sdk/lib-dynamodb';
import { buildPendingRfqItem, type PendingRfqSource, type PendingRfqMeta } from './pendingRfq';
import { buildReceiptItem } from './receiptStore';
import type { SubmitOperationKind } from './submitReceipt';
import { submitRootEffects, buildOutboxEffectItem } from './outboxEffects';
import { deriveClientRequestToken } from './clientRequestToken';
import {
  assertWithinItemLimits, estimateDynamoItemBytes, MAX_TRANSACTION_BYTES,
} from './dynamoItemSize';

type TransactItem = NonNullable<TransactWriteCommandInput['TransactItems']>[number];

interface SubmitBase {
  tableName: string;
  source: PendingRfqSource;
  meta: PendingRfqMeta;
  tempKeys: string[]; // validated temp/rfq/ keys; hasAttachments is derived from .length
  receipt: { receiptId: string; binding: string; status: number };
  submitKeyB64: string;
  now: string;
}
export type SubmitTransactionParams =
  | (SubmitBase & { kind: 'direct' })
  | (SubmitBase & { kind: 'draft-upgrade'; draftPrecondition: { storedHash: string; expectedVersion: number } });

const OP_KIND: Record<SubmitTransactionParams['kind'], SubmitOperationKind> = {
  'direct': 'direct', 'draft-upgrade': 'draft-upgrade',
};

/** Compose the atomic submit transaction (TransactItems + ClientRequestToken). */
export function buildSubmitTransaction(params: SubmitTransactionParams): TransactWriteCommandInput {
  const { tableName, source, meta, tempKeys, receipt, submitKeyB64, now } = params;
  const opKind = OP_KIND[params.kind];

  const pendingItem = buildPendingRfqItem(source, meta) as unknown as Record<string, unknown>;
  const pendingCondition = params.kind === 'draft-upgrade'
    ? {
        ConditionExpression:
          '#status = :draft AND draftTokenHash = :h AND draftVersion = :v AND expiresAt > :now',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':draft': 'draft', ':h': params.draftPrecondition.storedHash,
          ':v': params.draftPrecondition.expectedVersion, ':now': now,
        },
      }
    : { ConditionExpression: 'attribute_not_exists(PK)' };

  const receiptItem = buildReceiptItem(receipt.receiptId, {
    opKind, binding: receipt.binding,
    result: { rfqId: meta.rfqId, referenceNumber: meta.referenceNumber, status: receipt.status }, now,
  }) as unknown as Record<string, unknown>;

  const hasAttachments = tempKeys.length > 0;
  const roots = submitRootEffects(hasAttachments);
  const rootItems = roots.map((effect) => buildOutboxEffectItem({
    rfqId: meta.rfqId, effect, now,
    input: effect === 'attachment-move' ? { tempKeys } : undefined,
  }) as unknown as Record<string, unknown>);

  const items: TransactItem[] = [
    { Put: { TableName: tableName, Item: pendingItem, ...pendingCondition } },
    { Put: { TableName: tableName, Item: receiptItem, ConditionExpression: 'attribute_not_exists(PK)' } },
    ...rootItems.map((Item) => ({
      Put: { TableName: tableName, Item, ConditionExpression: 'attribute_not_exists(PK)' },
    })),
  ];

  // Guard: no two transaction items may target the same primary key (real DynamoDB rejects it).
  const keys = new Set<string>();
  for (const it of items) {
    const item = it.Put!.Item as { PK: string; SK: string };
    const k = `${item.PK}|${item.SK}`;
    if (keys.has(k)) throw new Error(`Duplicate transaction target ${k}`);
    keys.add(k);
  }
  // Guard: each item within the 400 KB item limit; whole transaction within 4 MB.
  let total = 0;
  for (const it of items) {
    const item = it.Put!.Item as Record<string, unknown>;
    assertWithinItemLimits(item);
    total += estimateDynamoItemBytes(item);
  }
  if (total > MAX_TRANSACTION_BYTES) throw new Error(`Transaction size ${total}B exceeds ${MAX_TRANSACTION_BYTES}B`);

  return { TransactItems: items, ClientRequestToken: deriveClientRequestToken(submitKeyB64) };
}
