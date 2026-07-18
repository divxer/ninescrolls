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

import { buildEffectCompletionItems } from './effectTransitions';

const CBASE = {
  tableName: 'T', rfqId: 'rfq-1', owner: 'worker-A', claimedVersion: 1, now: '2026-07-18T00:01:00.000Z',
};

describe('buildEffectCompletionItems', () => {
  it('marks org done, backfills matchedOrgId/GSI2PK, and creates visitor+crm successors', () => {
    const items = buildEffectCompletionItems({
      ...CBASE, effect: 'org-upsert', result: { matchedOrgId: 'org-123' },
    });
    expect(items[0].Update!.ConditionExpression)
      .toBe('#status = :processing AND leaseOwner = :owner AND #version = :cv');
    expect(items[0].Update!.UpdateExpression)
      .toBe('SET #status = :done, #result = :result, completedAt = :now, #version = :nv');
    expect(items[0].Update!.ExpressionAttributeNames)
      .toEqual({ '#status': 'status', '#version': 'version', '#result': 'result' });
    expect(items[0].Update!.Key).toEqual({ PK: 'RFQ#rfq-1', SK: 'OUTBOX#org-upsert' });
    expect(items[1].Update!.Key).toEqual({ PK: 'RFQ#rfq-1', SK: 'META' });
    expect(items[1].Update!.UpdateExpression).toBe('SET matchedOrgId = :id, GSI2PK = :gsi2');
    expect(items[1].Update!.ExpressionAttributeValues).toMatchObject({ ':id': 'org-123', ':gsi2': 'ORG#org-123' });
    expect(items.slice(2).map((i) => i.Put!.Item!.SK)).toEqual(['OUTBOX#visitor-bridge', 'OUTBOX#crm-emit']);
    for (const i of items.slice(2)) expect(i.Put!.ConditionExpression).toBe('attribute_not_exists(PK)');
  });

  it('skips the RFQ backfill when org matchedOrgId is null but still creates successors', () => {
    const items = buildEffectCompletionItems({ ...CBASE, effect: 'org-upsert', result: { matchedOrgId: null } });
    expect(items.some((i) => i.Update && (i.Update.Key as { SK: string }).SK === 'META')).toBe(false);
    expect(items.slice(1).map((i) => i.Put!.Item!.SK)).toEqual(['OUTBOX#visitor-bridge', 'OUTBOX#crm-emit']);
  });

  it('marks attachment-move done, backfills attachmentKeys (moved only), creates email successors', () => {
    const items = buildEffectCompletionItems({
      ...CBASE, effect: 'attachment-move', result: { movedKeys: ['rfqs/rfq-1/a.pdf'], failedKeys: ['temp/rfq/aaaaaaaaaaaaaaaa/b.pdf'] },
    });
    expect(items[0].Update!.UpdateExpression).toContain('#result = :result');
    const backfill = items.find((i) => i.Update && (i.Update.Key as { SK: string }).SK === 'META')!;
    expect(backfill.Update!.UpdateExpression).toBe('SET attachmentKeys = :keys');
    expect(backfill.Update!.ExpressionAttributeValues).toMatchObject({ ':keys': ['rfqs/rfq-1/a.pdf'] });
    expect(items.filter((i) => i.Put).map((i) => i.Put!.Item!.SK))
      .toEqual(['OUTBOX#confirmation-email', 'OUTBOX#internal-email']);
  });

  it('marks a leaf effect (crm-emit) done with no backfill and no successors', () => {
    const items = buildEffectCompletionItems({ ...CBASE, effect: 'crm-emit', result: { accepted: true } });
    expect(items).toHaveLength(1);
    expect(items[0].Update!.Key).toEqual({ PK: 'RFQ#rfq-1', SK: 'OUTBOX#crm-emit' });
  });

  it('rejects an email effect — it must use the claim-before-send latch', () => {
    expect(() => buildEffectCompletionItems({
      ...CBASE, effect: 'confirmation-email' as never, result: { attemptedAt: 'x', outcome: 'accepted' } as never,
    })).toThrow(/latch/);
  });
});

import { buildEmailClaimItems, buildEmailFinalizeItems } from './effectTransitions';

