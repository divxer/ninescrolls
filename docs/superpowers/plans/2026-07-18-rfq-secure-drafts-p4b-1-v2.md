# RFQ Secure Drafts P4b-1 v2 — Submit Transaction Primitives Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the pure, dark, fakeDdb-tested primitives that compose the idempotent RFQ submit transaction — the authoritative pending-RFQ item, the shared receipt-item builder, the dependency-ordered outbox effect schema, and the single `TransactWrite` composer for both the direct and draft-upgrade paths.

**Architecture:** One atomic `TransactWrite` writes the pending RFQ item, the idempotency receipt, and the **root** outbox effect records. Effects progress by *next-stage transactional creation*: each effect, on completion (P4b-2's worker, not this phase), creates its successors in the same transaction, and the successor's `INSERT` is the reliable wake event. The effect graph is a **frozen module-internal constant** — a true two-branch DAG (`org-upsert→{visitor-bridge, crm-emit}` and `attachment-move→{confirmation-email, internal-email}`) with **no fan-in**, so no coordinator item is needed. Both submit paths write the identical `buildPendingRfqItem()` output to the shared key `RFQ#<rfqId>/META`; because a DynamoDB `Put` replaces the whole item, the draft-upgrade path erases every draft-only attribute by construction.

**Tech Stack:** TypeScript, `@aws-sdk/lib-dynamodb` (`TransactWriteCommand`, `PutCommand`), Node `crypto`, Vitest, the in-repo `FakeDdb` harness (`amplify/functions/price-api/lib/testing/fakeDdb.ts`).

**Status:** This phase ships **DARK** — it adds new pure modules and one internal refactor (`recordReceipt`). It wires **nothing** into `submit-rfq/handler.ts`. The live cutover is P4b-3.

---

## Settled architecture (steps 1–3 — normative decisions & invariants)

This section is the *why* and the invariants. It contains **no implementation code** — the only source of truth for code is the task list below. These decisions were made and approved after two prior architectural rejections (PR #310 BLOCKED umbrella record; PR #311 BLOCKED P4b-1 first draft). #311 remains a blocked historical record and is superseded by this document.

### D1 — Outbox progression: next-stage transactional creation (not a coordinator)

DynamoDB Streams emit exactly one event per item change. Inserting all stage records up front dead-ends: once a predecessor finishes, no event re-wakes a downstream stage (#311 finding 1). **Decision:** the submit transaction creates only the **root** effects; each effect, on completion, runs one transaction that (a) conditionally marks itself done and (b) creates its direct successors. The successor's `INSERT` is the wake event. A coordinator/readiness item is explicitly **rejected** because this graph has no fan-in to join; a barrier would add state and single-item contention for no benefit. (If a future effect gains multiple predecessors, introduce a barrier then — not now.)

**Invariant D1a:** successor `Put`s use deterministic keys + `attribute_not_exists(PK)` so a completion transaction is safely retryable (a re-run cannot double-create a successor).

**Invariant D1b:** the successor graph is a **frozen module-internal constant** keyed by effect name. Builders never accept caller-supplied edges. The submit path may pass only a **fixed, model-chosen root tuple** — one of exactly two — never an arbitrary effect set.

### D2 — Effect graph: true two-branch DAG (not #310's linear chain)

Read from `amplify/functions/submit-rfq/handler.ts`: the confirmation/internal emails consume only `data`, `referenceNumber`, and the attachment-move outcome — **nothing** from org/visitor/CRM. So the real data-dependency graph is two independent branches, not one chain:

```
submit transaction (RFQ item + receipt + root effects)
├── org-upsert ──► visitor-bridge      (needs matchedOrgId)
│             └──► crm-emit            (needs matchedOrgId)
└── attachment-move ──► confirmation-email
                   └──► internal-email  (emails need attachment outcome only)
```

**Decision:** model the true branches. #310's `org→visitor→crm→attachment→emails` linearization is rejected — it makes emails wait on the org/CRM branch they do not consume, cutting concurrency and widening the blast radius of a non-critical effect failure.

**Invariant D2a — no-attachment rule:** when the submission has no attachments, do **not** create a no-op `attachment-move`. The two email effects become **roots** directly. Root tuple is therefore exactly one of:
- with attachments: `['org-upsert', 'attachment-move']`
- without attachments: `['org-upsert', 'confirmation-email', 'internal-email']`

### D3 — One authoritative pending-RFQ projection; parity by construction

The draft item and the pending RFQ item share one key, `RFQ#<rfqId>/META` (verified in `draftStore.ts`: `draftPk(rfqId)` = `RFQ#<rfqId>`, `SK:'META'`). So an upgrade is a *status transition on one item*, and both paths write the **same** `buildPendingRfqItem()` output to that key. They differ only in the `Put` condition:

| Path | Condition |
|---|---|
| Direct (no draft) | `attribute_not_exists(PK)` |
| Draft upgrade | `status = 'draft' AND draftTokenHash = :storedHash AND draftVersion = :expectedVersion AND expiresAt > :now` |

**Invariant D3a — Put replaces the whole item.** The upgrade carries no `REMOVE` list; the full-item `Put` erases every draft-only attribute (`draftTokenHash`, `draftVersion`, `lastActivityAt`, `expiresAt`, `TTL`, draft `GSI1PK/SK`, and any partial stored draft fields). This makes #311 finding 3 (incomplete upgrade projection leaving stale fields) *structurally impossible*.

**Invariant D3b — authoritative from the submission only.** The pending item is built from the validated formal submission, never from the draft's stored partial fields.

**Invariant D3c — pepper-rotation-safe.** `:storedHash` is the **exact** `draftTokenHash` string read during the strongly-consistent draft authentication — never a hash recomputed from the request token (which would assume the current pepper and wrongly reject a draft signed under a rotated-but-still-supported key).

**Invariant D3d — optimistic concurrency.** `draftVersion = :expectedVersion` is part of the condition so an autosave `PATCH` landing between the authenticated read and the transaction commit is not silently clobbered — the transaction fails closed and the client reconciles. `expectedVersion` comes from the authenticated read (produced by P4b-3), not from this phase.

**Invariant D3e — whitelist, never wholesale.** `buildPendingRfqItem` consumes a narrow `PendingRfqSource` type that structurally **excludes** `turnstileToken`, `submitIdempotencyKey`, draft credentials, and the raw `attachmentKeys`. `turnstileToken`/credentials never persist; the raw `attachmentKeys` belong to the attachment-move effect; `visitorId` is stored per current behavior.

**Invariant D3f — effect-owned backfills omitted.** `buildPendingRfqItem` omits `matchedOrgId`/`GSI2PK` (backfilled by the org-upsert effect) and `attachmentKeys` (backfilled by the attachment-move effect). Both paths defer these identically, so parity holds.

**Invariant D3g — reference number backward-compatible.** `deriveReferenceNumber(rfqId, submittedAt)` is shared by both paths. A legacy direct id (`rfq-YYYYMMDD-<hex>`) yields the **byte-identical** historical `RFQ-YYYYMMDD-<4 upper hex>`; a base64url draft id (no embedded date) yields `RFQ-<submittedAt date>-<4 hex of SHA-256(rfqId)>`. The current `generateReferenceNumber` splits on `-` and would corrupt a base64url id (which contains `-`/`_`).

### D4 — Receipt as a transaction item (shared builder)

`recordReceipt` is a standalone conditional `PutCommand` and is **not** composable into a `TransactWrite` (#310 correction 2). **Decision:** extract a pure `buildReceiptItem()` that both `recordReceipt` and the submit transaction use, so the standalone and in-transaction receipt items cannot drift. The receipt records only terminal fields (`rfqId`, `referenceNumber`, `status`, `opKind`, `binding`, timestamps, TTL) — never form PII.

### D5 — DynamoDB limits (guards, not `JSON.stringify`)

**Invariant D5a:** the pending item size is checked with a **conservative DynamoDB AttributeValue estimator** (UTF-8 attribute-name bytes + value bytes + generous per-attribute/per-type overhead) that **over-counts** — never `JSON.stringify(item).length`, which under-counts real item size. Asserted against a max-length fixture with margin below the 400 KB item limit.

**Invariant D5b:** the transaction accepts only a fixed root tuple (D1b/D2a), so action count is bounded: direct-with-attachments = 4, no-attachments = 5, upgrade same — far under the 100-action and 4 MB transaction limits. No dynamic fan-out can inflate it.

---

## Interfaces / file map

All modules live in `amplify/lib/rfq/` and are pure (no Amplify/AWS resource wiring). Each is dark until P4b-3 imports it.

| File | Responsibility | Key exports |
|---|---|---|
| `referenceNumber.ts` (new) | Format-stable reference number for both id schemes | `deriveReferenceNumber(rfqId, submittedAt): string` |
| `outboxEffects.ts` (new) | Frozen effect graph + typed effect-item builder + fixed root tuples | `OutboxEffectName`, `EFFECT_SUCCESSORS`, `submitRootEffects(hasAttachments)`, `OutboxEffectItem`, `buildOutboxEffectItem(rfqId, effect, now)` |
| `dynamoItemSize.ts` (new) | Conservative item-size estimator + limit guard | `estimateDynamoItemBytes(item): number`, `MAX_ITEM_BYTES`, `assertWithinItemLimits(item)` |
| `pendingRfq.ts` (new) | Authoritative pending-RFQ projection | `PendingRfqSource`, `PendingRfqMeta`, `PendingRfqItem`, `buildPendingRfqItem(source, meta): PendingRfqItem` |
| `receiptStore.ts` (modify) | Add shared receipt-item builder; refactor `recordReceipt` onto it | `ReceiptItem`, `buildReceiptItem(receiptId, args): ReceiptItem` (+ unchanged `recordReceipt`, `checkReceipt`) |
| `submitTransaction.ts` (new) | Compose the `TransactWrite` items for direct + upgrade | `SubmitTransactionParams`, `buildSubmitTransactionItems(params): TransactItem[]` |

Interface signatures (defined in full in the tasks; listed here as the contract map):

```ts
// referenceNumber.ts
export function deriveReferenceNumber(rfqId: string, submittedAt: string): string;

// outboxEffects.ts
export type OutboxEffectName =
  | 'org-upsert' | 'visitor-bridge' | 'crm-emit'
  | 'attachment-move' | 'confirmation-email' | 'internal-email';
export const EFFECT_SUCCESSORS: Readonly<Record<OutboxEffectName, readonly OutboxEffectName[]>>;
export function submitRootEffects(hasAttachments: boolean): readonly OutboxEffectName[];
export interface OutboxEffectItem { /* PK, SK, effect, status, successors, attempts, leaseOwner, leaseExpiresAt, version, createdAt */ }
export function buildOutboxEffectItem(rfqId: string, effect: OutboxEffectName, now: string): OutboxEffectItem;

// dynamoItemSize.ts
export const MAX_ITEM_BYTES: number;
export function estimateDynamoItemBytes(item: Record<string, unknown>): number;
export function assertWithinItemLimits(item: Record<string, unknown>): void;

// pendingRfq.ts
export interface PendingRfqSource { /* whitelisted form fields — NO turnstileToken/attachmentKeys/creds */ }
export interface PendingRfqMeta { rfqId: string; submittedAt: string; ipHash: string; referenceNumber: string; }
export interface PendingRfqItem { PK: string; SK: 'META'; status: 'pending'; /* ... */ }
export function buildPendingRfqItem(source: PendingRfqSource, meta: PendingRfqMeta): PendingRfqItem;

// receiptStore.ts (additions)
export interface ReceiptItem { PK: string; SK: 'META'; opKind: SubmitOperationKind; binding: string; rfqId: string; referenceNumber: string; status: number; createdAt: string; replayExpiresAt: string; TTL: number; }
export function buildReceiptItem(receiptId: string, args: { opKind: SubmitOperationKind; binding: string; result: StoredResult; now: string }): ReceiptItem;

// submitTransaction.ts
export interface SubmitTransactionParams {
  tableName: string;
  source: PendingRfqSource;
  meta: PendingRfqMeta;
  hasAttachments: boolean;
  receipt: { receiptId: string; opKind: SubmitOperationKind; binding: string; status: number };
  now: string;
  draftPrecondition?: { storedHash: string; expectedVersion: number };
}
export function buildSubmitTransactionItems(params: SubmitTransactionParams): TransactItem[];
```

---

## Tasks

### Task 1: `deriveReferenceNumber` — format-stable for both id schemes

**Files:**
- Create: `amplify/lib/rfq/referenceNumber.ts`
- Test: `amplify/lib/rfq/referenceNumber.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// amplify/lib/rfq/referenceNumber.test.ts
import { describe, it, expect } from 'vitest';
import { deriveReferenceNumber } from './referenceNumber';

describe('deriveReferenceNumber', () => {
  it('preserves the exact legacy format for a direct rfq id', () => {
    // Byte-identical to the current generateReferenceNumber() output.
    expect(deriveReferenceNumber('rfq-20260310-a1b2c3', '2026-03-10T12:00:00.000Z'))
      .toBe('RFQ-20260310-A1B2');
  });

  it('derives a dated reference from submittedAt for a base64url draft id', () => {
    // A draft id is base64url(SHA-256(...)) — contains '-'/'_' and no embedded date.
    const rfqId = 'aB-cd_EF0123456789ghijklmnopqrstuvwxyzABCDEF';
    const ref = deriveReferenceNumber(rfqId, '2026-07-18T09:30:00.000Z');
    expect(ref).toMatch(/^RFQ-20260718-[0-9A-F]{4}$/);
  });

  it('is deterministic for a given draft id + date', () => {
    const rfqId = 'aB-cd_EF0123456789ghijklmnopqrstuvwxyzABCDEF';
    expect(deriveReferenceNumber(rfqId, '2026-07-18T09:30:00.000Z'))
      .toBe(deriveReferenceNumber(rfqId, '2026-07-18T23:59:59.000Z'));
  });

  it('does not misclassify a base64url id as legacy', () => {
    // Even if a digest happens to start with digits, the strict legacy shape must not match.
    const ref = deriveReferenceNumber('12345678-abcdefg_hijk', '2026-07-18T00:00:00.000Z');
    expect(ref).toBe(`RFQ-20260718-${require('node:crypto').createHash('sha256').update('12345678-abcdefg_hijk').digest('hex').slice(0, 4).toUpperCase()}`);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run amplify/lib/rfq/referenceNumber.test.ts`
Expected: FAIL — `Cannot find module './referenceNumber'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// amplify/lib/rfq/referenceNumber.ts
import crypto from 'node:crypto';

/**
 * Human-facing reference number, stable across both rfqId schemes.
 *
 * Direct submissions use the legacy id `rfq-YYYYMMDD-<hex>`; the reference stays
 * byte-identical to the historical `generateReferenceNumber` so existing customer
 * references and the legacy test suite are untouched.
 *
 * Draft upgrades use `base64url(SHA-256(domain || nonce))` — no embedded date and
 * it contains '-'/'_', so splitting on '-' would corrupt it. We take the date from
 * submittedAt and a 4-hex digest of the full id. The legacy regex is strict
 * (`\d{8}` then all-lowercase-hex to end), which a 43-char mixed-case base64url id
 * cannot satisfy, so the two schemes never collide.
 */
export function deriveReferenceNumber(rfqId: string, submittedAt: string): string {
  const legacy = /^rfq-(\d{8})-([0-9a-f]+)$/.exec(rfqId);
  if (legacy) {
    return `RFQ-${legacy[1]}-${legacy[2].slice(0, 4).toUpperCase()}`;
  }
  const date = submittedAt.slice(0, 10).replace(/-/g, '');
  const digest = crypto.createHash('sha256').update(rfqId).digest('hex').slice(0, 4).toUpperCase();
  return `RFQ-${date}-${digest}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run amplify/lib/rfq/referenceNumber.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add amplify/lib/rfq/referenceNumber.ts amplify/lib/rfq/referenceNumber.test.ts
git commit -m "feat(rfq): shared reference-number derivation for both id schemes"
```

---

### Task 2: `outboxEffects` — frozen graph, typed item, fixed root tuples

**Files:**
- Create: `amplify/lib/rfq/outboxEffects.ts`
- Test: `amplify/lib/rfq/outboxEffects.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
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

  it('is frozen so no caller can mutate the graph', () => {
    expect(Object.isFrozen(EFFECT_SUCCESSORS)).toBe(true);
    expect(Object.isFrozen(EFFECT_SUCCESSORS['org-upsert'])).toBe(true);
    expect(() => {
      // @ts-expect-error runtime immutability check
      EFFECT_SUCCESSORS['org-upsert'] = [];
    }).toThrow();
  });

  it('has no fan-in: every effect is named by at most one parent', () => {
    const parentCount = new Map<string, number>();
    for (const succs of Object.values(EFFECT_SUCCESSORS)) {
      for (const s of succs) parentCount.set(s, (parentCount.get(s) ?? 0) + 1);
    }
    for (const count of parentCount.values()) expect(count).toBe(1);
  });
});

describe('submitRootEffects', () => {
  it('roots include attachment-move when attachments are present', () => {
    expect(submitRootEffects(true)).toEqual(['org-upsert', 'attachment-move']);
  });

  it('promotes the two email effects to roots when there are no attachments', () => {
    expect(submitRootEffects(false)).toEqual(['org-upsert', 'confirmation-email', 'internal-email']);
  });
});

describe('buildOutboxEffectItem', () => {
  it('builds a pending effect item with a deterministic key and the graph successors', () => {
    const item = buildOutboxEffectItem('rfq-20260718-abc123', 'org-upsert', '2026-07-18T00:00:00.000Z');
    expect(item).toEqual({
      PK: 'RFQ#rfq-20260718-abc123',
      SK: 'OUTBOX#org-upsert',
      effect: 'org-upsert',
      status: 'pending',
      successors: ['visitor-bridge', 'crm-emit'],
      attempts: 0,
      leaseOwner: null,
      leaseExpiresAt: null,
      version: 0,
      createdAt: '2026-07-18T00:00:00.000Z',
    });
  });

  it('copies successors from the frozen graph, not a shared mutable reference', () => {
    const item = buildOutboxEffectItem('rfq-1', 'attachment-move', '2026-07-18T00:00:00.000Z');
    expect(item.successors).toEqual(['confirmation-email', 'internal-email']);
    expect(item.successors).not.toBe(EFFECT_SUCCESSORS['attachment-move']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run amplify/lib/rfq/outboxEffects.test.ts`
Expected: FAIL — `Cannot find module './outboxEffects'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// amplify/lib/rfq/outboxEffects.ts

/** Every effect the submit outbox can schedule. */
export type OutboxEffectName =
  | 'org-upsert' | 'visitor-bridge' | 'crm-emit'
  | 'attachment-move' | 'confirmation-email' | 'internal-email';

/**
 * The dependency-ordered outbox DAG, as a FROZEN module-internal constant.
 * Two independent branches, no fan-in. Callers may never supply graph edges;
 * progression is next-stage transactional creation (an effect creates these
 * successors when it completes — P4b-2).
 */
export const EFFECT_SUCCESSORS: Readonly<Record<OutboxEffectName, readonly OutboxEffectName[]>> =
  Object.freeze({
    'org-upsert': Object.freeze(['visitor-bridge', 'crm-emit']),
    'visitor-bridge': Object.freeze([]),
    'crm-emit': Object.freeze([]),
    'attachment-move': Object.freeze(['confirmation-email', 'internal-email']),
    'confirmation-email': Object.freeze([]),
    'internal-email': Object.freeze([]),
  }) as Readonly<Record<OutboxEffectName, readonly OutboxEffectName[]>>;

const ROOTS_WITH_ATTACHMENTS: readonly OutboxEffectName[] =
  Object.freeze(['org-upsert', 'attachment-move']);
const ROOTS_WITHOUT_ATTACHMENTS: readonly OutboxEffectName[] =
  Object.freeze(['org-upsert', 'confirmation-email', 'internal-email']);

/**
 * The fixed root tuple for a submit transaction. Exactly one of two shapes — the
 * transaction never accepts an arbitrary effect set. No-attachment submissions
 * skip a no-op attachment-move and promote the two email effects to roots.
 */
export function submitRootEffects(hasAttachments: boolean): readonly OutboxEffectName[] {
  return hasAttachments ? ROOTS_WITH_ATTACHMENTS : ROOTS_WITHOUT_ATTACHMENTS;
}

/** A pending outbox effect record. lease/version fields are P4b-2's worker contract. */
export interface OutboxEffectItem {
  PK: string;
  SK: string;
  effect: OutboxEffectName;
  status: 'pending';
  successors: readonly OutboxEffectName[];
  attempts: number;
  leaseOwner: string | null;
  leaseExpiresAt: string | null;
  version: number;
  createdAt: string;
}

/** Deterministic key `RFQ#<rfqId>/OUTBOX#<effect>` so a retried create is a no-op under attribute_not_exists. */
export function buildOutboxEffectItem(
  rfqId: string, effect: OutboxEffectName, now: string,
): OutboxEffectItem {
  return {
    PK: `RFQ#${rfqId}`,
    SK: `OUTBOX#${effect}`,
    effect,
    status: 'pending',
    successors: [...EFFECT_SUCCESSORS[effect]],
    attempts: 0,
    leaseOwner: null,
    leaseExpiresAt: null,
    version: 0,
    createdAt: now,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run amplify/lib/rfq/outboxEffects.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add amplify/lib/rfq/outboxEffects.ts amplify/lib/rfq/outboxEffects.test.ts
git commit -m "feat(rfq): frozen outbox effect graph + typed effect-item builder"
```

---

### Task 3: `dynamoItemSize` — conservative estimator + limit guard

**Files:**
- Create: `amplify/lib/rfq/dynamoItemSize.ts`
- Test: `amplify/lib/rfq/dynamoItemSize.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// amplify/lib/rfq/dynamoItemSize.test.ts
import { describe, it, expect } from 'vitest';
import { estimateDynamoItemBytes, assertWithinItemLimits, MAX_ITEM_BYTES } from './dynamoItemSize';

describe('estimateDynamoItemBytes', () => {
  it('counts UTF-8 attribute-name and string-value bytes plus overhead', () => {
    // name "a" (1) + value "bc" (2) = 3 payload bytes; estimator must OVER-count via overhead.
    expect(estimateDynamoItemBytes({ a: 'bc' })).toBeGreaterThan(3);
  });

  it('counts multibyte UTF-8 by byte length, not code-point count', () => {
    // '€' is 3 UTF-8 bytes; a naive .length would report 1.
    const oneEuro = estimateDynamoItemBytes({ k: '€' });
    const oneAscii = estimateDynamoItemBytes({ k: 'x' });
    expect(oneEuro).toBeGreaterThan(oneAscii);
  });

  it('over-counts relative to JSON.stringify for a text-heavy item', () => {
    const item = { PK: 'RFQ#x', SK: 'META', body: 'y'.repeat(1000) };
    expect(estimateDynamoItemBytes(item)).toBeGreaterThan(JSON.stringify(item).length);
  });

  it('handles nested objects, arrays, numbers and booleans without throwing', () => {
    expect(() => estimateDynamoItemBytes({
      n: 12345, b: true, nul: null, arr: [1, 'two', { three: 3 }], obj: { a: { b: 'c' } },
    })).not.toThrow();
  });
});

describe('assertWithinItemLimits', () => {
  it('accepts a small item', () => {
    expect(() => assertWithinItemLimits({ PK: 'RFQ#x', SK: 'META' })).not.toThrow();
  });

  it('throws when the estimate exceeds MAX_ITEM_BYTES', () => {
    const huge = { PK: 'RFQ#x', SK: 'META', blob: 'z'.repeat(MAX_ITEM_BYTES + 1) };
    expect(() => assertWithinItemLimits(huge)).toThrow(/item size/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run amplify/lib/rfq/dynamoItemSize.test.ts`
Expected: FAIL — `Cannot find module './dynamoItemSize'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// amplify/lib/rfq/dynamoItemSize.ts

/**
 * A deliberately CONSERVATIVE estimate of a DynamoDB item's stored size in bytes.
 * It over-counts (never under-counts) real AttributeValue size so it can gate the
 * 400 KB item limit with margin. It is NOT JSON.stringify(item).length, which
 * under-counts (no attribute-name bytes, no per-type overhead, escapes distort).
 *
 * Rules (each padded upward vs. the documented DynamoDB sizing):
 *  - attribute name: UTF-8 byte length
 *  - string value:   UTF-8 byte length
 *  - number value:   flat 21 bytes (DynamoDB caps numbers at 38 digits ≈ 21 bytes)
 *  - bool/null:      1 byte
 *  - list/map:       3 bytes of structural overhead per element/entry, recursive
 *  - per attribute:  +1 byte overhead
 */
const PER_ATTRIBUTE_OVERHEAD = 1;
const NUMBER_BYTES = 21;
const STRUCTURAL_OVERHEAD = 3;

/** DynamoDB hard item limit is 400 KB; guard well below it. */
export const MAX_ITEM_BYTES = 400 * 1024;

function utf8Bytes(s: string): number {
  return Buffer.byteLength(s, 'utf8');
}

function valueBytes(value: unknown): number {
  if (value === null || value === undefined) return 1;
  if (typeof value === 'string') return utf8Bytes(value);
  if (typeof value === 'number') return NUMBER_BYTES;
  if (typeof value === 'boolean') return 1;
  if (Array.isArray(value)) {
    return value.reduce<number>((sum, el) => sum + STRUCTURAL_OVERHEAD + valueBytes(el), 0);
  }
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).reduce<number>(
      (sum, [k, v]) => sum + STRUCTURAL_OVERHEAD + utf8Bytes(k) + valueBytes(v), 0,
    );
  }
  return NUMBER_BYTES; // unknown type: charge the max scalar
}

export function estimateDynamoItemBytes(item: Record<string, unknown>): number {
  return Object.entries(item).reduce<number>(
    (sum, [name, value]) => sum + PER_ATTRIBUTE_OVERHEAD + utf8Bytes(name) + valueBytes(value), 0,
  );
}

export function assertWithinItemLimits(item: Record<string, unknown>): void {
  const bytes = estimateDynamoItemBytes(item);
  if (bytes > MAX_ITEM_BYTES) {
    throw new Error(`RFQ item size ${bytes}B exceeds limit ${MAX_ITEM_BYTES}B`);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run amplify/lib/rfq/dynamoItemSize.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add amplify/lib/rfq/dynamoItemSize.ts amplify/lib/rfq/dynamoItemSize.test.ts
git commit -m "feat(rfq): conservative DynamoDB item-size estimator + limit guard"
```

---

### Task 4: `buildPendingRfqItem` — authoritative pending projection

**Files:**
- Create: `amplify/lib/rfq/pendingRfq.ts`
- Test: `amplify/lib/rfq/pendingRfq.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// amplify/lib/rfq/pendingRfq.test.ts
import { describe, it, expect } from 'vitest';
import { buildPendingRfqItem, type PendingRfqSource, type PendingRfqMeta } from './pendingRfq';

const META: PendingRfqMeta = {
  rfqId: 'rfq-20260718-abc123',
  submittedAt: '2026-07-18T09:30:00.000Z',
  ipHash: 'a'.repeat(64),
  referenceNumber: 'RFQ-20260718-ABC1',
};

const FULL_SOURCE: PendingRfqSource = {
  name: 'Ada Lovelace', email: 'Ada@Example.EDU', phone: '+1-555-0100',
  institution: 'Analytical Engine Lab', department: 'Computing', role: 'professor',
  equipmentCategory: 'RIE', specificModel: 'RIE-500',
  applicationDescription: 'Etching test structures for a research programme.',
  keySpecifications: '4-inch wafers', quantity: 2,
  budgetRange: '100k-250k', timeline: 'within-3-months', fundingStatus: 'funded',
  referralSource: 'referral', existingEquipment: 'Old mill', additionalComments: 'None',
  needsBudgetaryQuote: true, shippingAddress: '1 Engine Way', shippingCity: 'London',
  shippingState: 'LDN', shippingZipCode: 'EC1', shippingCountry: 'UK',
  visitorId: 'visitor-xyz', referrerSource: 'insights/rie-guide',
};

describe('buildPendingRfqItem', () => {
  it('builds the full pending projection with all keys and fields', () => {
    const item = buildPendingRfqItem(FULL_SOURCE, META);
    expect(item).toEqual({
      PK: 'RFQ#rfq-20260718-abc123',
      SK: 'META',
      GSI1PK: 'RFQ_STATUS#pending',
      GSI1SK: '2026-07-18T09:30:00.000Z#rfq-20260718-abc123',
      GSI4PK: 'EMAIL#ada@example.edu',
      GSI4SK: 'RFQ#2026-07-18T09:30:00.000Z',
      GSI2SK: 'RFQ#2026-07-18T09:30:00.000Z',
      rfqId: 'rfq-20260718-abc123',
      referenceNumber: 'RFQ-20260718-ABC1',
      status: 'pending',
      submittedAt: '2026-07-18T09:30:00.000Z',
      ipHash: 'a'.repeat(64),
      visitorId: 'visitor-xyz',
      name: 'Ada Lovelace',
      email: 'Ada@Example.EDU',
      phone: '+1-555-0100',
      institution: 'Analytical Engine Lab',
      department: 'Computing',
      role: 'professor',
      equipmentCategory: 'RIE',
      specificModel: 'RIE-500',
      applicationDescription: 'Etching test structures for a research programme.',
      keySpecifications: '4-inch wafers',
      quantity: 2,
      budgetRange: '100k-250k',
      timeline: 'within-3-months',
      fundingStatus: 'funded',
      referralSource: 'referral',
      existingEquipment: 'Old mill',
      additionalComments: 'None',
      needsBudgetaryQuote: true,
      shippingAddress: '1 Engine Way',
      shippingCity: 'London',
      shippingState: 'LDN',
      shippingZipCode: 'EC1',
      shippingCountry: 'UK',
      referrerSource: 'insights/rie-guide',
      TTL: 0,
    });
  });

  it('omits effect-backfilled attributes (matchedOrgId, GSI2PK, attachmentKeys)', () => {
    const item = buildPendingRfqItem(FULL_SOURCE, META) as Record<string, unknown>;
    expect('matchedOrgId' in item).toBe(false);
    expect('GSI2PK' in item).toBe(false);
    expect('attachmentKeys' in item).toBe(false);
  });

  it('omits absent optional fields rather than storing undefined', () => {
    const minimal: PendingRfqSource = {
      name: 'Bo', email: 'bo@lab.gov', institution: 'Gov Lab',
      equipmentCategory: 'ICP',
      applicationDescription: 'A minimal but valid application description.',
      quantity: 1,
    };
    const item = buildPendingRfqItem(minimal, META) as Record<string, unknown>;
    for (const k of ['phone', 'department', 'role', 'specificModel', 'keySpecifications',
      'budgetRange', 'timeline', 'fundingStatus', 'referralSource', 'existingEquipment',
      'additionalComments', 'shippingAddress', 'shippingCity', 'shippingState',
      'shippingZipCode', 'shippingCountry', 'visitorId', 'referrerSource']) {
      expect(k in item).toBe(false);
    }
    expect(item.needsBudgetaryQuote).toBe(false); // defaulted, always present
  });

  it('normalizes the email for the GSI4 partition but stores the original email verbatim', () => {
    const item = buildPendingRfqItem(FULL_SOURCE, META);
    expect(item.GSI4PK).toBe('EMAIL#ada@example.edu');
    expect(item.email).toBe('Ada@Example.EDU');
  });

  it('cannot read turnstileToken or attachmentKeys (not on the source type)', () => {
    // Passing a superset object still yields an item free of those keys — the
    // narrow PendingRfqSource parameter type is the structural whitelist.
    const withExtras = { ...FULL_SOURCE, turnstileToken: 'secret', attachmentKeys: ['temp/rfq/x/f'] };
    const item = buildPendingRfqItem(withExtras as PendingRfqSource, META) as Record<string, unknown>;
    expect('turnstileToken' in item).toBe(false);
    expect('attachmentKeys' in item).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run amplify/lib/rfq/pendingRfq.test.ts`
Expected: FAIL — `Cannot find module './pendingRfq'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// amplify/lib/rfq/pendingRfq.ts

/**
 * The whitelisted set of submission fields that persist onto the pending RFQ item.
 * Deliberately EXCLUDES turnstileToken, submitIdempotencyKey, draft credentials,
 * and the raw attachmentKeys — the parameter type IS the whitelist, so the builder
 * physically cannot project a secret or a one-time value.
 */
export interface PendingRfqSource {
  name: string;
  email: string;
  phone?: string;
  institution: string;
  department?: string;
  role?: string;
  equipmentCategory: string;
  specificModel?: string;
  applicationDescription: string;
  keySpecifications?: string;
  quantity: number;
  budgetRange?: string;
  timeline?: string;
  fundingStatus?: string;
  referralSource?: string;
  existingEquipment?: string;
  additionalComments?: string;
  needsBudgetaryQuote?: boolean;
  shippingAddress?: string;
  shippingCity?: string;
  shippingState?: string;
  shippingZipCode?: string;
  shippingCountry?: string;
  visitorId?: string;
  referrerSource?: string;
}

export interface PendingRfqMeta {
  rfqId: string;
  submittedAt: string;
  ipHash: string;
  referenceNumber: string;
}

export interface PendingRfqItem {
  PK: string;
  SK: 'META';
  GSI1PK: 'RFQ_STATUS#pending';
  GSI1SK: string;
  GSI4PK: string;
  GSI4SK: string;
  GSI2SK: string;
  rfqId: string;
  referenceNumber: string;
  status: 'pending';
  submittedAt: string;
  ipHash: string;
  name: string;
  email: string;
  institution: string;
  equipmentCategory: string;
  applicationDescription: string;
  quantity: number;
  needsBudgetaryQuote: boolean;
  TTL: 0;
  [attr: string]: unknown; // optional fields assigned conditionally below
}

/** Assign only when defined, so absent optionals never become `undefined` attributes. */
function putIfDefined(target: Record<string, unknown>, key: string, value: unknown): void {
  if (value !== undefined) target[key] = value;
}

/**
 * Build the authoritative pending RFQ item from the validated formal submission.
 * Both the direct and draft-upgrade transactions write THIS output to RFQ#<rfqId>/META,
 * so parity holds by construction. Omits matchedOrgId/GSI2PK (org-upsert effect
 * backfills) and attachmentKeys (attachment-move effect backfills).
 */
export function buildPendingRfqItem(source: PendingRfqSource, meta: PendingRfqMeta): PendingRfqItem {
  const normalizedEmail = source.email.trim().toLowerCase();
  const item: PendingRfqItem = {
    PK: `RFQ#${meta.rfqId}`,
    SK: 'META',
    GSI1PK: 'RFQ_STATUS#pending',
    GSI1SK: `${meta.submittedAt}#${meta.rfqId}`,
    GSI4PK: `EMAIL#${normalizedEmail}`,
    GSI4SK: `RFQ#${meta.submittedAt}`,
    GSI2SK: `RFQ#${meta.submittedAt}`,
    rfqId: meta.rfqId,
    referenceNumber: meta.referenceNumber,
    status: 'pending',
    submittedAt: meta.submittedAt,
    ipHash: meta.ipHash,
    name: source.name,
    email: source.email,
    institution: source.institution,
    equipmentCategory: source.equipmentCategory,
    applicationDescription: source.applicationDescription,
    quantity: source.quantity,
    needsBudgetaryQuote: source.needsBudgetaryQuote ?? false,
    TTL: 0,
  };
  putIfDefined(item, 'visitorId', source.visitorId);
  putIfDefined(item, 'phone', source.phone);
  putIfDefined(item, 'department', source.department);
  putIfDefined(item, 'role', source.role);
  putIfDefined(item, 'specificModel', source.specificModel);
  putIfDefined(item, 'keySpecifications', source.keySpecifications);
  putIfDefined(item, 'budgetRange', source.budgetRange);
  putIfDefined(item, 'timeline', source.timeline);
  putIfDefined(item, 'fundingStatus', source.fundingStatus);
  putIfDefined(item, 'referralSource', source.referralSource);
  putIfDefined(item, 'existingEquipment', source.existingEquipment);
  putIfDefined(item, 'additionalComments', source.additionalComments);
  putIfDefined(item, 'shippingAddress', source.shippingAddress);
  putIfDefined(item, 'shippingCity', source.shippingCity);
  putIfDefined(item, 'shippingState', source.shippingState);
  putIfDefined(item, 'shippingZipCode', source.shippingZipCode);
  putIfDefined(item, 'shippingCountry', source.shippingCountry);
  putIfDefined(item, 'referrerSource', source.referrerSource);
  return item;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run amplify/lib/rfq/pendingRfq.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add amplify/lib/rfq/pendingRfq.ts amplify/lib/rfq/pendingRfq.test.ts
git commit -m "feat(rfq): authoritative pending-RFQ item builder (whitelisted projection)"
```

---

### Task 5: `buildReceiptItem` — shared receipt builder + `recordReceipt` refactor

**Files:**
- Modify: `amplify/lib/rfq/receiptStore.ts`
- Test: `amplify/lib/rfq/receiptStore.test.ts` (extend existing suite)

- [ ] **Step 1: Write the failing test** (append to the existing file)

```ts
// amplify/lib/rfq/receiptStore.test.ts  (append these describe blocks)
import { buildReceiptItem } from './receiptStore';

describe('buildReceiptItem', () => {
  it('builds the receipt item with 7-day replay and 90-day TTL', () => {
    const now = '2026-07-18T00:00:00.000Z';
    const item = buildReceiptItem('SUBMIT_RECEIPT#abc', {
      opKind: 'direct',
      binding: 'f'.repeat(64),
      result: { rfqId: 'rfq-20260718-abc123', referenceNumber: 'RFQ-20260718-ABC1', status: 200 },
      now,
    });
    expect(item).toEqual({
      PK: 'SUBMIT_RECEIPT#abc',
      SK: 'META',
      opKind: 'direct',
      binding: 'f'.repeat(64),
      rfqId: 'rfq-20260718-abc123',
      referenceNumber: 'RFQ-20260718-ABC1',
      status: 200,
      createdAt: now,
      replayExpiresAt: '2026-07-25T00:00:00.000Z',
      TTL: Math.floor(Date.parse('2026-10-16T00:00:00.000Z') / 1000),
    });
  });

  it('stores no form PII (only terminal fields)', () => {
    const item = buildReceiptItem('SUBMIT_RECEIPT#abc', {
      opKind: 'draft-upgrade',
      binding: '0'.repeat(64),
      result: { rfqId: 'rfq-x', referenceNumber: 'RFQ-x', status: 200 },
      now: '2026-07-18T00:00:00.000Z',
    }) as Record<string, unknown>;
    for (const k of ['name', 'email', 'institution', 'applicationDescription']) {
      expect(k in item).toBe(false);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run amplify/lib/rfq/receiptStore.test.ts`
Expected: FAIL — `buildReceiptItem` is not exported.

- [ ] **Step 3: Write minimal implementation** — edit `receiptStore.ts`

Add the `ReceiptItem` type and `buildReceiptItem`, then refactor `recordReceipt` to use it. Replace the existing `recordReceipt` body (currently an inline `PutCommand` that computes `replayExpiresAt`/`ttlExpiresAt`) with a call to the shared builder.

```ts
// amplify/lib/rfq/receiptStore.ts — additions near the top-level exports

export interface ReceiptItem {
  PK: string;
  SK: 'META';
  opKind: SubmitOperationKind;
  binding: string;
  rfqId: string;
  referenceNumber: string;
  status: number;
  createdAt: string;
  replayExpiresAt: string;
  TTL: number;
}

/**
 * Pure builder for the receipt item — the single source shared by recordReceipt's
 * standalone conditional Put AND the P4b submit TransactWrite, so the two can never
 * drift. Stores only terminal fields; never form PII.
 */
export function buildReceiptItem(
  receiptId: string,
  args: { opKind: SubmitOperationKind; binding: string; result: StoredResult; now: string },
): ReceiptItem {
  const replayExpiresAt = new Date(Date.parse(args.now) + REPLAY_DAYS * DAY_MS).toISOString();
  const ttlExpiresAt = new Date(Date.parse(args.now) + TTL_DAYS * DAY_MS).toISOString();
  return {
    PK: receiptId,
    SK: 'META',
    opKind: args.opKind,
    binding: args.binding,
    rfqId: args.result.rfqId,
    referenceNumber: args.result.referenceNumber,
    status: args.result.status,
    createdAt: args.now,
    replayExpiresAt,
    TTL: Math.floor(Date.parse(ttlExpiresAt) / 1000),
  };
}
```

Then replace the body of `recordReceipt` with:

```ts
export async function recordReceipt(
  deps: ReceiptDeps, receiptId: string,
  args: { opKind: SubmitOperationKind; binding: string; result: StoredResult },
): Promise<void> {
  await deps.send(new PutCommand({
    TableName: deps.tableName,
    Item: buildReceiptItem(receiptId, { ...args, now: deps.now() }),
    ConditionExpression: 'attribute_not_exists(PK)',
  }));
}
```

- [ ] **Step 4: Run test to verify it passes** (new + all existing receipt tests)

Run: `npx vitest run amplify/lib/rfq/receiptStore.test.ts`
Expected: PASS — the new `buildReceiptItem` tests plus the entire pre-existing `recordReceipt`/`checkReceipt` suite unchanged.

- [ ] **Step 5: Commit**

```bash
git add amplify/lib/rfq/receiptStore.ts amplify/lib/rfq/receiptStore.test.ts
git commit -m "refactor(rfq): extract shared buildReceiptItem used by recordReceipt"
```

---

### Task 6: `buildSubmitTransactionItems` — the atomic submit composer

**Files:**
- Create: `amplify/lib/rfq/submitTransaction.ts`
- Test: `amplify/lib/rfq/submitTransaction.test.ts`

- [ ] **Step 1: Write the failing test** (pure composition assertions)

```ts
// amplify/lib/rfq/submitTransaction.test.ts
import { describe, it, expect } from 'vitest';
import { buildSubmitTransactionItems, type SubmitTransactionParams } from './submitTransaction';
import type { PendingRfqSource, PendingRfqMeta } from './pendingRfq';

const SOURCE: PendingRfqSource = {
  name: 'Ada', email: 'ada@lab.edu', institution: 'Lab',
  equipmentCategory: 'RIE', applicationDescription: 'A valid application description.',
  quantity: 1,
};
const META: PendingRfqMeta = {
  rfqId: 'rfq-20260718-abc123', submittedAt: '2026-07-18T09:30:00.000Z',
  ipHash: 'a'.repeat(64), referenceNumber: 'RFQ-20260718-ABC1',
};

function directParams(overrides: Partial<SubmitTransactionParams> = {}): SubmitTransactionParams {
  return {
    tableName: 'T', source: SOURCE, meta: META, hasAttachments: false,
    receipt: { receiptId: 'SUBMIT_RECEIPT#r', opKind: 'direct', binding: 'b'.repeat(64), status: 200 },
    now: '2026-07-18T09:30:00.000Z',
    ...overrides,
  };
}

describe('buildSubmitTransactionItems — direct', () => {
  it('composes pending Put (attribute_not_exists) + receipt Put + email roots', () => {
    const items = buildSubmitTransactionItems(directParams());
    expect(items).toHaveLength(5); // pending + receipt + 3 no-attachment roots
    const pending = items[0].Put!;
    expect(pending.Item!.PK).toBe('RFQ#rfq-20260718-abc123');
    expect(pending.Item!.SK).toBe('META');
    expect(pending.ConditionExpression).toBe('attribute_not_exists(PK)');
    const receipt = items[1].Put!;
    expect(receipt.Item!.PK).toBe('SUBMIT_RECEIPT#r');
    expect(receipt.ConditionExpression).toBe('attribute_not_exists(PK)');
    const rootKeys = items.slice(2).map((i) => i.Put!.Item!.SK);
    expect(rootKeys).toEqual(['OUTBOX#org-upsert', 'OUTBOX#confirmation-email', 'OUTBOX#internal-email']);
    for (const i of items.slice(2)) expect(i.Put!.ConditionExpression).toBe('attribute_not_exists(PK)');
  });

  it('uses attachment-move root tuple when attachments are present', () => {
    const items = buildSubmitTransactionItems(directParams({ hasAttachments: true }));
    expect(items).toHaveLength(4); // pending + receipt + 2 roots
    expect(items.slice(2).map((i) => i.Put!.Item!.SK)).toEqual(['OUTBOX#org-upsert', 'OUTBOX#attachment-move']);
  });

  it('sets TableName on every transaction item', () => {
    const items = buildSubmitTransactionItems(directParams());
    for (const i of items) expect(i.Put!.TableName).toBe('T');
  });
});

describe('buildSubmitTransactionItems — draft-upgrade', () => {
  it('uses the 4-clause draft condition with the stored hash verbatim', () => {
    const items = buildSubmitTransactionItems(directParams({
      receipt: { receiptId: 'SUBMIT_RECEIPT#r', opKind: 'draft-upgrade', binding: 'b'.repeat(64), status: 200 },
      draftPrecondition: { storedHash: 'v1:' + 'a'.repeat(64), expectedVersion: 3 },
    }));
    const pending = items[0].Put!;
    expect(pending.ConditionExpression)
      .toBe('#status = :draft AND draftTokenHash = :h AND draftVersion = :v AND expiresAt > :now');
    expect(pending.ExpressionAttributeNames).toEqual({ '#status': 'status' });
    expect(pending.ExpressionAttributeValues).toEqual({
      ':draft': 'draft', ':h': 'v1:' + 'a'.repeat(64), ':v': 3, ':now': '2026-07-18T09:30:00.000Z',
    });
  });
});

describe('buildSubmitTransactionItems — parity', () => {
  it('writes a byte-identical pending item on both paths for the same source + meta', () => {
    const direct = buildSubmitTransactionItems(directParams());
    const upgrade = buildSubmitTransactionItems(directParams({
      receipt: { receiptId: 'SUBMIT_RECEIPT#r', opKind: 'draft-upgrade', binding: 'b'.repeat(64), status: 200 },
      draftPrecondition: { storedHash: 'v1:' + 'a'.repeat(64), expectedVersion: 1 },
    }));
    expect(upgrade[0].Put!.Item).toEqual(direct[0].Put!.Item);
  });
});

describe('buildSubmitTransactionItems — guards', () => {
  it('rejects a pending item that would exceed the DynamoDB item limit', () => {
    const bloated: PendingRfqSource = { ...SOURCE, additionalComments: 'z'.repeat(500 * 1024) };
    expect(() => buildSubmitTransactionItems(directParams({ source: bloated }))).toThrow(/item size/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run amplify/lib/rfq/submitTransaction.test.ts`
Expected: FAIL — `Cannot find module './submitTransaction'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// amplify/lib/rfq/submitTransaction.ts
import type { TransactWriteCommandInput } from '@aws-sdk/lib-dynamodb';
import type { SubmitOperationKind } from './submitReceipt';
import { buildPendingRfqItem, type PendingRfqSource, type PendingRfqMeta } from './pendingRfq';
import { buildReceiptItem } from './receiptStore';
import { submitRootEffects, buildOutboxEffectItem } from './outboxEffects';
import { assertWithinItemLimits } from './dynamoItemSize';

type TransactItem = NonNullable<TransactWriteCommandInput['TransactItems']>[number];

export interface SubmitTransactionParams {
  tableName: string;
  source: PendingRfqSource;
  meta: PendingRfqMeta;
  hasAttachments: boolean;
  receipt: { receiptId: string; opKind: SubmitOperationKind; binding: string; status: number };
  now: string;
  /** Present only for draft-upgrade — the exact stored hash + version from the authenticated read. */
  draftPrecondition?: { storedHash: string; expectedVersion: number };
}

/**
 * Compose the atomic submit TransactWrite: pending RFQ Put (conditional) + receipt
 * Put (attribute_not_exists) + the FIXED root outbox effect tuple. The root set is
 * one of exactly two shapes (D1b/D2a); it never accepts an arbitrary effect list.
 */
export function buildSubmitTransactionItems(params: SubmitTransactionParams): TransactItem[] {
  const { tableName, source, meta, hasAttachments, receipt, now, draftPrecondition } = params;

  const pendingItem = buildPendingRfqItem(source, meta);
  assertWithinItemLimits(pendingItem as unknown as Record<string, unknown>);

  const pendingCondition: Pick<
    NonNullable<TransactItem['Put']>,
    'ConditionExpression' | 'ExpressionAttributeNames' | 'ExpressionAttributeValues'
  > = draftPrecondition
    ? {
        ConditionExpression:
          '#status = :draft AND draftTokenHash = :h AND draftVersion = :v AND expiresAt > :now',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':draft': 'draft',
          ':h': draftPrecondition.storedHash,
          ':v': draftPrecondition.expectedVersion,
          ':now': now,
        },
      }
    : { ConditionExpression: 'attribute_not_exists(PK)' };

  const receiptItem = buildReceiptItem(receipt.receiptId, {
    opKind: receipt.opKind,
    binding: receipt.binding,
    result: { rfqId: meta.rfqId, referenceNumber: meta.referenceNumber, status: receipt.status },
    now,
  });

  const roots = submitRootEffects(hasAttachments);

  const items: TransactItem[] = [
    { Put: { TableName: tableName, Item: pendingItem as unknown as Record<string, unknown>, ...pendingCondition } },
    { Put: { TableName: tableName, Item: receiptItem as unknown as Record<string, unknown>, ConditionExpression: 'attribute_not_exists(PK)' } },
    ...roots.map((effect) => ({
      Put: {
        TableName: tableName,
        Item: buildOutboxEffectItem(meta.rfqId, effect, now) as unknown as Record<string, unknown>,
        ConditionExpression: 'attribute_not_exists(PK)',
      },
    })),
  ];

  return items;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run amplify/lib/rfq/submitTransaction.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add amplify/lib/rfq/submitTransaction.ts amplify/lib/rfq/submitTransaction.test.ts
git commit -m "feat(rfq): compose atomic submit TransactWrite for direct + upgrade"
```

---

### Task 7: fakeDdb integration — commit semantics, draft-field erasure, condition failures

**Files:**
- Test: `amplify/lib/rfq/submitTransaction.integration.test.ts` (new)

This task adds no product code; it proves the composed transaction behaves correctly against the real conditional-write semantics of `FakeDdb`, including full-item replacement (draft-field erasure) and every cancellation cause.

- [ ] **Step 1: Write the failing test**

```ts
// amplify/lib/rfq/submitTransaction.integration.test.ts
import { describe, it, expect } from 'vitest';
import { TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { FakeDdb } from '../../functions/price-api/lib/testing/fakeDdb';
import { buildSubmitTransactionItems, type SubmitTransactionParams } from './submitTransaction';
import { buildDraftItem } from './draftStore';
import type { PendingRfqSource, PendingRfqMeta } from './pendingRfq';

const SOURCE: PendingRfqSource = {
  name: 'Ada', email: 'ada@lab.edu', institution: 'Lab',
  equipmentCategory: 'RIE', applicationDescription: 'A valid application description.',
  quantity: 1,
};
const RFQ_ID = 'draftId_base64url_example_0123456789ABCDEFabcd';
const META: PendingRfqMeta = {
  rfqId: RFQ_ID, submittedAt: '2026-07-18T09:30:00.000Z',
  ipHash: 'a'.repeat(64), referenceNumber: 'RFQ-20260718-ABCD',
};
const STORED_HASH = 'v1:' + 'a'.repeat(64);

function upgradeParams(over: Partial<SubmitTransactionParams> = {}): SubmitTransactionParams {
  return {
    tableName: 'T', source: SOURCE, meta: META, hasAttachments: false,
    receipt: { receiptId: 'SUBMIT_RECEIPT#r', opKind: 'draft-upgrade', binding: 'b'.repeat(64), status: 200 },
    now: '2026-07-18T09:30:00.000Z',
    draftPrecondition: { storedHash: STORED_HASH, expectedVersion: 1 },
    ...over,
  };
}

function directParams(over: Partial<SubmitTransactionParams> = {}): SubmitTransactionParams {
  return {
    tableName: 'T', source: SOURCE, meta: META, hasAttachments: false,
    receipt: { receiptId: 'SUBMIT_RECEIPT#r', opKind: 'direct', binding: 'b'.repeat(64), status: 200 },
    now: '2026-07-18T09:30:00.000Z',
    // No draftPrecondition → direct path (attribute_not_exists(PK)).
    ...over,
  };
}

async function runTx(fake: FakeDdb, params: SubmitTransactionParams) {
  await fake.send(new TransactWriteCommand({ TransactItems: buildSubmitTransactionItems(params) }));
}

/** Seed a live draft with draft-only + stale optional fields at RFQ#<id>/META. */
function seedDraft(fake: FakeDdb) {
  const item = buildDraftItem({
    rfqId: RFQ_ID, draftTokenHash: STORED_HASH,
    // buildDraftItem's input is DraftCreateInput — all required fields must be present
    // or `tsc -p amplify --noEmit` (Task 8) fails even though Vitest strips the types.
    input: {
      name: 'STALE NAME', email: 'stale@lab.edu', institution: 'STALE INST',
      equipmentCategory: 'ICP', applicationDescription: 'stale application description', quantity: 1,
    },
    now: '2026-07-18T00:00:00.000Z',
  });
  fake.seed([item]);
}

describe('submit transaction against FakeDdb — direct', () => {
  it('commits pending + receipt + roots on first use', async () => {
    const fake = new FakeDdb();
    await runTx(fake, directParams());
    expect(fake.store.get(`RFQ#${RFQ_ID}|META`)!.status).toBe('pending');
    expect(fake.store.get('SUBMIT_RECEIPT#r|META')).toBeTruthy();
    expect(fake.store.get(`RFQ#${RFQ_ID}|OUTBOX#org-upsert`)).toBeTruthy();
  });

  it('a duplicate receipt cancels the whole transaction', async () => {
    const fake = new FakeDdb();
    await runTx(fake, directParams());
    // A second direct submit reusing the receipt id but a different rfqId must cancel.
    await expect(runTx(fake, directParams({ meta: { ...META, rfqId: 'other-id' } })))
      .rejects.toMatchObject({ name: 'TransactionCanceledException' });
    expect(fake.store.get('RFQ#other-id|META')).toBeUndefined();
  });
});

describe('submit transaction against FakeDdb — draft-upgrade', () => {
  it('replaces the draft item and erases every draft-only attribute', async () => {
    const fake = new FakeDdb();
    seedDraft(fake);
    await runTx(fake, upgradeParams());
    const upgraded = fake.store.get(`RFQ#${RFQ_ID}|META`)!;
    expect(upgraded.status).toBe('pending');
    // Draft-only attributes gone by construction (full-item Put replace).
    for (const k of ['draftTokenHash', 'draftVersion', 'lastActivityAt', 'expiresAt', 'GSI1SK']) {
      // GSI1SK is now the pending index sort key, not the draft one:
      if (k === 'GSI1SK') { expect(upgraded.GSI1SK).toBe(`${META.submittedAt}#${RFQ_ID}`); continue; }
      expect(k in upgraded).toBe(false);
    }
    expect(upgraded.GSI1PK).toBe('RFQ_STATUS#pending');
    // Authoritative from submission, not the stale draft fields:
    expect(upgraded.name).toBe('Ada');
    expect(upgraded.institution).toBe('Lab');
  });

  it('upgrade output equals the direct output for the same source + rfqId (parity)', async () => {
    const fakeA = new FakeDdb(); seedDraft(fakeA);
    await runTx(fakeA, upgradeParams());
    const fakeB = new FakeDdb();
    await runTx(fakeB, directParams());
    expect(fakeA.store.get(`RFQ#${RFQ_ID}|META`)).toEqual(fakeB.store.get(`RFQ#${RFQ_ID}|META`));
  });

  it('cancels when draftVersion moved (concurrent autosave)', async () => {
    const fake = new FakeDdb(); seedDraft(fake); // seeded draftVersion = 1
    await expect(runTx(fake, upgradeParams({
      draftPrecondition: { storedHash: STORED_HASH, expectedVersion: 2 },
    }))).rejects.toMatchObject({ name: 'TransactionCanceledException' });
    expect(fake.store.get(`RFQ#${RFQ_ID}|META`)!.status).toBe('draft');
  });

  it('cancels when the stored hash differs (swapped/absent draft)', async () => {
    const fake = new FakeDdb(); seedDraft(fake);
    await expect(runTx(fake, upgradeParams({
      draftPrecondition: { storedHash: 'v1:' + 'b'.repeat(64), expectedVersion: 1 },
    }))).rejects.toMatchObject({ name: 'TransactionCanceledException' });
  });

  it('cancels when the draft has expired', async () => {
    const fake = new FakeDdb(); seedDraft(fake);
    await expect(runTx(fake, upgradeParams({
      now: '2099-01-01T00:00:00.000Z', // now > draft expiresAt
      draftPrecondition: { storedHash: STORED_HASH, expectedVersion: 1 },
    }))).rejects.toMatchObject({ name: 'TransactionCanceledException' });
  });

  it('cancels an upgrade when no draft exists at the key', async () => {
    const fake = new FakeDdb(); // nothing seeded
    await expect(runTx(fake, upgradeParams()))
      .rejects.toMatchObject({ name: 'TransactionCanceledException' });
  });
});
```

- [ ] **Step 2: Run the suite (characterization, not a red phase)**

This task adds tests against the already-built Task 6 composer, so with a correct Task 6 they pass on the first run — there is no red phase to force.

Run: `npx vitest run amplify/lib/rfq/submitTransaction.integration.test.ts`
Expected: PASS. A failure here indicates a real bug in the Task 6 composer (or the pending/condition builders) surfaced by `FakeDdb`'s conditional-write semantics — not a missing implementation.

- [ ] **Step 3: If any assertion fails, fix the source (not the test)**

No product code changes are expected. If an assertion fails on behavior, fix the composer or the pending/condition builders and re-run until green. Do not weaken an assertion to make it pass.

- [ ] **Step 4: Run the full rfq lib suite**

Run: `npx vitest run amplify/lib/rfq/ --exclude '**/.claude/**'`
Expected: PASS — all P4b-1 modules plus the untouched P1–P4a suites.

- [ ] **Step 5: Commit**

```bash
git add amplify/lib/rfq/submitTransaction.integration.test.ts
git commit -m "test(rfq): fakeDdb integration for submit transaction commit + cancellation causes"
```

---

### Task 8: Dark-import verification

**Files:** none (verification only)

- [ ] **Step 1: Confirm the live handler imports none of the new modules**

Run:
```bash
grep -nE "referenceNumber|outboxEffects|dynamoItemSize|pendingRfq|submitTransaction|buildReceiptItem" amplify/functions/submit-rfq/handler.ts || echo "DARK: no P4b-1 imports in submit-rfq handler"
```
Expected: `DARK: no P4b-1 imports in submit-rfq handler`.

- [ ] **Step 2: Confirm the full test suite is green and typecheck passes**

Run: `npx vitest run amplify/lib/rfq/ --exclude '**/.claude/**'`
Expected: PASS.

Run: `npx tsc -p amplify --noEmit` (or the repo's configured typecheck for `amplify/`)
Expected: no errors in the new files.

- [ ] **Step 3: Commit any typecheck fixups (if needed)**

```bash
git add -A
git commit -m "chore(rfq): typecheck fixups for P4b-1 primitives" || echo "nothing to commit"
```

---

## Self-review

Run this checklist against the plan with fresh eyes before handing off.

**1. Field parity (D3):**
- [x] Both paths write `buildPendingRfqItem()` to `RFQ#<rfqId>/META` (Task 6 composer; Task 7 parity test asserts byte-equality direct vs upgrade).
- [x] Upgrade erases draft-only attributes via full-item `Put` — verified in Task 7 (`draftTokenHash`/`draftVersion`/`lastActivityAt`/`expiresAt` absent; `GSI1PK/SK` flipped to pending).
- [x] `matchedOrgId`/`GSI2PK`/`attachmentKeys` omitted from both paths (Task 4 test).
- [x] Whitelist enforced structurally — `turnstileToken`/`attachmentKeys` unreadable (Task 4 superset test).

**2. Outbox progression (D1/D2):**
- [x] Only root effects created in the submit transaction (Task 6); successor creation is P4b-2 (out of scope, but `EFFECT_SUCCESSORS` + `buildOutboxEffectItem.successors` carry the graph forward).
- [x] Graph is frozen + module-internal, no caller-supplied edges (Task 2 freeze test).
- [x] No fan-in (Task 2 parent-count test) → no coordinator, matching the decision.
- [x] No-attachment rule promotes email effects to roots (Task 2 + Task 6 root-tuple tests).
- [x] Deterministic successor keys + `attribute_not_exists` for safe completion-tx retry (D1a; `buildOutboxEffectItem` key + Task 6 condition).

**3. DynamoDB limits (D5):**
- [x] Size guard is a conservative estimator, not `JSON.stringify` (Task 3 over-count test).
- [x] `assertWithinItemLimits` wired into the composer (Task 6 bloat test).
- [x] Fixed root tuple bounds action count ≤ 5 (Task 6 length assertions).

**4. Receipt (D4):**
- [x] `buildReceiptItem` shared by `recordReceipt` and the transaction (Task 5 refactor; Task 6 uses it).
- [x] Receipt stores only terminal fields, no PII (Task 5 no-PII test).

**5. Dark-ship:**
- [x] No handler wiring; verified by Task 8 grep. #311 remains a blocked historical record, superseded by this document.

**6. Placeholder scan:** no `TBD`/`TODO`/"handle edge cases"/uncoded steps; every code step carries complete, copy-runnable code.

**7. Type consistency:** `PendingRfqSource`/`PendingRfqMeta`/`PendingRfqItem` (Task 4) match their use in Tasks 6–7; `buildReceiptItem` signature (Task 5) matches its call in Task 6; `OutboxEffectName`/`submitRootEffects`/`buildOutboxEffectItem` (Task 2) match Task 6; `SubmitTransactionParams` fields match every test constructor.

---

## Out of scope (later P4b phases)

- **P4b-2:** the `rfq-outbox-worker` (DynamoDB Streams + Lambda event-source mapping), stage-ordered drain via next-stage transactional creation, leases, DLQ, retries/backoff, alarms, at-most-once email claim-before-send.
- **P4b-3:** frontend sends `X-RFQ-Submit-Key` (compat, ignored), then the handler opt-in accepts the idempotent path; the authenticated draft read that produces `{storedHash, expectedVersion}`; canonicalization + binding; strongly-consistent receipt read to disambiguate a cancelled transaction; reconstruct the `200 {success, message, referenceNumber, rfqId}` replay; full legacy `handler.test.ts` suite unchanged (record the actual count at execution time).
- **P4b-4:** make the header mandatory, soak, remove the legacy branch + flag; rollback = receipt-aware routing + paused producer + drained outbox (receipts persist).
