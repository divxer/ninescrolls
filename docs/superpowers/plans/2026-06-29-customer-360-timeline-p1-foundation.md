# Customer 360 Timeline — P1 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the trustworthy data foundation for the Customer 360 Timeline — the `TimelineEvent`/`Contact`/`LinkAuditLog` storage, the shared `resolveLinks` resolver, the `emitTimelineEvent` helper, and rollup helpers — fully unit-tested in isolation, with no channel wiring or UI yet.

**Architecture:** A new `crm-api` Amplify Gen 2 Lambda mirrors the existing `order-api`/`logistics-api` structure (SDK v3 `DocumentClient`, dispatch-on-`fieldName`, `lib/` + `resolvers/`, vitest). All entities live in the existing shared `INTELLIGENCE_TABLE` single-table design, reusing GSI1–GSI4. Source tables stay authoritative; every meaningful interaction is materialized into a `TimelineEvent` carrying a resolved `orgId`/`contactId`. This plan delivers the library + storage; Plans 2 (channel wiring + backfill + sweep) and 3 (admin UI) build on its interfaces.

**Tech Stack:** TypeScript (Node 22), AWS SDK v3 (`@aws-sdk/lib-dynamodb`), Amplify Gen 2, vitest. Spec: `docs/superpowers/specs/2026-06-29-customer-360-timeline-p1-design.md`.

**Conventions confirmed from the codebase:**
- Shared table env var: `process.env.INTELLIGENCE_TABLE`, keys `PK`/`SK`.
- GSIs (ALL projection): `GSI2PK=ORG#{orgId}` (org timeline), `GSI4PK=EMAIL#{email}` (email/contact), `GSI3PK` (entity association), `GSI1PK` (status listing).
- Lambda layout: `amplify/functions/<name>/{handler.ts,resource.ts,lib/{dynamodb,idGenerators,types}.ts,resolvers/*.ts}`.
- Tests: vitest, `vi.mock` the SDK, `*.test.ts` next to source.
- Run tests from repo root: `npx vitest run <path>`.

**Single-table key map for new entities (reference for all tasks):**

| Entity | PK | SK | GSI1 (status) | GSI2 (org) | GSI3 (source) | GSI4 (email/contact) |
|---|---|---|---|---|---|---|
| `TimelineEvent` | `TLEVENT#{id}` | `A` | `TLEVENT_STATUS#{resolutionStatus}` / `{occurredAt}#{id}` | `ORG#{orgId}` / `TLEVENT#{occurredAt}#{id}` | `SRC#{sourceEntityType}#{sourceEntityId}` / `TLEVENT#{occurredAt}#{id}` | `CONTACT#{contactId}` / `TLEVENT#{occurredAt}#{id}` (only when contactId set) |
| `Contact` | `CONTACT#{contactId}` | `A` | — | `ORG#{orgId}` / `CONTACT#{email}` | — | `EMAIL#{email}` / `CONTACT#A` |
| `OrgDomainIndex` | `ORGDOMAIN#{domain}` | `A` | — | — | — | — |
| `OrgNameIndex` | `ORGNAME#{normName}` | `A` | — | — | — | — |
| `LinkAuditLog` | `AUDIT#{id}` | `A` | — | `ORG#{orgId}` / `AUDIT#{ts}#{id}` | — | — |

> `OrgDomainIndex` / `OrgNameIndex` are O(1) lookup items (`{ orgId }`) that let `resolveLinks` match by domain/name without scanning the Organizations. They are maintained on org create/alias (Plan 2) and built by backfill (Plan 2); this plan only defines and reads them.

---

## File Structure

**New — `amplify/functions/crm-api/`:**
- `resource.ts` — `defineFunction` (Node 22, 30s, 512MB).
- `lib/dynamodb.ts` — `docClient` + `TABLE_NAME()` (copy of order-api).
- `lib/idGenerators.ts` — `generateAuditId()` (+ re-export contact id helper).
- `lib/normalize.ts` — email/domain/name normalization, free-domain set, denylist.
- `lib/timelineId.ts` — deterministic `TimelineEvent` id derivation (§3.5) with legacy fallbacks.
- `lib/keys.ts` — PK/SK/GSI key builders for the new entities.
- `lib/types.ts` — item + domain interfaces, enums, `AppSyncEvent`.
- `lib/contactStore.ts` — `getContactByEmail`, `upsertContact`.
- `lib/orgStore.ts` — `getOrgIdByDomain`, `getOrgIdByName`, `getOrganization`, `recomputeRollupsForOrg`, `bumpOrgRollupOnCreate`.
- `lib/resolveLinks.ts` — the resolution ladder (the crown jewel).
- `lib/emitTimelineEvent.ts` — orchestration (resolve → upsert contact → conditional put → rollup).
- `handler.ts` — dispatch-on-`fieldName` skeleton (no fields wired until Plan 2/3).
- Test files alongside each `lib/*.ts`.

**Modified:**
- `amplify/backend.ts` — register `crmApi`, grant table access + env (mirror logistics-api block at `:524-526`).
- `amplify/data/resource.ts` — add `TimelineEvent`, `Contact`, `LinkAuditLog` `a.customType`s + import `crmApi` (types only, no queries this plan).
- `amplify/functions/order-api/lib/types.ts` + the OrderLog append site — add stable `id` to log entries.
- `amplify/functions/logistics-api/lib/types.ts` + the milestone-append resolver — add stable `id` to log entries.

---

## Task 1: Add stable `id` to OrderLog entries (§10.1 prerequisite)

Deterministic `order_stage_changed` ids key off a stable per-log id. `OrderLog` entries currently have none. Add an `id` to newly written entries. (Legacy entries without `id` are handled by a fallback hash in Task 5 — no data migration here.)

**Files:**
- Modify: `amplify/functions/order-api/lib/types.ts` (the `LogItem` interface)
- Modify: `amplify/functions/order-api/lib/idGenerators.ts`
- Modify: the resolver that appends order logs — `amplify/functions/order-api/resolvers/updateOrderStatus.ts`
- Test: `amplify/functions/order-api/lib/idGenerators.test.ts`

- [ ] **Step 1: Write the failing test**

Create `amplify/functions/order-api/lib/idGenerators.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { generateLogId } from './idGenerators';

describe('generateLogId', () => {
  it('produces a stable-format log id with the olog- prefix', () => {
    const id = generateLogId();
    expect(id).toMatch(/^olog-[0-9a-f]{12}$/);
  });

  it('produces unique ids across calls', () => {
    expect(generateLogId()).not.toBe(generateLogId());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run amplify/functions/order-api/lib/idGenerators.test.ts`
Expected: FAIL — `generateLogId is not a function`.

- [ ] **Step 3: Add the generator**

Append to `amplify/functions/order-api/lib/idGenerators.ts`:

```typescript
export function generateLogId(): string {
    return `olog-${crypto.randomBytes(6).toString('hex')}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run amplify/functions/order-api/lib/idGenerators.test.ts`
Expected: PASS.

- [ ] **Step 5: Add `id` to the `LogItem` interface**

In `amplify/functions/order-api/lib/types.ts`, add to the `LogItem` interface (the order-log item, ~`:115`):

```typescript
    id?: string; // stable per-entry id (olog-...). Optional: legacy entries predate this field.
```

- [ ] **Step 6: Stamp `id` when an order log is written**

In `amplify/functions/order-api/resolvers/updateOrderStatus.ts`, import `generateLogId` and set `id: generateLogId()` on the log item being `Put`/appended. Locate the object that sets `SK: \`LOG#${timestamp}\`` and add the `id` field to it.

- [ ] **Step 7: Run the order-api suite to confirm no regression**

Run: `npx vitest run amplify/functions/order-api`
Expected: PASS (existing tests unaffected; new field is additive).

- [ ] **Step 8: Commit**

```bash
git add amplify/functions/order-api/lib/idGenerators.ts amplify/functions/order-api/lib/idGenerators.test.ts amplify/functions/order-api/lib/types.ts amplify/functions/order-api/resolvers/updateOrderStatus.ts
git commit -m "feat(order-api): add stable id to OrderLog entries (crm timeline prereq)"
```

---

## Task 2: Add stable `id` to LogisticsLogEntry entries (§10.1 prerequisite)

Same as Task 1 for logistics milestone log entries.

**Files:**
- Modify: `amplify/functions/logistics-api/lib/types.ts` (the `LogisticsLogEntry` interface, ~`:40-48`)
- Modify: `amplify/functions/logistics-api/lib/idGenerators.ts`
- Modify: `amplify/functions/logistics-api/resolvers/advanceLogisticsStage.ts` (and any other milestone-append resolver)
- Test: `amplify/functions/logistics-api/lib/idGenerators.test.ts`

- [ ] **Step 1: Write the failing test**

