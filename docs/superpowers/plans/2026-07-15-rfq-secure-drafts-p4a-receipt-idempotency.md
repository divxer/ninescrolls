# RFQ Secure Drafts P4a — Submit Receipt & Idempotency Store Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the pure, fully-testable idempotency foundation for RFQ submission — the submit-receipt id/binding derivation and the receipt store (conditional create, 7-day replay, same-key/different-payload conflict, day-7→90 tombstone, ≥90-day window-expired) — with **no change to the live `submit-rfq` path**. P4b consumes these to make the actual submission idempotent.

**Architecture:** Split the spec's §"Three distinct credentials" / receipt design into a scope P4a can ship dark. `submitReceipt.ts` owns the crypto — receipt id from the submit key, canonicalization of the validated formal payload (excluding one-time/credential values), and the domain-separated request binding over `(canonical payload, operation kind, rfqId?)`. `receiptStore.ts` owns the DynamoDB idempotency contract with an injected client + clock, unit-tested against `fakeDdb`, reusing P1's `decodeCredential`. Nothing here touches `submit-rfq/handler.ts`; the refactor that calls these is **P4b**.

**Tech Stack:** TypeScript, Node.js `crypto` (`createHash`, `timingSafeEqual`), `@aws-sdk/lib-dynamodb`, `fakeDdb`, Vitest.

---

## File Structure

- Create `amplify/lib/rfq/submitReceipt.ts` — `deriveSubmitReceiptId`, `canonicalizeRfqPayload`, `computeRequestBinding`.
- Create `amplify/lib/rfq/submitReceipt.test.ts`.
- Create `amplify/lib/rfq/receiptStore.ts` — `recordReceipt` (conditional create) + `checkReceipt` (replay / conflict / tombstone / window-expired).
- Create `amplify/lib/rfq/receiptStore.test.ts`.

Both modules are leaves. **P4a ships dark** — `submit-rfq` still runs its current unconditional path until P4b.

**Test command:** `npx vitest run amplify/lib/rfq/submitReceipt.test.ts amplify/lib/rfq/receiptStore.test.ts --exclude '**/.claude/**'`

> **P4b (follow-on, NOT in this plan):** refactor `submit-rfq/handler.ts` to (1) require `X-RFQ-Submit-Key`, (2) run the conditional receipt/outbox transaction, (3) accept optional `rfqId`+`draftToken` to conditionally upgrade `status=draft → pending`, and move the org/CRM/visitor/email/attachment effects behind a transactional outbox with the at-most-once email claim. That change touches the live submit path and gets its own plan + review.

---

### Task 1: Receipt id + request binding

Derive the non-enumerable receipt id from the submit key, canonicalize the validated formal
payload (dropping one-time/credential values), and bind it with the operation kind (+ rfqId
for a draft upgrade). All deterministic; the binding is non-reversible.

