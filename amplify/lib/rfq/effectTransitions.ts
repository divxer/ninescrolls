// amplify/lib/rfq/effectTransitions.ts
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { outboxEffectKey, type OutboxEffectName } from './outboxEffects';

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