describe('email claim-before-send latch', () => {
  it('claims pending→send-claimed conditioned only on pending (no lease-expiry re-claim)', () => {
    const cmd = buildEmailClaimItems({
      tableName: 'T', rfqId: 'rfq-1', effect: 'confirmation-email', owner: 'worker-A', now: '2026-07-18T00:00:00.000Z',
    });
    expect(cmd.input.Key).toEqual({ PK: 'RFQ#rfq-1', SK: 'OUTBOX#confirmation-email' });
    expect(cmd.input.ConditionExpression).toBe('#status = :pending');
    expect(cmd.input.UpdateExpression).toBe('SET #status = :claimed, claimedAt = :now, leaseOwner = :owner');
    expect(cmd.input.ExpressionAttributeValues).toMatchObject({
      ':pending': 'pending', ':claimed': 'send-claimed', ':owner': 'worker-A', ':now': '2026-07-18T00:00:00.000Z',
    });
  });

  it('finalizes send-claimed→done recording attemptedAt + outcome, fenced on owner', () => {
    const cmd = buildEmailFinalizeItems({
      tableName: 'T', rfqId: 'rfq-1', effect: 'internal-email', owner: 'worker-A',
      now: '2026-07-18T00:00:05.000Z', attemptedAt: '2026-07-18T00:00:05.000Z', outcome: 'failed',
    });
    expect(cmd.input.ConditionExpression).toBe('#status = :claimed AND leaseOwner = :owner');
    expect(cmd.input.UpdateExpression).toBe('SET #status = :done, #result = :result, completedAt = :now');
    expect(cmd.input.ExpressionAttributeValues).toMatchObject({
      ':claimed': 'send-claimed', ':owner': 'worker-A', ':done': 'done',
      ':result': { attemptedAt: '2026-07-18T00:00:05.000Z', outcome: 'failed' },
    });
  });
});

