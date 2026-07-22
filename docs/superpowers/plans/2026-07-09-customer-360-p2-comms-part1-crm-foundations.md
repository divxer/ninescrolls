# P2 Comms — Part 1: CRM Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land every CRM-side contract and hardening change from the comms-sync spec (R1–R10) so the Gmail channel (Part 2) can plug in — independently mergeable as pure hardening of merged 3B/3C.

**Architecture:** No new Lambda. Extends crm-api (emit contracts, resolution, link mutation, repair machinery), the shared `amplify/lib/crm` contract, organization-api's merge, the GraphQL schema, and the Needs-Linking UI. Everything is backward-compatible: existing channels pass no new fields and behave byte-identically.

**Tech Stack:** AWS Amplify Gen2 / AppSync customTypes, DynamoDB single-table (`INTELLIGENCE_TABLE`) via `@aws-sdk/lib-dynamodb` (incl. `TransactWriteCommand`), vitest module-mock style. Worktree `scratchpad/wt-comms`, branch `feature/customer-360-p2-comms-sync` (node_modules symlinked). Spec: `docs/superpowers/specs/2026-07-09-customer-360-p2-comms-sync-design.md` @ `da47e1bf`.

**Test commands:** `npx vitest run <paths>` from worktree root; full backend `npx vitest run amplify/functions/crm-api`; `npx tsc --noEmit -p amplify/tsconfig.json` (clean) and `npx tsc --noEmit` (only the pre-existing `amplify_outputs.json`/`main.tsx` error); `npx eslint <changed>`.

**Invariants for every review gate (from spec R1–R10):**
1. Audit ids derive ONLY from committed values (`reason|unitKey|targetOrgId[|generation]`); non-generational ids byte-identical to today's (existing rows!).
2. No client-named partitions: the link server-derives everything from a strongly-read, fully-validated representative event (unresolved ∧ ¬voided ∧ ¬internalOnly ∧ `unresolved-` org ∧ allowed source).
3. Per-event eligibility in EVERY move condition (`unresolved ∧ orgId=:unitKey ∧ ¬voided ∧ ¬internalOnly ∧ source=:src`).
4. First move + marker in ONE `TransactWriteItems`; marker `attribute_not_exists(PK)`; a loser's transaction aborts → no marker.
5. Marker lifecycle `building → pending`; drainer sees `pending` only; abandoned `building` ages in; ALL transitions version-fenced; CCFE on a transition = another actor won = skip.
6. Generations are plain ULIDs (spec R10 final — honest monotonic LWW, R9-accepted for true concurrency); older generation ⇒ `superseded` SUCCESS no-op on Contact + source; `linkLocked` never re-orged (`locked` = success).
7. **Merge never touches stamps** (re-points org only); replays resolve their target through the merge chain — active ⇒ apply, archived+`mergedInto` ⇒ apply to the canonical successor (depth ≤5, cycle-checked), no valid successor ⇒ `target_unavailable` and the marker stays blocked/actionable (NEVER false success); audits carry requested + effective target; non-generational writers preserve `lastLinkGeneration`; creation-time resolution is generation-absent; **every delayed `matchedOrgId` writer is guarded against overwriting a stamped decision** (Task 8b).
8. Admin-group authorization before ANY DynamoDB access on the guarded resolvers; both `claims['cognito:groups']` (string or array) and `identity.groups` shapes.
9. Markers/audits bounded: `movedCount` + ≤100-id sample, never full lists.
10. Post-commit effects never throw out of an orchestrator; failure ⇒ marker survives + `postCommitStatus:'post_commit_failed'`.

---

### Task 1: ULID generator

**Files:**
- Create: `amplify/functions/crm-api/lib/ulid.ts`
- Test: `amplify/functions/crm-api/lib/ulid.test.ts`

- [ ] **Step 1: Write the failing test** — create `amplify/functions/crm-api/lib/ulid.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { generateUlid, ULID_REGEX } from './ulid';

describe('generateUlid', () => {
  it('produces 26-char Crockford base32 ULIDs', () => {
    const u = generateUlid();
    expect(u).toHaveLength(26);
    expect(u).toMatch(ULID_REGEX);
  });
  it('is unique across rapid calls', () => {
    const seen = new Set(Array.from({ length: 1000 }, () => generateUlid()));
    expect(seen.size).toBe(1000);
  });
  it('lexicographic order follows time for calls ≥2ms apart', async () => {
    const a = generateUlid();
    await new Promise((r) => setTimeout(r, 3));
    const b = generateUlid();
    expect(a < b).toBe(true);
  });
});
```

- [ ] **Step 2: Run** `npx vitest run amplify/functions/crm-api/lib/ulid.test.ts` — expect FAIL (module not found).

- [ ] **Step 3: Implement** — create `amplify/functions/crm-api/lib/ulid.ts` (no dependency; Crockford base32):
```ts
import crypto from 'node:crypto';

// Time-ordered unique id: 10 chars of ms-timestamp + 16 chars of randomness, Crockford base32.
// Lexicographic order == time order (same-ms ties broken arbitrarily — accepted per spec R9/1;
// spec R10: merge-vs-replay is handled STRUCTURALLY via canonical-successor resolution, so stamp
// ordering never has to decide a merge outcome and plain ULIDs suffice).
const ENC = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const ULID_REGEX = /^[0-9A-HJKMNP-TV-Z]{26}$/;

export function generateUlid(now: number = Date.now()): string {
  let ts = now;
  const time = Array.from({ length: 10 }, () => { const c = ENC[ts % 32]; ts = Math.floor(ts / 32); return c; }).reverse().join('');
  const rand = Array.from(crypto.randomBytes(16), (b) => ENC[b % 32]).join('').slice(0, 16);
  return time + rand;
}
```

- [ ] **Step 4: Run** the test — expect PASS. `npx tsc --noEmit -p amplify/tsconfig.json` clean.

- [ ] **Step 5: Commit**
```bash
git add amplify/functions/crm-api/lib/ulid.ts amplify/functions/crm-api/lib/ulid.test.ts
git commit -m "feat(comms-p1): dependency-free ULID generator (time-ordered generations)"
```

---

### Task 2: Generational audit identity (32-hex) — legacy ids byte-identical

**Files:**
- Modify: `amplify/functions/crm-api/lib/idGenerators.ts` (the `deterministicAuditId` added in 3C)
- Test: `amplify/functions/crm-api/lib/idGenerators.test.ts` (append)

- [ ] **Step 1: Failing test (append to the existing `deterministicAuditId` describe):**
```ts
it('WITHOUT generation: byte-identical to the legacy 16-hex id (existing audit rows depend on it)', () => {
  const legacy = `audit-${crypto.createHash('sha256').update('manual_link_unit|u1|acme.com').digest('hex').slice(0, 16)}`;
  expect(deterministicAuditId('manual_link_unit', 'u1', 'acme.com')).toBe(legacy);
});
it('WITH generation: 32-hex id that varies by generation (every manual action = own row)', () => {
  const a = deterministicAuditId('manual_link_unit', 'u1', 'acme.com', '01J0AAAAAAAAAAAAAAAAAAAAAA');
  const b = deterministicAuditId('manual_link_unit', 'u1', 'acme.com', '01J0BBBBBBBBBBBBBBBBBBBBBB');
  expect(a).toMatch(/^audit-[0-9a-f]{32}$/);
  expect(a).not.toBe(b);
  expect(a).toBe(deterministicAuditId('manual_link_unit', 'u1', 'acme.com', '01J0AAAAAAAAAAAAAAAAAAAAAA')); // replay-stable
});
```
(The test file already imports `crypto` — if not, add `import crypto from 'node:crypto';`.)

- [ ] **Step 2: Run** `npx vitest run amplify/functions/crm-api/lib/idGenerators.test.ts` — FAIL (arity/format).

- [ ] **Step 3: Implement** — replace the 3C function body in `idGenerators.ts`:
```ts
export function deterministicAuditId(reason: string, unitKey: string, targetOrgId: string, generation?: string): string {
  if (!generation) {
    // legacy non-generational id — MUST stay byte-identical (existing audit rows were written with it)
    return `audit-${crypto.createHash('sha256').update(`${reason}|${unitKey}|${targetOrgId}`).digest('hex').slice(0, 16)}`;
  }
  // generational id: 32 hex (spec R9 plan-level: longer hashes for the higher-cardinality space)
  return `audit-${crypto.createHash('sha256').update(`${reason}|${unitKey}|${targetOrgId}|${generation}`).digest('hex').slice(0, 32)}`;
}
```

- [ ] **Step 4: Run** file tests — PASS (incl. all pre-existing cases). tsc clean.

- [ ] **Step 5: Commit**
```bash
git add amplify/functions/crm-api/lib/idGenerators.ts amplify/functions/crm-api/lib/idGenerators.test.ts
git commit -m "feat(comms-p1): generational 32-hex audit identity; legacy ids byte-identical"
```

---

### Task 3: `TimelineIdInput` gmail variants + Message-ID normalization

**Files:**
- Modify: `amplify/functions/crm-api/lib/timelineId.ts`, `amplify/functions/crm-api/lib/normalize.ts`
- Test: `amplify/functions/crm-api/lib/timelineId.test.ts`, `amplify/functions/crm-api/lib/normalize.test.ts` (append)

- [ ] **Step 1: Read** `amplify/functions/crm-api/lib/timelineId.ts` — it's a discriminated-union → deterministic-id mapper (`tev-<source>-<stable-key>` style). Note its exact union & hashing helpers to extend consistently.

- [ ] **Step 2: Failing tests.** Append to `normalize.test.ts`:
```ts
describe('normalizeRfc822MessageId', () => {
  it('trims, strips surrounding <>, lowercases', () => {
    expect(normalizeRfc822MessageId('  <CAF+Abc123@Mail.Gmail.Com>  ')).toBe('caf+abc123@mail.gmail.com');
  });
  it('passes through an already-bare id', () => {
    expect(normalizeRfc822MessageId('x@y.z')).toBe('x@y.z');
  });
});
```
Append to `timelineId.test.ts`:
```ts
it('gmail (rfc822MessageId): tev-gmail-<sha16 of normalized Message-ID>, stable across raw forms', () => {
  const a = timelineId({ source: 'gmail', rfc822MessageId: '<ABC@x.com>' });
  const b = timelineId({ source: 'gmail', rfc822MessageId: 'abc@x.com' });
  expect(a).toBe(b);
  expect(a).toMatch(/^tev-gmail-[0-9a-f]{16}$/);
});
it('gmail fallback (mailbox + gmailMessageId): mailbox-namespaced literal id', () => {
  expect(timelineId({ source: 'gmail', mailbox: 'info@ninescrolls.com', gmailMessageId: '18f2ab' }))
    .toBe('tev-gmail-info@ninescrolls.com-18f2ab');
});
```

- [ ] **Step 3: Run** both test files — FAIL.

