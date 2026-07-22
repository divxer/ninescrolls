# P2 Comms — Part 1: CRM Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land every CRM-side contract and hardening change from the comms-sync spec (R1–R9) so the Gmail channel (Part 2) can plug in — independently mergeable as pure hardening of merged 3B/3C.

**Architecture:** No new Lambda. Extends crm-api (emit contracts, resolution, link mutation, repair machinery), the shared `amplify/lib/crm` contract, organization-api's merge, the GraphQL schema, and the Needs-Linking UI. Everything is backward-compatible: existing channels pass no new fields and behave byte-identically.

**Tech Stack:** AWS Amplify Gen2 / AppSync customTypes, DynamoDB single-table (`INTELLIGENCE_TABLE`) via `@aws-sdk/lib-dynamodb` (incl. `TransactWriteCommand`), vitest module-mock style. Worktree `scratchpad/wt-comms`, branch `feature/customer-360-p2-comms-sync` (node_modules symlinked). Spec: `docs/superpowers/specs/2026-07-09-customer-360-p2-comms-sync-design.md` @ `da47e1bf`.

**Test commands:** `npx vitest run <paths>` from worktree root; full backend `npx vitest run amplify/functions/crm-api`; `npx tsc --noEmit -p amplify/tsconfig.json` (clean) and `npx tsc --noEmit` (only the pre-existing `amplify_outputs.json`/`main.tsx` error); `npx eslint <changed>`.

**Invariants for every review gate (from spec R1–R9):**
1. Audit ids derive ONLY from committed values (`reason|unitKey|targetOrgId[|generation]`); non-generational ids byte-identical to today's (existing rows!).
2. No client-named partitions: the link server-derives everything from a strongly-read, fully-validated representative event (unresolved ∧ ¬voided ∧ ¬internalOnly ∧ `unresolved-` org ∧ allowed source).
3. Per-event eligibility in EVERY move condition (`unresolved ∧ orgId=:unitKey ∧ ¬voided ∧ ¬internalOnly ∧ source=:src`).
4. First move + marker in ONE `TransactWriteItems`; marker `attribute_not_exists(PK)`; a loser's transaction aborts → no marker.
5. Marker lifecycle `building → pending`; drainer sees `pending` only; abandoned `building` ages in; ALL transitions version-fenced; CCFE on a transition = another actor won = skip.
6. Generations are ULIDs; older generation ⇒ `superseded` SUCCESS no-op on Contact + source; `linkLocked` never re-orged (`locked` = success).
7. Non-generational writers preserve `lastLinkGeneration`; merge is authoritative (re-stamps atomically); creation-time resolution is generation-absent.
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
// Lexicographic order == time order (same-ms ties broken arbitrarily — accepted per spec R9/1).
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
Append to `handler.test.ts` (reuse its mocks; the guarded resolvers must reject BEFORE their lib fn is called):
```ts
it('linkStructuredUnit without admin group is rejected before any work', async () => {
  await expect(handler({ info: { fieldName: 'linkStructuredUnit' }, arguments: {}, identity: { claims: { 'cognito:groups': ['staff'] } } } as never))
    .rejects.toThrow(/admin/i);
  expect(linkStructuredUnit).not.toHaveBeenCalled();
});
it('crmHealth with admin group passes the guard', async () => {
  await handler({ info: { fieldName: 'crmHealth' }, arguments: {}, identity: { claims: { 'cognito:groups': ['admin'] } } } as never);
  expect(crmHealthFn).toHaveBeenCalled();
});
```

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

