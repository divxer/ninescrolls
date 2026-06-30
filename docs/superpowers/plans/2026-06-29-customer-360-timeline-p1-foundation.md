# Customer 360 Timeline — P1 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the trustworthy data foundation for the Customer 360 Timeline — `TimelineEvent`/`Contact`/`LinkAuditLog` storage, the shared `resolveLinks` resolver (incl. review-org auto-create), the idempotent `emitTimelineEvent` helper, and rollup helpers — fully unit-tested in isolation, with no channel wiring or UI yet.

**Architecture:** A new `crm-api` Amplify Gen 2 Lambda mirrors `order-api`/`logistics-api` (SDK v3 `DocumentClient`, dispatch-on-`fieldName`, `lib/` + `resolvers/`, vitest). All entities live in the existing shared `INTELLIGENCE_TABLE` single-table design, reusing GSI1–GSI4. Source tables stay authoritative; every meaningful interaction is materialized into a `TimelineEvent` carrying a resolved `orgId`/`contactId`. This plan delivers the library + storage; Plans 2 (channel wiring + backfill + sweep) and 3 (admin UI + queues) build on its interfaces.

**Tech Stack:** TypeScript (Node 22), AWS SDK v3 (`@aws-sdk/lib-dynamodb`), Amplify Gen 2, vitest. Spec: `docs/superpowers/specs/2026-06-29-customer-360-timeline-p1-design.md`.

**Conventions confirmed from the codebase:**
- Shared table env var: `process.env.INTELLIGENCE_TABLE`, keys `PK`/`SK`.
- GSIs (ALL projection): `GSI1PK` (status listing), `GSI2PK=ORG#{orgId}` (org timeline), `GSI3PK` (entity association), `GSI4PK=EMAIL#{email}` (email/contact).
- Lambda layout: `amplify/functions/<name>/{handler.ts,resource.ts,lib/{dynamodb,idGenerators,types}.ts,resolvers/*.ts}`.
- Tests: vitest, `vi.mock` the SDK, `*.test.ts` next to source. Run from repo root: `npx vitest run <path>`.

**Single-table key map for new entities (reference for all tasks):**

| Entity | PK | SK | GSI1 | GSI2 | GSI3 | GSI4 |
|---|---|---|---|---|---|---|
| `TimelineEvent` | `TLEVENT#{id}` | `A` | **only when `unresolved`**: `TLEVENT_STATUS#unresolved` / `{occurredAt}#{id}` | `ORG#{orgId}` / `TLEVENT#{occurredAt}#{id}` | `SRC#{sourceEntityType}#{sourceEntityId}` / `TLEVENT#{occurredAt}#{id}` | only when contactId: `CONTACT#{contactId}` / `TLEVENT#{occurredAt}#{id}` |
| `Contact` | `CONTACT#{contactId}` | `A` | — | `ORG#{orgId}` / `CONTACT#{email}` | — | `EMAIL#{email}` / `CONTACT#A` |
| `Organization` (auto-created) | `ORG#{orgId}` | `A` | `ORG_STATUS#review` / `{createdAt}#{orgId}` | — | — | — |
| `OrgDomainIndex` | `ORGDOMAIN#{domain}` | `A` | — | — | — | — |
| `OrgNameIndex` | `ORGNAME#{normName}` | `A` | — | — | — | — |
| `LinkAuditLog` | `AUDIT#{id}` | `A` | — | `ORG#{orgId}` / `AUDIT#{ts}#{id}` | — | — |

> **GSI1 is intentionally sparse** (fix from review): only `unresolved` TimelineEvents are indexed, so the Needs-Linking queue is a small partition. Resolved events are never indexed by status (no `TLEVENT_STATUS#resolved` hot partition). Review-org listing uses the `Organization` `ORG_STATUS#review` index, not TimelineEvent status.
> `OrgDomainIndex` doubles as the **race-safe claim key** for auto-create (Task 10), which **also writes an `OrgNameIndex` row** for the new review org (so `organization_name_match` works without waiting for Plan 2). Existing (non-auto-created) orgs get their domain/name index rows from the `organizationApi` create/alias path + Plan 2 backfill.

---

## File Structure

**New — `amplify/functions/crm-api/`:**
- `resource.ts` — `defineFunction` (Node 22, 30s, 512MB).
- `lib/dynamodb.ts` — `docClient` + `TABLE_NAME()`.
- `lib/idGenerators.ts` — `generateOrgId()`, `generateAuditId()`.
- `lib/normalize.ts` — email/domain/name normalization, free-domain set, denylist.
- `lib/timelineId.ts` — deterministic `TimelineEvent` id derivation (§3.5) + legacy fallbacks.
- `lib/keys.ts` — PK/SK/GSI key builders + `contactIdForEmail`, `auditKeys`.
- `lib/types.ts` — item + domain interfaces, enums.
- `lib/contactStore.ts` — `getContactByEmail`, `upsertContact`.
- `lib/orgStore.ts` — `getOrgIdByDomain`/`ByName`, `createReviewOrgFromDomain`, `bumpOrgRollupOnCreate`, `recomputeRollupsForOrg`.
- `lib/timelineStore.ts` — `getTimelineEvent`.
- `lib/auditStore.ts` — `writeLinkAuditLog`.
- `lib/resolveLinks.ts` — the resolution ladder (pure; no writes).
- `lib/emitTimelineEvent.ts` — orchestration (resolve → auto-create org → upsert contact → idempotent put → rollup w/ `rollupApplied` guard → full-projection update on re-emit).
- `handler.ts` — dispatch-on-`fieldName` skeleton (no fields wired until Plan 2/3).
- Test files alongside each `lib/*.ts`.

**Modified:**
- `amplify/backend.ts` — register `crmApi`, grant table + env (mirror logistics-api block at `:524-526`).
- `amplify/data/resource.ts` — add `TimelineEvent`/`Contact`/`LinkAuditLog` `a.customType`s (types only).
- `amplify/functions/order-api/lib/types.ts` + OrderLog append site — add stable `id`.
- `amplify/functions/logistics-api/lib/types.ts` + milestone-append resolver — add stable `id`.

---

## Task 1: Add stable `id` to OrderLog entries (§10.1 prerequisite)

Deterministic `order_stage_changed` ids key off a stable per-log id. `OrderLog` entries have none. Add `id` to newly written entries. (Legacy entries without `id` are handled by the fallback hash in Task 5 — no migration.)

**Files:**
- Modify: `amplify/functions/order-api/lib/idGenerators.ts`
- Modify: `amplify/functions/order-api/lib/types.ts` (`LogItem`, ~`:115`)
- Modify: `amplify/functions/order-api/resolvers/updateOrderStatus.ts`
- Test: `amplify/functions/order-api/lib/idGenerators.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { generateLogId } from './idGenerators';

describe('generateLogId', () => {
  it('produces an olog- prefixed id', () => {
    expect(generateLogId()).toMatch(/^olog-[0-9a-f]{12}$/);
  });
  it('is unique across calls', () => {
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

- [ ] **Step 5: Add `id` to `LogItem` + stamp it on write**

In `amplify/functions/order-api/lib/types.ts`, add to `LogItem`:

```typescript
    id?: string; // stable per-entry id (olog-...). Optional: legacy entries predate this field.
```

In `amplify/functions/order-api/resolvers/updateOrderStatus.ts`, import `generateLogId` and set `id: generateLogId()` on the log object that uses `SK: \`LOG#${timestamp}\``.

- [ ] **Step 6: Run the order-api suite**

Run: `npx vitest run amplify/functions/order-api`
Expected: PASS (additive field, no regressions).

- [ ] **Step 7: Commit**

```bash
git add amplify/functions/order-api/lib/idGenerators.ts amplify/functions/order-api/lib/idGenerators.test.ts amplify/functions/order-api/lib/types.ts amplify/functions/order-api/resolvers/updateOrderStatus.ts
git commit -m "feat(order-api): add stable id to OrderLog entries (crm timeline prereq)"
```

---

## Task 2: Add stable `id` to LogisticsLogEntry entries (§10.1 prerequisite)

