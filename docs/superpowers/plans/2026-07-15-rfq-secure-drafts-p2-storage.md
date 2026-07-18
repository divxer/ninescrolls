# RFQ Secure Drafts P2 — Draft Data Model & Storage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist and retrieve RFQ drafts on the existing single table using the P1 contract & credential core — idempotent conditional create, whitelisted non-disclosing read, and optimistic-concurrency update with set/remove/no-op semantics — as pure storage functions with an injected DynamoDB client and clock.

**Architecture:** One new module `amplify/lib/rfq/draftStore.ts` holds the draft item shape, key builders, and the three storage operations (`createDraft`, `getDraft`, `updateDraft`). It takes its dependencies — a `DynamoDBDocumentClient`-shaped `send`, table name, pepper/keyVersion + a verification-pepper resolver, and a `now()` clock — as an explicit config object, so every operation is unit-testable against the in-memory `fakeDdb` with no AWS. It reuses P1's `draftCredentials` (derive/hash/verify) and `draftContract` (`applyNormalizedDraftPatch`, `DraftCreateInput`, `NormalizedDraftPatch`). No HTTP, no Secrets Manager, no rate limiting — those are P3.

**Tech Stack:** TypeScript, `@aws-sdk/lib-dynamodb` (`GetCommand`/`PutCommand`/`UpdateCommand`), the existing `amplify/functions/price-api/lib/testing/fakeDdb.ts`, Vitest.

---

## File Structure

- Create `amplify/lib/rfq/draftStore.ts` — item/key builders + `createDraft`/`getDraft`/`updateDraft` + result types.
- Create `amplify/lib/rfq/draftStore.test.ts` — storage tests against `fakeDdb`.
- Modify `amplify/functions/price-api/lib/testing/fakeDdb.ts` — add `REMOVE` to the supported update grammar (draft updates remove cleared optional fields; the shared fake only supports SET/ADD today). Additive; existing price-api tests keep passing.

The draft item lives at the same `PK=RFQ#<rfqId>, SK=META` coordinates as a formal RFQ, distinguished by `status='draft'` and `GSI1PK='RFQ_STATUS#draft'`. `draftStore` is imported by P3 (the public Lambda) and P5 (cleanup); P2 wires nothing at runtime.

**Test command for the whole plan:** `npx vitest run amplify/lib/rfq/draftStore.test.ts amplify/functions/price-api/lib/testing --exclude '**/.claude/**'`

### Test harness — real `fakeDdb` API (verified 2026-07-15)

The shared fake is `export class FakeDdb` (not a `makeFakeDdb` factory). The task
snippets below use these shorthands; substitute the real API when writing the files:

- **Construct:** `const ddb = new FakeDdb();` then `ddb.seed([...])` for pre-existing items. `new FakeDdb()` with no seed is the empty-table case.
- **Inspect:** there is no `.dump()` — read `[...ddb.store.values()]`.
- **Pass to a store dep:** `send: (c) => ddb.send(c)` — never bare `ddb.send` (it would lose `this`).
- **Errors:** a failed single-write condition throws `{ name: 'ConditionalCheckFailedException' }` (matches `createDraft`/`updateDraft` catch). `GetCommand` returns `{ Item }` or `{}`.
- **Names/conditions:** `applyUpdate`/`evalCondition` already call `subNames`, so `#ttl`/`#status` aliases and `A = :x AND B = :y` conditions work. Only `REMOVE` is missing (Task 1).

For Task 1's REMOVE support, also make the existing `SET` regex stop at a following
`REMOVE`: change `/SET (.+?)(?:\sADD\s|$)/` to `/SET (.+?)(?:\sADD\s|\sREMOVE\s|$)/`, and
parse `REMOVE` with `/(?:^|\s)REMOVE (.+?)(?:\sSET\s|\sADD\s|$)/`.

---

### Task 1: Extend fakeDdb with REMOVE

Draft updates clear an optional field by removing the attribute, which the shared fake does
not yet support. Add it before it is depended upon.

**Files:**
- Modify: `amplify/functions/price-api/lib/testing/fakeDdb.ts`
- Test: `amplify/functions/price-api/lib/testing/fakeDdb.test.ts` (create if absent)