- [ ] **Step 3: Implement.** In `types.ts` add `lastLinkGeneration: string | null;` to `ContactItem`. In `contactStore.ts` change `upsertContact` to:
```ts
export type ContactUpsertOutcome = 'written' | 'superseded' | 'locked';

export async function upsertContact(args: {
  email: string; orgId: string; source: string; occurredAt: string;
  name?: string; title?: string; role?: string; phone?: string;
  linkGeneration?: string;                       // generational (link/replay) callers only
}): Promise<{ contactId: string; outcome: ContactUpsertOutcome }> {
  const email = normalizeEmail(args.email);
  const existing = await getContactByEmail(email);
  const contactId = existing?.contactId ?? contactIdForEmail(email);
  const nowIso = new Date().toISOString();
  const occurredAt = args.occurredAt;

  if (args.linkGeneration) {
    if (existing?.linkLocked) return { contactId, outcome: 'locked' };          // R8: never re-org a locked contact
    if (existing?.lastLinkGeneration && existing.lastLinkGeneration >= args.linkGeneration) {
      return { contactId, outcome: 'superseded' };                              // R8: older replay = success no-op
    }
  }

  const orgId = args.linkGeneration ? args.orgId : (existing?.linkLocked ? existing.orgId : args.orgId);
  const firstSeenAt = existing?.firstSeenAt && existing.firstSeenAt < occurredAt ? existing.firstSeenAt : occurredAt;
  const lastSeenAt = existing?.lastSeenAt && existing.lastSeenAt > occurredAt ? existing.lastSeenAt : occurredAt;

  const item = {
    ...contactKeys({ contactId, email, orgId }),
    entityType: 'CONTACT' as const,
    contactId, email, orgId, source: existing?.source ?? args.source,
    name: args.name ?? existing?.name ?? null, title: args.title ?? existing?.title ?? null,
    role: args.role ?? existing?.role ?? null, phone: args.phone ?? existing?.phone ?? null,
    linkLocked: existing?.linkLocked ?? false,
    // R9 cross-writer policy: non-generational writes carry the stamp forward, exactly like linkLocked.
    lastLinkGeneration: args.linkGeneration ?? existing?.lastLinkGeneration ?? null,
    firstSeenAt, lastSeenAt,
    createdAt: existing?.createdAt ?? nowIso, updatedAt: nowIso,
  };

  if (args.linkGeneration) {
    try {
      await docClient.send(new PutCommand({
        TableName: TABLE_NAME(), Item: item,
        // store-enforced monotonicity — a racing newer generation makes this CCFE ⇒ superseded
        ConditionExpression: 'attribute_not_exists(PK) OR attribute_not_exists(lastLinkGeneration) OR lastLinkGeneration < :gen',
        ExpressionAttributeValues: { ':gen': args.linkGeneration },
      }));
      return { contactId, outcome: 'written' };
    } catch (err) {
      if ((err as { name?: string }).name === 'ConditionalCheckFailedException') return { contactId, outcome: 'superseded' };
      throw err;
    }
  }
  await docClient.send(new PutCommand({ TableName: TABLE_NAME(), Item: item }));
  return { contactId, outcome: 'written' };
}
```
**Callers:** the return type changed from `Promise<string>`. Update every call site to `(await upsertContact(...)).contactId` — `emitTimelineEvent.ts` and `manualMoveTimelineEvent.ts` (grep `upsertContact(` to catch all; keep their behavior otherwise identical).

- [ ] **Step 4: Run** `contactStore.test.ts` + `emitTimelineEvent.test.ts` + `manualMoveTimelineEvent.test.ts` + tsc — PASS/clean.

- [ ] **Step 5: Commit**
```bash
git add amplify/functions/crm-api/lib/contactStore.ts amplify/functions/crm-api/lib/contactStore.test.ts amplify/functions/crm-api/lib/types.ts amplify/functions/crm-api/lib/emitTimelineEvent.ts amplify/functions/crm-api/lib/link/manualMoveTimelineEvent.ts
git commit -m "feat(comms-p1): generation-aware upsertContact (preserve/conditional/superseded/locked)"
```

---

