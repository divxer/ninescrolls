import crypto from 'node:crypto';
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../dynamodb';

// 'analytics'/'sessions' = the 2C-analytics session-rollup state (CRM_SWEEP#analytics#sessions).
export type SweepMode = 'hot' | 'cold' | 'analytics';
export type SweepPass = 'existence' | 'dirty-rollups' | 'sessions';

export function stateKey(mode: SweepMode, pass: SweepPass) {
  return { PK: `CRM_SWEEP#${mode}#${pass}`, SK: 'STATE' };
}

export interface SweepState {
  cursor?: Record<string, unknown>;
  hasMore?: boolean;
  lease?: string;
  leaseExpiresAt?: string;
  lastSummary?: Record<string, unknown>;
}

export async function readState(mode: SweepMode, pass: SweepPass): Promise<SweepState> {
  const res = await docClient.send(new GetCommand({ TableName: TABLE_NAME(), Key: stateKey(mode, pass) }));
  return (res.Item as SweepState | undefined) ?? {};
}

// Acquire the per-pass lease iff none is active (or it has expired). Returns the token, or null if held.
export async function acquireLease(mode: SweepMode, pass: SweepPass, lambdaTimeoutSec: number, nowIso: string): Promise<string | null> {
  const token = crypto.randomUUID();
  const leaseSeconds = Math.max(2 * lambdaTimeoutSec, 300); // longer than max invocation
  const leaseExpiresAt = new Date(Date.parse(nowIso) + leaseSeconds * 1000).toISOString();
  try {
    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME(), Key: stateKey(mode, pass),
      UpdateExpression: 'SET lease = :tok, leaseExpiresAt = :exp, lastRunAt = :now',
      ConditionExpression: 'attribute_not_exists(lease) OR leaseExpiresAt < :now',
      ExpressionAttributeValues: { ':tok': token, ':exp': leaseExpiresAt, ':now': nowIso },
    }));
    return token;
  } catch (err: unknown) {
    if ((err as { name?: string }).name === 'ConditionalCheckFailedException') return null;
    throw err;
  }
}

// Persist progress AFTER each page: cursor + counters + a lease heartbeat. Conditioned on `lease = :token`
// so ONLY the current owner can advance the cursor — if a stale invocation (whose lease expired and was
// re-acquired by another fire) tries to persist, the conditional fails and the write is rejected.
export async function persistPage(mode: SweepMode, pass: SweepPass, leaseToken: string, p: { cursor?: Record<string, unknown>; hasMore: boolean; counters: Record<string, number>; leaseExpiresAt: string }): Promise<void> {
  await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME(), Key: stateKey(mode, pass),
    UpdateExpression: 'SET #c = :c, hasMore = :h, counters = :n, leaseExpiresAt = :exp',
    ConditionExpression: 'lease = :token',
    ExpressionAttributeNames: { '#c': 'cursor' },
    ExpressionAttributeValues: { ':c': p.cursor ?? null, ':h': p.hasMore, ':n': p.counters, ':exp': p.leaseExpiresAt, ':token': leaseToken },
  }));
}

// Final page: clear cursor + release lease, record summary + completion. Also conditioned on `lease = :token`
// so a stale owner can't clear a lease another fire now holds.
export async function releaseLease(mode: SweepMode, pass: SweepPass, leaseToken: string, p: { lastSummary: Record<string, unknown> }): Promise<void> {
  await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME(), Key: stateKey(mode, pass),
    UpdateExpression: 'SET hasMore = :f, lastSummary = :s, lastCompletedAt = :now REMOVE #c, lease, leaseExpiresAt',
    ConditionExpression: 'lease = :token',
    ExpressionAttributeNames: { '#c': 'cursor' },
    ExpressionAttributeValues: { ':f': false, ':s': p.lastSummary, ':now': new Date().toISOString(), ':token': leaseToken },
  }));
}

// Release ONLY the lease fields, PRESERVING the durable cursor (used by the analytics rollup, whose
// watermark must survive between runs — unlike sweep passes, which reset their cursor on completion).
export async function releaseLeaseKeepCursor(mode: SweepMode, pass: SweepPass, leaseToken: string, p: { lastSummary: Record<string, unknown> }): Promise<void> {
  await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME(), Key: stateKey(mode, pass),
    UpdateExpression: 'SET hasMore = :f, lastSummary = :s, lastCompletedAt = :now REMOVE lease, leaseExpiresAt',
    ConditionExpression: 'lease = :token',
    ExpressionAttributeValues: { ':f': false, ':s': p.lastSummary, ':now': new Date().toISOString(), ':token': leaseToken },
  }));
}