- [ ] **Step 4: Implement.** In `normalize.ts` add:
```ts
export function normalizeRfc822MessageId(raw: string): string {
  const t = raw.trim();
  return (t.startsWith('<') && t.endsWith('>') ? t.slice(1, -1) : t).toLowerCase();
}
```
In `timelineId.ts`: add to the union
```ts
  | { source: 'gmail'; rfc822MessageId: string }
  | { source: 'gmail'; mailbox: string; gmailMessageId: string }
```
and to the mapper (reusing the file's existing sha helper, or `crypto.createHash('sha256')...slice(0,16)` if none):
```ts
  if (input.source === 'gmail') {
    if ('rfc822MessageId' in input) {
      const norm = normalizeRfc822MessageId(input.rfc822MessageId);
      return `tev-gmail-${crypto.createHash('sha256').update(norm).digest('hex').slice(0, 16)}`;
    }
    return `tev-gmail-${input.mailbox}-${input.gmailMessageId}`;
  }
```
(import `normalizeRfc822MessageId`; keep every existing branch untouched.)

- [ ] **Step 5: Run** both files + tsc — PASS/clean.

- [ ] **Step 6: Commit**
```bash
git add amplify/functions/crm-api/lib/timelineId.ts amplify/functions/crm-api/lib/timelineId.test.ts amplify/functions/crm-api/lib/normalize.ts amplify/functions/crm-api/lib/normalize.test.ts
git commit -m "feat(comms-p1): TimelineIdInput gmail variants + RFC822 Message-ID normalization"
```

---

### Task 4: Emit path carries comms fields (stop hard-nulling)

**Files:**
- Modify: `amplify/functions/crm-api/lib/emitTimelineEvent.ts`, `amplify/lib/crm/types.ts`
- Test: `amplify/functions/crm-api/lib/emitTimelineEvent.test.ts` (append)

- [ ] **Step 1: Failing tests (append; mirror the file's existing mocks — it mocks resolveLinks/contactStore/orgStore/timelineStore/docClient):**
```ts
it('persists comms fields when provided', async () => {
  await emitTimelineEvent({ ...baseArgs, direction: 'inbound', externalId: 'mid@x', threadId: 't1',
    from: 'a@ext.com', to: 'info@ninescrolls.com', subject: 'Hi', bodySnippet: 'snippet…' } as never);
  const item = putItem(); // the file's helper for the captured PutCommand Item — reuse its accessor
  expect(item.direction).toBe('inbound');
  expect(item.externalId).toBe('mid@x');
  expect(item.threadId).toBe('t1');
  expect(item.from).toBe('a@ext.com');
  expect(item.to).toBe('info@ninescrolls.com');
  expect(item.subject).toBe('Hi');
  expect(item.bodySnippet).toBe('snippet…');
});
it('still writes null comms fields when omitted (existing channels byte-identical)', async () => {
  await emitTimelineEvent(baseArgs as never);
  const item = putItem();
  for (const f of ['direction','externalId','threadId','from','to','subject','bodySnippet']) expect(item[f]).toBeNull();
});
```
(Read the test file first; reuse its existing `baseArgs`/captured-item accessor names verbatim.)

- [ ] **Step 2: Run** — FAIL (fields null / type error).

- [ ] **Step 3: Implement.** In `emitTimelineEvent.ts` add to `EmitArgs`:
```ts
  direction?: 'inbound' | 'outbound';
  externalId?: string; threadId?: string;
  from?: string; to?: string; subject?: string; bodySnippet?: string;
```
and in `buildItem` replace the hard-null line (`emitTimelineEvent.ts:53`) with:
```ts
    direction: args.direction ?? null, externalId: args.externalId ?? null, threadId: args.threadId ?? null,
    from: args.from ?? null, to: args.to ?? null, subject: args.subject ?? null, bodySnippet: args.bodySnippet ?? null,
```
In `amplify/lib/crm/types.ts` add the same seven optional fields to `CrmEmitPayload` (so channel Lambdas can pass them through `emitTimelineEventToCrm`).

- [ ] **Step 4: Run** the file's full test suite + tsc (both configs) — PASS/clean.

- [ ] **Step 5: Commit**
```bash
git add amplify/functions/crm-api/lib/emitTimelineEvent.ts amplify/functions/crm-api/lib/emitTimelineEvent.test.ts amplify/lib/crm/types.ts
git commit -m "feat(comms-p1): emit path carries optional comms fields (null when absent)"
```

---

### Task 5: `ResolveInput.channel:'gmail'` + collapse-by-customerEmail unresolved rule

**Files:**
- Modify: `amplify/functions/crm-api/lib/resolveLinks.ts`
- Test: `amplify/functions/crm-api/lib/resolveLinks.test.ts` (append)

- [ ] **Step 1: Failing tests (append; the file mocks contactStore/orgStore):**
```ts
it("gmail unresolved collapses by normalized customer email, not sourceEntityId", async () => {
  getContactByEmail.mockResolvedValueOnce(null);
  findExistingOrgIdByEmail.mockResolvedValueOnce(null);
  const r = await resolveLinks({ sourceEntityType: 'gmail', sourceEntityId: 'mid-123',
    channel: 'gmail', email: '  Bob@Gmail.Com ' } as never);
  expect(r.orgId).toBe('unresolved-gmail-bob@gmail.com');
  expect(r.resolutionStatus).toBe('unresolved');
});
it('gmail unresolved WITHOUT an email falls back to the sourceEntityId form (defensive)', async () => {
  const r = await resolveLinks({ sourceEntityType: 'gmail', sourceEntityId: 'mid-9', channel: 'gmail' } as never);
  expect(r.orgId).toBe('unresolved-gmail-mid-9');
});
it('non-gmail unresolved id is unchanged', async () => {
  getContactByEmail.mockResolvedValueOnce(null);
  findExistingOrgIdByEmail.mockResolvedValueOnce(null);
  const r = await resolveLinks({ sourceEntityType: 'rfq', sourceEntityId: 'r1', channel: 'rfq', email: 'x@nohit.com' } as never);
  expect(r.orgId).toBe('unresolved-rfq-r1');
});
```

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement.** In `resolveLinks.ts`: widen the channel union with `'gmail'`, and change ONLY the final unresolved return:
```ts
  const unresolvedKey = input.channel === 'gmail' && input.email
    ? `unresolved-gmail-${normalizeEmail(input.email)}`
    : `unresolved-${input.sourceEntityType}-${input.sourceEntityId}`;
  return { orgId: unresolvedKey, contactId: null, resolutionStatus: 'unresolved', resolutionReason: 'unresolved', confidence: 0 };
```
(`normalizeEmail` already imported. The ladder above is untouched.)

- [ ] **Step 4: Run** full `resolveLinks.test.ts` + tsc — PASS/clean.

- [ ] **Step 5: Commit**
```bash
git add amplify/functions/crm-api/lib/resolveLinks.ts amplify/functions/crm-api/lib/resolveLinks.test.ts
git commit -m "feat(comms-p1): gmail channel + collapse-by-customerEmail unresolved rule"
```

---

### Task 6: Handler admin-group authorization

**Files:**
- Create: `amplify/functions/crm-api/lib/authz.ts`
- Modify: `amplify/functions/crm-api/handler.ts`
- Test: `amplify/functions/crm-api/lib/authz.test.ts`, `amplify/functions/crm-api/handler.test.ts` (append)

- [ ] **Step 1: Failing tests.** Create `authz.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { isAdmin } from './authz';

describe('isAdmin', () => {
  it('claims cognito:groups as ARRAY containing admin → true', () =>
    expect(isAdmin({ identity: { claims: { 'cognito:groups': ['admin', 'x'] } } } as never)).toBe(true));
  it('claims cognito:groups as comma STRING containing admin → true', () =>
    expect(isAdmin({ identity: { claims: { 'cognito:groups': 'staff,admin' } } } as never)).toBe(true));
  it('identity.groups shape → true', () =>
    expect(isAdmin({ identity: { groups: ['admin'] } } as never)).toBe(true));
  it('wrong group → false; no identity → false; empty → false', () => {
    expect(isAdmin({ identity: { claims: { 'cognito:groups': ['staff'] } } } as never)).toBe(false);
    expect(isAdmin({} as never)).toBe(false);
    expect(isAdmin({ identity: { claims: {} } } as never)).toBe(false);
  });
});
```
Append to `handler.test.ts` (plan-review fix: cover **ALL six** guarded resolvers × three identity cases; reuse its mocks; reject BEFORE the lib fn is called):
```ts
const GUARDED: Array<[string, () => ReturnType<typeof vi.fn>]> = [
  ['timelineByOrg', () => timelineByOrgFn], ['needsLinkingQueue', () => needsLinkingQueueFn],
  ['linkStructuredUnit', () => linkStructuredUnit], ['linkVisitor', () => linkVisitorFn],
  ['crmHealth', () => crmHealthFn], ['runCrmRepair', () => reconcileRepair],
];
describe.each(GUARDED)('authz on %s', (fieldName, target) => {
  it('missing groups → rejected, lib fn NOT called', async () => {
    await expect(handler({ info: { fieldName }, arguments: {}, identity: { claims: {} } } as never)).rejects.toThrow(/admin/i);
    expect(target()).not.toHaveBeenCalled();
  });
  it('wrong group → rejected, lib fn NOT called', async () => {
    await expect(handler({ info: { fieldName }, arguments: {}, identity: { claims: { 'cognito:groups': ['staff'] } } } as never)).rejects.toThrow(/admin/i);
    expect(target()).not.toHaveBeenCalled();
  });
  it('admin group → passes the guard (lib fn called)', async () => {
    await handler({ info: { fieldName }, arguments: adminArgsFor(fieldName), identity: { claims: { 'cognito:groups': ['admin'] } } } as never).catch(() => {});
    expect(target()).toHaveBeenCalled();
  });
});
```
(`adminArgsFor` returns minimally-valid arguments per field so the resolver reaches its lib call; the `.catch` absorbs downstream mock rejections — the assertion is only that the guard passed.)

- [ ] **Step 2: Run** both — FAIL.

- [ ] **Step 3: Implement.** Create `amplify/functions/crm-api/lib/authz.ts`:
```ts
// Handler-level authorization (spec R6/blocker-1): allow.authenticated() admits ANY pool user, so
// admin resolvers must verify the `admin` Cognito group BEFORE any DynamoDB access. Both shapes
// appear in the wild: claims['cognito:groups'] (array OR comma-string) and identity.groups.
type IdentityShape = { identity?: { groups?: string[]; claims?: Record<string, unknown> } };

export function isAdmin(event: IdentityShape): boolean {
  const id = event.identity;
  if (!id) return false;
  if (Array.isArray(id.groups) && id.groups.includes('admin')) return true;
  const raw = id.claims?.['cognito:groups'];
  if (Array.isArray(raw)) return raw.includes('admin');
  if (typeof raw === 'string') return raw.split(',').map((s) => s.trim()).includes('admin');
  return false;
}

export function requireAdmin(event: IdentityShape): void {
  if (!isAdmin(event)) throw new Error('forbidden: admin group required');
}
```
In `handler.ts`: `import { requireAdmin } from './lib/authz';` and make the FIRST line of each guarded resolver (`timelineByOrg`, `needsLinkingQueue`, `linkStructuredUnit`, `linkVisitor`, `crmHealth`, `runCrmRepair`) `requireAdmin(e);`.

- [ ] **Step 4: Run** `authz.test.ts` + full `handler.test.ts` + tsc — PASS/clean. (Existing handler tests that call guarded resolvers must be updated to pass an admin identity — do that in the same commit; it is the point of the change.)

- [ ] **Step 5: Commit**
```bash
git add amplify/functions/crm-api/lib/authz.ts amplify/functions/crm-api/lib/authz.test.ts amplify/functions/crm-api/handler.ts amplify/functions/crm-api/handler.test.ts
git commit -m "feat(comms-p1): admin-group authorization before DynamoDB access on admin resolvers"
```

---

### Task 7: Generation-aware `upsertContact` (preserve + conditional + locked/superseded)

**Files:**
- Modify: `amplify/functions/crm-api/lib/contactStore.ts`, `amplify/functions/crm-api/lib/types.ts`
- Test: `amplify/functions/crm-api/lib/contactStore.test.ts` (append)

- [ ] **Step 1: Failing tests (append; the file mocks docClient):**
```ts
it('non-generational upsert CARRIES lastLinkGeneration forward (never drops it)', async () => {
  mockGetByEmail({ contactId: 'ct-1', orgId: 'a.com', linkLocked: false, lastLinkGeneration: '01J0AAAA…', firstSeenAt: 't0', lastSeenAt: 't0' });
  await upsertContact({ email: 'b@x.com', orgId: 'b.com', source: 'rfq', occurredAt: 't1' });
  expect(putItem().lastLinkGeneration).toBe('01J0AAAA…');
});
it('generational upsert with a NEWER generation writes org + generation via condition', async () => {
  mockGetByEmail({ contactId: 'ct-1', orgId: 'a.com', linkLocked: false, lastLinkGeneration: '01J0AAAA…' });
  const r = await upsertContact({ email: 'b@x.com', orgId: 'b.com', source: 'gmail', occurredAt: 't1', linkGeneration: '01J0BBBB…' });
  expect(r.outcome).toBe('written');
  expect(putInput().ConditionExpression).toContain('lastLinkGeneration');
  expect(putItem().lastLinkGeneration).toBe('01J0BBBB…');
});
it('generational upsert with an OLDER generation → superseded SUCCESS no-op (also on CCFE race)', async () => {
  mockGetByEmail({ contactId: 'ct-1', orgId: 'b.com', linkLocked: false, lastLinkGeneration: '01J0BBBB…' });
  const r = await upsertContact({ email: 'b@x.com', orgId: 'a.com', source: 'gmail', occurredAt: 't1', linkGeneration: '01J0AAAA…' });
  expect(r.outcome).toBe('superseded');
  expect(noPutHappened()).toBe(true);
});
it('linkLocked contact is never re-orged by ANY generation → locked SUCCESS no-op', async () => {
  mockGetByEmail({ contactId: 'ct-1', orgId: 'a.com', linkLocked: true, lastLinkGeneration: null });
  const r = await upsertContact({ email: 'b@x.com', orgId: 'b.com', source: 'gmail', occurredAt: 't1', linkGeneration: '01J0BBBB…' });
  expect(r.outcome).toBe('locked');
});
```
(Reuse the file's existing mock helpers for the GSI4 lookup + captured Put; name them per the file — read it first.)

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement.** In `types.ts` add `lastLinkGeneration: string | null;` to `ContactItem`. In `contactStore.ts` change `upsertContact` to the following — **the ENTIRE function body is one bounded read→decide→build→CAS loop** (plan-review R2 Critical: a retry must rebuild the WHOLE item from a fresh read; re-reading only the stamp would pair a fresh generation with stale org/lock/fields, making stale data authoritative):
```ts
export type ContactUpsertOutcome = 'written' | 'superseded' | 'locked';

export async function upsertContact(args: {
  email: string; orgId: string; source: string; occurredAt: string;
  name?: string; title?: string; role?: string; phone?: string;
  linkGeneration?: string;                       // generational (link/replay) callers only
}): Promise<{ contactId: string; outcome: ContactUpsertOutcome }> {
  const email = normalizeEmail(args.email);
  const nowIso = new Date().toISOString();
  const occurredAt = args.occurredAt;

  // ONE bounded read→decide→build→CAS loop for BOTH paths (plan-review R2 Critical):
  // every retry starts from a COMPLETELY fresh read, so org/lock/stamp/fields are always coherent.
  for (let attempt = 0; attempt < 3; attempt++) {
    const existing = await getContactByEmail(email);
    const contactId = existing?.contactId ?? contactIdForEmail(email);

    if (args.linkGeneration) {
      if (existing?.linkLocked) return { contactId, outcome: 'locked' };        // R8: never re-org a locked contact
      if (existing?.lastLinkGeneration && existing.lastLinkGeneration >= args.linkGeneration) {
        return { contactId, outcome: 'superseded' };                            // R8: older replay = success no-op
      }
    }

    const orgId = args.linkGeneration ? args.orgId : (existing?.linkLocked ? existing.orgId : args.orgId);
    const firstSeenAt = existing?.firstSeenAt && existing.firstSeenAt < occurredAt ? existing.firstSeenAt : occurredAt;
    const lastSeenAt = existing?.lastSeenAt && existing.lastSeenAt > occurredAt ? existing.lastSeenAt : occurredAt;
    const observed = existing?.lastLinkGeneration ?? null;

    const item = {
      ...contactKeys({ contactId, email, orgId }),
      entityType: 'CONTACT' as const,
      contactId, email, orgId, source: existing?.source ?? args.source,
      name: args.name ?? existing?.name ?? null, title: args.title ?? existing?.title ?? null,
      role: args.role ?? existing?.role ?? null, phone: args.phone ?? existing?.phone ?? null,
      linkLocked: existing?.linkLocked ?? false,
      // R9: generational callers set their own stamp; non-generational carry the OBSERVED one forward.
      lastLinkGeneration: args.linkGeneration ?? observed,
      firstSeenAt, lastSeenAt,
      createdAt: existing?.createdAt ?? nowIso, updatedAt: nowIso,
    };

    const put = args.linkGeneration
      ? new PutCommand({ TableName: TABLE_NAME(), Item: item,
          // store-enforced monotonicity — a racing NEWER generation makes this CCFE
          ConditionExpression: 'attribute_not_exists(PK) OR attribute_not_exists(lastLinkGeneration) OR lastLinkGeneration < :gen',
          ExpressionAttributeValues: { ':gen': args.linkGeneration } })
      : (observed === null
          ? new PutCommand({ TableName: TABLE_NAME(), Item: item,
              ConditionExpression: 'attribute_not_exists(PK) OR attribute_not_exists(lastLinkGeneration) OR lastLinkGeneration = :null',
              ExpressionAttributeValues: { ':null': null } })
          : new PutCommand({ TableName: TABLE_NAME(), Item: item,
              ConditionExpression: 'attribute_not_exists(PK) OR lastLinkGeneration = :obs',
              ExpressionAttributeValues: { ':obs': observed } }));
    try {
      await docClient.send(put);
      return { contactId, outcome: 'written' };
    } catch (err) {
      if ((err as { name?: string }).name !== 'ConditionalCheckFailedException') throw err;
      // Something changed under us. Generational: loop re-reads — a newer stamp now yields
      // 'superseded' from the fresh decide step. Non-generational: loop rebuilds on the fresh state.
    }
  }
  throw new Error('upsertContact: contended repeatedly; giving up after 3 attempts');
}
```
**Additional required tests (R2 Critical):** (a) after a raced CCFE, the retry's item reflects the FRESH read's org+lock+stamp **as a pair** (assert the final Put's `Item.orgId` AND `Item.lastLinkGeneration` both come from the re-read); (b) a contact that became `linkLocked` between read and write → generational retry returns `locked` (not a write); (c) null→absent stamp transitions in both directions; (d) three consecutive CCFEs → throws the bounded-contention error.
**Stamp format note:** `upsertContact` treats `linkGeneration` as an OPAQUE ordered string; generational fixtures use plain ULIDs (spec R10 final).
**Write-time active-org fence (R5, used by Task 8's replay):** args gain `activeOrgFence?: boolean`. When true, the final Put is issued as `TransactWriteItems([ConditionCheck(orgKey(item.orgId), '#s = :active'), { Put: <the item with its EXISTING ConditionExpression> }])`. Cancellation mapping: org-check failed ⇒ return new outcome `'org_inactive'` (the caller — replay — re-resolves the successor and calls again with the new orgId); contact-condition failed ⇒ feed the existing CCFE retry loop unchanged; both `false`/absent ⇒ today's plain PutCommand, byte-identical. Tests: (e) fence=true issues the transaction with both elements and the contact Put's condition preserved inside it; (f) org-check cancellation ⇒ `org_inactive`, no retry loop consumed; (g) fence absent ⇒ plain PutCommand (snapshot-pin).
**Add the race test:**
```ts
it('non-generational write CASes on the observed generation and retries after a racing generational update', async () => {
  mockGetByEmail({ contactId: 'ct-1', orgId: 'a.com', linkLocked: false, lastLinkGeneration: '01J0AAAA…' });
  send.mockRejectedValueOnce(Object.assign(new Error('raced'), { name: 'ConditionalCheckFailedException' })); // Put v1 fails
  mockGetByEmailOnce({ contactId: 'ct-1', orgId: 'b.com', linkLocked: false, lastLinkGeneration: '01J0BBBB…' }); // re-read sees newer
  send.mockResolvedValueOnce({});                                                                              // retry Put succeeds
  await upsertContact({ email: 'b@x.com', orgId: 'c.com', source: 'rfq', occurredAt: 't1' });
  const finalItem = putItemAt(-1);
  expect(finalItem.lastLinkGeneration).toBe('01J0BBBB…');       // carried forward the FRESH stamp, not the stale one
});
```
**Callers:** the return type changed from `Promise<string>`. Update every call site to `(await upsertContact(...)).contactId` — `emitTimelineEvent.ts` and `manualMoveTimelineEvent.ts` (grep `upsertContact(` to catch all; keep their behavior otherwise identical).

- [ ] **Step 4: Run** `contactStore.test.ts` + `emitTimelineEvent.test.ts` + `manualMoveTimelineEvent.test.ts` + tsc — PASS/clean.

- [ ] **Step 5: Commit**
```bash
git add amplify/functions/crm-api/lib/contactStore.ts amplify/functions/crm-api/lib/contactStore.test.ts amplify/functions/crm-api/lib/types.ts amplify/functions/crm-api/lib/emitTimelineEvent.ts amplify/functions/crm-api/lib/link/manualMoveTimelineEvent.ts
git commit -m "feat(comms-p1): generation-aware upsertContact (preserve/conditional/superseded/locked)"
```

---

### Task 8: Generational source backfill (`superseded`) + canonical-successor resolution + merge boundary

**Files:**
- Modify: `amplify/functions/crm-api/lib/repair/replaySideEffects.ts`
- Modify: organization-api merge flow (locate via `git grep -n "mergeOrganization\|matchedOrgId" amplify/functions/organization-api/`)
- Test: `amplify/functions/crm-api/lib/repair/replaySideEffects.structured.test.ts` (append) + the organization-api merge test file

- [ ] **Step 1: Failing tests (replay side).** Append:
```ts
it('backfill stamps matchedOrgId + matchedOrgLinkGeneration atomically', async () => {
  send.mockResolvedValueOnce({});
  await replayStructuredSideEffects({ ...base, generation: '01J0BBBB…' });
  const u = send.mock.calls[0][0].input;
  expect(u.UpdateExpression).toContain('matchedOrgId');
  expect(u.UpdateExpression).toContain('matchedOrgLinkGeneration');
  expect(u.ConditionExpression).toContain('matchedOrgLinkGeneration < :gen');
});
it('older generation vs newer stamp → superseded SUCCESS (not conflict, not stuck)', async () => {
  send.mockRejectedValueOnce(Object.assign(new Error('ccfe'), { name: 'ConditionalCheckFailedException' }));
  send.mockResolvedValueOnce({ Item: { matchedOrgId: 'b.com', matchedOrgLinkGeneration: '01J0BBBB…' } });
  const r = await replayStructuredSideEffects({ ...base, targetOrgId: 'a.com', generation: '01J0AAAA…' });
  expect(r.ok).toBe(true);
  expect(r.backfillStatus).toBe('superseded');
});
it('genuine non-generational real-org mismatch is still conflict', async () => {
  send.mockRejectedValueOnce(Object.assign(new Error('ccfe'), { name: 'ConditionalCheckFailedException' }));
  send.mockResolvedValueOnce({ Item: { matchedOrgId: 'other.com' } });   // no generation stamp
  const r = await replayStructuredSideEffects({ ...base, generation: '01J0AAAA…' });
  expect(r).toMatchObject({ ok: false, errorType: 'source_conflict' });
});
// ---- spec R10 final: canonical-successor resolution -------------------------
it('MERGE-BEFORE-REPLAY: archived target with mergedInto → replay applies to the successor; audit carries both', async () => {
  mockOrg('a.com', { status: 'archived', mergedInto: 'b.com' });
  mockOrg('b.com', { status: 'active' });
  send.mockResolvedValueOnce({});                                  // the backfill write
  const r = await replayStructuredSideEffects({ ...base, targetOrgId: 'a.com', generation: '01J0AAAA…' });
  expect(r.ok).toBe(true);
  expect(backfillWriteInput().ExpressionAttributeValues[':o']).toBe('b.com');   // applied THERE
  expect(auditCallDetails()).toMatchObject({ requestedTargetOrgId: 'a.com', effectiveTargetOrgId: 'b.com' });
});
it('MULTI-HOP: a→b→c chain resolves to the final active org', async () => {
  mockOrg('a.com', { status: 'archived', mergedInto: 'b.com' });
  mockOrg('b.com', { status: 'archived', mergedInto: 'c.com' });
  mockOrg('c.com', { status: 'active' });
  send.mockResolvedValueOnce({});
  const r = await replayStructuredSideEffects({ ...base, targetOrgId: 'a.com', generation: '01J0AAAA…' });
  expect(r.ok).toBe(true);
  expect(backfillWriteInput().ExpressionAttributeValues[':o']).toBe('c.com');
});
it('MISSING SUCCESSOR: archived without mergedInto → target_unavailable, ok:false, NO writes', async () => {
  mockOrg('a.com', { status: 'archived' });
  const r = await replayStructuredSideEffects({ ...base, targetOrgId: 'a.com', generation: '01J0AAAA…' });
  expect(r).toMatchObject({ ok: false, errorType: 'target_unavailable' });
  expect(writesTo('RFQ#')).toHaveLength(0);                        // nothing half-applied
});
it('CYCLE + DEPTH LIMIT: a→b→a and chains >5 hops → target_unavailable, no infinite walk', async () => {
  mockOrg('a.com', { status: 'archived', mergedInto: 'b.com' });
  mockOrg('b.com', { status: 'archived', mergedInto: 'a.com' });
  const r = await replayStructuredSideEffects({ ...base, targetOrgId: 'a.com', generation: '01J0AAAA…' });
  expect(r).toMatchObject({ ok: false, errorType: 'target_unavailable' });
  expect(orgReads()).toHaveLength(2);                               // visited-set stopped it, not a timeout
});
it('STATUS DISCIPLINE: only exact active applies; non-navigable status is structural; reads are ConsistentRead', async () => {
  mockOrg('a.com', { status: 'pending_review' });                   // neither active nor archived
  const r = await replayStructuredSideEffects({ ...base, targetOrgId: 'a.com', generation: '01J0AAAA…' });
  expect(r).toMatchObject({ ok: false, errorType: 'target_unavailable' });
  expect(orgReads()[0].ConsistentRead).toBe(true);
});
it('TRANSIENT vs STRUCTURAL: an org-read THROW is transient (retryable), never target_unavailable', async () => {
  rejectOrgReadOnce(new Error('throttled'));
  const r = await replayStructuredSideEffects({ ...base, targetOrgId: 'a.com', generation: '01J0AAAA…' });
  expect(r).toMatchObject({ ok: false, errorType: 'transient' });
});
it('WRITE-TIME FENCE: backfill rides a TransactWriteItems with an org-active ConditionCheck', async () => {
  mockOrg('a.com', { status: 'active' });
  transactSucceeds();
  await replayStructuredSideEffects({ ...base, targetOrgId: 'a.com', generation: '01J0AAAA…' });
  const tx = lastTransactInput().TransactItems;
  expect(tx[0].ConditionCheck.ConditionExpression).toBe('#s = :active');
  expect(tx[1].Update.UpdateExpression).toContain('matchedOrgId');
});
it('FENCE CANCELLATION → re-resolve ONCE and apply to the successor; second cancellation → transient', async () => {
  mockOrg('a.com', { status: 'active' });                            // preflight read says active…
  rejectTransactWithCancellation(['ConditionalCheckFailed', 'None']); // …but the org check fails at write time (archived meanwhile)
  mockOrg('a.com', { status: 'archived', mergedInto: 'b.com' });      // re-resolve now sees the merge
  mockOrg('b.com', { status: 'active' });
  transactSucceeds();
  const r = await replayStructuredSideEffects({ ...base, targetOrgId: 'a.com', generation: '01J0AAAA…' });
  expect(r.ok).toBe(true);
  expect(lastTransactInput().TransactItems[1].Update.ExpressionAttributeValues[':o']).toBe('b.com');
});
it('REDIRECT MOVES THE UNIT EVENTS: effective≠requested pages linkGeneration-stamped events to the successor and dirties both rollups', async () => {
  mockOrg('a.com', { status: 'archived', mergedInto: 'b.com' });
  mockOrg('b.com', { status: 'active' });
  mockTimelinePage('a.com', [evStamped('tev-1', '01J0AAAA…'), evStamped('tev-2', '01J0AAAA…')]);
  transactSucceeds();
  const r = await replayStructuredSideEffects({ ...base, targetOrgId: 'a.com', generation: '01J0AAAA…' });
  expect(r.ok).toBe(true);
  const moves = updatesTo('TLEVENT#');
  expect(moves).toHaveLength(2);
  expect(moves[0].ConditionExpression).toContain('linkGeneration = :gen');   // only THIS unit's events
  expect(dirtyRollupCalls().map((c) => c.orgId).sort()).toEqual(['a.com', 'b.com']);
});
```
(`base` gains `generation`; add it to the shared fixture. `mockOrg`/`backfillWriteInput`/`auditCallDetails`/`writesTo`/`orgReads` are small helpers over the send mock.)

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement replay side.** In `replaySideEffects.ts`: `BackfillStatus` gains `'superseded'`. The COMPLETE new signature (plan-review R2: shown in full — callers migrate in Tasks 10/12; the optional params keep every existing caller compiling at THIS task's checkpoint):
```ts
export interface ReplayStructuredArgs {
  sourceType: 'rfq' | 'lead' | 'order' | 'quote' | 'logistics' | 'gmail';
  sourceEntityId: string;
  targetOrgId: string;
  targetOrgName: string;
  generation?: string;              // NEW, optional: absent ⇒ legacy 3C semantics, byte-identical
  customerEmail?: string | null;    // NEW, optional: needed only for gmail units (readSourceEmailForUnit)
}
```
**Canonical-successor resolution (spec R10 final) — runs FIRST on every generational replay:**
```ts
type EffectiveTarget = { status: 'active'; orgId: string } | { status: 'unavailable'; reason: string };

// R5: reads are STRONGLY CONSISTENT; only exact 'active' is applicable; successors are followed
// ONLY from exact 'archived'. Any other/missing status is STRUCTURAL unavailability. Read FAILURES
// (network/throttle) are deliberately NOT caught here — they propagate and the caller classifies
// them 'transient' (retryable), so a wobbly read can never park a marker as blocked.
export async function resolveEffectiveTarget(requestedOrgId: string): Promise<EffectiveTarget> {
  const visited = new Set<string>();
  let cur = requestedOrgId;
  for (let hop = 0; hop <= 5; hop++) {
    if (visited.has(cur)) return { status: 'unavailable', reason: `merge-chain cycle at ${cur}` };
    visited.add(cur);
    const org = await readOrg(cur);                       // GetCommand, ConsistentRead: true (locate the exact org key shape via git grep in organization-api)
    if (!org) return { status: 'unavailable', reason: `org ${cur} not found` };
    if (org.status === 'active') return { status: 'active', orgId: cur };
    if (org.status !== 'archived') return { status: 'unavailable', reason: `org ${cur} has non-navigable status '${String(org.status)}'` };
    if (!org.mergedInto) return { status: 'unavailable', reason: `org ${cur} archived without successor` };
    cur = org.mergedInto as string;
  }
  return { status: 'unavailable', reason: 'merge-chain depth limit (5) exceeded' };
}
```
(If the production org item uses a different attribute/value for "active" — locate first; adjust the two comparisons, never invent parallel fields.)
`replayStructuredSideEffects` (generational path only — the legacy path keeps its existing behavior byte-identical): resolve first; `unavailable` ⇒ return `{ ok: false, errorType: 'target_unavailable', reason }` BEFORE any write (the marker survives as blocked/actionable — a potentially-unfinished repair is never a false success); a THROW from `readOrg` ⇒ `{ ok: false, errorType: 'transient' }` (marker stays pending, retried next drain). `active` ⇒ every subsequent effect uses the EFFECTIVE org id; when it differs from the requested one, audit `details` records `{ requestedTargetOrgId, effectiveTargetOrgId }`.

**Write-time active fence (R5 blocker 1 — the resolve read alone is a TOCTOU):** each generational side-effect write is issued as a `TransactWriteItems` pairing the write with a `ConditionCheck` on the effective org:
```ts
const orgActiveCheck = (orgId: string) => ({ ConditionCheck: {
  TableName: TABLE_NAME(), Key: orgKey(orgId),
  ConditionExpression: '#s = :active', ExpressionAttributeNames: { '#s': 'status' }, ExpressionAttributeValues: { ':active': 'active' },
}});
// source backfill: TransactWriteItems([orgActiveCheck(effectiveOrgId), { Update: <the backfillByPk update, unchanged expressions> }])
// contact:        upsertContact({ ..., orgId: effectiveOrgId, linkGeneration: generation, activeOrgFence: true })  (Task 7's fence param)
```
On `TransactionCanceledException` where the ORG check failed: **re-run `resolveEffectiveTarget` once** (the org was archived between resolve and write — its successor is now visible) and retry the write against the new effective org (fresh fence). A second org-check cancellation ⇒ `transient` (retryable — a merge storm is in progress). A cancellation where the WRITE's own condition failed maps to the existing outcomes (`superseded`/`already_set`/`conflict`) exactly as before.

**Timeline-event convergence on redirect (R5 blocker 2 — production merge does NOT move TimelineEvents):** when `effectiveOrgId !== requestedOrgId`, the unit's events may already sit under the archived requested org (the foreground link moved them there). After the source+contact effects, replay runs a **redirect-move pass**: page the requested org's timeline partition (the 3A `timelineByOrg` query shape) filtered `linkGeneration = :gen`, and for each event issue a conditional move to the effective org (`ConditionExpression: 'orgId = :requested AND linkGeneration = :gen'`) — paginated, any unit size; then mark BOTH orgs' rollups dirty (reuse the 3C dirty-rollup helper). Only events stamped with THIS generation move — nothing else in the archived org is touched. Failures in this pass ⇒ `ok:false, errorType:'transient'` (marker retries; moves already made are conditional ⇒ idempotent). Requires Task 10's `linkGeneration` attribute on moved events (queryable membership).
`backfillByPk` — BOTH branches executable, the legacy branch is the verbatim pre-existing 3C code:
```ts
async function backfillByPk(pk: string, targetOrgId: string, generation?: string): Promise<BackfillStatus> {
  const generational = generation !== undefined;
  try {
    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME(), Key: { PK: pk, SK: 'META' },
      UpdateExpression: generational
        ? 'SET matchedOrgId = :o, matchedOrgLinkGeneration = :gen'   // R9: org+generation atomically, one write
        : 'SET matchedOrgId = :o',                                   // legacy 3C shape, unchanged
      ConditionExpression: generational
        ? '(attribute_not_exists(matchedOrgId) OR attribute_type(matchedOrgId, :nullType) OR matchedOrgId = :empty OR begins_with(matchedOrgId, :unres)) OR (attribute_exists(matchedOrgLinkGeneration) AND matchedOrgLinkGeneration < :gen)'
        : 'attribute_not_exists(matchedOrgId) OR attribute_type(matchedOrgId, :nullType) OR matchedOrgId = :empty OR begins_with(matchedOrgId, :unres)',   // exact 3C condition
      ExpressionAttributeValues: generational
        ? { ':o': targetOrgId, ':empty': '', ':unres': 'unresolved-', ':nullType': 'NULL', ':gen': generation }
        : { ':o': targetOrgId, ':empty': '', ':unres': 'unresolved-', ':nullType': 'NULL' },
    }));
    return 'written';
  } catch (err) {
    if ((err as { name?: string }).name !== 'ConditionalCheckFailedException') throw err;
    const cur = (await docClient.send(new GetCommand({ TableName: TABLE_NAME(), Key: { PK: pk, SK: 'META' } }))).Item as Record<string, unknown> | undefined;
    const curGen = cur?.matchedOrgLinkGeneration as string | undefined;
    if (generational && curGen && curGen >= generation!) return 'superseded';   // R8: a later generation already ruled
    return (cur?.matchedOrgId as string | undefined) === targetOrgId ? 'already_set' : 'conflict';
  }
}
```
(`targetOrgId` here is the EFFECTIVE org id from `resolveEffectiveTarget`.) Decision logic: `superseded` counts as ok (like `already_set`); `conflict` unchanged; `target_unavailable` is NOT ok (marker retained). When `generation` is present the audit call passes it to `deterministicAuditId(..., generation)` and includes it in `details` (plus requested/effective target when they differ); when absent, the audit id is computed exactly as today (add a regression test pinning the legacy id for a fixed input). Contact step (Task 7's API): call `upsertContact({..., orgId: effectiveOrgId, linkGeneration: generation})`; `locked`/`superseded` outcomes are SUCCESS for the contact effect. Add a test that a NO-generation call produces the identical UpdateCommand input as the current 3C code (snapshot the `.input`).

- [ ] **Step 4: Merge side — spec R10 FINAL (R5-hardened): four bounded changes to the located `mergeOrganization` flow.**
  1. **`mergedInto` on the archived source org.** Locate the archive write (`git grep -n "archived\|mergedInto" amplify/functions/organization-api/`) — the production field is **`mergedInto`**; verify it is persisted at archive time with the target org id (add it to that same UpdateExpression only if genuinely absent — never invent a second attribute).
  2. **Archive FIRST (R5 blocker 1, merge half of the fence).** Reorder so the source org is archived (status + `mergedInto`) BEFORE record/contact re-pointing begins. From that instant, every replay's write-time `ConditionCheck(status = active)` on the source org cancels ⇒ replays redirect to the successor. Any replay write that PASSED the fence committed before the archive — caught by change 3.
  3. **Re-drain until empty.** After the re-pointing pass, re-run the from-org enumeration (records AND contacts) in a bounded loop until a full pass returns zero items (cap ~5 passes; log a `crm.merge.residual` warning with the residual count if the cap trips — the 3C sweep remains the final net for GSI-lag stragglers). This durably drains fenced-in-flight writes and eventually-consistent GSI late arrivals.
  4. **Reject non-active merge TARGETS (R5).** Production currently accepts an archived target — that would mint chains ending in an archived org. Validate `to` is exactly `status === 'active'` (strong read) at the top; throw otherwise.
  **A regression guard proving merge NEVER touches stamps:** assert the record re-point write's `UpdateExpression` does NOT contain `matchedOrgLinkGeneration` and the contact re-point does NOT contain `lastLinkGeneration` (the R10 boundary: merge re-points orgs; stamp semantics live entirely in crm-api replay/link code).
  **Why this is safe (document in the merge test file header):** already-applied replays supersede on their own stamp; not-yet-applied replays are fenced at write time and redirected (or blocked, never falsely completed); archive-first makes the fence airtight and the re-drain catches the fenced-in-flight window. Clock skew never decides a merge outcome because no stamp comparison is involved.
  Merge-side tests: (a) archive write persists `mergedInto`; (b) archive happens BEFORE the first re-point write (assert call order); (c) re-drain loops until an empty pass (seed a record that only appears on the second pass); (d) merging INTO an archived target throws; (e) the stamp-untouched regression guard.

- [ ] **Step 5: Run** replay tests + merge tests + tsc — PASS/clean.

- [ ] **Step 6: Commit**
```bash
git add amplify/functions/crm-api/lib/repair/replaySideEffects.ts amplify/functions/crm-api/lib/repair/replaySideEffects.structured.test.ts amplify/functions/organization-api
git commit -m "feat(comms-p1): generational source stamps + canonical-successor replay resolution (R10)"
```

---

### Task 8b: Guard every delayed `matchedOrgId` writer (spec R10/critical)

A writer that sets `matchedOrgId` OUTSIDE link/replay/merge (creation-time resolution in submit paths, order conversion) can run AFTER an admin link and overwrite the linked org while leaving the stamp — producing an unrepairable `{newOrg, staleGeneration}` pair. Make that unrepresentable.

**Files:**
- Enumerate FIRST: `git grep -n "matchedOrgId" amplify/functions/ amplify/lib/ | grep -v crm-api/lib/repair | grep -v crm-api/lib/link | grep -v organization-api | grep -v test` — expected hits: submit-rfq, submit-lead, order-creation, lead→order conversion (list EVERY hit in the task report; any writer found beyond these four gets the same treatment).
- Modify: each writer file found.
- Test: each writer's existing test file (append).

- [ ] **Step 1: Failing tests (one per writer).** For each enumerated writer, append a test asserting its `matchedOrgId` write carries a ConditionExpression that refuses to overwrite (i) a stamped record and (ii) an already-set REAL org:
```ts
it('creation/conversion matchedOrgId write cannot overwrite a stamped or real-org record', async () => {
  const call = captureMatchedOrgWrite();                 // helper over the writer's send mock
  expect(call.ConditionExpression).toContain('attribute_not_exists(matchedOrgLinkGeneration)');
  expect(call.ConditionExpression).toContain('attribute_type(matchedOrgId, :nullType)');   // R5: DynamoDB NULL-typed value counts as unset
  expect(call.ConditionExpression).toMatch(/attribute_not_exists\(matchedOrgId\)|matchedOrgId = :empty|begins_with\(matchedOrgId, :unres\)/);
});
it('a CCFE on that write is swallowed as a no-op (the admin decision stands; submission itself still succeeds)', async () => {
  rejectWithCcfe();
  await expect(runWriterHappyPath()).resolves.toBeTruthy();   // the outer submit/conversion MUST NOT fail
});
```
- [ ] **Step 2: Run** — FAIL (writers currently write unconditionally or with weaker guards).
- [ ] **Step 3: Implement.** For each writer: if it CREATES the record (fresh PK, `attribute_not_exists(PK)` semantics), it cannot collide — pin that with a test and leave it. If it UPDATES an existing record, add `attribute_not_exists(matchedOrgLinkGeneration) AND (attribute_not_exists(matchedOrgId) OR attribute_type(matchedOrgId, :nullType) OR matchedOrgId = :empty OR begins_with(matchedOrgId, :unres))` to its ConditionExpression (the NULL-typed branch matters — R5: some records carry `matchedOrgId: NULL`, which is neither absent nor empty-string) and catch CCFE as a logged no-op (`console.log('crm.writer.superseded', …)`).
- [ ] **Step 4: Interleaving test (harness from Task 14):** seed a record; run the REAL link+replay to stamp it (`org=a.com, gen=G`); then run the writer's delayed update targeting `b.com` → store still shows `{a.com, G}`; writer resolved without throwing.
- [ ] **Step 5: Run** all touched writer suites + tsc — PASS/clean.
- [ ] **Step 6: Commit**
```bash
git add <each writer file + test file enumerated in Step 1>
git commit -m "feat(comms-p1): guard delayed matchedOrgId writers against overwriting stamped decisions"
```

---

### Task 9: Repair marker v2 — ULID generations, building→pending, version fencing, bounded fields

**Files:**
- Modify: `amplify/functions/crm-api/lib/repair/repairMarker.ts`
- Test: `amplify/functions/crm-api/lib/repair/repairMarker.test.ts` (extend)

- [ ] **Step 1: Failing tests.** Rework the test file to cover the v2 contract:
```ts
it('buildStructuredMarkerPut: generation-suffixed PK, building status, version 1, bounded sample, attribute_not_exists', () => {
  const p = buildStructuredMarkerPut({ unitKey: 'unresolved-gmail-b@x.com', generation: '01J0AAAA…', targetOrgId: 'acme.com',
    operator: 'op', createdAt: 't', sourceType: 'gmail', sourceEntityId: 'mid', backfillPk: null,
    customerEmail: 'b@x.com', movedCount: 0, affectedEventIdsSample: [] , contactStatus: 'missing_email' });
  expect(p.Put.Item.PK).toBe('CRM_REPAIR#structured#unresolved-gmail-b@x.com#01J0AAAA…');
  expect(p.Put.Item.status).toBe('building');
  expect(p.Put.Item.GSI1PK).toBe('CRM_REPAIR#building');
  expect(p.Put.Item.version).toBe(1);
  expect(p.Put.ConditionExpression).toBe('attribute_not_exists(PK)');
});
it('accumulate: fenced on version, bumps it, caps the sample at 100', async () => {
  await accumulateMarker(markerAt(3), { movedCountDelta: 2, newSampleIds: manyIds(150) }, 'tNow');
  const u = send.mock.calls[0][0].input;
  expect(u.ConditionExpression).toContain('version = :v');
  expect(u.ExpressionAttributeValues[':v']).toBe(3);
  expect(u.ExpressionAttributeValues[':sample'].length).toBeLessThanOrEqual(100);
});
it('seal: building→pending is a fenced transition into the pending partition', async () => {
  await sealMarker(markerAt(4), 'tNow');
  const u = send.mock.calls[0][0].input;
  expect(u.ExpressionAttributeValues[':g']).toBe('CRM_REPAIR#pending');
  expect(u.ExpressionAttributeValues[':st']).toBe('pending');
  expect(u.ConditionExpression).toContain('version = :v');
});
it('every transition (markStuck/bumpAttempt/touchInProgress/delete) is version-fenced; CCFE surfaces as lost=true', async () => {
  send.mockRejectedValueOnce(Object.assign(new Error('ccfe'), { name: 'ConditionalCheckFailedException' }));
  const r = await deleteRepairMarkerFenced(markerAt(2));
  expect(r.lost).toBe(true);
});
it('queryBuildingOlderThan returns aged building markers (bounded Limit)', async () => {
  send.mockResolvedValueOnce({ Items: [{ unitKey: 'u' }] });
  await queryBuildingOlderThan('cutoffIso', 25);
  const q = send.mock.calls[0][0].input;
  expect(q.ExpressionAttributeValues[':pk']).toBe('CRM_REPAIR#building');
  expect(q.Limit).toBe(25);
});
// R5 blocker 3 — blocked markers must be discoverable and recoverable:
it('markStuck records stuckReason and moves the marker into the stuck partition (queryable)', async () => {
  await markStuckV2(markerAt(2), 'org a.com archived without successor', 'tNow');
  const u = send.mock.calls[0][0].input;
  expect(u.ExpressionAttributeValues[':g']).toBe('CRM_REPAIR#stuck');
  expect(u.ExpressionAttributeValues[':reason']).toMatch(/without successor/);
  expect(u.ConditionExpression).toContain('version = :v');
});
it('queryStuckByReason returns only target_unavailable-class stuck markers (bounded Limit)', async () => {
  send.mockResolvedValueOnce({ Items: [{ unitKey: 'u', stuckReasonClass: 'target_unavailable' }] });
  await queryStuckByReason('target_unavailable', 25);
  const q = send.mock.calls[0][0].input;
  expect(q.ExpressionAttributeValues[':pk']).toBe('CRM_REPAIR#stuck');
  expect(q.FilterExpression).toContain('stuckReasonClass = :rc');
  expect(q.Limit).toBe(25);
});
it('republishStuckFenced: stuck→pending is version-fenced; CCFE surfaces as lost=true', async () => {
  await republishStuckFenced(markerAt(3), 'tNow');
  const u = send.mock.calls[0][0].input;
  expect(u.ExpressionAttributeValues[':g']).toBe('CRM_REPAIR#pending');
  expect(u.ConditionExpression).toContain('version = :v');
});
```
(Write `markerAt(version)` / `manyIds(n)` helpers in the test. Analytics markers keep the 3C shape — add one regression test that `putRepairMarker` for analytics is unchanged.)

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement** in `repairMarker.ts` (keep the 3C analytics path intact):
```ts
export interface StructuredMarkerV2 extends Omit<RepairMarkerItem, 'status'> {
  generation: string; version: number;
  status: 'building' | 'pending' | 'stuck';
  stuckReason?: string; stuckReasonClass?: 'target_unavailable' | 'other';   // R5: recovery pass queries by class
  customerEmail: string | null; movedCount: number; affectedEventIdsSample: string[];
}
// Stuck markers live in GSI1PK 'CRM_REPAIR#stuck' (like building/pending partitions) so
// queryStuckByReason can find them; markStuckV2 sets stuckReason + stuckReasonClass;
// republishStuckFenced flips stuck→pending (version-fenced) for normal draining.
export const SAMPLE_CAP = 100;

export function structuredMarkerKey(unitKey: string, generation: string) {
  return { PK: `CRM_REPAIR#structured#${unitKey}#${generation}`, SK: 'STATE' as const };
}

// Built for TransactWriteItems (Task 10): the Put rides the same transaction as the FIRST move.
export function buildStructuredMarkerPut(args: {
  unitKey: string; generation: string; targetOrgId: string; operator: string; createdAt: string;
  sourceType: string; sourceEntityId: string; backfillPk: string | null;
  customerEmail: string | null; movedCount: number; affectedEventIdsSample: string[]; contactStatus: string;
}) {
  return { Put: {
    TableName: TABLE_NAME(),
    Item: {
      ...structuredMarkerKey(args.unitKey, args.generation),
      GSI1PK: 'CRM_REPAIR#building', GSI1SK: `${args.createdAt}#${args.unitKey}`,
      entityType: 'CRM_REPAIR', unitType: 'structured' as const,
      unitKey: args.unitKey, generation: args.generation, version: 1,
      targetOrgId: args.targetOrgId, operator: args.operator, createdAt: args.createdAt,
      status: 'building' as const, stuckReason: null, attemptCount: 0, lastAttemptAt: null, lastError: null,
      sourceType: args.sourceType, sourceEntityId: args.sourceEntityId, backfillPk: args.backfillPk,
      customerEmail: args.customerEmail, movedCount: args.movedCount,
      affectedEventIdsSample: args.affectedEventIdsSample.slice(0, SAMPLE_CAP), contactStatus: args.contactStatus,
    },
    ConditionExpression: 'attribute_not_exists(PK)',   // R8: ULID collision aborts, never overwrites
  }};
}

const fenced = (m: StructuredMarkerV2) => ({ ':v': m.version });

export async function accumulateMarker(m: StructuredMarkerV2, d: { movedCountDelta: number; newSampleIds: string[]; contactStatus?: string }, nowIso: string): Promise<{ lost: boolean }> {
  const sample = [...m.affectedEventIdsSample, ...d.newSampleIds].slice(0, SAMPLE_CAP);
  return fencedUpdate(m, 'SET movedCount = movedCount + :d, affectedEventIdsSample = :sample, version = :nv, lastAttemptAt = :now' + (d.contactStatus ? ', contactStatus = :cs' : ''), {
    ':d': d.movedCountDelta, ':sample': sample, ':now': nowIso, ...(d.contactStatus ? { ':cs': d.contactStatus } : {}),
  });
}
export async function sealMarker(m: StructuredMarkerV2, nowIso: string): Promise<{ lost: boolean }> {
  return fencedUpdate(m, 'SET GSI1PK = :g, #s = :st, version = :nv, lastAttemptAt = :now',
    { ':g': 'CRM_REPAIR#pending', ':st': 'pending', ':now': nowIso }, { '#s': 'status' });
}
export async function deleteRepairMarkerFenced(m: StructuredMarkerV2): Promise<{ lost: boolean }> {
  try {
    await docClient.send(new DeleteCommand({ TableName: TABLE_NAME(), Key: structuredMarkerKey(m.unitKey, m.generation),
      ConditionExpression: 'version = :v', ExpressionAttributeValues: fenced(m) }));
    return { lost: false };
  } catch (err) {
    if ((err as { name?: string }).name === 'ConditionalCheckFailedException') return { lost: true };
    throw err;
  }
}
async function fencedUpdate(m: StructuredMarkerV2, expr: string, values: Record<string, unknown>, names?: Record<string, string>): Promise<{ lost: boolean }> {
  try {
    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME(), Key: structuredMarkerKey(m.unitKey, m.generation),
      UpdateExpression: expr, ConditionExpression: 'attribute_exists(PK) AND version = :v',
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: { ...values, ...fenced(m), ':nv': m.version + 1 },
    }));
    m.version += 1;                        // keep the in-memory handle fenceable for the next call
    return { lost: false };
  } catch (err) {
    if ((err as { name?: string }).name === 'ConditionalCheckFailedException') return { lost: true };
    throw err;
  }
}
export async function queryBuildingOlderThan(cutoffIso: string, limit: number, startKey?: Record<string, unknown>): Promise<{ markers: StructuredMarkerV2[]; lastKey?: Record<string, unknown> }> {
  const res = await docClient.send(new QueryCommand({
    TableName: TABLE_NAME(), IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk AND GSI1SK < :cut',
    ExpressionAttributeValues: { ':pk': 'CRM_REPAIR#building', ':cut': `${cutoffIso}#￿` },
    ScanIndexForward: true, Limit: limit, ExclusiveStartKey: startKey,
  }));
  return { markers: (res.Items ?? []) as StructuredMarkerV2[], lastKey: res.LastEvaluatedKey as Record<string, unknown> | undefined };
}

// plan-review fix: promotion has its OWN condition — must still be building, same version, AND
// past the age cutoff (a fresh foreground seal/accumulate must never be clobbered by the ager).
export async function promoteAbandonedBuilding(m: StructuredMarkerV2, cutoffIso: string, nowIso: string): Promise<{ lost: boolean }> {
  try {
    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME(), Key: structuredMarkerKey(m.unitKey, m.generation),
      UpdateExpression: 'SET GSI1PK = :g, #s = :pending, version = :nv, lastAttemptAt = :now',
      ConditionExpression: 'attribute_exists(PK) AND #s = :building AND version = :v AND createdAt < :cut',
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues: { ':g': 'CRM_REPAIR#pending', ':pending': 'pending', ':building': 'building', ':v': m.version, ':nv': m.version + 1, ':now': nowIso, ':cut': cutoffIso },
    }));
    return { lost: false };
  } catch (err) {
    if ((err as { name?: string }).name === 'ConditionalCheckFailedException') return { lost: true };
    throw err;
  }
}
```
Rework `markStuck`/`bumpAttempt`/`touchInProgress` to route through `fencedUpdate` (they gain the version fence; keep their field semantics from 3C). `queryPendingMarkers` unchanged (drainer still Queries `#pending` only).