### Task 8: Generational source backfill (`superseded` outcome) + merge re-stamps

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
```
(`base` gains `generation`; add it to the shared fixture.)

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement replay side.** In `replaySideEffects.ts`: `BackfillStatus` gains `'superseded'`; `replayStructuredSideEffects` args gain `generation: string`; `backfillByPk(pk, targetOrgId, generation)` becomes:
```ts
async function backfillByPk(pk: string, targetOrgId: string, generation: string): Promise<BackfillStatus> {
  try {
    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME(), Key: { PK: pk, SK: 'META' },
      UpdateExpression: 'SET matchedOrgId = :o, matchedOrgLinkGeneration = :gen',   // R9: atomically, one write
      ConditionExpression: '(attribute_not_exists(matchedOrgId) OR attribute_type(matchedOrgId, :nullType) OR matchedOrgId = :empty OR begins_with(matchedOrgId, :unres)) OR (attribute_exists(matchedOrgLinkGeneration) AND matchedOrgLinkGeneration < :gen)',
      ExpressionAttributeValues: { ':o': targetOrgId, ':empty': '', ':unres': 'unresolved-', ':nullType': 'NULL', ':gen': generation },
    }));
    return 'written';
  } catch (err) {
    if ((err as { name?: string }).name !== 'ConditionalCheckFailedException') throw err;
    const cur = (await docClient.send(new GetCommand({ TableName: TABLE_NAME(), Key: { PK: pk, SK: 'META' } }))).Item as Record<string, unknown> | undefined;
    const curGen = cur?.matchedOrgLinkGeneration as string | undefined;
    if (curGen && curGen >= generation) return 'superseded';            // R8: newer generation already ruled
    return (cur?.matchedOrgId as string | undefined) === targetOrgId ? 'already_set' : 'conflict';
  }
}
```
Decision logic: `superseded` counts as ok (like `already_set`); `conflict` unchanged. The audit call passes `generation` to `deterministicAuditId(..., generation)` and includes `generation` in `details`. Contact step (Task 7's API): call `upsertContact({..., linkGeneration: generation})`; `locked`/`superseded` outcomes are SUCCESS for the contact effect.

- [ ] **Step 4: Merge side.** Read the located merge flow; where it re-points a record's `matchedOrgId`, extend that same `UpdateExpression` with `, matchedOrgLinkGeneration = :mergeGen` where `:mergeGen = generateUlid()` computed once per merge run (import from crm-api's `lib/ulid` — if cross-function import is awkward, copy the 20-line util into organization-api with a header comment naming the original). Add a test in the merge test file asserting the re-point write includes `matchedOrgLinkGeneration`.

- [ ] **Step 5: Run** replay tests + merge tests + tsc — PASS/clean.

- [ ] **Step 6: Commit**
```bash
git add amplify/functions/crm-api/lib/repair/replaySideEffects.ts amplify/functions/crm-api/lib/repair/replaySideEffects.structured.test.ts amplify/functions/organization-api
git commit -m "feat(comms-p1): generational source stamps (superseded) + merge re-stamps authoritatively"
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
```
(Write `markerAt(version)` / `manyIds(n)` helpers in the test. Analytics markers keep the 3C shape — add one regression test that `putRepairMarker` for analytics is unchanged.)

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement** in `repairMarker.ts` (keep the 3C analytics path intact):
```ts
export interface StructuredMarkerV2 extends Omit<RepairMarkerItem, 'status'> {
  generation: string; version: number;
  status: 'building' | 'pending' | 'stuck';
  customerEmail: string | null; movedCount: number; affectedEventIdsSample: string[];
}
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
export async function queryBuildingOlderThan(cutoffIso: string, limit: number): Promise<StructuredMarkerV2[]> {
  const res = await docClient.send(new QueryCommand({
    TableName: TABLE_NAME(), IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk AND GSI1SK < :cut',
    ExpressionAttributeValues: { ':pk': 'CRM_REPAIR#building', ':cut': `${cutoffIso}#￿` },
    ScanIndexForward: true, Limit: limit,
  }));
  return (res.Items ?? []) as StructuredMarkerV2[];
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
      if (r.moved) { moved += 1; await accumulateMarker(markerHandle, { movedCountDelta: 1, newSampleIds: [ev.id], contactStatus: r.contactStatus }, nowIso); }
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
Include the two small helpers in the same file: `buildMoveTransactPut` (the movedItem exactly as `manualMoveTimelineEvent` constructs it, wrapped as a `Put` with the R7 eligibility condition — extract the shared item-construction into an exported `buildMovedItem(event, targetOrgId, email, nowIso)` in `manualMoveTimelineEvent.ts` so the two paths cannot drift) and `isConditionalCancellation` (inspects `err.name === 'TransactionCanceledException'` and `err.CancellationReasons?.some(r => r.Code === 'ConditionalCheckFailed')` — the R7-deferred cancellation mapping).

- [ ] **Step 4: Run** the reworked file suite + `manualMoveTimelineEvent.test.ts` (its condition gains the eligibility clauses — update its assertions) + tsc — PASS/clean.

- [ ] **Step 5: Commit**
```bash
git add amplify/functions/crm-api/lib/link/linkStructuredUnit.ts amplify/functions/crm-api/lib/link/linkStructuredUnit.test.ts amplify/functions/crm-api/lib/link/manualMoveTimelineEvent.ts amplify/functions/crm-api/lib/link/manualMoveTimelineEvent.test.ts
git commit -m "feat(comms-p1): linkStructuredUnit v2 — representative-derived unit, eligibility, first-move+marker transaction"
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
it('ages building markers older than 2× link timeout into pending, leaves fresh ones alone', async () => {
  queryBuildingOlderThan.mockResolvedValueOnce([buildingMarker]);
  await reconcileRepair({});
  expect(sealMarker).toHaveBeenCalledWith(buildingMarker, expect.any(String));
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

- [ ] **Step 3: Implement** in `reconcileRepair.ts`: before draining, run the aging pass (`queryBuildingOlderThan(new Date(Date.now() - 2 * LINK_LAMBDA_TIMEOUT_MS).toISOString(), 25)` → `sealMarker` each; `LINK_LAMBDA_TIMEOUT_MS = 120_000` with a keep-in-sync comment). Extend `replayFor` to pass `generation`, `customerEmail`, `contactStatus`, `affectedEventIdsSample`. Transition calls switch to the fenced v2 fns; a `{lost:true}` result increments a new `raced` counter (not `errors`). `superseded`/`locked` replay outcomes are OK-path (delete). Summary gains `aged` + `raced`.

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

- [ ] **Step 1: Failing tests.** Handler: `linkStructuredUnit` resolver forwards `{ representativeEventId, targetOrgId, operator }` (no sourceType/sourceEntityId args). Frontend: the page's link action calls the service with the unit's `representativeEventId`.

- [ ] **Step 2: Implement.** `data/resource.ts`: `NeedsLinkingItem` gains `representativeEventId: a.string().required()`; `linkStructuredUnit` mutation arguments become `{ representativeEventId: a.string().required(), targetOrgId: a.string().required() }`. Handler resolver maps accordingly (+ keeps `requireAdmin`). Service `linkStructuredUnit(args: { representativeEventId: string; targetOrgId: string })`. Page/`handleLink` passes `unit.representativeEventId` for structured units (analytics path unchanged). Update the page/unit-list tests' fixtures.

- [ ] **Step 3: Run** handler + frontend needslinking tests + `npx tsc --noEmit` (both) + eslint on changed files — PASS/clean.

- [ ] **Step 4: Commit**
```bash
git add amplify/data/resource.ts amplify/functions/crm-api/handler.ts amplify/functions/crm-api/handler.test.ts src/services/organizationAdminService.ts src/pages/admin/NeedsLinkingPage.tsx src/pages/admin/NeedsLinkingPage.test.tsx src/components/admin/needslinking src/hooks/useNeedsLinkingQueue.ts
git commit -m "feat(comms-p1): representativeEventId link contract across schema/handler/service/UI"
```

---

### Task 14: Part-1 green-bar + invariant checkpoint

- [ ] **Step 1:** `npx vitest run amplify/functions/crm-api` — ALL pass (expect ≈270+; note count).
- [ ] **Step 2:** `npx vitest run src/pages/admin/NeedsLinkingPage.test.tsx src/components/admin/needslinking src/hooks` — pass.
- [ ] **Step 3:** `npx tsc --noEmit && npx tsc --noEmit -p amplify/tsconfig.json` — only the pre-existing `main.tsx` error.
- [ ] **Step 4:** `npx eslint` across every file this plan touched — clean.
- [ ] **Step 5:** Re-check the 10 header invariants against the diff; commit any fixups scoped to touched files:
```bash
git commit -m "chore(comms-p1): green-bar checkpoint" || echo "nothing to commit"
```
Report test counts + invariant confirmation. Part 1 is then PR-able on its own (pure hardening — deployable before any Gmail code exists).