Create `amplify/functions/logistics-api/lib/idGenerators.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { generateMilestoneId } from './idGenerators';

describe('generateMilestoneId', () => {
  it('produces a stable-format milestone id', () => {
    expect(generateMilestoneId()).toMatch(/^mlog-[0-9a-f]{12}$/);
  });
  it('is unique across calls', () => {
    expect(generateMilestoneId()).not.toBe(generateMilestoneId());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run amplify/functions/logistics-api/lib/idGenerators.test.ts`
Expected: FAIL — `generateMilestoneId is not a function`.

- [ ] **Step 3: Add the generator**

Append to `amplify/functions/logistics-api/lib/idGenerators.ts`:

```typescript
export function generateMilestoneId(): string {
    return `mlog-${crypto.randomBytes(6).toString('hex')}`;
}
```

(Ensure `import crypto from 'node:crypto';` is present at the top — it is, per existing generators.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run amplify/functions/logistics-api/lib/idGenerators.test.ts`
Expected: PASS.

- [ ] **Step 5: Add `id` to `LogisticsLogEntry`**

In `amplify/functions/logistics-api/lib/types.ts`, add to `LogisticsLogEntry`:

```typescript
    id?: string; // stable per-entry id (mlog-...). Optional: legacy entries predate this field.
```

- [ ] **Step 6: Stamp `id` when a milestone is appended**

In `amplify/functions/logistics-api/resolvers/advanceLogisticsStage.ts`, where a new `LogisticsLogEntry` object is built for `list_append` into `milestoneLog`, set `id: generateMilestoneId()`.

- [ ] **Step 7: Run the logistics-api suite**

Run: `npx vitest run amplify/functions/logistics-api`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add amplify/functions/logistics-api/lib/idGenerators.ts amplify/functions/logistics-api/lib/idGenerators.test.ts amplify/functions/logistics-api/lib/types.ts amplify/functions/logistics-api/resolvers/advanceLogisticsStage.ts
git commit -m "feat(logistics-api): add stable id to milestone log entries (crm timeline prereq)"
```

---

## Task 3: Scaffold the `crm-api` Lambda

Create the function skeleton mirroring order-api, register it in backend, and grant table access. No GraphQL fields are wired yet (Plan 2/3); the handler dispatches to an empty resolver map.

**Files:**
- Create: `amplify/functions/crm-api/resource.ts`
- Create: `amplify/functions/crm-api/lib/dynamodb.ts`
- Create: `amplify/functions/crm-api/handler.ts`
- Modify: `amplify/backend.ts`
- Test: `amplify/functions/crm-api/handler.test.ts`

- [ ] **Step 1: Write the failing test**

Create `amplify/functions/crm-api/handler.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { handler } from './handler';

describe('crm-api handler', () => {
  it('throws a clear error for an unknown fieldName', async () => {
    const event = { info: { fieldName: 'nope', parentTypeName: 'Query' }, arguments: {} };
    await expect(handler(event as never)).rejects.toThrow(/unknown.*nope/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run amplify/functions/crm-api/handler.test.ts`
Expected: FAIL — cannot find `./handler`.

- [ ] **Step 3: Create the lib + handler + resource**

`amplify/functions/crm-api/lib/dynamodb.ts`:

```typescript
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const ddbClient = new DynamoDBClient({});
export const docClient = DynamoDBDocumentClient.from(ddbClient);

export const TABLE_NAME = () => process.env.INTELLIGENCE_TABLE!;
```

`amplify/functions/crm-api/handler.ts`:

```typescript
type AppSyncEvent = {
  info?: { fieldName?: string; parentTypeName?: string };
  fieldName?: string;
  arguments?: Record<string, unknown>;
  identity?: { sub?: string; claims?: { email?: string } };
};

// Field → resolver map. Populated in Plans 2 & 3.
const resolvers: Record<string, (e: AppSyncEvent) => Promise<unknown>> = {};

export const handler = async (event: AppSyncEvent): Promise<unknown> => {
  const fieldName = event.info?.fieldName ?? event.fieldName;
  if (!fieldName || !resolvers[fieldName]) {
    throw new Error(`crm-api: unknown fieldName "${fieldName}"`);
  }
  return resolvers[fieldName](event);
};
```

`amplify/functions/crm-api/resource.ts`:

```typescript
import { defineFunction } from '@aws-amplify/backend';

export const crmApi = defineFunction({
  name: 'crm-api',
  entry: './handler.ts',
  runtime: 22,
  timeoutSeconds: 30,
  memoryMB: 512,
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run amplify/functions/crm-api/handler.test.ts`
Expected: PASS.

- [ ] **Step 5: Register + grant in `amplify/backend.ts`**

At the imports for function resources (near `:15-16`), add:

```typescript
import { crmApi } from './functions/crm-api/resource';
```

In the `defineBackend({ ... })` call (near `:87-88`), add `crmApi,` to the object.

After the logistics-api grant block (`:524-526`), add:

```typescript
// Grant crm-api Lambda access (Customer 360 Timeline — shared single table)
intelligenceTable.grantReadWriteData(backend.crmApi.resources.lambda);
backend.crmApi.addEnvironment('INTELLIGENCE_TABLE', intelligenceTable.tableName);
```

- [ ] **Step 6: Typecheck the backend**

Run: `npx tsc --noEmit -p amplify/tsconfig.json` (or the repo's amplify typecheck script if present).
Expected: PASS (no type errors from the new wiring).

- [ ] **Step 7: Commit**

```bash
git add amplify/functions/crm-api amplify/backend.ts
git commit -m "feat(crm-api): scaffold crm-api lambda + backend wiring"
```

---

## Task 4: Normalization helpers (email, domain, name, free-domain, denylist)

Pure functions used by `resolveLinks`. No I/O — easy, high-value TDD.

**Files:**
- Create: `amplify/functions/crm-api/lib/normalize.ts`
- Test: `amplify/functions/crm-api/lib/normalize.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import {
  normalizeEmail, domainOf, normalizeOrgName, isFreeEmailDomain, isDenylistedDomain,
} from './normalize';

describe('normalize', () => {
  it('normalizeEmail lowercases and trims', () => {
    expect(normalizeEmail('  Terry@DiamondFoundry.com ')).toBe('terry@diamondfoundry.com');
  });
  it('domainOf extracts the host', () => {
    expect(domainOf('terry@diamondfoundry.com')).toBe('diamondfoundry.com');
    expect(domainOf('not-an-email')).toBeNull();
  });
  it('normalizeOrgName collapses case/whitespace/punctuation', () => {
    expect(normalizeOrgName('  Diamond  Foundry, Inc. ')).toBe('diamond foundry inc');
  });
  it('isFreeEmailDomain flags consumer providers', () => {
    expect(isFreeEmailDomain('gmail.com')).toBe(true);
    expect(isFreeEmailDomain('qq.com')).toBe(true);
    expect(isFreeEmailDomain('diamondfoundry.com')).toBe(false);
  });
  it('isDenylistedDomain flags hosting/proxy/cdn/free providers', () => {
    expect(isDenylistedDomain('gmail.com')).toBe(true);
    expect(isDenylistedDomain('amazonaws.com')).toBe(true);
    expect(isDenylistedDomain('diamondfoundry.com')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run amplify/functions/crm-api/lib/normalize.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`amplify/functions/crm-api/lib/normalize.ts`:

```typescript
const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'live.com',
  'yahoo.com', 'yahoo.co.uk', 'icloud.com', 'me.com', 'aol.com', 'proton.me',
  'protonmail.com', 'qq.com', '163.com', '126.com', 'sina.com', 'foxmail.com',
]);

// Hosting / proxy / cloud / CDN infra domains that must never auto-create an Org.
const INFRA_DOMAINS = new Set([
  'amazonaws.com', 'cloudfront.net', 'azure.com', 'googleusercontent.com',
  'cloudflare.com', 'akamai.com', 'fastly.net', 'herokuapp.com', 'vercel.app',
]);

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function domainOf(email: string): string | null {
  const at = email.indexOf('@');
  if (at < 0 || at === email.length - 1) return null;
  return email.slice(at + 1).trim().toLowerCase() || null;
}

export function normalizeOrgName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[.,]/g, ' ')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isFreeEmailDomain(domain: string): boolean {
  return FREE_EMAIL_DOMAINS.has(domain.toLowerCase());
}

