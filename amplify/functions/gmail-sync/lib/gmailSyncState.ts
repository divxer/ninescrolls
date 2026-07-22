import crypto from 'node:crypto';
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from './dynamodb';

// Fenced per-mailbox sync state (spec §2/§4) — PATTERNED after crm-api's sweepState (which is
// crm-api-local + CRM_SWEEP-hardcoded, so not importable). One atomic JSON item; every write fenced.
export interface GmailSyncState {
  phase?: 'backfill' | 'incremental';
  historyId?: string | null;
  anchorHistoryId?: string | null; pageToken?: string | null; window?: string | null; configId?: string | null;
  lease?: string; leaseExpiresAt?: number;   // epoch ms
  lastRunAt?: number; lastSummary?: Record<string, unknown> | null;
}

export const stateKey = (mailbox: string) => ({ PK: `GMAIL_SYNC#${mailbox}`, SK: 'STATE' });

export function isNewerHistoryId(candidate: string, stored: string | null | undefined): boolean {
  if (!stored) return true;
  return BigInt(candidate) > BigInt(stored);     // uint64-safe; string compare would be lexicographic
}

export async function readState(mailbox: string): Promise<GmailSyncState> {
  // plan-review fix: always strongly-consistent — the read happens right after acquireLease and
  // must see the previous holder's final fenced write, not an eventually-consistent ghost.
  const res = await docClient.send(new GetCommand({ TableName: TABLE_NAME(), Key: stateKey(mailbox), ConsistentRead: true }));
  return (res.Item as GmailSyncState | undefined) ?? {};
}

export async function acquireLease(mailbox: string, lambdaTimeoutSec: number, nowMs: number): Promise<string | null> {
  const token = crypto.randomUUID();
  const exp = nowMs + Math.max(2 * lambdaTimeoutSec, 300) * 1000;
  try {
    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME(), Key: stateKey(mailbox),
      UpdateExpression: 'SET lease = :tok, leaseExpiresAt = :exp, lastRunAt = :now',
      ConditionExpression: 'attribute_not_exists(lease) OR leaseExpiresAt < :now',
      ExpressionAttributeValues: { ':tok': token, ':exp': exp, ':now': nowMs },
    }));
    return token;
  } catch (err) {
    if ((err as { name?: string }).name === 'ConditionalCheckFailedException') return null;
    throw err;
  }
}

// Every progress write: token AND unexpired. CCFE ⇒ {lost:true} ⇒ caller must abort the run.
// NO lease renewal/heartbeat exists — deliberately (plan-review): the lease is max(2×timeout,300s)=300s,
// strictly greater than the 120s max invocation, so a live run can never outlast its own lease.
// If the Lambda timeout is ever raised, this arithmetic MUST be revisited.
export async function writeStateFenced(mailbox: string, token: string, nowMs: number, fields: Partial<GmailSyncState>): Promise<{ lost: boolean }> {
  const names: Record<string, string> = {}; const values: Record<string, unknown> = { ':tok': token, ':now': nowMs };
  const sets = Object.entries(fields).map(([k, v], i) => { names[`#f${i}`] = k; values[`:f${i}`] = v ?? null; return `#f${i} = :f${i}`; });
  try {
    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME(), Key: stateKey(mailbox),
      UpdateExpression: `SET ${sets.join(', ')}`,
      ConditionExpression: 'lease = :tok AND leaseExpiresAt > :now',
      ExpressionAttributeNames: names, ExpressionAttributeValues: values,
    }));
    return { lost: false };
  } catch (err) {
    if ((err as { name?: string }).name === 'ConditionalCheckFailedException') return { lost: true };
    throw err;
  }
}

// Release ALSO requires an unexpired lease (R6/blocker-3); expired cleanup belongs to the next acquire.
export async function releaseLease(mailbox: string, token: string, nowMs: number, fields: Partial<GmailSyncState>): Promise<{ lost: boolean }> {
  const names: Record<string, string> = {}; const values: Record<string, unknown> = { ':tok': token, ':now': nowMs };
  const sets = Object.entries({ ...fields, lastRunAt: nowMs }).map(([k, v], i) => { names[`#f${i}`] = k; values[`:f${i}`] = v ?? null; return `#f${i} = :f${i}`; });
  try {
    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME(), Key: stateKey(mailbox),
      UpdateExpression: `SET ${sets.join(', ')} REMOVE lease, leaseExpiresAt`,
      ConditionExpression: 'lease = :tok AND leaseExpiresAt > :now',
      ExpressionAttributeNames: names, ExpressionAttributeValues: values,
    }));
    return { lost: false };
  } catch (err) {
    if ((err as { name?: string }).name === 'ConditionalCheckFailedException') return { lost: true };
    throw err;
  }
}