**Files:**
- Modify: `amplify/functions/logistics-api/lib/idGenerators.ts`
- Modify: `amplify/functions/logistics-api/lib/types.ts` (`LogisticsLogEntry`, ~`:40-48`)
- Modify: `amplify/functions/logistics-api/resolvers/advanceLogisticsStage.ts`
- Test: `amplify/functions/logistics-api/lib/idGenerators.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { generateMilestoneId } from './idGenerators';

describe('generateMilestoneId', () => {
  it('produces an mlog- prefixed id', () => {
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

Append to `amplify/functions/logistics-api/lib/idGenerators.ts` (file already imports `crypto`):

```typescript
export function generateMilestoneId(): string {
    return `mlog-${crypto.randomBytes(6).toString('hex')}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run amplify/functions/logistics-api/lib/idGenerators.test.ts`
Expected: PASS.

- [ ] **Step 5: Add `id` to `LogisticsLogEntry` + stamp it**

In `amplify/functions/logistics-api/lib/types.ts`, add to `LogisticsLogEntry`:

```typescript
    id?: string; // stable per-entry id (mlog-...). Optional: legacy entries predate this field.
```

In `amplify/functions/logistics-api/resolvers/advanceLogisticsStage.ts`, where the `LogisticsLogEntry` is built for `list_append` into `milestoneLog`, set `id: generateMilestoneId()`.

- [ ] **Step 6: Run the logistics-api suite**

Run: `npx vitest run amplify/functions/logistics-api`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add amplify/functions/logistics-api/lib/idGenerators.ts amplify/functions/logistics-api/lib/idGenerators.test.ts amplify/functions/logistics-api/lib/types.ts amplify/functions/logistics-api/resolvers/advanceLogisticsStage.ts
git commit -m "feat(logistics-api): add stable id to milestone log entries (crm timeline prereq)"
```

---

## Task 3: Scaffold the `crm-api` Lambda

**Files:**
- Create: `amplify/functions/crm-api/resource.ts`, `lib/dynamodb.ts`, `lib/idGenerators.ts`, `handler.ts`
- Modify: `amplify/backend.ts`
- Test: `amplify/functions/crm-api/handler.test.ts`, `lib/idGenerators.test.ts`

- [ ] **Step 1: Write the failing tests**

`amplify/functions/crm-api/handler.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { handler } from './handler';

describe('crm-api handler', () => {
  it('throws for an unknown fieldName', async () => {
    const event = { info: { fieldName: 'nope', parentTypeName: 'Query' }, arguments: {} };
    await expect(handler(event as never)).rejects.toThrow(/unknown.*nope/i);
  });
});
```

`amplify/functions/crm-api/lib/idGenerators.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { generateOrgId, generateAuditId } from './idGenerators';

describe('crm-api id generators', () => {
  it('generateOrgId is org- prefixed and date-stamped', () => {
    expect(generateOrgId()).toMatch(/^org-\d{8}-[0-9a-f]{4}$/);
  });
  it('generateAuditId is audit- prefixed', () => {
    expect(generateAuditId()).toMatch(/^audit-[0-9a-f]{12}$/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run amplify/functions/crm-api/handler.test.ts amplify/functions/crm-api/lib/idGenerators.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Create lib + handler + resource**

`amplify/functions/crm-api/lib/dynamodb.ts`:

```typescript
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const ddbClient = new DynamoDBClient({});
export const docClient = DynamoDBDocumentClient.from(ddbClient);
export const TABLE_NAME = () => process.env.INTELLIGENCE_TABLE!;
```

`amplify/functions/crm-api/lib/idGenerators.ts`:

```typescript
import crypto from 'node:crypto';

export function generateOrgId(): string {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `org-${date}-${crypto.randomBytes(2).toString('hex')}`;
}

export function generateAuditId(): string {
    return `audit-${crypto.randomBytes(6).toString('hex')}`;
}
```

`amplify/functions/crm-api/handler.ts`:

```typescript
type AppSyncEvent = {
  info?: { fieldName?: string; parentTypeName?: string };
  fieldName?: string;
  arguments?: Record<string, unknown>;
  identity?: { sub?: string; claims?: { email?: string } };
};

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

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run amplify/functions/crm-api/handler.test.ts amplify/functions/crm-api/lib/idGenerators.test.ts`
Expected: PASS.

- [ ] **Step 5: Register + grant in `amplify/backend.ts`**

Near function imports (~`:15-16`):

```typescript
import { crmApi } from './functions/crm-api/resource';
```

In `defineBackend({ ... })` (~`:87-88`) add `crmApi,`.

After the logistics-api grant block (`:524-526`):

```typescript
// Grant crm-api Lambda access (Customer 360 Timeline — shared single table)
intelligenceTable.grantReadWriteData(backend.crmApi.resources.lambda);
backend.crmApi.addEnvironment('INTELLIGENCE_TABLE', intelligenceTable.tableName);
```

- [ ] **Step 6: Typecheck the backend**

Run: `npx tsc --noEmit -p amplify/tsconfig.json`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add amplify/functions/crm-api amplify/backend.ts
git commit -m "feat(crm-api): scaffold crm-api lambda + id generators + backend wiring"
```

---

## Task 4: Normalization helpers

**Files:**
- Create: `amplify/functions/crm-api/lib/normalize.ts`
- Test: `amplify/functions/crm-api/lib/normalize.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { normalizeEmail, domainOf, normalizeOrgName, isFreeEmailDomain, isDenylistedDomain } from './normalize';

describe('normalize', () => {
  it('normalizeEmail lowercases + trims', () => {
    expect(normalizeEmail('  Terry@DiamondFoundry.com ')).toBe('terry@diamondfoundry.com');
  });
  it('domainOf extracts host or null', () => {
    expect(domainOf('terry@diamondfoundry.com')).toBe('diamondfoundry.com');
    expect(domainOf('not-an-email')).toBeNull();
  });
  it('normalizeOrgName collapses case/space/punct', () => {
    expect(normalizeOrgName('  Diamond  Foundry, Inc. ')).toBe('diamond foundry inc');
  });
  it('isFreeEmailDomain flags consumer providers', () => {
    expect(isFreeEmailDomain('gmail.com')).toBe(true);
    expect(isFreeEmailDomain('qq.com')).toBe(true);
    expect(isFreeEmailDomain('diamondfoundry.com')).toBe(false);
  });
  it('isDenylistedDomain flags infra + free', () => {
    expect(isDenylistedDomain('amazonaws.com')).toBe(true);
    expect(isDenylistedDomain('gmail.com')).toBe(true);
    expect(isDenylistedDomain('diamondfoundry.com')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run amplify/functions/crm-api/lib/normalize.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```typescript
const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'live.com',
  'yahoo.com', 'yahoo.co.uk', 'icloud.com', 'me.com', 'aol.com', 'proton.me',
  'protonmail.com', 'qq.com', '163.com', '126.com', 'sina.com', 'foxmail.com',
]);

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
  return raw.toLowerCase().replace(/[.,]/g, ' ').replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
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

**Files:**
- Create: `amplify/functions/crm-api/lib/timelineId.ts`
- Test: `amplify/functions/crm-api/lib/timelineId.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { timelineId } from './timelineId';

describe('timelineId', () => {
  it('order_created keys off orderId', () => {
    expect(timelineId({ kind: 'order_created', orderId: 'ord-1' })).toBe('tev-order-ord-1-created');
  });
  it('order_stage_changed keys off the stable orderLogId', () => {
    expect(timelineId({ kind: 'order_stage_changed', orderId: 'ord-1', orderLogId: 'olog-abc' })).toBe('tev-order-ord-1-stage-olog-abc');
  });
  it('order_stage_changed falls back to a deterministic hash without a log id', () => {
    const a = timelineId({ kind: 'order_stage_changed', orderId: 'ord-1', toStatus: 'SHIPPED', occurredAt: '2026-01-01T00:00:00Z' });
    const b = timelineId({ kind: 'order_stage_changed', orderId: 'ord-1', toStatus: 'SHIPPED', occurredAt: '2026-01-01T00:00:00Z' });
    expect(a).toMatch(/^tev-order-ord-1-stage-h[0-9a-f]{12}$/);
    expect(a).toBe(b);
  });
  it('other kinds', () => {
    expect(timelineId({ kind: 'rfq_submitted', rfqId: 'rfq-1' })).toBe('tev-rfq-rfq-1-submitted');
    expect(timelineId({ kind: 'rfq_status_changed', rfqId: 'rfq-1', toStatus: 'converted' })).toBe('tev-rfq-rfq-1-status-converted');
    expect(timelineId({ kind: 'lead_captured', leadId: 'lead-1' })).toBe('tev-lead-lead-1');
    expect(timelineId({ kind: 'logistics_milestone', caseId: 'lc-1', milestoneId: 'mlog-x' })).toBe('tev-logistics-lc-1-log-mlog-x');
    expect(timelineId({ kind: 'quote_sent', quoteDocId: 'doc-1' })).toBe('tev-quote-doc-1');
    expect(timelineId({ kind: 'site_visit_session', sessionId: 'sess-1' })).toBe('tev-analytics-session-sess-1');
    expect(timelineId({ kind: 'manual', manualId: 'm1' })).toBe('tev-manual-m1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run amplify/functions/crm-api/lib/timelineId.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

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
    case 'order_created': return `tev-order-${input.orderId}-created`;
    case 'order_stage_changed': {
      const key = input.orderLogId ?? shortHash(input.orderId, input.toStatus ?? '', input.occurredAt ?? '');
      return `tev-order-${input.orderId}-stage-${key}`;
    }
    case 'rfq_submitted': return `tev-rfq-${input.rfqId}-submitted`;
    case 'rfq_status_changed': return `tev-rfq-${input.rfqId}-status-${input.toStatus}`;
    case 'lead_captured': return `tev-lead-${input.leadId}`;
    case 'logistics_milestone': {
      const key = input.milestoneId ?? shortHash(input.caseId, input.stage ?? '', input.occurredAt ?? '');
      return `tev-logistics-${input.caseId}-log-${key}`;
    }
    case 'quote_sent': return `tev-quote-${input.quoteDocId}`;
    case 'site_visit_session': return `tev-analytics-session-${input.sessionId}`;
    case 'manual': return `tev-manual-${input.manualId}`;
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

Includes the review fixes: `rollupApplied` flag, reserved comms fields (`from`/`to`/`subject`/`bodySnippet`), GSI1 only for `unresolved`, and `contactIdForEmail` using a top-level `import`.

**Files:**
- Create: `amplify/functions/crm-api/lib/types.ts`
- Create: `amplify/functions/crm-api/lib/keys.ts`
- Test: `amplify/functions/crm-api/lib/keys.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { timelineEventKeys, contactKeys, auditKeys, contactIdForEmail } from './keys';

describe('timelineEventKeys', () => {
  const common = { id: 'tev-x', occurredAt: '2026-06-19T10:00:00Z', sourceEntityType: 'rfq', sourceEntityId: 'rfq-1' };
  it('resolved event: PK/SK + GSI2(org)+GSI3(src), NO GSI1, GSI4 only with contactId', () => {
    const k = timelineEventKeys({ ...common, orgId: 'org-1', contactId: 'ct-a', resolutionStatus: 'resolved' });
    expect(k.PK).toBe('TLEVENT#tev-x');
    expect(k.GSI2PK).toBe('ORG#org-1');
    expect(k.GSI2SK).toBe('TLEVENT#2026-06-19T10:00:00Z#tev-x');
    expect(k.GSI3PK).toBe('SRC#rfq#rfq-1');
    expect(k.GSI4PK).toBe('CONTACT#ct-a');
    expect(k.GSI1PK).toBeUndefined();
  });
  it('unresolved event: GSI1 IS written; GSI4 omitted without contactId', () => {
    const k = timelineEventKeys({ ...common, orgId: 'unresolved-rfq-rfq-1', resolutionStatus: 'unresolved' });
    expect(k.GSI1PK).toBe('TLEVENT_STATUS#unresolved');
    expect(k.GSI1SK).toBe('2026-06-19T10:00:00Z#tev-x');
    expect(k.GSI4PK).toBeUndefined();
  });
});

describe('contactKeys / auditKeys / contactIdForEmail', () => {
  it('contactKeys maps PK + GSI4(email) + GSI2(org)', () => {
    const k = contactKeys({ contactId: 'ct-a', email: 'terry@diamondfoundry.com', orgId: 'org-1' });
    expect(k.PK).toBe('CONTACT#ct-a');
    expect(k.GSI4PK).toBe('EMAIL#terry@diamondfoundry.com');
    expect(k.GSI2PK).toBe('ORG#org-1');
  });
  it('auditKeys maps PK + GSI2(org) by timestamp', () => {
    const k = auditKeys({ id: 'audit-1', orgId: 'org-1', timestamp: '2026-06-19T10:00:00Z' });
    expect(k.PK).toBe('AUDIT#audit-1');
    expect(k.GSI2PK).toBe('ORG#org-1');
    expect(k.GSI2SK).toBe('AUDIT#2026-06-19T10:00:00Z#audit-1');
  });
  it('contactIdForEmail is deterministic ct- id', () => {
    expect(contactIdForEmail('a@b.com')).toMatch(/^ct-[0-9a-f]{12}$/);
    expect(contactIdForEmail('a@b.com')).toBe(contactIdForEmail('a@b.com'));
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
  rollupApplied: boolean; // internal consistency guard (not exposed in GraphQL)
  // P2-reserved comms fields, written null in P1:
  direction: 'inbound' | 'outbound' | null;
  externalId: string | null;
  threadId: string | null;
  from: string | null;
  to: string | null;
  subject: string | null;
  bodySnippet: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContactItem {
  PK: string; SK: string;
  GSI2PK?: string; GSI2SK?: string;
  GSI4PK?: string; GSI4SK?: string;
  entityType: 'CONTACT';
  contactId: string; email: string;
  name: string | null; title: string | null; role: string | null; phone: string | null;
  orgId: string; source: string;
  firstSeenAt: string; lastSeenAt: string;
  linkLocked: boolean;
  createdAt: string; updatedAt: string;
}

export interface LinkAuditLogItem {
  PK: string; SK: string;
  GSI2PK?: string; GSI2SK?: string;
  entityType: 'LINK_AUDIT';
  id: string;
  timelineEventId: string | null;
  contactId: string | null;
  orgId: string | null;
  oldOrgId: string | null; newOrgId: string | null;
  oldContactId: string | null; newContactId: string | null;
  operator: string; reason: string; timestamp: string;
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
import crypto from 'node:crypto';

export function timelineEventKeys(e: {
  id: string; orgId: string; contactId?: string | null; occurredAt: string;
  resolutionStatus: string; sourceEntityType: string; sourceEntityId: string;
}) {
  const tlSk = `TLEVENT#${e.occurredAt}#${e.id}`;
  const keys: Record<string, string> = {
    PK: `TLEVENT#${e.id}`,
    SK: 'A',
    GSI2PK: `ORG#${e.orgId}`,
    GSI2SK: tlSk,
    GSI3PK: `SRC#${e.sourceEntityType}#${e.sourceEntityId}`,
    GSI3SK: tlSk,
  };
  // GSI1 only indexes the Needs-Linking queue (unresolved) — never resolved events.
  if (e.resolutionStatus === 'unresolved') {
    keys.GSI1PK = 'TLEVENT_STATUS#unresolved';
    keys.GSI1SK = `${e.occurredAt}#${e.id}`;
  }
  if (e.contactId) {
    keys.GSI4PK = `CONTACT#${e.contactId}`;
    keys.GSI4SK = tlSk;
  }
  return keys;
}

export function contactKeys(c: { contactId: string; email: string; orgId: string }) {
  return {
    PK: `CONTACT#${c.contactId}`, SK: 'A',
    GSI4PK: `EMAIL#${c.email}`, GSI4SK: 'CONTACT#A',
    GSI2PK: `ORG#${c.orgId}`, GSI2SK: `CONTACT#${c.email}`,
  };
}

export function auditKeys(a: { id: string; orgId?: string | null; timestamp: string }) {
  const keys: Record<string, string> = { PK: `AUDIT#${a.id}`, SK: 'A' };
  if (a.orgId) {
    keys.GSI2PK = `ORG#${a.orgId}`;
    keys.GSI2SK = `AUDIT#${a.timestamp}#${a.id}`;
  }
  return keys;
}

// deterministic + readable; intentionally non-mergeable automatically in P1 (spec §3.2).
export function contactIdForEmail(normalizedEmail: string): string {
  return `ct-${crypto.createHash('sha256').update(normalizedEmail).digest('hex').slice(0, 12)}`;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run amplify/functions/crm-api/lib/keys.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add amplify/functions/crm-api/lib/types.ts amplify/functions/crm-api/lib/keys.ts amplify/functions/crm-api/lib/keys.test.ts
git commit -m "feat(crm-api): entity types + key builders (sparse GSI1, reserved comms fields, rollupApplied)"
```

---

## Task 7: Org lookups + contact-by-email read

**Files:**
- Create: `amplify/functions/crm-api/lib/orgStore.ts` (lookups; rollups + create added in Task 10)
- Create: `amplify/functions/crm-api/lib/contactStore.ts` (read; upsert added in Task 9)
- Create: `amplify/functions/crm-api/lib/timelineStore.ts`
- Test: `amplify/functions/crm-api/lib/orgStore.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
const mockSend = vi.fn();
vi.mock('./dynamodb', () => ({ docClient: { send: (...a: unknown[]) => mockSend(...a) }, TABLE_NAME: () => 'T' }));

import { getOrgIdByDomain, getOrgIdByName } from './orgStore';
import { getContactByEmail } from './contactStore';
import { getTimelineEvent } from './timelineStore';

beforeEach(() => mockSend.mockReset());

describe('lookups', () => {
  it('getOrgIdByDomain returns orgId or null', async () => {
    mockSend.mockResolvedValueOnce({ Item: { orgId: 'org-1' } });
    expect(await getOrgIdByDomain('diamondfoundry.com')).toBe('org-1');
    mockSend.mockResolvedValueOnce({});
    expect(await getOrgIdByDomain('unknown.com')).toBeNull();
  });
  it('getOrgIdByName returns orgId', async () => {
    mockSend.mockResolvedValueOnce({ Item: { orgId: 'org-2' } });
    expect(await getOrgIdByName('diamond foundry inc')).toBe('org-2');
  });
  it('getContactByEmail returns contact or null', async () => {
    mockSend.mockResolvedValueOnce({ Items: [{ contactId: 'ct-x', orgId: 'org-1', email: 'a@b.com' }] });
    expect((await getContactByEmail('a@b.com'))?.contactId).toBe('ct-x');
    mockSend.mockResolvedValueOnce({ Items: [] });
    expect(await getContactByEmail('a@b.com')).toBeNull();
  });
  it('getTimelineEvent returns item or null by id', async () => {
    mockSend.mockResolvedValueOnce({ Item: { id: 'tev-x', orgId: 'org-1' } });
    expect((await getTimelineEvent('tev-x'))?.orgId).toBe('org-1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run amplify/functions/crm-api/lib/orgStore.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

`amplify/functions/crm-api/lib/orgStore.ts`:

```typescript
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from './dynamodb';

export async function getOrgIdByDomain(domain: string): Promise<string | null> {
  const res = await docClient.send(new GetCommand({ TableName: TABLE_NAME(), Key: { PK: `ORGDOMAIN#${domain}`, SK: 'A' } }));
  return (res.Item?.orgId as string | undefined) ?? null;
}

export async function getOrgIdByName(normName: string): Promise<string | null> {
  const res = await docClient.send(new GetCommand({ TableName: TABLE_NAME(), Key: { PK: `ORGNAME#${normName}`, SK: 'A' } }));
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
    TableName: TABLE_NAME(), IndexName: 'GSI4',
    KeyConditionExpression: 'GSI4PK = :pk AND GSI4SK = :sk',
    ExpressionAttributeValues: { ':pk': `EMAIL#${email}`, ':sk': 'CONTACT#A' },
    Limit: 1,
  }));
  return (res.Items?.[0] as ContactItem | undefined) ?? null;
}
```

`amplify/functions/crm-api/lib/timelineStore.ts`:

```typescript
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from './dynamodb';
import type { TimelineEventItem } from './types';

export async function getTimelineEvent(id: string): Promise<TimelineEventItem | null> {
  const res = await docClient.send(new GetCommand({ TableName: TABLE_NAME(), Key: { PK: `TLEVENT#${id}`, SK: 'A' } }));
  return (res.Item as TimelineEventItem | undefined) ?? null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run amplify/functions/crm-api/lib/orgStore.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add amplify/functions/crm-api/lib/orgStore.ts amplify/functions/crm-api/lib/contactStore.ts amplify/functions/crm-api/lib/timelineStore.ts amplify/functions/crm-api/lib/orgStore.test.ts
git commit -m "feat(crm-api): org domain/name + contact-by-email + timeline-event lookups"
```

---

## Task 8: `resolveLinks` — resolution ladder (pure, no writes)

`resolveLinks` returns a `new-org:{domain}` **intent** for `email_domain_new`; the actual Org is materialized by `emitTimelineEvent` (Task 11). This keeps the resolver side-effect-free and testable.

**Files:**
- Create: `amplify/functions/crm-api/lib/resolveLinks.ts`
- Test: `amplify/functions/crm-api/lib/resolveLinks.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
const getOrgIdByDomain = vi.fn(); const getOrgIdByName = vi.fn(); const getContactByEmail = vi.fn();
vi.mock('./orgStore', () => ({ getOrgIdByDomain: (d: string) => getOrgIdByDomain(d), getOrgIdByName: (n: string) => getOrgIdByName(n) }));
vi.mock('./contactStore', () => ({ getContactByEmail: (e: string) => getContactByEmail(e) }));

import { resolveLinks } from './resolveLinks';
beforeEach(() => { getOrgIdByDomain.mockReset(); getOrgIdByName.mockReset(); getContactByEmail.mockReset(); });
const base = { sourceEntityType: 'rfq', sourceEntityId: 'rfq-1', channel: 'rfq' as const };

describe('resolveLinks ladder', () => {
  it('1 manual lock wins', async () => {
    expect(await resolveLinks({ ...base, lockedOrgId: 'org-l' }))
      .toMatchObject({ orgId: 'org-l', resolutionReason: 'manual', resolutionStatus: 'manually_linked', confidence: 1 });
  });
  it('2 matchedOrgId beats domain', async () => {
    const r = await resolveLinks({ ...base, matchedOrgId: 'org-m', email: 'a@diamondfoundry.com' });
    expect(r).toMatchObject({ orgId: 'org-m', resolutionReason: 'existing_matchedOrgId' });
    expect(getOrgIdByDomain).not.toHaveBeenCalled();
  });
  it('3 contact_email_exact beats domain (Terry case)', async () => {
    getContactByEmail.mockResolvedValueOnce({ contactId: 'ct-t', orgId: 'org-df' });
    const r = await resolveLinks({ ...base, email: 'terry@diamondfoundry.com' });
    expect(r).toMatchObject({ orgId: 'org-df', contactId: 'ct-t', resolutionReason: 'contact_email_exact', confidence: 0.9 });
    expect(getOrgIdByDomain).not.toHaveBeenCalled();
  });
  it('4 email_domain_exact', async () => {
    getContactByEmail.mockResolvedValueOnce(null); getOrgIdByDomain.mockResolvedValueOnce('org-df');
    expect(await resolveLinks({ ...base, email: 'new@diamondfoundry.com' }))
      .toMatchObject({ orgId: 'org-df', resolutionReason: 'email_domain_exact', confidence: 0.95 });
  });
  it('5 email_domain_new returns new-org intent (strong channel)', async () => {
    getContactByEmail.mockResolvedValueOnce(null); getOrgIdByDomain.mockResolvedValueOnce(null);
    const r = await resolveLinks({ ...base, email: 'first@newcorp.com' });
    expect(r).toMatchObject({ resolutionReason: 'email_domain_new', confidence: 0.8 });
    expect(r.orgId).toBe('new-org:newcorp.com');
  });
  it('5-guard analytics-only never auto-creates', async () => {
    getContactByEmail.mockResolvedValueOnce(null); getOrgIdByDomain.mockResolvedValueOnce(null); getOrgIdByName.mockResolvedValueOnce(null);
    const r = await resolveLinks({ sourceEntityType: 'analytics', sourceEntityId: 's1', channel: 'analytics', email: 'first@newcorp.com' });
    expect(r.resolutionReason).not.toBe('email_domain_new');
    expect(r.resolutionStatus).toBe('unresolved');
  });
  it('5-guard free domain skips domain steps', async () => {
    getContactByEmail.mockResolvedValueOnce(null);
    const r = await resolveLinks({ ...base, email: 'x@gmail.com' });
    expect(r.resolutionReason).not.toBe('email_domain_new');
    expect(getOrgIdByDomain).not.toHaveBeenCalled();
  });
  it('6 organization_name_match', async () => {
    getContactByEmail.mockResolvedValueOnce(null); getOrgIdByName.mockResolvedValueOnce('org-n');
    expect(await resolveLinks({ ...base, organizationName: 'Diamond Foundry, Inc.' }))
      .toMatchObject({ orgId: 'org-n', resolutionReason: 'organization_name_match', confidence: 0.7 });
  });
  it('7 visitor_prior_event analytics-only', async () => {
    expect(await resolveLinks({ sourceEntityType: 'analytics', sourceEntityId: 's1', channel: 'analytics', priorVisitorOrgId: 'org-v' }))
      .toMatchObject({ orgId: 'org-v', resolutionReason: 'visitor_prior_event', confidence: 0.5 });
  });
  it('7-guard rejected for strong channels', async () => {
    getContactByEmail.mockResolvedValueOnce(null);
    const r = await resolveLinks({ ...base, priorVisitorOrgId: 'org-v' });
    expect(r.resolutionReason).not.toBe('visitor_prior_event');
  });
  it('8 unresolved sentinel per-event', async () => {
    getContactByEmail.mockResolvedValueOnce(null);
    expect(await resolveLinks({ ...base }))
      .toMatchObject({ orgId: 'unresolved-rfq-rfq-1', resolutionReason: 'unresolved', resolutionStatus: 'unresolved', confidence: 0 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run amplify/functions/crm-api/lib/resolveLinks.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```typescript
import { normalizeEmail, domainOf, normalizeOrgName, isFreeEmailDomain, isDenylistedDomain } from './normalize';
import { getOrgIdByDomain, getOrgIdByName } from './orgStore';
import { getContactByEmail } from './contactStore';
import type { ResolveResult } from './types';

export type ResolveInput = {
  sourceEntityType: string;
  sourceEntityId: string;
  channel: 'analytics' | 'lead' | 'rfq' | 'quote' | 'order' | 'logistics' | 'manual';
  lockedOrgId?: string;
  lockedContactId?: string;
  matchedOrgId?: string;
  email?: string;
  organizationName?: string;
  priorVisitorOrgId?: string;
};

const STRONG_CHANNELS = new Set(['rfq', 'lead', 'order', 'quote', 'logistics']);

export async function resolveLinks(input: ResolveInput): Promise<ResolveResult> {
  if (input.lockedOrgId) {
    return { orgId: input.lockedOrgId, contactId: input.lockedContactId ?? null, resolutionStatus: 'manually_linked', resolutionReason: 'manual', confidence: 1.0 };
  }
  if (input.matchedOrgId) {
    return { orgId: input.matchedOrgId, contactId: null, resolutionStatus: 'resolved', resolutionReason: 'existing_matchedOrgId', confidence: 1.0 };
  }

  const email = input.email ? normalizeEmail(input.email) : null;
  const domain = email ? domainOf(email) : null;

  if (email) {
    const contact = await getContactByEmail(email);
    if (contact?.orgId) {
      return { orgId: contact.orgId, contactId: contact.contactId, resolutionStatus: 'resolved', resolutionReason: 'contact_email_exact', confidence: 0.9 };
    }
  }

  if (domain && !isFreeEmailDomain(domain)) {
    const orgId = await getOrgIdByDomain(domain);
    if (orgId) {
      return { orgId, contactId: null, resolutionStatus: 'resolved', resolutionReason: 'email_domain_exact', confidence: 0.95 };
    }
    if (STRONG_CHANNELS.has(input.channel) && !isDenylistedDomain(domain)) {
      return { orgId: `new-org:${domain}`, contactId: null, resolutionStatus: 'resolved', resolutionReason: 'email_domain_new', confidence: 0.8 };
    }
  }

  if (input.organizationName) {
    const orgId = await getOrgIdByName(normalizeOrgName(input.organizationName));
    if (orgId) {
      return { orgId, contactId: null, resolutionStatus: 'resolved', resolutionReason: 'organization_name_match', confidence: 0.7 };
    }
  }

  if (input.channel === 'analytics' && input.priorVisitorOrgId) {
    return { orgId: input.priorVisitorOrgId, contactId: null, resolutionStatus: 'resolved', resolutionReason: 'visitor_prior_event', confidence: 0.5 };
  }

  return { orgId: `unresolved-${input.sourceEntityType}-${input.sourceEntityId}`, contactId: null, resolutionStatus: 'unresolved', resolutionReason: 'unresolved', confidence: 0 };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run amplify/functions/crm-api/lib/resolveLinks.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add amplify/functions/crm-api/lib/resolveLinks.ts amplify/functions/crm-api/lib/resolveLinks.test.ts
git commit -m "feat(crm-api): resolveLinks resolution ladder with guards (pure)"
```

---

## Task 9: Contact upsert (deterministic id, monotonic, distinct createdAt/firstSeenAt)

**Files:**
- Modify: `amplify/functions/crm-api/lib/contactStore.ts`
- Test: `amplify/functions/crm-api/lib/contactStore.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
const mockSend = vi.fn();
vi.mock('./dynamodb', () => ({ docClient: { send: (...a: unknown[]) => mockSend(...a) }, TABLE_NAME: () => 'T' }));
import { upsertContact } from './contactStore';
beforeEach(() => mockSend.mockReset());

describe('upsertContact', () => {
  it('creates with deterministic id; firstSeenAt=occurredAt, createdAt is a separate now', async () => {
    mockSend.mockResolvedValueOnce({ Items: [] }); // getContactByEmail
    mockSend.mockResolvedValueOnce({});            // put
    const id = await upsertContact({ email: 'Terry@DiamondFoundry.com', orgId: 'org-1', source: 'rfq', occurredAt: '2026-06-19T10:00:00Z', name: 'Terry' });
    expect(id).toMatch(/^ct-[0-9a-f]{12}$/);
    const item = mockSend.mock.calls[1][0].input.Item;
    expect(item.email).toBe('terry@diamondfoundry.com');
    expect(item.firstSeenAt).toBe('2026-06-19T10:00:00Z');
    expect(item.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/); // an ISO now, not asserted equal to occurredAt
  });
  it('advances lastSeenAt monotonically, preserves firstSeenAt, respects linkLocked', async () => {
    mockSend.mockResolvedValueOnce({ Items: [{ contactId: 'ct-x', email: 'a@b.com', orgId: 'org-OLD', linkLocked: true, firstSeenAt: '2026-01-01T00:00:00Z', lastSeenAt: '2026-01-01T00:00:00Z', createdAt: '2026-01-01T00:00:00Z', source: 'rfq' }] });
    mockSend.mockResolvedValueOnce({});
    await upsertContact({ email: 'a@b.com', orgId: 'org-NEW', source: 'lead', occurredAt: '2026-06-01T00:00:00Z' });
    const item = mockSend.mock.calls[1][0].input.Item;
    expect(item.orgId).toBe('org-OLD');
    expect(item.lastSeenAt).toBe('2026-06-01T00:00:00Z');
    expect(item.firstSeenAt).toBe('2026-01-01T00:00:00Z');
    expect(item.createdAt).toBe('2026-01-01T00:00:00Z');
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
  const occurredAt = args.occurredAt;
  const nowIso = new Date().toISOString();

  const orgId = existing?.linkLocked ? existing.orgId : args.orgId;
  const firstSeenAt = existing?.firstSeenAt && existing.firstSeenAt < occurredAt ? existing.firstSeenAt : occurredAt;
  const lastSeenAt = existing?.lastSeenAt && existing.lastSeenAt > occurredAt ? existing.lastSeenAt : occurredAt;

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
    createdAt: existing?.createdAt ?? nowIso,
    updatedAt: nowIso,
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
git commit -m "feat(crm-api): upsertContact — deterministic id, monotonic seen-dates, lock guard"
```

---

## Task 10: Org store — review-org auto-create (domain+name index) + internalOnly-aware rollups

Implements review fixes #1 (auto-create, race-safe via domain-index claim, **+ OrgNameIndex**), the paginated recompute (#minor), the unused-vars removal (#minor), and round-2 fixes (OrgNameIndex on auto-create; `internalOnly` excluded from `lastActivityAt`).

**Files:**
- Modify: `amplify/functions/crm-api/lib/orgStore.ts`
- Test: `amplify/functions/crm-api/lib/orgStore.rollups.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
const mockSend = vi.fn();
vi.mock('./dynamodb', () => ({ docClient: { send: (...a: unknown[]) => mockSend(...a) }, TABLE_NAME: () => 'T' }));
vi.mock('./idGenerators', () => ({ generateOrgId: () => 'org-NEW', generateAuditId: () => 'audit-x' }));
import { createReviewOrgFromDomain, bumpOrgRollupOnCreate, recomputeRollupsForOrg } from './orgStore';
beforeEach(() => mockSend.mockReset());

describe('createReviewOrgFromDomain', () => {
  it('claims the domain index, writes the review org + name index, returns the new id', async () => {
    mockSend.mockResolvedValueOnce({}); // claim ORGDOMAIN (conditional put ok)
    mockSend.mockResolvedValueOnce({}); // put ORG review record
    mockSend.mockResolvedValueOnce({}); // put ORGNAME index
    const id = await createReviewOrgFromDomain('newcorp.com', '2026-06-19T10:00:00Z');
    expect(id).toBe('org-NEW');
    const orgItem = mockSend.mock.calls[1][0].input.Item;
    expect(orgItem.status).toBe('review');
    expect(orgItem.createdByResolution).toBe(true);
    expect(orgItem.primaryDomain).toBe('newcorp.com');
    expect(orgItem.GSI1PK).toBe('ORG_STATUS#review');
    const nameItem = mockSend.mock.calls[2][0].input.Item;
    expect(nameItem.PK).toBe('ORGNAME#newcorp'); // normalizeOrgName('newcorp')
    expect(nameItem.orgId).toBe('org-NEW');
  });
  it('on claim race, returns the existing org id without creating', async () => {
    mockSend.mockRejectedValueOnce(Object.assign(new Error('dup'), { name: 'ConditionalCheckFailedException' }));
    mockSend.mockResolvedValueOnce({ Item: { orgId: 'org-EXISTING' } }); // getOrgIdByDomain
    const id = await createReviewOrgFromDomain('newcorp.com', '2026-06-19T10:00:00Z');
    expect(id).toBe('org-EXISTING');
  });
});

describe('bumpOrgRollupOnCreate', () => {
  it('skips sentinel orgs', async () => {
    await bumpOrgRollupOnCreate({ orgId: 'unresolved-rfq-1', kind: 'rfq_submitted', occurredAt: '2026-01-01T00:00:00Z' });
    await bumpOrgRollupOnCreate({ orgId: 'new-org:x.com', kind: 'rfq_submitted', occurredAt: '2026-01-01T00:00:00Z' });
    expect(mockSend).not.toHaveBeenCalled();
  });
  it('increments count + advances lastActivityAt for a real org', async () => {
    mockSend.mockResolvedValueOnce({});
    await bumpOrgRollupOnCreate({ orgId: 'org-1', kind: 'order_created', occurredAt: '2026-06-19T10:00:00Z' });
    const upd = mockSend.mock.calls[0][0].input;
    expect(upd.Key).toEqual({ PK: 'ORG#org-1', SK: 'A' });
    expect(upd.UpdateExpression).toMatch(/orderCount/);
  });
  it('internalOnly note is a no-op (never advances lastActivityAt)', async () => {
    await bumpOrgRollupOnCreate({ orgId: 'org-1', kind: 'note', occurredAt: '2026-06-19T10:00:00Z', isInternalOnly: true });
    expect(mockSend).not.toHaveBeenCalled();
  });
});

describe('recomputeRollupsForOrg', () => {
  it('paginates GSI2, re-derives counts/max dates, and excludes internalOnly from lastActivityAt', async () => {
    mockSend
      .mockResolvedValueOnce({ Items: [{ kind: 'rfq_submitted', occurredAt: '2026-01-01T00:00:00Z' }], LastEvaluatedKey: { k: 1 } })
      .mockResolvedValueOnce({ Items: [
        { kind: 'order_created', occurredAt: '2026-03-01T00:00:00Z' },
        { kind: 'order_stage_changed', occurredAt: '2026-04-01T00:00:00Z' },
        { kind: 'note', occurredAt: '2026-05-01T00:00:00Z', isInternalOnly: true }, // newer but internal
      ] })
      .mockResolvedValueOnce({}); // final update
    await recomputeRollupsForOrg('org-1');
    expect(mockSend).toHaveBeenCalledTimes(3);
    const vals = mockSend.mock.calls[2][0].input.ExpressionAttributeValues;
    expect(vals[':la']).toBe('2026-04-01T00:00:00Z'); // internal note did NOT advance lastActivityAt
    expect(vals[':r']).toBe(1); // one rfq
    expect(vals[':o']).toBe(1); // one order
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run amplify/functions/crm-api/lib/orgStore.rollups.test.ts`
Expected: FAIL — functions not exported.

- [ ] **Step 3: Implement**

Append to `amplify/functions/crm-api/lib/orgStore.ts`:

```typescript
import { PutCommand, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { generateOrgId } from './idGenerators';
import { normalizeOrgName } from './normalize';

const KIND_TO_COUNT: Record<string, string> = { rfq_submitted: 'rfqCount', order_created: 'orderCount', lead_captured: 'leadCount' };
const KIND_TO_LATEST: Record<string, string> = { rfq_submitted: 'latestRFQDate', order_created: 'latestOrderDate', lead_captured: 'latestLeadDate' };

function isRealOrg(orgId: string): boolean {
  return !orgId.startsWith('unresolved-') && !orgId.startsWith('new-org:');
}

export async function createReviewOrgFromDomain(domain: string, occurredAt: string): Promise<string> {
  const orgId = generateOrgId();
  // Race-safe claim: the domain index is the idempotency anchor.
  try {
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME(),
      Item: { PK: `ORGDOMAIN#${domain}`, SK: 'A', entityType: 'ORG_DOMAIN_INDEX', domain, orgId },
      ConditionExpression: 'attribute_not_exists(PK)',
    }));
  } catch (err: unknown) {
    if ((err as { name?: string }).name === 'ConditionalCheckFailedException') {
      const existing = await getOrgIdByDomain(domain);
      if (existing) return existing;
    }
    throw err;
  }
  const nowIso = new Date().toISOString();
  const displayName = domain.split('.')[0];
  await docClient.send(new PutCommand({
    TableName: TABLE_NAME(),
    Item: {
      PK: `ORG#${orgId}`, SK: 'A',
      GSI1PK: 'ORG_STATUS#review', GSI1SK: `${nowIso}#${orgId}`,
      entityType: 'ORGANIZATION',
      orgId, primaryDomain: domain, displayName,
      status: 'review', createdByResolution: true, linkLocked: false,
      rfqCount: 0, orderCount: 0, leadCount: 0,
      firstSeenAt: occurredAt, lastActivityAt: occurredAt,
      createdAt: nowIso, updatedAt: nowIso,
    },
    ConditionExpression: 'attribute_not_exists(PK)',
  }));
  // Maintain the name index so organization_name_match resolves this org without Plan 2 backfill.
  // Non-conditional: an auto-created display name is low-confidence; a later rename (Plan 3) overwrites it.
  await docClient.send(new PutCommand({
    TableName: TABLE_NAME(),
    Item: { PK: `ORGNAME#${normalizeOrgName(displayName)}`, SK: 'A', entityType: 'ORG_NAME_INDEX', normName: normalizeOrgName(displayName), orgId },
  }));
  return orgId;
}

export async function bumpOrgRollupOnCreate(args: { orgId: string; kind: string; occurredAt: string; isInternalOnly?: boolean }): Promise<void> {
  if (!isRealOrg(args.orgId)) return;
  const countAttr = KIND_TO_COUNT[args.kind];
  const latestAttr = KIND_TO_LATEST[args.kind];
  // Rule (review #3): internalOnly events (internal notes/calls) never advance the
  // customer-facing lastActivityAt. Counts/latest dates are tied to external kinds only.
  const advanceActivity = !args.isInternalOnly;

  if (advanceActivity) {
    let expr = 'SET lastActivityAt = :occ';
    if (countAttr) expr += `, ${countAttr} = if_not_exists(${countAttr}, :zero) + :one`;
    if (latestAttr) expr += `, ${latestAttr} = :occ`;
    try {
      await docClient.send(new UpdateCommand({
        TableName: TABLE_NAME(),
        Key: { PK: `ORG#${args.orgId}`, SK: 'A' },
        UpdateExpression: expr,
        ConditionExpression: 'attribute_not_exists(lastActivityAt) OR lastActivityAt < :occ',
        ExpressionAttributeValues: { ':occ': args.occurredAt, ':zero': 0, ':one': 1 },
      }));
    } catch (err: unknown) {
      // Older event than current lastActivityAt: still increment the count without moving dates back.
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
    return;
  }

  // internalOnly: do NOT touch lastActivityAt. Apply count/latest only if the kind has them (rare).
  const sets = [
    countAttr ? `${countAttr} = if_not_exists(${countAttr}, :zero) + :one` : null,
    latestAttr ? `${latestAttr} = :occ` : null,
  ].filter(Boolean) as string[];
  if (sets.length === 0) return; // pure internal note → nothing to roll up
  await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME(),
    Key: { PK: `ORG#${args.orgId}`, SK: 'A' },
    UpdateExpression: 'SET ' + sets.join(', '),
    ExpressionAttributeValues: { ':occ': args.occurredAt, ':zero': 0, ':one': 1 },
  }));
}

export async function recomputeRollupsForOrg(orgId: string): Promise<void> {
  if (!isRealOrg(orgId)) return;
  const events: Array<{ kind: string; occurredAt: string; voided?: boolean; isInternalOnly?: boolean }> = [];
  let start: Record<string, unknown> | undefined;
  do {
    const res = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME(), IndexName: 'GSI2',
      KeyConditionExpression: 'GSI2PK = :pk AND begins_with(GSI2SK, :pfx)',
      ExpressionAttributeValues: { ':pk': `ORG#${orgId}`, ':pfx': 'TLEVENT#' },
      ExclusiveStartKey: start,
    }));
    for (const it of (res.Items ?? []) as typeof events) events.push(it);
    start = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (start);

  const live = events.filter((e) => !e.voided);
  const counts = { rfqCount: 0, orderCount: 0, leadCount: 0 };
  const latest: Record<string, string | null> = { latestRFQDate: null, latestOrderDate: null, latestLeadDate: null };
  let lastActivityAt: string | null = null;
  for (const e of live) {
    // lastActivityAt is customer-facing: internalOnly events never advance it (review #3).
    if (!e.isInternalOnly && e.occurredAt && (!lastActivityAt || e.occurredAt > lastActivityAt)) lastActivityAt = e.occurredAt;
    const c = KIND_TO_COUNT[e.kind]; if (c) (counts as Record<string, number>)[c] += 1;
    const l = KIND_TO_LATEST[e.kind]; if (l && (!latest[l] || e.occurredAt > (latest[l] as string))) latest[l] = e.occurredAt;
  }

  await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME(), Key: { PK: `ORG#${orgId}`, SK: 'A' },
    UpdateExpression: 'SET rfqCount = :r, orderCount = :o, leadCount = :l, latestRFQDate = :lr, latestOrderDate = :lo, latestLeadDate = :ll, lastActivityAt = :la',
    ExpressionAttributeValues: { ':r': counts.rfqCount, ':o': counts.orderCount, ':l': counts.leadCount, ':lr': latest.latestRFQDate, ':lo': latest.latestOrderDate, ':ll': latest.latestLeadDate, ':la': lastActivityAt },
  }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run amplify/functions/crm-api/lib/orgStore.rollups.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add amplify/functions/crm-api/lib/orgStore.ts amplify/functions/crm-api/lib/orgStore.rollups.test.ts
git commit -m "feat(crm-api): review-org auto-create (race-safe) + monotonic bump + paginated recompute"
```

---

## Task 11: `emitTimelineEvent` — idempotent, auto-create, full re-emit projection

Ties everything together with all review fixes: materializes the `email_domain_new` org (#1), derives the contact from `resolveInput.email` (#7), applies the `rollupApplied` guard (#3), and on re-emit updates the **full projection** and recomputes both orgs if the link changed (#2).

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
vi.mock('./contactStore', () => ({ upsertContact: (a: unknown) => upsertContact(a) }));
const createReviewOrgFromDomain = vi.fn(); const bumpOrgRollupOnCreate = vi.fn(); const recomputeRollupsForOrg = vi.fn();
vi.mock('./orgStore', () => ({
  createReviewOrgFromDomain: (d: string, o: string) => createReviewOrgFromDomain(d, o),
  bumpOrgRollupOnCreate: (a: unknown) => bumpOrgRollupOnCreate(a),
  recomputeRollupsForOrg: (o: string) => recomputeRollupsForOrg(o),
}));
const getTimelineEvent = vi.fn();
vi.mock('./timelineStore', () => ({ getTimelineEvent: (id: string) => getTimelineEvent(id) }));

import { emitTimelineEvent } from './emitTimelineEvent';
beforeEach(() => { mockSend.mockReset(); resolveLinks.mockReset(); upsertContact.mockReset(); createReviewOrgFromDomain.mockReset(); bumpOrgRollupOnCreate.mockReset(); recomputeRollupsForOrg.mockReset(); getTimelineEvent.mockReset(); });

const baseEvt = {
  source: 'rfq' as const, kind: 'rfq_submitted', sourceEntityType: 'rfq', sourceEntityId: 'rfq-1',
  occurredAt: '2026-06-19T10:00:00Z', summary: 'Submitted RFQ for ICP-1000W',
  idInput: { kind: 'rfq_submitted', rfqId: 'rfq-1' } as const,
  resolveInput: { sourceEntityType: 'rfq', sourceEntityId: 'rfq-1', channel: 'rfq' as const, email: 'terry@diamondfoundry.com' },
};

describe('emitTimelineEvent', () => {
  it('create path: put(rollupApplied=false) → bump → mark applied', async () => {
    resolveLinks.mockResolvedValueOnce({ orgId: 'org-df', contactId: null, resolutionStatus: 'resolved', resolutionReason: 'email_domain_exact', confidence: 0.95 });
    upsertContact.mockResolvedValueOnce('ct-terry');
    mockSend.mockResolvedValueOnce({}); // conditional put (new)
    mockSend.mockResolvedValueOnce({}); // set rollupApplied=true
    await emitTimelineEvent(baseEvt);
    const put = mockSend.mock.calls[0][0].input;
    expect(put.Item.PK).toBe('TLEVENT#tev-rfq-rfq-1-submitted');
    expect(put.Item.orgId).toBe('org-df');
    expect(put.Item.contactId).toBe('ct-terry');
    expect(put.Item.rollupApplied).toBe(false);
    expect(put.ConditionExpression).toMatch(/attribute_not_exists/);
    expect(bumpOrgRollupOnCreate).toHaveBeenCalledWith(expect.objectContaining({ orgId: 'org-df', kind: 'rfq_submitted' }));
    expect(mockSend.mock.calls[1][0].input.UpdateExpression).toMatch(/rollupApplied/);
  });
  it('email_domain_new: materializes review org, uses real id, upserts contact there', async () => {
    resolveLinks.mockResolvedValueOnce({ orgId: 'new-org:newcorp.com', contactId: null, resolutionStatus: 'resolved', resolutionReason: 'email_domain_new', confidence: 0.8 });
    createReviewOrgFromDomain.mockResolvedValueOnce('org-REVIEW');
    upsertContact.mockResolvedValueOnce('ct-1');
    mockSend.mockResolvedValueOnce({}); mockSend.mockResolvedValueOnce({});
    await emitTimelineEvent({ ...baseEvt, resolveInput: { ...baseEvt.resolveInput, email: 'first@newcorp.com' } });
    expect(createReviewOrgFromDomain).toHaveBeenCalledWith('newcorp.com', '2026-06-19T10:00:00Z');
    expect(mockSend.mock.calls[0][0].input.Item.orgId).toBe('org-REVIEW');
    expect(upsertContact).toHaveBeenCalledWith(expect.objectContaining({ orgId: 'org-REVIEW' }));
  });
  it('unresolved: no contact upsert, no rollup bump', async () => {
    resolveLinks.mockResolvedValueOnce({ orgId: 'unresolved-rfq-rfq-1', contactId: null, resolutionStatus: 'unresolved', resolutionReason: 'unresolved', confidence: 0 });
    mockSend.mockResolvedValueOnce({}); mockSend.mockResolvedValueOnce({});
    await emitTimelineEvent(baseEvt);
    expect(upsertContact).not.toHaveBeenCalled();
    expect(bumpOrgRollupOnCreate).toHaveBeenCalledWith(expect.objectContaining({ orgId: 'unresolved-rfq-rfq-1' })); // no-op inside, but called
  });
  it('re-emit (duplicate): writes FULL projection, NO bump; recomputes both orgs on org change', async () => {
    resolveLinks.mockResolvedValueOnce({ orgId: 'org-NEW', contactId: null, resolutionStatus: 'manually_linked', resolutionReason: 'manual', confidence: 1 });
    upsertContact.mockResolvedValueOnce('ct-terry');
    mockSend.mockRejectedValueOnce(Object.assign(new Error('dup'), { name: 'ConditionalCheckFailedException' })); // conditional put fails
    getTimelineEvent.mockResolvedValueOnce({ id: 'tev-rfq-rfq-1-submitted', orgId: 'org-OLD', createdAt: '2026-01-01T00:00:00Z', rollupApplied: true });
    mockSend.mockResolvedValueOnce({}); // overwrite put (no condition)
    await emitTimelineEvent(baseEvt);
    const overwrite = mockSend.mock.calls[1][0].input;
    expect(overwrite.Item.orgId).toBe('org-NEW');
    expect(overwrite.Item.resolutionReason).toBe('manual');
    expect(overwrite.Item.createdAt).toBe('2026-01-01T00:00:00Z'); // preserved
    expect(overwrite.ConditionExpression).toBeUndefined();
    expect(overwrite.Item.rollupApplied).toBe(true); // link moved → counted via recompute
    expect(bumpOrgRollupOnCreate).not.toHaveBeenCalled();
    expect(recomputeRollupsForOrg).toHaveBeenCalledWith('org-OLD');
    expect(recomputeRollupsForOrg).toHaveBeenCalledWith('org-NEW');
  });
  it('re-emit where original rollup never landed (rollupApplied=false), same org: compensates the bump', async () => {
    resolveLinks.mockResolvedValueOnce({ orgId: 'org-df', contactId: null, resolutionStatus: 'resolved', resolutionReason: 'email_domain_exact', confidence: 0.95 });
    upsertContact.mockResolvedValueOnce('ct-terry');
    mockSend.mockRejectedValueOnce(Object.assign(new Error('dup'), { name: 'ConditionalCheckFailedException' }));
    getTimelineEvent.mockResolvedValueOnce({ id: 'tev-rfq-rfq-1-submitted', orgId: 'org-df', createdAt: '2026-01-01T00:00:00Z', rollupApplied: false });
    mockSend.mockResolvedValueOnce({}); // overwrite put
    await emitTimelineEvent(baseEvt);
    expect(mockSend.mock.calls[1][0].input.Item.rollupApplied).toBe(true);
    expect(bumpOrgRollupOnCreate).toHaveBeenCalledWith(expect.objectContaining({ orgId: 'org-df', kind: 'rfq_submitted' }));
    expect(recomputeRollupsForOrg).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run amplify/functions/crm-api/lib/emitTimelineEvent.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```typescript
import { PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from './dynamodb';
import { timelineId, type TimelineIdInput } from './timelineId';
import { timelineEventKeys } from './keys';
import { normalizeEmail } from './normalize';
import { resolveLinks, type ResolveInput } from './resolveLinks';
import { upsertContact } from './contactStore';
import { createReviewOrgFromDomain, bumpOrgRollupOnCreate, recomputeRollupsForOrg } from './orgStore';
import { getTimelineEvent } from './timelineStore';
import type { TimelineEventItem, TimelineSource } from './types';

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
  voided?: boolean;
  createdBy?: string | null;
  payload?: Record<string, unknown> | null;
};

const isSentinelOrg = (orgId: string) => orgId.startsWith('unresolved-') || orgId.startsWith('new-org:');

export async function emitTimelineEvent(args: EmitArgs): Promise<void> {
  const id = timelineId(args.idInput);
  const resolved = await resolveLinks(args.resolveInput);

  // #1 — materialize email_domain_new intent into a real review org
  let orgId = resolved.orgId;
  if (resolved.resolutionReason === 'email_domain_new' && orgId.startsWith('new-org:')) {
    orgId = await createReviewOrgFromDomain(orgId.slice('new-org:'.length), args.occurredAt);
  }

  // #7 — derive contact from resolveInput.email when we have a real org
  let contactId = resolved.contactId;
  const email = args.resolveInput.email ? normalizeEmail(args.resolveInput.email) : null;
  if (email && !isSentinelOrg(orgId)) {
    contactId = await upsertContact({ email, orgId, source: args.source, occurredAt: args.occurredAt });
  }

  const nowIso = new Date().toISOString();
  const buildItem = (createdAt: string, rollupApplied: boolean): TimelineEventItem => ({
    ...timelineEventKeys({ id, orgId, contactId, occurredAt: args.occurredAt, resolutionStatus: resolved.resolutionStatus, sourceEntityType: args.sourceEntityType, sourceEntityId: args.sourceEntityId }),
    entityType: 'TIMELINE_EVENT',
    id, orgId, resolutionStatus: resolved.resolutionStatus, resolutionReason: resolved.resolutionReason, confidence: resolved.confidence,
    contactId: contactId ?? null, occurredAt: args.occurredAt,
    source: args.source, kind: args.kind, summary: args.summary,
    sourceEntityType: args.sourceEntityType, sourceEntityId: args.sourceEntityId,
    isInternalOnly: args.isInternalOnly ?? false, voided: args.voided ?? false,
    createdBy: args.createdBy ?? null, payload: args.payload ?? null,
    rollupApplied,
    direction: null, externalId: null, threadId: null, from: null, to: null, subject: null, bodySnippet: null,
    createdAt, updatedAt: nowIso,
  }) as TimelineEventItem;

  try {
    // #3 — write with rollupApplied=false, then bump, then mark applied
    await docClient.send(new PutCommand({ TableName: TABLE_NAME(), Item: buildItem(nowIso, false), ConditionExpression: 'attribute_not_exists(PK)' }));
  } catch (err: unknown) {
    if ((err as { name?: string }).name !== 'ConditionalCheckFailedException') throw err;
    // #2/#3 — duplicate: full-projection overwrite, then reconcile rollups.
    const existing = await getTimelineEvent(id);
    const oldOrgId = existing?.orgId;
    const linkMoved = !!oldOrgId && oldOrgId !== orgId;
    // If the original bump never landed (rollupApplied=false), compensate now.
    const needsCompensation = !linkMoved && existing?.rollupApplied !== true;
    // After either branch the event's contribution is accounted for → rollupApplied=true.
    const finalApplied = linkMoved || needsCompensation ? true : (existing?.rollupApplied ?? true);
    await docClient.send(new PutCommand({ TableName: TABLE_NAME(), Item: buildItem(existing?.createdAt ?? nowIso, finalApplied) }));
    if (linkMoved) {
      await recomputeRollupsForOrg(oldOrgId!);
      await recomputeRollupsForOrg(orgId);
    } else if (needsCompensation) {
      await bumpOrgRollupOnCreate({ orgId, kind: args.kind, occurredAt: args.occurredAt, isInternalOnly: args.isInternalOnly ?? false });
    }
    return;
  }

  await bumpOrgRollupOnCreate({ orgId, kind: args.kind, occurredAt: args.occurredAt, isInternalOnly: args.isInternalOnly ?? false });
  await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME(), Key: { PK: `TLEVENT#${id}`, SK: 'A' },
    UpdateExpression: 'SET rollupApplied = :t', ExpressionAttributeValues: { ':t': true },
  }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run amplify/functions/crm-api/lib/emitTimelineEvent.test.ts`
Expected: PASS (create, auto-create, unresolved, and re-emit paths).

- [ ] **Step 5: Commit**

```bash
git add amplify/functions/crm-api/lib/emitTimelineEvent.ts amplify/functions/crm-api/lib/emitTimelineEvent.test.ts
git commit -m "feat(crm-api): emitTimelineEvent — auto-create org, rollupApplied guard, full re-emit projection"
```

---

## Task 12: `LinkAuditLog` storage helper (#6)

Delivers real audit-log storage in the Foundation so Plan 3's re-link flow just calls `writeLinkAuditLog`.

**Files:**
- Create: `amplify/functions/crm-api/lib/auditStore.ts`
- Test: `amplify/functions/crm-api/lib/auditStore.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
const mockSend = vi.fn();
vi.mock('./dynamodb', () => ({ docClient: { send: (...a: unknown[]) => mockSend(...a) }, TABLE_NAME: () => 'T' }));
vi.mock('./idGenerators', () => ({ generateAuditId: () => 'audit-x', generateOrgId: () => 'org-x' }));
import { writeLinkAuditLog } from './auditStore';
beforeEach(() => mockSend.mockReset());

describe('writeLinkAuditLog', () => {
  it('writes an immutable audit row with old/new org+contact, operator, reason, timestamp', async () => {
    mockSend.mockResolvedValueOnce({});
    const id = await writeLinkAuditLog({
      timelineEventId: 'tev-1', newOrgId: 'org-NEW', oldOrgId: 'org-OLD',
      oldContactId: null, newContactId: 'ct-2', operator: 'harvey', reason: 'manual re-link', timestamp: '2026-06-19T10:00:00Z',
    });
    expect(id).toBe('audit-x');
    const item = mockSend.mock.calls[0][0].input.Item;
    expect(item.PK).toBe('AUDIT#audit-x');
    expect(item.entityType).toBe('LINK_AUDIT');
    expect(item.oldOrgId).toBe('org-OLD');
    expect(item.newOrgId).toBe('org-NEW');
    expect(item.operator).toBe('harvey');
    expect(item.GSI2PK).toBe('ORG#org-NEW'); // indexed under the new org for per-org audit history
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run amplify/functions/crm-api/lib/auditStore.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```typescript
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from './dynamodb';
import { auditKeys } from './keys';
import { generateAuditId } from './idGenerators';
import type { LinkAuditLogItem } from './types';

export async function writeLinkAuditLog(args: {
  timelineEventId?: string | null; contactId?: string | null;
  oldOrgId?: string | null; newOrgId?: string | null;
  oldContactId?: string | null; newContactId?: string | null;
  operator: string; reason: string; timestamp: string;
}): Promise<string> {
  const id = generateAuditId();
  const orgForIndex = args.newOrgId ?? args.oldOrgId ?? null;
  const item: LinkAuditLogItem = {
    ...auditKeys({ id, orgId: orgForIndex, timestamp: args.timestamp }),
    entityType: 'LINK_AUDIT',
    id,
    timelineEventId: args.timelineEventId ?? null,
    contactId: args.contactId ?? null,
    orgId: orgForIndex,
    oldOrgId: args.oldOrgId ?? null, newOrgId: args.newOrgId ?? null,
    oldContactId: args.oldContactId ?? null, newContactId: args.newContactId ?? null,
    operator: args.operator, reason: args.reason, timestamp: args.timestamp,
  } as LinkAuditLogItem;
  await docClient.send(new PutCommand({ TableName: TABLE_NAME(), Item: item }));
  return id;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run amplify/functions/crm-api/lib/auditStore.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add amplify/functions/crm-api/lib/auditStore.ts amplify/functions/crm-api/lib/auditStore.test.ts
git commit -m "feat(crm-api): LinkAuditLog storage helper"
```

---

## Task 13: Schema types in `data/resource.ts` (no queries yet)

**Files:**
- Modify: `amplify/data/resource.ts`
- Test: `amplify/functions/crm-api/schema-shape.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const src = readFileSync(resolve(__dirname, '../../data/resource.ts'), 'utf8');

describe('data schema CRM customTypes', () => {
  it('defines TimelineEvent, Contact, LinkAuditLog', () => {
    expect(src).toMatch(/TimelineEvent:\s*a\.customType/);
    expect(src).toMatch(/Contact:\s*a\.customType/);
    expect(src).toMatch(/LinkAuditLog:\s*a\.customType/);
  });
  it('TimelineEvent reserves comms fields', () => {
    const block = src.slice(src.indexOf('TimelineEvent:'), src.indexOf('TimelineEvent:') + 1200);
    for (const f of ['direction', 'externalId', 'threadId', 'from', 'to', 'subject', 'bodySnippet']) {
      expect(block).toContain(f);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run amplify/functions/crm-api/schema-shape.test.ts`
Expected: FAIL — patterns not found.

- [ ] **Step 3: Add the customTypes**

In `amplify/data/resource.ts`, add these alongside the other customTypes (e.g. after `CustomerTimelineEntry`, before `Organization`). Note `rollupApplied` is intentionally **internal** (DynamoDB only) and not exposed here.

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
    from: a.string(),
    to: a.string(),
    subject: a.string(),
    bodySnippet: a.string(),
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

> Do **not** import `crmApi` here yet — there are no crm queries/mutations in this plan, and an unused import would fail lint. The import is added in Plan 2 alongside the first query.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run amplify/functions/crm-api/schema-shape.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck + lint**

Run: `npx tsc --noEmit -p amplify/tsconfig.json && npx eslint amplify/data/resource.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add amplify/data/resource.ts amplify/functions/crm-api/schema-shape.test.ts
git commit -m "feat(data): add TimelineEvent/Contact/LinkAuditLog customTypes (no queries yet)"
```

---

## Task 14: Foundation green-bar + checkpoint

- [ ] **Step 1: Run all affected suites**

Run: `npx vitest run amplify/functions/crm-api amplify/functions/order-api amplify/functions/logistics-api`
Expected: PASS — all foundation + prereq tests green, no regressions.

- [ ] **Step 2: Typecheck the backend**

Run: `npx tsc --noEmit -p amplify/tsconfig.json`
Expected: PASS.

- [ ] **Step 3: Lint the new function**

Run: `npx eslint amplify/functions/crm-api`
Expected: PASS (no unused vars, no `require`, no `any`-rule violations beyond the existing baseline).

- [ ] **Step 4: Checkpoint commit (if anything remains)**

```bash
git status
git add -A && git commit -m "chore(crm-api): P1 foundation complete — resolver + emit + storage, fully unit-tested" || echo "nothing to commit"
```

---

## Self-Review (against the spec)

**Spec coverage (Plan 1 scope; channel wiring/backfill/UI are Plans 2–3):**
- §3.1 `TimelineEvent` shape, GSIs, **reserved comms fields** (from/to/subject/bodySnippet), `rollupApplied` → Tasks 6, 13. ✓
- §3.2 `Contact` lightweight + email-derived id + distinct createdAt/firstSeenAt + P2-merge note → Tasks 6, 9. ✓
- §3.3 `Organization` rollups + **auto-created review org** (`status=review`, `createdByResolution`) → Task 10. ✓
- §3.4 `LinkAuditLog` storage helper → Task 12. ✓
- §3.5 deterministic ids w/ stable keys + legacy fallback → Tasks 1, 2, 5. ✓
- §4.1 resolution ladder, ordering, guards (free-domain, analytics-only auto-create, visitor_prior_event scope), **email_domain_new now materialized** → Tasks 8, 10, 11. ✓
- §4.2 contact resolution → Tasks 8, 9, 11. ✓
- §5.1 emit helper → Task 11. ✓
- §5.3 idempotency, **count-on-create-only + rollupApplied guard**, monotonic rollups, **full re-emit projection + re-link recompute** → Tasks 10, 11. ✓
- §10.1 stable-id prereq → Tasks 1, 2, 5. ✓
- §10.2 re-link recompute → `recomputeRollupsForOrg` (Task 10), invoked on link-change in emit (Task 11) and by Plan 3's manual re-link. ✓
- §10.8 contact-merge anticipation → Tasks 6, 9 notes. ✓

**Deferred to later plans (intentional):** channel emit wiring (§5.2), analytics session-close job (§4.3), paginated backfill (§6), hot/cold sweep + `rollupApplied=false` compensation (§7.2), Needs-Linking/Review queues + re-link UI + audit *writes-on-action* (§7.3), 360 UI + server-side `internalOnly` (§8.1), CRM Health (§7.4).

**Placeholder scan:** none — every code step has complete code + a runnable command.

**Type consistency:** `ResolveResult`/`ResolveInput` (Tasks 6/8), `TimelineIdInput` (Tasks 5/11), `EmitArgs` (Task 11), `TimelineEventItem`/`ContactItem`/`LinkAuditLogItem` (Task 6) used consistently. `createReviewOrgFromDomain`/`bumpOrgRollupOnCreate`/`recomputeRollupsForOrg` (Task 10) ← emit (Task 11). `getTimelineEvent` (Task 7) ← emit duplicate path. `auditKeys`/`generateAuditId` (Tasks 6/3) ← `writeLinkAuditLog` (Task 12).

**Review fixes applied (round 1):** (1) `email_domain_new` materialized via `createReviewOrgFromDomain` — Tasks 10/11; (2) full re-emit projection + re-link recompute — Task 11; (3) `rollupApplied` guard — Tasks 6/11; (4) sparse GSI1 (unresolved only) — Task 6; (5) reserved comms fields — Tasks 6/13; (6) `LinkAuditLog` storage helper — Task 12; (7) contact derived from `resolveInput.email` — Task 11; minors: top-level `import crypto` (Task 6), distinct createdAt/firstSeenAt (Task 9), paginated recompute (Task 10), no unused vars (Task 10).

**Review fixes applied (round 2):** (A) auto-create also writes the `OrgNameIndex` so `organization_name_match` works pre-Plan-2 — Task 10; (B) duplicate re-emit with `rollupApplied=false` compensates the missing bump and marks it applied — Task 11; (C) `internalOnly` events never advance `Organization.lastActivityAt` (in both `bumpOrgRollupOnCreate` and `recomputeRollupsForOrg`); counts/latest dates are unaffected since they map to external kinds — Task 10.

---

## Plans 2 & 3 (outline — separate plan docs to be written next)

**Plan 2 — Channel wiring + backfill + sweep:**
- Wire `emitTimelineEvent` after each source commit: `order-api` (created/stage via the new `olog-` id / quote-doc), RFQ + Lead submit paths, `logistics-api` (milestone via `mlog-` id), and a scheduled **analytics session rollup** (30-min inactivity close, one `site_visit_session` per `sessionId`, signal threshold).
- `OrgDomainIndex`/`OrgNameIndex` maintenance on the existing `organizationApi` org create/alias path (so `email_domain_exact`/`organization_name_match` hit for non-auto-created orgs too).
  - **SEQUENCING DEPENDENCY (from PR #223 review):** these indexes are empty in P1. Plan 2 MUST **backfill `OrgDomainIndex`/`OrgNameIndex` from all existing `ORG#…/META` orgs BEFORE enabling `email_domain_new` auto-create in the wired channels** — otherwise an event for an existing org's domain (whose index row was never written) resolves to `email_domain_new` and `createReviewOrgFromDomain` mints a **duplicate** real org. Gate auto-create behind "indexes backfilled" or run the backfill as the first Plan 2 step.
  - Note: CRM org rows are keyed `ORG#<id>/SK=META` (shared with `organization-api`); the `ORGDOMAIN#`/`ORGNAME#` index items keep `SK='A'` (CRM-owned partitions).
- Paginated `runTimelineBackfill` mutation (`{nextCursor,processedCount,hasMore}`) + `scripts/backfill-timeline.ts` driver + dry-run report.
- Two-tier reconciliation sweep (hot 15-min: recent/`timelineSynced=false`/`rollupApplied=false`; cold daily: existence-based sharded audit), guarded `if (!isSandbox)`.

**Plan 3 — Admin UI + linking/audit:**
- Upgrade `OrganizationDetailPage`/`OrgDetail` to read `byOrg` TimelineEvent; resolution badges; **server-side `internalOnly` enforcement** (default-exclude; admin `includeInternalOnly=true`).
- Manual `note`/`call`/`email_manual` entry mutation.
- Needs-Linking + Review-New-Orgs queues; re-link → `manually_linked`+`linkLocked`, `recomputeRollupsForOrg(old)+(new)`, **`writeLinkAuditLog`**; bulk apply-to-domain corporate-only.
- CRM Health panel (unresolved rate, auto-create rate, sweep re-emits, rollup drift).