describe('buildEffectCompletionItems — runtime result validation (unknown from P4b-2)', () => {
  const base = { tableName: 'T', rfqId: 'rfq-1', owner: 'W', claimedVersion: 1, now: '2026-07-18T00:00:00.000Z' };

  it('rejects a malformed org result (empty matchedOrgId)', () => {
    expect(() => buildEffectCompletionItems({ ...base, effect: 'org-upsert', result: { matchedOrgId: '' } as never }))
      .toThrow(/matchedOrgId/);
  });

  it('rejects a crm result that is not accepted:true', () => {
    expect(() => buildEffectCompletionItems({ ...base, effect: 'crm-emit', result: { accepted: false } as never }))
      .toThrow(/accepted/);
  });

  it('rejects a visitor result with non-boolean fields', () => {
    expect(() => buildEffectCompletionItems({ ...base, effect: 'visitor-bridge', result: { created: 'yes', orgUpgraded: false } as never }))
      .toThrow(/created\/orgUpgraded/);
  });

  it('rejects attachment movedKeys with a wrong prefix or over the max', () => {
    expect(() => buildEffectCompletionItems({ ...base, effect: 'attachment-move',
      result: { movedKeys: ['temp/rfq/x/a.pdf'], failedKeys: [] } as never })).toThrow(/rfqs\//);
    expect(() => buildEffectCompletionItems({ ...base, effect: 'attachment-move',
      result: { movedKeys: ['rfqs/rfq-1/a', 'rfqs/rfq-1/b', 'rfqs/rfq-1/c', 'rfqs/rfq-1/d'], failedKeys: [] } as never }))
      .toThrow(/MAX_RFQ_ATTACHMENTS/);
  });

  it('rejects empty owner / negative version / non-ISO now', () => {
    expect(() => buildEffectCompletionItems({ ...base, owner: '', effect: 'crm-emit', result: { accepted: true } }))
      .toThrow(/owner/);
    expect(() => buildEffectCompletionItems({ ...base, claimedVersion: -1, effect: 'crm-emit', result: { accepted: true } }))
      .toThrow(/claimedVersion/);
    expect(() => buildEffectCompletionItems({ ...base, now: 'not-a-date', effect: 'crm-emit', result: { accepted: true } }))
      .toThrow(/now/);
  });
});

describe('buildEffectClaimItems — param validation', () => {
  const base = {
    tableName: 'T', rfqId: 'rfq-1', effect: 'org-upsert' as const, owner: 'W', leaseMs: 30000,
    now: '2026-07-18T00:00:00.000Z', from: 'pending' as const, expectedVersion: 0,
  };
  it('rejects empty owner, non-positive lease, negative version, non-ISO now', () => {
    expect(() => buildEffectClaimItems({ ...base, owner: '' })).toThrow(/owner/);
    expect(() => buildEffectClaimItems({ ...base, leaseMs: 0 })).toThrow(/leaseMs/);
    expect(() => buildEffectClaimItems({ ...base, expectedVersion: -1 })).toThrow(/expectedVersion/);
    expect(() => buildEffectClaimItems({ ...base, now: 'nope' })).toThrow(/now/);
  });

  it('rejects non-integer / over-cap lease, version at MAX_SAFE_INTEGER, and date-only now', () => {
    expect(() => buildEffectClaimItems({ ...base, leaseMs: 1.5 })).toThrow(/leaseMs/);
    expect(() => buildEffectClaimItems({ ...base, leaseMs: 60 * 60 * 1000 + 1 })).toThrow(/leaseMs/);
    expect(() => buildEffectClaimItems({ ...base, expectedVersion: Number.MAX_SAFE_INTEGER })).toThrow(/expectedVersion/);
    expect(() => buildEffectClaimItems({ ...base, now: '2026-07-18' })).toThrow(/now/); // Date.parse-ok but not strict ISO
  });
});

describe('parseCompletionResult (strict, fail-closed, normalizing)', () => {
  const base = { tableName: 'T', rfqId: 'rfq-1', owner: 'W', claimedVersion: 1, now: '2026-07-18T00:00:00.000Z' };

  it('rejects unexpected extra properties (exact field set only)', () => {
    expect(() => buildEffectCompletionItems({ ...base, effect: 'crm-emit', result: { accepted: true, unexpected: 'x' } as never }))
      .toThrow(/unexpected property/);
    expect(() => buildEffectCompletionItems({ ...base, effect: 'org-upsert', result: { matchedOrgId: 'o', extra: 1 } as never }))
      .toThrow(/unexpected property/);
  });

  it('rejects a non-plain object (array or prototype-bearing) even if it carries the field', () => {
    const arrayLike = Object.assign([], { accepted: true });
    expect(() => buildEffectCompletionItems({ ...base, effect: 'crm-emit', result: arrayLike as never })).toThrow(/plain object/);
    expect(() => buildEffectCompletionItems({ ...base, effect: 'crm-emit', result: Object.create({ accepted: true }) as never }))
      .toThrow(/plain object|accepted/);
  });

  it('rejects empty-suffix / nested-path / control-char destination keys', () => {
    for (const bad of ['rfqs/rfq-1/', 'rfqs/rfq-1/sub/dir.pdf', 'rfqs/rfq-1/a b']) {
      expect(() => buildEffectCompletionItems({ ...base, effect: 'attachment-move', result: { movedKeys: [bad], failedKeys: [] } as never }))
        .toThrow(/rfqs\/rfq-1/);
    }
  });

  it('rejects duplicate / overlapping attachment keys', () => {
    expect(() => buildEffectCompletionItems({ ...base, effect: 'attachment-move',
      result: { movedKeys: ['rfqs/rfq-1/a.pdf', 'rfqs/rfq-1/a.pdf'], failedKeys: [] } as never })).toThrow(/unique|disjoint/i);
  });

  it('rejects failedKeys that are not valid temp/rfq keys', () => {
    expect(() => buildEffectCompletionItems({ ...base, effect: 'attachment-move',
      result: { movedKeys: [], failedKeys: ['not-a-temp-key'] } as never })).toThrow(/temp\/rfq/);
  });

  it('normalizes: a post-build mutation of the caller result cannot reach the transaction or backfill', () => {
    const result = { movedKeys: ['rfqs/rfq-1/a.pdf'], failedKeys: [] as string[] };
    const items = buildEffectCompletionItems({ ...base, effect: 'attachment-move', result });
    result.movedKeys.push('rfqs/rfq-1/injected.pdf'); // mutate AFTER build
    const persisted = items[0].Update!.ExpressionAttributeValues![':result'] as { movedKeys: string[] };
    const backfill = items.find((i) => i.Update && (i.Update.Key as { SK: string }).SK === 'META')!;
    expect(persisted.movedKeys).toEqual(['rfqs/rfq-1/a.pdf']);
    expect(backfill.Update!.ExpressionAttributeValues![':keys']).toEqual(['rfqs/rfq-1/a.pdf']);
    expect(persisted.movedKeys).not.toBe(result.movedKeys);
  });
});
