// amplify/lib/rfq/effectTransitions.test.ts
// NOTE: buildEffectClaimItems / buildEmail*Items return an `UpdateCommand`, whose params
// live on `.input` (that is what fakeDdb.send reads). Assert on `cmd.input.*`, never
// `cmd.Update` (undefined on a command). buildEffectCompletionItems is different — it
// returns raw TransactItem[] (`{ Update: {...} }`), so Task 9 correctly uses `items[0].Update`.
import { describe, it, expect } from 'vitest';
import { buildEffectClaimItems } from './effectTransitions';

const BASE = {
  tableName: 'T', rfqId: 'rfq-1', effect: 'org-upsert' as const,
  owner: 'worker-A', leaseMs: 30000, now: '2026-07-18T00:00:00.000Z',
};

describe('buildEffectClaimItems — fresh', () => {
  it('claims a pending effect, setting processing + lease + bumped version', () => {
    const cmd = buildEffectClaimItems({ ...BASE, from: 'pending', expectedVersion: 0 });
    expect(cmd.input.Key).toEqual({ PK: 'RFQ#rfq-1', SK: 'OUTBOX#org-upsert' });
    expect(cmd.input.ConditionExpression)
      .toBe('attribute_exists(PK) AND #status = :pending AND #version = :ev');
    expect(cmd.input.UpdateExpression)
      .toBe('SET #status = :processing, leaseOwner = :owner, leaseExpiresAt = :exp, #version = :nv, claimedAt = :now ADD attempts :one');
    expect(cmd.input.ExpressionAttributeNames).toEqual({ '#status': 'status', '#version': 'version' });
    expect(cmd.input.ExpressionAttributeValues).toMatchObject({
      ':pending': 'pending', ':ev': 0, ':processing': 'processing', ':owner': 'worker-A',
      ':exp': Date.parse('2026-07-18T00:00:00.000Z') + 30000, ':nv': 1, ':now': '2026-07-18T00:00:00.000Z', ':one': 1,
    });
  });
});

describe('buildEffectClaimItems — expired-lease re-claim', () => {
  it('re-claims a stale processing effect fenced on the prior version', () => {
    const cmd = buildEffectClaimItems({ ...BASE, from: 'expired-lease', expectedVersion: 1 });
    expect(cmd.input.ConditionExpression)
      .toBe('#status = :processing AND leaseExpiresAt < :nowMs AND #version = :ev');
    expect(cmd.input.ExpressionAttributeValues).toMatchObject({
      ':processing': 'processing', ':nowMs': Date.parse('2026-07-18T00:00:00.000Z'), ':ev': 1, ':nv': 2,
    });
  });
});