- [ ] **Step 4: Run** the full repair test dir + tsc — PASS/clean.

- [ ] **Step 5: Commit**
```bash
git add amplify/functions/crm-api/lib/repair/repairMarker.ts amplify/functions/crm-api/lib/repair/repairMarker.test.ts
git commit -m "feat(comms-p1): marker v2 — ULID generations, building→pending, version fencing, bounded sample"
```

---

### Task 10: `linkStructuredUnit` v2 — representativeEventId, eligibility, first-move transaction

**Files:**
- Modify: `amplify/functions/crm-api/lib/link/linkStructuredUnit.ts`, `amplify/functions/crm-api/lib/link/manualMoveTimelineEvent.ts`
- Test: `amplify/functions/crm-api/lib/link/linkStructuredUnit.test.ts` (rework)

- [ ] **Step 1: Failing tests.** Rework the test file for the v2 contract (reuse its mock scaffolding; mock `../repair/repairMarker` v2 fns + `TransactWriteCommand` capture):
```ts
it('derives the unit from a strongly-read representative and rejects invalid ones', async () => {
  for (const bad of [
    { resolutionStatus: 'resolved' }, { voided: true }, { isInternalOnly: true },
    { orgId: 'acme.com' }, { source: 'manual' }, null,
  ]) {
    mockRepresentativeGet(bad && { ...validRep, ...bad });
    await expect(linkStructuredUnit({ representativeEventId: 'tev-1', targetOrgId: 'acme.com', operator: 'op' }))
      .rejects.toThrow(/invalid representative/i);
  }
  const getInput = send.mock.calls[0][0].input;
  expect(getInput.ConsistentRead).toBe(true);
});
it('first move + marker ride ONE TransactWriteItems; marker Put has attribute_not_exists', async () => {
  arrangeUnitWithEvents([ev1, ev2]);
  await linkStructuredUnit({ representativeEventId: ev1.id, targetOrgId: 'acme.com', operator: 'op' });
  const tx = transactCalls()[0].input.TransactItems;
  expect(tx).toHaveLength(2);
  expect(tx[0].Put.ConditionExpression).toContain('resolutionStatus = :unres');
  expect(tx[0].Put.ConditionExpression).toContain('voided = :false');
  expect(tx[0].Put.ConditionExpression).toContain('#source = :src');
  expect(tx[1].Put.ConditionExpression).toBe('attribute_not_exists(PK)');
});
it('loser: transaction cancelled on the move condition → alreadyLinked-style return, NO marker, no further moves', async () => {
  arrangeUnitWithEvents([ev1]);
  rejectTransactWithCancellation(['ConditionalCheckFailed', 'None']);
  const out = await linkStructuredUnit({ representativeEventId: ev1.id, targetOrgId: 'acme.com', operator: 'op' });
  expect(out.moved).toBe(0);
  expect(sealMarker).not.toHaveBeenCalled();
});
it('ineligible siblings are skipped, never moved (per-event eligibility)', async () => {
  arrangeUnitWithEvents([ev1, { ...ev2, voided: true }, { ...ev3, source: 'manual' }]);
  const out = await linkStructuredUnit({ representativeEventId: ev1.id, targetOrgId: 'acme.com', operator: 'op' });
  expect(out.moved).toBe(1);
  expect(out.skipped).toBeGreaterThanOrEqual(2);
});
it('replay ok → fenced delete; replay not-ok → seal building→pending (exactly one of the two)', async () => {
  arrangeUnitWithEvents([ev1]);
  replayStructuredSideEffects.mockResolvedValueOnce({ ok: false, errorType: 'transient' });
  const out = await linkStructuredUnit({ representativeEventId: ev1.id, targetOrgId: 'acme.com', operator: 'op' });
  expect(sealMarker).toHaveBeenCalled();
  expect(deleteRepairMarkerFenced).not.toHaveBeenCalled();
  expect(out.postCommitStatus).toBe('post_commit_failed');
});
it('audit + contact + backfill all receive THIS generation', async () => {
  arrangeUnitWithEvents([ev1]);
  await linkStructuredUnit({ representativeEventId: ev1.id, targetOrgId: 'acme.com', operator: 'op' });
  expect(replayStructuredSideEffects).toHaveBeenCalledWith(expect.objectContaining({ generation: expect.stringMatching(/^[0-9A-HJKMNP-TV-Z]{26}$/) }));
});
```
(Write `arrangeUnitWithEvents`/`mockRepresentativeGet`/`transactCalls`/`rejectTransactWithCancellation` helpers against the file's existing docClient mock. `validRep` = an unresolved gmail event fixture with `payload.customerEmail`.)

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement.** Rewrite `linkStructuredUnit` around this flow (keeping `manualMoveTimelineEvent` for non-first moves, with its ConditionExpression extended to `resolutionStatus = :unres AND orgId = :syn AND voided = :false AND isInternalOnly = :false AND #source = :src`):
```ts
export async function linkStructuredUnit(args: { representativeEventId: string; targetOrgId: string; operator: string }): Promise<Record<string, unknown>> {
  if (!(await orgExists(args.targetOrgId))) throw new Error(`invalid target org: ${args.targetOrgId}`);

  // R5/R6: server-derived unit from a strongly-read, FULLY-validated representative
  const rep = (await docClient.send(new GetCommand({
    TableName: TABLE_NAME(), Key: { PK: `TLEVENT#${args.representativeEventId}`, SK: 'A' }, ConsistentRead: true,
  }))).Item as TimelineEventItem | undefined;
  const ALLOWED = new Set(['rfq', 'lead', 'order', 'quote', 'logistics', 'gmail']);
  if (!rep || rep.resolutionStatus !== 'unresolved' || rep.voided || rep.isInternalOnly
      || !rep.orgId.startsWith('unresolved-') || !ALLOWED.has(rep.source)) {
    throw new Error('invalid representative event');
  }
  const unitKey = rep.orgId, sourceType = rep.source, sourceEntityId = rep.sourceEntityId;
  const generation = generateUlid();
  const nowIso = new Date().toISOString();
  const customerEmail = sourceType === 'gmail'
    ? ((rep.payload?.customerEmail as string | undefined) ?? null) : null;

  // paginated, eligibility-filtered unit read (as 3B, plus the R7 filters)
  const events = await queryUnitEvents(unitKey);         // FilterExpression: resolutionStatus=:unres AND voided=:false AND isInternalOnly=:false
  if (events.length === 0) return { alreadyLinked: true, affected: 0, moved: 0, skipped: 0, errors: 0 };

  let backfillPk: string | null = null;
  try { backfillPk = await backfillTargetPk(sourceType, sourceEntityId, events); } catch { /* drainer re-resolves */ }
  let sourceEmail: string | null = customerEmail; let enrichmentError = false;
  if (!sourceEmail) { try { sourceEmail = await readSourceEmailForUnit(sourceType, sourceEntityId, events); } catch { enrichmentError = true; } }

  // R6/R8: FIRST eligible move + building-marker in ONE transaction (loser aborts → no marker)
  const [first, ...rest] = events;
  const firstMove = buildMoveTransactPut(first, args.targetOrgId, sourceEmail, args.operator, nowIso, enrichmentError, sourceType);
  const marker = buildStructuredMarkerPut({ unitKey, generation, targetOrgId: args.targetOrgId, operator: args.operator,
    createdAt: nowIso, sourceType, sourceEntityId, backfillPk, customerEmail: sourceEmail,
    movedCount: 1, affectedEventIdsSample: [first.id], contactStatus: enrichmentError ? 'enrichment_error' : 'missing_email' });
  let moved = 0, skipped = 0, errors = 0; let markerHandle: StructuredMarkerV2 | null = null;
  try {
    await docClient.send(new TransactWriteCommand({ TransactItems: [firstMove, marker] }));
    moved = 1; markerHandle = marker.Put.Item as StructuredMarkerV2;
    await postMoveEffects(first, args.targetOrgId);       // rollup/markRollupApplied — best-effort, as 3B
  } catch (err) {
    if (isConditionalCancellation(err)) { skipped = 1; }  // Task-10 helper: map CancellationReasons
    else throw err;
  }
  if (!markerHandle) return { affected: events.length, moved: 0, skipped, errors };

  for (const ev of rest) {                                // remaining moves: per-event conditional, fenced accumulate
    try {
      const r = await manualMoveTimelineEvent({ event: ev, targetOrgId: args.targetOrgId, email: sourceEmail, operator: args.operator, nowIso, enrichmentError, representativeSource: sourceType });
      if (r.moved) {
        moved += 1;
        const acc = await accumulateMarker(markerHandle, { movedCountDelta: 1, newSampleIds: [ev.id], contactStatus: r.contactStatus }, nowIso);
        if (acc.lost) {
          // plan-review fix: version fence lost = another actor (aged→drained) owns the marker.
          // ABORT immediately: stop moving; unmoved events stay unresolved and re-surface (convergent).
          return { affected: events.length, moved, skipped, errors, sourceBackfillStatus: 'not_attempted', contactStatus: markerHandle.contactStatus, postCommitStatus: 'post_commit_failed' };
        }
      }
      else if (r.skipped) skipped += 1;
    } catch { errors += 1; }
  }

  let postCommitStatus: 'ok' | 'post_commit_failed' = 'ok';
  const replay = await replayStructuredSideEffects({ sourceType, sourceEntityId, backfillPk, targetOrgId: args.targetOrgId,
    unitKey, operator: args.operator, createdAt: nowIso, generation, customerEmail: sourceEmail,
    movedCount: moved, affectedEventIdsSample: markerHandle.affectedEventIdsSample, contactStatus: markerHandle.contactStatus });
  if (replay.ok) {
    const del = await deleteRepairMarkerFenced(markerHandle);
    if (del.lost) postCommitStatus = 'post_commit_failed';       // another actor owns it now — fine
  } else {
    postCommitStatus = 'post_commit_failed';
    const seal = await sealMarker(markerHandle, nowIso);          // building → pending: publish to the drainer
    if (seal.lost) { /* aged/raced — the other actor published or handled it */ }
  }
  return { affected: events.length, moved, skipped, errors, sourceBackfillStatus: replay.backfillStatus ?? 'not_attempted', contactStatus: markerHandle.contactStatus, postCommitStatus };
}
```
Include the two small helpers in the same file: `buildMoveTransactPut` (the movedItem exactly as `manualMoveTimelineEvent` constructs it, wrapped as a `Put` with the R7 eligibility condition — extract the shared item-construction into an exported `buildMovedItem(event, targetOrgId, email, nowIso, linkGeneration)` in `manualMoveTimelineEvent.ts` so the two paths cannot drift) and `isConditionalCancellation` (inspects `err.name === 'TransactionCanceledException'` and `err.CancellationReasons?.some(r => r.Code === 'ConditionalCheckFailed')` — the R7-deferred cancellation mapping).
**Queryable unit membership (R5 blocker 2):** `buildMovedItem` stamps every moved event with **`linkGeneration: <this action's generation>`** — the attribute Task 8's redirect-move pass queries by when a later merge strands the unit's events under an archived org. Both move paths (transact first-move AND `manualMoveTimelineEvent`) carry it — that is exactly why the item construction is extracted into one function. Add a test asserting the moved item (both paths) contains `linkGeneration` matching the action's generation.