**Files:**
- Create: `amplify/lib/rfq/submitReceipt.ts`
- Test: `amplify/lib/rfq/submitReceipt.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// amplify/lib/rfq/submitReceipt.test.ts
import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import {
  deriveSubmitReceiptId, canonicalizeRfqPayload, computeRequestBinding,
} from './submitReceipt';
import { encodeCredential } from './draftCredentials';

const key = encodeCredential(crypto.randomBytes(32));
const PAYLOAD = {
  name: 'Jane', email: 'jane@stanford.edu', institution: 'Stanford',
  equipmentCategory: 'ICP', applicationDescription: 'silicon etching for MEMS work',
  quantity: 1, turnstileToken: 'one-time', submitIdempotencyKey: key, draftToken: 'secret',
};

describe('deriveSubmitReceiptId', () => {
  it('is a deterministic, non-enumerable SUBMIT_RECEIPT id independent of key encoding', () => {
    const a = deriveSubmitReceiptId(key);
    expect(a).toBe(deriveSubmitReceiptId(key));
    expect(a).toMatch(/^SUBMIT_RECEIPT#[A-Za-z0-9_-]+$/);
    expect(a).not.toContain(key); // the raw key never appears
  });
  it('rejects a non-32-byte key', () => {
    expect(() => deriveSubmitReceiptId('short')).toThrow();
  });
});

describe('canonicalizeRfqPayload', () => {
  it('excludes one-time/credential values and is key-order independent', () => {
    const c1 = canonicalizeRfqPayload(PAYLOAD);
    const reordered = { quantity: 1, email: 'jane@stanford.edu', name: 'Jane',
      institution: 'Stanford', equipmentCategory: 'ICP',
      applicationDescription: 'silicon etching for MEMS work',
      draftToken: 'other', turnstileToken: 'other', submitIdempotencyKey: 'other' };
    expect(canonicalizeRfqPayload(reordered)).toBe(c1); // one-time values don't affect it
    expect(c1).not.toContain('one-time');
    expect(c1).not.toContain('secret');
    expect(c1).not.toContain(key);
  });
});

describe('computeRequestBinding', () => {
  it('binds payload + operation kind (+ rfqId for upgrade); differs across modes/payloads', () => {
    const direct = computeRequestBinding(PAYLOAD, 'direct');
    const upgrade = computeRequestBinding(PAYLOAD, 'draft-upgrade', 'rfq-1');
    expect(direct).toMatch(/^[0-9a-f]{64}$/);
    expect(direct).not.toBe(upgrade);                                   // cross-mode differs
    expect(computeRequestBinding(PAYLOAD, 'draft-upgrade', 'rfq-2')).not.toBe(upgrade); // rfqId bound
    expect(computeRequestBinding({ ...PAYLOAD, quantity: 2 }, 'direct')).not.toBe(direct); // payload bound
    expect(computeRequestBinding(PAYLOAD, 'direct')).toBe(direct);      // deterministic
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run amplify/lib/rfq/submitReceipt.test.ts`
Expected: FAIL — `Failed to resolve import "./submitReceipt"`.

- [ ] **Step 3: Write minimal implementation**

```ts
// amplify/lib/rfq/submitReceipt.ts
import crypto from 'node:crypto';
import { decodeCredential } from './draftCredentials';

const RECEIPT_ID_DOMAIN = 'ninescrolls/rfq-submit-receipt/v1';
const BINDING_DOMAIN = 'ninescrolls/rfq-submit-binding/v1';

/** Values that are one-time or secret and must never enter the canonical payload. */
const EXCLUDED_FROM_BINDING = new Set([
  'turnstileToken', 'submitIdempotencyKey', 'draftToken', 'draftCreateNonce',
]);

export type SubmitOperationKind = 'direct' | 'draft-upgrade';

/** Non-enumerable receipt id = SUBMIT_RECEIPT#base64url(SHA-256(domain || key)). */
export function deriveSubmitReceiptId(submitKeyB64: string): string {
  const keyBytes = decodeCredential(submitKeyB64); // enforces 32 bytes
  const digest = crypto.createHash('sha256').update(RECEIPT_ID_DOMAIN).update(keyBytes).digest();
  return `SUBMIT_RECEIPT#${digest.toString('base64url')}`;
}