export function isDenylistedDomain(domain: string): boolean {
  const d = domain.toLowerCase();
  return FREE_EMAIL_DOMAINS.has(d) || INFRA_DOMAINS.has(d);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run amplify/functions/crm-api/lib/normalize.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add amplify/functions/crm-api/lib/normalize.ts amplify/functions/crm-api/lib/normalize.test.ts
git commit -m "feat(crm-api): email/domain/name normalization + free-domain & denylist sets"
```

---

## Task 5: Deterministic TimelineEvent id derivation (§3.5)

Pure functions mapping (kind, source keys) → stable id, with the legacy fallback hash for log entries written before Tasks 1–2.

**Files:**
- Create: `amplify/functions/crm-api/lib/timelineId.ts`
- Test: `amplify/functions/crm-api/lib/timelineId.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { timelineId } from './timelineId';

describe('timelineId', () => {
  it('order_created keys off orderId', () => {
    expect(timelineId({ kind: 'order_created', orderId: 'ord-20260101-aa' }))
      .toBe('tev-order-ord-20260101-aa-created');
  });
  it('order_stage_changed keys off the stable orderLogId', () => {
    expect(timelineId({ kind: 'order_stage_changed', orderId: 'ord-1', orderLogId: 'olog-abc' }))
      .toBe('tev-order-ord-1-stage-olog-abc');
  });
  it('order_stage_changed falls back to a hash when log id is absent (legacy)', () => {
    const id = timelineId({ kind: 'order_stage_changed', orderId: 'ord-1', toStatus: 'SHIPPED', occurredAt: '2026-01-01T00:00:00Z' });
    expect(id).toMatch(/^tev-order-ord-1-stage-h[0-9a-f]{12}$/);
  });
  it('legacy fallback is deterministic for the same inputs', () => {
    const a = timelineId({ kind: 'order_stage_changed', orderId: 'ord-1', toStatus: 'SHIPPED', occurredAt: '2026-01-01T00:00:00Z' });
    const b = timelineId({ kind: 'order_stage_changed', orderId: 'ord-1', toStatus: 'SHIPPED', occurredAt: '2026-01-01T00:00:00Z' });
    expect(a).toBe(b);
  });
  it('rfq_submitted / rfq_status_changed / lead / logistics / quote / session keys', () => {
    expect(timelineId({ kind: 'rfq_submitted', rfqId: 'rfq-1' })).toBe('tev-rfq-rfq-1-submitted');
    expect(timelineId({ kind: 'rfq_status_changed', rfqId: 'rfq-1', toStatus: 'converted' })).toBe('tev-rfq-rfq-1-status-converted');
    expect(timelineId({ kind: 'lead_captured', leadId: 'lead-1' })).toBe('tev-lead-lead-1');
    expect(timelineId({ kind: 'logistics_milestone', caseId: 'lc-1', milestoneId: 'mlog-x' })).toBe('tev-logistics-lc-1-log-mlog-x');
    expect(timelineId({ kind: 'quote_sent', quoteDocId: 'doc-1' })).toBe('tev-quote-doc-1');
    expect(timelineId({ kind: 'site_visit_session', sessionId: 'sess-1' })).toBe('tev-analytics-session-sess-1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run amplify/functions/crm-api/lib/timelineId.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`amplify/functions/crm-api/lib/timelineId.ts`:

```typescript
import crypto from 'node:crypto';

export type TimelineIdInput =
  | { kind: 'order_created'; orderId: string }
  | { kind: 'order_stage_changed'; orderId: string; orderLogId?: string; toStatus?: string; occurredAt?: string }
  | { kind: 'rfq_submitted'; rfqId: string }
  | { kind: 'rfq_status_changed'; rfqId: string; toStatus: string }
  | { kind: 'lead_captured'; leadId: string }
  | { kind: 'logistics_milestone'; caseId: string; milestoneId?: string; stage?: string; occurredAt?: string }
  | { kind: 'quote_sent'; quoteDocId: string }
  | { kind: 'site_visit_session'; sessionId: string }
  | { kind: 'manual'; manualId: string };

function shortHash(...parts: string[]): string {
  return 'h' + crypto.createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 12);
}

export function timelineId(input: TimelineIdInput): string {
  switch (input.kind) {
    case 'order_created':
      return `tev-order-${input.orderId}-created`;
    case 'order_stage_changed': {
      const key = input.orderLogId ?? shortHash(input.orderId, input.toStatus ?? '', input.occurredAt ?? '');
      return `tev-order-${input.orderId}-stage-${key}`;
    }
    case 'rfq_submitted':
      return `tev-rfq-${input.rfqId}-submitted`;
    case 'rfq_status_changed':
      return `tev-rfq-${input.rfqId}-status-${input.toStatus}`;
    case 'lead_captured':
      return `tev-lead-${input.leadId}`;
    case 'logistics_milestone': {
      const key = input.milestoneId ?? shortHash(input.caseId, input.stage ?? '', input.occurredAt ?? '');
      return `tev-logistics-${input.caseId}-log-${key}`;
    }
    case 'quote_sent':
      return `tev-quote-${input.quoteDocId}`;
    case 'site_visit_session':
      return `tev-analytics-session-${input.sessionId}`;
    case 'manual':
      return `tev-manual-${input.manualId}`;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run amplify/functions/crm-api/lib/timelineId.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add amplify/functions/crm-api/lib/timelineId.ts amplify/functions/crm-api/lib/timelineId.test.ts
git commit -m "feat(crm-api): deterministic TimelineEvent id derivation with legacy fallback"
```

---

## Task 6: Entity types + key builders

Define the item/domain types and the PK/SK/GSI key builders (the single-table map above).

**Files:**
- Create: `amplify/functions/crm-api/lib/types.ts`
- Create: `amplify/functions/crm-api/lib/keys.ts`
- Test: `amplify/functions/crm-api/lib/keys.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { timelineEventKeys, contactKeys } from './keys';

describe('keys', () => {
  it('timelineEventKeys maps PK/SK + GSI2(org)/GSI4(contact)/GSI3(src)/GSI1(status)', () => {
    const k = timelineEventKeys({
      id: 'tev-rfq-rfq-1-submitted', orgId: 'org-1', contactId: 'ct-abc',
      occurredAt: '2026-06-19T10:00:00Z', resolutionStatus: 'resolved',
      sourceEntityType: 'rfq', sourceEntityId: 'rfq-1',
    });
    expect(k.PK).toBe('TLEVENT#tev-rfq-rfq-1-submitted');
    expect(k.SK).toBe('A');
    expect(k.GSI2PK).toBe('ORG#org-1');
    expect(k.GSI2SK).toBe('TLEVENT#2026-06-19T10:00:00Z#tev-rfq-rfq-1-submitted');
    expect(k.GSI4PK).toBe('CONTACT#ct-abc');
    expect(k.GSI3PK).toBe('SRC#rfq#rfq-1');
    expect(k.GSI1PK).toBe('TLEVENT_STATUS#resolved');
  });
  it('timelineEventKeys omits GSI4 when no contactId', () => {
    const k = timelineEventKeys({
      id: 't', orgId: 'org-1', occurredAt: '2026-01-01T00:00:00Z', resolutionStatus: 'unresolved',
      sourceEntityType: 'analytics', sourceEntityId: 's1',
    });
    expect(k.GSI4PK).toBeUndefined();
  });
  it('contactKeys maps PK + GSI4(email) + GSI2(org)', () => {
    const k = contactKeys({ contactId: 'ct-abc', email: 'terry@diamondfoundry.com', orgId: 'org-1' });
    expect(k.PK).toBe('CONTACT#ct-abc');
    expect(k.GSI4PK).toBe('EMAIL#terry@diamondfoundry.com');
    expect(k.GSI2PK).toBe('ORG#org-1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run amplify/functions/crm-api/lib/keys.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement types**

`amplify/functions/crm-api/lib/types.ts`:

```typescript
export type ResolutionStatus = 'resolved' | 'unresolved' | 'manually_linked';
export type ResolutionReason =
  | 'manual' | 'existing_matchedOrgId' | 'contact_email_exact' | 'email_domain_exact'
  | 'email_domain_new' | 'organization_name_match' | 'visitor_prior_event' | 'unresolved';
export type TimelineSource =
  | 'analytics' | 'lead' | 'rfq' | 'quote' | 'order' | 'logistics' | 'manual'
  | 'gmail' | 'twilio' | 'support';

export interface TimelineEventItem {
  PK: string; SK: string;
  GSI1PK?: string; GSI1SK?: string;
  GSI2PK?: string; GSI2SK?: string;
  GSI3PK?: string; GSI3SK?: string;
  GSI4PK?: string; GSI4SK?: string;
  entityType: 'TIMELINE_EVENT';
  id: string;
  orgId: string;
  resolutionStatus: ResolutionStatus;
  resolutionReason: ResolutionReason;
  confidence: number;
  contactId: string | null;
  occurredAt: string;
  source: TimelineSource;
  kind: string;
  summary: string;
  sourceEntityType: string;
  sourceEntityId: string;
  isInternalOnly: boolean;
  voided: boolean;
  createdBy: string | null;
  payload: Record<string, unknown> | null;
  // P2-reserved, written null in P1:
  direction: 'inbound' | 'outbound' | null;
  externalId: string | null;
  threadId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContactItem {
  PK: string; SK: string;
  GSI2PK?: string; GSI2SK?: string;
  GSI4PK?: string; GSI4SK?: string;
  entityType: 'CONTACT';
  contactId: string;
  email: string;
  name: string | null;
  title: string | null;
  role: string | null;
  phone: string | null;
  orgId: string;
  source: string;
  firstSeenAt: string;
  lastSeenAt: string;
  linkLocked: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ResolveResult {
  orgId: string;
  contactId: string | null;
  resolutionStatus: ResolutionStatus;
  resolutionReason: ResolutionReason;
  confidence: number;
}
```

- [ ] **Step 4: Implement key builders**

`amplify/functions/crm-api/lib/keys.ts`:

```typescript
export function timelineEventKeys(e: {
  id: string; orgId: string; contactId?: string | null; occurredAt: string;
  resolutionStatus: string; sourceEntityType: string; sourceEntityId: string;
}) {
  const tlSk = `TLEVENT#${e.occurredAt}#${e.id}`;
  const keys: Record<string, string> = {
    PK: `TLEVENT#${e.id}`,
    SK: 'A',
    GSI1PK: `TLEVENT_STATUS#${e.resolutionStatus}`,
    GSI1SK: `${e.occurredAt}#${e.id}`,
    GSI2PK: `ORG#${e.orgId}`,
    GSI2SK: tlSk,
    GSI3PK: `SRC#${e.sourceEntityType}#${e.sourceEntityId}`,
    GSI3SK: tlSk,
  };
  if (e.contactId) {
    keys.GSI4PK = `CONTACT#${e.contactId}`;
    keys.GSI4SK = tlSk;
  }
  return keys;
}

export function contactKeys(c: { contactId: string; email: string; orgId: string }) {
  return {
    PK: `CONTACT#${c.contactId}`,
    SK: 'A',
    GSI4PK: `EMAIL#${c.email}`,
    GSI4SK: 'CONTACT#A',
    GSI2PK: `ORG#${c.orgId}`,
    GSI2SK: `CONTACT#${c.email}`,
  };
}

export function contactIdForEmail(normalizedEmail: string): string {
  // deterministic + readable; non-mergeable by design in P1 (see spec §3.2)
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const crypto = require('node:crypto');
  return `ct-${crypto.createHash('sha256').update(normalizedEmail).digest('hex').slice(0, 12)}`;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run amplify/functions/crm-api/lib/keys.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add amplify/functions/crm-api/lib/types.ts amplify/functions/crm-api/lib/keys.ts amplify/functions/crm-api/lib/keys.test.ts
git commit -m "feat(crm-api): entity types + single-table key builders"
```

---

## Task 7: Org lookup store (domain index, name index, contact-by-email)

The read helpers `resolveLinks` depends on. Each is a single `GetCommand`/`QueryCommand`. DynamoDB is mocked.

**Files:**
- Create: `amplify/functions/crm-api/lib/orgStore.ts` (lookup part; rollups added in Task 11)
- Create: `amplify/functions/crm-api/lib/contactStore.ts` (read part; upsert added in Task 10)
- Test: `amplify/functions/crm-api/lib/orgStore.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSend = vi.fn();
vi.mock('./dynamodb', () => ({
  docClient: { send: (...a: unknown[]) => mockSend(...a) },
  TABLE_NAME: () => 'T',
}));

import { getOrgIdByDomain, getOrgIdByName } from './orgStore';
import { getContactByEmail } from './contactStore';

beforeEach(() => mockSend.mockReset());

describe('orgStore lookups', () => {
  it('getOrgIdByDomain returns orgId from the ORGDOMAIN index item', async () => {
    mockSend.mockResolvedValueOnce({ Item: { orgId: 'org-1' } });
    expect(await getOrgIdByDomain('diamondfoundry.com')).toBe('org-1');
  });
  it('getOrgIdByDomain returns null when absent', async () => {
    mockSend.mockResolvedValueOnce({});
    expect(await getOrgIdByDomain('unknown.com')).toBeNull();
  });
  it('getOrgIdByName returns orgId from the ORGNAME index item', async () => {
    mockSend.mockResolvedValueOnce({ Item: { orgId: 'org-2' } });
    expect(await getOrgIdByName('diamond foundry inc')).toBe('org-2');
  });
});

describe('contactStore read', () => {
  it('getContactByEmail returns the contact via EMAIL GSI', async () => {
    mockSend.mockResolvedValueOnce({ Items: [{ contactId: 'ct-x', orgId: 'org-1', email: 'a@b.com' }] });
    const c = await getContactByEmail('a@b.com');
    expect(c?.contactId).toBe('ct-x');
  });
  it('getContactByEmail returns null when none', async () => {
    mockSend.mockResolvedValueOnce({ Items: [] });
    expect(await getContactByEmail('a@b.com')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run amplify/functions/crm-api/lib/orgStore.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement the lookups**

`amplify/functions/crm-api/lib/orgStore.ts`:

```typescript
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from './dynamodb';

export async function getOrgIdByDomain(domain: string): Promise<string | null> {
  const res = await docClient.send(new GetCommand({
    TableName: TABLE_NAME(),
    Key: { PK: `ORGDOMAIN#${domain}`, SK: 'A' },
  }));
  return (res.Item?.orgId as string | undefined) ?? null;
}

export async function getOrgIdByName(normName: string): Promise<string | null> {
  const res = await docClient.send(new GetCommand({
    TableName: TABLE_NAME(),
    Key: { PK: `ORGNAME#${normName}`, SK: 'A' },
  }));
  return (res.Item?.orgId as string | undefined) ?? null;
}
```

`amplify/functions/crm-api/lib/contactStore.ts`:

```typescript
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from './dynamodb';
import type { ContactItem } from './types';

export async function getContactByEmail(email: string): Promise<ContactItem | null> {
  const res = await docClient.send(new QueryCommand({
    TableName: TABLE_NAME(),
    IndexName: 'GSI4',
    KeyConditionExpression: 'GSI4PK = :pk AND GSI4SK = :sk',
    ExpressionAttributeValues: { ':pk': `EMAIL#${email}`, ':sk': 'CONTACT#A' },
    Limit: 1,
  }));
  return (res.Items?.[0] as ContactItem | undefined) ?? null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run amplify/functions/crm-api/lib/orgStore.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add amplify/functions/crm-api/lib/orgStore.ts amplify/functions/crm-api/lib/contactStore.ts amplify/functions/crm-api/lib/orgStore.test.ts
git commit -m "feat(crm-api): org domain/name index + contact-by-email lookups"
```

---

## Task 8: `resolveLinks` — org resolution ladder

The crown jewel. Pure orchestration over the Task 4/7 helpers. `input` carries whatever signals a channel has. Returns `ResolveResult`. Org auto-create (`email_domain_new`) returns a *sentinel intent* the emit step acts on (Task 11) — `resolveLinks` itself does not write.

**Files:**
- Create: `amplify/functions/crm-api/lib/resolveLinks.ts`
- Test: `amplify/functions/crm-api/lib/resolveLinks.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const getOrgIdByDomain = vi.fn();
const getOrgIdByName = vi.fn();
const getContactByEmail = vi.fn();
vi.mock('./orgStore', () => ({ getOrgIdByDomain: (d: string) => getOrgIdByDomain(d), getOrgIdByName: (n: string) => getOrgIdByName(n) }));
vi.mock('./contactStore', () => ({ getContactByEmail: (e: string) => getContactByEmail(e) }));

import { resolveLinks } from './resolveLinks';

beforeEach(() => { getOrgIdByDomain.mockReset(); getOrgIdByName.mockReset(); getContactByEmail.mockReset(); });

const base = { sourceEntityType: 'rfq', sourceEntityId: 'rfq-1', channel: 'rfq' as const };

describe('resolveLinks org ladder', () => {
  it('1 manual: explicit linkLocked orgId wins at confidence 1.0', async () => {
    const r = await resolveLinks({ ...base, lockedOrgId: 'org-locked' });
    expect(r).toMatchObject({ orgId: 'org-locked', resolutionReason: 'manual', resolutionStatus: 'manually_linked', confidence: 1.0 });
  });
  it('2 existing_matchedOrgId beats domain', async () => {
    const r = await resolveLinks({ ...base, matchedOrgId: 'org-m', email: 'a@diamondfoundry.com' });
    expect(r).toMatchObject({ orgId: 'org-m', resolutionReason: 'existing_matchedOrgId', confidence: 1.0 });
    expect(getOrgIdByDomain).not.toHaveBeenCalled();
  });
  it('3 contact_email_exact beats domain (the Terry case)', async () => {
    getContactByEmail.mockResolvedValueOnce({ contactId: 'ct-terry', orgId: 'org-df' });
    const r = await resolveLinks({ ...base, email: 'terry@diamondfoundry.com' });
    expect(r).toMatchObject({ orgId: 'org-df', contactId: 'ct-terry', resolutionReason: 'contact_email_exact', confidence: 0.9 });
    expect(getOrgIdByDomain).not.toHaveBeenCalled();
  });
  it('4 email_domain_exact for a corporate domain', async () => {
    getContactByEmail.mockResolvedValueOnce(null);
    getOrgIdByDomain.mockResolvedValueOnce('org-df');
    const r = await resolveLinks({ ...base, email: 'new@diamondfoundry.com' });
    expect(r).toMatchObject({ orgId: 'org-df', resolutionReason: 'email_domain_exact', confidence: 0.95 });
  });
  it('5 email_domain_new: corporate domain with no org → intent to auto-create (strong channel)', async () => {
    getContactByEmail.mockResolvedValueOnce(null);
    getOrgIdByDomain.mockResolvedValueOnce(null);
    const r = await resolveLinks({ ...base, email: 'first@newcorp.com' });
    expect(r).toMatchObject({ resolutionReason: 'email_domain_new', confidence: 0.8 });
    expect(r.orgId).toMatch(/^new-org:newcorp\.com$/); // sentinel intent; emit creates the org
  });
  it('5-guard: email_domain_new is NOT used for analytics-only channel', async () => {
    getContactByEmail.mockResolvedValueOnce(null);
    getOrgIdByDomain.mockResolvedValueOnce(null);
    getOrgIdByName.mockResolvedValueOnce(null);
    const r = await resolveLinks({ sourceEntityType: 'analytics', sourceEntityId: 's1', channel: 'analytics', email: 'first@newcorp.com' });
    expect(r.resolutionReason).not.toBe('email_domain_new');
    expect(r.resolutionStatus).toBe('unresolved');
  });
  it('5-guard: denylisted/free domain never auto-creates', async () => {
    getContactByEmail.mockResolvedValueOnce(null);
    const r = await resolveLinks({ ...base, email: 'someone@gmail.com' });
    expect(r.resolutionReason).not.toBe('email_domain_new');
    expect(getOrgIdByDomain).not.toHaveBeenCalled(); // free domain skips 4–5
  });
  it('6 organization_name_match (exact normalized)', async () => {
    getContactByEmail.mockResolvedValueOnce(null);
    getOrgIdByName.mockResolvedValueOnce('org-nm');
    const r = await resolveLinks({ ...base, organizationName: 'Diamond Foundry, Inc.' });
    expect(r).toMatchObject({ orgId: 'org-nm', resolutionReason: 'organization_name_match', confidence: 0.7 });
  });
  it('7 visitor_prior_event ONLY for analytics', async () => {
    const r = await resolveLinks({ sourceEntityType: 'analytics', sourceEntityId: 's1', channel: 'analytics', priorVisitorOrgId: 'org-v' });
    expect(r).toMatchObject({ orgId: 'org-v', resolutionReason: 'visitor_prior_event', confidence: 0.5 });
  });
  it('7-guard: visitor_prior_event rejected for rfq/lead/order', async () => {
    getContactByEmail.mockResolvedValueOnce(null);
    const r = await resolveLinks({ ...base, priorVisitorOrgId: 'org-v' });
    expect(r.resolutionReason).not.toBe('visitor_prior_event');
    expect(r.resolutionStatus).toBe('unresolved');
  });
  it('8 unresolved: per-event sentinel orgId, never a global bucket', async () => {
    getContactByEmail.mockResolvedValueOnce(null);
    const r = await resolveLinks({ ...base });
    expect(r).toMatchObject({ resolutionReason: 'unresolved', resolutionStatus: 'unresolved', confidence: 0 });
    expect(r.orgId).toBe('unresolved-rfq-rfq-1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run amplify/functions/crm-api/lib/resolveLinks.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`amplify/functions/crm-api/lib/resolveLinks.ts`:

```typescript
import { normalizeEmail, domainOf, normalizeOrgName, isFreeEmailDomain, isDenylistedDomain } from './normalize';
import { getOrgIdByDomain, getOrgIdByName } from './orgStore';
import { getContactByEmail } from './contactStore';
import type { ResolveResult } from './types';

export type ResolveInput = {
  sourceEntityType: string;
  sourceEntityId: string;
  channel: 'analytics' | 'lead' | 'rfq' | 'quote' | 'order' | 'logistics' | 'manual';
  lockedOrgId?: string;        // step 1
  matchedOrgId?: string;       // step 2
  email?: string;              // steps 3–5
  organizationName?: string;   // step 6
  priorVisitorOrgId?: string;  // step 7 (analytics only)
  lockedContactId?: string;
};

const STRONG_CHANNELS = new Set(['rfq', 'lead', 'order', 'quote', 'logistics']);

export async function resolveLinks(input: ResolveInput): Promise<ResolveResult> {
  // 1 — manual lock
  if (input.lockedOrgId) {
    return { orgId: input.lockedOrgId, contactId: input.lockedContactId ?? null, resolutionStatus: 'manually_linked', resolutionReason: 'manual', confidence: 1.0 };
  }
  // 2 — explicit matchedOrgId on the source record
  if (input.matchedOrgId) {
    return { orgId: input.matchedOrgId, contactId: null, resolutionStatus: 'resolved', resolutionReason: 'existing_matchedOrgId', confidence: 1.0 };
  }

  const email = input.email ? normalizeEmail(input.email) : null;
  const domain = email ? domainOf(email) : null;

  // 3 — existing Contact (curated) beats domain logic
  if (email) {
    const contact = await getContactByEmail(email);
    if (contact?.orgId) {
      return { orgId: contact.orgId, contactId: contact.contactId, resolutionStatus: 'resolved', resolutionReason: 'contact_email_exact', confidence: 0.9 };
    }
  }

  // 4 & 5 — domain-based (corporate domains only)
  if (domain && !isFreeEmailDomain(domain)) {
    const orgId = await getOrgIdByDomain(domain);
    if (orgId) {
      return { orgId, contactId: null, resolutionStatus: 'resolved', resolutionReason: 'email_domain_exact', confidence: 0.95 };
    }
    // 5 — auto-create intent: corporate domain, no org, strong channel, not denylisted
    if (STRONG_CHANNELS.has(input.channel) && !isDenylistedDomain(domain)) {
      return { orgId: `new-org:${domain}`, contactId: null, resolutionStatus: 'resolved', resolutionReason: 'email_domain_new', confidence: 0.8 };
    }
  }

  // 6 — exact normalized org-name match
  if (input.organizationName) {
    const orgId = await getOrgIdByName(normalizeOrgName(input.organizationName));
    if (orgId) {
      return { orgId, contactId: null, resolutionStatus: 'resolved', resolutionReason: 'organization_name_match', confidence: 0.7 };
    }
  }

  // 7 — visitor prior event, analytics rollups only
  if (input.channel === 'analytics' && input.priorVisitorOrgId) {
    return { orgId: input.priorVisitorOrgId, contactId: null, resolutionStatus: 'resolved', resolutionReason: 'visitor_prior_event', confidence: 0.5 };
  }

  // 8 — unresolved, per-event sentinel
  return {
    orgId: `unresolved-${input.sourceEntityType}-${input.sourceEntityId}`,
    contactId: null, resolutionStatus: 'unresolved', resolutionReason: 'unresolved', confidence: 0,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run amplify/functions/crm-api/lib/resolveLinks.test.ts`
Expected: PASS (all ladder + guard cases).

- [ ] **Step 5: Commit**

```bash
git add amplify/functions/crm-api/lib/resolveLinks.ts amplify/functions/crm-api/lib/resolveLinks.test.ts
git commit -m "feat(crm-api): resolveLinks org/contact resolution ladder with guards"
```

---

## Task 9: Contact upsert (deterministic id, monotonic lastSeenAt)

**Files:**
- Modify: `amplify/functions/crm-api/lib/contactStore.ts` (add `upsertContact`)
- Test: `amplify/functions/crm-api/lib/contactStore.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSend = vi.fn();
vi.mock('./dynamodb', () => ({ docClient: { send: (...a: unknown[]) => mockSend(...a) }, TABLE_NAME: () => 'T' }));

import { upsertContact } from './contactStore';

beforeEach(() => mockSend.mockReset());

describe('upsertContact', () => {
  it('creates a contact with a deterministic ct- id from the email', async () => {
    mockSend.mockResolvedValueOnce({ Items: [] });           // getContactByEmail
    mockSend.mockResolvedValueOnce({});                      // put
    const id = await upsertContact({ email: 'Terry@DiamondFoundry.com', orgId: 'org-1', source: 'rfq', occurredAt: '2026-06-19T10:00:00Z', name: 'Terry' });
    expect(id).toMatch(/^ct-[0-9a-f]{12}$/);
    const putArg = mockSend.mock.calls[1][0].input;
    expect(putArg.Item.email).toBe('terry@diamondfoundry.com');
    expect(putArg.Item.firstSeenAt).toBe('2026-06-19T10:00:00Z');
  });
  it('advances lastSeenAt monotonically and never overwrites a linkLocked org', async () => {
    mockSend.mockResolvedValueOnce({ Items: [{ contactId: 'ct-x', email: 'a@b.com', orgId: 'org-OLD', linkLocked: true, firstSeenAt: '2026-01-01T00:00:00Z', lastSeenAt: '2026-01-01T00:00:00Z' }] });
    mockSend.mockResolvedValueOnce({}); // put
    await upsertContact({ email: 'a@b.com', orgId: 'org-NEW', source: 'lead', occurredAt: '2026-06-01T00:00:00Z' });
    const putArg = mockSend.mock.calls[1][0].input;
    expect(putArg.Item.orgId).toBe('org-OLD');           // locked → unchanged
    expect(putArg.Item.lastSeenAt).toBe('2026-06-01T00:00:00Z'); // advanced
    expect(putArg.Item.firstSeenAt).toBe('2026-01-01T00:00:00Z'); // preserved
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run amplify/functions/crm-api/lib/contactStore.test.ts`
Expected: FAIL — `upsertContact` not exported.

- [ ] **Step 3: Implement**

Add to `amplify/functions/crm-api/lib/contactStore.ts`:

```typescript
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { normalizeEmail } from './normalize';
import { contactKeys, contactIdForEmail } from './keys';

export async function upsertContact(args: {
  email: string; orgId: string; source: string; occurredAt: string;
  name?: string; title?: string; role?: string; phone?: string;
}): Promise<string> {
  const email = normalizeEmail(args.email);
  const existing = await getContactByEmail(email);
  const contactId = existing?.contactId ?? contactIdForEmail(email);
  const now = args.occurredAt;

  const orgId = existing?.linkLocked ? existing.orgId : args.orgId;
  const firstSeenAt = existing?.firstSeenAt && existing.firstSeenAt < now ? existing.firstSeenAt : now;
  const lastSeenAt = existing?.lastSeenAt && existing.lastSeenAt > now ? existing.lastSeenAt : now;

  const item = {
    ...contactKeys({ contactId, email, orgId }),
    entityType: 'CONTACT' as const,
    contactId, email, orgId, source: existing?.source ?? args.source,
    name: args.name ?? existing?.name ?? null,
    title: args.title ?? existing?.title ?? null,
    role: args.role ?? existing?.role ?? null,
    phone: args.phone ?? existing?.phone ?? null,
    linkLocked: existing?.linkLocked ?? false,
    firstSeenAt, lastSeenAt,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  await docClient.send(new PutCommand({ TableName: TABLE_NAME(), Item: item }));
  return contactId;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run amplify/functions/crm-api/lib/contactStore.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add amplify/functions/crm-api/lib/contactStore.ts amplify/functions/crm-api/lib/contactStore.test.ts
git commit -m "feat(crm-api): upsertContact with deterministic id + monotonic lastSeenAt + lock guard"
```

---

## Task 10: Org rollups — bump-on-create (monotonic) + recompute

**Files:**
- Modify: `amplify/functions/crm-api/lib/orgStore.ts` (add `bumpOrgRollupOnCreate`, `recomputeRollupsForOrg`)
- Test: `amplify/functions/crm-api/lib/orgRollups.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSend = vi.fn();
vi.mock('./dynamodb', () => ({ docClient: { send: (...a: unknown[]) => mockSend(...a) }, TABLE_NAME: () => 'T' }));

import { bumpOrgRollupOnCreate, recomputeRollupsForOrg } from './orgStore';

beforeEach(() => mockSend.mockReset());

describe('bumpOrgRollupOnCreate', () => {
  it('increments the matching count and advances lastActivityAt with if_not_exists/max semantics', async () => {
    mockSend.mockResolvedValueOnce({});
    await bumpOrgRollupOnCreate({ orgId: 'org-1', kind: 'order_created', occurredAt: '2026-06-19T10:00:00Z' });
    const upd = mockSend.mock.calls[0][0].input;
    expect(upd.Key).toEqual({ PK: 'ORG#org-1', SK: 'A' });
    expect(upd.UpdateExpression).toMatch(/orderCount/);
    expect(JSON.stringify(upd.ExpressionAttributeValues)).toContain('2026-06-19T10:00:00Z');
  });
  it('does nothing for an unresolved sentinel org', async () => {
    await bumpOrgRollupOnCreate({ orgId: 'unresolved-rfq-1', kind: 'rfq_submitted', occurredAt: '2026-01-01T00:00:00Z' });
    expect(mockSend).not.toHaveBeenCalled();
  });
});

describe('recomputeRollupsForOrg', () => {
  it('re-derives counts + latest dates from the org timeline (GSI2)', async () => {
    mockSend.mockResolvedValueOnce({ Items: [
      { kind: 'rfq_submitted', occurredAt: '2026-01-01T00:00:00Z' },
      { kind: 'order_created', occurredAt: '2026-03-01T00:00:00Z' },
      { kind: 'order_stage_changed', occurredAt: '2026-04-01T00:00:00Z' },
    ] });
    mockSend.mockResolvedValueOnce({}); // update
    await recomputeRollupsForOrg('org-1');
    const upd = mockSend.mock.calls[1][0].input;
    expect(JSON.stringify(upd.ExpressionAttributeValues)).toContain('2026-04-01T00:00:00Z'); // lastActivityAt = max
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run amplify/functions/crm-api/lib/orgRollups.test.ts`
Expected: FAIL — functions not exported.

- [ ] **Step 3: Implement**

Add to `amplify/functions/crm-api/lib/orgStore.ts`:

```typescript
import { UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

const KIND_TO_COUNT: Record<string, string> = {
  rfq_submitted: 'rfqCount',
  order_created: 'orderCount',
  lead_captured: 'leadCount',
};
const KIND_TO_LATEST: Record<string, string> = {
  rfq_submitted: 'latestRFQDate',
  order_created: 'latestOrderDate',
  lead_captured: 'latestLeadDate',
};

function isRealOrg(orgId: string): boolean {
  return !orgId.startsWith('unresolved-') && !orgId.startsWith('new-org:');
}

export async function bumpOrgRollupOnCreate(args: { orgId: string; kind: string; occurredAt: string }): Promise<void> {
  if (!isRealOrg(args.orgId)) return;
  const countAttr = KIND_TO_COUNT[args.kind];
  const latestAttr = KIND_TO_LATEST[args.kind];

  const sets: string[] = ['lastActivityAt = :maxLast'];
  const values: Record<string, unknown> = { ':occ': args.occurredAt, ':zero': 0, ':one': 1 };
  // lastActivityAt = max(existing, occurredAt) via if_not_exists then app-side guard is hard in one expr;
  // use a conditional: only advance when newer.
  const names: Record<string, string> = {};

  let expr = 'SET lastActivityAt = :occ';
  let condition = 'attribute_not_exists(lastActivityAt) OR lastActivityAt < :occ';

  if (countAttr) {
    expr += `, ${countAttr} = if_not_exists(${countAttr}, :zero) + :one`;
  }
  if (latestAttr) {
    expr += `, ${latestAttr} = :occ`;
  }

  try {
    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME(),
      Key: { PK: `ORG#${args.orgId}`, SK: 'A' },
      UpdateExpression: expr,
      ConditionExpression: condition,
      ExpressionAttributeValues: { ':occ': args.occurredAt, ':zero': 0, ':one': 1 },
    }));
  } catch (err: unknown) {
    // ConditionalCheckFailed = an older event; still need to bump the count without touching dates.
    if ((err as { name?: string }).name === 'ConditionalCheckFailedException' && countAttr) {
      await docClient.send(new UpdateCommand({
        TableName: TABLE_NAME(),
        Key: { PK: `ORG#${args.orgId}`, SK: 'A' },
        UpdateExpression: `SET ${countAttr} = if_not_exists(${countAttr}, :zero) + :one`,
        ExpressionAttributeValues: { ':zero': 0, ':one': 1 },
      }));
    } else if ((err as { name?: string }).name !== 'ConditionalCheckFailedException') {
      throw err;
    }
  }
}

export async function recomputeRollupsForOrg(orgId: string): Promise<void> {
  if (!isRealOrg(orgId)) return;
  const res = await docClient.send(new QueryCommand({
    TableName: TABLE_NAME(),
    IndexName: 'GSI2',
    KeyConditionExpression: 'GSI2PK = :pk AND begins_with(GSI2SK, :pfx)',
    ExpressionAttributeValues: { ':pk': `ORG#${orgId}`, ':pfx': 'TLEVENT#' },
  }));
  const events = (res.Items ?? []) as Array<{ kind: string; occurredAt: string; voided?: boolean }>;
  const live = events.filter((e) => !e.voided);

  const counts = { rfqCount: 0, orderCount: 0, leadCount: 0 };
  const latest: Record<string, string | null> = { latestRFQDate: null, latestOrderDate: null, latestLeadDate: null };
  let lastActivityAt: string | null = null;

  for (const e of live) {
    if (e.occurredAt && (!lastActivityAt || e.occurredAt > lastActivityAt)) lastActivityAt = e.occurredAt;
    const c = KIND_TO_COUNT[e.kind]; if (c) (counts as Record<string, number>)[c] += 1;
    const l = KIND_TO_LATEST[e.kind];
    if (l && (!latest[l] || e.occurredAt > (latest[l] as string))) latest[l] = e.occurredAt;
  }

  await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME(),
    Key: { PK: `ORG#${orgId}`, SK: 'A' },
    UpdateExpression: 'SET rfqCount = :r, orderCount = :o, leadCount = :l, latestRFQDate = :lr, latestOrderDate = :lo, latestLeadDate = :ll, lastActivityAt = :la',
    ExpressionAttributeValues: {
      ':r': counts.rfqCount, ':o': counts.orderCount, ':l': counts.leadCount,
      ':lr': latest.latestRFQDate, ':lo': latest.latestOrderDate, ':ll': latest.latestLeadDate,
      ':la': lastActivityAt,
    },
  }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run amplify/functions/crm-api/lib/orgRollups.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add amplify/functions/crm-api/lib/orgStore.ts amplify/functions/crm-api/lib/orgRollups.test.ts
git commit -m "feat(crm-api): org rollups — monotonic bump-on-create + full recompute"
```

---

## Task 11: `emitTimelineEvent` orchestration (idempotent)

Ties it together: resolve → upsert contact (if email) → conditional-put the event (idempotent on the deterministic id) → bump rollups only when the event is newly created.

**Files:**
- Create: `amplify/functions/crm-api/lib/emitTimelineEvent.ts`
- Test: `amplify/functions/crm-api/lib/emitTimelineEvent.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSend = vi.fn();
vi.mock('./dynamodb', () => ({ docClient: { send: (...a: unknown[]) => mockSend(...a) }, TABLE_NAME: () => 'T' }));
const resolveLinks = vi.fn();
vi.mock('./resolveLinks', () => ({ resolveLinks: (i: unknown) => resolveLinks(i) }));
const upsertContact = vi.fn();
vi.mock('./contactStore', () => ({ upsertContact: (a: unknown) => upsertContact(a), getContactByEmail: vi.fn() }));
const bumpOrgRollupOnCreate = vi.fn();
vi.mock('./orgStore', () => ({ bumpOrgRollupOnCreate: (a: unknown) => bumpOrgRollupOnCreate(a), getOrgIdByDomain: vi.fn(), getOrgIdByName: vi.fn(), recomputeRollupsForOrg: vi.fn() }));

import { emitTimelineEvent } from './emitTimelineEvent';

beforeEach(() => { mockSend.mockReset(); resolveLinks.mockReset(); upsertContact.mockReset(); bumpOrgRollupOnCreate.mockReset(); });

const evt = {
  source: 'rfq' as const, kind: 'rfq_submitted', sourceEntityType: 'rfq', sourceEntityId: 'rfq-1',
  occurredAt: '2026-06-19T10:00:00Z', summary: 'Submitted RFQ for ICP-1000W',
  idInput: { kind: 'rfq_submitted', rfqId: 'rfq-1' } as const,
  resolveInput: { sourceEntityType: 'rfq', sourceEntityId: 'rfq-1', channel: 'rfq' as const, email: 'terry@diamondfoundry.com' },
};

describe('emitTimelineEvent', () => {
  it('resolves, upserts contact, puts the event with the deterministic id, then bumps rollups', async () => {
    resolveLinks.mockResolvedValueOnce({ orgId: 'org-df', contactId: null, resolutionStatus: 'resolved', resolutionReason: 'email_domain_exact', confidence: 0.95 });
    upsertContact.mockResolvedValueOnce('ct-terry');
    mockSend.mockResolvedValueOnce({}); // conditional put succeeds (new)
    await emitTimelineEvent(evt);
    const put = mockSend.mock.calls[0][0].input;
    expect(put.Item.PK).toBe('TLEVENT#tev-rfq-rfq-1-submitted');
    expect(put.Item.orgId).toBe('org-df');
    expect(put.Item.contactId).toBe('ct-terry');
    expect(put.ConditionExpression).toMatch(/attribute_not_exists/);
    expect(bumpOrgRollupOnCreate).toHaveBeenCalledWith(expect.objectContaining({ orgId: 'org-df', kind: 'rfq_submitted' }));
  });
  it('is idempotent: a duplicate (ConditionalCheckFailed) does NOT bump rollups', async () => {
    resolveLinks.mockResolvedValueOnce({ orgId: 'org-df', contactId: null, resolutionStatus: 'resolved', resolutionReason: 'email_domain_exact', confidence: 0.95 });
    upsertContact.mockResolvedValueOnce('ct-terry');
    mockSend.mockRejectedValueOnce(Object.assign(new Error('dup'), { name: 'ConditionalCheckFailedException' }));
    mockSend.mockResolvedValueOnce({}); // the update-existing path (refresh summary)
    await emitTimelineEvent(evt);
    expect(bumpOrgRollupOnCreate).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run amplify/functions/crm-api/lib/emitTimelineEvent.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`amplify/functions/crm-api/lib/emitTimelineEvent.ts`:

```typescript
import { PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from './dynamodb';
import { timelineId, type TimelineIdInput } from './timelineId';
import { timelineEventKeys } from './keys';
import { resolveLinks, type ResolveInput } from './resolveLinks';
import { upsertContact } from './contactStore';
import { bumpOrgRollupOnCreate } from './orgStore';
import type { TimelineSource } from './types';

export type EmitArgs = {
  source: TimelineSource;
  kind: string;
  sourceEntityType: string;
  sourceEntityId: string;
  occurredAt: string;
  summary: string;
  idInput: TimelineIdInput;
  resolveInput: ResolveInput;
  isInternalOnly?: boolean;
  createdBy?: string | null;
  payload?: Record<string, unknown> | null;
  contactEmail?: string;   // when set + resolution gave an org, upsert/attach contact
};

export async function emitTimelineEvent(args: EmitArgs): Promise<void> {
  const id = timelineId(args.idInput);
  const resolved = await resolveLinks(args.resolveInput);

  let contactId = resolved.contactId;
  if (args.contactEmail && !resolved.orgId.startsWith('unresolved-') && !resolved.orgId.startsWith('new-org:')) {
    contactId = await upsertContact({ email: args.contactEmail, orgId: resolved.orgId, source: args.source, occurredAt: args.occurredAt });
  }

  const now = new Date().toISOString();
  const item = {
    ...timelineEventKeys({
      id, orgId: resolved.orgId, contactId, occurredAt: args.occurredAt,
      resolutionStatus: resolved.resolutionStatus, sourceEntityType: args.sourceEntityType, sourceEntityId: args.sourceEntityId,
    }),
    entityType: 'TIMELINE_EVENT' as const,
    id, orgId: resolved.orgId, resolutionStatus: resolved.resolutionStatus,
    resolutionReason: resolved.resolutionReason, confidence: resolved.confidence,
    contactId: contactId ?? null, occurredAt: args.occurredAt,
    source: args.source, kind: args.kind, summary: args.summary,
    sourceEntityType: args.sourceEntityType, sourceEntityId: args.sourceEntityId,
    isInternalOnly: args.isInternalOnly ?? false, voided: false,
    createdBy: args.createdBy ?? null, payload: args.payload ?? null,
    direction: null, externalId: null, threadId: null,
    createdAt: now, updatedAt: now,
  };

  try {
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME(),
      Item: item,
      ConditionExpression: 'attribute_not_exists(PK)',
    }));
    // newly created → bump rollups exactly once
    await bumpOrgRollupOnCreate({ orgId: resolved.orgId, kind: args.kind, occurredAt: args.occurredAt });
  } catch (err: unknown) {
    if ((err as { name?: string }).name !== 'ConditionalCheckFailedException') throw err;
    // already exists → idempotent update of mutable fields only; NO rollup bump
    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME(),
      Key: { PK: `TLEVENT#${id}`, SK: 'A' },
      UpdateExpression: 'SET summary = :s, updatedAt = :u',
      ExpressionAttributeValues: { ':s': args.summary, ':u': now },
    }));
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run amplify/functions/crm-api/lib/emitTimelineEvent.test.ts`
Expected: PASS (create path bumps; duplicate path does not).

- [ ] **Step 5: Commit**

```bash
git add amplify/functions/crm-api/lib/emitTimelineEvent.ts amplify/functions/crm-api/lib/emitTimelineEvent.test.ts
git commit -m "feat(crm-api): emitTimelineEvent — idempotent resolve→contact→put→rollup"
```

---

## Task 12: Schema types in `data/resource.ts` (no queries yet)

Add the `TimelineEvent`, `Contact`, and `LinkAuditLog` `a.customType`s so Plans 2/3 can reference them in queries/mutations. Import `crmApi` (used by those later queries). No queries/mutations are added in this plan — this keeps the deploy green without exposing an unfinished API.

**Files:**
- Modify: `amplify/data/resource.ts`
- Test: `amplify/functions/crm-api/schema-shape.test.ts` (a lightweight compile/shape guard)

- [ ] **Step 1: Write the failing test**

Create `amplify/functions/crm-api/schema-shape.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const src = readFileSync(resolve(__dirname, '../../data/resource.ts'), 'utf8');

describe('data schema includes CRM customTypes', () => {
  it('defines TimelineEvent, Contact, LinkAuditLog', () => {
    expect(src).toMatch(/TimelineEvent:\s*a\.customType/);
    expect(src).toMatch(/Contact:\s*a\.customType/);
    expect(src).toMatch(/LinkAuditLog:\s*a\.customType/);
  });
  it('imports the crmApi function resource', () => {
    expect(src).toMatch(/import\s*\{\s*crmApi\s*\}\s*from\s*'\.\.\/functions\/crm-api\/resource'/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run amplify/functions/crm-api/schema-shape.test.ts`
Expected: FAIL — patterns not found.

- [ ] **Step 3: Add the customTypes + import**

In `amplify/data/resource.ts`, add near the other function imports (top):

```typescript
import { crmApi } from '../functions/crm-api/resource';
```

Add these customTypes alongside the others (e.g. after `CustomerTimelineEntry`, before `Organization`):

```typescript
  TimelineEvent: a.customType({
    id: a.id().required(),
    orgId: a.string().required(),
    resolutionStatus: a.string().required(),
    resolutionReason: a.string().required(),
    confidence: a.float().required(),
    contactId: a.string(),
    occurredAt: a.datetime().required(),
    source: a.string().required(),
    kind: a.string().required(),
    summary: a.string().required(),
    sourceEntityType: a.string().required(),
    sourceEntityId: a.string().required(),
    isInternalOnly: a.boolean().required(),
    voided: a.boolean().required(),
    createdBy: a.string(),
    payload: a.json(),
    direction: a.string(),
    externalId: a.string(),
    threadId: a.string(),
    createdAt: a.datetime(),
    updatedAt: a.datetime(),
  }),

  Contact: a.customType({
    contactId: a.id().required(),
    email: a.string().required(),
    name: a.string(),
    title: a.string(),
    role: a.string(),
    phone: a.string(),
    orgId: a.string().required(),
    source: a.string(),
    firstSeenAt: a.datetime(),
    lastSeenAt: a.datetime(),
    linkLocked: a.boolean(),
    createdAt: a.datetime(),
    updatedAt: a.datetime(),
  }),

  LinkAuditLog: a.customType({
    id: a.id().required(),
    timelineEventId: a.string(),
    contactId: a.string(),
    orgId: a.string(),
    oldOrgId: a.string(),
    newOrgId: a.string(),
    oldContactId: a.string(),
    newContactId: a.string(),
    operator: a.string().required(),
    reason: a.string().required(),
    timestamp: a.datetime().required(),
  }),
```

> The `crmApi` import is intentionally unused until Plan 2/3 wire queries. If the repo's lint fails on unused imports for `amplify/data/resource.ts`, defer the import line to Plan 2 instead — verify with Step 5.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run amplify/functions/crm-api/schema-shape.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck + lint the data resource**

Run: `npx tsc --noEmit -p amplify/tsconfig.json && npx eslint amplify/data/resource.ts`
Expected: PASS. If eslint flags the unused `crmApi` import, remove that import line (move it to Plan 2) and re-run Step 4 — adjust the second assertion in the test to not require the import yet.

- [ ] **Step 6: Commit**

```bash
git add amplify/data/resource.ts amplify/functions/crm-api/schema-shape.test.ts
git commit -m "feat(data): add TimelineEvent/Contact/LinkAuditLog customTypes (no queries yet)"
```

---

## Task 13: Foundation green-bar + branch checkpoint

- [ ] **Step 1: Run the full crm-api suite**

Run: `npx vitest run amplify/functions/crm-api amplify/functions/order-api amplify/functions/logistics-api`
Expected: PASS — all foundation + prereq tests green, no regressions in order/logistics suites.

- [ ] **Step 2: Typecheck the whole amplify backend**

Run: `npx tsc --noEmit -p amplify/tsconfig.json`
Expected: PASS.

- [ ] **Step 3: Commit a checkpoint marker (if any uncommitted formatting remains)**

```bash
git status
git add -A && git commit -m "chore(crm-api): P1 foundation complete — resolver + emit + storage, fully unit-tested" || echo "nothing to commit"
```

---

## Self-Review (against the spec)

**Spec coverage (Plan 1 scope only — channel wiring/backfill/UI are Plans 2–3):**
- §3.1 `TimelineEvent` shape + GSIs → Tasks 6, 12. ✓
- §3.2 `Contact` lightweight + email-derived id + P2-merge note → Tasks 6, 9 (`contactIdForEmail`). ✓
- §3.3 `Organization` rollup additions → Task 10 (counts/dates); `primaryContactId`/`linkLocked`/`createdByResolution` columns are written by Plan 2's org create/merge — noted there. ✓ (carry-forward)
- §3.4 `LinkAuditLog` type → Task 12; *writing* audit rows happens on re-link → Plan 3. ✓ (carry-forward)
- §3.5 deterministic ids w/ stable keys + legacy fallback → Tasks 1, 2, 5. ✓
- §4.1 resolution ladder + ordering + guards (free-domain, analytics-only auto-create, visitor_prior_event scope) → Task 8. ✓
- §4.2 contact resolution → Tasks 8, 9. ✓
- §4.3 analytics session rollup definition → the `site_visit_session` id exists (Task 5); the 30-min close job is Plan 2. ✓ (carry-forward)
- §5.1 emit helper → Task 11. ✓
- §5.3.2/.4/.5 idempotency, count-on-create, monotonic rollups → Tasks 10, 11. ✓
- §10.1 stable-id prerequisite → Tasks 1, 2, 5. ✓
- §10.2 re-link recompute → `recomputeRollupsForOrg` built in Task 10; *invoked* on re-link in Plan 3. ✓ (carry-forward)
- §10.8 contact-merge anticipation → Task 6 note + §3.2. ✓

**Deferred to later plans (intentional, not gaps):** channel emit wiring (§5.2), backfill job (§6), sweep (§7.2), queues + re-link + audit writes (§7.3), 360 UI + server-side `internalOnly` (§8.1), CRM Health (§7.4). These require Plan 1's interfaces and are tracked as Plans 2 & 3.

**Placeholder scan:** none — every code step has complete code and a runnable command.

**Type consistency:** `ResolveResult`/`ResolveInput` (Task 6/8), `EmitArgs.idInput: TimelineIdInput` (Task 5/11), `timelineEventKeys`/`contactKeys` signatures (Task 6) are referenced consistently in Tasks 8–11. `contactIdForEmail` (Task 6) used by Task 9. `bumpOrgRollupOnCreate`/`recomputeRollupsForOrg` (Task 10) used by Task 11/Plan 3.

---

## Plans 2 & 3 (outline — separate plan docs to be written next)

**Plan 2 — Channel wiring + backfill + sweep:**
- Wire `emitTimelineEvent` into each channel after its source commit: `order-api` (created/stage/quote-doc), RFQ + Lead submit paths, `logistics-api` (milestone), and a scheduled **analytics session rollup** (30-min inactivity close, one `site_visit_session` per `sessionId`, signal threshold).
- `OrgDomainIndex`/`OrgNameIndex` maintenance on org create/alias + `createdByResolution`/`status=review` on `email_domain_new` auto-create.
- Paginated `runTimelineBackfill` mutation (`{nextCursor,processedCount,hasMore}`) + `scripts/backfill-timeline.ts` driver + dry-run report.
- Two-tier reconciliation sweep (hot 15-min / cold daily), existence-based, guarded `if (!isSandbox)`.

**Plan 3 — Admin UI + linking/audit:**
- Upgrade `OrganizationDetailPage`/`OrgDetail` to read `byOrg` `TimelineEvent`; resolution badges; **server-side `internalOnly` enforcement** (default-exclude, admin `includeInternalOnly=true`).
- Manual `note`/`call`/`email_manual` entry (`crm-api` mutation).
- Needs-Linking + Review-New-Orgs queues; re-link → `manually_linked`+`linkLocked`, `recomputeRollupsForOrg(old)+(new)`, **write `LinkAuditLog`**; bulk apply-to-domain corporate-only.
- CRM Health panel.