- [ ] **Step 4 (plan-review R2 fix — SECURE TRANSITIONAL ADAPTER, every commit deployable).** `handler.ts` calls `linkStructuredUnit` with the old args and would break this checkpoint; and the GraphQL schema keeps the LEGACY argument shape until Task 13 — so the handler must serve BOTH shapes in the window, or any deploy of an intermediate commit breaks the live admin UI. Add to `handler.ts`:
```ts
  // TRANSITIONAL (removed in Task 13): serve the deployed legacy arg shape by deriving the
  // representative SERVER-SIDE. The derived event still passes linkStructuredUnit's full
  // validation (strong read, unresolved, eligibility, ALLOWED source), so this is no weaker
  // than the deployed 3B contract it temporarily preserves — and it is admin-gated (Task 6).
  async function deriveRepresentativeEventId(sourceType: string, sourceEntityId: string): Promise<string> {
    const ALLOWED = new Set(['rfq', 'lead', 'order', 'quote', 'logistics']);   // legacy shapes only — gmail NEVER via legacy args
    if (!ALLOWED.has(sourceType) || !sourceEntityId) throw new Error('invalid legacy link args');
    const events = await queryUnitEvents(`unresolved-${sourceType}-${sourceEntityId}`);
    if (events.length === 0) throw new Error('no unresolved events for legacy link args');
    return events[0].id;
  }

  linkStructuredUnit: async (e) => {
    requireAdmin(e);
    const a = (e.arguments ?? {}) as { representativeEventId?: string; sourceType?: string; sourceEntityId?: string; targetOrgId?: string };
    const representativeEventId = a.representativeEventId
      ?? await deriveRepresentativeEventId(a.sourceType ?? '', a.sourceEntityId ?? '');
    return linkStructuredUnit({ representativeEventId, targetOrgId: a.targetOrgId ?? '', operator: operatorOf(e) });
  },
```
(`queryUnitEvents` is exported from `linkStructuredUnit.ts` — confirm the actual unresolved unit-key format against the 3B queue code (`git grep -n "unresolved-" amplify/functions/crm-api/lib/` ) and use THAT format; do not guess.) Handler tests: (a) new-shape args dispatch directly; (b) legacy-shape args derive then dispatch; (c) legacy shape with `sourceType: 'gmail'` throws (gmail units exist only after this plan, so no legacy caller can name them).

