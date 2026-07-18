import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import { buildDraftItem, DRAFT_TTL_DAYS, createDraft, getDraft, updateDraft } from './draftStore';
import { encodeCredential } from './draftCredentials';
import { normalizeDraftPatch, draftPatchRequestSchema } from './draftContract';
import { FakeDdb } from '../../functions/price-api/lib/testing/fakeDdb';

const INPUT = {
  name: 'Jane Researcher',
  email: 'jane@stanford.edu',
  institution: 'Stanford University',
  equipmentCategory: 'Probe-Station' as const,
  applicationDescription: 'Wafer probing for silicon photonics device characterization.',
  quantity: 2,
};
const NOW = '2026-07-15T00:00:00.000Z';

const pepper = crypto.randomBytes(32);
const deps = (ddb: FakeDdb, over: Partial<{ now: () => string }> = {}) => ({
  send: (c: unknown) => ddb.send(c as never),
  tableName: 't',
  pepper,
  keyVersion: 1,
  resolvePepper: (v: number) => (v === 1 ? pepper : undefined),
  now: () => NOW,
  ...over,
});
const patch = (raw: Record<string, unknown>) =>
  normalizeDraftPatch(draftPatchRequestSchema.parse(raw));

describe('buildDraftItem', () => {
  it('assembles a draft META item with status, keys, versions and expiry', () => {
    const item = buildDraftItem({
      rfqId: 'abc123', draftTokenHash: 'v1:deadbeef', input: INPUT, now: NOW,
    });
    expect(item.PK).toBe('RFQ#abc123');
    expect(item.SK).toBe('META');
    expect(item.status).toBe('draft');
    expect(item.draftVersion).toBe(1);
    expect(item.createdAt).toBe(NOW);
    expect(item.lastActivityAt).toBe(NOW);
    expect(item.GSI1PK).toBe('RFQ_STATUS#draft');
    expect(item.GSI1SK).toBe(`${NOW}#abc123`);
    expect(item.expiresAt).toBe('2026-08-14T00:00:00.000Z');
    expect(item.TTL).toBe(Math.floor(Date.parse(item.expiresAt as string) / 1000));
    expect(item.name).toBe('Jane Researcher');
    expect(item.draftTokenHash).toBe('v1:deadbeef');
  });

  it('never stores a non-whitelisted attribute', () => {
    const item = buildDraftItem({ rfqId: 'abc123', draftTokenHash: 'v1:x', input: { ...INPUT }, now: NOW });
    for (const banned of ['shippingAddress', 'attachmentKeys', 'keySpecifications', 'turnstileToken']) {
      expect(item).not.toHaveProperty(banned);
    }
    expect(DRAFT_TTL_DAYS).toBe(30);
  });
});

describe('createDraft', () => {
  it('creates one record and returns a usable id + token', async () => {
    const ddb = new FakeDdb();
    const nonce = encodeCredential(crypto.randomBytes(32));
    const r = await createDraft(deps(ddb), nonce, INPUT);
    expect(r.rfqId).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(r.draftToken).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(r.draftVersion).toBe(1);
    expect([...ddb.store.values()]).toHaveLength(1);
  });

  it('is idempotent: the same nonce returns the same id/token and leaves one record', async () => {
    const ddb = new FakeDdb();
    const nonce = encodeCredential(crypto.randomBytes(32));
    const a = await createDraft(deps(ddb), nonce, INPUT);
    const b = await createDraft(deps(ddb), nonce, INPUT);
    expect(b.rfqId).toBe(a.rfqId);
    expect(b.draftToken).toBe(a.draftToken);
    expect([...ddb.store.values()]).toHaveLength(1);
  });
});

