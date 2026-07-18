// amplify/lib/rfq/outboxEffects.test.ts
import { describe, it, expect } from 'vitest';
import {
  EFFECT_SUCCESSORS, submitRootEffects, buildOutboxEffectItem, type OutboxEffectName,
} from './outboxEffects';

describe('EFFECT_SUCCESSORS', () => {
  it('encodes the true two-branch DAG', () => {
    expect(EFFECT_SUCCESSORS['org-upsert']).toEqual(['visitor-bridge', 'crm-emit']);
    expect(EFFECT_SUCCESSORS['attachment-move']).toEqual(['confirmation-email', 'internal-email']);
    for (const leaf of ['visitor-bridge', 'crm-emit', 'confirmation-email', 'internal-email'] as OutboxEffectName[]) {
      expect(EFFECT_SUCCESSORS[leaf]).toEqual([]);
    }
  });

  it('is frozen (not caller-mutable)', () => {
    expect(Object.isFrozen(EFFECT_SUCCESSORS)).toBe(true);
    expect(Object.isFrozen(EFFECT_SUCCESSORS['org-upsert'])).toBe(true);
  });

  it('has no fan-in: every effect has at most one parent', () => {
    const parents = new Map<string, number>();
    for (const succs of Object.values(EFFECT_SUCCESSORS)) for (const s of succs) parents.set(s, (parents.get(s) ?? 0) + 1);
    for (const c of parents.values()) expect(c).toBe(1);
  });
});

describe('submitRootEffects', () => {
  it('includes attachment-move when attachments are present', () => {
    expect(submitRootEffects(true)).toEqual(['org-upsert', 'attachment-move']);
  });
  it('promotes emails to roots with no attachments', () => {
    expect(submitRootEffects(false)).toEqual(['org-upsert', 'confirmation-email', 'internal-email']);
  });
});

describe('buildOutboxEffectItem', () => {
  it('builds a pending effect item with control fields and graph successors', () => {
    expect(buildOutboxEffectItem({ rfqId: 'rfq-1', effect: 'org-upsert', now: '2026-07-18T00:00:00.000Z' }))
      .toEqual({
        PK: 'RFQ#rfq-1', SK: 'OUTBOX#org-upsert', effect: 'org-upsert', status: 'pending',
        successors: ['visitor-bridge', 'crm-emit'], version: 0, attempts: 0,
        leaseOwner: null, leaseExpiresAt: null, createdAt: '2026-07-18T00:00:00.000Z',
      });
  });

  it('attaches a durable input only for attachment-move', () => {
    const item = buildOutboxEffectItem({
      rfqId: 'rfq-1', effect: 'attachment-move', now: '2026-07-18T00:00:00.000Z',
      input: { tempKeys: ['temp/rfq/aaaaaaaaaaaaaaaa/file.pdf'] },
    });
    expect(item.input).toEqual({ tempKeys: ['temp/rfq/aaaaaaaaaaaaaaaa/file.pdf'] });
    expect(item.successors).toEqual(['confirmation-email', 'internal-email']);
  });

  it('copies successors (not a shared reference to the frozen graph)', () => {
    const item = buildOutboxEffectItem({
      rfqId: 'rfq-1', effect: 'attachment-move', now: 'n',
      input: { tempKeys: ['temp/rfq/aaaaaaaaaaaaaaaa/f.pdf'] },
    });
    expect(item.successors).not.toBe(EFFECT_SUCCESSORS['attachment-move']);
  });

  it('rejects input on a non-attachment effect', () => {
    expect(() => buildOutboxEffectItem({
      rfqId: 'rfq-1', effect: 'org-upsert', now: 'n',
      input: { tempKeys: ['temp/rfq/aaaaaaaaaaaaaaaa/f.pdf'] } as never,
    })).toThrow(/only valid for attachment-move/);
  });

  it('requires non-empty, shape-valid tempKeys for attachment-move', () => {
    expect(() => buildOutboxEffectItem({ rfqId: 'rfq-1', effect: 'attachment-move', now: 'n' }))
      .toThrow(/non-empty tempKeys/);
    expect(() => buildOutboxEffectItem({
      rfqId: 'rfq-1', effect: 'attachment-move', now: 'n', input: { tempKeys: [] },
    })).toThrow(/non-empty tempKeys/);
    expect(() => buildOutboxEffectItem({
      rfqId: 'rfq-1', effect: 'attachment-move', now: 'n', input: { tempKeys: ['rfqs/rfq-1/evil.pdf'] },
    })).toThrow(/invalid temp attachment key/);
  });
});