- [ ] **Step 5: Run** the reworked file suite + `manualMoveTimelineEvent.test.ts` (its condition gains the eligibility clauses — update its assertions) + `handler.test.ts` + tsc — PASS/clean.

- [ ] **Step 6: Commit**
```bash
git add amplify/functions/crm-api/lib/link/linkStructuredUnit.ts amplify/functions/crm-api/lib/link/linkStructuredUnit.test.ts amplify/functions/crm-api/lib/link/manualMoveTimelineEvent.ts amplify/functions/crm-api/lib/link/manualMoveTimelineEvent.test.ts amplify/functions/crm-api/handler.ts amplify/functions/crm-api/handler.test.ts
git commit -m "feat(comms-p1): linkStructuredUnit v2 — representative-derived unit, eligibility, transaction (+handler migration)"
```

---

### Task 11: Queue exposes `representativeEventId`; enrichment reads `payload.customerEmail`

**Files:**
- Modify: `amplify/functions/crm-api/lib/read/needsLinkingQueue.ts`, `amplify/functions/crm-api/lib/link/sourceEmail.ts`
- Test: both existing test files (append)

- [ ] **Step 1: Failing tests.** `needsLinkingQueue.test.ts`: assert each returned item now includes `representativeEventId` equal to the representative event's `id`, and that a gmail unit's `signal.email` is the `payload.customerEmail`. `sourceEmail.test.ts`: `readSourceEmailForUnit('gmail', 'mid', [gmailEventWithPayloadCustomerEmail])` returns the payload value; returns null when absent.

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement.** `needsLinkingQueue.ts`: add `representativeEventId: rep.id` to the item construction. `sourceEmail.ts` `readSourceEmailForUnit` head:
```ts
  if (sourceType === 'gmail') {
    const p = (events[0]?.payload ?? {}) as Record<string, unknown>;
    return (p.customerEmail as string | undefined) ?? null;      // durable field, stamped at emit — no re-derivation
  }
```

