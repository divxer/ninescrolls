// amplify/lib/rfq/submitLifecycle.integration.test.ts
import { describe, it, expect } from 'vitest';
import { TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { FakeDdb } from '../../functions/price-api/lib/testing/fakeDdb';
import { buildSubmitTransaction, type SubmitTransactionParams } from './submitTransaction';
import { buildDraftItem } from './draftStore';
import {
  buildEffectClaimItems, buildEffectCompletionItems, buildEmailClaimItems, buildEmailFinalizeItems,
} from './effectTransitions';
import type { PendingRfqSource, PendingRfqMeta } from './pendingRfq';

const SOURCE: PendingRfqSource = {
  name: 'Ada', email: 'ada@lab.edu', institution: 'Lab', equipmentCategory: 'RIE',
  applicationDescription: 'A valid application description.', quantity: 1,
};
const RFQ_ID = 'draftId_base64url_example_0123456789ABCDEFabcd';
const META: PendingRfqMeta = {
  rfqId: RFQ_ID, submittedAt: '2026-07-18T09:30:00.000Z', ipHash: 'a'.repeat(64), referenceNumber: 'RFQ-20260718-ABCD',
};
const STORED_HASH = 'v1:' + 'a'.repeat(64);
const SUBMIT_KEY = Buffer.alloc(32, 7).toString('base64url');

function directParams(over: Partial<Extract<SubmitTransactionParams, { kind: 'direct' }>> = {}): SubmitTransactionParams {
  return {
    kind: 'direct', tableName: 'T', source: SOURCE, meta: META, tempKeys: [],
    receipt: { receiptId: 'SUBMIT_RECEIPT#r', binding: 'b'.repeat(64), status: 200 },
    submitKeyB64: SUBMIT_KEY, now: '2026-07-18T09:30:00.000Z', ...over,
  };
}
function upgradeParams(over: Partial<Extract<SubmitTransactionParams, { kind: 'draft-upgrade' }>> = {}): SubmitTransactionParams {
  return {
    kind: 'draft-upgrade', tableName: 'T', source: SOURCE, meta: META, tempKeys: [],
    receipt: { receiptId: 'SUBMIT_RECEIPT#r', binding: 'b'.repeat(64), status: 200 },
    submitKeyB64: SUBMIT_KEY, now: '2026-07-18T09:30:00.000Z',
    draftPrecondition: { storedHash: STORED_HASH, expectedVersion: 1 }, ...over,
  };
}
const submit = (f: FakeDdb, p: SubmitTransactionParams) => f.send(new TransactWriteCommand(buildSubmitTransaction(p)));

function seedDraftWithStaleFields(f: FakeDdb) {
  const item = buildDraftItem({
    rfqId: RFQ_ID, draftTokenHash: STORED_HASH,
    input: {
      name: 'STALE NAME', email: 'stale@lab.edu', institution: 'STALE INST',
      equipmentCategory: 'ICP', applicationDescription: 'stale application description', quantity: 9,
    },
    now: '2026-07-18T00:00:00.000Z',
  }) as Record<string, unknown>;
  item.specificModel = 'STALE MODEL'; // stale optional field not in the submission
  f.seed([item as never]);
}

describe('submit — direct', () => {
  it('commits pending + receipt + email roots (no attachments)', async () => {
    const f = new FakeDdb();
    await submit(f, directParams());
    expect(f.store.get(`RFQ#${RFQ_ID}|META`)!.status).toBe('pending');
    expect(f.store.get('SUBMIT_RECEIPT#r|META')).toBeTruthy();
    expect(f.store.get(`RFQ#${RFQ_ID}|OUTBOX#confirmation-email`)!.status).toBe('pending');
  });

  it('cancels a duplicate receipt (idempotency barrier)', async () => {
    const f = new FakeDdb();
    await submit(f, directParams());
    await expect(submit(f, directParams({ meta: { ...META, rfqId: 'other' } })))
      .rejects.toMatchObject({ name: 'TransactionCanceledException' });
    expect(f.store.get('RFQ#other|META')).toBeUndefined();
  });
});

describe('submit — draft upgrade', () => {
  it('replaces the draft, erasing ALL draft-only + stale optional fields', async () => {
    const f = new FakeDdb();
    seedDraftWithStaleFields(f);
    await submit(f, upgradeParams());
    const up = f.store.get(`RFQ#${RFQ_ID}|META`)!;
    expect(up.status).toBe('pending');
    for (const k of ['draftTokenHash', 'draftVersion', 'lastActivityAt', 'expiresAt', 'TTL', 'createdAt', 'specificModel']) {
      // TTL is intentionally 0 on the pending item, not the draft epoch; assert it is the pending value:
      if (k === 'TTL') { expect(up.TTL).toBe(0); continue; }
      expect(k in up).toBe(false);
    }
    expect(up.GSI1PK).toBe('RFQ_STATUS#pending');
    expect(up.GSI1SK).toBe(`${META.submittedAt}#${RFQ_ID}`);
    expect(up.name).toBe('Ada'); // authoritative from submission, not the stale draft
    expect(up.institution).toBe('Lab');
  });

  it('upgrade output equals direct output for the same source + rfqId (parity)', async () => {
    const a = new FakeDdb(); seedDraftWithStaleFields(a); await submit(a, upgradeParams());
    const b = new FakeDdb(); await submit(b, directParams());
    expect(a.store.get(`RFQ#${RFQ_ID}|META`)).toEqual(b.store.get(`RFQ#${RFQ_ID}|META`));
  });

  it('cancels on version drift, wrong hash, expiry, and missing draft', async () => {
    for (const [mutate] of [
      [() => upgradeParams({ draftPrecondition: { storedHash: STORED_HASH, expectedVersion: 2 } })],
      [() => upgradeParams({ draftPrecondition: { storedHash: 'v1:' + 'b'.repeat(64), expectedVersion: 1 } })],
      [() => upgradeParams({ now: '2099-01-01T00:00:00.000Z' })],
    ] as Array<[() => SubmitTransactionParams]>) {
      const f = new FakeDdb(); seedDraftWithStaleFields(f);
      await expect(submit(f, mutate())).rejects.toMatchObject({ name: 'TransactionCanceledException' });
      expect(f.store.get(`RFQ#${RFQ_ID}|META`)!.status).toBe('draft');
    }
    const empty = new FakeDdb();
    await expect(submit(empty, upgradeParams())).rejects.toMatchObject({ name: 'TransactionCanceledException' });
  });
});

describe('effect lifecycle — org branch', () => {
  it('claim → complete backfills matchedOrgId and creates visitor+crm successors', async () => {
    const f = new FakeDdb();
    await submit(f, directParams());
    await f.send(buildEffectClaimItems({
      tableName: 'T', rfqId: RFQ_ID, effect: 'org-upsert', owner: 'W', leaseMs: 30000,
      now: '2026-07-18T09:30:10.000Z', from: 'pending', expectedVersion: 0,
    }));
    expect(f.store.get(`RFQ#${RFQ_ID}|OUTBOX#org-upsert`)!.status).toBe('processing');
    await f.send(new TransactWriteCommand({
      TransactItems: buildEffectCompletionItems({
        tableName: 'T', rfqId: RFQ_ID, owner: 'W', claimedVersion: 1, now: '2026-07-18T09:30:11.000Z',
        effect: 'org-upsert', result: { matchedOrgId: 'org-123' },
      }),
    }));
    expect(f.store.get(`RFQ#${RFQ_ID}|OUTBOX#org-upsert`)!.status).toBe('done');
    expect(f.store.get(`RFQ#${RFQ_ID}|META`)!.matchedOrgId).toBe('org-123');
    expect(f.store.get(`RFQ#${RFQ_ID}|META`)!.GSI2PK).toBe('ORG#org-123');
    expect(f.store.get(`RFQ#${RFQ_ID}|OUTBOX#visitor-bridge`)!.status).toBe('pending');
    expect(f.store.get(`RFQ#${RFQ_ID}|OUTBOX#crm-emit`)!.status).toBe('pending');
  });

  it('a replayed completion (stale claimedVersion) cancels — no double successors', async () => {
    const f = new FakeDdb();
    await submit(f, directParams());
    await f.send(buildEffectClaimItems({
      tableName: 'T', rfqId: RFQ_ID, effect: 'org-upsert', owner: 'W', leaseMs: 30000,
      now: '2026-07-18T09:30:10.000Z', from: 'pending', expectedVersion: 0,
    }));
    const complete = () => new TransactWriteCommand({
      TransactItems: buildEffectCompletionItems({
        tableName: 'T', rfqId: RFQ_ID, owner: 'W', claimedVersion: 1, now: '2026-07-18T09:30:11.000Z',
        effect: 'org-upsert', result: { matchedOrgId: 'org-123' },
      }),
    });
    await f.send(complete());
    await expect(f.send(complete())).rejects.toMatchObject({ name: 'TransactionCanceledException' });
  });

  it('fences a stale worker after an expired-lease re-claim', async () => {
    const f = new FakeDdb();
    await submit(f, directParams());
    // Worker A claims (v0→v1) with a short lease.
    await f.send(buildEffectClaimItems({
      tableName: 'T', rfqId: RFQ_ID, effect: 'org-upsert', owner: 'A', leaseMs: 1000,
      now: '2026-07-18T09:30:10.000Z', from: 'pending', expectedVersion: 0,
    }));
    // Worker B re-claims the expired lease (v1→v2).
    await f.send(buildEffectClaimItems({
      tableName: 'T', rfqId: RFQ_ID, effect: 'org-upsert', owner: 'B', leaseMs: 30000,
      now: '2026-07-18T09:31:00.000Z', from: 'expired-lease', expectedVersion: 1,
    }));
    expect(f.store.get(`RFQ#${RFQ_ID}|OUTBOX#org-upsert`)!.leaseOwner).toBe('B');
    // Worker A (holding claimedVersion 1) now completes → cancels.
    await expect(f.send(new TransactWriteCommand({
      TransactItems: buildEffectCompletionItems({
        tableName: 'T', rfqId: RFQ_ID, owner: 'A', claimedVersion: 1, now: '2026-07-18T09:31:05.000Z',
        effect: 'org-upsert', result: { matchedOrgId: 'org-123' },
      }),
    }))).rejects.toMatchObject({ name: 'TransactionCanceledException' });
  });
});

describe('effect lifecycle — recovery scenarios', () => {
  it('a re-issued fresh claim after a committed claim fails (worker reconciles, no double-claim)', async () => {
    const f = new FakeDdb();
    await submit(f, directParams());
    const freshClaim = () => buildEffectClaimItems({
      tableName: 'T', rfqId: RFQ_ID, effect: 'org-upsert', owner: 'W', leaseMs: 30000,
      now: '2026-07-18T09:30:10.000Z', from: 'pending', expectedVersion: 0,
    });
    await f.send(freshClaim());
    // The commit ack was lost; replaying the identical fresh claim must fail — status is 'processing'.
    await expect(f.send(freshClaim())).rejects.toMatchObject({ name: 'ConditionalCheckFailedException' });
    expect(f.store.get(`RFQ#${RFQ_ID}|OUTBOX#org-upsert`)!.version).toBe(1); // not double-bumped
  });

  it('completion cancels all-or-nothing if a successor already exists (no partial backfill)', async () => {
    const f = new FakeDdb();
    await submit(f, directParams());
    await f.send(buildEffectClaimItems({
      tableName: 'T', rfqId: RFQ_ID, effect: 'org-upsert', owner: 'W', leaseMs: 30000,
      now: '2026-07-18T09:30:10.000Z', from: 'pending', expectedVersion: 0,
    }));
    // Anomalous pre-existing successor → the attribute_not_exists Put conflicts.
    f.seed([{ PK: `RFQ#${RFQ_ID}`, SK: 'OUTBOX#visitor-bridge', status: 'pending' } as never]);
    await expect(f.send(new TransactWriteCommand({
      TransactItems: buildEffectCompletionItems({
        tableName: 'T', rfqId: RFQ_ID, owner: 'W', claimedVersion: 1, now: '2026-07-18T09:30:11.000Z',
        effect: 'org-upsert', result: { matchedOrgId: 'org-123' },
      }),
    }))).rejects.toMatchObject({ name: 'TransactionCanceledException' });
    // All-or-nothing: org still processing, backfill NOT applied.
    expect(f.store.get(`RFQ#${RFQ_ID}|OUTBOX#org-upsert`)!.status).toBe('processing');
    expect('matchedOrgId' in f.store.get(`RFQ#${RFQ_ID}|META`)!).toBe(false);
  });
});

describe('effect lifecycle — attachment branch', () => {
  it('completes with partial failure: RFQ gets moved keys, effect result keeps failed keys, emails created', async () => {
    const f = new FakeDdb();
    await submit(f, directParams({ tempKeys: ['temp/rfq/aaaaaaaaaaaaaaaa/a.pdf', 'temp/rfq/bbbbbbbbbbbbbbbb/b.pdf'] }));
    expect(f.store.get(`RFQ#${RFQ_ID}|OUTBOX#attachment-move`)!.input)
      .toEqual({ tempKeys: ['temp/rfq/aaaaaaaaaaaaaaaa/a.pdf', 'temp/rfq/bbbbbbbbbbbbbbbb/b.pdf'] });
    await f.send(buildEffectClaimItems({
      tableName: 'T', rfqId: RFQ_ID, effect: 'attachment-move', owner: 'W', leaseMs: 30000,
      now: '2026-07-18T09:30:10.000Z', from: 'pending', expectedVersion: 0,
    }));
    await f.send(new TransactWriteCommand({
      TransactItems: buildEffectCompletionItems({
        tableName: 'T', rfqId: RFQ_ID, owner: 'W', claimedVersion: 1, now: '2026-07-18T09:30:12.000Z',
        effect: 'attachment-move',
        result: { movedKeys: ['rfqs/' + RFQ_ID + '/a.pdf'], failedKeys: ['temp/rfq/bbbbbbbbbbbbbbbb/b.pdf'] },
      }),
    }));
    expect(f.store.get(`RFQ#${RFQ_ID}|META`)!.attachmentKeys).toEqual(['rfqs/' + RFQ_ID + '/a.pdf']);
    expect((f.store.get(`RFQ#${RFQ_ID}|OUTBOX#attachment-move`)!.result as { failedKeys: string[] }).failedKeys)
      .toEqual(['temp/rfq/bbbbbbbbbbbbbbbb/b.pdf']);
    expect(f.store.get(`RFQ#${RFQ_ID}|OUTBOX#confirmation-email`)!.status).toBe('pending');
  });
});

describe('email latch', () => {
  it('claims once, blocks a second claim, then finalizes; never resends', async () => {
    const f = new FakeDdb();
    await submit(f, directParams()); // emails are roots (no attachments)
    const claim = () => buildEmailClaimItems({
      tableName: 'T', rfqId: RFQ_ID, effect: 'confirmation-email', owner: 'W', now: '2026-07-18T09:30:10.000Z',
    });
    await f.send(claim());
    expect(f.store.get(`RFQ#${RFQ_ID}|OUTBOX#confirmation-email`)!.status).toBe('send-claimed');
    // A second claim (e.g. after a crash) must fail — the email is never re-attempted.
    await expect(f.send(claim())).rejects.toMatchObject({ name: 'ConditionalCheckFailedException' });
    await f.send(buildEmailFinalizeItems({
      tableName: 'T', rfqId: RFQ_ID, effect: 'confirmation-email', owner: 'W',
      now: '2026-07-18T09:30:11.000Z', attemptedAt: '2026-07-18T09:30:11.000Z', outcome: 'accepted',
    }));
    const done = f.store.get(`RFQ#${RFQ_ID}|OUTBOX#confirmation-email`)!;
    expect(done.status).toBe('done');
    expect(done.result).toEqual({ attemptedAt: '2026-07-18T09:30:11.000Z', outcome: 'accepted' });
  });
});
