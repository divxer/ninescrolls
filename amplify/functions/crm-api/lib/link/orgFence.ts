import { TABLE_NAME } from '../dynamodb';

// R5/R6 org-active write fence (Task 8; Task 10's link transactions reuse it): element 0 of every
// org-referencing generational TransactWriteItems is this ConditionCheck, so a concurrently-archived
// org cancels the write instead of letting it land on a merged-away partition.
export function orgActiveCheck(orgId: string) {
  return {
    ConditionCheck: {
      TableName: TABLE_NAME(),
      Key: { PK: `ORG#${orgId}`, SK: 'META' },
      ConditionExpression: '#s = :active',
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues: { ':active': 'active' },
    },
  };
}

export type LinkCancellation = 'org_fence' | 'move_condition' | 'other';

// POSITIONAL CancellationReasons mapping (R6/R7): index 0 is ALWAYS the org fence, `moveIndex` is
// the write's own condition. Never `.some(...)` across positions; a non-TransactionCanceledException
// or a MISSING/malformed CancellationReasons array is 'other' — the caller propagates it (transient),
// it is never guessed into a fence/loser outcome.
export function classifyLinkCancellation(err: unknown, moveIndex: number): LinkCancellation {
  const e = err as { name?: string; CancellationReasons?: Array<{ Code?: string }> };
  if (e?.name !== 'TransactionCanceledException' || !Array.isArray(e.CancellationReasons)) return 'other';
  if (e.CancellationReasons[0]?.Code === 'ConditionalCheckFailed') return 'org_fence';
  if (e.CancellationReasons[moveIndex]?.Code === 'ConditionalCheckFailed') return 'move_condition';
  return 'other';
}