- [ ] **Step 4: Run** both + tsc — PASS/clean.

- [ ] **Step 5: Commit**
```bash
git add amplify/functions/crm-api/lib/read/needsLinkingQueue.ts amplify/functions/crm-api/lib/read/needsLinkingQueue.test.ts amplify/functions/crm-api/lib/link/sourceEmail.ts amplify/functions/crm-api/lib/link/sourceEmail.test.ts
git commit -m "feat(comms-p1): queue representativeEventId + gmail customerEmail enrichment"
```

---

### Task 12: Drainer v2 — generations, building-aging, superseded/locked, contact retry

**Files:**
- Modify: `amplify/functions/crm-api/lib/repair/reconcileRepair.ts`
- Test: `amplify/functions/crm-api/lib/repair/reconcileRepair.test.ts` (extend)

- [ ] **Step 1: Failing tests (append):**
```ts
it('ages building markers older than 2× link timeout via promoteAbandonedBuilding, paginating until exhausted', async () => {
  queryBuildingOlderThan
    .mockResolvedValueOnce({ markers: [buildingA], lastKey: { k: 1 } })
    .mockResolvedValueOnce({ markers: [buildingB], lastKey: undefined });
  await reconcileRepair({});
  expect(promoteAbandonedBuilding).toHaveBeenCalledTimes(2);
  expect(promoteAbandonedBuilding).toHaveBeenCalledWith(buildingA, expect.any(String), expect.any(String));
});
it('a lost promotion (fresh foreground activity) is skipped silently, not an error', async () => {
  queryBuildingOlderThan.mockResolvedValueOnce({ markers: [buildingA], lastKey: undefined });
  promoteAbandonedBuilding.mockResolvedValueOnce({ lost: true });
  const out = await reconcileRepair({});
  expect(out.aged).toBe(0);
});
it('drains BOTH generations of the same unit independently (older-after-newer: superseded = repaired)', async () => {
  queryPendingMarkers.mockResolvedValueOnce({ markers: [genB, genA], hasMore: false });  // newer first
  replayStructured.mockResolvedValueOnce({ ok: true, backfillStatus: 'written' })        // B
                  .mockResolvedValueOnce({ ok: true, backfillStatus: 'superseded' });    // A — success no-op
  const out = await reconcileRepair({});
  expect(out.repaired).toBe(2);
  expect(markStuck).not.toHaveBeenCalled();
});
it('a fenced-transition CCFE (lost) is counted, not retried blindly', async () => {
  queryPendingMarkers.mockResolvedValueOnce({ markers: [genA], hasMore: false });
  replayStructured.mockResolvedValueOnce({ ok: true });
  deleteRepairMarkerFenced.mockResolvedValueOnce({ lost: true });
  const out = await reconcileRepair({});
  expect(out.raced).toBe(1);
});
it('contact retry: marker with contactStatus!=="linked" and customerEmail → replay receives them', async () => {
  queryPendingMarkers.mockResolvedValueOnce({ markers: [{ ...genA, contactStatus: 'missing_email', customerEmail: 'b@x.com' }], hasMore: false });
  replayStructured.mockResolvedValueOnce({ ok: true });
  await reconcileRepair({});
  expect(replayStructured).toHaveBeenCalledWith(expect.objectContaining({ customerEmail: 'b@x.com', contactStatus: 'missing_email' }));
});
```

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement** in `reconcileRepair.ts`: before draining, run the aging pass — loop `queryBuildingOlderThan(cutoffIso, 25, lastKey)` pages until `lastKey` is undefined (cutoff = `new Date(Date.now() - 2 * LINK_LAMBDA_TIMEOUT_MS).toISOString()`, `LINK_LAMBDA_TIMEOUT_MS = 120_000` with a keep-in-sync comment), calling `promoteAbandonedBuilding(m, cutoffIso, nowIso)` per marker; `{lost:true}` = fresh foreground activity → skip silently. Extend `replayFor` to pass `generation`, `customerEmail`, `contactStatus`, `affectedEventIdsSample`. **`target_unavailable` outcome mapping (spec R10 final):** it is NOT ok and NOT transient — the drainer calls `markStuckV2(marker, reason, now)` with `stuckReasonClass: 'target_unavailable'` (blocked/actionable; surfaces in CRM Health), never deletes it, and does not burn retries on it.
**Recovery pass (R5 blocker 3 — `markStuck` removes the marker from the pending query, so a fixed org chain must be actively re-checked):** each drain cycle ALSO runs `queryStuckByReason('target_unavailable', 25)`; for each hit, call `resolveEffectiveTarget(marker.targetOrgId)` — if it now resolves `active`, `republishStuckFenced` (stuck→pending; `{lost:true}` ⇒ skip) so the NEXT drain repairs it normally; if still unavailable, leave it (no retry burn). Bounded (25/cycle), so a mass-blocked backlog recovers incrementally without starving the pending drain. Summary gains `recovered`.
Tests: (a) replay returning `{ok:false, errorType:'target_unavailable', reason}` ⇒ `markStuckV2` called with the reason + class, marker retained; (b) recovery pass: a stuck marker whose chain NOW resolves ⇒ `republishStuckFenced` called, summary.recovered=1, and a subsequent drain cycle repairs + deletes it; (c) a stuck marker whose chain still fails ⇒ untouched, zero replay attempts; (d) `transient` from the resolver (org-read throw) during recovery ⇒ marker left stuck, retried next cycle (not misclassified). Transition calls switch to the fenced v2 fns; a `{lost:true}` on a drain transition increments a new `raced` counter (not `errors`). `superseded`/`locked` replay outcomes are OK-path (delete). Summary gains `aged` + `raced`.

