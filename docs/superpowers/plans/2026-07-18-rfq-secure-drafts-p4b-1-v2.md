# RFQ Secure Drafts P4b-1 v2 — Submit Transaction & Outbox Data-Plane Primitives

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the pure, dark, fakeDdb-tested primitives for the idempotent RFQ submit path AND its dependency-ordered outbox **data plane** — the authoritative pending-RFQ item, the shared receipt item, a stable transaction idempotency token, the typed effect item schema (durable **input** and **result**), and every transaction builder in the effect lifecycle (submit, claim, completion, email claim-before-send), each proving atomic progression against `FakeDdb` before any real side effect is wired.

**Architecture:** One atomic `TransactWrite` writes the pending RFQ item, the idempotency receipt, and the **root** outbox effect records (carrying their durable inputs). Effects run a three-state lease lifecycle — `pending → processing → done` — driven by pure transaction builders: a worker (P4b-2, out of scope) *claims* an effect (acquiring a fenced lease), performs the real side effect, then *completes* it in one transaction that conditionally marks it done, persists its typed **result**, backfills the RFQ item where required (`matchedOrgId`, moved `attachmentKeys`), and transactionally creates its successors. The effect graph is a true two-branch DAG with no fan-in, so no coordinator is needed. Email effects use a distinct **claim-before-send latch** (`pending → send-claimed → done`) with no lease-expiry re-claim, encoding the at-most-once-with-possible-loss contract.

**Tech Stack:** TypeScript, `@aws-sdk/lib-dynamodb` (`TransactWriteCommand`, `PutCommand`, `UpdateCommand`), Node `crypto`, Vitest, the in-repo `FakeDdb` harness (`amplify/functions/price-api/lib/testing/fakeDdb.ts`).

**Status:** Ships **DARK** — new pure modules plus one internal refactor (`recordReceipt`). Wires **nothing** into `submit-rfq/handler.ts`. Live cutover is P4b-3; the outbox worker runtime is P4b-2.

