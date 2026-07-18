# RFQ Secure Drafts P4b-1 — Submit Transaction & Dependency-Ordered Outbox Model

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> First phase of the re-split P4b (see the blocked P4b record, merged #310). **Pure, `fakeDdb`-tested, ships dark — it does NOT touch `submit-rfq/handler.ts`.** P4b-2 (worker) and P4b-3 (handler cutover) consume these builders.

**Goal:** Provide the pure building blocks for idempotent submission — a receipt-as-transaction-item builder, the atomic **direct** and **draft-upgrade** submit-transaction builders (single `TransactWrite` each), and the **dependency-ordered outbox** item model — all as functions returning DynamoDB command inputs, unit-tested by executing them against `fakeDdb`.

**Architecture (grounded in merged source, re-read 2026-07-15 — not from memory):**
- Receipt item shape = `receiptStore.ts` (`PK=<SUBMIT_RECEIPT#…>, SK=META`, `opKind`, `binding`, `rfqId`, `referenceNumber`, `status`, `createdAt`, `replayExpiresAt`, `TTL`). `recordReceipt` is a standalone `PutCommand` and **cannot** be composed into a transaction, so P4b-1 adds `buildReceiptPut` returning a `{ Put: … }` transaction item with the same shape + `attribute_not_exists(PK)`.
- RFQ pending item shape = `submit-rfq/handler.ts` (`PK=RFQ#<rfqId>, SK=META`, `GSI1PK=RFQ_STATUS#pending`, `GSI1SK=<submittedAt>#<rfqId>`, `GSI4PK=EMAIL#<normalizedEmail>`, `GSI4SK=RFQ#<submittedAt>`, `status='pending'`, `submittedAt`, `ipHash`, `visitorId`, + form fields). The builders **take the already-constructed RFQ item / pending attributes as input** — they do not re-derive field mapping (the handler owns that in P4b-3).
- Draft item shape = `draftStore.ts` (`status='draft'`, `draftTokenHash`, `draftVersion`, `expiresAt`, `TTL`, `GSI1PK=RFQ_STATUS#draft`). The upgrade condition uses the **stored, version-verified** `draftTokenHash` verbatim (pepper-rotation-safe — see the P4b blocked record).
- `fakeDdb` (merged) supports `attribute_not_exists`, `f = :v`, `f < :v`, `f > :v` (string + number), `SET`/`ADD`/`REMOVE`, and `TransactWriteCommand` — everything these builders need. ISO timestamps compare lexicographically = chronologically, so `expiresAt > :now` is correct.

**Tech Stack:** TypeScript, `@aws-sdk/lib-dynamodb` `TransactWriteCommand`, `fakeDdb`, Vitest.

---

## Outbox dependency ordering (the state machine this models)

The live handler's effects have a real order the flat design broke. P4b-1 encodes it as a
per-item `stage`; P4b-2's worker runs a stage only after every lower stage is `done`:

| stage | effect(s) | depends on |
|------|-----------|-----------|
| 0 | `org-upsert` | — |
| 1 | `visitor-bridge`, `crm-emit` | stage 0 (needs `matchedOrgId`) |
| 2 | `attachment-move` | stage 1 |
| 3 | `confirmation-email`, `internal-email` | stage 2 (emails reference moved attachments) |

Each outbox item: `PK=RFQ_OUTBOX#<rfqId>`, `SK=<effectKind>`, `effectId` (deterministic), `stage`,
`status='pending'`, and only the minimal data that effect needs. P4b-1 builds the items; the
worker (P4b-2) enforces the stage gate and idempotent execution.

## File Structure

- Create `amplify/lib/rfq/outboxModel.ts` — `OUTBOX_EFFECTS`, `buildOutboxItems`, `outboxPk`, stage map.
- Create `amplify/lib/rfq/outboxModel.test.ts`.
- Create `amplify/lib/rfq/submitTransaction.ts` — `buildReceiptPut`, `buildDirectSubmitTransaction`, `buildDraftUpgradeTransaction`.
- Create `amplify/lib/rfq/submitTransaction.test.ts`.

Both leaves; **P4b-1 ships dark** (no importer in `src/` or `submit-rfq/handler.ts`).

**Test command:** `npx vitest run amplify/lib/rfq/outboxModel.test.ts amplify/lib/rfq/submitTransaction.test.ts --exclude '**/.claude/**'`

---

### Task 1: Outbox item model

**Files:** Create `amplify/lib/rfq/outboxModel.ts` + `.test.ts`.

- [ ] **Step 1: Write the failing test**

```ts
// amplify/lib/rfq/outboxModel.test.ts
import { describe, it, expect } from 'vitest';
import { buildOutboxItems, OUTBOX_EFFECTS, outboxPk } from './outboxModel';

const CTX = { rfqId: 'r1', email: 'jane@stanford.edu', hasAttachments: true };

describe('buildOutboxItems', () => {
  it('emits one pending item per effect with the correct stage order', () => {
    const items = buildOutboxItems(CTX);
    const byKind = Object.fromEntries(items.map((i) => [i.SK, i]));
    expect(items.every((i) => i.PK === outboxPk('r1'))).toBe(true);
    expect(items.every((i) => i.status === 'pending')).toBe(true);
    expect(byKind['org-upsert'].stage).toBe(0);
    expect(byKind['visitor-bridge'].stage).toBe(1);
    expect(byKind['crm-emit'].stage).toBe(1);
    expect(byKind['attachment-move'].stage).toBe(2);
    expect(byKind['confirmation-email'].stage).toBe(3);
    expect(byKind['internal-email'].stage).toBe(3);
    expect(new Set(OUTBOX_EFFECTS)).toEqual(new Set(items.map((i) => i.SK)));
  });

  it('gives each effect a deterministic id and omits attachment-move when there are none', () => {
    const a = buildOutboxItems(CTX);
    const b = buildOutboxItems(CTX);
    expect(a.map((i) => i.effectId)).toEqual(b.map((i) => i.effectId)); // deterministic
    const noAtt = buildOutboxItems({ ...CTX, hasAttachments: false });
    expect(noAtt.find((i) => i.SK === 'attachment-move')).toBeUndefined();
  });

  it('stores no PII beyond the email the email effects need', () => {
    for (const item of buildOutboxItems(CTX)) {
      if (item.SK === 'confirmation-email') expect(item.email).toBe('jane@stanford.edu');
      else expect(item).not.toHaveProperty('name');
    }
  });
});
```

- [ ] **Step 2: Run — FAIL** (`Failed to resolve import "./outboxModel"`).
- [ ] **Step 3: Implement**

```ts
// amplify/lib/rfq/outboxModel.ts
import crypto from 'node:crypto';

export const OUTBOX_EFFECTS = [
  'org-upsert', 'visitor-bridge', 'crm-emit', 'attachment-move',
  'confirmation-email', 'internal-email',
] as const;
export type OutboxEffect = (typeof OUTBOX_EFFECTS)[number];

const STAGE: Record<OutboxEffect, number> = {
  'org-upsert': 0, 'visitor-bridge': 1, 'crm-emit': 1, 'attachment-move': 2,
  'confirmation-email': 3, 'internal-email': 3,
};

export function outboxPk(rfqId: string): string { return `RFQ_OUTBOX#${rfqId}`; }

function effectId(rfqId: string, effect: OutboxEffect): string {
  return crypto.createHash('sha256').update(rfqId).update('\0').update(effect).digest('hex');
}

export interface OutboxItem {
  PK: string; SK: OutboxEffect; effectId: string; stage: number; status: 'pending';
  email?: string;
}

/** One outbox item per effect this submission needs, each stamped with its stage. */
export function buildOutboxItems(ctx: { rfqId: string; email: string; hasAttachments: boolean }): OutboxItem[] {
  const effects = OUTBOX_EFFECTS.filter((e) => e !== 'attachment-move' || ctx.hasAttachments);
  return effects.map((effect) => ({
    PK: outboxPk(ctx.rfqId),
    SK: effect,
    effectId: effectId(ctx.rfqId, effect),
    stage: STAGE[effect],
    status: 'pending' as const,
    ...(effect === 'confirmation-email' || effect === 'internal-email' ? { email: ctx.email } : {}),
  }));
}
```

- [ ] **Step 4: Run — PASS.**
- [ ] **Step 5: Commit** `feat(rfq-outbox): dependency-ordered outbox item model`.

---

### Task 2: Receipt-as-transaction-item builder

`recordReceipt` writes standalone; the transaction needs the receipt as a `{ Put }` op. Build
it here with the exact `receiptStore` item shape + the `attribute_not_exists(PK)` idempotency
condition.

**Files:** Create `amplify/lib/rfq/submitTransaction.ts` + `.test.ts`.

- [ ] **Step 1: Write the failing test**

```ts
// amplify/lib/rfq/submitTransaction.test.ts
import { describe, it, expect } from 'vitest';
import { buildReceiptPut } from './submitTransaction';

const RESULT = { rfqId: 'r1', referenceNumber: 'RFQ-1', status: 200 };
const NOW = '2026-07-15T00:00:00.000Z';

describe('buildReceiptPut', () => {
  it('produces a Put op with the receiptStore shape + idempotency condition', () => {
    const op = buildReceiptPut('SUBMIT_RECEIPT#abc', { opKind: 'direct', binding: 'ab'.repeat(32), result: RESULT }, NOW);
    expect(op.Put.Item.PK).toBe('SUBMIT_RECEIPT#abc');
    expect(op.Put.Item.SK).toBe('META');
    expect(op.Put.Item.opKind).toBe('direct');
    expect(op.Put.Item.rfqId).toBe('r1');
    expect(op.Put.Item.status).toBe(200);
    expect(op.Put.Item.replayExpiresAt).toBe('2026-07-22T00:00:00.000Z'); // +7d
    expect(op.Put.Item.TTL).toBe(Math.floor(Date.parse('2026-10-13T00:00:00.000Z') / 1000)); // +90d
    expect(op.Put.ConditionExpression).toBe('attribute_not_exists(PK)');
    expect(op.Put.Item).not.toHaveProperty('email');
  });
});
```

- [ ] **Step 2: Run — FAIL** (`buildReceiptPut` undefined).
- [ ] **Step 3: Implement** — mirror `recordReceipt`'s item exactly, returned as a transaction op (no `TableName` on the inner op; the caller supplies it per transaction item).

```ts
// amplify/lib/rfq/submitTransaction.ts
import type { SubmitOperationKind } from './submitReceipt';

const DAY_MS = 24 * 60 * 60 * 1000;
const REPLAY_DAYS = 7;
const TTL_DAYS = 90;

export interface StoredResult { rfqId: string; referenceNumber: string; status: number }

/** The submit receipt as a TransactWrite Put op (recordReceipt is a standalone put). */
export function buildReceiptPut(
  receiptId: string, args: { opKind: SubmitOperationKind; binding: string; result: StoredResult }, now: string,
): { Put: { Item: Record<string, unknown>; ConditionExpression: string } } {
  const replayExpiresAt = new Date(Date.parse(now) + REPLAY_DAYS * DAY_MS).toISOString();
  const ttlExpiresAt = new Date(Date.parse(now) + TTL_DAYS * DAY_MS).toISOString();
  return {
    Put: {
      Item: {
        PK: receiptId, SK: 'META',
        opKind: args.opKind, binding: args.binding,
        rfqId: args.result.rfqId, referenceNumber: args.result.referenceNumber, status: args.result.status,
        createdAt: now, replayExpiresAt, TTL: Math.floor(Date.parse(ttlExpiresAt) / 1000),
      },
      ConditionExpression: 'attribute_not_exists(PK)',
    },
  };
}
```

- [ ] **Step 4: Run — PASS.**
- [ ] **Step 5: Commit** `feat(rfq-submit): receipt-as-transaction-item builder`.

---

### Task 3: Direct submit transaction

One `TransactWrite`: `Put` the pending RFQ item (idempotent on `PK`) + the receipt `Put` + the
outbox `Put`s. All-or-nothing.

**Files:** Modify `amplify/lib/rfq/submitTransaction.ts` + `.test.ts`.

- [ ] **Step 1: Failing test** (execute the built input against `fakeDdb`):
  1. a direct submit commits the RFQ (`status='pending'`), the receipt, and every outbox item, all present after one `TransactWriteCommand`;
  2. a second identical submit (same receipt id) → `TransactionCanceledException`, and the store is unchanged (RFQ not duplicated).
- [ ] **Step 2: Run — FAIL.**
- [ ] **Step 3: Implement** `buildDirectSubmitTransaction({ tableName, rfqItem, receiptId, receiptArgs, outboxItems, now })` → `TransactWriteCommandInput` with `TransactItems`: `{ Put: { TableName, Item: rfqItem, ConditionExpression: 'attribute_not_exists(PK)' } }`, the receipt `Put` (from Task 2, with `TableName`), and one `Put` per outbox item. The RFQ item and outbox items are passed in already-built (the handler/model own their shapes).
- [ ] **Step 4: Run — PASS.**
- [ ] **Step 5: Commit** `feat(rfq-submit): atomic direct submit transaction`.

---

### Task 4: Draft-upgrade transaction (pepper-rotation-safe)

Replace the RFQ `Put` with a conditional `Update` of the draft's `rfqId`: set the authoritative
pending attributes (from the submitted payload) + pending index keys, **remove** `draftTokenHash`
/`TTL`/draft-`GSI1*`, under `status = :draft AND draftTokenHash = :storedHash AND expiresAt > :now`.
The `:storedHash` is the value the handler already read+verified (never recomputed).

**Files:** Modify `amplify/lib/rfq/submitTransaction.ts` + `.test.ts`.

- [ ] **Step 1: Failing tests** (against `fakeDdb`, seeding a `draft` item):
  1. upgrade of a live draft → same `rfqId` now `status='pending'`, `GSI1PK='RFQ_STATUS#pending'`, `draftTokenHash`/`TTL` **removed**, pending attrs set; receipt + outbox written;
  2. wrong `:storedHash` → `TransactionCanceledException`, draft unchanged;
  3. an already-`pending` item (`status != draft`) → cancelled, unchanged;
  4. an expired draft (`expiresAt <= now`) → cancelled, unchanged.
- [ ] **Step 2: Run — FAIL.**
- [ ] **Step 3: Implement** `buildDraftUpgradeTransaction({ tableName, rfqId, pendingAttrs, removedDraftAttrs = ['draftTokenHash','TTL'], storedDraftTokenHash, now, receiptId, receiptArgs, outboxItems })` → `TransactWriteCommandInput`. The `Update` uses `SET <pendingAttrs> REMOVE draftTokenHash, #ttl` with `ConditionExpression: '#status = :draft AND draftTokenHash = :h AND expiresAt > :now'`, `ExpressionAttributeNames: { '#status':'status', '#ttl':'TTL' }`. `pendingAttrs` includes `status='pending'`, `GSI1PK`/`GSI1SK` (reassigned to pending), `GSI4PK`/`GSI4SK`, `referenceNumber`, `submittedAt`, `ipHash`, and the authoritative form fields.
- [ ] **Step 4: Run — PASS.**
- [ ] **Step 5: Commit** `feat(rfq-submit): pepper-rotation-safe draft→pending upgrade transaction`.

---

### Task 5: Verification

- [ ] Full new-module suite + regression: `npx vitest run amplify/lib/rfq/ --exclude '**/.claude/**'` — all pass.
- [ ] `npx tsc --noEmit && npm run typecheck:amplify && npx eslint amplify/lib/rfq/outboxModel.ts amplify/lib/rfq/submitTransaction.ts` — clean.
- [ ] `grep -rn "outboxModel\|submitTransaction" src/ amplify/functions/*/handler.ts || echo "dark"` — no runtime import.

---

## Self-Review

**Scope (P4b-1 only):** dependency-ordered outbox item model (Task 1); receipt-as-transaction-item (Task 2); atomic direct transaction (Task 3); pepper-rotation-safe draft-upgrade transaction (Task 4). All pure builders, `fakeDdb`-tested, dark.

**Deferred:** the worker that enforces the stage gate + runs effects + at-most-once email (P4b-2); the `submit-rfq` handler cutover — require/opt-in `X-RFQ-Submit-Key`, strongly-consistent receipt read, decision-table response mapping, draft read+verify to obtain `:storedHash` (P4b-3); make-mandatory + legacy removal (P4b-4).

**Grounded in real source (the failure mode of the first P4b draft):** every shape/API above was re-read from merged `origin/main` (`receiptStore.ts`, `submitReceipt.ts`, `draftStore.ts`, `submit-rfq/handler.ts`, `fakeDdb.ts`) — not from memory. `recordReceipt` is confirmed a standalone `PutCommand` (hence `buildReceiptPut`); `checkReceipt` requires a binding (handler concern, P4b-3); `fakeDdb` confirmed to support `> :v` + `TransactWriteCommand` + `REMOVE`.

**Placeholder scan:** Tasks 3–4's step-3 describe the builder inputs/outputs precisely and their tests assert observable store state; the executing agent writes the full `TransactWriteCommandInput` assembly there (mechanical from the shapes given). No pseudo-code stands in for testable logic.

**Type consistency:** `StoredResult` matches `receiptStore`'s; `OutboxItem`/`OUTBOX_EFFECTS`/`outboxPk` (Task 1) feed Tasks 3–4; `buildReceiptPut`/`buildDirectSubmitTransaction`/`buildDraftUpgradeTransaction` share the `TableName`+`now`+`receiptId`+`receiptArgs`+`outboxItems` parameter vocabulary.