- [ ] **Step 4: Run** the repair dir + tsc — PASS/clean.

- [ ] **Step 5: Commit**
```bash
git add amplify/functions/crm-api/lib/repair/reconcileRepair.ts amplify/functions/crm-api/lib/repair/reconcileRepair.test.ts
git commit -m "feat(comms-p1): drainer v2 — generation draining, building-aging, superseded/locked, contact retry"
```

---

### Task 13: GraphQL + UI contract migration (`representativeEventId`)

**Files:**
- Modify: `amplify/data/resource.ts`, `amplify/functions/crm-api/handler.ts`, `src/services/organizationAdminService.ts`, `src/pages/admin/NeedsLinkingPage.tsx`, `src/components/admin/needslinking/UnitList.tsx` + `UnitDetail.tsx` (as needed), `src/hooks/useNeedsLinkingQueue.ts` (types flow through)
- Test: `src/pages/admin/NeedsLinkingPage.test.tsx` (update), handler test (update)

- [ ] **Step 1: Failing tests.** Handler: `linkStructuredUnit` resolver forwards `{ representativeEventId, targetOrgId, operator }` and legacy-shape args (sourceType/sourceEntityId, no representativeEventId) now **throw** — the Task-10 transitional adapter is deleted here. Frontend: the page's link action calls the service with the unit's `representativeEventId`.

- [ ] **Step 2: Implement.** `data/resource.ts`: `NeedsLinkingItem` gains `representativeEventId: a.string().required()`; `linkStructuredUnit` mutation arguments become `{ representativeEventId: a.string().required(), targetOrgId: a.string().required() }`. Handler: **delete `deriveRepresentativeEventId` and the legacy branch** (schema + UI now speak the new shape, so the transitional window closes in the same commit). Service `linkStructuredUnit(args: { representativeEventId: string; targetOrgId: string })`. Page/`handleLink` passes `unit.representativeEventId` for structured units (analytics path unchanged). Update the page/unit-list tests' fixtures and delete the adapter's handler tests (replaced by the throw test).

- [ ] **Step 3: Run** handler + frontend needslinking tests + `npx tsc --noEmit` (both) + eslint on changed files — PASS/clean.

- [ ] **Step 4: Commit**
```bash
git add amplify/data/resource.ts amplify/functions/crm-api/handler.ts amplify/functions/crm-api/handler.test.ts src/services/organizationAdminService.ts src/pages/admin/NeedsLinkingPage.tsx src/pages/admin/NeedsLinkingPage.test.tsx src/components/admin/needslinking src/hooks/useNeedsLinkingQueue.ts
git commit -m "feat(comms-p1): representativeEventId link contract across schema/handler/service/UI"
```

---

### Task 14: Adversarial suite (executable) — concurrency / crash / cross-writer

**Files:**
- Create: `amplify/functions/crm-api/lib/link/linkStructuredUnit.adversarial.test.ts`