- [ ] **Step 1: Write the failing test**

```ts
// amplify/functions/price-api/lib/testing/fakeDdb.test.ts (append or create)
import { describe, it, expect } from 'vitest';
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { makeFakeDdb } from './fakeDdb';

describe('fakeDdb REMOVE', () => {
  it('removes attributes named in a REMOVE clause', async () => {
    const ddb = makeFakeDdb([{ PK: 'D#1', SK: 'META', keep: 'y', drop: 'x' }]);
    await ddb.send(new UpdateCommand({
      TableName: 't', Key: { PK: 'D#1', SK: 'META' },
      UpdateExpression: 'REMOVE drop',
    }));
    expect(ddb.dump()).toEqual([{ PK: 'D#1', SK: 'META', keep: 'y' }]);
  });

  it('supports SET and REMOVE in one expression', async () => {
    const ddb = makeFakeDdb([{ PK: 'D#1', SK: 'META', a: 1, drop: 'x' }]);
    await ddb.send(new UpdateCommand({
      TableName: 't', Key: { PK: 'D#1', SK: 'META' },
      UpdateExpression: 'SET a = :a REMOVE drop',
      ExpressionAttributeValues: { ':a': 2 },
    }));
    expect(ddb.dump()).toEqual([{ PK: 'D#1', SK: 'META', a: 2 }]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run amplify/functions/price-api/lib/testing/fakeDdb.test.ts`
Expected: FAIL — `makeFakeDdb`/`dump` may not exist under these names, or REMOVE is unsupported. If the fake's constructor/dump have different names, adapt the test import to the real API first (read the file), then re-run so the failure is specifically the missing REMOVE behavior.

- [ ] **Step 3: Write minimal implementation**

In `applyUpdate`, after handling the `SET`/`ADD` clauses, parse a `REMOVE` clause and
`delete item[field]` for each comma-separated (alias-resolved) field. Split the update
expression on the clause keywords so `SET ... REMOVE ...` is handled in one pass:

```ts
// inside applyUpdate(expr, item, values, names)
const removeMatch = subNames(expr, names).match(/REMOVE\s+(.+?)(?:\s+SET\b|\s+ADD\b|$)/i);
if (removeMatch) {
  for (const raw of removeMatch[1].split(',')) {
    const field = raw.trim();
    if (field) delete item[field];
  }
}
```

Ensure the existing `SET`/`ADD` parsing ignores a trailing `REMOVE ...` segment (match `SET`
content up to the next clause keyword or end).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run amplify/functions/price-api/lib/testing/fakeDdb.test.ts`
Expected: PASS.

- [ ] **Step 5: Regression + commit**

Run: `npx vitest run amplify/functions/price-api --exclude '**/.claude/**'`
Expected: existing price-api tests still PASS.

```bash
git add amplify/functions/price-api/lib/testing/fakeDdb.ts amplify/functions/price-api/lib/testing/fakeDdb.test.ts
git commit -m "test(fakeDdb): support REMOVE in the update-expression grammar"
```

---

### Task 2: Draft item + key builders

Pure functions that turn a validated `DraftCreateInput` plus credentials and a server clock
into the stored item, and derive the GSI keys. No I/O.

**Files:**
- Create: `amplify/lib/rfq/draftStore.ts`
- Test: `amplify/lib/rfq/draftStore.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// amplify/lib/rfq/draftStore.test.ts
import { describe, it, expect } from 'vitest';
import { buildDraftItem, DRAFT_TTL_DAYS } from './draftStore';