describe('getDraft', () => {
  it('returns whitelisted fields for the authenticated live draft', async () => {
    const ddb = new FakeDdb();
    const nonce = encodeCredential(crypto.randomBytes(32));
    const created = await createDraft(deps(ddb), nonce, INPUT);
    const r = await getDraft(deps(ddb), created.rfqId, created.draftToken);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.draftVersion).toBe(1);
      expect(r.fields.email).toBe('jane@stanford.edu');
      expect(r.fields).not.toHaveProperty('draftTokenHash');
      expect(r.fields).not.toHaveProperty('PK');
    }
  });

  it('returns DraftUnavailable for a wrong token without revealing existence', async () => {
    const ddb = new FakeDdb();
    const nonce = encodeCredential(crypto.randomBytes(32));
    const created = await createDraft(deps(ddb), nonce, INPUT);
    const wrong = encodeCredential(crypto.randomBytes(32));
    expect((await getDraft(deps(ddb), created.rfqId, wrong)).ok).toBe(false);
  });

  it('returns DraftUnavailable for a missing record', async () => {
    const ddb = new FakeDdb();
    const anyToken = encodeCredential(crypto.randomBytes(32));
    expect((await getDraft(deps(ddb), 'does-not-exist', anyToken)).ok).toBe(false);
  });

  it('returns DraftUnavailable for an expired draft', async () => {
    const ddb = new FakeDdb();
    const nonce = encodeCredential(crypto.randomBytes(32));
    const created = await createDraft(deps(ddb), nonce, INPUT);
    const future = deps(ddb, { now: () => '2026-10-01T00:00:00.000Z' });
    expect((await getDraft(future, created.rfqId, created.draftToken)).ok).toBe(false);
  });
});

describe('updateDraft', () => {
  it('applies a set, bumps version + activity, returns the new version', async () => {
    const ddb = new FakeDdb();
    const nonce = encodeCredential(crypto.randomBytes(32));
    const c = await createDraft(deps(ddb), nonce, INPUT);
    const r = await updateDraft(deps(ddb), c.rfqId, c.draftToken, 1, patch({ quantity: 9 }));
    expect(r.status).toBe('updated');
    if (r.status === 'updated') {
      expect(r.draftVersion).toBe(2);
      expect(r.fields.quantity).toBe(9);
    }
  });

  it('removes a cleared optional field', async () => {
    const ddb = new FakeDdb();
    const nonce = encodeCredential(crypto.randomBytes(32));
    const c = await createDraft(deps(ddb), nonce, { ...INPUT, department: 'Physics' });
    const r = await updateDraft(deps(ddb), c.rfqId, c.draftToken, 1, patch({ department: '' }));
    expect(r.status).toBe('updated');
    if (r.status === 'updated') expect(r.fields).not.toHaveProperty('department');
  });

  it('detects a no-op: no write, no version bump', async () => {
    const ddb = new FakeDdb();
    const nonce = encodeCredential(crypto.randomBytes(32));
    const c = await createDraft(deps(ddb), nonce, INPUT);
    const r = await updateDraft(deps(ddb), c.rfqId, c.draftToken, 1, patch({ quantity: 2 }));
    expect(r.status).toBe('noop');
    const after = await getDraft(deps(ddb), c.rfqId, c.draftToken);
    if (after.ok) expect(after.draftVersion).toBe(1);
  });

  it('returns a version conflict with the current draft on a stale version', async () => {
    const ddb = new FakeDdb();
    const nonce = encodeCredential(crypto.randomBytes(32));
    const c = await createDraft(deps(ddb), nonce, INPUT);
    await updateDraft(deps(ddb), c.rfqId, c.draftToken, 1, patch({ quantity: 4 }));
    const stale = await updateDraft(deps(ddb), c.rfqId, c.draftToken, 1, patch({ quantity: 5 }));
    expect(stale.status).toBe('conflict');
    if (stale.status === 'conflict') {
      expect(stale.draftVersion).toBe(2);
      expect(stale.fields.quantity).toBe(4);
    }
  });

  it('returns unavailable for a wrong token', async () => {
    const ddb = new FakeDdb();
    const nonce = encodeCredential(crypto.randomBytes(32));
    const c = await createDraft(deps(ddb), nonce, INPUT);
    const wrong = encodeCredential(crypto.randomBytes(32));
    expect((await updateDraft(deps(ddb), c.rfqId, wrong, 1, patch({ quantity: 3 }))).status)
      .toBe('unavailable');
  });
});