- [ ] **Step 1: Build the harness** — `amplify/functions/crm-api/lib/link/linkTestHarness.ts` (~200 lines, reusable; Part 2's chain test imports it). Requirements (plan-review R3 — real functions, real state, deterministic overlap; NO sequential mocks pretending to be concurrency):
  - An in-memory item map whose `docClient.send` mock **APPLIES** Get/Put/Update/Delete/TransactWrite semantics, **evaluating the ConditionExpressions this plan actually uses** (attribute_not_exists / attribute_exists / equality / `< :gen` / begins_with / AND-chains) against current store state; a failed condition throws `ConditionalCheckFailedException` (TransactWrite: `TransactionCanceledException` with per-item `CancellationReasons`). Assertions read RESULTING STATE.
  - **Deterministic interleaving gates:** `store.gateOn(predicate)` returns `{ released, release() }`; the FIRST `send` whose command matches `predicate` suspends (its promise unresolved) until `release()` is called. This lets a test park writer A at a precise operation, run writer B to completion through the REAL store, then release A — true overlap with a deterministic schedule, no timing races.
  - All scenarios below call the REAL `linkStructuredUnit` / `replayStructuredSideEffects` / `upsertContact` / `reconcileRepair` (and the Task-8b guarded writer helper) with only `docClient.send` (and rollup pass-through) mocked; `orgExists`/org reads resolve from the harness's seeded org items.

- [ ] **Step 2: Write the suite** — every scenario complete (no placeholder bodies):
```ts
// Scenario 1 — stateful transaction atomicity: after a cancelled transaction the STORE holds
// neither the moved event nor the marker.
it('cancelled transaction leaves the store untouched', async () => {
  const store = seedStore([unresolvedEvent('tev-1')]);
  store.put(`TLEVENT#tev-1`, { ...store.get('TLEVENT#tev-1'), resolutionStatus: 'resolved', orgId: 'other.com' }); // pre-occupied → move condition fails
  const out = await linkStructuredUnit({ representativeEventId: 'tev-1', targetOrgId: 'acme.com', operator: 'op' })
    .catch((e) => e);                                    // representative validation may reject — either path must leave the store clean
  expect(store.keys().filter((k) => k.startsWith('CRM_REPAIR#'))).toHaveLength(0);
  expect(store.get('TLEVENT#tev-1').orgId).toBe('other.com');
});
// Scenario 2 — marker self-sufficiency: from the instant the transaction commits, the marker in the
// STORE carries every replay input (crash-at-any-later-point recoverable).
it('the committed marker is self-sufficient for replay', async () => {
  const store = seedStore([unresolvedEvent('tev-1')]);
  await linkStructuredUnit({ representativeEventId: 'tev-1', targetOrgId: 'acme.com', operator: 'op' });
  const marker = store.markersFor('unresolved-rfq-r1')[0];
  for (const f of ['targetOrgId', 'unitKey', 'generation', 'sourceType', 'sourceEntityId', 'customerEmail', 'backfillPk']) {
    expect(marker).toHaveProperty(f);
  }
});
// Scenario 3 — TRUE overlapping same-unit links via a deterministic gate: A parks at its
// TransactWrite, B runs to completion, A resumes and loses on the move condition.
it('overlapped links: the parked writer loses against the committed store, mints no marker', async () => {
  const store = seedStore([unresolvedEvent('tev-1')]);
  const gate = store.gateOn((cmd) => cmd.constructor.name === 'TransactWriteCommand');   // catches A's transact only (first match)
  const pA = linkStructuredUnit({ representativeEventId: 'tev-1', targetOrgId: 'a.com', operator: 'opA' });
  await store.idle();                                     // A is now parked at the gate
  const b = await linkStructuredUnit({ representativeEventId: 'tev-1', targetOrgId: 'b.com', operator: 'opB' });  // B runs through the REAL store
  gate.release();
  const a = await pA;
  expect(b.moved).toBe(1);
  expect(a.moved).toBe(0);                                // A's conditions evaluated against B's committed state
  expect(store.get('TLEVENT#tev-1').orgId).toBe('b.com');
  expect(store.markersFor('unresolved-rfq-r1').filter((m) => m.operator === 'opA')).toHaveLength(0);  // loser minted nothing
});
// Scenario 4 — overlapping link + drainer promotion: linker parks before SEAL; drainer promotes the
// aged building marker; released seal loses the version fence; exactly one pending marker.
it('seal vs promoteAbandonedBuilding: one version-fenced winner, no duplicate pending markers', async () => {
  const store = seedStore([unresolvedEvent('tev-1')]);
  const gate = store.gateOn((cmd, input) => String(input.UpdateExpression ?? '').includes(':st'));   // parks the seal transition
  const pLink = linkStructuredUnit({ representativeEventId: 'tev-1', targetOrgId: 'acme.com', operator: 'op' });
  await store.idle();
  const marker = store.markersFor('unresolved-rfq-r1')[0];
  await promoteAbandonedBuilding(marker, PAST_CUTOFF, NOW_ISO);   // drainer claims it: version+1, building→pending
  gate.release();
  const out = await pLink;
  expect(store.markersFor('unresolved-rfq-r1').filter((m) => m.status === 'pending')).toHaveLength(1);
  expect(out.postCommitStatus).toBe('post_commit_failed');        // seal lost ⇒ surfaced, not silent
});
// Scenario 5 — >100-event unit: movedCount exact, sample capped, replay completes from the marker.
it('130-event unit: full move, bounded sample, marker-driven replay converges', async () => {
  const events = Array.from({ length: 130 }, (_, i) => unresolvedEvent(`tev-${i}`));
  const store = seedStore(events);
  const out = await linkStructuredUnit({ representativeEventId: 'tev-0', targetOrgId: 'acme.com', operator: 'op' });
  expect(out.moved).toBe(130);
  const m = store.markersHistoryFor('unresolved-rfq-r1')[0];      // harness records deleted markers too
  expect(m.movedCount).toBe(130);
  expect(m.affectedEventIdsSample.length).toBeLessThanOrEqual(100);
});
// Scenario 6 — MERGE-BEFORE-REPLAY with successor: the unapplied action's target was merged away;
// the replay follows mergedInto and completes Contact + source AT THE SUCCESSOR.
it('replay after merge applies to the canonical successor; events + rollups converge too', async () => {
  const store = seedStore([rfqRecord('RFQ#1', { matchedOrgId: '' }),
    orgItem('a.com', { status: 'archived', mergedInto: 'b.com' }), orgItem('b.com', { status: 'active' }),
    movedEvent('tev-1', { orgId: 'a.com', linkGeneration: GEN_1 }),   // the foreground link had moved these to (now-archived) A
    movedEvent('tev-2', { orgId: 'a.com', linkGeneration: GEN_1 }),
    movedEvent('tev-x', { orgId: 'a.com', linkGeneration: GEN_2 })]); // ANOTHER unit's event — must NOT move
  const r = await replayStructuredSideEffects({ ...rfqBase, targetOrgId: 'a.com', generation: GEN_1, customerEmail: 'b@x.com', backfillPk: 'RFQ#1' });
  expect(r.ok).toBe(true);
  expect(store.get('RFQ#1').matchedOrgId).toBe('b.com');           // source completed at the successor
  expect(store.contactByEmail('b@x.com').orgId).toBe('b.com');     // Contact completed at the successor
  expect(store.get('TLEVENT#tev-1').orgId).toBe('b.com');          // R5: the unit's EVENTS follow the redirect
  expect(store.get('TLEVENT#tev-2').orgId).toBe('b.com');
  expect(store.get('TLEVENT#tev-x').orgId).toBe('a.com');          // foreign-generation event untouched
  expect(store.dirtyRollups()).toEqual(expect.arrayContaining(['a.com', 'b.com']));
  expect(store.auditFor(GEN_1).details).toMatchObject({ requestedTargetOrgId: 'a.com', effectiveTargetOrgId: 'b.com' });
});
// Scenario 7 — MULTI-HOP chain a→b→c resolves to the final active org.
it('multi-hop merge chain resolves through archived intermediates', async () => {
  const store = seedStore([rfqRecord('RFQ#1', { matchedOrgId: '' }),
    orgItem('a.com', { status: 'archived', mergedInto: 'b.com' }),
    orgItem('b.com', { status: 'archived', mergedInto: 'c.com' }), orgItem('c.com', { status: 'active' })]);
  const r = await replayStructuredSideEffects({ ...rfqBase, targetOrgId: 'a.com', generation: GEN_1, backfillPk: 'RFQ#1' });
  expect(r.ok).toBe(true);
  expect(store.get('RFQ#1').matchedOrgId).toBe('c.com');
});
// Scenario 8 — MISSING SUCCESSOR: archived, no mergedInto → blocked, marker retained, no writes.
it('archived target without successor blocks the repair instead of faking success', async () => {
  const store = seedStore([rfqRecord('RFQ#1', { matchedOrgId: '' }), orgItem('a.com', { status: 'archived' })]);
  const marker = putPendingMarker(store, { unitKey: 'unresolved-rfq-r1', generation: GEN_1, targetOrgId: 'a.com' });
  await reconcileRepair();                                          // REAL drainer over the store
  expect(store.get(marker.PK).status).toBe('stuck');                // blocked/actionable, NOT deleted
  expect(store.get(marker.PK).stuckReason).toMatch(/without successor/);
  expect(store.get('RFQ#1').matchedOrgId).toBe('');                 // no half-applied writes
});
// Scenario 9 — RFQ/order legacy regression: NO-generation replay writes the EXACT pre-plan shape.
it('legacy (no-generation) replay is byte-identical to 3C and converges', async () => {
  const store = seedStore([rfqRecord('RFQ#1', { matchedOrgId: '' })]);
  const r = await replayStructuredSideEffects({ ...rfqBase, targetOrgId: 'acme.com', backfillPk: 'RFQ#1' });  // no generation ⇒ legacy path
  expect(r.ok).toBe(true);
  const written = store.lastCommandFor('RFQ#1');
  expect(written.input.UpdateExpression).toBe('SET matchedOrgId = :o');           // NO stamp field — the verbatim 3C write
  expect(written.input.ExpressionAttributeValues).not.toHaveProperty(':gen');
  expect(store.get('RFQ#1').matchedOrgId).toBe('acme.com');
  expect(store.get('RFQ#1')).not.toHaveProperty('matchedOrgLinkGeneration');
});
// Scenario 10 — cross-writer interleaving: non-generational upsertContact lands BETWEEN two
// generational writes; the newest org+stamp pair survives.
it('interleaved non-generational contact write preserves the newest generation+org pair', async () => {
  const store = seedStore([]);
  await upsertContact({ email: 'b@x.com', orgId: 'a.com', source: 'rfq', occurredAt: T1, linkGeneration: GEN_1 });
  const gate = store.gateOn((cmd) => cmd.constructor.name === 'PutCommand');      // parks the non-generational Put
  const pNonGen = upsertContact({ email: 'b@x.com', orgId: 'ignored.com', source: 'order', occurredAt: T2 });  // reads GEN_1, parks
  await store.idle();
  await upsertContact({ email: 'b@x.com', orgId: 'b.com', source: 'rfq', occurredAt: T3, linkGeneration: GEN_2 }); // newer generational write lands
  gate.release();
  await pNonGen;                                                                   // CASes on stale GEN_1 → CCFE → re-read → retry on fresh state
  const c = store.contactByEmail('b@x.com');
  expect(c.orgId).toBe('b.com');                                                   // newest org survives
  expect(c.lastLinkGeneration).toBe(GEN_2);                                        // newest stamp survives
});
// Scenario 11 — DELAYED SOURCE WRITER (Task 8b, store-level): a late creation-path matchedOrgId
// write cannot overwrite a stamped admin decision (incl. the NULL-typed org case).
it('delayed writer update against a stamped record is a guarded no-op', async () => {
  const store = seedStore([rfqRecord('RFQ#1', { matchedOrgId: 'a.com', matchedOrgLinkGeneration: GEN_1 })]);
  await runDelayedWriterUpdate(store, { pk: 'RFQ#1', resolvedOrgId: 'late.com' });   // the REAL guarded writer helper from Task 8b
  expect(store.get('RFQ#1').matchedOrgId).toBe('a.com');           // admin decision stands
  expect(store.get('RFQ#1').matchedOrgLinkGeneration).toBe(GEN_1);
});
// Scenario 12 — RESOLVE-vs-ARCHIVE interleaving (R5 blocker 1): replay resolves A as active,
// parks before its transact; merge archives A and re-points; released replay's fence cancels,
// re-resolve applies everything to B.
it('org archived between resolve and write: the fence cancels and the retry lands on the successor', async () => {
  const store = seedStore([rfqRecord('RFQ#1', { matchedOrgId: '' }), orgItem('a.com', { status: 'active' }), orgItem('b.com', { status: 'active' })]);
  const gate = store.gateOn((cmd) => cmd.constructor.name === 'TransactWriteCommand');
  const pReplay = replayStructuredSideEffects({ ...rfqBase, targetOrgId: 'a.com', generation: GEN_1, backfillPk: 'RFQ#1' });
  await store.idle();                                               // replay parked at its fenced write; resolve already saw A active
  archiveOrgInStore(store, 'a.com', { mergedInto: 'b.com' });       // merge archives A first (its half of the fence)
  gate.release();
  const r = await pReplay;
  expect(r.ok).toBe(true);
  expect(store.get('RFQ#1').matchedOrgId).toBe('b.com');            // fence cancelled → re-resolved → successor
});
// Scenario 13 — >100-event unit REDIRECT: the paginated redirect pass moves all 130, rollups dirty.
it('130-event unit redirect converges fully via pagination', async () => {
  const events = Array.from({ length: 130 }, (_, i) => movedEvent(`tev-${i}`, { orgId: 'a.com', linkGeneration: GEN_1 }));
  const store = seedStore([rfqRecord('RFQ#1', { matchedOrgId: '' }),
    orgItem('a.com', { status: 'archived', mergedInto: 'b.com' }), orgItem('b.com', { status: 'active' }), ...events]);
  store.pageSize = 25;                                              // force multiple pages
  const r = await replayStructuredSideEffects({ ...rfqBase, targetOrgId: 'a.com', generation: GEN_1, backfillPk: 'RFQ#1' });
  expect(r.ok).toBe(true);
  expect(events.filter((e) => store.get(`TLEVENT#${e.id}`).orgId === 'b.com')).toHaveLength(130);
});
// Scenario 14 — STUCK RECOVERY end-to-end: blocked marker heals automatically once the chain is fixed.
it('target_unavailable marker recovers via the reason-specific republish pass', async () => {
  const store = seedStore([rfqRecord('RFQ#1', { matchedOrgId: '' }), orgItem('a.com', { status: 'archived' })]);
  putPendingMarker(store, { unitKey: 'unresolved-rfq-r1', generation: GEN_1, targetOrgId: 'a.com' });
  await reconcileRepair();                                          // drain 1: blocks it (stuck, target_unavailable)
  expect(store.markersFor('unresolved-rfq-r1')[0].status).toBe('stuck');
  archiveOrgInStore(store, 'a.com', { mergedInto: 'b.com' });       // admin fixes the chain
  store.put(orgKeyOf('b.com'), orgItem('b.com', { status: 'active' }).item);
  const s2 = await reconcileRepair();                               // drain 2: recovery pass republishes
  expect(s2.recovered).toBe(1);
  const s3 = await reconcileRepair();                               // drain 3: normal drain repairs at the successor
  expect(store.markersFor('unresolved-rfq-r1')).toHaveLength(0);    // repaired + deleted
  expect(store.get('RFQ#1').matchedOrgId).toBe('b.com');
});
```
(`GEN_1 < GEN_2` are fixed ULID literals, e.g. `'01J0AAAAAAAAAAAAAAAAAAAAAA'` / `'01J0BBBBBBBBBBBBBBBBBBBBBB'`; `orgItem(id, fields)` seeds an organization item in the harness's org keyspace.)
(Fixture helpers `unresolvedEvent(id)` → an unresolved rfq event in unit `unresolved-rfq-r1` with `sourceEntityId: 'r1'`; `rfqRecord(pk, fields)`; `rfqBase` = the replay fixture; all defined at the top of the suite.)

- [ ] **Step 3: Run** `npx vitest run amplify/functions/crm-api/lib/link/linkStructuredUnit.adversarial.test.ts amplify/functions/crm-api/lib/contactStore.test.ts amplify/functions/crm-api/lib/repair/reconcileRepair.test.ts` — ALL pass.

- [ ] **Step 4: Commit**
```bash
git add amplify/functions/crm-api/lib/link/linkStructuredUnit.adversarial.test.ts amplify/functions/crm-api/lib/link/linkTestHarness.ts
git commit -m "test(comms-p1): stateful adversarial suite — gated interleavings, merge-chain resolution, delayed writers, legacy regression"
```

---

### Task 15: Part-1 green-bar + invariant checkpoint

- [ ] **Step 1:** `npx vitest run amplify/functions/crm-api` — ALL pass (expect ≈280+; note count).
- [ ] **Step 2:** `npx vitest run src/pages/admin/NeedsLinkingPage.test.tsx src/components/admin/needslinking src/hooks` — pass.
- [ ] **Step 3 (plan-review R3 — no pipes that eat compiler status, no zero-count grep failures):**
```bash
npx tsc --noEmit -p amplify/tsconfig.json
```
Expected: no output, exit 0. Any diagnostic = a failure this plan introduced — fix it.
```bash
OUT=$(npx tsc --noEmit 2>&1); NEW=$(printf '%s\n' "$OUT" | grep -v "main.tsx" | grep "error TS"); if [ -n "$NEW" ]; then printf 'NEW TS ERRORS:\n%s\n' "$NEW"; false; else echo "PASS: only pre-existing main.tsx diagnostics"; fi
```
This command **exits nonzero by itself** when any `error TS` line exists outside `main.tsx` (plan-review R5: the gate must fail automatically, not rely on a human reading echoed statuses), prints exactly the offending lines when it does, and exits 0 with an explicit PASS line otherwise. No temp file, nothing to clean up.
- [ ] **Step 4:** `npx eslint` across every file this plan touched — clean.
- [ ] **Step 5:** Re-check the 10 header invariants against the diff. If (and only if) fixups were needed, stage the specific touched files and commit:
```bash
git status --short   # decide: any fixup changes?
```
```bash
git commit -m "chore(comms-p1): green-bar checkpoint"
```
(Skip the commit when `git status` shows nothing — do NOT suffix `|| echo`, which would mask a real commit failure.)
Report test counts + invariant confirmation. Part 1 is then PR-able on its own (pure hardening — deployable before any Gmail code exists).