const INPUT = {
  name: 'Jane Researcher',
  email: 'jane@stanford.edu',
  institution: 'Stanford University',
  equipmentCategory: 'Probe-Station' as const,
  applicationDescription: 'Wafer probing for silicon photonics device characterization.',
  quantity: 2,
};
const NOW = '2026-07-15T00:00:00.000Z';

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
    // expiresAt is 30 days after lastActivityAt; TTL is the matching epoch seconds
    expect(item.expiresAt).toBe('2026-08-14T00:00:00.000Z');
    expect(item.TTL).toBe(Math.floor(Date.parse(item.expiresAt as string) / 1000));
    expect(item.name).toBe('Jane Researcher');
    expect(item.draftTokenHash).toBe('v1:deadbeef');
  });

  it('never stores a non-whitelisted attribute', () => {
    const item = buildDraftItem({
      rfqId: 'abc123', draftTokenHash: 'v1:x',
      input: { ...INPUT }, now: NOW,
    });
    for (const banned of ['shippingAddress', 'attachmentKeys', 'keySpecifications', 'turnstileToken']) {
      expect(item).not.toHaveProperty(banned);
    }
    expect(DRAFT_TTL_DAYS).toBe(30);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run amplify/lib/rfq/draftStore.test.ts`
Expected: FAIL — `Failed to resolve import "./draftStore"`.

- [ ] **Step 3: Write minimal implementation**

```ts
// amplify/lib/rfq/draftStore.ts
import type { DraftCreateInput } from './draftContract';

export const DRAFT_TTL_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export type DraftItem = Record<string, unknown> & {
  PK: string; SK: 'META'; status: 'draft'; draftVersion: number;
  createdAt: string; lastActivityAt: string; expiresAt: string; TTL: number;
  draftTokenHash: string; GSI1PK: string; GSI1SK: string;
};

export function draftPk(rfqId: string): string {
  return `RFQ#${rfqId}`;
}

function expiryFrom(iso: string): { expiresAt: string; TTL: number } {
  const expiresAt = new Date(Date.parse(iso) + DRAFT_TTL_DAYS * DAY_MS).toISOString();
  return { expiresAt, TTL: Math.floor(Date.parse(expiresAt) / 1000) };
}

export function buildDraftItem(args: {
  rfqId: string; draftTokenHash: string; input: DraftCreateInput; now: string;
}): DraftItem {
  const { rfqId, draftTokenHash, input, now } = args;
  const { expiresAt, TTL } = expiryFrom(now);
  return {
    PK: draftPk(rfqId),
    SK: 'META',
    status: 'draft',
    draftVersion: 1,
    createdAt: now,
    lastActivityAt: now,
    expiresAt,
    TTL,
    draftTokenHash,
    GSI1PK: 'RFQ_STATUS#draft',
    GSI1SK: `${now}#${rfqId}`,
    ...input,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run amplify/lib/rfq/draftStore.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add amplify/lib/rfq/draftStore.ts amplify/lib/rfq/draftStore.test.ts
git commit -m "feat(rfq-draft): draft item + key builders"
```

---

### Task 3: `createDraft` — idempotent conditional create

Create the draft with a conditional put; a retry with the same nonce (hence same id/token)
converges on the one record and returns the existing token/version instead of erroring.

**Files:**
- Modify: `amplify/lib/rfq/draftStore.ts`
- Test: `amplify/lib/rfq/draftStore.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// append to amplify/lib/rfq/draftStore.test.ts
import crypto from 'node:crypto';
import { createDraft } from './draftStore';
import { encodeCredential } from './draftCredentials';
import { makeFakeDdb } from '../../functions/price-api/lib/testing/fakeDdb';

const pepper = crypto.randomBytes(32);
const deps = (ddb: ReturnType<typeof makeFakeDdb>) => ({
  send: ddb.send, tableName: 't', pepper, keyVersion: 1,
  resolvePepper: (v: number) => (v === 1 ? pepper : undefined),
  now: () => NOW,
});

describe('createDraft', () => {
  it('creates one record and returns a usable id + token', async () => {
    const ddb = makeFakeDdb([]);
    const nonce = encodeCredential(crypto.randomBytes(32));
    const r = await createDraft(deps(ddb), nonce, INPUT);
    expect(r.rfqId).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(r.draftToken).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(r.draftVersion).toBe(1);
    expect(ddb.dump()).toHaveLength(1);
  });

  it('is idempotent: the same nonce returns the same id/token and leaves one record', async () => {
    const ddb = makeFakeDdb([]);
    const nonce = encodeCredential(crypto.randomBytes(32));
    const a = await createDraft(deps(ddb), nonce, INPUT);
    const b = await createDraft(deps(ddb), nonce, INPUT);
    expect(b.rfqId).toBe(a.rfqId);
    expect(b.draftToken).toBe(a.draftToken);
    expect(ddb.dump()).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run amplify/lib/rfq/draftStore.test.ts`
Expected: FAIL — `createDraft is not a function`.

- [ ] **Step 3: Write minimal implementation**

```ts
// append to amplify/lib/rfq/draftStore.ts
import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import {
  decodeCredential, deriveDraftId, deriveDraftToken, encodeCredential, hashDraftToken,
} from './draftCredentials';

export interface DraftStoreDeps {
  send: (command: unknown) => Promise<{ Item?: Record<string, unknown> }>;
  tableName: string;
  pepper: Buffer;
  keyVersion: number;
  resolvePepper: (keyVersion: number) => Buffer | undefined;
  now: () => string;
}

export interface CreateDraftResult {
  rfqId: string;
  draftToken: string;
  draftVersion: number;
}

export async function createDraft(
  deps: DraftStoreDeps, nonceB64: string, input: DraftCreateInput,
): Promise<CreateDraftResult> {
  const nonce = decodeCredential(nonceB64);
  const rfqId = deriveDraftId(nonce);
  const token = deriveDraftToken(nonce);
  const draftTokenHash = hashDraftToken(deps.pepper, deps.keyVersion, token);
  const item = buildDraftItem({ rfqId, draftTokenHash, input, now: deps.now() });
  try {
    await deps.send(new PutCommand({
      TableName: deps.tableName,
      Item: item,
      ConditionExpression: 'attribute_not_exists(PK)',
    }));
    return { rfqId, draftToken: encodeCredential(token), draftVersion: 1 };
  } catch (err) {
    if ((err as { name?: string }).name !== 'ConditionalCheckFailedException') throw err;
    // Idempotent retry: the same nonce already created this record. Return its version.
    const existing = await deps.send(new GetCommand({
      TableName: deps.tableName, Key: { PK: draftPk(rfqId), SK: 'META' },
    }));
    const draftVersion = (existing.Item?.draftVersion as number) ?? 1;
    return { rfqId, draftToken: encodeCredential(token), draftVersion };
  }
}
```

Confirm `fakeDdb` throws `name==='ConditionalCheckFailedException'` on a failed
`attribute_not_exists`; if the shared fake throws a different name for single-put
conditions, align the fake to the real client's name in this task (and note it in the
commit) so `createDraft` catches the right error.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run amplify/lib/rfq/draftStore.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add amplify/lib/rfq/draftStore.ts amplify/lib/rfq/draftStore.test.ts \
  amplify/functions/price-api/lib/testing/fakeDdb.ts
git commit -m "feat(rfq-draft): idempotent conditional createDraft"
```

---

### Task 4: `getDraft` — authenticated, non-disclosing read

Return whitelisted fields + lifecycle metadata only for an unexpired, authenticated live
draft. Missing / wrong-token / expired / non-draft all converge on one `DraftUnavailable`.

**Files:**
- Modify: `amplify/lib/rfq/draftStore.ts`
- Test: `amplify/lib/rfq/draftStore.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// append to amplify/lib/rfq/draftStore.test.ts
import { getDraft } from './draftStore';

describe('getDraft', () => {
  it('returns whitelisted fields for the authenticated live draft', async () => {
    const ddb = makeFakeDdb([]);
    const nonce = encodeCredential(crypto.randomBytes(32));
    const created = await createDraft(deps(ddb), nonce, INPUT);
    const r = await getDraft(deps(ddb), created.rfqId, created.draftToken);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.draftVersion).toBe(1);
      expect(r.fields.email).toBe('jane@stanford.edu');
      expect(r.fields).not.toHaveProperty('draftTokenHash'); // never leak credentials
      expect(r.fields).not.toHaveProperty('PK');
    }
  });

  it('returns DraftUnavailable for a wrong token without revealing existence', async () => {
    const ddb = makeFakeDdb([]);
    const nonce = encodeCredential(crypto.randomBytes(32));
    const created = await createDraft(deps(ddb), nonce, INPUT);
    const wrong = encodeCredential(crypto.randomBytes(32));
    expect((await getDraft(deps(ddb), created.rfqId, wrong)).ok).toBe(false);
  });

  it('returns DraftUnavailable for a missing record', async () => {
    const ddb = makeFakeDdb([]);
    const anyToken = encodeCredential(crypto.randomBytes(32));
    expect((await getDraft(deps(ddb), 'does-not-exist', anyToken)).ok).toBe(false);
  });

  it('returns DraftUnavailable for an expired draft', async () => {
    const ddb = makeFakeDdb([]);
    const nonce = encodeCredential(crypto.randomBytes(32));
    const created = await createDraft(deps(ddb), nonce, INPUT);
    const future = { ...deps(ddb), now: () => '2026-10-01T00:00:00.000Z' }; // > 30d later
    expect((await getDraft(future, created.rfqId, created.draftToken)).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run amplify/lib/rfq/draftStore.test.ts`
Expected: FAIL — `getDraft is not a function`.

- [ ] **Step 3: Write minimal implementation**

```ts
// append to amplify/lib/rfq/draftStore.ts
import { verifyDraftToken } from './draftCredentials';
import { DRAFT_FIELD_KEYS } from './draftContract';

export type DraftReadResult =
  | { ok: true; fields: Record<string, unknown>; draftVersion: number; lastActivityAt: string; expiresAt: string }
  | { ok: false };

const DRAFT_UNAVAILABLE: DraftReadResult = { ok: false };

function whitelist(item: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of DRAFT_FIELD_KEYS) if (k in item) out[k] = item[k];
  return out;
}

/** Read+authenticate a draft. All failure modes return the same DraftUnavailable. */
async function loadLiveDraft(
  deps: DraftStoreDeps, rfqId: string, tokenB64: string,
): Promise<Record<string, unknown> | null> {
  let token: Buffer;
  try { token = decodeCredential(tokenB64); } catch { return null; }
  const res = await deps.send(new GetCommand({
    TableName: deps.tableName, Key: { PK: draftPk(rfqId), SK: 'META' },
  }));
  const item = res.Item;
  const hash = item?.draftTokenHash as string | undefined;
  // Always run verification (dummy path when absent) so timing never discloses existence.
  const authed = verifyDraftToken(hash, token, deps.resolvePepper);
  if (!item || !authed || item.status !== 'draft') return null;
  if (Date.parse(item.expiresAt as string) <= Date.parse(deps.now())) return null;
  return item;
}

export async function getDraft(
  deps: DraftStoreDeps, rfqId: string, tokenB64: string,
): Promise<DraftReadResult> {
  const item = await loadLiveDraft(deps, rfqId, tokenB64);
  if (!item) return DRAFT_UNAVAILABLE;
  return {
    ok: true,
    fields: whitelist(item),
    draftVersion: item.draftVersion as number,
    lastActivityAt: item.lastActivityAt as string,
    expiresAt: item.expiresAt as string,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run amplify/lib/rfq/draftStore.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add amplify/lib/rfq/draftStore.ts amplify/lib/rfq/draftStore.test.ts
git commit -m "feat(rfq-draft): non-disclosing authenticated getDraft"
```

---

### Task 5: `updateDraft` — optimistic concurrency, set/remove, no-op

Apply a normalized patch under an optimistic-concurrency condition on `draftVersion`,
bumping activity/expiry/version only when content actually changes; a stale version returns
the current whitelisted draft; a no-op writes nothing.

**Files:**
- Modify: `amplify/lib/rfq/draftStore.ts`
- Test: `amplify/lib/rfq/draftStore.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// append to amplify/lib/rfq/draftStore.test.ts
import { updateDraft } from './draftStore';
import { normalizeDraftPatch, draftPatchRequestSchema } from './draftContract';

const patch = (raw: Record<string, unknown>) =>
  normalizeDraftPatch(draftPatchRequestSchema.parse(raw));

describe('updateDraft', () => {
  it('applies a set, bumps version + activity, returns the new version', async () => {
    const ddb = makeFakeDdb([]);
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
    const ddb = makeFakeDdb([]);
    const nonce = encodeCredential(crypto.randomBytes(32));
    const c = await createDraft(deps(ddb), nonce, { ...INPUT, department: 'Physics' });
    const r = await updateDraft(deps(ddb), c.rfqId, c.draftToken, 1, patch({ department: '' }));
    expect(r.status).toBe('updated');
    if (r.status === 'updated') expect(r.fields).not.toHaveProperty('department');
  });

  it('detects a no-op: no write, no version bump', async () => {
    const ddb = makeFakeDdb([]);
    const nonce = encodeCredential(crypto.randomBytes(32));
    const c = await createDraft(deps(ddb), nonce, INPUT);
    const r = await updateDraft(deps(ddb), c.rfqId, c.draftToken, 1, patch({ quantity: 2 }));
    expect(r.status).toBe('noop');
    const after = await getDraft(deps(ddb), c.rfqId, c.draftToken);
    if (after.ok) expect(after.draftVersion).toBe(1);
  });

  it('returns a version conflict with the current draft on a stale version', async () => {
    const ddb = makeFakeDdb([]);
    const nonce = encodeCredential(crypto.randomBytes(32));
    const c = await createDraft(deps(ddb), nonce, INPUT);
    await updateDraft(deps(ddb), c.rfqId, c.draftToken, 1, patch({ quantity: 4 })); // -> v2
    const stale = await updateDraft(deps(ddb), c.rfqId, c.draftToken, 1, patch({ quantity: 5 }));
    expect(stale.status).toBe('conflict');
    if (stale.status === 'conflict') {
      expect(stale.draftVersion).toBe(2);
      expect(stale.fields.quantity).toBe(4);
    }
  });

  it('returns unavailable for a wrong token', async () => {
    const ddb = makeFakeDdb([]);
    const nonce = encodeCredential(crypto.randomBytes(32));
    const c = await createDraft(deps(ddb), nonce, INPUT);
    const wrong = encodeCredential(crypto.randomBytes(32));
    expect((await updateDraft(deps(ddb), c.rfqId, wrong, 1, patch({ quantity: 3 }))).status)
      .toBe('unavailable');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run amplify/lib/rfq/draftStore.test.ts`
Expected: FAIL — `updateDraft is not a function`.

- [ ] **Step 3: Write minimal implementation**

```ts
// append to amplify/lib/rfq/draftStore.ts
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { applyNormalizedDraftPatch, type DraftCreateInput as _DCI, type NormalizedDraftPatch } from './draftContract';

export type DraftUpdateResult =
  | { status: 'updated'; fields: Record<string, unknown>; draftVersion: number }
  | { status: 'noop'; draftVersion: number }
  | { status: 'conflict'; fields: Record<string, unknown>; draftVersion: number }
  | { status: 'unavailable' };

export async function updateDraft(
  deps: DraftStoreDeps, rfqId: string, tokenB64: string,
  expectedVersion: number, patch: NormalizedDraftPatch,
): Promise<DraftUpdateResult> {
  const item = await loadLiveDraft(deps, rfqId, tokenB64);
  if (!item) return { status: 'unavailable' };
  const currentVersion = item.draftVersion as number;
  if (currentVersion !== expectedVersion) {
    return { status: 'conflict', fields: whitelist(item), draftVersion: currentVersion };
  }
  const currentFields = whitelist(item) as _DCI;
  const next = applyNormalizedDraftPatch(currentFields, patch);
  if (JSON.stringify(next) === JSON.stringify(currentFields)) {
    return { status: 'noop', draftVersion: currentVersion };
  }

  const now = deps.now();
  const { expiresAt, TTL } = expiryFrom(now);
  const sets = ['draftVersion = :nv', 'lastActivityAt = :la', 'expiresAt = :ea', '#ttl = :ttl', 'GSI1SK = :g1sk'];
  const values: Record<string, unknown> = {
    ':nv': currentVersion + 1, ':la': now, ':ea': expiresAt, ':ttl': TTL,
    ':g1sk': `${now}#${rfqId}`, ':ev': expectedVersion, ':draft': 'draft',
  };
  for (const [k, v] of Object.entries(patch.set)) { sets.push(`${k} = :s_${k}`); values[`:s_${k}`] = v; }
  const removeClause = patch.remove.length ? ` REMOVE ${patch.remove.join(', ')}` : '';
  try {
    await deps.send(new UpdateCommand({
      TableName: deps.tableName, Key: { PK: draftPk(rfqId), SK: 'META' },
      UpdateExpression: `SET ${sets.join(', ')}${removeClause}`,
      ConditionExpression: 'draftVersion = :ev AND #status = :draft',
      ExpressionAttributeNames: { '#ttl': 'TTL', '#status': 'status' },
      ExpressionAttributeValues: values,
    }));
  } catch (err) {
    if ((err as { name?: string }).name !== 'ConditionalCheckFailedException') throw err;
    const fresh = await loadLiveDraft(deps, rfqId, tokenB64);
    if (!fresh) return { status: 'unavailable' };
    return { status: 'conflict', fields: whitelist(fresh), draftVersion: fresh.draftVersion as number };
  }
  return { status: 'updated', fields: next as Record<string, unknown>, draftVersion: currentVersion + 1 };
}
```

Note: the fake must support `#status`/`#ttl` name aliases and `A = :x AND B = :y` conditions
(it already substitutes `ExpressionAttributeNames` and supports single-AND conditions). If the
`status`/`TTL` reserved-word aliases are not yet handled by the fake, extend it in Task 1's
spirit and note it in this commit.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run amplify/lib/rfq/draftStore.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add amplify/lib/rfq/draftStore.ts amplify/lib/rfq/draftStore.test.ts \
  amplify/functions/price-api/lib/testing/fakeDdb.ts
git commit -m "feat(rfq-draft): optimistic-concurrency updateDraft with set/remove/no-op"
```

---

### Task 6: Plan-wide verification

- [ ] **Step 1: Full P2 + fake suite**

Run: `npx vitest run amplify/lib/rfq/ amplify/functions/price-api --exclude '**/.claude/**'`
Expected: PASS — draftStore + fakeDdb + all existing price-api tests.

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit && npm run typecheck:amplify && npx eslint amplify/lib/rfq/draftStore.ts amplify/functions/price-api/lib/testing/fakeDdb.ts`
Expected: no errors.

- [ ] **Step 3: Confirm still dark**

Run: `grep -rn "draftStore" src/ amplify/functions/*/handler.ts || echo "draftStore unimported by app code — P2 ships dark (P3 wires it into the rfq-draft Lambda)"`
Expected: no runtime import.

---

## Self-Review

**Spec coverage (P2 scope — spec §"Record shape", "Lifecycle and conditional transitions" storage half):**
- Draft item at `RFQ#/META`, `status=draft`, versioned, `GSI1` keys, `expiresAt=lastActivityAt+30d`, matching TTL — Task 2.
- Idempotent conditional create; same nonce → one record — Task 3.
- Non-disclosing authenticated read; missing/wrong-token/expired/non-draft converge — Task 4.
- Optimistic-concurrency update; set/remove; no-op leaves activity/expiry/version unchanged; stale version returns current draft — Task 5.

**Deferred (out of P2):** HTTP endpoints + credential headers + rate limiting (P3), Secrets Manager pepper retrieval/rotation wiring (P3 provides `resolvePepper`; P2 injects it), draft→pending upgrade + receipts/outbox (P4), admin/cleanup (P5).

**Placeholder scan:** none — every code step is complete. The two "align the fake if the error name differs" notes are verification instructions, not placeholders: the behavior and fallback are fully specified.

**Type consistency:** `DraftStoreDeps`, `CreateDraftResult`, `DraftReadResult`, `DraftUpdateResult`, `buildDraftItem`, `draftPk`, `loadLiveDraft`, `whitelist`, `expiryFrom` are defined once and referenced consistently across Tasks 2–5. `updateDraft` consumes `NormalizedDraftPatch` from P1's `draftContract`, and `getDraft`/`updateDraft` share `loadLiveDraft` + `whitelist`.

**Note for the implementer:** the no-op check compares the re-validated `applyNormalizedDraftPatch` result to the current whitelisted fields by canonical JSON; both come through the same schema so key order is stable. Keep the version-conflict path (both the pre-read mismatch and the post-write `ConditionalCheckFailedException`) returning the current whitelisted draft — never the raw item.