/** Deterministic canonical JSON of the payload, minus one-time/credential values. */
export function canonicalizeRfqPayload(payload: Record<string, unknown>): string {
  const entries = Object.entries(payload)
    .filter(([k, v]) => !EXCLUDED_FROM_BINDING.has(k) && v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return JSON.stringify(entries);
}

/** Domain-separated, non-reversible binding over (payload, opKind, rfqId?). */
export function computeRequestBinding(
  payload: Record<string, unknown>, opKind: SubmitOperationKind, rfqId = '',
): string {
  return crypto.createHash('sha256')
    .update(BINDING_DOMAIN).update('\0')
    .update(opKind).update('\0')
    .update(rfqId).update('\0')
    .update(canonicalizeRfqPayload(payload))
    .digest('hex');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run amplify/lib/rfq/submitReceipt.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add amplify/lib/rfq/submitReceipt.ts amplify/lib/rfq/submitReceipt.test.ts
git commit -m "feat(rfq-submit): receipt id + non-reversible request binding"
```

---

### Task 2: Receipt store — record + replay/conflict/tombstone

Conditionally create a receipt; on a repeat, return the stored result within 7 days (after a
constant-time binding compare), reject a same-key/different-binding reuse, return the stable
window-expired response from day 7 through 90, and treat a not-found as first-use.

**Files:**
- Create: `amplify/lib/rfq/receiptStore.ts`
- Test: `amplify/lib/rfq/receiptStore.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// amplify/lib/rfq/receiptStore.test.ts
import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import { recordReceipt, checkReceipt } from './receiptStore';
import { deriveSubmitReceiptId, computeRequestBinding } from './submitReceipt';
import { encodeCredential } from './draftCredentials';
import { FakeDdb } from '../../functions/price-api/lib/testing/fakeDdb';

const NOW = '2026-07-15T00:00:00.000Z';
const deps = (ddb: FakeDdb, now = NOW) => ({
  send: (c: unknown) => ddb.send(c as never), tableName: 't', now: () => now,
});
const key = encodeCredential(crypto.randomBytes(32));
const PAYLOAD = { name: 'Jane', email: 'jane@stanford.edu', quantity: 1 };
const id = deriveSubmitReceiptId(key);
const binding = computeRequestBinding(PAYLOAD, 'direct');
const RESULT = { rfqId: 'rfq-1', referenceNumber: 'RFQ-1', status: 200 };

describe('receipt store', () => {
  it('records first use, then replays the stored result for the same key+binding', async () => {
    const ddb = new FakeDdb();
    expect((await checkReceipt(deps(ddb), id)).outcome).toBe('first-use');
    await recordReceipt(deps(ddb), id, { opKind: 'direct', binding, result: RESULT });
    const replay = await checkReceipt(deps(ddb), id, binding);
    expect(replay.outcome).toBe('replay');
    if (replay.outcome === 'replay') expect(replay.result).toEqual(RESULT);
  });

  it('rejects a same-key / different-binding reuse as a conflict', async () => {
    const ddb = new FakeDdb();
    await recordReceipt(deps(ddb), id, { opKind: 'direct', binding, result: RESULT });
    const other = computeRequestBinding({ ...PAYLOAD, quantity: 9 }, 'direct');
    expect((await checkReceipt(deps(ddb), id, other)).outcome).toBe('conflict');
  });

  it('returns window-expired from day 7 through day 90', async () => {
    const ddb = new FakeDdb();
    await recordReceipt(deps(ddb), id, { opKind: 'direct', binding, result: RESULT });
    const day30 = deps(ddb, '2026-08-14T00:00:00.000Z');
    expect((await checkReceipt(day30, id, binding)).outcome).toBe('window-expired');
  });

  it('a second concurrent record is rejected (conditional create)', async () => {
    const ddb = new FakeDdb();
    await recordReceipt(deps(ddb), id, { opKind: 'direct', binding, result: RESULT });
    await expect(recordReceipt(deps(ddb), id, { opKind: 'direct', binding, result: RESULT }))
      .rejects.toThrow();
  });

  it('stores no form PII', async () => {
    const ddb = new FakeDdb();
    await recordReceipt(deps(ddb), id, { opKind: 'direct', binding, result: RESULT });
    const item = [...ddb.store.values()][0];
    expect(item).not.toHaveProperty('email');
    expect(item).not.toHaveProperty('name');
    expect(item.binding).toBe(binding); // the non-reversible hash, not the payload
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run amplify/lib/rfq/receiptStore.test.ts`
Expected: FAIL — `Failed to resolve import "./receiptStore"`.

- [ ] **Step 3: Write minimal implementation**

```ts
// amplify/lib/rfq/receiptStore.ts
import crypto from 'node:crypto';
import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import type { SubmitOperationKind } from './submitReceipt';

const DAY_MS = 24 * 60 * 60 * 1000;
const REPLAY_DAYS = 7;
const TTL_DAYS = 90;

export interface ReceiptDeps {
  send: (command: unknown) => Promise<{ Item?: Record<string, unknown> }>;
  tableName: string;
  now: () => string;
}

export interface StoredResult { rfqId: string; referenceNumber: string; status: number }

export type CheckReceiptResult =
  | { outcome: 'first-use' }
  | { outcome: 'replay'; result: StoredResult }
  | { outcome: 'conflict' }
  | { outcome: 'window-expired' };

function bindingMatches(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'hex'); const bb = Buffer.from(b, 'hex');
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

/** Classify a submit attempt against any stored receipt. `binding` omitted on the pre-write probe. */
export async function checkReceipt(
  deps: ReceiptDeps, receiptId: string, binding?: string,
): Promise<CheckReceiptResult> {
  const res = await deps.send(new GetCommand({
    TableName: deps.tableName, Key: { PK: receiptId, SK: 'META' },
  }));
  const item = res.Item;
  if (!item) return { outcome: 'first-use' };
  if (Date.parse(deps.now()) >= Date.parse(item.replayExpiresAt as string)) {
    return { outcome: 'window-expired' }; // tombstone through TTL
  }
  if (binding && !bindingMatches(binding, item.binding as string)) return { outcome: 'conflict' };
  return {
    outcome: 'replay',
    result: {
      rfqId: item.rfqId as string,
      referenceNumber: item.referenceNumber as string,
      status: item.status as number,
    },
  };
}

/** Conditionally create the receipt (idempotency barrier). Throws if one already exists. */
export async function recordReceipt(
  deps: ReceiptDeps, receiptId: string,
  args: { opKind: SubmitOperationKind; binding: string; result: StoredResult },
): Promise<void> {
  const now = deps.now();
  const replayExpiresAt = new Date(Date.parse(now) + REPLAY_DAYS * DAY_MS).toISOString();
  const ttlExpiresAt = new Date(Date.parse(now) + TTL_DAYS * DAY_MS).toISOString();
  await deps.send(new PutCommand({
    TableName: deps.tableName,
    Item: {
      PK: receiptId, SK: 'META',
      opKind: args.opKind, binding: args.binding,
      rfqId: args.result.rfqId, referenceNumber: args.result.referenceNumber, status: args.result.status,
      createdAt: now, replayExpiresAt, TTL: Math.floor(Date.parse(ttlExpiresAt) / 1000),
    },
    ConditionExpression: 'attribute_not_exists(PK)',
  }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run amplify/lib/rfq/receiptStore.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add amplify/lib/rfq/receiptStore.ts amplify/lib/rfq/receiptStore.test.ts
git commit -m "feat(rfq-submit): idempotency receipt store (replay/conflict/tombstone)"
```

---

### Task 3: Verification

- [ ] **Step 1: Full suite for the new modules + regression**

Run: `npx vitest run amplify/lib/rfq/ --exclude '**/.claude/**'`
Expected: PASS — submitReceipt + receiptStore + all existing lib/rfq tests.

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit && npm run typecheck:amplify && npx eslint amplify/lib/rfq/submitReceipt.ts amplify/lib/rfq/receiptStore.ts`
Expected: no errors.

- [ ] **Step 3: Confirm dark**

Run: `grep -rn "submitReceipt\|receiptStore" src/ amplify/functions/*/handler.ts || echo "unimported — P4a ships dark; P4b wires it into submit-rfq"`
Expected: no runtime import.

---

## Self-Review

**Spec coverage (P4a scope — spec §"receipt derivation", "receipt transaction/replay"):**
- `SUBMIT_RECEIPT#SHA-256(domain||key)` non-enumerable id; raw key never stored/returned — Task 1.
- Canonical payload excludes Turnstile + draft/create/submit credentials; key-order independent — Task 1.
- Domain-separated binding over payload + operation kind + rfqId — Task 1.
- Conditional-create receipt with 7-day replay, constant-time binding compare, same-key/different-binding conflict, day-7→90 tombstone (window-expired), 90-day TTL, no form PII — Task 2.

**Deferred to P4b (explicitly out of scope, touches the live path):** `submit-rfq` refactor to require `X-RFQ-Submit-Key` and run the receipt transaction; draft→pending conditional upgrade; transactional outbox + at-most-once email claim for the org/CRM/visitor/email/attachment effects. P4a is the pure prerequisite so the risky live-path change lands small and reviewable.

**Placeholder scan:** none — every code step is complete.

**Type consistency:** `SubmitOperationKind`, `deriveSubmitReceiptId`, `canonicalizeRfqPayload`, `computeRequestBinding` (Task 1) are consumed by `receiptStore` + its tests (Task 2); `ReceiptDeps`/`StoredResult`/`CheckReceiptResult` are defined once and used consistently.

**Note for the implementer:** `checkReceipt` is called twice by P4b — once as a pre-write probe (no `binding`, to short-circuit an obvious replay) and once with the binding after canonicalizing the validated payload. The `window-expired` tombstone is returned whenever `now >= replayExpiresAt`, independent of whether DynamoDB TTL has physically deleted the item — TTL is cleanup, never the logical boundary.