**History:** Fresh redo after two rejections (#310 BLOCKED umbrella; #311 BLOCKED P4b-1 draft) and two rounds of independent review on this v2. #311 stays a blocked historical record, superseded here.

---

## Settled architecture (normative decisions & invariants)

Design rationale + invariants only; the sole source of truth for code is the task list.

### D1 — Outbox progression: next-stage transactional creation (not a coordinator)
DynamoDB Streams emit one event per item change; inserting all stages up front dead-ends because nothing re-wakes a downstream stage. **Decision:** the submit transaction creates only **root** effects; each effect, on completion, transactionally creates its direct successors, whose `INSERT` is the wake event. No coordinator — this graph has no fan-in to join.
- **D1a:** successor `Put`s use deterministic keys + `attribute_not_exists(PK)` so a completion retry cannot double-create a successor.
- **D1b:** the successor graph is a frozen constant, **not caller-supplied**. Builders reject caller edges; the submit path passes only a fixed, derived root tuple.

### D2 — Effect graph: true two-branch DAG
Per `submit-rfq/handler.ts`, the confirmation/internal emails consume only `data`, `referenceNumber`, and the attachment-move outcome — nothing from org/visitor/CRM. So:
```
submit transaction (RFQ item + receipt + root effects)
├── org-upsert ──► visitor-bridge          (needs matchedOrgId)
│             └──► crm-emit                (needs matchedOrgId)
└── attachment-move ──► confirmation-email
                   └──► internal-email      (emails need attachment outcome only)
```
- **D2a — no-attachment rule:** with no attachments, skip `attachment-move`; the two email effects become **roots**. Root tuple is exactly one of `['org-upsert','attachment-move']` or `['org-upsert','confirmation-email','internal-email']`, **derived** from whether validated temp keys are present — never a free-floating boolean.

### D3 — One authoritative pending-RFQ projection; parity by construction
The draft and pending RFQ share `RFQ#<rfqId>/META` (verified: `draftStore.ts` `draftPk`+`SK:'META'`). Both submit paths write the same `buildPendingRfqItem()` output to that key, differing only in the `Put` condition:

| Path | Condition |
|---|---|
| Direct | `attribute_not_exists(PK)` |
| Draft upgrade | `#status = :draft AND draftTokenHash = :h AND draftVersion = :v AND expiresAt > :now` |

- The draft-upgrade condition **must keep `#status = :draft` as its first atom.** Under `FakeDdb`, a `>` atom on a missing item throws a generic error rather than a cancellation; leading with the status atom short-circuits `.every()` on a missing/absent draft so the transaction cancels as intended (Task 11's missing-draft test). Do not reorder to lead with `expiresAt > :now`.
- **D3a:** a `Put` replaces the whole item, so the upgrade erases every draft-only attribute (no REMOVE list) — #311 finding 3 made structurally impossible.
- **D3b:** the pending item is built from the validated formal submission only, never the draft's stored partial fields.
- **D3c:** `:h` is the **exact** stored `draftTokenHash` from the strongly-consistent authenticated read — never recomputed from the request token — so a rotated-but-still-supported pepper key still upgrades.
- **D3d:** `draftVersion = :v` guards against silently clobbering an autosave `PATCH` between the read and the commit. `v`/`h` come from the authenticated read (P4b-3), not this phase.
- **D3e:** `buildPendingRfqItem` consumes a narrow `PendingRfqSource` that structurally excludes `turnstileToken`, credentials, and the raw `attachmentKeys`. `PendingRfqSource.email` is the **already validated/normalized** value (`normalizeRfqEmail` lowercases + NFC — `contract.ts:94`). The builder derives one `normalizedEmail` (`trim().toLowerCase()`) and uses it for **both** `item.email` and `GSI4PK`, so the two cannot diverge; for a normalized input this is a no-op and byte-identical to the live item.
- **D3f:** the item omits `matchedOrgId`/`GSI2PK` and `attachmentKeys` — these are **effect backfills** (below), applied identically on both paths, so parity holds.
- **D3g:** `deriveReferenceNumber(rfqId, submittedAt)` is shared; a legacy direct id yields the byte-identical historical `RFQ-YYYYMMDD-<4 hex>`, a base64url draft id yields `RFQ-<submittedAt date>-<4 hex of SHA-256(rfqId)>`. The reference is a **display** value only — the 4-hex suffix is 16 bits and not collision-proof; `rfqId` is the authoritative identifier. **Precondition:** every historical direct id is canonical `rfq-<8 digits>-<lowercase hex>` (`generateRfqId` = date + `randomBytes(3).toString('hex')`, `handler.ts:180-184`), which the strict legacy regex matches exactly. A non-canonical id (extra hyphens / uppercase) would route to the draft-digest branch and produce a *different* reference — but no such id exists in production.

### D4 — Receipt as a transaction item (shared builder)
`recordReceipt` is a standalone conditional `PutCommand` and is not transaction-composable. A pure `buildReceiptItem()` is shared by `recordReceipt` and the submit transaction so the two cannot drift. The receipt stores only terminal fields, never PII.

### D5 — Transaction idempotency + limits
- **D5a — `ClientRequestToken`:** the submit transaction carries a stable, ≤36-char `ClientRequestToken` derived from the submit key (`deriveClientRequestToken`). It upgrades a lost-response SDK retry (within DynamoDB's ~10-minute window) from "cancel, then resolve by receipt read" to "returns the original result." It is **belt-and-suspenders** with the receipt barrier, not a replacement. Its transactional effect is a real-DynamoDB behavior and is **not** asserted via `FakeDdb` (which ignores it); only its stability + length are unit-tested.
- **D5b — size guards:** `estimateDynamoItemBytes` is a conservative estimator over JSON scalars/lists/maps that **throws** on unsupported value types (`Buffer`/`Set`/`BigInt`/function) rather than under-count. The submit builder guards **every** item against the 400 KB item limit and the **transaction total** against 4 MB.
- **D5c — bounded actions + no duplicate targets:** the fixed root tuple bounds actions (submit = 4 or 5). The submit builder asserts no two transaction items share a primary key (real DynamoDB rejects that; `FakeDdb` does not, so the builder must).

### D6 — Effect data plane & three-state lease lifecycle
The outbox is not just control flow — every effect must carry a **durable input** and persist a **durable result**, atomically with progression.

**Effect item schema** (`PK: RFQ#<rfqId>, SK: OUTBOX#<effect>`):
`effect`, `status` (`'pending'|'processing'|'done'`; email adds `'send-claimed'`), `successors`, `version` (number), `leaseOwner` (string|null), `leaseExpiresAt` (**epoch ms number**|null), `attempts`, `createdAt`, optional `claimedAt`/`completedAt`, optional typed `input`, optional typed `result`.

**Durable inputs:** only `attachment-move` needs an effect-specific input, `input: { tempKeys: string[] }` (validated `temp/rfq/` keys), persisted in the submit transaction. All other effects derive their input from the durable pending RFQ item plus upstream results.

**Durable results (types match the real helpers — verified):**
- `org-upsert`: `{ matchedOrgId: string | null }` (`invoke-org-api.ts:27`).
- `visitor-bridge`: `{ created: boolean; orgUpgraded: boolean }` (`visitor-bridge.ts:38`).
- `crm-emit`: `{ accepted: true }` — the CRM helpers return `Promise<void>` and a 202 means only that the Lambda *accepted* the event, not that the projection succeeded (`invoke-crm-api.ts:8-11`); there is **no** `eventId`. The P4b-2 crm-emit effect MUST invoke with `{ sync: true }` so dispatch/`FunctionError` propagates and the completion runs only after acceptance — the default fire-and-forget path (which logs+swallows) must not be used, or `accepted` would be a false fact. Acceptance ≠ projection; the CRM reconciliation sweep heals projection.
- `attachment-move`: `{ movedKeys: string[]; failedKeys: string[] }` (`MoveAttachmentsResult`, `handler.ts:297-302`).
- `confirmation-email`/`internal-email`: `{ attemptedAt: string; outcome: 'accepted' | 'failed' | 'unknown' }` — the outcome is observed from the send call (SendGrid non-2xx → `failed`, timeout/unknown-ack → `unknown`); a `send-claimed` crash leaves no `done`/result and is alarmed (P4b-2).

**Lifecycle (normal effect)** — `pending → processing → done`:
  `status`, `version`, and `result` are DynamoDB reserved words, so every expression below aliases them (`#status`/`#version`/`#result`), matching `draftStore.ts`.
- **Claim** (`buildEffectClaimItems`): `Update`, condition fresh `attribute_exists(PK) AND #status = :pending AND #version = :ev`, or expired-reclaim `#status = :processing AND leaseExpiresAt < :nowMs AND #version = :ev`; sets `status='processing'`, `leaseOwner`, `leaseExpiresAt=:nowMs+leaseMs`, `version=:ev+1`, `claimedAt`, `ADD attempts 1`. The post-claim version is the **claimedVersion**.
- **Complete** (`buildEffectCompletionItems`): one `TransactWrite`:
  1. `Update OUTBOX#<effect>` condition `#status = :processing AND leaseOwner = :owner AND #version = :cv` → `status='done'`, `result`, `completedAt`, `version=:cv+1`.
  2. *(effects that backfill)* `Update RFQ#<id>/META` condition `attribute_exists(PK) AND #status = :pendingRfq`: org sets `matchedOrgId`+`GSI2PK` **only when non-null**; attachment sets `attachmentKeys = movedKeys`. `failedKeys` are **not** projected onto the RFQ (parity with today) — emails read them from the attachment effect item's `result`.
  3. `Put OUTBOX#<successor>` each with `attribute_not_exists(PK)`.
- **Fencing:** an expired-lease re-claim bumps `version`, so a stale worker's completion (holding the old `claimedVersion`) cancels — no double result, no double successor, no double backfill.
- **D6a — side-effect duplicate window:** the data plane guarantees exactly-once **result persistence + progression**, NOT exactly-once external side effects. A worker that performs a side effect then crashes before its completion transaction will re-run it after re-claim. Non-email effects must therefore be **destination-idempotent** (org upsert keyed by email; attachment move checks the deterministic destination before deleting the source; CRM heals via its reconciliation sweep). Those idempotency mechanisms live in the effect implementations (P4b-2); this phase only defines the durable contract that makes them expressible.
- **D6b — expired leases do not self-wake.** A DynamoDB Stream event fires on a write, never on the passage of time. A worker that claims an effect (writing `processing`) then crashes leaves it `processing` with an expired lease and **no** event to re-trigger it. The expired-lease re-claim path exists in the builder, but something must *invoke* it. **P4b-2 MUST run a scheduled lease sweeper/reconciler** (e.g. an EventBridge-scheduled scan for `processing` items past `leaseExpiresAt`) that re-claims and re-drives them. Stream-only progression is insufficient; this is a hard requirement, not an optimization.

### D7 — Email at-most-once claim-before-send latch
Email effects encode "at most one automatic send attempt, delivery may be lost, never auto-resent." Lifecycle `pending → send-claimed → done`, with **no** lease-expiry re-claim:
- **Claim** (`buildEmailClaimItems`): `Update` condition `#status = :pending`; sets `status='send-claimed'`, `claimedAt`, `leaseOwner`. Committed **before** the send.
- **Finalize** (`buildEmailFinalizeItems`): `Update` condition `#status = :sendClaimed AND leaseOwner = :owner`; sets `status='done'`, `result` (`{attemptedAt, outcome}`), `completedAt`. The outcome (`accepted`/`failed`/`unknown`) is recorded whether or not the send succeeded — the latch guarantees at most one attempt, not delivery.
- A crash while `send-claimed` is terminal — the email is never re-attempted; an operator alarm (P4b-2) inspects delivery. Email effects have no successors and no RFQ backfill.

---

## Interfaces / file map
All in `amplify/lib/rfq/`, pure, dark until P4b-3/P4b-2 consume them.

| File | Responsibility | Key exports |
|---|---|---|
| `referenceNumber.ts` (new) | Reference number for both id schemes | `deriveReferenceNumber` |
| `clientRequestToken.ts` (new) | Stable ≤36-char transaction token | `deriveClientRequestToken` |
| `dynamoItemSize.ts` (new) | Conservative size estimator + guards | `estimateDynamoItemBytes`, `MAX_ITEM_BYTES`, `MAX_TRANSACTION_BYTES`, `assertWithinItemLimits` |
| `outboxEffects.ts` (new) | Effect graph, item schema, typed input/result, root tuples | `OutboxEffectName`, `EFFECT_SUCCESSORS`, `submitRootEffects`, `OutboxEffectItem`, `OrgUpsertResult`/`VisitorBridgeResult`/`CrmEmitResult`/`AttachmentMoveResult`/`EmailResult`, `buildOutboxEffectItem` |
| `pendingRfq.ts` (new) | Authoritative pending projection | `PendingRfqSource`, `PendingRfqMeta`, `PendingRfqItem`, `buildPendingRfqItem` |
| `receiptStore.ts` (modify) | Shared receipt builder + refactor | `ReceiptItem`, `buildReceiptItem` (+ unchanged `recordReceipt`/`checkReceipt`) |
| `submitTransaction.ts` (new) | Compose the atomic submit transaction | `SubmitTransactionParams` (discriminated union), `buildSubmitTransaction` |
| `effectTransitions.ts` (new) | Claim / completion / email-latch builders | `buildEffectClaimItems`, `buildEffectCompletionItems`, `buildEmailClaimItems`, `buildEmailFinalizeItems` |

---

## Tasks

### Task 1: `deriveReferenceNumber`

**Files:** Create `amplify/lib/rfq/referenceNumber.ts`; Test `amplify/lib/rfq/referenceNumber.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// amplify/lib/rfq/referenceNumber.test.ts
import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import { deriveReferenceNumber } from './referenceNumber';

describe('deriveReferenceNumber', () => {
  it('preserves the exact legacy format for a direct rfq id', () => {
    expect(deriveReferenceNumber('rfq-20260310-a1b2c3', '2026-03-10T12:00:00.000Z'))
      .toBe('RFQ-20260310-A1B2');
  });

  it('derives a dated reference from submittedAt for a base64url draft id', () => {
    const rfqId = 'aB-cd_EF0123456789ghijklmnopqrstuvwxyzABCDEF';
    expect(deriveReferenceNumber(rfqId, '2026-07-18T09:30:00.000Z')).toMatch(/^RFQ-20260718-[0-9A-F]{4}$/);
  });

  it('is deterministic across times on the same date for a draft id', () => {
    const rfqId = 'aB-cd_EF0123456789ghijklmnopqrstuvwxyzABCDEF';
    expect(deriveReferenceNumber(rfqId, '2026-07-18T09:30:00.000Z'))
      .toBe(deriveReferenceNumber(rfqId, '2026-07-18T23:59:59.000Z'));
  });

  it('does not misclassify a hyphenated base64url id as legacy', () => {
    const rfqId = '12345678-abcdefg_hijk';
    const suffix = crypto.createHash('sha256').update(rfqId).digest('hex').slice(0, 4).toUpperCase();
    expect(deriveReferenceNumber(rfqId, '2026-07-18T00:00:00.000Z')).toBe(`RFQ-20260718-${suffix}`);
  });
});
```

- [ ] **Step 2: Run test to verify it fails** — `npx vitest run amplify/lib/rfq/referenceNumber.test.ts` → FAIL (module missing).

- [ ] **Step 3: Write minimal implementation**

```ts
// amplify/lib/rfq/referenceNumber.ts
import crypto from 'node:crypto';

/**
 * Human-facing DISPLAY reference, stable across both rfqId schemes. Not a unique
 * key — the 4-hex suffix is 16 bits and can collide; `rfqId` is authoritative.
 *
 * Direct ids `rfq-YYYYMMDD-<hex>` keep the byte-identical historical reference.
 * Draft ids are base64url(SHA-256(...)) (contain '-'/'_', no date), so we take the
 * date from submittedAt + a 4-hex digest of the id. The strict legacy regex
 * (`\d{8}` then all-lowercase-hex to end) cannot match a 43-char mixed-case
 * base64url id, so the schemes never collide.
 */
export function deriveReferenceNumber(rfqId: string, submittedAt: string): string {
  const legacy = /^rfq-(\d{8})-([0-9a-f]+)$/.exec(rfqId);
  if (legacy) return `RFQ-${legacy[1]}-${legacy[2].slice(0, 4).toUpperCase()}`;
  const date = submittedAt.slice(0, 10).replace(/-/g, '');
  const digest = crypto.createHash('sha256').update(rfqId).digest('hex').slice(0, 4).toUpperCase();
  return `RFQ-${date}-${digest}`;
}
```

- [ ] **Step 4: Run test to verify it passes** — `npx vitest run amplify/lib/rfq/referenceNumber.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add amplify/lib/rfq/referenceNumber.ts amplify/lib/rfq/referenceNumber.test.ts
git commit -m "feat(rfq): shared reference-number derivation for both id schemes"
```

---

### Task 2: `deriveClientRequestToken`

**Files:** Create `amplify/lib/rfq/clientRequestToken.ts`; Test `amplify/lib/rfq/clientRequestToken.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// amplify/lib/rfq/clientRequestToken.test.ts
import { describe, it, expect } from 'vitest';
import { deriveClientRequestToken } from './clientRequestToken';

const KEY = Buffer.alloc(32, 7).toString('base64url'); // valid 32-byte credential

describe('deriveClientRequestToken', () => {
  it('is stable for the same submit key (idempotent retries share a token)', () => {
    expect(deriveClientRequestToken(KEY)).toBe(deriveClientRequestToken(KEY));
  });

  it('differs for different submit keys', () => {
    const other = Buffer.alloc(32, 8).toString('base64url');
    expect(deriveClientRequestToken(KEY)).not.toBe(deriveClientRequestToken(other));
  });

  it('is at most 36 characters (DynamoDB ClientRequestToken limit)', () => {
    expect(deriveClientRequestToken(KEY).length).toBeLessThanOrEqual(36);
    expect(deriveClientRequestToken(KEY).length).toBeGreaterThan(0);
  });

  it('rejects a malformed submit key', () => {
    expect(() => deriveClientRequestToken('not base64url!!')).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails** — `npx vitest run amplify/lib/rfq/clientRequestToken.test.ts` → FAIL (module missing).

- [ ] **Step 3: Write minimal implementation**

```ts
// amplify/lib/rfq/clientRequestToken.ts
import crypto from 'node:crypto';
import { decodeCredential } from './draftCredentials';

const TOKEN_DOMAIN = 'ninescrolls/rfq-submit-crt/v1';

/**
 * Stable, ≤36-char DynamoDB ClientRequestToken derived from the 32-byte submit key.
 * Domain-separated so it never equals the receipt id or the key itself. 27 bytes of
 * digest → 36 base64url chars (216 bits) — well within the 36-char limit and
 * collision-resistant. Belt-and-suspenders with the receipt barrier (D5a).
 */
export function deriveClientRequestToken(submitKeyB64: string): string {
  const keyBytes = decodeCredential(submitKeyB64); // enforces exactly 32 bytes
  const digest = crypto.createHash('sha256').update(TOKEN_DOMAIN).update(keyBytes).digest();
  return digest.subarray(0, 27).toString('base64url'); // 27 bytes → 36 chars, no padding
}
```

- [ ] **Step 4: Run test to verify it passes** — `npx vitest run amplify/lib/rfq/clientRequestToken.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add amplify/lib/rfq/clientRequestToken.ts amplify/lib/rfq/clientRequestToken.test.ts
git commit -m "feat(rfq): stable <=36-char ClientRequestToken from submit key"
```

---

### Task 3: `dynamoItemSize`

**Files:** Create `amplify/lib/rfq/dynamoItemSize.ts`; Test `amplify/lib/rfq/dynamoItemSize.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// amplify/lib/rfq/dynamoItemSize.test.ts
import { describe, it, expect } from 'vitest';
import {
  estimateDynamoItemBytes, assertWithinItemLimits, MAX_ITEM_BYTES,
} from './dynamoItemSize';

describe('estimateDynamoItemBytes', () => {
  it('counts UTF-8 name + value bytes plus overhead (over-counts payload)', () => {
    expect(estimateDynamoItemBytes({ a: 'bc' })).toBeGreaterThan(3);
  });

  it('counts multibyte UTF-8 by byte length', () => {
    expect(estimateDynamoItemBytes({ k: '€' })).toBeGreaterThan(estimateDynamoItemBytes({ k: 'x' }));
  });

  it('over-counts vs JSON.stringify for a text-heavy item', () => {
    const item = { PK: 'RFQ#x', SK: 'META', body: 'y'.repeat(1000) };
    expect(estimateDynamoItemBytes(item)).toBeGreaterThan(JSON.stringify(item).length);
  });

  it('handles nested lists/maps/numbers/booleans/null', () => {
    expect(() => estimateDynamoItemBytes({
      n: 12345, b: true, nul: null, arr: [1, 'two', { three: 3 }], obj: { a: { b: 'c' } },
    })).not.toThrow();
  });

  it('throws (fail-closed) on unsupported value types', () => {
    expect(() => estimateDynamoItemBytes({ buf: Buffer.from('x') })).toThrow(/unsupported/i);
    expect(() => estimateDynamoItemBytes({ big: BigInt(1) })).toThrow(/unsupported/i);
    expect(() => estimateDynamoItemBytes({ set: new Set([1]) })).toThrow(/unsupported/i);
  });

  it('rejects undefined (not storable) but accepts null', () => {
    expect(() => estimateDynamoItemBytes({ u: undefined })).toThrow(/undefined/i);
    expect(() => estimateDynamoItemBytes({ nested: { u: undefined } })).toThrow(/undefined/i);
    expect(() => estimateDynamoItemBytes({ n: null })).not.toThrow();
  });

  it('rejects non-finite numbers', () => {
    expect(() => estimateDynamoItemBytes({ n: NaN })).toThrow(/non-finite/i);
    expect(() => estimateDynamoItemBytes({ n: Infinity })).toThrow(/non-finite/i);
  });
});

describe('assertWithinItemLimits', () => {
  it('accepts a small item', () => {
    expect(() => assertWithinItemLimits({ PK: 'RFQ#x', SK: 'META' })).not.toThrow();
  });

  it('throws when the estimate exceeds MAX_ITEM_BYTES', () => {
    expect(() => assertWithinItemLimits({ PK: 'x', SK: 'META', blob: 'z'.repeat(MAX_ITEM_BYTES + 1) }))
      .toThrow(/item size/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails** — `npx vitest run amplify/lib/rfq/dynamoItemSize.test.ts` → FAIL (module missing).

- [ ] **Step 3: Write minimal implementation**

```ts
// amplify/lib/rfq/dynamoItemSize.ts

/**
 * CONSERVATIVE DynamoDB item-size estimate (bytes). Over-counts real AttributeValue
 * size; never under-counts. NOT JSON.stringify length. Domain: JSON scalars, string,
 * number, boolean, null, plain arrays, plain objects. Fails closed on any other value
 * type (Buffer/Set/BigInt/function/symbol) so an unmodelled type can never slip a
 * large payload past the limit.
 */
const PER_ATTRIBUTE_OVERHEAD = 1;
// DynamoDB numbers cap at 38 significant digits (~21 bytes stored). Over-count to 38 so
// the guard can never be defeated by a large number; item numbers here are tiny anyway.
const NUMBER_BYTES = 38;
const STRUCTURAL_OVERHEAD = 3;

export const MAX_ITEM_BYTES = 400 * 1024;             // DynamoDB item hard limit
export const MAX_TRANSACTION_BYTES = 4 * 1024 * 1024; // TransactWrite payload hard limit

function utf8Bytes(s: string): number { return Buffer.byteLength(s, 'utf8'); }

function valueBytes(value: unknown): number {
  // Fail closed: `undefined` is not a storable DynamoDB value — its presence signals a
  // marshalling bug and must be rejected, not silently counted. `null` IS storable (NULL).
  if (value === undefined) throw new TypeError('dynamoItemSize: undefined is not a storable value');
  if (value === null) return 1;
  const t = typeof value;
  if (t === 'string') return utf8Bytes(value as string);
  if (t === 'number') {
    if (!Number.isFinite(value as number)) {
      throw new TypeError('dynamoItemSize: non-finite numbers (NaN/Infinity) are not storable');
    }
    return NUMBER_BYTES;
  }
  if (t === 'boolean') return 1;
  if (Array.isArray(value)) {
    return value.reduce<number>((sum, el) => sum + STRUCTURAL_OVERHEAD + valueBytes(el), 0);
  }
  if (t === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.entries(value as Record<string, unknown>).reduce<number>(
      (sum, [k, v]) => sum + STRUCTURAL_OVERHEAD + utf8Bytes(k) + valueBytes(v), 0,
    );
  }
  throw new TypeError(`dynamoItemSize: unsupported value type ${t} (${Object.prototype.toString.call(value)})`);
}

export function estimateDynamoItemBytes(item: Record<string, unknown>): number {
  return Object.entries(item).reduce<number>(
    (sum, [name, value]) => sum + PER_ATTRIBUTE_OVERHEAD + utf8Bytes(name) + valueBytes(value), 0,
  );
}

export function assertWithinItemLimits(item: Record<string, unknown>): void {
  const bytes = estimateDynamoItemBytes(item);
  if (bytes > MAX_ITEM_BYTES) throw new Error(`RFQ item size ${bytes}B exceeds limit ${MAX_ITEM_BYTES}B`);
}
```

- [ ] **Step 4: Run test to verify it passes** — `npx vitest run amplify/lib/rfq/dynamoItemSize.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add amplify/lib/rfq/dynamoItemSize.ts amplify/lib/rfq/dynamoItemSize.test.ts
git commit -m "feat(rfq): conservative fail-closed DynamoDB item-size estimator"
```

---

### Task 4: `outboxEffects` — graph, item schema, typed input/result

**Files:** Create `amplify/lib/rfq/outboxEffects.ts`; Test `amplify/lib/rfq/outboxEffects.test.ts`

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
```

- [ ] **Step 2: Run test to verify it fails** — `npx vitest run amplify/lib/rfq/outboxEffects.test.ts` → FAIL (module missing).

- [ ] **Step 3: Write minimal implementation**

```ts
// amplify/lib/rfq/outboxEffects.ts

export type OutboxEffectName =
  | 'org-upsert' | 'visitor-bridge' | 'crm-emit'
  | 'attachment-move' | 'confirmation-email' | 'internal-email';

/** Frozen, NOT caller-supplied — the two-branch DAG. Callers pass no edges. */
export const EFFECT_SUCCESSORS: Readonly<Record<OutboxEffectName, readonly OutboxEffectName[]>> =
  Object.freeze({
    'org-upsert': Object.freeze(['visitor-bridge', 'crm-emit']),
    'visitor-bridge': Object.freeze([]),
    'crm-emit': Object.freeze([]),
    'attachment-move': Object.freeze(['confirmation-email', 'internal-email']),
    'confirmation-email': Object.freeze([]),
    'internal-email': Object.freeze([]),
  }) as Readonly<Record<OutboxEffectName, readonly OutboxEffectName[]>>;

const ROOTS_WITH_ATTACHMENTS: readonly OutboxEffectName[] = Object.freeze(['org-upsert', 'attachment-move']);
const ROOTS_WITHOUT_ATTACHMENTS: readonly OutboxEffectName[] =
  Object.freeze(['org-upsert', 'confirmation-email', 'internal-email']);

/** The fixed root tuple — one of exactly two shapes; never an arbitrary set. */
export function submitRootEffects(hasAttachments: boolean): readonly OutboxEffectName[] {
  return hasAttachments ? ROOTS_WITH_ATTACHMENTS : ROOTS_WITHOUT_ATTACHMENTS;
}

// Typed durable inputs (only attachment-move has one).
export interface AttachmentMoveInput { tempKeys: string[] }

// Re-validate temp keys at the builder boundary (the handler validates at the schema and
// again in moveAttachments; the outbox persists them, so it must not trust the caller).
const TEMP_ATTACHMENT_KEY_RE = /^temp\/rfq\/[a-f0-9]{16}\/[a-zA-Z0-9._-]{1,200}$/;
export function isValidTempAttachmentKey(key: unknown): key is string {
  return typeof key === 'string' && TEMP_ATTACHMENT_KEY_RE.test(key) && !key.includes('..');
}

// Typed durable results — shapes verified against the real helpers.
export interface OrgUpsertResult { matchedOrgId: string | null }
export interface VisitorBridgeResult { created: boolean; orgUpgraded: boolean }
// The CRM helper's 202 means the Lambda ACCEPTED the event, NOT that the projection
// succeeded (invoke-crm-api.ts:8-11); the strongest durable fact is acceptance. The
// P4b-2 crm-emit effect MUST call with { sync: true } so a dispatch/FunctionError
// propagates and completion runs only after acceptance — never the default swallow path.
export interface CrmEmitResult { accepted: true }
export interface AttachmentMoveResult { movedKeys: string[]; failedKeys: string[] }
// Claim-before-send guarantees at most ONE automatic attempt, never delivery/acceptance.
// The result records the attempt time + an explicit outcome (a sync failure or ambiguous
// timeout is 'failed'/'unknown', not silent success).
export type EmailOutcome = 'accepted' | 'failed' | 'unknown';
export interface EmailResult { attemptedAt: string; outcome: EmailOutcome }

export type EmailEffectName = 'confirmation-email' | 'internal-email';
export function isEmailEffect(effect: OutboxEffectName): effect is EmailEffectName {
  return effect === 'confirmation-email' || effect === 'internal-email';
}

export type OutboxEffectStatus = 'pending' | 'processing' | 'send-claimed' | 'done';

export interface OutboxEffectItem {
  PK: string;
  SK: string;
  effect: OutboxEffectName;
  status: OutboxEffectStatus;
  successors: readonly OutboxEffectName[];
  version: number;
  attempts: number;
  leaseOwner: string | null;
  leaseExpiresAt: number | null; // epoch ms
  createdAt: string;
  claimedAt?: string;
  completedAt?: string;
  input?: AttachmentMoveInput;
  result?: OrgUpsertResult | VisitorBridgeResult | CrmEmitResult | AttachmentMoveResult | EmailResult;
}

export function outboxEffectKey(rfqId: string, effect: OutboxEffectName): { PK: string; SK: string } {
  return { PK: `RFQ#${rfqId}`, SK: `OUTBOX#${effect}` };
}

/** Build a fresh root/successor effect item (status 'pending', version 0, no lease). */
export function buildOutboxEffectItem(args: {
  rfqId: string; effect: OutboxEffectName; now: string; input?: AttachmentMoveInput;
}): OutboxEffectItem {
  const { rfqId, effect, now, input } = args;
  // Input boundary: only attachment-move may carry input; it MUST carry a non-empty,
  // shape-valid tempKeys list. A silently-ignored input on another effect is a bug.
  if (input && effect !== 'attachment-move') {
    throw new Error(`input is only valid for attachment-move, not ${effect}`);
  }
  if (effect === 'attachment-move') {
    if (!input || input.tempKeys.length === 0) throw new Error('attachment-move requires a non-empty tempKeys input');
    for (const k of input.tempKeys) {
      if (!isValidTempAttachmentKey(k)) throw new Error(`invalid temp attachment key: ${String(k).slice(0, 80)}`);
    }
  }
  const item: OutboxEffectItem = {
    ...outboxEffectKey(rfqId, effect),
    effect,
    status: 'pending',
    successors: [...EFFECT_SUCCESSORS[effect]],
    version: 0,
    attempts: 0,
    leaseOwner: null,
    leaseExpiresAt: null,
    createdAt: now,
  };
  if (effect === 'attachment-move' && input) item.input = input;
  return item;
}
```

- [ ] **Step 4: Run test to verify it passes** — `npx vitest run amplify/lib/rfq/outboxEffects.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add amplify/lib/rfq/outboxEffects.ts amplify/lib/rfq/outboxEffects.test.ts
git commit -m "feat(rfq): outbox effect graph, item schema, typed inputs/results"
```

---

### Task 5: `buildPendingRfqItem`

**Files:** Create `amplify/lib/rfq/pendingRfq.ts`; Test `amplify/lib/rfq/pendingRfq.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// amplify/lib/rfq/pendingRfq.test.ts
import { describe, it, expect } from 'vitest';
import { buildPendingRfqItem, type PendingRfqSource, type PendingRfqMeta } from './pendingRfq';

const META: PendingRfqMeta = {
  rfqId: 'rfq-20260718-abc123', submittedAt: '2026-07-18T09:30:00.000Z',
  ipHash: 'a'.repeat(64), referenceNumber: 'RFQ-20260718-ABC1',
};

// email arrives ALREADY normalized (lowercased/NFC) by the rfqSchema transform.
const FULL: PendingRfqSource = {
  name: 'Ada Lovelace', email: 'ada@example.edu', phone: '+1-555-0100',
  institution: 'Analytical Engine Lab', department: 'Computing', role: 'professor',
  equipmentCategory: 'RIE', specificModel: 'RIE-500',
  applicationDescription: 'Etching test structures for a research programme.',
  keySpecifications: '4-inch wafers', quantity: 2, budgetRange: '100k-250k',
  timeline: 'within-3-months', fundingStatus: 'funded', referralSource: 'referral',
  existingEquipment: 'Old mill', additionalComments: 'None', needsBudgetaryQuote: true,
  shippingAddress: '1 Engine Way', shippingCity: 'London', shippingState: 'LDN',
  shippingZipCode: 'EC1', shippingCountry: 'UK', visitorId: 'visitor-xyz',
  referrerSource: 'insights/rie-guide',
};

describe('buildPendingRfqItem', () => {
  it('builds the full authoritative pending projection', () => {
    expect(buildPendingRfqItem(FULL, META)).toEqual({
      PK: 'RFQ#rfq-20260718-abc123', SK: 'META',
      GSI1PK: 'RFQ_STATUS#pending', GSI1SK: '2026-07-18T09:30:00.000Z#rfq-20260718-abc123',
      GSI4PK: 'EMAIL#ada@example.edu', GSI4SK: 'RFQ#2026-07-18T09:30:00.000Z',
      GSI2SK: 'RFQ#2026-07-18T09:30:00.000Z',
      rfqId: 'rfq-20260718-abc123', referenceNumber: 'RFQ-20260718-ABC1', status: 'pending',
      submittedAt: '2026-07-18T09:30:00.000Z', ipHash: 'a'.repeat(64), visitorId: 'visitor-xyz',
      name: 'Ada Lovelace', email: 'ada@example.edu', phone: '+1-555-0100',
      institution: 'Analytical Engine Lab', department: 'Computing', role: 'professor',
      equipmentCategory: 'RIE', specificModel: 'RIE-500',
      applicationDescription: 'Etching test structures for a research programme.',
      keySpecifications: '4-inch wafers', quantity: 2, budgetRange: '100k-250k',
      timeline: 'within-3-months', fundingStatus: 'funded', referralSource: 'referral',
      existingEquipment: 'Old mill', additionalComments: 'None', needsBudgetaryQuote: true,
      shippingAddress: '1 Engine Way', shippingCity: 'London', shippingState: 'LDN',
      shippingZipCode: 'EC1', shippingCountry: 'UK', referrerSource: 'insights/rie-guide', TTL: 0,
    });
  });

  it('omits effect-backfilled attributes', () => {
    const item = buildPendingRfqItem(FULL, META) as Record<string, unknown>;
    for (const k of ['matchedOrgId', 'GSI2PK', 'attachmentKeys']) expect(k in item).toBe(false);
  });

  it('omits absent optional fields (no undefined attributes)', () => {
    const minimal: PendingRfqSource = {
      name: 'Bo', email: 'bo@lab.gov', institution: 'Gov Lab', equipmentCategory: 'ICP',
      applicationDescription: 'A minimal but valid application description.', quantity: 1,
    };
    const item = buildPendingRfqItem(minimal, META) as Record<string, unknown>;
    for (const k of ['phone', 'department', 'role', 'specificModel', 'keySpecifications',
      'budgetRange', 'timeline', 'fundingStatus', 'referralSource', 'existingEquipment',
      'additionalComments', 'shippingAddress', 'shippingCity', 'shippingState',
      'shippingZipCode', 'shippingCountry', 'visitorId', 'referrerSource']) expect(k in item).toBe(false);
    expect(item.needsBudgetaryQuote).toBe(false);
    expect(Object.values(item).every((v) => v !== undefined)).toBe(true);
  });

  it('normalizes email from a single source (item.email and GSI4PK never diverge)', () => {
    const item = buildPendingRfqItem({
      name: 'Bo', email: 'MiXeD@Example.EDU', institution: 'Gov Lab', equipmentCategory: 'ICP',
      applicationDescription: 'A minimal but valid application description.', quantity: 1,
    }, META);
    expect(item.email).toBe('mixed@example.edu');
    expect(item.GSI4PK).toBe('EMAIL#mixed@example.edu');
  });

  it('cannot read turnstileToken or attachmentKeys (structural whitelist)', () => {
    const withExtras = { ...FULL, turnstileToken: 'secret', attachmentKeys: ['temp/rfq/x/f'] };
    const item = buildPendingRfqItem(withExtras as PendingRfqSource, META) as Record<string, unknown>;
    expect('turnstileToken' in item).toBe(false);
    expect('attachmentKeys' in item).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails** — `npx vitest run amplify/lib/rfq/pendingRfq.test.ts` → FAIL (module missing).

- [ ] **Step 3: Write minimal implementation**

```ts
// amplify/lib/rfq/pendingRfq.ts

/**
 * Whitelisted persisted submission fields. The parameter type IS the whitelist —
 * turnstileToken, submitIdempotencyKey, draft credentials, and raw attachmentKeys are
 * structurally absent. `email` is the already-normalized (lowercased/NFC) value from
 * the validated rfqSchema; it is stored verbatim.
 */
export interface PendingRfqSource {
  name: string; email: string; phone?: string; institution: string; department?: string;
  role?: string; equipmentCategory: string; specificModel?: string; applicationDescription: string;
  keySpecifications?: string; quantity: number; budgetRange?: string; timeline?: string;
  fundingStatus?: string; referralSource?: string; existingEquipment?: string; additionalComments?: string;
  needsBudgetaryQuote?: boolean; shippingAddress?: string; shippingCity?: string; shippingState?: string;
  shippingZipCode?: string; shippingCountry?: string; visitorId?: string; referrerSource?: string;
}

export interface PendingRfqMeta { rfqId: string; submittedAt: string; ipHash: string; referenceNumber: string }

export interface PendingRfqItem {
  PK: string; SK: 'META'; GSI1PK: 'RFQ_STATUS#pending'; GSI1SK: string; GSI4PK: string; GSI4SK: string;
  GSI2SK: string; rfqId: string; referenceNumber: string; status: 'pending'; submittedAt: string;
  ipHash: string; name: string; email: string; institution: string; equipmentCategory: string;
  applicationDescription: string; quantity: number; needsBudgetaryQuote: boolean; TTL: 0;
  [attr: string]: unknown;
}

function putIfDefined(target: Record<string, unknown>, key: string, value: unknown): void {
  if (value !== undefined) target[key] = value;
}

/**
 * Authoritative pending RFQ item from the validated submission. Both submit paths
 * write THIS to RFQ#<rfqId>/META, so parity holds by construction. Omits matchedOrgId/
 * GSI2PK (org effect backfills) and attachmentKeys (attachment effect backfills).
 */
export function buildPendingRfqItem(source: PendingRfqSource, meta: PendingRfqMeta): PendingRfqItem {
  const normalizedEmail = source.email.trim().toLowerCase();
  const item: PendingRfqItem = {
    PK: `RFQ#${meta.rfqId}`, SK: 'META',
    GSI1PK: 'RFQ_STATUS#pending', GSI1SK: `${meta.submittedAt}#${meta.rfqId}`,
    GSI4PK: `EMAIL#${normalizedEmail}`, GSI4SK: `RFQ#${meta.submittedAt}`, GSI2SK: `RFQ#${meta.submittedAt}`,
    rfqId: meta.rfqId, referenceNumber: meta.referenceNumber, status: 'pending',
    submittedAt: meta.submittedAt, ipHash: meta.ipHash,
    // Single source: item.email and GSI4PK both come from normalizedEmail, so they
    // cannot diverge even if an un-normalized value ever reaches the builder. For the
    // already-normalized rfqSchema email this is a no-op (byte-identical to the live item).
    name: source.name, email: normalizedEmail, institution: source.institution,
    equipmentCategory: source.equipmentCategory, applicationDescription: source.applicationDescription,
    quantity: source.quantity, needsBudgetaryQuote: source.needsBudgetaryQuote ?? false, TTL: 0,
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

- [ ] **Step 4: Run test to verify it passes** — `npx vitest run amplify/lib/rfq/pendingRfq.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add amplify/lib/rfq/pendingRfq.ts amplify/lib/rfq/pendingRfq.test.ts
git commit -m "feat(rfq): authoritative pending-RFQ item builder (whitelisted projection)"
```

---

### Task 6: `buildReceiptItem` + `recordReceipt` refactor

**Files:** Modify `amplify/lib/rfq/receiptStore.ts`; extend `amplify/lib/rfq/receiptStore.test.ts`

- [ ] **Step 1: Write the failing test** (append)

```ts
// amplify/lib/rfq/receiptStore.test.ts  (append)
import { buildReceiptItem } from './receiptStore';

describe('buildReceiptItem', () => {
  it('builds the receipt with 7-day replay + 90-day TTL and terminal fields only', () => {
    const now = '2026-07-18T00:00:00.000Z';
    expect(buildReceiptItem('SUBMIT_RECEIPT#abc', {
      opKind: 'direct', binding: 'f'.repeat(64),
      result: { rfqId: 'rfq-20260718-abc123', referenceNumber: 'RFQ-20260718-ABC1', status: 200 }, now,
    })).toEqual({
      PK: 'SUBMIT_RECEIPT#abc', SK: 'META', opKind: 'direct', binding: 'f'.repeat(64),
      rfqId: 'rfq-20260718-abc123', referenceNumber: 'RFQ-20260718-ABC1', status: 200,
      createdAt: now, replayExpiresAt: '2026-07-25T00:00:00.000Z',
      TTL: Math.floor(Date.parse('2026-10-16T00:00:00.000Z') / 1000),
    });
  });

  it('stores no form PII', () => {
    const item = buildReceiptItem('SUBMIT_RECEIPT#abc', {
      opKind: 'draft-upgrade', binding: '0'.repeat(64),
      result: { rfqId: 'rfq-x', referenceNumber: 'RFQ-x', status: 200 }, now: '2026-07-18T00:00:00.000Z',
    }) as Record<string, unknown>;
    for (const k of ['name', 'email', 'institution', 'applicationDescription']) expect(k in item).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails** — `npx vitest run amplify/lib/rfq/receiptStore.test.ts` → FAIL (`buildReceiptItem` not exported).

- [ ] **Step 3: Write minimal implementation** — edit `receiptStore.ts`

Add the type + builder, then make `recordReceipt` call it:

```ts
// amplify/lib/rfq/receiptStore.ts  (additions)
export interface ReceiptItem {
  PK: string; SK: 'META'; opKind: SubmitOperationKind; binding: string; rfqId: string;
  referenceNumber: string; status: number; createdAt: string; replayExpiresAt: string; TTL: number;
}

/** Shared receipt-item builder — the single source for recordReceipt AND the submit transaction. */
export function buildReceiptItem(
  receiptId: string,
  args: { opKind: SubmitOperationKind; binding: string; result: StoredResult; now: string },
): ReceiptItem {
  const replayExpiresAt = new Date(Date.parse(args.now) + REPLAY_DAYS * DAY_MS).toISOString();
  const ttlExpiresAt = new Date(Date.parse(args.now) + TTL_DAYS * DAY_MS).toISOString();
  return {
    PK: receiptId, SK: 'META', opKind: args.opKind, binding: args.binding,
    rfqId: args.result.rfqId, referenceNumber: args.result.referenceNumber, status: args.result.status,
    createdAt: args.now, replayExpiresAt, TTL: Math.floor(Date.parse(ttlExpiresAt) / 1000),
  };
}
```

Replace `recordReceipt`'s body with:

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

- [ ] **Step 4: Run test to verify it passes** — `npx vitest run amplify/lib/rfq/receiptStore.test.ts` → PASS (new + all existing receipt tests unchanged).

- [ ] **Step 5: Commit**

```bash
git add amplify/lib/rfq/receiptStore.ts amplify/lib/rfq/receiptStore.test.ts
git commit -m "refactor(rfq): extract shared buildReceiptItem used by recordReceipt"
```

---

### Task 7: `buildSubmitTransaction` — atomic submit composer

**Files:** Create `amplify/lib/rfq/submitTransaction.ts`; Test `amplify/lib/rfq/submitTransaction.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// amplify/lib/rfq/submitTransaction.test.ts
import { describe, it, expect } from 'vitest';
import { buildSubmitTransaction, type SubmitTransactionParams } from './submitTransaction';
import type { PendingRfqSource, PendingRfqMeta } from './pendingRfq';

const SOURCE: PendingRfqSource = {
  name: 'Ada', email: 'ada@lab.edu', institution: 'Lab', equipmentCategory: 'RIE',
  applicationDescription: 'A valid application description.', quantity: 1,
};
const META: PendingRfqMeta = {
  rfqId: 'rfq-20260718-abc123', submittedAt: '2026-07-18T09:30:00.000Z',
  ipHash: 'a'.repeat(64), referenceNumber: 'RFQ-20260718-ABC1',
};
const SUBMIT_KEY = Buffer.alloc(32, 7).toString('base64url');

function direct(over: Partial<Extract<SubmitTransactionParams, { kind: 'direct' }>> = {}): SubmitTransactionParams {
  return {
    kind: 'direct', tableName: 'T', source: SOURCE, meta: META, tempKeys: [],
    receipt: { receiptId: 'SUBMIT_RECEIPT#r', binding: 'b'.repeat(64), status: 200 },
    submitKeyB64: SUBMIT_KEY, now: '2026-07-18T09:30:00.000Z', ...over,
  };
}

describe('buildSubmitTransaction — direct', () => {
  it('composes pending Put + receipt Put + email roots when no attachments', () => {
    const { TransactItems, ClientRequestToken } = buildSubmitTransaction(direct());
    expect(TransactItems).toHaveLength(5);
    expect(TransactItems![0].Put!.Item!.PK).toBe('RFQ#rfq-20260718-abc123');
    expect(TransactItems![0].Put!.ConditionExpression).toBe('attribute_not_exists(PK)');
    expect(TransactItems![1].Put!.Item!.PK).toBe('SUBMIT_RECEIPT#r');
    expect(TransactItems!.slice(2).map((i) => i.Put!.Item!.SK))
      .toEqual(['OUTBOX#org-upsert', 'OUTBOX#confirmation-email', 'OUTBOX#internal-email']);
    expect(ClientRequestToken).toHaveLength(36);
    for (const i of TransactItems!) expect(i.Put!.TableName).toBe('T');
  });

  it('uses attachment-move root (carrying tempKeys) when attachments present', () => {
    const keys = ['temp/rfq/aaaaaaaaaaaaaaaa/file.pdf'];
    const { TransactItems } = buildSubmitTransaction(direct({ tempKeys: keys }));
    expect(TransactItems).toHaveLength(4);
    const roots = TransactItems!.slice(2);
    expect(roots.map((i) => i.Put!.Item!.SK)).toEqual(['OUTBOX#org-upsert', 'OUTBOX#attachment-move']);
    const attach = roots.find((i) => i.Put!.Item!.SK === 'OUTBOX#attachment-move')!;
    expect(attach.Put!.Item!.input).toEqual({ tempKeys: keys });
  });

  it('rejects a pending item over the item-size limit', () => {
    expect(() => buildSubmitTransaction(direct({ source: { ...SOURCE, additionalComments: 'z'.repeat(500 * 1024) } })))
      .toThrow(/item size/i);
  });
});

describe('buildSubmitTransaction — draft-upgrade', () => {
  it('uses the 4-clause draft condition with the stored hash verbatim', () => {
    const params: SubmitTransactionParams = {
      kind: 'draft-upgrade', tableName: 'T', source: SOURCE, meta: META, tempKeys: [],
      receipt: { receiptId: 'SUBMIT_RECEIPT#r', binding: 'b'.repeat(64), status: 200 },
      submitKeyB64: SUBMIT_KEY, now: '2026-07-18T09:30:00.000Z',
      draftPrecondition: { storedHash: 'v1:' + 'a'.repeat(64), expectedVersion: 3 },
    };
    const p = buildSubmitTransaction(params).TransactItems![0].Put!;
    expect(p.ConditionExpression)
      .toBe('#status = :draft AND draftTokenHash = :h AND draftVersion = :v AND expiresAt > :now');
    expect(p.ExpressionAttributeNames).toEqual({ '#status': 'status' });
    expect(p.ExpressionAttributeValues).toEqual({
      ':draft': 'draft', ':h': 'v1:' + 'a'.repeat(64), ':v': 3, ':now': '2026-07-18T09:30:00.000Z',
    });
  });
});

describe('buildSubmitTransaction — parity + guards', () => {
  it('writes a byte-identical pending item on both paths for the same source + meta', () => {
    const d = buildSubmitTransaction(direct());
    const u = buildSubmitTransaction({
      kind: 'draft-upgrade', tableName: 'T', source: SOURCE, meta: META, tempKeys: [],
      receipt: { receiptId: 'SUBMIT_RECEIPT#r', binding: 'b'.repeat(64), status: 200 },
      submitKeyB64: SUBMIT_KEY, now: '2026-07-18T09:30:00.000Z',
      draftPrecondition: { storedHash: 'v1:' + 'a'.repeat(64), expectedVersion: 1 },
    });
    expect(u.TransactItems![0].Put!.Item).toEqual(d.TransactItems![0].Put!.Item);
  });

  it('produces a stable ClientRequestToken for the same submit key', () => {
    expect(buildSubmitTransaction(direct()).ClientRequestToken)
      .toBe(buildSubmitTransaction(direct()).ClientRequestToken);
  });
});
```

- [ ] **Step 2: Run test to verify it fails** — `npx vitest run amplify/lib/rfq/submitTransaction.test.ts` → FAIL (module missing).

- [ ] **Step 3: Write minimal implementation**

```ts
// amplify/lib/rfq/submitTransaction.ts
import type { TransactWriteCommandInput } from '@aws-sdk/lib-dynamodb';
import { buildPendingRfqItem, type PendingRfqSource, type PendingRfqMeta } from './pendingRfq';
import { buildReceiptItem } from './receiptStore';
import type { SubmitOperationKind } from './submitReceipt';
import { submitRootEffects, buildOutboxEffectItem } from './outboxEffects';
import { deriveClientRequestToken } from './clientRequestToken';
import {
  assertWithinItemLimits, estimateDynamoItemBytes, MAX_TRANSACTION_BYTES,
} from './dynamoItemSize';

type TransactItem = NonNullable<TransactWriteCommandInput['TransactItems']>[number];

interface SubmitBase {
  tableName: string;
  source: PendingRfqSource;
  meta: PendingRfqMeta;
  tempKeys: string[]; // validated temp/rfq/ keys; hasAttachments is derived from .length
  receipt: { receiptId: string; binding: string; status: number };
  submitKeyB64: string;
  now: string;
}
export type SubmitTransactionParams =
  | (SubmitBase & { kind: 'direct' })
  | (SubmitBase & { kind: 'draft-upgrade'; draftPrecondition: { storedHash: string; expectedVersion: number } });

const OP_KIND: Record<SubmitTransactionParams['kind'], SubmitOperationKind> = {
  'direct': 'direct', 'draft-upgrade': 'draft-upgrade',
};

/** Compose the atomic submit transaction (TransactItems + ClientRequestToken). */
export function buildSubmitTransaction(params: SubmitTransactionParams): TransactWriteCommandInput {
  const { tableName, source, meta, tempKeys, receipt, submitKeyB64, now } = params;
  const opKind = OP_KIND[params.kind];

  const pendingItem = buildPendingRfqItem(source, meta) as unknown as Record<string, unknown>;
  const pendingCondition = params.kind === 'draft-upgrade'
    ? {
        ConditionExpression:
          '#status = :draft AND draftTokenHash = :h AND draftVersion = :v AND expiresAt > :now',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':draft': 'draft', ':h': params.draftPrecondition.storedHash,
          ':v': params.draftPrecondition.expectedVersion, ':now': now,
        },
      }
    : { ConditionExpression: 'attribute_not_exists(PK)' };

  const receiptItem = buildReceiptItem(receipt.receiptId, {
    opKind, binding: receipt.binding,
    result: { rfqId: meta.rfqId, referenceNumber: meta.referenceNumber, status: receipt.status }, now,
  }) as unknown as Record<string, unknown>;

  const hasAttachments = tempKeys.length > 0;
  const roots = submitRootEffects(hasAttachments);
  const rootItems = roots.map((effect) => buildOutboxEffectItem({
    rfqId: meta.rfqId, effect, now,
    input: effect === 'attachment-move' ? { tempKeys } : undefined,
  }) as unknown as Record<string, unknown>);

  const items: TransactItem[] = [
    { Put: { TableName: tableName, Item: pendingItem, ...pendingCondition } },
    { Put: { TableName: tableName, Item: receiptItem, ConditionExpression: 'attribute_not_exists(PK)' } },
    ...rootItems.map((Item) => ({
      Put: { TableName: tableName, Item, ConditionExpression: 'attribute_not_exists(PK)' },
    })),
  ];

  // Guard: no two transaction items may target the same primary key (real DynamoDB rejects it).
  const keys = new Set<string>();
  for (const it of items) {
    const item = it.Put!.Item as { PK: string; SK: string };
    const k = `${item.PK}|${item.SK}`;
    if (keys.has(k)) throw new Error(`Duplicate transaction target ${k}`);
    keys.add(k);
  }
  // Guard: each item within the 400 KB item limit; whole transaction within 4 MB.
  let total = 0;
  for (const it of items) {
    const item = it.Put!.Item as Record<string, unknown>;
    assertWithinItemLimits(item);
    total += estimateDynamoItemBytes(item);
  }
  if (total > MAX_TRANSACTION_BYTES) throw new Error(`Transaction size ${total}B exceeds ${MAX_TRANSACTION_BYTES}B`);

  return { TransactItems: items, ClientRequestToken: deriveClientRequestToken(submitKeyB64) };
}
```

- [ ] **Step 4: Run test to verify it passes** — `npx vitest run amplify/lib/rfq/submitTransaction.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add amplify/lib/rfq/submitTransaction.ts amplify/lib/rfq/submitTransaction.test.ts
git commit -m "feat(rfq): compose atomic submit transaction (direct + upgrade, guarded)"
```

---

### Task 8: `buildEffectClaimItems` — pending→processing lease acquire

**Files:** Create `amplify/lib/rfq/effectTransitions.ts`; Test `amplify/lib/rfq/effectTransitions.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails** — `npx vitest run amplify/lib/rfq/effectTransitions.test.ts` → FAIL (module missing).

- [ ] **Step 3: Write minimal implementation**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes** — `npx vitest run amplify/lib/rfq/effectTransitions.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add amplify/lib/rfq/effectTransitions.ts amplify/lib/rfq/effectTransitions.test.ts
git commit -m "feat(rfq): effect claim transition (lease acquire + fencing)"
```

---

### Task 9: `buildEffectCompletionItems` — processing→done + result + backfill + successors

**Files:** Modify `amplify/lib/rfq/effectTransitions.ts`; extend `amplify/lib/rfq/effectTransitions.test.ts`

- [ ] **Step 1: Write the failing test** (append)

```ts
// amplify/lib/rfq/effectTransitions.test.ts  (append)
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
      ...CBASE, effect: 'attachment-move', result: { movedKeys: ['rfqs/rfq-1/a.pdf'], failedKeys: ['temp/rfq/x/b.pdf'] },
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
```

- [ ] **Step 2: Run test to verify it fails** — `npx vitest run amplify/lib/rfq/effectTransitions.test.ts` → FAIL (`buildEffectCompletionItems` not exported).

- [ ] **Step 3: Write minimal implementation** (append to `effectTransitions.ts`)

```ts
// amplify/lib/rfq/effectTransitions.ts  (append — do NOT re-import outboxEffectKey/OutboxEffectName;
// they are already imported by Task 8 in this same file. A second import of an existing symbol is a
// duplicate-identifier compile error.)
import type { TransactWriteCommandInput } from '@aws-sdk/lib-dynamodb';
import {
  EFFECT_SUCCESSORS, buildOutboxEffectItem, isEmailEffect,
  type AttachmentMoveResult, type CrmEmitResult,
  type OrgUpsertResult, type VisitorBridgeResult,
} from './outboxEffects';

type TransactItem = NonNullable<TransactWriteCommandInput['TransactItems']>[number];

/**
 * Discriminated union — each non-email effect is locked to its own result type, so a
 * caller cannot pair (e.g.) an org effect with an attachment result. Email effects are
 * DELIBERATELY absent: they must use the claim-before-send latch (buildEmailClaimItems /
 * buildEmailFinalizeItems), never this normal completion path.
 */
type CompletionResult =
  | { effect: 'org-upsert'; result: OrgUpsertResult }
  | { effect: 'attachment-move'; result: AttachmentMoveResult }
  | { effect: 'visitor-bridge'; result: VisitorBridgeResult }
  | { effect: 'crm-emit'; result: CrmEmitResult };

export type CompletionParams = {
  tableName: string; rfqId: string; owner: string; claimedVersion: number; now: string;
} & CompletionResult;

/** Optional RFQ#/META backfill patch for the effects that project a result onto the RFQ. */
function rfqBackfill(p: CompletionParams): { UpdateExpression: string; values: Record<string, unknown> } | null {
  if (p.effect === 'org-upsert' && p.result.matchedOrgId !== null) {
    return {
      UpdateExpression: 'SET matchedOrgId = :id, GSI2PK = :gsi2',
      values: { ':id': p.result.matchedOrgId, ':gsi2': `ORG#${p.result.matchedOrgId}` },
    };
  }
  if (p.effect === 'attachment-move') {
    return { UpdateExpression: 'SET attachmentKeys = :keys', values: { ':keys': p.result.movedKeys } };
  }
  return null;
}

/**
 * Complete a normal effect atomically: conditionally mark done (fenced on the claimed
 * version), persist the typed result, backfill the RFQ where required, and create the
 * effect's successors (attribute_not_exists → safe on retry). A stale worker's version
 * fails clause 1, cancelling the whole transaction — no double result/backfill/successor.
 */
export function buildEffectCompletionItems(p: CompletionParams): TransactItem[] {
  // Defense in depth: email effects must never reach normal completion (the type union
  // already excludes them; this guards a widened/`as`-cast call site).
  if (isEmailEffect(p.effect)) {
    throw new Error(`${p.effect} must use the email claim-before-send latch, not buildEffectCompletionItems`);
  }
  const items: TransactItem[] = [
    {
      Update: {
        TableName: p.tableName,
        Key: outboxEffectKey(p.rfqId, p.effect),
        // `result` and `version` are DynamoDB reserved words — alias both.
        UpdateExpression: 'SET #status = :done, #result = :result, completedAt = :now, #version = :nv',
        ConditionExpression: '#status = :processing AND leaseOwner = :owner AND #version = :cv',
        ExpressionAttributeNames: { '#status': 'status', '#version': 'version', '#result': 'result' },
        ExpressionAttributeValues: {
          ':done': 'done', ':processing': 'processing', ':owner': p.owner,
          ':cv': p.claimedVersion, ':nv': p.claimedVersion + 1, ':result': p.result, ':now': p.now,
        },
      },
    },
  ];

  const backfill = rfqBackfill(p);
  if (backfill) {
    items.push({
      Update: {
        TableName: p.tableName,
        Key: { PK: `RFQ#${p.rfqId}`, SK: 'META' },
        UpdateExpression: backfill.UpdateExpression,
        ConditionExpression: 'attribute_exists(PK) AND #status = :pendingRfq',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: { ...backfill.values, ':pendingRfq': 'pending' },
      },
    });
  }

  for (const successor of EFFECT_SUCCESSORS[p.effect]) {
    items.push({
      Put: {
        TableName: p.tableName,
        Item: buildOutboxEffectItem({ rfqId: p.rfqId, effect: successor, now: p.now }) as unknown as Record<string, unknown>,
        ConditionExpression: 'attribute_not_exists(PK)',
      },
    });
  }
  return items;
}
```

- [ ] **Step 4: Run test to verify it passes** — `npx vitest run amplify/lib/rfq/effectTransitions.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add amplify/lib/rfq/effectTransitions.ts amplify/lib/rfq/effectTransitions.test.ts
git commit -m "feat(rfq): effect completion transaction (result + backfill + successors)"
```

---

### Task 10: Email claim-before-send latch

**Files:** Modify `amplify/lib/rfq/effectTransitions.ts`; extend `amplify/lib/rfq/effectTransitions.test.ts`

- [ ] **Step 1: Write the failing test** (append)

```ts
// amplify/lib/rfq/effectTransitions.test.ts  (append)
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
```

- [ ] **Step 2: Run test to verify it fails** — `npx vitest run amplify/lib/rfq/effectTransitions.test.ts` → FAIL (builders not exported).

- [ ] **Step 3: Write minimal implementation** (append to `effectTransitions.ts`)

```ts
// amplify/lib/rfq/effectTransitions.ts  (append — EmailEffectName/EmailOutcome are new symbols,
// not previously imported, so this import statement is fine.)
import type { EmailEffectName, EmailOutcome } from './outboxEffects';

/**
 * At-most-once latch: pending → send-claimed, committed BEFORE the send. Conditioned
 * only on `status = pending` — there is intentionally NO lease-expiry re-claim, so a
 * crash while send-claimed is terminal and the email is never re-attempted.
 */
export function buildEmailClaimItems(p: {
  tableName: string; rfqId: string; effect: EmailEffectName; owner: string; now: string;
}): UpdateCommand {
  return new UpdateCommand({
    TableName: p.tableName,
    Key: outboxEffectKey(p.rfqId, p.effect),
    UpdateExpression: 'SET #status = :claimed, claimedAt = :now, leaseOwner = :owner',
    ConditionExpression: '#status = :pending',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: { ':pending': 'pending', ':claimed': 'send-claimed', ':owner': p.owner, ':now': p.now },
  });
}

/**
 * send-claimed → done after the single send attempt, recording attemptedAt + the
 * observed outcome (`accepted`/`failed`/`unknown`). The latch guarantees at most one
 * attempt, not delivery — so a non-success outcome is recorded, never retried.
 */
export function buildEmailFinalizeItems(p: {
  tableName: string; rfqId: string; effect: EmailEffectName; owner: string; now: string;
  attemptedAt: string; outcome: EmailOutcome;
}): UpdateCommand {
  return new UpdateCommand({
    TableName: p.tableName,
    Key: outboxEffectKey(p.rfqId, p.effect),
    // `result` is a DynamoDB reserved word — alias it.
    UpdateExpression: 'SET #status = :done, #result = :result, completedAt = :now',
    ConditionExpression: '#status = :claimed AND leaseOwner = :owner',
    ExpressionAttributeNames: { '#status': 'status', '#result': 'result' },
    ExpressionAttributeValues: {
      ':claimed': 'send-claimed', ':owner': p.owner, ':done': 'done',
      ':result': { attemptedAt: p.attemptedAt, outcome: p.outcome }, ':now': p.now,
    },
  });
}
```

- [ ] **Step 4: Run test to verify it passes** — `npx vitest run amplify/lib/rfq/effectTransitions.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add amplify/lib/rfq/effectTransitions.ts amplify/lib/rfq/effectTransitions.test.ts
git commit -m "feat(rfq): email at-most-once claim-before-send latch"
```

---

### Task 11: fakeDdb integration — full lifecycle, retries, fencing, latch

**Files:** Test `amplify/lib/rfq/submitLifecycle.integration.test.ts` (new)

Proves the composed builders behave correctly against real conditional-write semantics. **`FakeDdb` fidelity is partial** — it does NOT validate `ClientRequestToken`, duplicate targets, `TableName`, transaction byte size, or undefined marshalling (those are guarded in the builders + unit-tested separately). This suite exercises the state machine: commit, claim, complete, backfill, successor creation, retry cancellation, fencing, recovery, and the email latch.

- [ ] **Step 1: Write the lifecycle characterization tests** (these characterize the already-built Tasks 7–10 behavior end-to-end; they are not a red phase)

```ts
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
```

- [ ] **Step 2: Run the suite (characterization)** — `npx vitest run amplify/lib/rfq/submitLifecycle.integration.test.ts`. Expected: PASS with correct Tasks 7–10. A failure indicates a real builder bug; fix the builder (never weaken an assertion).

- [ ] **Step 3: Run the full rfq lib suite**

Run: `npx vitest run amplify/lib/rfq/ --exclude '**/.claude/**'`
Expected: PASS — all P4b-1 modules plus the untouched P1–P4a suites.

- [ ] **Step 4: Commit**

```bash
git add amplify/lib/rfq/submitLifecycle.integration.test.ts
git commit -m "test(rfq): fakeDdb integration for full submit+outbox lifecycle"
```

---

### Task 12: Dark-import + typecheck verification

**Files:** none (verification only)

- [ ] **Step 1: Confirm NO production entrypoint imports the new modules**

Grep every production Lambda (not just submit-rfq) for import statements from the new module paths — NOT bare identifiers (`referenceNumber` is an existing handler local, so a bare-identifier grep never confirms dark). `buildReceiptItem` is exported from the pre-existing `receiptStore` (already imported by the dark rfq-draft-api), so scope its check to a NEW import of it:
```bash
grep -rnE "from '[^']*/(referenceNumber|clientRequestToken|outboxEffects|dynamoItemSize|pendingRfq|submitTransaction|effectTransitions)'" amplify/functions \
  || echo "DARK: no production entrypoint imports the P4b-1 modules"
```
Expected: `DARK: no production entrypoint imports the P4b-1 modules`. (The frontend under `src/` cannot import server-only `amplify/lib` modules; the only consumer of `buildReceiptItem` remains `recordReceipt` within `receiptStore.ts` itself.)

- [ ] **Step 2: Full suite + typecheck green**

Run: `npx vitest run amplify/lib/rfq/ --exclude '**/.claude/**'` → PASS.
Run: `npx tsc -p amplify --noEmit` (or the repo's configured `amplify/` typecheck) → no errors in the new files.

- [ ] **Step 3: Commit any typecheck fixups (explicit files only — never `git add -A` or a bare directory)**

```bash
git add \
  amplify/lib/rfq/referenceNumber.ts amplify/lib/rfq/referenceNumber.test.ts \
  amplify/lib/rfq/clientRequestToken.ts amplify/lib/rfq/clientRequestToken.test.ts \
  amplify/lib/rfq/dynamoItemSize.ts amplify/lib/rfq/dynamoItemSize.test.ts \
  amplify/lib/rfq/outboxEffects.ts amplify/lib/rfq/outboxEffects.test.ts \
  amplify/lib/rfq/pendingRfq.ts amplify/lib/rfq/pendingRfq.test.ts \
  amplify/lib/rfq/receiptStore.ts amplify/lib/rfq/receiptStore.test.ts \
  amplify/lib/rfq/submitTransaction.ts amplify/lib/rfq/submitTransaction.test.ts \
  amplify/lib/rfq/effectTransitions.ts amplify/lib/rfq/effectTransitions.test.ts \
  amplify/lib/rfq/submitLifecycle.integration.test.ts
git commit -m "chore(rfq): typecheck fixups for P4b-1 primitives" || echo "nothing to commit"
```

---

## Self-review

**1. Effect data plane (D6) — the critical gap from review 2:**
- [x] `attachment-move` root carries durable `input.tempKeys`, re-validated at the builder boundary; input rejected on other effects (Task 4 boundary tests + Task 7 + Task 11).
- [x] Typed results match real helpers: org `{matchedOrgId:string|null}`, visitor `{created,orgUpgraded}`, crm `{accepted:true}` (void helper, 202=accepted≠projected — no invented `eventId`; P4b-2 must call `{sync:true}`), attachment `{movedKeys,failedKeys}`, email `{attemptedAt,outcome}` (Task 4).
- [x] Completion atomically marks done + persists result + backfills RFQ + creates successors (Task 9 + Task 11).
- [x] Emails read attachment outcome from the durable effect result; `failedKeys` not projected onto the RFQ (Task 9 + Task 11 attachment test).
- [x] Side-effect duplicate window named (D6a); expired leases don't self-wake → P4b-2 sweeper mandated (D6b).

**2. Lifecycle & fencing (D6/D7):**
- [x] Three-state lease lifecycle with claim (Task 8) and completion (Task 9); completion is a discriminated union that **excludes** email effects + a runtime guard, so the email latch can't be bypassed (Task 9 reject test); email latch is separate, no re-claim (Task 10).
- [x] Version fencing proven: stale completion cancels (Task 11 replay + expired-lease tests).
- [x] Lease timestamps are epoch-ms numbers so `leaseExpiresAt < :nowMs` is testable under FakeDdb.
- [x] Email double-claim blocked; single attempt with recorded outcome (Task 11 latch test).
- [x] Recovery scenarios: claim response-loss (no double-claim) + successor-conflict all-or-nothing cancel (Task 11 recovery tests).

**3. Parity & draft erasure (D3):**
- [x] Both paths write one `buildPendingRfqItem` output; byte-equal (Task 11 parity).
- [x] Upgrade erases draft-only + stale optional fields incl. `TTL` (Task 11 seeds stale `specificModel` + asserts every draft attr gone).
- [x] `email` stored normalized (Task 5 fixture uses `ada@example.edu`, matching `normalizeRfqEmail`).

**4. Transaction integrity (D5):**
- [x] Stable ≤36-char `ClientRequestToken` (Task 2); its DynamoDB effect is not FakeDdb-tested (fidelity honestly scoped in Task 11 preamble).
- [x] Discriminated union — direct forbids precondition, upgrade requires it; `hasAttachments` derived from `tempKeys` (Task 7 types).
- [x] Duplicate-target guard + per-item + 4 MB transaction-total guards, all builder-side (Task 7); size estimator fails closed on unsupported types **and on `undefined`/non-finite numbers** (Task 3).

**5. Graph & receipt (D1/D2/D4):**
- [x] Frozen, not-caller-supplied graph; no fan-in; no-attachment root promotion (Task 4).
- [x] Shared `buildReceiptItem`, no PII (Task 6).

**6. Dark-ship & hygiene:** no handler wiring (Task 12 grep); explicit `git add` paths (no `git add -A`); Task 11 is honestly labelled characterization; no placeholders — every code step is complete.

**7. Type consistency:** `SubmitTransactionParams` (Task 7), `PendingRfqSource`/`Meta`/`Item` (Task 5), `buildReceiptItem` (Task 6), effect result types + `outboxEffectKey`/`buildOutboxEffectItem` (Task 4), and the claim/completion/email builders (Tasks 8–10) are referenced identically across Task 11.

---

## Out of scope — P4b-2 (worker runtime only)
The DynamoDB Streams + Lambda event-source mapping; the claim→side-effect→complete loop that *calls* these builders; the **scheduled lease sweeper/reconciler** required by D6b (re-claims expired-lease `processing` effects — mandatory, since streams never fire on elapsed time); the crm-emit effect invoking `emitTimelineEventToCrm(args, { sync: true })` so dispatch failure propagates before recording `accepted`; destination-idempotency in each effect impl (org by email, attachment destination-check-before-delete); email send + outcome capture + the `send-claimed` crash **alarm**; partial-batch responses, retries/backoff, DLQ, metrics. **P4b-3:** frontend `X-RFQ-Submit-Key` (compat → opt-in), the authenticated draft read producing `{storedHash, expectedVersion}`, canonicalization + binding, the strongly-consistent receipt read that disambiguates a cancelled transaction, `200 {success,message,referenceNumber,rfqId}` replay reconstruction, legacy `handler.test.ts` unchanged (record the count at execution). **P4b-4:** mandatory header, soak, remove legacy branch + flag; rollback = receipt-aware routing + paused producer + drained outbox.
