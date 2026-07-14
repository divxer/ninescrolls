# Quotation & Price Book System — P1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Internal price book + quotation drafting inside the existing admin backend: admin-gated price-api Lambda, six-entity DynamoDB model, deterministic pricing engine, and three admin pages — ending at "generate and persist a complete quotation snapshot" (max status `DRAFT`).

**Architecture:** New `price-api` Lambda follows the logistics-api pattern exactly (single dispatcher handler → per-domain resolver modules → shared single DynamoDB table `INTELLIGENCE_TABLE`, GSI1 partition-merge listing, never Scan). Pricing/allocation/compatibility are pure functions in `lib/` with no AWS imports. All operations require the Cognito `admin` group, verified server-side in the handler. Frontend adds a thin service layer + three lazy-loaded admin pages.

**Tech Stack:** Amplify Gen 2 (defineFunction/defineAuth), AppSync custom queries/mutations with `a.json()` payloads, `@aws-sdk/lib-dynamodb` (TransactWriteCommand), React + react-router, Vitest.

**Spec:** `docs/superpowers/specs/2026-07-13-quotation-pricebook-design.md` — normative for every protocol below. Read it before starting.

---

## Locked decisions (do not re-litigate during implementation)

1. **Payload style**: price-api operations take `input: a.json()` and return `a.json()` — the resolver parses `string | object` exactly like `createLogisticsCase` does, and the frontend service unwraps with `unwrapPayload`. No AppSync custom types for this API (14 operations; JSON keeps the schema surface small; admin-only single consumer).
2. **Operation names** are prefixed `pb` (price book) to avoid schema collisions: `pbListSuppliers`, `pbCreateSupplier`, `pbUpdateSupplier`, `pbListCatalogItems`, `pbCreateCatalogItem`, `pbUpdateCatalogItem`, `pbAppendCostVersion`, `pbListCostVersions`, `pbGetPricingPolicy`, `pbUpdatePricingPolicy`, `pbCreateQuotationDraft`, `pbUpdateQuotationDraft`, `pbGetQuotation`, `pbListQuotations`.
3. **Money is integer minor units everywhere**: RMB costs in fen, USD prices in cents, FX as `fxRmbPerUsdMilli` (7250 = 7.25 RMB/USD), margins in basis points (3500 = 35%). No floats in money math.
4. **Typed errors** are thrown as `Error` whose message starts with a code token: `UNAUTHORIZED:`, `CONFLICT:`, `VALIDATION:`, `NOT_FOUND:`. Frontend surfaces them as-is.
5. **Key design** (single table, GSI1 only — the table has no other GSI):

| Entity | PK | SK | GSI1PK | GSI1SK |
|---|---|---|---|---|
| Supplier | `PSUP#{supplierId}` | `META` | `SUPPLIERS` | `{createdAt}#{supplierId}` |
| CatalogItem | `PCAT#{itemId}` | `META` | `CATALOG_ITEMS` | `{series}#{sku}` |
| CostVersion | `PCAT#{itemId}` | `COST#{supplierId}#{effectiveFrom}` | — | — |
| Cost guard | `PCAT#{itemId}` | `COSTGUARD#{supplierId}` | — | — |
| PricingPolicy | `PRICING_POLICY` | `META` | — | — |
| Quotation counter | `COUNTER#QUOTATION` | `YEAR#{year}` | — | — |
| Scheme | `PQUO#{quotationNumber}` | `SCHEME` | `RFQ_QUOTES#{rfqId\|NONE}` | `{createdAt}#{quotationNumber}` |
| Version header | `PQUO#{quotationNumber}` | `V#{version, 3-digit}` | `QUOTATIONS` | `{updatedAt}#{quotationNumber}#v{version}` |
| Line | `PQUO#{quotationNumber}` | `V#{v3}#LINE#{2-digit lineNo}` | — | — |

6. **45-line cap** on quotations (spec transactional invariant 3). Enforced in create and update with `VALIDATION:` errors.
7. P1 quotation status is **always `DRAFT`**. No PDF, no `GENERATED`, no timeline emit, no RFQ page changes — those are P2.
8. **Invoke boundary**: the AppSync resolver role is the ONLY business caller of price-api. The function is never granted `lambda:InvokeFunction` to other Lambdas, IAM users, or public principals, and is never added to any cross-Lambda invoke loop in `backend.ts`. The admin gate trusts `event.identity` because AppSync verified the JWT — a direct invoker could fabricate `identity.groups`, so direct invocation must stay impossible. Any P2 need for cross-Lambda calls goes through AppSync or gets its own signature verification.

## File structure

```
amplify/auth/resource.ts                                 (modify: groups)
amplify/functions/price-api/resource.ts                  (new)
amplify/functions/price-api/handler.ts                   (new: dispatch + admin gate)
amplify/functions/price-api/lib/dynamodb.ts              (new: docClient + TABLE_NAME)
amplify/functions/price-api/lib/adminAuth.ts             (new + test)
amplify/functions/price-api/lib/ids.ts                   (new + test)
amplify/functions/price-api/lib/pricing.ts               (new + test: pure engine)
amplify/functions/price-api/lib/allocation.ts            (new + test: pure)
amplify/functions/price-api/lib/compatibility.ts         (new + test: pure)
amplify/functions/price-api/lib/types.ts                 (new: item types + response mappers)
amplify/functions/price-api/lib/testing/fakeDdb.ts        (new: conditional-write fake + race gate)
amplify/functions/price-api/resolvers/supplierResolvers.ts      (new + test)
amplify/functions/price-api/resolvers/catalogResolvers.ts       (new + test)
amplify/functions/price-api/resolvers/costVersionResolvers.ts   (new + test)
amplify/functions/price-api/resolvers/policyResolvers.ts        (new + test)
amplify/functions/price-api/resolvers/quotationResolvers.ts     (new + test)
amplify/functions/price-api/resolvers/concurrency.test.ts       (new: exactly-one-wins invariants)
amplify/data/resource.ts                                 (modify: 14 pb* operations)
amplify/backend.ts                                       (modify: register + grants)
src/services/priceAdminService.ts                        (new + test)
src/pages/admin/SuppliersPage.tsx                        (new + test)
src/pages/admin/PriceBookPage.tsx                        (new + test)
src/pages/admin/QuotationWorkbenchPage.tsx               (new + test)
src/pages/admin/QuotationListPage.tsx                    (new + test)
src/routes/AdminRoutes.tsx                               (modify: 4 routes)
src/components/admin/AdminLayout.tsx                     (modify: 2 nav links)
scripts/add-admin-user.ts                                (new)
scripts/lib/csv.ts                                       (new + test: RFC4180 parser + fen math)
scripts/import-supplier-prices.ts                        (new)
tsconfig.scripts.json                                    (modify: include new scripts)
```

Run all backend tests with: `npx vitest run amplify/functions/price-api --exclude '**/.claude/**'`

---

### Task 1: Cognito admin group + server-side admin gate

**Files:**
- Modify: `amplify/auth/resource.ts`
- Create: `amplify/functions/price-api/lib/adminAuth.ts`
- Test: `amplify/functions/price-api/lib/adminAuth.test.ts`
- Create: `scripts/add-admin-user.ts`

- [ ] **Step 1: Add the admin group to defineAuth**

Replace the whole content of `amplify/auth/resource.ts`:

```ts
import { defineAuth } from '@aws-amplify/backend';

export const auth = defineAuth({
  loginWith: { email: true },
  // 'admin' group gates price-api (cost & supplier data are OEM-confidential).
  // Membership is managed via scripts/add-admin-user.ts — run against BOTH the
  // sandbox and prod pools before the price-book feature is usable.
  groups: ['admin'],
});
```

- [ ] **Step 2: Write the failing test for requireAdmin**

Create `amplify/functions/price-api/lib/adminAuth.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { requireAdmin } from './adminAuth.js';

const base = { info: { fieldName: 'x', parentTypeName: 'Query' }, arguments: {} };

describe('requireAdmin', () => {
  it('passes when identity.groups contains admin', () => {
    expect(() => requireAdmin({ ...base, identity: { sub: 's', groups: ['admin'] } })).not.toThrow();
  });

  it('passes when cognito:groups claim contains admin (string form)', () => {
    expect(() => requireAdmin({
      ...base, identity: { sub: 's', claims: { 'cognito:groups': 'admin' } },
    })).not.toThrow();
  });

  it('passes when cognito:groups claim contains admin (array form)', () => {
    expect(() => requireAdmin({
      ...base, identity: { sub: 's', claims: { 'cognito:groups': ['viewer', 'admin'] } },
    })).not.toThrow();
  });

  it('rejects an authenticated caller without the group', () => {
    expect(() => requireAdmin({ ...base, identity: { sub: 's', claims: { email: 'a@b.c' } } }))
      .toThrow(/^UNAUTHORIZED:/);
  });

  it('rejects when identity is missing entirely', () => {
    expect(() => requireAdmin(base)).toThrow(/^UNAUTHORIZED:/);
  });
});
```

- [ ] **Step 3: Run the test — verify it fails**

Run: `npx vitest run amplify/functions/price-api/lib/adminAuth.test.ts --exclude '**/.claude/**'`
Expected: FAIL — cannot find module `./adminAuth.js`.

- [ ] **Step 4: Implement requireAdmin**

Create `amplify/functions/price-api/lib/adminAuth.ts`:

```ts
export interface PriceApiIdentity {
  sub?: string;
  username?: string;
  groups?: string[] | null;
  claims?: Record<string, unknown>;
}

export interface PriceApiEvent {
  info: { fieldName: string; parentTypeName: string };
  arguments: Record<string, unknown>;
  identity?: PriceApiIdentity;
}

function claimGroups(claims: Record<string, unknown> | undefined): string[] {
  const raw = claims?.['cognito:groups'];
  if (Array.isArray(raw)) return raw.map(String);
  // Lambda-authorizer / some invoke paths serialize the claim as a single
  // space- or comma-separated string.
  if (typeof raw === 'string') return raw.split(/[\s,]+/).filter(Boolean);
  return [];
}

/**
 * Server-side trust boundary (spec: "Scope boundaries"). allow.authenticated()
 * only proves login; cost & supplier data require the Cognito 'admin' group.
 * Throws UNAUTHORIZED on any caller whose verified JWT lacks the group.
 */
export function requireAdmin(event: PriceApiEvent): void {
  const id = event.identity;
  const groups = [...(id?.groups ?? []), ...claimGroups(id?.claims)];
  if (!id || !groups.includes('admin')) {
    throw new Error('UNAUTHORIZED: admin group required for price-api operations');
  }
}
```

- [ ] **Step 5: Run the test — verify it passes**

Run: `npx vitest run amplify/functions/price-api/lib/adminAuth.test.ts --exclude '**/.claude/**'`
Expected: 5 passed.

- [ ] **Step 6: Write the membership script**

Create `scripts/add-admin-user.ts`:

```ts
/**
 * Add a Cognito user to the 'admin' group (price-api trust boundary).
 *
 * Usage:
 *   npx tsx scripts/add-admin-user.ts <email> [--pool <userPoolId>]
 *
 * Pool defaults to amplify_outputs.json auth.user_pool_id (i.e. whatever
 * backend the local outputs point at). Pass --pool us-east-2_3AE21gHBg to
 * target prod explicitly. Requires AWS credentials with
 * cognito-idp:AdminAddUserToGroup.
 *
 * P1 deployment prerequisite (spec): run against BOTH sandbox and prod pools;
 * the owner's account must be a member before the feature is usable.
 */
import {
  CognitoIdentityProviderClient,
  AdminAddUserToGroupCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const email = args.find((a) => !a.startsWith('--'));
const poolFlag = args.indexOf('--pool');
if (!email) {
  console.error('Usage: npx tsx scripts/add-admin-user.ts <email> [--pool <userPoolId>]');
  process.exit(1);
}

// Only touch amplify_outputs.json when --pool is absent — with an explicit pool
// the script must work in worktrees/CI where local outputs don't exist.
const userPoolId: string = poolFlag >= 0
  ? args[poolFlag + 1]
  : JSON.parse(readFileSync(new URL('../amplify_outputs.json', import.meta.url), 'utf8')).auth.user_pool_id;
const region = userPoolId.split('_')[0];

const client = new CognitoIdentityProviderClient({ region });
await client.send(new AdminAddUserToGroupCommand({
  UserPoolId: userPoolId,
  Username: email,
  GroupName: 'admin',
}));
console.log(`Added ${email} to 'admin' group in pool ${userPoolId}`);
```

- [ ] **Step 7: Put the script under real typecheck NOW (not in Task 18)**

Add `scripts/add-admin-user.ts` to the `include` array of `tsconfig.scripts.json` (currently `["scripts/generate-equipment-guide.ts", "src/**/*.ts"]`):

```json
  "include": [
    "scripts/generate-equipment-guide.ts",
    "scripts/add-admin-user.ts",
    "src/**/*.ts"
  ]
```

Then run: `npx tsc --noEmit -p tsconfig.scripts.json`
Expected: no errors. (Task 18 later appends its CSV files to this same array.) Do not run the script against a real pool during implementation.

- [ ] **Step 8: Commit**

```bash
git add amplify/auth/resource.ts amplify/functions/price-api/lib/adminAuth.ts amplify/functions/price-api/lib/adminAuth.test.ts scripts/add-admin-user.ts tsconfig.scripts.json
git commit -m "feat(price-api): cognito admin group + server-side admin gate"
```

---

### Task 2: price-api skeleton — resource, dynamodb lib, dispatcher with admin gate

**Files:**
- Create: `amplify/functions/price-api/resource.ts`
- Create: `amplify/functions/price-api/lib/dynamodb.ts`
- Create: `amplify/functions/price-api/handler.ts`
- Test: `amplify/functions/price-api/handler.test.ts`

- [ ] **Step 1: Create the function resource**

Create `amplify/functions/price-api/resource.ts`:

```ts
import { defineFunction } from '@aws-amplify/backend';

export const priceApi = defineFunction({
  name: 'price-api',
  // Pinned to the data stack for the same reason as order-api/logistics-api:
  // this Lambda is an AppSync data resolver; leaving it in the generic function
  // stack creates a data->function edge that has produced CloudFormation cycles
  // before (see logistics-api/resource.ts).
  resourceGroupName: 'data',
  entry: './handler.ts',
  runtime: 22,
  timeoutSeconds: 30,
  memoryMB: 512,
});
```

- [ ] **Step 2: Create the dynamodb lib**

Create `amplify/functions/price-api/lib/dynamodb.ts`:

```ts
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const ddbClient = new DynamoDBClient({});
export const docClient = DynamoDBDocumentClient.from(ddbClient);

export const TABLE_NAME = () => process.env.INTELLIGENCE_TABLE!;
```

- [ ] **Step 3: Write the failing dispatcher test**

Create `amplify/functions/price-api/handler.test.ts`. The resolver modules don't exist yet, so mock every one of them — the test pins the dispatch + gate contract:

```ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('./resolvers/supplierResolvers.js', () => ({
  pbListSuppliers: vi.fn(async () => ({ items: [] })),
  pbCreateSupplier: vi.fn(async () => ({ supplierId: 's1' })),
  pbUpdateSupplier: vi.fn(async () => ({ supplierId: 's1' })),
}));
vi.mock('./resolvers/catalogResolvers.js', () => ({
  pbListCatalogItems: vi.fn(async () => ({ items: [] })),
  pbCreateCatalogItem: vi.fn(async () => ({})),
  pbUpdateCatalogItem: vi.fn(async () => ({})),
}));
vi.mock('./resolvers/costVersionResolvers.js', () => ({
  pbAppendCostVersion: vi.fn(async () => ({})),
  pbListCostVersions: vi.fn(async () => ({ items: [] })),
}));
vi.mock('./resolvers/policyResolvers.js', () => ({
  pbGetPricingPolicy: vi.fn(async () => ({})),
  pbUpdatePricingPolicy: vi.fn(async () => ({})),
}));
vi.mock('./resolvers/quotationResolvers.js', () => ({
  pbCreateQuotationDraft: vi.fn(async () => ({})),
  pbUpdateQuotationDraft: vi.fn(async () => ({})),
  pbGetQuotation: vi.fn(async () => ({})),
  pbListQuotations: vi.fn(async () => ({ items: [] })),
}));

import { handler } from './handler.js';
import * as supplierResolvers from './resolvers/supplierResolvers.js';
import * as catalogResolvers from './resolvers/catalogResolvers.js';
import * as costVersionResolvers from './resolvers/costVersionResolvers.js';
import * as policyResolvers from './resolvers/policyResolvers.js';
import * as quotationResolvers from './resolvers/quotationResolvers.js';
import { beforeEach, type Mock } from 'vitest';

const adminIdentity = { sub: 's', groups: ['admin'] };
const nonAdminIdentity = { sub: 's', claims: { email: 'x@y.z' } };

// The COMPLETE operation surface — must match handler.ts's resolver map exactly.
const ALL_OPS = [
  'pbListSuppliers', 'pbCreateSupplier', 'pbUpdateSupplier',
  'pbListCatalogItems', 'pbCreateCatalogItem', 'pbUpdateCatalogItem',
  'pbAppendCostVersion', 'pbListCostVersions',
  'pbGetPricingPolicy', 'pbUpdatePricingPolicy',
  'pbCreateQuotationDraft', 'pbUpdateQuotationDraft', 'pbGetQuotation', 'pbListQuotations',
] as const;

const resolverMocks = {
  ...supplierResolvers, ...catalogResolvers, ...costVersionResolvers,
  ...policyResolvers, ...quotationResolvers,
} as unknown as Record<string, Mock>;

beforeEach(() => Object.values(resolverMocks).forEach((f) => f.mockClear()));

describe('price-api handler', () => {
  it('dispatches by fieldName for an admin caller', async () => {
    const res = await handler({
      info: { fieldName: 'pbListSuppliers', parentTypeName: 'Query' },
      arguments: {},
      identity: adminIdentity,
    });
    expect(res).toEqual({ items: [] });
  });

  it('normalizes the Gen-2 top-level fieldName shape', async () => {
    const res = await handler({
      fieldName: 'pbListSuppliers', typeName: 'Query', arguments: {}, identity: adminIdentity,
    });
    expect(res).toEqual({ items: [] });
  });

  // Table-driven: all 14 operations × both event shapes; the resolver must
  // NEVER execute on a rejected call.
  it.each(ALL_OPS)('rejects non-admin for %s in both event shapes, without dispatch', async (op) => {
    await expect(handler({
      info: { fieldName: op, parentTypeName: 'Query' }, arguments: {}, identity: nonAdminIdentity,
    })).rejects.toThrow(/^UNAUTHORIZED:/);
    await expect(handler({
      fieldName: op, typeName: 'Query', arguments: {}, identity: nonAdminIdentity,
    })).rejects.toThrow(/^UNAUTHORIZED:/);
    expect(resolverMocks[op]).not.toHaveBeenCalled();
  });

  it('covers the full resolver map (guards against adding an op without gate coverage)', () => {
    expect(Object.keys(resolverMocks).sort()).toEqual([...ALL_OPS].sort());
  });

  it('throws on unknown field', async () => {
    await expect(handler({
      info: { fieldName: 'nope', parentTypeName: 'Query' }, arguments: {}, identity: adminIdentity,
    })).rejects.toThrow(/No resolver/);
  });
});
```

- [ ] **Step 4: Run the test — verify it fails**

Run: `npx vitest run amplify/functions/price-api/handler.test.ts --exclude '**/.claude/**'`
Expected: FAIL — cannot find `./handler.js`.

- [ ] **Step 5: Implement the dispatcher**

Create `amplify/functions/price-api/handler.ts`:

```ts
import { requireAdmin, type PriceApiEvent } from './lib/adminAuth.js';
import { pbListSuppliers, pbCreateSupplier, pbUpdateSupplier } from './resolvers/supplierResolvers.js';
import { pbListCatalogItems, pbCreateCatalogItem, pbUpdateCatalogItem } from './resolvers/catalogResolvers.js';
import { pbAppendCostVersion, pbListCostVersions } from './resolvers/costVersionResolvers.js';
import { pbGetPricingPolicy, pbUpdatePricingPolicy } from './resolvers/policyResolvers.js';
import {
  pbCreateQuotationDraft, pbUpdateQuotationDraft, pbGetQuotation, pbListQuotations,
} from './resolvers/quotationResolvers.js';

interface RawEvent {
  info?: { fieldName?: string; parentTypeName?: string };
  fieldName?: string;
  typeName?: string;
  arguments?: unknown;
  identity?: unknown;
  [key: string]: unknown;
}

const resolvers: Record<string, (event: never) => Promise<unknown>> = {
  pbListSuppliers, pbCreateSupplier, pbUpdateSupplier,
  pbListCatalogItems, pbCreateCatalogItem, pbUpdateCatalogItem,
  pbAppendCostVersion, pbListCostVersions,
  pbGetPricingPolicy, pbUpdatePricingPolicy,
  pbCreateQuotationDraft, pbUpdateQuotationDraft, pbGetQuotation, pbListQuotations,
};

export const handler = async (event: RawEvent) => {
  const fieldName = event.info?.fieldName ?? event.fieldName;
  if (!fieldName) {
    console.error('price-api: full event:', JSON.stringify(event));
    throw new Error(`Cannot determine fieldName. Event keys: ${Object.keys(event).join(', ')}`);
  }
  const resolver = resolvers[fieldName];
  if (!resolver) throw new Error(`No resolver for field: ${fieldName}`);

  const normalized = (event.info
    ? event
    : { ...event, info: { fieldName, parentTypeName: event.typeName }, arguments: event.arguments }
  ) as unknown as PriceApiEvent;

  // Trust boundary: EVERY price-api operation is admin-gated (spec). No
  // per-resolver opt-out — the gate lives here, before any dispatch.
  requireAdmin(normalized);

  return resolver(normalized as never);
};
```

- [ ] **Step 6: Create empty resolver modules so the import graph resolves**

The real implementations come in Tasks 7–12; the mocks in this task's test bypass them, but `handler.ts` must import real files for the later non-mocked builds. Create each of the five resolver files with typed stubs that throw. Example — `amplify/functions/price-api/resolvers/supplierResolvers.ts`:

```ts
import type { PriceApiEvent } from '../lib/adminAuth.js';

export async function pbListSuppliers(_event: PriceApiEvent): Promise<unknown> {
  throw new Error('NOT_IMPLEMENTED: pbListSuppliers');
}
export async function pbCreateSupplier(_event: PriceApiEvent): Promise<unknown> {
  throw new Error('NOT_IMPLEMENTED: pbCreateSupplier');
}
export async function pbUpdateSupplier(_event: PriceApiEvent): Promise<unknown> {
  throw new Error('NOT_IMPLEMENTED: pbUpdateSupplier');
}
```

Create the matching stubs (same shape, correct export names from Step 5's import list) in:
- `resolvers/catalogResolvers.ts` — `pbListCatalogItems`, `pbCreateCatalogItem`, `pbUpdateCatalogItem`
- `resolvers/costVersionResolvers.ts` — `pbAppendCostVersion`, `pbListCostVersions`
- `resolvers/policyResolvers.ts` — `pbGetPricingPolicy`, `pbUpdatePricingPolicy`
- `resolvers/quotationResolvers.ts` — `pbCreateQuotationDraft`, `pbUpdateQuotationDraft`, `pbGetQuotation`, `pbListQuotations`

Each stub throws `NOT_IMPLEMENTED: <name>` — Tasks 7–12 replace them file by file.

- [ ] **Step 7: Run the test — verify it passes**

Run: `npx vitest run amplify/functions/price-api/handler.test.ts --exclude '**/.claude/**'`
Expected: 18 passed (2 dispatch + 14 table-driven rejections + map-coverage + unknown-field).

- [ ] **Step 8: Commit**

```bash
git add amplify/functions/price-api
git commit -m "feat(price-api): function skeleton with admin-gated dispatcher"
```

---

### Task 3: ID generators and quotation-number formatting

**Files:**
- Create: `amplify/functions/price-api/lib/ids.ts`
- Test: `amplify/functions/price-api/lib/ids.test.ts`

- [ ] **Step 1: Write the failing test**

Create `amplify/functions/price-api/lib/ids.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  generateSupplierId, generateCatalogItemId, formatQuotationNumber, versionSk, lineSk,
} from './ids.js';

describe('ids', () => {
  it('prefixes entity ids', () => {
    expect(generateSupplierId()).toMatch(/^sup-/);
    expect(generateCatalogItemId()).toMatch(/^cat-/);
    expect(generateSupplierId()).not.toBe(generateSupplierId());
  });

  it('formats quotation numbers as Q-YYYY-NNNN', () => {
    expect(formatQuotationNumber(2026, 1)).toBe('Q-2026-0001');
    expect(formatQuotationNumber(2026, 123)).toBe('Q-2026-0123');
    expect(formatQuotationNumber(2027, 10000)).toBe('Q-2027-10000'); // >4 digits never truncates
  });

  it('zero-pads sort keys so DDB lexical order equals numeric order', () => {
    expect(versionSk(1)).toBe('V#001');
    expect(versionSk(12)).toBe('V#012');
    expect(lineSk(3, 7)).toBe('V#003#LINE#07');
    expect(lineSk(3, 45)).toBe('V#003#LINE#45');
  });
});
```

- [ ] **Step 2: Run — verify FAIL** (`ids.js` not found)

Run: `npx vitest run amplify/functions/price-api/lib/ids.test.ts --exclude '**/.claude/**'`

- [ ] **Step 3: Implement**

Create `amplify/functions/price-api/lib/ids.ts`:

```ts
import { randomUUID } from 'node:crypto';

const short = () => randomUUID().replace(/-/g, '').slice(0, 12);

export const generateSupplierId = () => `sup-${short()}`;
export const generateCatalogItemId = () => `cat-${short()}`;

/** Q-2026-0001 — sequential per year (spec: LogisticsCase numbering precedent). */
export const formatQuotationNumber = (year: number, seq: number) =>
  `Q-${year}-${String(seq).padStart(4, '0')}`;

/** Zero-padded so base-table Query returns versions/lines in order. */
export const versionSk = (version: number) => `V#${String(version).padStart(3, '0')}`;
export const lineSk = (version: number, lineNo: number) =>
  `${versionSk(version)}#LINE#${String(lineNo).padStart(2, '0')}`;
```

- [ ] **Step 4: Run — verify PASS**, then **commit**

```bash
git add amplify/functions/price-api/lib/ids.ts amplify/functions/price-api/lib/ids.test.ts
git commit -m "feat(price-api): id generators and quotation number format"
```

---

### Task 4: Pricing engine — margin, FX, rounding, unknown-cost propagation

Pure functions, no AWS imports. Spec section "Pricing calculation" is normative: margin on selling price (`price = cost / (1 − margin)`), override precedence item → series → global, missing cost ⇒ `unknown` (null), never zero.

**Files:**
- Create: `amplify/functions/price-api/lib/pricing.ts`
- Test: `amplify/functions/price-api/lib/pricing.test.ts`

- [ ] **Step 1: Write the failing test**

Create `amplify/functions/price-api/lib/pricing.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { priceLine, priceQuotation, type PolicyData, type EngineLineInput } from './pricing.js';

const policy: PolicyData = {
  fxRmbPerUsdMilli: 7250,          // 7.25 RMB/USD
  defaultMarginBp: 3500,           // 35%
  minMarginBp: 2000,               // 20%
  roundingGranularityUsdCents: 10000, // $100
  seriesOverrides: { RIE: 4000 },
  itemOverrides: { 'RIE-CHUCK-6': 4500 },
};

const normal = (over: Partial<EngineLineInput>): EngineLineInput => ({
  sku: 'X', series: 'GEN', qty: 1, lineType: 'NORMAL', unitCostFen: 725_000, ...over,
});

describe('priceLine', () => {
  it('converts fen→cents and applies the default margin on selling price', () => {
    // 725000 fen = 7250 RMB = $1000 = 100000 cents; /(1-0.35) = 153846 cents
    const r = priceLine(normal({}), policy);
    expect(r.unitCostUsdCents).toBe(100_000);
    expect(r.marginBpApplied).toBe(3500);
    expect(r.suggestedUnitUsdCents).toBe(153_846);
  });

  it('override precedence: item beats series beats global', () => {
    expect(priceLine(normal({ series: 'RIE' }), policy).marginBpApplied).toBe(4000);
    expect(priceLine(normal({ series: 'RIE', sku: 'RIE-CHUCK-6' }), policy).marginBpApplied).toBe(4500);
  });

  it('missing cost yields unknown (null), never zero', () => {
    const r = priceLine(normal({ unitCostFen: null }), policy);
    expect(r.unitCostUsdCents).toBeNull();
    expect(r.suggestedUnitUsdCents).toBeNull();
  });

  it('surcharge lines pass through their USD amount with no margin', () => {
    const r = priceLine(
      { sku: 'FREIGHT', series: 'SVC', qty: 1, lineType: 'SURCHARGE', unitCostFen: null, surchargeUsdCents: 250_000 },
      policy,
    );
    expect(r.suggestedUnitUsdCents).toBe(250_000);
    expect(r.marginBpApplied).toBe(0);
  });
});

describe('priceQuotation', () => {
  it('totals lines by qty and rounds the suggested total to granularity, keeping both values', () => {
    const r = priceQuotation([normal({ qty: 2 })], policy);
    // per unit 153846 × 2 = 307692 → rounds to 310000 ($3100)
    expect(r.suggestedTotalRawUsdCents).toBe(307_692);
    expect(r.suggestedTotalUsdCents).toBe(310_000);
    expect(r.totalCostUsdCents).toBe(200_000);
  });

  it('any unknown-cost NORMAL line makes cost and margin unknown for the whole quote', () => {
    const r = priceQuotation([normal({}), normal({ sku: 'Y', unitCostFen: null })], policy);
    expect(r.totalCostUsdCents).toBeNull();
    expect(r.suggestedTotalUsdCents).toBeNull();
    expect(r.actualMarginBp).toBeNull();
    expect(r.incomplete).toBe(true);
  });

  it('computes actual margin from actual prices when provided', () => {
    const line = { ...normal({}), actualUnitUsdCents: 125_000 };
    const r = priceQuotation([line], policy);
    // margin = (125000-100000)/125000 = 20% = 2000bp
    expect(r.actualMarginBp).toBe(2000);
    expect(r.belowMinMargin).toBe(false);
  });

  it('flags below-minimum margin but never blocks', () => {
    const line = { ...normal({}), actualUnitUsdCents: 110_000 }; // ≈9.1%
    const r = priceQuotation([line], policy);
    expect(r.belowMinMargin).toBe(true);
  });
});
```

- [ ] **Step 2: Run — verify FAIL**

Run: `npx vitest run amplify/functions/price-api/lib/pricing.test.ts --exclude '**/.claude/**'`

- [ ] **Step 3: Implement**

Create `amplify/functions/price-api/lib/pricing.ts`:

```ts
/** Pure pricing engine. Integer minor units only (spec: "Pricing calculation"). */

export interface PolicyData {
  fxRmbPerUsdMilli: number;            // 7250 = 7.25 RMB per USD
  defaultMarginBp: number;             // margin ON SELLING PRICE, basis points
  minMarginBp: number;
  roundingGranularityUsdCents: number; // e.g. 10000 = $100
  seriesOverrides: Record<string, number>;
  itemOverrides: Record<string, number>;
}

export interface EngineLineInput {
  sku: string;
  series: string;
  qty: number;
  lineType: 'NORMAL' | 'SURCHARGE';
  unitCostFen: number | null;          // null = cost missing/expired-with-no-cover
  surchargeUsdCents?: number;          // SURCHARGE lines: pass-through USD amount
  actualUnitUsdCents?: number | null;  // manual override, if any
}

export interface PricedLine {
  unitCostUsdCents: number | null;
  marginBpApplied: number;
  suggestedUnitUsdCents: number | null;
}

export interface QuotationPricing {
  totalCostUsdCents: number | null;
  suggestedTotalRawUsdCents: number | null;
  suggestedTotalUsdCents: number | null; // rounded to granularity
  actualTotalUsdCents: number | null;    // sum of actual (or suggested) unit prices × qty
  actualMarginBp: number | null;
  belowMinMargin: boolean;
  incomplete: boolean;                   // any NORMAL line with unknown cost
}

const fenToUsdCents = (fen: number, fxMilli: number) => Math.round((fen * 1000) / fxMilli);

function resolveMarginBp(line: EngineLineInput, p: PolicyData): number {
  if (line.lineType === 'SURCHARGE') return 0; // cost pass-through by default (spec)
  if (line.sku in p.itemOverrides) return p.itemOverrides[line.sku];
  if (line.series in p.seriesOverrides) return p.seriesOverrides[line.series];
  return p.defaultMarginBp;
}

export function priceLine(line: EngineLineInput, p: PolicyData): PricedLine {
  const marginBpApplied = resolveMarginBp(line, p);
  if (line.lineType === 'SURCHARGE') {
    return {
      unitCostUsdCents: line.unitCostFen == null ? null : fenToUsdCents(line.unitCostFen, p.fxRmbPerUsdMilli),
      marginBpApplied,
      suggestedUnitUsdCents: line.surchargeUsdCents ?? null,
    };
  }
  if (line.unitCostFen == null) {
    // Missing cost is UNKNOWN, never zero (spec).
    return { unitCostUsdCents: null, marginBpApplied, suggestedUnitUsdCents: null };
  }
  const unitCostUsdCents = fenToUsdCents(line.unitCostFen, p.fxRmbPerUsdMilli);
  const suggestedUnitUsdCents = Math.round((unitCostUsdCents * 10_000) / (10_000 - marginBpApplied));
  return { unitCostUsdCents, marginBpApplied, suggestedUnitUsdCents };
}

export function priceQuotation(lines: EngineLineInput[], p: PolicyData): QuotationPricing {
  const priced = lines.map((l) => ({ line: l, r: priceLine(l, p) }));
  const incomplete = priced.some(({ line, r }) => line.lineType === 'NORMAL' && r.unitCostUsdCents == null);

  const sum = (f: (x: { line: EngineLineInput; r: PricedLine }) => number | null): number | null => {
    let total = 0;
    for (const x of priced) {
      const v = f(x);
      if (v == null) return null;
      total += v;
    }
    return total;
  };

  const totalCostUsdCents = incomplete ? null
    : sum(({ line, r }) => (r.unitCostUsdCents == null ? (line.lineType === 'SURCHARGE' ? 0 : null) : r.unitCostUsdCents * line.qty));
  const suggestedTotalRawUsdCents = incomplete ? null
    : sum(({ line, r }) => (r.suggestedUnitUsdCents == null ? null : r.suggestedUnitUsdCents * line.qty));

  const g = p.roundingGranularityUsdCents;
  const suggestedTotalUsdCents = suggestedTotalRawUsdCents == null ? null
    : Math.round(suggestedTotalRawUsdCents / g) * g;

  const actualTotalUsdCents = incomplete ? null
    : sum(({ line, r }) => {
      const unit = line.actualUnitUsdCents ?? r.suggestedUnitUsdCents;
      return unit == null ? null : unit * line.qty;
    });

  let actualMarginBp: number | null = null;
  if (actualTotalUsdCents != null && totalCostUsdCents != null && actualTotalUsdCents > 0) {
    actualMarginBp = Math.round(((actualTotalUsdCents - totalCostUsdCents) * 10_000) / actualTotalUsdCents);
  }

  return {
    totalCostUsdCents,
    suggestedTotalRawUsdCents,
    suggestedTotalUsdCents,
    actualTotalUsdCents,
    actualMarginBp,
    belowMinMargin: actualMarginBp != null && actualMarginBp < p.minMarginBp,
    incomplete,
  };
}
```

- [ ] **Step 4: Run — verify PASS** (9 tests), then **commit**

```bash
git add amplify/functions/price-api/lib/pricing.ts amplify/functions/price-api/lib/pricing.test.ts
git commit -m "feat(price-api): pure pricing engine (margin-on-price, unknown propagation)"
```

---

### Task 5: Total-override allocation — largest-remainder, boundary conditions

Spec is normative: proportional allocation over allocatable NORMAL lines by suggested price; floor shares, then one minor unit per line in descending fractional-remainder order, ties broken by line position; four boundary conditions are typed `VALIDATION:` rejections.

**Files:**
- Create: `amplify/functions/price-api/lib/allocation.ts`
- Test: `amplify/functions/price-api/lib/allocation.test.ts`

- [ ] **Step 1: Write the failing test**

Create `amplify/functions/price-api/lib/allocation.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { allocateTotalOverride, type AllocLine } from './allocation.js';

const L = (sku: string, suggestedLineTotalUsdCents: number | null, lineType: 'NORMAL' | 'SURCHARGE' = 'NORMAL'): AllocLine =>
  ({ sku, lineType, suggestedLineTotalUsdCents });

describe('allocateTotalOverride', () => {
  it('allocates proportionally and sums exactly to the override total', () => {
    // suggested 100/200/300 (total 600), override 500
    const res = allocateTotalOverride([L('a', 100), L('b', 200), L('c', 300)], 500);
    expect(res.map((r) => r.actualLineTotalUsdCents)).toEqual([83, 167, 250]);
    expect(res.reduce((s, r) => s + r.actualLineTotalUsdCents, 0)).toBe(500);
  });

  it('hands out remainder units by descending fractional remainder, ties by position', () => {
    // 3 equal lines of 100 (total 300), override 100 → each 33.33; floors 33,33,33, remainder 1
    // equal remainders → position tie-break: first line gets the extra unit
    const res = allocateTotalOverride([L('a', 100), L('b', 100), L('c', 100)], 100);
    expect(res.map((r) => r.actualLineTotalUsdCents)).toEqual([34, 33, 33]);
  });

  it('excludes SURCHARGE lines from allocation and keeps their amounts', () => {
    const res = allocateTotalOverride([L('a', 100), L('f', 50, 'SURCHARGE')], 130);
    // allocatable portion = 130 - 50 = 80 goes entirely to line a
    expect(res.find((r) => r.sku === 'a')!.actualLineTotalUsdCents).toBe(80);
    expect(res.find((r) => r.sku === 'f')!.actualLineTotalUsdCents).toBe(50);
  });

  it('rejects when no allocatable lines exist', () => {
    expect(() => allocateTotalOverride([L('f', 50, 'SURCHARGE')], 40)).toThrow(/^VALIDATION:/);
  });

  it('rejects when allocatable suggested sum is zero', () => {
    expect(() => allocateTotalOverride([L('a', 0)], 100)).toThrow(/^VALIDATION:/);
  });

  it('rejects when the allocatable portion would be <= 0 after fixed surcharges', () => {
    expect(() => allocateTotalOverride([L('a', 100), L('f', 50, 'SURCHARGE')], 50)).toThrow(/^VALIDATION:/);
  });

  it('rejects unknown suggested prices (incomplete quote cannot take a total override)', () => {
    expect(() => allocateTotalOverride([L('a', null)], 100)).toThrow(/^VALIDATION:/);
  });
});
```

- [ ] **Step 2: Run — verify FAIL**

Run: `npx vitest run amplify/functions/price-api/lib/allocation.test.ts --exclude '**/.claude/**'`

- [ ] **Step 3: Implement**

Create `amplify/functions/price-api/lib/allocation.ts`:

```ts
/** Total-override allocation (spec: "Manual overrides"). Integer minor units. */

export interface AllocLine {
  sku: string;
  lineType: 'NORMAL' | 'SURCHARGE';
  suggestedLineTotalUsdCents: number | null;
}

export interface AllocatedLine extends AllocLine {
  actualLineTotalUsdCents: number;
}

export function allocateTotalOverride(lines: AllocLine[], overrideTotalUsdCents: number): AllocatedLine[] {
  if (lines.some((l) => l.suggestedLineTotalUsdCents == null)) {
    throw new Error('VALIDATION: cannot apply a total override while any line price is unknown');
  }
  const surchargeSum = lines
    .filter((l) => l.lineType === 'SURCHARGE')
    .reduce((s, l) => s + l.suggestedLineTotalUsdCents!, 0);
  const allocatable = lines.filter((l) => l.lineType === 'NORMAL');
  if (allocatable.length === 0) {
    throw new Error('VALIDATION: no allocatable lines — adjust line prices directly');
  }
  const suggestedSum = allocatable.reduce((s, l) => s + l.suggestedLineTotalUsdCents!, 0);
  if (suggestedSum === 0) {
    throw new Error('VALIDATION: allocatable suggested total is zero — proportional allocation undefined');
  }
  const pool = overrideTotalUsdCents - surchargeSum;
  if (pool <= 0) {
    throw new Error('VALIDATION: override total does not cover fixed surcharge lines');
  }

  // Largest-remainder, properly applied (spec): floor shares first…
  const shares = allocatable.map((l, i) => {
    const exactNum = pool * l.suggestedLineTotalUsdCents!;
    const floor = Math.floor(exactNum / suggestedSum);
    return { i, floor, remainder: exactNum % suggestedSum };
  });
  let leftover = pool - shares.reduce((s, x) => s + x.floor, 0);
  // …then one unit each in descending fractional-remainder order, ties by position.
  const order = [...shares].sort((a, b) => b.remainder - a.remainder || a.i - b.i);
  const extra = new Map<number, number>();
  for (const s of order) {
    if (leftover <= 0) break;
    extra.set(s.i, 1);
    leftover -= 1;
  }

  const allocated = allocatable.map((l, i) => ({
    ...l,
    actualLineTotalUsdCents: shares[i].floor + (extra.get(i) ?? 0),
  }));
  if (allocated.some((l) => l.actualLineTotalUsdCents < 0)) {
    throw new Error('VALIDATION: allocation produced a negative line price');
  }

  // Reassemble in original order, surcharges untouched.
  let ai = 0;
  return lines.map((l) => (l.lineType === 'SURCHARGE'
    ? { ...l, actualLineTotalUsdCents: l.suggestedLineTotalUsdCents! }
    : allocated[ai++]));
}
```

- [ ] **Step 4: Run — verify PASS** (7 tests), then **commit**

```bash
git add amplify/functions/price-api/lib/allocation.ts amplify/functions/price-api/lib/allocation.test.ts
git commit -m "feat(price-api): largest-remainder total-override allocation with typed boundaries"
```

---

### Task 6: Compatibility validation — the four rule kinds

Spec: required options, mutual exclusion, dependency, quantity limits. No general rule engine. Rules live on CatalogItem fields: machines carry `requiredOptionSkus`; any item may carry `requiresSkus`, `excludesSkus`, `maxQuantity`.

**Files:**
- Create: `amplify/functions/price-api/lib/compatibility.ts`
- Test: `amplify/functions/price-api/lib/compatibility.test.ts`

- [ ] **Step 1: Write the failing test**

Create `amplify/functions/price-api/lib/compatibility.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { validateConfiguration, type ConfigItem, type Selection } from './compatibility.js';

const machine: ConfigItem = {
  sku: 'RIE-300', kind: 'MACHINE', requiredOptionSkus: ['CHILLER'], requiresSkus: [], excludesSkus: [], maxQuantity: 1,
};
const item = (sku: string, over: Partial<ConfigItem> = {}): ConfigItem =>
  ({ sku, kind: 'OPTION', requiredOptionSkus: [], requiresSkus: [], excludesSkus: [], ...over });

const sel = (i: ConfigItem, qty = 1): Selection => ({ item: i, qty });

describe('validateConfiguration', () => {
  it('passes a complete valid configuration', () => {
    expect(validateConfiguration([sel(machine), sel(item('CHILLER'))])).toEqual([]);
  });

  it('flags a missing required option', () => {
    const errs = validateConfiguration([sel(machine)]);
    expect(errs).toEqual([expect.stringContaining('CHILLER')]);
  });

  it('flags mutual exclusion (either side declares it)', () => {
    const a = item('A', { excludesSkus: ['B'] });
    const errs = validateConfiguration([sel(machine), sel(item('CHILLER')), sel(a), sel(item('B'))]);
    expect(errs.some((e) => e.includes('A') && e.includes('B'))).toBe(true);
  });

  it('flags an unmet dependency', () => {
    const a = item('A', { requiresSkus: ['PUMP-XL'] });
    const errs = validateConfiguration([sel(machine), sel(item('CHILLER')), sel(a)]);
    expect(errs.some((e) => e.includes('PUMP-XL'))).toBe(true);
  });

  it('flags quantity over the limit', () => {
    const a = item('A', { maxQuantity: 2 });
    const errs = validateConfiguration([sel(machine), sel(item('CHILLER')), sel(a, 3)]);
    expect(errs.some((e) => e.includes('quantity'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run — verify FAIL**, then **Step 3: Implement**

Create `amplify/functions/price-api/lib/compatibility.ts`:

```ts
/** The four compatibility rule kinds (spec). Deliberately NOT a rule engine. */

export interface ConfigItem {
  sku: string;
  kind: 'MACHINE' | 'OPTION' | 'CONSUMABLE' | 'SERVICE';
  requiredOptionSkus: string[]; // meaningful on MACHINE items
  requiresSkus: string[];
  excludesSkus: string[];
  maxQuantity?: number;
}

export interface Selection {
  item: ConfigItem;
  qty: number;
}

/** Returns human-readable error strings; empty array = valid. */
export function validateConfiguration(selections: Selection[]): string[] {
  const errors: string[] = [];
  const skus = new Set(selections.map((s) => s.item.sku));

  for (const { item, qty } of selections) {
    if (item.kind === 'MACHINE') {
      for (const req of item.requiredOptionSkus) {
        if (!skus.has(req)) errors.push(`${item.sku} requires option ${req} (required option)`);
      }
    }
    for (const req of item.requiresSkus) {
      if (!skus.has(req)) errors.push(`${item.sku} depends on ${req}, which is not selected`);
    }
    for (const ex of item.excludesSkus) {
      if (skus.has(ex)) errors.push(`${item.sku} is mutually exclusive with ${ex}`);
    }
    if (item.maxQuantity != null && qty > item.maxQuantity) {
      errors.push(`${item.sku} quantity ${qty} exceeds limit ${item.maxQuantity}`);
    }
  }
  return errors;
}
```

- [ ] **Step 4: Run — verify PASS** (5 tests), then **commit**

```bash
git add amplify/functions/price-api/lib/compatibility.ts amplify/functions/price-api/lib/compatibility.test.ts
git commit -m "feat(price-api): four-kind compatibility validation"
```

---

### Task 7: Item types + Supplier resolvers

**Files:**
- Create: `amplify/functions/price-api/lib/types.ts`
- Create (replace stub): `amplify/functions/price-api/resolvers/supplierResolvers.ts`
- Test: `amplify/functions/price-api/resolvers/supplierResolvers.test.ts`

- [ ] **Step 1: Create the shared item types**

Create `amplify/functions/price-api/lib/types.ts`:

```ts
import type { PriceApiEvent } from './adminAuth.js';
import type { ConfigItem } from './compatibility.js';

export type { PriceApiEvent };

/** Parses input that AppSync may deliver as a JSON string or an object. */
export function parseInput<T>(event: PriceApiEvent): T {
  const raw = (event.arguments as { input?: unknown }).input;
  if (raw == null) throw new Error('VALIDATION: input is required');
  return (typeof raw === 'string' ? JSON.parse(raw) : raw) as T;
}

export function getOperator(event: PriceApiEvent): string {
  const id = event.identity;
  return (id?.claims?.email as string) || id?.username || id?.sub || 'admin';
}

export interface SupplierItem {
  PK: string; SK: 'META';
  GSI1PK: 'SUPPLIERS'; GSI1SK: string;
  supplierId: string;
  name: string;
  contact?: string;
  currency: 'RMB';
  defaultValidityDays: number;
  status: 'ACTIVE' | 'SUSPENDED';
  notes?: string;
  createdAt: string; updatedAt: string;
}

export interface CatalogItemItem extends ConfigItem {
  PK: string; SK: 'META';
  GSI1PK: 'CATALOG_ITEMS'; GSI1SK: string;
  itemId: string;
  name: string;
  series: string;
  specs?: Record<string, string>;
  createdAt: string; updatedAt: string;
}

export interface CostVersionItem {
  PK: string; SK: string;              // COST#{supplierId}#{effectiveFrom}
  itemId: string;
  supplierId: string;
  unitCostFen: number;
  currency: 'RMB';
  effectiveFrom: string;               // ISO date (inclusive)
  effectiveTo: string;                 // ISO date (exclusive)
  priceSource: 'MANUAL_ENTRY' | 'SUPPLIER_EXCEL' | 'SUPPLIER_LINK';
  reviewStatus: 'APPROVED';            // P1 writes APPROVED unconditionally (spec)
  createdAt: string; createdBy: string;
}

/** Strip DDB key attributes for GraphQL responses. */
export function stripKeys<T extends { PK: string; SK: string }>(item: T) {
  const { PK, SK, ...rest } = item as T & { GSI1PK?: string; GSI1SK?: string };
  delete (rest as Record<string, unknown>).GSI1PK;
  delete (rest as Record<string, unknown>).GSI1SK;
  return rest;
}
```

- [ ] **Step 2: Write the failing supplier resolver test**

Create `amplify/functions/price-api/resolvers/supplierResolvers.test.ts` (mocking style copied from `logistics-api/resolvers/getLogisticsCase.test.ts`):

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const send = vi.fn();
vi.mock('../lib/dynamodb.js', () => ({
  docClient: { send: (...a: unknown[]) => send(...a) },
  TABLE_NAME: () => 'TestTable',
}));

import { pbCreateSupplier, pbUpdateSupplier, pbListSuppliers } from './supplierResolvers.js';

const ev = (args: Record<string, unknown>) => ({
  info: { fieldName: 'x', parentTypeName: 'Mutation' },
  arguments: args,
  identity: { sub: 's', groups: ['admin'], claims: { email: 'boss@ninescrolls.com' } },
});

beforeEach(() => send.mockReset());

describe('pbCreateSupplier', () => {
  it('creates atomically with the count guard and returns the supplier without DDB keys', async () => {
    send.mockResolvedValueOnce({});
    const res = await pbCreateSupplier(ev({ input: { name: 'Probe OEM', defaultValidityDays: 180 } })) as Record<string, unknown>;
    expect(res.supplierId).toMatch(/^sup-/);
    expect(res.status).toBe('ACTIVE');
    expect(res.PK).toBeUndefined();
    const tx = send.mock.calls[0][0].input.TransactItems;
    expect(tx[0].Update.ConditionExpression).toBe('attribute_not_exists(cnt) OR cnt < :max');
    expect(tx[0].Update.ExpressionAttributeValues[':max']).toBe(10);
    expect(tx[1].Put.ConditionExpression).toBe('attribute_not_exists(PK)');
  });

  it('maps a guard-condition failure (cap reached) to a VALIDATION error', async () => {
    send.mockRejectedValueOnce(Object.assign(new Error('x'), {
      name: 'TransactionCanceledException',
      CancellationReasons: [{ Code: 'ConditionalCheckFailed' }, { Code: 'None' }],
    }));
    await expect(pbCreateSupplier(ev({ input: { name: 'Eleventh OEM' } }))).rejects.toThrow(/^VALIDATION:.*limit/);
  });

  it('maps a non-guard cancellation (key collision) to CONFLICT, not "limit reached"', async () => {
    send.mockRejectedValueOnce(Object.assign(new Error('x'), {
      name: 'TransactionCanceledException',
      CancellationReasons: [{ Code: 'None' }, { Code: 'ConditionalCheckFailed' }],
    }));
    await expect(pbCreateSupplier(ev({ input: { name: 'Probe OEM' } }))).rejects.toThrow(/^CONFLICT:/);
  });

  it('rejects a missing name', async () => {
    await expect(pbCreateSupplier(ev({ input: { name: ' ' } }))).rejects.toThrow(/^VALIDATION:/);
  });
});

describe('pbUpdateSupplier', () => {
  it('updates mutable fields only', async () => {
    send.mockResolvedValueOnce({ Attributes: { supplierId: 's1', name: 'N', status: 'SUSPENDED' } });
    const res = await pbUpdateSupplier(ev({ input: { supplierId: 's1', status: 'SUSPENDED' } })) as Record<string, unknown>;
    expect(res.status).toBe('SUSPENDED');
    const upd = send.mock.calls[0][0].input;
    expect(upd.ConditionExpression).toContain('attribute_exists');
  });
});

describe('pbListSuppliers', () => {
  it('queries the SUPPLIERS GSI partition — never Scan', async () => {
    send.mockResolvedValueOnce({ Items: [{ PK: 'PSUP#s1', SK: 'META', GSI1PK: 'SUPPLIERS', GSI1SK: 'x', supplierId: 's1' }] });
    const res = await pbListSuppliers(ev({})) as { items: Record<string, unknown>[] };
    expect(res.items[0].supplierId).toBe('s1');
    const q = send.mock.calls[0][0];
    expect(q.constructor.name).toBe('QueryCommand');
    expect(q.input.IndexName).toBe('GSI1');
    expect(q.input.ExpressionAttributeValues[':pk']).toBe('SUPPLIERS');
  });
});
```

- [ ] **Step 3: Run — verify FAIL** (stubs throw `NOT_IMPLEMENTED`)

Run: `npx vitest run amplify/functions/price-api/resolvers/supplierResolvers.test.ts --exclude '**/.claude/**'`

- [ ] **Step 4: Implement (replace the stub file entirely)**

Replace `amplify/functions/price-api/resolvers/supplierResolvers.ts`:

```ts
import { UpdateCommand, QueryCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../lib/dynamodb.js';
import { generateSupplierId } from '../lib/ids.js';
import { parseInput, stripKeys, type PriceApiEvent, type SupplierItem } from '../lib/types.js';

interface CreateSupplierInput {
  name: string;
  contact?: string;
  defaultValidityDays?: number;
  notes?: string;
}

/** The ≤10-supplier product constraint (spec) is enforced ATOMICALLY via a count
 * guard updated in the same transaction as the Put — the non-paginated list UI
 * depends on this bound actually holding. */
export const MAX_SUPPLIERS = 10;

export async function pbCreateSupplier(event: PriceApiEvent) {
  const input = parseInput<CreateSupplierInput>(event);
  if (!input.name?.trim()) throw new Error('VALIDATION: name is required');
  const now = new Date().toISOString();
  const supplierId = generateSupplierId();
  const item: SupplierItem = {
    PK: `PSUP#${supplierId}`, SK: 'META',
    GSI1PK: 'SUPPLIERS', GSI1SK: `${now}#${supplierId}`,
    supplierId,
    name: input.name.trim(),
    contact: input.contact || undefined,
    currency: 'RMB',
    defaultValidityDays: input.defaultValidityDays ?? 180,
    status: 'ACTIVE',
    notes: input.notes || undefined,
    createdAt: now, updatedAt: now,
  };
  try {
    await docClient.send(new TransactWriteCommand({
      TransactItems: [
        {
          Update: {
            TableName: TABLE_NAME(),
            Key: { PK: 'COUNTER#SUPPLIER', SK: 'META' },
            UpdateExpression: 'ADD cnt :one',
            ConditionExpression: 'attribute_not_exists(cnt) OR cnt < :max',
            ExpressionAttributeValues: { ':one': 1, ':max': MAX_SUPPLIERS },
          },
        },
        { Put: { TableName: TABLE_NAME(), Item: item, ConditionExpression: 'attribute_not_exists(PK)' } },
      ],
    }));
  } catch (e) {
    const err = e as Error & { CancellationReasons?: Array<{ Code?: string }> };
    if (err.name === 'TransactionCanceledException') {
      // Distinguish WHICH condition failed: index 0 = count guard (cap), index 1 =
      // supplier Put (key collision). Only a guard failure means the cap was hit;
      // anything else is a retryable conflict, not a misleading "limit reached".
      if (err.CancellationReasons?.[0]?.Code === 'ConditionalCheckFailed') {
        throw new Error(`VALIDATION: supplier limit (${MAX_SUPPLIERS}) reached — scaling past it is a P2+ design task (list pagination + API cursor together, per spec)`);
      }
      throw new Error('CONFLICT: concurrent supplier create — retry');
    }
    throw e;
  }
  return stripKeys(item);
}

interface UpdateSupplierInput {
  supplierId: string;
  name?: string;
  contact?: string;
  defaultValidityDays?: number;
  status?: 'ACTIVE' | 'SUSPENDED';
  notes?: string;
}

const SUPPLIER_MUTABLE = ['name', 'contact', 'defaultValidityDays', 'status', 'notes'] as const;

export async function pbUpdateSupplier(event: PriceApiEvent) {
  const input = parseInput<UpdateSupplierInput>(event);
  if (!input.supplierId) throw new Error('VALIDATION: supplierId is required');
  const sets: string[] = ['updatedAt = :updatedAt'];
  const values: Record<string, unknown> = { ':updatedAt': new Date().toISOString() };
  const names: Record<string, string> = {};
  for (const f of SUPPLIER_MUTABLE) {
    if (input[f] !== undefined) {
      sets.push(`#${f} = :${f}`);
      names[`#${f}`] = f;
      values[`:${f}`] = input[f];
    }
  }
  const res = await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME(),
    Key: { PK: `PSUP#${input.supplierId}`, SK: 'META' },
    UpdateExpression: `SET ${sets.join(', ')}`,
    ExpressionAttributeValues: values,
    ...(Object.keys(names).length ? { ExpressionAttributeNames: names } : {}),
    ConditionExpression: 'attribute_exists(PK)',
    ReturnValues: 'ALL_NEW',
  }));
  return stripKeys(res.Attributes as SupplierItem);
}

export async function pbListSuppliers(_event: PriceApiEvent) {
  // ≤10 suppliers by product constraint (spec) — a single Query page suffices.
  const r = await docClient.send(new QueryCommand({
    TableName: TABLE_NAME(),
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk',
    ExpressionAttributeValues: { ':pk': 'SUPPLIERS' },
    ScanIndexForward: false,
  }));
  return { items: (r.Items ?? []).map((it) => stripKeys(it as SupplierItem)) };
}
```

- [ ] **Step 5: Run — verify PASS** (this test file + the Task 2 handler test still green)

Run: `npx vitest run amplify/functions/price-api --exclude '**/.claude/**'`

- [ ] **Step 6: Commit**

```bash
git add amplify/functions/price-api/lib/types.ts amplify/functions/price-api/resolvers/supplierResolvers.ts amplify/functions/price-api/resolvers/supplierResolvers.test.ts
git commit -m "feat(price-api): supplier resolvers (create/update/list via GSI partition)"
```

---

### Task 8: CatalogItem resolvers

**Files:**
- Replace stub: `amplify/functions/price-api/resolvers/catalogResolvers.ts`
- Test: `amplify/functions/price-api/resolvers/catalogResolvers.test.ts`

- [ ] **Step 1: Write the failing test**

Create `amplify/functions/price-api/resolvers/catalogResolvers.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const send = vi.fn();
vi.mock('../lib/dynamodb.js', () => ({
  docClient: { send: (...a: unknown[]) => send(...a) },
  TABLE_NAME: () => 'TestTable',
}));

import { pbCreateCatalogItem, pbUpdateCatalogItem, pbListCatalogItems } from './catalogResolvers.js';

const ev = (args: Record<string, unknown>) => ({
  info: { fieldName: 'x', parentTypeName: 'Mutation' },
  arguments: args,
  identity: { sub: 's', groups: ['admin'] },
});

beforeEach(() => send.mockReset());

describe('pbCreateCatalogItem', () => {
  it('creates an item with rule defaults and a series-sorted GSI key', async () => {
    send.mockResolvedValueOnce({});
    const res = await pbCreateCatalogItem(ev({
      input: { sku: 'RIE-300', name: 'RIE Etcher 300', series: 'RIE', kind: 'MACHINE' },
    })) as Record<string, unknown>;
    expect(res.itemId).toMatch(/^cat-/);
    expect(res.requiredOptionSkus).toEqual([]);
    const put = send.mock.calls[0][0].input;
    expect(put.Item.GSI1PK).toBe('CATALOG_ITEMS');
    expect(put.Item.GSI1SK).toBe('RIE#RIE-300');
  });

  it('rejects an invalid kind', async () => {
    await expect(pbCreateCatalogItem(ev({ input: { sku: 'X', name: 'x', series: 'S', kind: 'WIDGET' } })))
      .rejects.toThrow(/^VALIDATION:/);
  });
});

describe('pbUpdateCatalogItem', () => {
  it('updates rule fields', async () => {
    send.mockResolvedValueOnce({ Attributes: { itemId: 'c1', excludesSkus: ['B'] } });
    const res = await pbUpdateCatalogItem(ev({ input: { itemId: 'c1', excludesSkus: ['B'] } })) as Record<string, unknown>;
    expect(res.excludesSkus).toEqual(['B']);
  });
});

describe('pbListCatalogItems', () => {
  it('queries the CATALOG_ITEMS GSI partition and paginates internally', async () => {
    send.mockResolvedValueOnce({
      Items: [{ PK: 'PCAT#c1', SK: 'META', GSI1PK: 'CATALOG_ITEMS', GSI1SK: 'RIE#R1', itemId: 'c1', series: 'RIE' }],
    });
    const res = await pbListCatalogItems(ev({})) as { items: Record<string, unknown>[] };
    expect(res.items).toHaveLength(1);
    expect(send.mock.calls[0][0].input.IndexName).toBe('GSI1');
  });
});
```

- [ ] **Step 2: Run — verify FAIL**, then **Step 3: Implement**

Replace `amplify/functions/price-api/resolvers/catalogResolvers.ts`:

```ts
import { PutCommand, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../lib/dynamodb.js';
import { generateCatalogItemId } from '../lib/ids.js';
import { parseInput, stripKeys, type PriceApiEvent, type CatalogItemItem } from '../lib/types.js';

const KINDS = ['MACHINE', 'OPTION', 'CONSUMABLE', 'SERVICE'] as const;
type Kind = (typeof KINDS)[number];

interface CreateCatalogInput {
  sku: string; name: string; series: string; kind: Kind;
  specs?: Record<string, string>;
  requiredOptionSkus?: string[]; requiresSkus?: string[]; excludesSkus?: string[];
  maxQuantity?: number;
}

export async function pbCreateCatalogItem(event: PriceApiEvent) {
  const input = parseInput<CreateCatalogInput>(event);
  if (!input.sku?.trim() || !input.name?.trim() || !input.series?.trim()) {
    throw new Error('VALIDATION: sku, name and series are required');
  }
  if (!KINDS.includes(input.kind)) {
    throw new Error(`VALIDATION: kind must be one of ${KINDS.join(', ')}`);
  }
  const now = new Date().toISOString();
  const itemId = generateCatalogItemId();
  const item: CatalogItemItem = {
    PK: `PCAT#${itemId}`, SK: 'META',
    GSI1PK: 'CATALOG_ITEMS', GSI1SK: `${input.series.trim()}#${input.sku.trim()}`,
    itemId,
    sku: input.sku.trim(), name: input.name.trim(), series: input.series.trim(), kind: input.kind,
    specs: input.specs || undefined,
    requiredOptionSkus: input.requiredOptionSkus ?? [],
    requiresSkus: input.requiresSkus ?? [],
    excludesSkus: input.excludesSkus ?? [],
    maxQuantity: input.maxQuantity,
    createdAt: now, updatedAt: now,
  };
  await docClient.send(new PutCommand({
    TableName: TABLE_NAME(), Item: item, ConditionExpression: 'attribute_not_exists(PK)',
  }));
  return stripKeys(item);
}

interface UpdateCatalogInput {
  itemId: string;
  name?: string; specs?: Record<string, string>;
  requiredOptionSkus?: string[]; requiresSkus?: string[]; excludesSkus?: string[];
  maxQuantity?: number | null;
}

const CATALOG_MUTABLE = ['name', 'specs', 'requiredOptionSkus', 'requiresSkus', 'excludesSkus', 'maxQuantity'] as const;

export async function pbUpdateCatalogItem(event: PriceApiEvent) {
  const input = parseInput<UpdateCatalogInput>(event);
  if (!input.itemId) throw new Error('VALIDATION: itemId is required');
  const sets: string[] = ['updatedAt = :updatedAt'];
  const values: Record<string, unknown> = { ':updatedAt': new Date().toISOString() };
  const names: Record<string, string> = {};
  for (const f of CATALOG_MUTABLE) {
    if (input[f] !== undefined) {
      sets.push(`#${f} = :${f}`);
      names[`#${f}`] = f;
      values[`:${f}`] = input[f];
    }
  }
  const res = await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME(),
    Key: { PK: `PCAT#${input.itemId}`, SK: 'META' },
    UpdateExpression: `SET ${sets.join(', ')}`,
    ExpressionAttributeValues: values,
    ...(Object.keys(names).length ? { ExpressionAttributeNames: names } : {}),
    ConditionExpression: 'attribute_exists(PK)',
    ReturnValues: 'ALL_NEW',
  }));
  return stripKeys(res.Attributes as CatalogItemItem);
}

const MAX_PAGES = 20;

export async function pbListCatalogItems(_event: PriceApiEvent) {
  // Constant listing partition, series-sorted; paginate internally (never Scan).
  const items: Record<string, unknown>[] = [];
  let key: Record<string, unknown> | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const r = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME(),
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: { ':pk': 'CATALOG_ITEMS' },
      ExclusiveStartKey: key,
    }));
    items.push(...(r.Items ?? []));
    key = r.LastEvaluatedKey as Record<string, unknown> | undefined;
    if (!key) break;
  }
  return { items: items.map((it) => stripKeys(it as CatalogItemItem)) };
}
```

- [ ] **Step 4: Run — verify PASS**, then **commit**

```bash
git add amplify/functions/price-api/resolvers/catalogResolvers.ts amplify/functions/price-api/resolvers/catalogResolvers.test.ts
git commit -m "feat(price-api): catalog item resolvers"
```

---

### Task 9: CostVersion append protocol (guard-first CAS) + list

Spec section "CostVersion" is normative — the four-step order matters: ① strongly consistent guard read → ② strongly consistent exhaustive version Query → ③ overlap check → ④ transaction (guard CAS or bootstrap + conditional Put).

**Files:**
- Replace stub: `amplify/functions/price-api/resolvers/costVersionResolvers.ts`
- Test: `amplify/functions/price-api/resolvers/costVersionResolvers.test.ts`

- [ ] **Step 1: Write the failing test**

Create `amplify/functions/price-api/resolvers/costVersionResolvers.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const send = vi.fn();
vi.mock('../lib/dynamodb.js', () => ({
  docClient: { send: (...a: unknown[]) => send(...a) },
  TABLE_NAME: () => 'TestTable',
}));

import { pbAppendCostVersion, pbListCostVersions } from './costVersionResolvers.js';

const ev = (input: Record<string, unknown>) => ({
  info: { fieldName: 'x', parentTypeName: 'Mutation' },
  arguments: { input },
  identity: { sub: 's', groups: ['admin'], claims: { email: 'boss@ninescrolls.com' } },
});

const validInput = {
  itemId: 'c1', supplierId: 's1', unitCostFen: 725_000,
  effectiveFrom: '2026-08-01', effectiveTo: '2027-02-01', priceSource: 'MANUAL_ENTRY',
};

beforeEach(() => send.mockReset());

describe('pbAppendCostVersion', () => {
  it('reads guard FIRST (consistent), then versions (consistent), then transacts CAS + Put', async () => {
    send
      .mockResolvedValueOnce({ Item: { revision: 3 } })            // ① guard GetCommand
      .mockResolvedValueOnce({ Items: [] })                        // ② versions QueryCommand
      .mockResolvedValueOnce({});                                  // ④ TransactWriteCommand
    const res = await pbAppendCostVersion(ev(validInput)) as Record<string, unknown>;
    expect(res.unitCostFen).toBe(725_000);
    expect(res.reviewStatus).toBe('APPROVED');

    const [guardCall, versionsCall, txCall] = send.mock.calls.map((c) => c[0]);
    expect(guardCall.constructor.name).toBe('GetCommand');
    expect(guardCall.input.ConsistentRead).toBe(true);
    expect(guardCall.input.Key.SK).toBe('COSTGUARD#s1');
    expect(versionsCall.constructor.name).toBe('QueryCommand');
    expect(versionsCall.input.ConsistentRead).toBe(true);
    expect(versionsCall.input.ExpressionAttributeValues[':sk']).toBe('COST#s1#');

    const [guardOp, putOp] = txCall.input.TransactItems;
    expect(guardOp.Update.ConditionExpression).toContain('revision = :expected');
    expect(guardOp.Update.ExpressionAttributeValues[':expected']).toBe(3);
    expect(putOp.Put.ConditionExpression).toBe('attribute_not_exists(PK)');
    expect(putOp.Put.Item.SK).toBe('COST#s1#2026-08-01');
  });

  it('bootstraps a missing guard with attribute_not_exists', async () => {
    send
      .mockResolvedValueOnce({})                                   // guard absent
      .mockResolvedValueOnce({ Items: [] })
      .mockResolvedValueOnce({});
    await pbAppendCostVersion(ev(validInput));
    const guardOp = send.mock.calls[2][0].input.TransactItems[0];
    expect(guardOp.Update.ConditionExpression).toBe('attribute_not_exists(PK)');
  });

  it('rejects an overlapping interval', async () => {
    send
      .mockResolvedValueOnce({ Item: { revision: 1 } })
      .mockResolvedValueOnce({ Items: [{ effectiveFrom: '2026-06-01', effectiveTo: '2026-09-01' }] });
    await expect(pbAppendCostVersion(ev(validInput))).rejects.toThrow(/^VALIDATION:.*overlap/i);
    expect(send).toHaveBeenCalledTimes(2); // never reaches the transaction
  });

  it('maps a cancelled transaction to CONFLICT', async () => {
    send
      .mockResolvedValueOnce({ Item: { revision: 1 } })
      .mockResolvedValueOnce({ Items: [] })
      .mockRejectedValueOnce(Object.assign(new Error('boom'), { name: 'TransactionCanceledException' }));
    await expect(pbAppendCostVersion(ev(validInput))).rejects.toThrow(/^CONFLICT:/);
  });

  it('rejects effectiveTo <= effectiveFrom', async () => {
    await expect(pbAppendCostVersion(ev({ ...validInput, effectiveTo: '2026-08-01' })))
      .rejects.toThrow(/^VALIDATION:/);
  });
});

describe('pbListCostVersions', () => {
  it('queries the item partition by COST# prefix', async () => {
    send.mockResolvedValueOnce({ Items: [{ PK: 'PCAT#c1', SK: 'COST#s1#2026-01-01', unitCostFen: 1 }] });
    const res = await pbListCostVersions(ev({ itemId: 'c1' })) as { items: Record<string, unknown>[] };
    expect(res.items).toHaveLength(1);
    const q = send.mock.calls[0][0].input;
    expect(q.KeyConditionExpression).toContain('begins_with');
  });
});
```

- [ ] **Step 2: Run — verify FAIL**, then **Step 3: Implement**

Replace `amplify/functions/price-api/resolvers/costVersionResolvers.ts`:

```ts
import { GetCommand, QueryCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../lib/dynamodb.js';
import { parseInput, stripKeys, getOperator, type PriceApiEvent, type CostVersionItem } from '../lib/types.js';

const SOURCES = ['MANUAL_ENTRY', 'SUPPLIER_EXCEL', 'SUPPLIER_LINK'] as const;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

interface AppendInput {
  itemId: string; supplierId: string;
  unitCostFen: number;
  effectiveFrom: string; effectiveTo: string;
  priceSource: (typeof SOURCES)[number];
}

/**
 * Spec-normative order (third review): guard revision FIRST, then versions,
 * then overlap check, then one transaction. Reading versions before the guard
 * would let a concurrent insert slip between the two reads.
 */
export async function pbAppendCostVersion(event: PriceApiEvent) {
  const input = parseInput<AppendInput>(event);
  if (!input.itemId || !input.supplierId) throw new Error('VALIDATION: itemId and supplierId are required');
  if (!Number.isInteger(input.unitCostFen) || input.unitCostFen <= 0) {
    throw new Error('VALIDATION: unitCostFen must be a positive integer (RMB fen)');
  }
  if (!DATE_RE.test(input.effectiveFrom) || !DATE_RE.test(input.effectiveTo)) {
    throw new Error('VALIDATION: effectiveFrom/effectiveTo must be YYYY-MM-DD');
  }
  if (input.effectiveTo <= input.effectiveFrom) {
    throw new Error('VALIDATION: effectiveTo must be after effectiveFrom');
  }
  if (!SOURCES.includes(input.priceSource)) {
    throw new Error(`VALIDATION: priceSource must be one of ${SOURCES.join(', ')}`);
  }

  const pk = `PCAT#${input.itemId}`;
  const guardSk = `COSTGUARD#${input.supplierId}`;

  // ① Strongly consistent guard read FIRST.
  const guardRes = await docClient.send(new GetCommand({
    TableName: TABLE_NAME(), Key: { PK: pk, SK: guardSk }, ConsistentRead: true,
  }));
  const revision = guardRes.Item?.revision as number | undefined;

  // ② Strongly consistent, exhaustive version Query for this (item, supplier).
  const versions: Record<string, unknown>[] = [];
  let key: Record<string, unknown> | undefined;
  do {
    const r = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME(),
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: { ':pk': pk, ':sk': `COST#${input.supplierId}#` },
      ConsistentRead: true,
      ExclusiveStartKey: key,
    }));
    versions.push(...(r.Items ?? []));
    key = r.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (key);

  // ③ Overlap check: [from, to) intervals for the same (item, supplier).
  for (const v of versions) {
    const from = v.effectiveFrom as string;
    const to = v.effectiveTo as string;
    if (input.effectiveFrom < to && from < input.effectiveTo) {
      throw new Error(`VALIDATION: interval overlaps existing cost version ${from}..${to}`);
    }
  }

  const now = new Date().toISOString();
  const item: CostVersionItem = {
    PK: pk, SK: `COST#${input.supplierId}#${input.effectiveFrom}`,
    itemId: input.itemId, supplierId: input.supplierId,
    unitCostFen: input.unitCostFen, currency: 'RMB',
    effectiveFrom: input.effectiveFrom, effectiveTo: input.effectiveTo,
    priceSource: input.priceSource,
    reviewStatus: 'APPROVED', // P1 unconditional (spec); semantics activate at evolution stage 2
    createdAt: now, createdBy: getOperator(event),
  };

  // ④ One transaction: guard CAS (or attribute_not_exists bootstrap) + conditional Put.
  const guardUpdate = revision === undefined
    ? {
      Update: {
        TableName: TABLE_NAME(), Key: { PK: pk, SK: guardSk },
        UpdateExpression: 'SET revision = :one',
        ConditionExpression: 'attribute_not_exists(PK)',
        ExpressionAttributeValues: { ':one': 1 },
      },
    }
    : {
      Update: {
        TableName: TABLE_NAME(), Key: { PK: pk, SK: guardSk },
        UpdateExpression: 'SET revision = revision + :one',
        ConditionExpression: 'revision = :expected',
        ExpressionAttributeValues: { ':one': 1, ':expected': revision },
      },
    };

  try {
    await docClient.send(new TransactWriteCommand({
      TransactItems: [
        guardUpdate,
        { Put: { TableName: TABLE_NAME(), Item: item, ConditionExpression: 'attribute_not_exists(PK)' } },
      ],
    }));
  } catch (e) {
    if ((e as Error).name === 'TransactionCanceledException') {
      throw new Error('CONFLICT: concurrent cost update for this item/supplier — refresh and retry');
    }
    throw e;
  }
  return stripKeys(item);
}

export async function pbListCostVersions(event: PriceApiEvent) {
  const { itemId, supplierId } = parseInput<{ itemId: string; supplierId?: string }>(event);
  if (!itemId) throw new Error('VALIDATION: itemId is required');
  const prefix = supplierId ? `COST#${supplierId}#` : 'COST#';
  const items: Record<string, unknown>[] = [];
  let key: Record<string, unknown> | undefined;
  do {
    const r = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME(),
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: { ':pk': `PCAT#${itemId}`, ':sk': prefix },
      ExclusiveStartKey: key,
    }));
    items.push(...(r.Items ?? []));
    key = r.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (key);
  return { items: items.map((it) => stripKeys(it as CostVersionItem)) };
}

/**
 * Effective cost selection (spec): the version where effectiveFrom <= today < effectiveTo.
 * Returns the FULL version object — quotation snapshots need complete provenance
 * (supplierId, interval, priceSource, reviewStatus), not just the amount.
 * Exported for reuse by quotation pricing (Task 11) and the Price Book badges.
 */
export function selectEffectiveCost<T extends { effectiveFrom: string; effectiveTo: string }>(
  versions: T[],
  todayIso: string, // 'YYYY-MM-DD'
): T | null {
  return versions.find((v) => v.effectiveFrom <= todayIso && todayIso < v.effectiveTo) ?? null;
}
```

- [ ] **Step 4: Add selection-rule tests to the same test file**

Append to `costVersionResolvers.test.ts`:

```ts
import { selectEffectiveCost } from './costVersionResolvers.js';

describe('selectEffectiveCost', () => {
  const versions = [
    { effectiveFrom: '2026-01-01', effectiveTo: '2026-07-01', unitCostFen: 100 },
    { effectiveFrom: '2026-08-01', effectiveTo: '2027-02-01', unitCostFen: 200 }, // future-dated
  ];
  it('selects the covering version', () => {
    expect(selectEffectiveCost(versions, '2026-06-30')?.unitCostFen).toBe(100);
  });
  it('does not select a future-dated version early, then selects it once effective', () => {
    expect(selectEffectiveCost(versions, '2026-07-15')).toBeNull(); // gap ⇒ missing cost
    expect(selectEffectiveCost(versions, '2026-08-01')?.unitCostFen).toBe(200);
  });
});
```

- [ ] **Step 5: Run — verify PASS** (8 tests), then **commit**

```bash
git add amplify/functions/price-api/resolvers/costVersionResolvers.ts amplify/functions/price-api/resolvers/costVersionResolvers.test.ts
git commit -m "feat(price-api): guard-first CAS cost-version append + effective-cost selection"
```

---

### Task 10: PricingPolicy resolvers

Single global policy record; overrides live inside it as maps (YAGNI: no per-override records at ≤17 product series).

**Files:**
- Replace stub: `amplify/functions/price-api/resolvers/policyResolvers.ts`
- Test: `amplify/functions/price-api/resolvers/policyResolvers.test.ts`

- [ ] **Step 1: Write the failing test**

Create `amplify/functions/price-api/resolvers/policyResolvers.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const send = vi.fn();
vi.mock('../lib/dynamodb.js', () => ({
  docClient: { send: (...a: unknown[]) => send(...a) },
  TABLE_NAME: () => 'TestTable',
}));

import { pbGetPricingPolicy, pbUpdatePricingPolicy, DEFAULT_POLICY } from './policyResolvers.js';

const ev = (args: Record<string, unknown> = {}) => ({
  info: { fieldName: 'x', parentTypeName: 'Query' },
  arguments: args,
  identity: { sub: 's', groups: ['admin'], claims: { email: 'boss@ninescrolls.com' } },
});

beforeEach(() => send.mockReset());

describe('pbGetPricingPolicy', () => {
  it('returns stored policy', async () => {
    send.mockResolvedValueOnce({ Item: { PK: 'PRICING_POLICY', SK: 'META', fxRmbPerUsdMilli: 7000 } });
    const res = await pbGetPricingPolicy(ev()) as Record<string, unknown>;
    expect(res.fxRmbPerUsdMilli).toBe(7000);
  });

  it('returns defaults when no policy exists yet', async () => {
    send.mockResolvedValueOnce({});
    const res = await pbGetPricingPolicy(ev()) as Record<string, unknown>;
    expect(res.fxRmbPerUsdMilli).toBe(DEFAULT_POLICY.fxRmbPerUsdMilli);
  });
});

describe('pbUpdatePricingPolicy', () => {
  it('validates ranges and stamps fxUpdatedAt when the rate changes', async () => {
    send.mockResolvedValueOnce({ Attributes: { fxRmbPerUsdMilli: 7100 } });
    await pbUpdatePricingPolicy(ev({ input: { fxRmbPerUsdMilli: 7100 } }));
    const upd = send.mock.calls[0][0].input;
    expect(upd.UpdateExpression).toContain('fxUpdatedAt');
  });

  it('rejects margin >= 100%', async () => {
    await expect(pbUpdatePricingPolicy(ev({ input: { defaultMarginBp: 10000 } })))
      .rejects.toThrow(/^VALIDATION:/);
  });
});
```

- [ ] **Step 2: Run — verify FAIL**, then **Step 3: Implement**

Replace `amplify/functions/price-api/resolvers/policyResolvers.ts`:

```ts
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../lib/dynamodb.js';
import { parseInput, getOperator, type PriceApiEvent } from '../lib/types.js';
import type { PolicyData } from '../lib/pricing.js';

const KEY = { PK: 'PRICING_POLICY', SK: 'META' };

export const DEFAULT_POLICY: PolicyData = {
  fxRmbPerUsdMilli: 7250,
  defaultMarginBp: 3500,
  minMarginBp: 2000,
  roundingGranularityUsdCents: 10000,
  seriesOverrides: {},
  itemOverrides: {},
};

export async function pbGetPricingPolicy(_event: PriceApiEvent) {
  const r = await docClient.send(new GetCommand({ TableName: TABLE_NAME(), Key: KEY }));
  if (!r.Item) return { ...DEFAULT_POLICY };
  const { PK, SK, ...rest } = r.Item;
  return { ...DEFAULT_POLICY, ...rest };
}

type UpdatePolicyInput = Partial<PolicyData>;
const POLICY_FIELDS = [
  'fxRmbPerUsdMilli', 'defaultMarginBp', 'minMarginBp',
  'roundingGranularityUsdCents', 'seriesOverrides', 'itemOverrides',
] as const;

export async function pbUpdatePricingPolicy(event: PriceApiEvent) {
  const input = parseInput<UpdatePolicyInput>(event);
  for (const bpField of ['defaultMarginBp', 'minMarginBp'] as const) {
    const v = input[bpField];
    if (v !== undefined && (!Number.isInteger(v) || v < 0 || v >= 10000)) {
      throw new Error(`VALIDATION: ${bpField} must be an integer in [0, 10000)`);
    }
  }
  if (input.fxRmbPerUsdMilli !== undefined
    && (!Number.isInteger(input.fxRmbPerUsdMilli) || input.fxRmbPerUsdMilli <= 0)) {
    throw new Error('VALIDATION: fxRmbPerUsdMilli must be a positive integer');
  }
  if (input.roundingGranularityUsdCents !== undefined
    && (!Number.isInteger(input.roundingGranularityUsdCents) || input.roundingGranularityUsdCents < 1)) {
    throw new Error('VALIDATION: roundingGranularityUsdCents must be a positive integer');
  }

  const sets: string[] = ['updatedAt = :updatedAt', 'updatedBy = :updatedBy'];
  const values: Record<string, unknown> = {
    ':updatedAt': new Date().toISOString(), ':updatedBy': getOperator(event),
  };
  const names: Record<string, string> = {};
  for (const f of POLICY_FIELDS) {
    if (input[f] !== undefined) {
      sets.push(`#${f} = :${f}`);
      names[`#${f}`] = f;
      values[`:${f}`] = input[f];
    }
  }
  if (input.fxRmbPerUsdMilli !== undefined) {
    // Manually maintained rate is timestamped (spec: reproducible, auditable).
    sets.push('fxUpdatedAt = :fxUpdatedAt');
    values[':fxUpdatedAt'] = values[':updatedAt'];
  }
  const res = await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME(), Key: KEY,
    UpdateExpression: `SET ${sets.join(', ')}`,
    ExpressionAttributeValues: values,
    ...(Object.keys(names).length ? { ExpressionAttributeNames: names } : {}),
    ReturnValues: 'ALL_NEW',
  }));
  const { PK, SK, ...rest } = res.Attributes ?? {};
  return { ...DEFAULT_POLICY, ...rest };
}
```

- [ ] **Step 4: Run — verify PASS**, then **commit**

```bash
git add amplify/functions/price-api/resolvers/policyResolvers.ts amplify/functions/price-api/resolvers/policyResolvers.test.ts
git commit -m "feat(price-api): pricing policy get/update with fx timestamping"
```

---

### Task 11: Quotation draft creation — counter CAS + single-transaction snapshot

Spec "Transactional invariants" 1–3 are normative. P1 status is always `DRAFT`.

**Files:**
- Replace stub: `amplify/functions/price-api/resolvers/quotationResolvers.ts` (this task implements `pbCreateQuotationDraft` + shared helpers; Task 12 adds the rest — keep the other three stubs throwing until then)
- Test: `amplify/functions/price-api/resolvers/quotationResolvers.test.ts`

- [ ] **Step 1: Write the failing test**

Create `amplify/functions/price-api/resolvers/quotationResolvers.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const send = vi.fn();
vi.mock('../lib/dynamodb.js', () => ({
  docClient: { send: (...a: unknown[]) => send(...a) },
  TABLE_NAME: () => 'TestTable',
}));

import { pbCreateQuotationDraft } from './quotationResolvers.js';

const ev = (input: Record<string, unknown>) => ({
  info: { fieldName: 'x', parentTypeName: 'Mutation' },
  arguments: { input },
  identity: { sub: 's', groups: ['admin'], claims: { email: 'boss@ninescrolls.com' } },
});

const machineMeta = {
  PK: 'PCAT#c1', SK: 'META', itemId: 'c1', sku: 'RIE-300', name: 'RIE 300', series: 'RIE',
  kind: 'MACHINE', requiredOptionSkus: [], requiresSkus: [], excludesSkus: [],
};
const cost = {
  PK: 'PCAT#c1', SK: 'COST#s1#2020-01-01', effectiveFrom: '2020-01-01', effectiveTo: '2099-01-01',
  unitCostFen: 725_000, supplierId: 's1', currency: 'RMB',
  priceSource: 'MANUAL_ENTRY', reviewStatus: 'APPROVED',
};
const policyItem = {
  Item: {
    PK: 'PRICING_POLICY', SK: 'META', fxRmbPerUsdMilli: 7250, defaultMarginBp: 3500,
    minMarginBp: 2000, roundingGranularityUsdCents: 10000, seriesOverrides: {}, itemOverrides: {},
  },
};

function primeHappyPath() {
  send
    .mockResolvedValueOnce(policyItem)                                   // policy Get
    .mockResolvedValueOnce({ Items: [machineMeta, cost] })               // item partition Query (META + costs)
    .mockResolvedValueOnce({ Item: { seq: 7 } })                         // counter Get (consistent)
    .mockResolvedValueOnce({});                                          // TransactWriteCommand
}

const validInput = {
  schemeLabel: 'Standard', customerName: 'MIT Nano',
  lines: [{ itemId: 'c1', qty: 1, lineType: 'NORMAL' }],
};

beforeEach(() => send.mockReset());

describe('pbCreateQuotationDraft', () => {
  it('allocates the number via CAS and writes scheme+header+lines in ONE transaction', async () => {
    primeHappyPath();
    const res = await pbCreateQuotationDraft(ev(validInput)) as Record<string, unknown>;
    expect(res.quotationNumber).toMatch(/^Q-\d{4}-0008$/);
    expect(res.status).toBe('DRAFT');
    expect(res.version).toBe(1);

    const itemQuery = send.mock.calls[1][0];
    expect(itemQuery.input.ConsistentRead).toBe(true); // money-bearing read

    const counterGet = send.mock.calls[2][0];
    expect(counterGet.input.ConsistentRead).toBe(true);

    const tx = send.mock.calls[3][0].input.TransactItems;
    const [counterOp, schemeOp, headerOp, lineOp] = tx;
    expect(counterOp.Update.ConditionExpression).toBe('seq = :expected');
    expect(counterOp.Update.ExpressionAttributeValues[':expected']).toBe(7);
    expect(schemeOp.Put.Item.SK).toBe('SCHEME');
    expect(schemeOp.Put.ConditionExpression).toBe('attribute_not_exists(PK)');
    expect(headerOp.Put.Item.SK).toBe('V#001');
    expect(headerOp.Put.Item.revision).toBe(1);
    expect(lineOp.Put.Item.SK).toBe('V#001#LINE#01');
    expect(lineOp.Put.Item.unitCostFen).toBe(725_000);
    expect(lineOp.Put.Item.fxRmbPerUsdMilli).toBe(7250); // rate snapshotted into the line
    // Full cost provenance in the snapshot (audit-complete):
    expect(lineOp.Put.Item.costSnapshot).toMatchObject({
      supplierId: 's1', unitCostFen: 725_000, currency: 'RMB',
      effectiveFrom: '2020-01-01', effectiveTo: '2099-01-01',
      priceSource: 'MANUAL_ENTRY', reviewStatus: 'APPROVED',
    });
    expect(lineOp.Put.Item.overriddenBy).toBeNull(); // no manual override on this line
    // Header ≡ lines reconciliation: actual total is exactly the line-total sum.
    expect(res.actualTotalUsdCents).toBe(153_846);
    expect((res.lines as Array<{ actualLineTotalUsdCents: number }>)
      .reduce((s, l) => s + l.actualLineTotalUsdCents, 0)).toBe(153_846);
  });

  it('bootstraps a missing year counter with attribute_not_exists and seq 1', async () => {
    send
      .mockResolvedValueOnce(policyItem)
      .mockResolvedValueOnce({ Items: [machineMeta, cost] })
      .mockResolvedValueOnce({})                                         // counter absent
      .mockResolvedValueOnce({});
    const res = await pbCreateQuotationDraft(ev(validInput)) as Record<string, unknown>;
    expect(res.quotationNumber).toMatch(/-0001$/);
    const counterOp = send.mock.calls[3][0].input.TransactItems[0];
    expect(counterOp.Update.ConditionExpression).toBe('attribute_not_exists(PK)');
  });

  it('maps a lost race to CONFLICT', async () => {
    send
      .mockResolvedValueOnce(policyItem)
      .mockResolvedValueOnce({ Items: [machineMeta, cost] })
      .mockResolvedValueOnce({ Item: { seq: 7 } })
      .mockRejectedValueOnce(Object.assign(new Error('x'), { name: 'TransactionCanceledException' }));
    await expect(pbCreateQuotationDraft(ev(validInput))).rejects.toThrow(/^CONFLICT:/);
  });

  it('missing cost coverage yields unknown pricing, not zero, and still saves', async () => {
    send
      .mockResolvedValueOnce(policyItem)
      .mockResolvedValueOnce({ Items: [machineMeta] })                   // no cost versions at all
      .mockResolvedValueOnce({ Item: { seq: 1 } })
      .mockResolvedValueOnce({});
    const res = await pbCreateQuotationDraft(ev(validInput)) as Record<string, unknown>;
    expect(res.incomplete).toBe(true);
    expect(res.totalCostUsdCents).toBeNull();
  });

  it('rejects configuration errors', async () => {
    const needy = { ...machineMeta, requiredOptionSkus: ['CHILLER'] };
    send
      .mockResolvedValueOnce(policyItem)
      .mockResolvedValueOnce({ Items: [needy, cost] });
    await expect(pbCreateQuotationDraft(ev(validInput))).rejects.toThrow(/^VALIDATION:.*CHILLER/);
  });

  it('requires a reason for line-level overrides', async () => {
    send
      .mockResolvedValueOnce(policyItem)
      .mockResolvedValueOnce({ Items: [machineMeta, cost] });
    await expect(pbCreateQuotationDraft(ev({
      ...validInput,
      lines: [{ itemId: 'c1', qty: 1, lineType: 'NORMAL', actualUnitUsdCents: 120_000 }],
    }))).rejects.toThrow(/^VALIDATION:.*reason/i);
  });

  it('enforces the 45-line cap with a typed error', async () => {
    const lines = Array.from({ length: 46 }, (_, i) => ({ itemId: `c${i}`, qty: 1, lineType: 'NORMAL' }));
    await expect(pbCreateQuotationDraft(ev({ ...validInput, lines }))).rejects.toThrow(/^VALIDATION:.*45/);
  });
});
```

- [ ] **Step 2: Run — verify FAIL**, then **Step 3: Implement create + shared helpers**

Replace `amplify/functions/price-api/resolvers/quotationResolvers.ts` (keep `pbUpdateQuotationDraft`, `pbGetQuotation`, `pbListQuotations` as throwing stubs at the bottom — Task 12 fills them):

```ts
import { GetCommand, QueryCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../lib/dynamodb.js';
import { formatQuotationNumber, versionSk, lineSk } from '../lib/ids.js';
import { priceLine, priceQuotation, type PolicyData, type EngineLineInput } from '../lib/pricing.js';
import { allocateTotalOverride } from '../lib/allocation.js';
import { validateConfiguration, type ConfigItem } from '../lib/compatibility.js';
import { selectEffectiveCost } from './costVersionResolvers.js';
import { DEFAULT_POLICY } from './policyResolvers.js';
import { parseInput, getOperator, type PriceApiEvent } from '../lib/types.js';

export const MAX_LINES = 45; // spec invariant 3: full-replacement edit must fit 100 tx actions

export interface QuotationLineInput {
  itemId?: string;               // required for NORMAL lines
  sku?: string;                  // SURCHARGE lines: free-form label (FREIGHT, TARIFF, INSTALL, WARRANTY)
  qty: number;
  lineType: 'NORMAL' | 'SURCHARGE';
  surchargeUsdCents?: number;
  actualUnitUsdCents?: number;
  overrideReason?: string;
}

export interface CreateQuotationInput {
  rfqId?: string;
  schemeLabel: string;
  customerName: string;
  currency?: 'USD';
  validUntil?: string;
  tradeTerms?: string;
  paymentTerms?: string;
  lines: QuotationLineInput[];
  totalOverride?: { totalUsdCents: number; reason: string };
  notes?: string;
}

interface LoadedLine {
  input: QuotationLineInput;
  engine: EngineLineInput;
  snapshot: Record<string, unknown>; // catalog + cost snapshot fields
  configItem?: ConfigItem;
  costExpiringSoon?: boolean;
}

export async function loadPolicy(): Promise<PolicyData> {
  const r = await docClient.send(new GetCommand({
    TableName: TABLE_NAME(), Key: { PK: 'PRICING_POLICY', SK: 'META' },
  }));
  if (!r.Item) return { ...DEFAULT_POLICY };
  const { PK, SK, ...rest } = r.Item;
  return { ...DEFAULT_POLICY, ...(rest as Partial<PolicyData>) };
}

/**
 * Loads catalog META + cost versions for every NORMAL line (one base-table
 * Query per item — item partition holds META + COST# rows together), applies
 * the effective-cost selection rule, and builds engine inputs + snapshots.
 */
export async function loadLines(lines: QuotationLineInput[]): Promise<LoadedLine[]> {
  if (lines.length === 0) throw new Error('VALIDATION: at least one line is required');
  if (lines.length > MAX_LINES) throw new Error(`VALIDATION: a quotation is capped at ${MAX_LINES} lines`);
  const today = new Date().toISOString().slice(0, 10);
  const soon = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);

  return Promise.all(lines.map(async (input): Promise<LoadedLine> => {
    if (!Number.isInteger(input.qty) || input.qty < 1) throw new Error('VALIDATION: qty must be a positive integer');
    if (input.actualUnitUsdCents !== undefined && !input.overrideReason?.trim()) {
      throw new Error('VALIDATION: a manual price override requires a reason');
    }
    if (input.lineType === 'SURCHARGE') {
      if (!input.sku?.trim()) throw new Error('VALIDATION: surcharge lines need a sku label');
      if (input.surchargeUsdCents == null || input.surchargeUsdCents < 0) {
        throw new Error('VALIDATION: surcharge lines need surchargeUsdCents >= 0');
      }
      return {
        input,
        engine: {
          sku: input.sku, series: 'SURCHARGE', qty: input.qty, lineType: 'SURCHARGE',
          unitCostFen: null, surchargeUsdCents: input.surchargeUsdCents,
          actualUnitUsdCents: input.actualUnitUsdCents ?? null,
        },
        snapshot: { sku: input.sku, name: input.sku, series: 'SURCHARGE', kind: 'SERVICE' },
      };
    }
    if (!input.itemId) throw new Error('VALIDATION: NORMAL lines require itemId');
    // Money-bearing read: STRONGLY CONSISTENT and pagination-exhausted, or a
    // just-written cost (or one beyond 1 MB) could silently misprice the quote.
    const rows: Record<string, unknown>[] = [];
    let lek: Record<string, unknown> | undefined;
    do {
      const r = await docClient.send(new QueryCommand({
        TableName: TABLE_NAME(),
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: { ':pk': `PCAT#${input.itemId}` },
        ConsistentRead: true,
        ExclusiveStartKey: lek,
      }));
      rows.push(...(r.Items ?? []));
      lek = r.LastEvaluatedKey as Record<string, unknown> | undefined;
    } while (lek);
    const meta = rows.find((it) => it.SK === 'META');
    if (!meta) throw new Error(`NOT_FOUND: catalog item ${input.itemId}`);
    const versions = rows.filter(
      (it) => typeof it.SK === 'string' && (it.SK as string).startsWith('COST#'),
    ) as unknown as Array<{
      supplierId: string; unitCostFen: number; currency: string;
      effectiveFrom: string; effectiveTo: string;
      priceSource: string; reviewStatus: string;
    }>;
    const effective = selectEffectiveCost(versions, today);
    return {
      input,
      engine: {
        sku: meta.sku as string, series: meta.series as string, qty: input.qty, lineType: 'NORMAL',
        unitCostFen: effective?.unitCostFen ?? null,
        actualUnitUsdCents: input.actualUnitUsdCents ?? null,
      },
      snapshot: {
        itemId: meta.itemId, sku: meta.sku, name: meta.name, series: meta.series, kind: meta.kind,
        specs: meta.specs, unitCostFen: effective?.unitCostFen ?? null,
        costStatus: effective ? (effective.effectiveTo <= soon ? 'EXPIRING' : 'ACTIVE') : 'MISSING',
        // Full cost provenance — the snapshot must be audit-complete (spec:
        // "quotation stores the point-in-time snapshot"): who supplied the cost,
        // which CostVersion (its interval IS its identity), currency, source, review state.
        costSnapshot: effective ? {
          supplierId: effective.supplierId,
          unitCostFen: effective.unitCostFen,
          currency: effective.currency,
          effectiveFrom: effective.effectiveFrom,
          effectiveTo: effective.effectiveTo,
          priceSource: effective.priceSource,
          reviewStatus: effective.reviewStatus,
        } : null,
      },
      configItem: {
        sku: meta.sku as string, kind: meta.kind as ConfigItem['kind'],
        requiredOptionSkus: (meta.requiredOptionSkus as string[]) ?? [],
        requiresSkus: (meta.requiresSkus as string[]) ?? [],
        excludesSkus: (meta.excludesSkus as string[]) ?? [],
        maxQuantity: meta.maxQuantity as number | undefined,
      },
    };
  }));
}

/**
 * Prices loaded lines, applies the optional total override, returns line rows + summary.
 *
 * Reconciliation invariant (header ≡ lines): `summary.actualTotalUsdCents` is ALWAYS
 * exactly the sum of `lineRows[*].actualLineTotalUsdCents` (or null when unknown).
 * The rounded suggested total is ADVISORY — adopting it means submitting it as a
 * total override, which re-allocates and keeps the invariant. Amounts are stored
 * as line totals; a per-unit "actual" is NOT derived when qty > 1 (it may not
 * divide evenly) — the manual unit override, if any, is preserved verbatim as audit.
 */
export function buildSnapshot(
  loaded: LoadedLine[],
  policy: PolicyData,
  operator: string,
  totalOverride?: { totalUsdCents: number; reason: string },
) {
  const configErrors = validateConfiguration(
    loaded.filter((l) => l.configItem).map((l) => ({ item: l.configItem!, qty: l.input.qty })),
  );
  if (configErrors.length) throw new Error(`VALIDATION: ${configErrors.join('; ')}`);
  if (totalOverride && !totalOverride.reason?.trim()) {
    throw new Error('VALIDATION: a total override requires a reason');
  }

  const engines = loaded.map((l) => l.engine);
  const perLine = engines.map((e) => priceLine(e, policy));
  const now = new Date().toISOString();

  let lineTotals: Array<number | null>;
  if (totalOverride) {
    // Spec: allocation weights are the SUGGESTED line totals — never the
    // manually adjusted prices (that would let one override skew everyone's share).
    const allocated = allocateTotalOverride(
      engines.map((e, i) => ({
        sku: e.sku, lineType: e.lineType,
        suggestedLineTotalUsdCents:
          perLine[i].suggestedUnitUsdCents == null ? null : perLine[i].suggestedUnitUsdCents! * e.qty,
      })),
      totalOverride.totalUsdCents,
    );
    lineTotals = allocated.map((a) => a.actualLineTotalUsdCents);
  } else {
    lineTotals = engines.map((e, i) => {
      const unit = e.actualUnitUsdCents ?? perLine[i].suggestedUnitUsdCents;
      return unit == null ? null : unit * e.qty;
    });
  }

  const summary = priceQuotation(engines, policy);
  // Header total = exact line-total sum (reconciliation invariant). With an
  // override, Σ allocated ≡ override total by the largest-remainder construction.
  const actualTotalUsdCents = lineTotals.some((t) => t == null)
    ? null
    : (lineTotals as number[]).reduce((s, t) => s + t, 0);
  const actualMarginBp = actualTotalUsdCents != null && summary.totalCostUsdCents != null && actualTotalUsdCents > 0
    ? Math.round(((actualTotalUsdCents - summary.totalCostUsdCents) * 10_000) / actualTotalUsdCents)
    : null;

  const lineRows = loaded.map((l, i) => ({
    lineNo: i + 1,
    ...l.snapshot,
    qty: l.input.qty,
    lineType: l.input.lineType,
    surchargeUsdCents: l.input.surchargeUsdCents,
    fxRmbPerUsdMilli: policy.fxRmbPerUsdMilli,
    marginBpApplied: perLine[i].marginBpApplied,
    unitCostUsdCents: perLine[i].unitCostUsdCents,
    suggestedUnitUsdCents: perLine[i].suggestedUnitUsdCents,
    actualUnitUsdCents: l.input.actualUnitUsdCents ?? null,
    overrideReason: l.input.overrideReason ?? null,
    // Override audit: reason alone is not audit-complete — record who and when.
    overriddenBy: l.input.actualUnitUsdCents != null ? operator : null,
    overriddenAt: l.input.actualUnitUsdCents != null ? now : null,
    actualLineTotalUsdCents: lineTotals[i],
  }));

  return {
    lineRows,
    summary: {
      totalCostUsdCents: summary.totalCostUsdCents,
      suggestedTotalRawUsdCents: summary.suggestedTotalRawUsdCents,
      suggestedTotalUsdCents: summary.suggestedTotalUsdCents,
      actualTotalUsdCents,
      actualMarginBp,
      belowMinMargin: actualMarginBp != null && actualMarginBp < policy.minMarginBp,
      incomplete: summary.incomplete,
      totalOverride: totalOverride
        ? { ...totalOverride, overriddenBy: operator, overriddenAt: now }
        : null,
    },
  };
}

export const mapTxError = (e: unknown, what: string): never => {
  if ((e as Error).name === 'TransactionCanceledException') {
    throw new Error(`CONFLICT: concurrent ${what} — refresh and retry`);
  }
  throw e;
};

export async function pbCreateQuotationDraft(event: PriceApiEvent) {
  const input = parseInput<CreateQuotationInput>(event);
  if (!input.schemeLabel?.trim()) throw new Error('VALIDATION: schemeLabel is required');
  if (!input.customerName?.trim()) throw new Error('VALIDATION: customerName is required');
  if ((input.lines?.length ?? 0) > MAX_LINES) {
    throw new Error(`VALIDATION: a quotation is capped at ${MAX_LINES} lines`);
  }

  const policy = await loadPolicy();
  const loaded = await loadLines(input.lines ?? []);
  const operator = getOperator(event);
  const { lineRows, summary } = buildSnapshot(loaded, policy, operator, input.totalOverride);

  // Spec invariant 1 — number allocation is read-then-CAS, with explicit
  // first-creation semantics for a new year's counter.
  const now = new Date().toISOString();
  const year = Number(now.slice(0, 4));
  const counterKey = { PK: 'COUNTER#QUOTATION', SK: `YEAR#${year}` };
  const counterRes = await docClient.send(new GetCommand({
    TableName: TABLE_NAME(), Key: counterKey, ConsistentRead: true,
  }));
  const current = counterRes.Item?.seq as number | undefined;
  const next = (current ?? 0) + 1;
  const quotationNumber = formatQuotationNumber(year, next);
  const pk = `PQUO#${quotationNumber}`;

  const counterOp = current === undefined
    ? {
      Update: {
        TableName: TABLE_NAME(), Key: counterKey,
        UpdateExpression: 'SET seq = :next',
        ConditionExpression: 'attribute_not_exists(PK)',
        ExpressionAttributeValues: { ':next': next },
      },
    }
    : {
      Update: {
        TableName: TABLE_NAME(), Key: counterKey,
        UpdateExpression: 'SET seq = :next',
        ConditionExpression: 'seq = :expected',
        ExpressionAttributeValues: { ':next': next, ':expected': current },
      },
    };

  const header = {
    PK: pk, SK: versionSk(1),
    GSI1PK: 'QUOTATIONS', GSI1SK: `${now}#${quotationNumber}#v1`,
    quotationNumber, version: 1, revision: 1, status: 'DRAFT',
    schemeLabel: input.schemeLabel.trim(), customerName: input.customerName.trim(),
    rfqId: input.rfqId ?? null, currency: input.currency ?? 'USD',
    validUntil: input.validUntil ?? null, tradeTerms: input.tradeTerms ?? null,
    paymentTerms: input.paymentTerms ?? null, notes: input.notes ?? null,
    policySnapshot: {
      fxRmbPerUsdMilli: policy.fxRmbPerUsdMilli, defaultMarginBp: policy.defaultMarginBp,
      minMarginBp: policy.minMarginBp, roundingGranularityUsdCents: policy.roundingGranularityUsdCents,
    },
    ...summary,
    lineCount: lineRows.length,
    createdAt: now, updatedAt: now, createdBy: operator,
  };

  try {
    await docClient.send(new TransactWriteCommand({
      TransactItems: [
        counterOp,
        {
          Put: {
            TableName: TABLE_NAME(),
            Item: {
              PK: pk, SK: 'SCHEME',
              GSI1PK: `RFQ_QUOTES#${input.rfqId ?? 'NONE'}`, GSI1SK: `${now}#${quotationNumber}`,
              quotationNumber, schemeLabel: input.schemeLabel.trim(),
              rfqId: input.rfqId ?? null, customerName: input.customerName.trim(),
              latestVersion: 1, createdAt: now,
              // acceptedVersion is deliberately ABSENT — P2's accept transaction
              // conditions on attribute_not_exists(acceptedVersion) (spec inv. 4).
            },
            ConditionExpression: 'attribute_not_exists(PK)',
          },
        },
        { Put: { TableName: TABLE_NAME(), Item: header, ConditionExpression: 'attribute_not_exists(PK)' } },
        ...lineRows.map((row) => ({
          Put: {
            TableName: TABLE_NAME(),
            Item: { PK: pk, SK: lineSk(1, row.lineNo), quotationNumber, version: 1, ...row },
          },
        })),
      ],
    }));
  } catch (e) {
    mapTxError(e, 'quotation number allocation');
  }

  const { PK, SK, GSI1PK, GSI1SK, ...headerOut } = header;
  return { ...headerOut, lines: lineRows };
}

export async function pbUpdateQuotationDraft(_event: PriceApiEvent): Promise<unknown> {
  throw new Error('NOT_IMPLEMENTED: pbUpdateQuotationDraft'); // Task 12
}
export async function pbGetQuotation(_event: PriceApiEvent): Promise<unknown> {
  throw new Error('NOT_IMPLEMENTED: pbGetQuotation'); // Task 12
}
export async function pbListQuotations(_event: PriceApiEvent): Promise<unknown> {
  throw new Error('NOT_IMPLEMENTED: pbListQuotations'); // Task 12
}
```

- [ ] **Step 4: Run — verify PASS** (7 tests), then **commit**

```bash
git add amplify/functions/price-api/resolvers/quotationResolvers.ts amplify/functions/price-api/resolvers/quotationResolvers.test.ts
git commit -m "feat(price-api): quotation draft creation (counter CAS + single-transaction snapshot)"
```

---

### Task 12: Quotation draft update (transactional multi-line edit) + get + list

Spec invariant 5: header revision CAS + complete line delta in ONE transaction; updating an existing line key is a single `Put`, never `Delete+Put` of the same key. Full-replacement strategy: new lines are numbered 1..N and `Put` (overwriting keys 1..N), old lines with lineNo > N are `Delete`d — old/new key sets overlap only via overwrites, so no same-key Delete+Put ever occurs.

**Files:**
- Modify: `amplify/functions/price-api/resolvers/quotationResolvers.ts` (replace the three stubs)
- Test: append to `amplify/functions/price-api/resolvers/quotationResolvers.test.ts`

- [ ] **Step 1: Write the failing tests (append to the Task 11 test file)**

```ts
import { pbUpdateQuotationDraft, pbGetQuotation, pbListQuotations } from './quotationResolvers.js';

const headerItem = {
  PK: 'PQUO#Q-2026-0008', SK: 'V#001', quotationNumber: 'Q-2026-0008', version: 1,
  revision: 2, status: 'DRAFT', schemeLabel: 'Standard', customerName: 'MIT Nano',
  lineCount: 2, createdAt: 'T0', createdBy: 'boss@ninescrolls.com',
};

describe('pbUpdateQuotationDraft', () => {
  it('recomputes, CASes the header revision, puts new lines and deletes the tail — one transaction', async () => {
    send
      .mockResolvedValueOnce({ Item: headerItem })                       // header Get (consistent)
      .mockResolvedValueOnce(policyItem)                                 // policy
      .mockResolvedValueOnce({ Items: [machineMeta, cost] })             // line load
      .mockResolvedValueOnce({});                                        // TransactWriteCommand
    const res = await pbUpdateQuotationDraft(ev({
      quotationNumber: 'Q-2026-0008', version: 1, expectedRevision: 2,
      customerName: 'MIT Nano',
      lines: [{ itemId: 'c1', qty: 2, lineType: 'NORMAL' }],             // 2 lines -> 1 line
    })) as Record<string, unknown>;
    expect(res.revision).toBe(3);

    const tx = send.mock.calls[3][0].input.TransactItems;
    const headerOp = tx[0];
    expect(headerOp.Update.ConditionExpression).toContain('revision = :expected');
    expect(headerOp.Update.ConditionExpression).toContain('#status = :draft');
    const putOps = tx.filter((op: Record<string, unknown>) => 'Put' in op);
    const delOps = tx.filter((op: Record<string, unknown>) => 'Delete' in op);
    expect(putOps).toHaveLength(1);                                      // line 1 overwrite
    expect(delOps).toHaveLength(1);                                      // old line 2 removed
    expect(delOps[0].Delete.Key.SK).toBe('V#001#LINE#02');
  });

  it('rejects a stale revision as CONFLICT without partial application', async () => {
    send
      .mockResolvedValueOnce({ Item: headerItem })
      .mockResolvedValueOnce(policyItem)
      .mockResolvedValueOnce({ Items: [machineMeta, cost] })
      .mockRejectedValueOnce(Object.assign(new Error('x'), { name: 'TransactionCanceledException' }));
    await expect(pbUpdateQuotationDraft(ev({
      quotationNumber: 'Q-2026-0008', version: 1, expectedRevision: 1,
      lines: [{ itemId: 'c1', qty: 1, lineType: 'NORMAL' }],
    }))).rejects.toThrow(/^CONFLICT:/);
  });

  it('refuses to edit a non-DRAFT version', async () => {
    send.mockResolvedValueOnce({ Item: { ...headerItem, status: 'GENERATED' } });
    await expect(pbUpdateQuotationDraft(ev({
      quotationNumber: 'Q-2026-0008', version: 1, expectedRevision: 2,
      lines: [{ itemId: 'c1', qty: 1, lineType: 'NORMAL' }],
    }))).rejects.toThrow(/^VALIDATION:.*DRAFT/);
  });
});

describe('pbGetQuotation', () => {
  it('assembles scheme, versions and their lines from one partition Query', async () => {
    send.mockResolvedValueOnce({
      Items: [
        { PK: 'PQUO#Q-2026-0008', SK: 'SCHEME', quotationNumber: 'Q-2026-0008', latestVersion: 1 },
        headerItem,
        { PK: 'PQUO#Q-2026-0008', SK: 'V#001#LINE#01', lineNo: 1, sku: 'RIE-300' },
      ],
    });
    const res = await pbGetQuotation(ev({ quotationNumber: 'Q-2026-0008' })) as {
      scheme: Record<string, unknown>; versions: Array<{ lines: unknown[] }>;
    };
    expect(res.scheme.latestVersion).toBe(1);
    expect(res.versions).toHaveLength(1);
    expect(res.versions[0].lines).toHaveLength(1);
  });
});

describe('pbListQuotations', () => {
  it('queries the QUOTATIONS GSI partition newest-first', async () => {
    send.mockResolvedValueOnce({ Items: [{ ...headerItem, GSI1PK: 'QUOTATIONS', GSI1SK: 'x' }] });
    const res = await pbListQuotations(ev({})) as { items: unknown[] };
    expect(res.items).toHaveLength(1);
    const q = send.mock.calls[0][0].input;
    expect(q.IndexName).toBe('GSI1');
    expect(q.ScanIndexForward).toBe(false);
  });
});
```

- [ ] **Step 2: Run — verify FAIL**, then **Step 3: Implement (replace the three stubs)**

In `quotationResolvers.ts`, replace the three `NOT_IMPLEMENTED` stubs with:

```ts
interface UpdateQuotationInput {
  quotationNumber: string;
  version: number;
  expectedRevision: number;
  customerName?: string;
  validUntil?: string; tradeTerms?: string; paymentTerms?: string; notes?: string;
  lines: QuotationLineInput[];
  totalOverride?: { totalUsdCents: number; reason: string };
}

export async function pbUpdateQuotationDraft(event: PriceApiEvent) {
  const input = parseInput<UpdateQuotationInput>(event);
  if (!input.quotationNumber || !input.version || !input.expectedRevision) {
    throw new Error('VALIDATION: quotationNumber, version and expectedRevision are required');
  }
  const pk = `PQUO#${input.quotationNumber}`;
  const sk = versionSk(input.version);

  const headerRes = await docClient.send(new GetCommand({
    TableName: TABLE_NAME(), Key: { PK: pk, SK: sk }, ConsistentRead: true,
  }));
  const header = headerRes.Item;
  if (!header) throw new Error(`NOT_FOUND: quotation ${input.quotationNumber} v${input.version}`);
  if (header.status !== 'DRAFT') {
    // Spec mutability boundary: versions freeze at DRAFT -> GENERATED.
    throw new Error('VALIDATION: only DRAFT versions are editable — later changes copy into a new version (P2)');
  }

  const policy = await loadPolicy();
  const loaded = await loadLines(input.lines ?? []);
  const { lineRows, summary } = buildSnapshot(loaded, policy, getOperator(event), input.totalOverride);

  const now = new Date().toISOString();
  const newRevision = input.expectedRevision + 1;
  const oldCount = (header.lineCount as number) ?? 0;
  const scalarPatch: Record<string, unknown> = {
    customerName: input.customerName?.trim() ?? header.customerName,
    validUntil: input.validUntil ?? header.validUntil ?? null,
    tradeTerms: input.tradeTerms ?? header.tradeTerms ?? null,
    paymentTerms: input.paymentTerms ?? header.paymentTerms ?? null,
    notes: input.notes ?? header.notes ?? null,
  };

  const sets: string[] = [
    'revision = :rev', 'updatedAt = :now', 'lineCount = :lc', 'GSI1SK = :gsk',
    ...Object.keys(scalarPatch).map((k) => `#${k} = :${k}`),
    ...Object.keys(summary).map((k) => `#s_${k} = :s_${k}`),
  ];
  const names: Record<string, string> = {
    '#status': 'status',
    ...Object.fromEntries(Object.keys(scalarPatch).map((k) => [`#${k}`, k])),
    ...Object.fromEntries(Object.keys(summary).map((k) => [`#s_${k}`, k])),
  };
  const values: Record<string, unknown> = {
    ':rev': newRevision, ':now': now, ':lc': lineRows.length,
    ':gsk': `${now}#${input.quotationNumber}#v${input.version}`,
    ':expected': input.expectedRevision, ':draft': 'DRAFT',
    ...Object.fromEntries(Object.entries(scalarPatch).map(([k, v]) => [`:${k}`, v])),
    ...Object.fromEntries(Object.entries(summary).map(([k, v]) => [`:s_${k}`, v ?? null])),
  };

  try {
    await docClient.send(new TransactWriteCommand({
      TransactItems: [
        {
          Update: {
            TableName: TABLE_NAME(), Key: { PK: pk, SK: sk },
            UpdateExpression: `SET ${sets.join(', ')}`,
            ConditionExpression: 'revision = :expected AND #status = :draft',
            ExpressionAttributeNames: names,
            ExpressionAttributeValues: values,
          },
        },
        // Overwrite lines 1..N (single Put per key — never Delete+Put of the same key).
        ...lineRows.map((row) => ({
          Put: {
            TableName: TABLE_NAME(),
            Item: { PK: pk, SK: lineSk(input.version, row.lineNo), quotationNumber: input.quotationNumber, version: input.version, ...row },
          },
        })),
        // Delete only the tail beyond the new count.
        ...Array.from({ length: Math.max(0, oldCount - lineRows.length) }, (_, i) => ({
          Delete: {
            TableName: TABLE_NAME(),
            Key: { PK: pk, SK: lineSk(input.version, lineRows.length + i + 1) },
          },
        })),
      ],
    }));
  } catch (e) {
    mapTxError(e, 'draft edit (stale revision or state change)');
  }

  return {
    quotationNumber: input.quotationNumber, version: input.version, revision: newRevision,
    status: 'DRAFT', ...scalarPatch, ...summary, lineCount: lineRows.length,
    updatedAt: now, lines: lineRows,
  };
}

export async function pbGetQuotation(event: PriceApiEvent) {
  const { quotationNumber } = parseInput<{ quotationNumber: string }>(event);
  if (!quotationNumber) throw new Error('VALIDATION: quotationNumber is required');
  const rows: Record<string, unknown>[] = [];
  let key: Record<string, unknown> | undefined;
  do {
    const r = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME(),
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: { ':pk': `PQUO#${quotationNumber}` },
      ExclusiveStartKey: key,
    }));
    rows.push(...(r.Items ?? []));
    key = r.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (key);
  if (!rows.length) throw new Error(`NOT_FOUND: quotation ${quotationNumber}`);

  const strip = (it: Record<string, unknown>) => {
    const { PK, SK, GSI1PK, GSI1SK, ...rest } = it;
    return rest;
  };
  const scheme = rows.find((it) => it.SK === 'SCHEME');
  const headers = rows.filter((it) => /^V#\d{3}$/.test(it.SK as string));
  const lines = rows.filter((it) => /^V#\d{3}#LINE#/.test(it.SK as string));
  return {
    scheme: scheme ? strip(scheme) : null,
    versions: headers
      .sort((a, b) => (a.SK as string).localeCompare(b.SK as string))
      .map((h) => ({
        ...strip(h),
        lines: lines
          .filter((l) => (l.SK as string).startsWith(`${h.SK}#LINE#`))
          .sort((a, b) => (a.SK as string).localeCompare(b.SK as string))
          .map(strip),
      })),
  };
}

export async function pbListQuotations(event: PriceApiEvent) {
  const { limit = 50, nextToken } = (event.arguments ?? {}) as { limit?: number; nextToken?: string | null };
  const effectiveLimit = Math.min(Math.max(limit || 50, 1), 200);
  const startKey = nextToken ? JSON.parse(Buffer.from(nextToken, 'base64').toString()) : undefined;
  const r = await docClient.send(new QueryCommand({
    TableName: TABLE_NAME(),
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk',
    ExpressionAttributeValues: { ':pk': 'QUOTATIONS' },
    ScanIndexForward: false,
    ExclusiveStartKey: startKey,
    Limit: effectiveLimit,
  }));
  const strip = (it: Record<string, unknown>) => {
    const { PK, SK, GSI1PK, GSI1SK, ...rest } = it;
    return rest;
  };
  return {
    items: (r.Items ?? []).map(strip),
    nextToken: r.LastEvaluatedKey ? Buffer.from(JSON.stringify(r.LastEvaluatedKey)).toString('base64') : null,
  };
}
```

- [ ] **Step 4: Run the whole backend suite — verify PASS**

Run: `npx vitest run amplify/functions/price-api --exclude '**/.claude/**'`
Expected: all price-api tests green (handler, libs, five resolver files).

- [ ] **Step 5: Commit**

```bash
git add amplify/functions/price-api/resolvers/quotationResolvers.ts amplify/functions/price-api/resolvers/quotationResolvers.test.ts
git commit -m "feat(price-api): transactional draft edit + quotation get/list"
```

---

### Task 12b: Deterministic concurrency harness — prove exactly-one-wins

Mock-shaped tests (Tasks 9/11/12) pin the request shapes; this task proves the **invariants** hold under real interleaving: a fake DynamoDB with genuine conditional-write semantics, and a read/transact gate that forces both racers to read before either commits.

**Files:**
- Create: `amplify/functions/price-api/lib/testing/fakeDdb.ts`
- Test: `amplify/functions/price-api/resolvers/concurrency.test.ts`

- [ ] **Step 1: Implement the fake (test infrastructure — no TDD ceremony, its tests ARE Task 12b's tests)**

Create `amplify/functions/price-api/lib/testing/fakeDdb.ts`:

```ts
/**
 * Minimal in-memory DynamoDB fake with REAL conditional-write semantics for the
 * expression subset price-api uses. Not a general emulator — supported grammar:
 *   Conditions: attribute_not_exists(f) | f = :v | f < :v, joined by a single AND/OR
 *   Updates:    SET f = :v [, ...] | SET f = f + :v | ADD f :v
 * TransactWrite evaluates ALL conditions first, applies all-or-nothing, and throws
 * name='TransactionCanceledException' on any failure — matching the real client.
 */
type Item = Record<string, unknown>;

const key = (it: { PK: unknown; SK: unknown }) => `${it.PK}|${it.SK}`;

function subNames(expr: string, names?: Record<string, string>): string {
  let out = expr;
  for (const [alias, real] of Object.entries(names ?? {})) out = out.split(alias).join(real);
  return out;
}

function evalAtom(atom: string, item: Item | undefined, values: Record<string, unknown>): boolean {
  const notExists = atom.match(/^attribute_not_exists\((\w+)\)$/);
  if (notExists) return item === undefined || !(notExists[1] in item);
  const exists = atom.match(/^attribute_exists\((\w+)\)$/);
  if (exists) return item !== undefined && exists[1] in item;
  const eq = atom.match(/^(\w+) = (:\w+)$/);
  if (eq) return item !== undefined && item[eq[1]] === values[eq[2]];
  const lt = atom.match(/^(\w+) < (:\w+)$/);
  if (lt) return item !== undefined && (item[lt[1]] as number) < (values[lt[2]] as number);
  throw new Error(`fakeDdb: unsupported condition atom: ${atom}`);
}

function evalCondition(expr: string | undefined, item: Item | undefined, values: Record<string, unknown>, names?: Record<string, string>): boolean {
  if (!expr) return true;
  const e = subNames(expr.trim(), names);
  if (e.includes(' OR ')) return e.split(' OR ').some((a) => evalAtom(a.trim(), item, values));
  if (e.includes(' AND ')) return e.split(' AND ').every((a) => evalAtom(a.trim(), item, values));
  return evalAtom(e, item, values);
}

function applyUpdate(expr: string, item: Item, values: Record<string, unknown>, names?: Record<string, string>): void {
  const e = subNames(expr.trim(), names);
  const addMatch = e.match(/(?:^|\s)ADD (\w+) (:\w+)/);
  if (addMatch) {
    item[addMatch[1]] = ((item[addMatch[1]] as number) ?? 0) + (values[addMatch[2]] as number);
  }
  const setMatch = e.match(/SET (.+?)(?:\sADD\s|$)/);
  if (setMatch) {
    for (const clause of setMatch[1].split(',').map((c) => c.trim())) {
      const incr = clause.match(/^(\w+) = (\w+) \+ (:\w+)$/);
      if (incr) { item[incr[1]] = ((item[incr[2]] as number) ?? 0) + (values[incr[3]] as number); continue; }
      const assign = clause.match(/^(\w+) = (:\w+)$/);
      if (assign) { item[assign[1]] = values[assign[2]]; continue; }
      throw new Error(`fakeDdb: unsupported SET clause: ${clause}`);
    }
  }
}

interface CommandLike { constructor: { name: string }; input: Record<string, never> & Record<string, unknown> }

export class FakeDdb {
  store = new Map<string, Item>();

  seed(items: Item[]) { for (const it of items) this.store.set(key(it as never), { ...it }); }

  async send(cmd: CommandLike): Promise<Record<string, unknown>> {
    const input = cmd.input as Record<string, unknown>;
    switch (cmd.constructor.name) {
      case 'GetCommand': {
        const item = this.store.get(key(input.Key as never));
        return item ? { Item: { ...item } } : {};
      }
      case 'QueryCommand': {
        const values = (input.ExpressionAttributeValues ?? {}) as Record<string, unknown>;
        const cond = input.KeyConditionExpression as string;
        const pkMatch = cond.match(/PK = (:\w+)/) ?? cond.match(/GSI1PK = (:\w+)/);
        const gsi = Boolean(input.IndexName);
        const pkField = gsi ? 'GSI1PK' : 'PK';
        const pkVal = values[pkMatch![1]];
        const bw = cond.match(/begins_with\((\w+), (:\w+)\)/);
        let items = [...this.store.values()].filter((it) => it[pkField] === pkVal
          && (!bw || String(it[bw[1]]).startsWith(String(values[bw[2]]))));
        const sortField = gsi ? 'GSI1SK' : 'SK';
        items = items.sort((a, b) => String(a[sortField]).localeCompare(String(b[sortField])));
        if (input.ScanIndexForward === false) items.reverse();
        return { Items: items.map((it) => ({ ...it })) };
      }
      case 'PutCommand':
      case 'UpdateCommand':
      case 'TransactWriteCommand': {
        const ops = cmd.constructor.name === 'TransactWriteCommand'
          ? (input.TransactItems as Array<Record<string, Record<string, unknown>>>)
          : [cmd.constructor.name === 'PutCommand' ? { Put: input } : { Update: input }];
        // Phase 1: evaluate every condition against the CURRENT store.
        for (const op of ops) {
          const spec = op.Put ?? op.Update ?? op.Delete;
          const targetKey = op.Put ? key(spec.Item as never) : key(spec.Key as never);
          const ok = evalCondition(
            spec.ConditionExpression as string | undefined,
            this.store.get(targetKey),
            (spec.ExpressionAttributeValues ?? {}) as Record<string, unknown>,
            spec.ExpressionAttributeNames as Record<string, string> | undefined,
          );
          if (!ok) throw Object.assign(new Error('ConditionalCheckFailed'), {
            name: cmd.constructor.name === 'TransactWriteCommand'
              ? 'TransactionCanceledException' : 'ConditionalCheckFailedException',
          });
        }
        // Phase 2: apply all-or-nothing.
        for (const op of ops) {
          if (op.Put) {
            this.store.set(key(op.Put.Item as never), { ...(op.Put.Item as Item) });
          } else if (op.Update) {
            const k = key(op.Update.Key as never);
            const item = this.store.get(k) ?? { ...(op.Update.Key as Item) };
            applyUpdate(
              op.Update.UpdateExpression as string, item,
              (op.Update.ExpressionAttributeValues ?? {}) as Record<string, unknown>,
              op.Update.ExpressionAttributeNames as Record<string, string> | undefined,
            );
            this.store.set(k, item);
          } else if (op.Delete) {
            this.store.delete(key(op.Delete.Key as never));
          }
        }
        return {};
      }
      default:
        throw new Error(`fakeDdb: unsupported command ${cmd.constructor.name}`);
    }
  }
}

/**
 * Race gate: both contenders complete all their READS before EITHER transaction
 * commits — the deterministic worst-case interleaving for read-then-CAS protocols.
 */
export function gatedSend(fake: FakeDdb, expectedReads: number) {
  let reads = 0;
  let release!: () => void;
  const gate = new Promise<void>((r) => { release = r; });
  return async (cmd: CommandLike) => {
    if (cmd.constructor.name === 'TransactWriteCommand') await gate;
    const res = await fake.send(cmd);
    if (cmd.constructor.name === 'GetCommand' || cmd.constructor.name === 'QueryCommand') {
      reads += 1;
      if (reads >= expectedReads) release();
    }
    return res;
  };
}
```

- [ ] **Step 2: Write the invariant tests**

Create `amplify/functions/price-api/resolvers/concurrency.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FakeDdb, gatedSend } from '../lib/testing/fakeDdb.js';

let sendImpl: (cmd: unknown) => Promise<unknown> = async () => ({});
vi.mock('../lib/dynamodb.js', () => ({
  docClient: { send: (cmd: unknown) => sendImpl(cmd) },
  TABLE_NAME: () => 'TestTable',
}));

import { pbAppendCostVersion } from './costVersionResolvers.js';
import { pbCreateQuotationDraft, pbUpdateQuotationDraft } from './quotationResolvers.js';

const ev = (input: Record<string, unknown>) => ({
  info: { fieldName: 'x', parentTypeName: 'Mutation' },
  arguments: { input },
  identity: { sub: 's', groups: ['admin'], claims: { email: 'boss@ninescrolls.com' } },
});

const machineMeta = {
  PK: 'PCAT#c1', SK: 'META', GSI1PK: 'CATALOG_ITEMS', GSI1SK: 'RIE#RIE-300',
  itemId: 'c1', sku: 'RIE-300', name: 'RIE 300', series: 'RIE', kind: 'MACHINE',
  requiredOptionSkus: [], requiresSkus: [], excludesSkus: [],
};
const activeCost = {
  PK: 'PCAT#c1', SK: 'COST#s1#2020-01-01', itemId: 'c1', supplierId: 's1',
  unitCostFen: 725_000, currency: 'RMB', effectiveFrom: '2020-01-01', effectiveTo: '2099-01-01',
  priceSource: 'MANUAL_ENTRY', reviewStatus: 'APPROVED',
};
const settle = (ps: Promise<unknown>[]) => Promise.allSettled(ps);

beforeEach(() => { sendImpl = async () => ({}); });

describe('concurrency invariants (deterministic worst-case interleaving)', () => {
  it('CostVersion: two racers on the same gap — exactly one wins, exactly one version lands', async () => {
    const fake = new FakeDdb();
    // Both appenders read guard (1 Get) + versions (1 Query) => 4 reads total before any tx.
    sendImpl = gatedSend(fake, 4);
    const mk = (from: string, to: string) => pbAppendCostVersion(ev({
      itemId: 'c1', supplierId: 's1', unitCostFen: 100,
      effectiveFrom: from, effectiveTo: to, priceSource: 'MANUAL_ENTRY',
    }));
    const results = await settle([mk('2026-01-01', '2026-07-01'), mk('2026-03-01', '2026-09-01')]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
    expect(fulfilled).toHaveLength(1);                 // exactly-one-wins
    expect(rejected[0].reason.message).toMatch(/^CONFLICT:/);
    const versions = [...fake.store.keys()].filter((k) => k.includes('|COST#s1#'));
    expect(versions).toHaveLength(1);                  // the overlapping loser never landed
    expect(fake.store.get('PCAT#c1|COSTGUARD#s1')!.revision).toBe(1);
  });

  it('Quotation numbers: two concurrent creates never share a number; retry gets the next one', async () => {
    const fake = new FakeDdb();
    fake.seed([machineMeta, activeCost]);
    // Each create reads: policy Get + item Query + counter Get = 3 => 6 before any tx.
    sendImpl = gatedSend(fake, 6);
    const mk = () => pbCreateQuotationDraft(ev({
      schemeLabel: 'Standard', customerName: 'MIT Nano',
      lines: [{ itemId: 'c1', qty: 1, lineType: 'NORMAL' }],
    }));
    const results = await settle([mk(), mk()]);
    const won = results.filter((r) => r.status === 'fulfilled') as PromiseFulfilledResult<{ quotationNumber: string }>[];
    expect(won).toHaveLength(1);
    expect(results.some((r) => r.status === 'rejected'
      && /^CONFLICT:/.test((r as PromiseRejectedResult).reason.message))).toBe(true);

    sendImpl = (cmd) => fake.send(cmd as never); // ungated retry against the same store
    const retry = await mk() as { quotationNumber: string };
    expect(retry.quotationNumber).not.toBe(won[0].value.quotationNumber);
    // No orphan numbers: counter equals the number of scheme records.
    const counter = fake.store.get(`COUNTER#QUOTATION|YEAR#${new Date().getFullYear()}`)!.seq;
    const schemes = [...fake.store.keys()].filter((k) => k.endsWith('|SCHEME'));
    expect(counter).toBe(schemes.length);
  });

  it('DRAFT edit: stale racer applies NONE of its line delta', async () => {
    const fake = new FakeDdb();
    fake.seed([machineMeta, activeCost]);
    sendImpl = (cmd) => fake.send(cmd as never);
    const created = await pbCreateQuotationDraft(ev({
      schemeLabel: 'Standard', customerName: 'MIT Nano',
      lines: [{ itemId: 'c1', qty: 1, lineType: 'NORMAL' }, { sku: 'FREIGHT', qty: 1, lineType: 'SURCHARGE', surchargeUsdCents: 100 }],
    })) as { quotationNumber: string };

    // Both editors read header+policy+lines (3 reads each) before either commits.
    sendImpl = gatedSend(fake, 6);
    const edit = (qty: number) => pbUpdateQuotationDraft(ev({
      quotationNumber: created.quotationNumber, version: 1, expectedRevision: 1,
      lines: [{ itemId: 'c1', qty, lineType: 'NORMAL' }],   // 2 lines -> 1 line
    }));
    const results = await settle([edit(2), edit(3)]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);

    const header = fake.store.get(`PQUO#${created.quotationNumber}|V#001`)!;
    expect(header.revision).toBe(2);                   // exactly one bump
    expect(header.lineCount).toBe(1);
    const lines = [...fake.store.keys()].filter((k) => k.includes('|V#001#LINE#'));
    expect(lines).toHaveLength(1);                     // tail deleted once, no partial delta
  });
});
```

- [ ] **Step 3: Run — verify PASS**

Run: `npx vitest run amplify/functions/price-api/resolvers/concurrency.test.ts --exclude '**/.claude/**'`
Expected: 3 passed. If a resolver's read count changes in a refactor, the gate's `expectedReads` must change with it — that is intentional coupling: the gate encodes the protocol's read phase.

- [ ] **Step 4: Commit**

```bash
git add amplify/functions/price-api/lib/testing/fakeDdb.ts amplify/functions/price-api/resolvers/concurrency.test.ts
git commit -m "test(price-api): deterministic concurrency harness — exactly-one-wins invariants"
```

---

### Task 13: AppSync schema + backend wiring

No TDD here (infrastructure declarations); verification is `npx ampx sandbox` synth or `npx tsc`.

**Files:**
- Modify: `amplify/data/resource.ts`
- Modify: `amplify/backend.ts`

- [ ] **Step 1: Import priceApi in the data schema**

In `amplify/data/resource.ts`, next to the existing import at line ~3 (`import { logisticsApi } from '../functions/logistics-api/resource';`), add:

```ts
import { priceApi } from '../functions/price-api/resource';
```

- [ ] **Step 2: Add the 14 operations**

Inside the schema object, after the logistics queries block (after `logisticsStats`, around line 882), add the queries; after the logistics mutations block (after `removeLeg`-area mutations near line 1150), add the mutations. All use `a.json()` (locked decision 1):

```ts
  // ── Price Book & Quotations (price-api) — ALL admin-gated server-side ──
  pbListSuppliers: a
    .query()
    .returns(a.json().required())
    .handler(a.handler.function(priceApi))
    .authorization((allow) => [allow.authenticated()]),

  pbListCatalogItems: a
    .query()
    .returns(a.json().required())
    .handler(a.handler.function(priceApi))
    .authorization((allow) => [allow.authenticated()]),

  pbListCostVersions: a
    .query()
    .arguments({ input: a.json().required() })
    .returns(a.json().required())
    .handler(a.handler.function(priceApi))
    .authorization((allow) => [allow.authenticated()]),

  pbGetPricingPolicy: a
    .query()
    .returns(a.json().required())
    .handler(a.handler.function(priceApi))
    .authorization((allow) => [allow.authenticated()]),

  pbGetQuotation: a
    .query()
    .arguments({ input: a.json().required() })
    .returns(a.json().required())
    .handler(a.handler.function(priceApi))
    .authorization((allow) => [allow.authenticated()]),

  pbListQuotations: a
    .query()
    .arguments({ limit: a.integer(), nextToken: a.string() })
    .returns(a.json().required())
    .handler(a.handler.function(priceApi))
    .authorization((allow) => [allow.authenticated()]),
```

Mutations block:

```ts
  pbCreateSupplier: a
    .mutation()
    .arguments({ input: a.json().required() })
    .returns(a.json().required())
    .handler(a.handler.function(priceApi))
    .authorization((allow) => [allow.authenticated()]),

  pbUpdateSupplier: a
    .mutation()
    .arguments({ input: a.json().required() })
    .returns(a.json().required())
    .handler(a.handler.function(priceApi))
    .authorization((allow) => [allow.authenticated()]),

  pbCreateCatalogItem: a
    .mutation()
    .arguments({ input: a.json().required() })
    .returns(a.json().required())
    .handler(a.handler.function(priceApi))
    .authorization((allow) => [allow.authenticated()]),

  pbUpdateCatalogItem: a
    .mutation()
    .arguments({ input: a.json().required() })
    .returns(a.json().required())
    .handler(a.handler.function(priceApi))
    .authorization((allow) => [allow.authenticated()]),

  pbAppendCostVersion: a
    .mutation()
    .arguments({ input: a.json().required() })
    .returns(a.json().required())
    .handler(a.handler.function(priceApi))
    .authorization((allow) => [allow.authenticated()]),

  pbUpdatePricingPolicy: a
    .mutation()
    .arguments({ input: a.json().required() })
    .returns(a.json().required())
    .handler(a.handler.function(priceApi))
    .authorization((allow) => [allow.authenticated()]),

  pbCreateQuotationDraft: a
    .mutation()
    .arguments({ input: a.json().required() })
    .returns(a.json().required())
    .handler(a.handler.function(priceApi))
    .authorization((allow) => [allow.authenticated()]),

  pbUpdateQuotationDraft: a
    .mutation()
    .arguments({ input: a.json().required() })
    .returns(a.json().required())
    .handler(a.handler.function(priceApi))
    .authorization((allow) => [allow.authenticated()]),
```

Note: `allow.authenticated()` here is only transport-level; the REAL gate is `requireAdmin` inside the handler (spec trust boundary). Do not weaken or remove the handler gate on the grounds that the schema "already checks auth."

- [ ] **Step 3: Wire backend.ts**

In `amplify/backend.ts`:

1. Next to line ~16 (`import { logisticsApi } ...`), add:
```ts
import { priceApi } from './functions/price-api/resource';
```
2. In the `defineBackend({ ... })` call (around line 91, next to `logisticsApi,`), add:
```ts
    priceApi,
```
3. Next to the logistics grant block (lines ~542-544), add:
```ts
// Grant price-api Lambda access (Price Book & Quotations — shared single table).
// SECURITY (locked decision 8): the AppSync resolver role is the ONLY business
// caller — do NOT grant lambda:InvokeFunction on price-api to anything, and do
// NOT add priceApi to any cross-Lambda invoke loop below. The admin gate trusts
// event.identity because AppSync verified the JWT; a direct invoker could
// fabricate identity.groups.
intelligenceTable.grantReadWriteData(backend.priceApi.resources.lambda);
backend.priceApi.addEnvironment('INTELLIGENCE_TABLE', intelligenceTable.tableName);
```

Explicit non-action: the `[backend.submitRfq, ...].forEach` invoke-grant loops near line 1116 MUST NOT gain `backend.priceApi` — neither as a grantee nor as a target.

- [ ] **Step 4: Typecheck (BOTH configs — root tsconfig only covers `src/`)**

Run: `npx tsc --noEmit && npm run typecheck:amplify`
(`typecheck:amplify` = `tsc --noEmit -p amplify/tsconfig.json`, the same check `npm run build` runs.)
Expected: no NEW errors.

- [ ] **Step 5: Commit**

```bash
git add amplify/data/resource.ts amplify/backend.ts
git commit -m "feat(price-api): appsync pb* operations + backend wiring"
```

---

### Task 14: Frontend service layer

**Files:**
- Create: `src/services/priceAdminService.ts`
- Test: `src/services/priceAdminService.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/services/priceAdminService.test.ts` (pattern from `logisticsAdminService`):

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const queries = {
  pbListSuppliers: vi.fn(), pbListCatalogItems: vi.fn(), pbListCostVersions: vi.fn(),
  pbGetPricingPolicy: vi.fn(), pbGetQuotation: vi.fn(), pbListQuotations: vi.fn(),
};
const mutations = {
  pbCreateSupplier: vi.fn(), pbUpdateSupplier: vi.fn(),
  pbCreateCatalogItem: vi.fn(), pbUpdateCatalogItem: vi.fn(),
  pbAppendCostVersion: vi.fn(), pbUpdatePricingPolicy: vi.fn(),
  pbCreateQuotationDraft: vi.fn(), pbUpdateQuotationDraft: vi.fn(),
};
vi.mock('./amplifyClient', () => ({
  getAmplifyDataClient: () => ({ queries, mutations }),
}));

import * as svc from './priceAdminService';

beforeEach(() => Object.values({ ...queries, ...mutations }).forEach((f) => f.mockReset()));

describe('priceAdminService', () => {
  it('unwraps JSON-string payloads', async () => {
    queries.pbListSuppliers.mockResolvedValueOnce({ data: JSON.stringify({ items: [{ supplierId: 's1' }] }) });
    const res = await svc.listSuppliers();
    expect(res.items[0].supplierId).toBe('s1');
  });

  it('passes objects through unchanged', async () => {
    queries.pbGetPricingPolicy.mockResolvedValueOnce({ data: { fxRmbPerUsdMilli: 7250 } });
    const res = await svc.getPricingPolicy();
    expect(res.fxRmbPerUsdMilli).toBe(7250);
  });

  it('serializes mutation inputs as JSON strings', async () => {
    mutations.pbCreateSupplier.mockResolvedValueOnce({ data: '{}' });
    await svc.createSupplier({ name: 'OEM' });
    const [args] = mutations.pbCreateSupplier.mock.calls[0];
    expect(typeof args.input).toBe('string');
    expect(JSON.parse(args.input).name).toBe('OEM');
  });

  it('surfaces GraphQL errors as thrown Errors', async () => {
    queries.pbListQuotations.mockResolvedValueOnce({ errors: [{ message: 'UNAUTHORIZED: admin group required' }] });
    await expect(svc.listQuotations()).rejects.toThrow(/UNAUTHORIZED/);
  });
});
```

- [ ] **Step 2: Run — verify FAIL**, then **Step 3: Implement**

Create `src/services/priceAdminService.ts`:

```ts
import { getAmplifyDataClient } from './amplifyClient';

const client = getAmplifyDataClient;
const AUTH = { authMode: 'userPool' as const };

function unwrapPayload<T>(data: T | string): T {
  if (typeof data !== 'string') return data;
  return JSON.parse(data) as T;
}

type GqlResult<T> = { data?: T | string | null; errors?: Array<{ message: string }> };

function unwrap<T>({ data, errors }: GqlResult<T>): T {
  if (errors?.length) throw new Error(errors.map((e) => e.message).join(', '));
  return unwrapPayload(data as T | string);
}

const asInput = (input: unknown) => ({ input: JSON.stringify(input) });

// ── Suppliers ──
export interface Supplier {
  supplierId: string; name: string; contact?: string; currency: 'RMB';
  defaultValidityDays: number; status: 'ACTIVE' | 'SUSPENDED'; notes?: string;
  createdAt: string; updatedAt: string;
}
export const listSuppliers = async () =>
  unwrap<{ items: Supplier[] }>(await client().queries.pbListSuppliers(AUTH));
export const createSupplier = async (input: { name: string; contact?: string; defaultValidityDays?: number; notes?: string }) =>
  unwrap<Supplier>(await client().mutations.pbCreateSupplier(asInput(input), AUTH));
export const updateSupplier = async (input: Partial<Supplier> & { supplierId: string }) =>
  unwrap<Supplier>(await client().mutations.pbUpdateSupplier(asInput(input), AUTH));

// ── Catalog ──
export interface CatalogItem {
  itemId: string; sku: string; name: string; series: string;
  kind: 'MACHINE' | 'OPTION' | 'CONSUMABLE' | 'SERVICE';
  specs?: Record<string, string>;
  requiredOptionSkus: string[]; requiresSkus: string[]; excludesSkus: string[];
  maxQuantity?: number; createdAt: string; updatedAt: string;
}
export const listCatalogItems = async () =>
  unwrap<{ items: CatalogItem[] }>(await client().queries.pbListCatalogItems(AUTH));
export const createCatalogItem = async (input: Omit<CatalogItem, 'itemId' | 'createdAt' | 'updatedAt' | 'requiredOptionSkus' | 'requiresSkus' | 'excludesSkus'> & Partial<CatalogItem>) =>
  unwrap<CatalogItem>(await client().mutations.pbCreateCatalogItem(asInput(input), AUTH));
export const updateCatalogItem = async (input: Partial<CatalogItem> & { itemId: string }) =>
  unwrap<CatalogItem>(await client().mutations.pbUpdateCatalogItem(asInput(input), AUTH));

// ── Cost versions ──
export interface CostVersion {
  itemId: string; supplierId: string; unitCostFen: number; currency: 'RMB';
  effectiveFrom: string; effectiveTo: string;
  priceSource: 'MANUAL_ENTRY' | 'SUPPLIER_EXCEL' | 'SUPPLIER_LINK';
  reviewStatus: 'APPROVED'; createdAt: string; createdBy: string;
}
export const listCostVersions = async (itemId: string, supplierId?: string) =>
  unwrap<{ items: CostVersion[] }>(await client().queries.pbListCostVersions(asInput({ itemId, supplierId }), AUTH));
export const appendCostVersion = async (input: Omit<CostVersion, 'currency' | 'reviewStatus' | 'createdAt' | 'createdBy'>) =>
  unwrap<CostVersion>(await client().mutations.pbAppendCostVersion(asInput(input), AUTH));

// ── Pricing policy ──
export interface PricingPolicy {
  fxRmbPerUsdMilli: number; defaultMarginBp: number; minMarginBp: number;
  roundingGranularityUsdCents: number;
  seriesOverrides: Record<string, number>; itemOverrides: Record<string, number>;
  fxUpdatedAt?: string; updatedAt?: string;
}
export const getPricingPolicy = async () =>
  unwrap<PricingPolicy>(await client().queries.pbGetPricingPolicy(AUTH));
export const updatePricingPolicy = async (input: Partial<PricingPolicy>) =>
  unwrap<PricingPolicy>(await client().mutations.pbUpdatePricingPolicy(asInput(input), AUTH));

// ── Quotations ──
export interface QuotationLineInput {
  itemId?: string; sku?: string; qty: number;
  lineType: 'NORMAL' | 'SURCHARGE';
  surchargeUsdCents?: number; actualUnitUsdCents?: number; overrideReason?: string;
}
export interface QuotationSummary {
  quotationNumber: string; version: number; revision: number; status: 'DRAFT';
  schemeLabel: string; customerName: string; rfqId?: string | null;
  totalCostUsdCents: number | null; suggestedTotalUsdCents: number | null;
  actualTotalUsdCents: number | null; actualMarginBp: number | null;
  belowMinMargin: boolean; incomplete: boolean; lineCount: number;
  createdAt: string; updatedAt: string;
  lines?: Array<Record<string, unknown>>;
}
export const createQuotationDraft = async (input: {
  rfqId?: string; schemeLabel: string; customerName: string;
  validUntil?: string; tradeTerms?: string; paymentTerms?: string; notes?: string;
  lines: QuotationLineInput[];
  totalOverride?: { totalUsdCents: number; reason: string };
}) => unwrap<QuotationSummary>(await client().mutations.pbCreateQuotationDraft(asInput(input), AUTH));
export const updateQuotationDraft = async (input: {
  quotationNumber: string; version: number; expectedRevision: number;
  customerName?: string; validUntil?: string; tradeTerms?: string; paymentTerms?: string; notes?: string;
  lines: QuotationLineInput[];
  totalOverride?: { totalUsdCents: number; reason: string };
}) => unwrap<QuotationSummary>(await client().mutations.pbUpdateQuotationDraft(asInput(input), AUTH));
export const getQuotation = async (quotationNumber: string) =>
  unwrap<{ scheme: Record<string, unknown> | null; versions: Array<QuotationSummary & { lines: Array<Record<string, unknown>> }> }>(
    await client().queries.pbGetQuotation(asInput({ quotationNumber }), AUTH),
  );
export const listQuotations = async (opts: { limit?: number; nextToken?: string } = {}) =>
  unwrap<{ items: QuotationSummary[]; nextToken: string | null }>(
    await client().queries.pbListQuotations(opts, AUTH),
  );

// ── Display helpers (shared by the three pages) ──
export const usd = (cents: number | null | undefined) =>
  cents == null ? '—' : `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
export const rmbFen = (fen: number | null | undefined) =>
  fen == null ? '—' : `¥${(fen / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;
export const marginPct = (bp: number | null | undefined) =>
  bp == null ? '—' : `${(bp / 100).toFixed(1)}%`;
```

Note: `client().queries.pbListSuppliers(AUTH)` — argument-less Gen-2 operations take the options object as the first parameter; operations WITH arguments take `(args, AUTH)`. If the generated types complain after `ampx generate outputs`, match the call shapes the generated `Schema` expects — the test mocks pin the behavior we rely on (unwrap + serialize), not the exact positional shape.

- [ ] **Step 4: Run — verify PASS** (4 tests), then **commit**

```bash
git add src/services/priceAdminService.ts src/services/priceAdminService.test.ts
git commit -m "feat(admin): price admin service layer"
```

---

### Task 15: Suppliers page + routes/nav registration

Non-paginated card list — a deliberate product constraint (≤10 suppliers, spec).

**Files:**
- Create: `src/pages/admin/SuppliersPage.tsx`
- Test: `src/pages/admin/SuppliersPage.test.tsx`
- Modify: `src/routes/AdminRoutes.tsx`
- Modify: `src/components/admin/AdminLayout.tsx`

- [ ] **Step 1: Write the failing smoke test**

Create `src/pages/admin/SuppliersPage.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../services/priceAdminService', () => ({
  listSuppliers: vi.fn(async () => ({
    items: [{
      supplierId: 's1', name: 'Probe OEM', contact: 'Ms. Li', currency: 'RMB',
      defaultValidityDays: 180, status: 'ACTIVE', createdAt: 'T', updatedAt: 'T',
    }],
  })),
  createSupplier: vi.fn(),
  updateSupplier: vi.fn(),
}));

import { SuppliersPage } from './SuppliersPage';

describe('SuppliersPage', () => {
  it('renders supplier cards from the service', async () => {
    render(<SuppliersPage />);
    expect(await screen.findByText('Probe OEM')).toBeInTheDocument();
    expect(screen.getByText(/ACTIVE/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — verify FAIL**, then **Step 3: Implement**

Create `src/pages/admin/SuppliersPage.tsx`:

```tsx
import { useEffect, useState, type FormEvent } from 'react';
import { listSuppliers, createSupplier, updateSupplier, type Supplier } from '../../services/priceAdminService';

export function SuppliersPage() {
  const [items, setItems] = useState<Supplier[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', contact: '', defaultValidityDays: 180, notes: '' });

  const reload = () => {
    setLoading(true);
    listSuppliers()
      .then((r) => setItems(r.items))
      .catch((e) => setError(String(e.message ?? e)))
      .finally(() => setLoading(false));
  };
  useEffect(reload, []);

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await createSupplier({
        name: form.name, contact: form.contact || undefined,
        defaultValidityDays: form.defaultValidityDays, notes: form.notes || undefined,
      });
      setForm({ name: '', contact: '', defaultValidityDays: 180, notes: '' });
      reload();
    } catch (err) { setError(String((err as Error).message)); }
  };

  const toggleStatus = async (s: Supplier) => {
    try {
      await updateSupplier({ supplierId: s.supplierId, status: s.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' });
      reload();
    } catch (err) { setError(String((err as Error).message)); }
  };

  return (
    <div style={{ padding: 24 }}>
      <h1>Suppliers</h1>
      <p style={{ color: '#666' }}>Internal only — supplier identities are OEM-confidential.</p>
      {error && <p role="alert" style={{ color: '#b91c1c' }}>{error}</p>}
      {loading ? <p>Loading…</p> : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
          {items.map((s) => (
            <div key={s.supplierId} style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, width: 280 }}>
              <strong>{s.name}</strong>
              <div>{s.contact ?? '—'}</div>
              <div>Default validity: {s.defaultValidityDays} days</div>
              <div>
                <span style={{ color: s.status === 'ACTIVE' ? '#15803d' : '#b91c1c' }}>{s.status}</span>
                {' '}<button onClick={() => toggleStatus(s)}>{s.status === 'ACTIVE' ? 'Suspend' : 'Reactivate'}</button>
              </div>
              {s.notes && <div style={{ fontSize: 13, color: '#666' }}>{s.notes}</div>}
            </div>
          ))}
        </div>
      )}
      <h2 style={{ marginTop: 32 }}>Add supplier</h2>
      <form onSubmit={onCreate} style={{ display: 'grid', gap: 8, maxWidth: 400 }}>
        <input required placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input placeholder="Contact" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} />
        <input type="number" min={1} value={form.defaultValidityDays}
          onChange={(e) => setForm({ ...form, defaultValidityDays: Number(e.target.value) })} />
        <textarea placeholder="Internal notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        <button type="submit">Create</button>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: Register routes + nav (once, covers Tasks 15–17)**

In `src/routes/AdminRoutes.tsx`, next to the other `lazyWithReload` declarations (after line ~35), add:

```tsx
const SuppliersPage = lazyWithReload(() => import('../pages/admin/SuppliersPage').then(m => ({ default: m.SuppliersPage })));
const PriceBookPage = lazyWithReload(() => import('../pages/admin/PriceBookPage').then(m => ({ default: m.PriceBookPage })));
const QuotationListPage = lazyWithReload(() => import('../pages/admin/QuotationListPage').then(m => ({ default: m.QuotationListPage })));
const QuotationWorkbenchPage = lazyWithReload(() => import('../pages/admin/QuotationWorkbenchPage').then(m => ({ default: m.QuotationWorkbenchPage })));
```

And inside the `<Route path="/admin" element={<AdminRoute />}>` block, next to the orders/logistics routes:

```tsx
          <Route path="suppliers" element={<SuppliersPage />} />
          <Route path="pricebook" element={<PriceBookPage />} />
          <Route path="quotations" element={<QuotationListPage />} />
          <Route path="quotations/new" element={<QuotationWorkbenchPage />} />
          <Route path="quotations/:quotationNumber" element={<QuotationWorkbenchPage />} />
```

(Tasks 16–17 create the remaining three pages; until they exist, `npx tsc --noEmit` will fail — that is why this plan commits routes together with the LAST page in Task 17. In THIS task add only the SuppliersPage line and its route; add the other three declarations/routes in Task 17.)

In `src/components/admin/AdminLayout.tsx`, the nav array at line ~11 (entries shaped `{ path, label, icon }`) gets two entries next to Orders/Logistics:

```tsx
  { path: '/admin/pricebook', label: 'Price Book', icon: 'sell' },
  { path: '/admin/quotations', label: 'Quotations', icon: 'request_quote' },
```

(Suppliers is reachable from the Price Book page header link — it does not need its own top-level nav slot; add `<Link to="/admin/suppliers">Suppliers</Link>` in the PriceBookPage header, Task 16.)

- [ ] **Step 5: Run — verify PASS**, then **commit**

Run: `npx vitest run src/pages/admin/SuppliersPage.test.tsx --exclude '**/.claude/**'`

```bash
git add src/pages/admin/SuppliersPage.tsx src/pages/admin/SuppliersPage.test.tsx src/routes/AdminRoutes.tsx src/components/admin/AdminLayout.tsx
git commit -m "feat(admin): suppliers page (non-paginated cards) + nav"
```

---

### Task 16: Price Book page

Grouped by series; validity badges ACTIVE / EXPIRING (≤30d) / MISSING; expandable cost history; "expired/missing" count card = the owner's ask-the-supplier list.

**Files:**
- Create: `src/pages/admin/PriceBookPage.tsx`
- Test: `src/pages/admin/PriceBookPage.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/pages/admin/PriceBookPage.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const catalog = {
  items: [
    {
      itemId: 'c1', sku: 'RIE-300', name: 'RIE Etcher', series: 'RIE', kind: 'MACHINE',
      requiredOptionSkus: [], requiresSkus: [], excludesSkus: [], createdAt: 'T', updatedAt: 'T',
    },
    {
      itemId: 'c2', sku: 'CHUCK-6', name: '6in Chuck', series: 'RIE', kind: 'OPTION',
      requiredOptionSkus: [], requiresSkus: [], excludesSkus: [], createdAt: 'T', updatedAt: 'T',
    },
  ],
};
const today = new Date();
const plus = (days: number) => new Date(today.getTime() + days * 86_400_000).toISOString().slice(0, 10);

// Full explicit mock — do NOT use importOriginal here: the real module imports
// './amplifyClient', which needs amplify_outputs.json and fails under vitest.
vi.mock('../../services/priceAdminService', () => ({
  listCatalogItems: vi.fn(async () => catalog),
  listSuppliers: vi.fn(async () => ({ items: [{ supplierId: 's1', name: 'OEM', status: 'ACTIVE', currency: 'RMB', defaultValidityDays: 180, createdAt: 'T', updatedAt: 'T' }] })),
  listCostVersions: vi.fn(async (itemId: string) => ({
    items: itemId === 'c1'
      ? [{ itemId: 'c1', supplierId: 's1', unitCostFen: 725000, currency: 'RMB', effectiveFrom: plus(-100), effectiveTo: plus(100), priceSource: 'MANUAL_ENTRY', reviewStatus: 'APPROVED', createdAt: 'T', createdBy: 'x' }]
      : [],  // c2 has NO cost → MISSING
  })),
  appendCostVersion: vi.fn(),
  createCatalogItem: vi.fn(),
  rmbFen: (fen: number | null | undefined) => (fen == null ? '—' : `¥${(fen / 100).toFixed(2)}`),
}));

import { PriceBookPage } from './PriceBookPage';

describe('PriceBookPage', () => {
  it('shows items grouped by series with validity badges and a needs-attention count', async () => {
    render(<MemoryRouter><PriceBookPage /></MemoryRouter>);
    expect(await screen.findByText('RIE Etcher')).toBeInTheDocument();
    expect(await screen.findByText('MISSING')).toBeInTheDocument();   // c2 badge
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();           // c1 badge
    expect(screen.getByTestId('attention-count').textContent).toBe('1');
  });
});
```

- [ ] **Step 2: Run — verify FAIL**, then **Step 3: Implement**

Create `src/pages/admin/PriceBookPage.tsx`:

```tsx
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  listCatalogItems, listSuppliers, listCostVersions, appendCostVersion, createCatalogItem,
  rmbFen, type CatalogItem, type CostVersion, type Supplier,
} from '../../services/priceAdminService';

type CostState = { status: 'ACTIVE' | 'EXPIRING' | 'MISSING'; current?: CostVersion; history: CostVersion[] };

const todayIso = () => new Date().toISOString().slice(0, 10);
const plusDays = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);

function classify(history: CostVersion[]): CostState {
  const today = todayIso();
  const current = history.find((v) => v.effectiveFrom <= today && today < v.effectiveTo);
  if (!current) return { status: 'MISSING', history };
  return { status: current.effectiveTo <= plusDays(30) ? 'EXPIRING' : 'ACTIVE', current, history };
}

const BADGE: Record<CostState['status'], string> = { ACTIVE: '#15803d', EXPIRING: '#b45309', MISSING: '#b91c1c' };

export function PriceBookPage() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [costs, setCosts] = useState<Record<string, CostState>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [itemForm, setItemForm] = useState({ sku: '', name: '', series: '', kind: 'OPTION' as CatalogItem['kind'] });
  const [costForm, setCostForm] = useState({ supplierId: '', unitCostRmb: '', effectiveFrom: todayIso(), effectiveTo: plusDays(180) });

  const reload = () => {
    setLoading(true);
    Promise.all([listCatalogItems(), listSuppliers()])
      .then(async ([cat, sup]) => {
        setItems(cat.items);
        setSuppliers(sup.items);
        const entries = await Promise.all(cat.items.map(async (it) => {
          const { items: history } = await listCostVersions(it.itemId);
          return [it.itemId, classify(history)] as const;
        }));
        setCosts(Object.fromEntries(entries));
      })
      .catch((e) => setError(String(e.message ?? e)))
      .finally(() => setLoading(false));
  };
  useEffect(reload, []);

  const attention = useMemo(
    () => Object.values(costs).filter((c) => c.status !== 'ACTIVE').length,
    [costs],
  );
  const bySeries = useMemo(() => {
    const groups: Record<string, CatalogItem[]> = {};
    for (const it of items) (groups[it.series] ??= []).push(it);
    return groups;
  }, [items]);

  const onCreateItem = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await createCatalogItem({ ...itemForm, requiredOptionSkus: [], requiresSkus: [], excludesSkus: [] });
      setItemForm({ sku: '', name: '', series: '', kind: 'OPTION' });
      reload();
    } catch (err) { setError(String((err as Error).message)); }
  };

  const onAppendCost = async (itemId: string, e: FormEvent) => {
    e.preventDefault();
    try {
      await appendCostVersion({
        itemId, supplierId: costForm.supplierId,
        unitCostFen: Math.round(Number(costForm.unitCostRmb) * 100),
        effectiveFrom: costForm.effectiveFrom, effectiveTo: costForm.effectiveTo,
        priceSource: 'MANUAL_ENTRY',
      });
      reload();
    } catch (err) { setError(String((err as Error).message)); }
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h1>Price Book</h1>
        <Link to="/admin/suppliers">Suppliers</Link>
      </div>
      <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12, width: 260, marginBottom: 16 }}>
        Items needing supplier contact:{' '}
        <strong data-testid="attention-count" style={{ color: attention ? '#b91c1c' : '#15803d' }}>{attention}</strong>
      </div>
      {error && <p role="alert" style={{ color: '#b91c1c' }}>{error}</p>}
      {loading ? <p>Loading…</p> : Object.entries(bySeries).map(([series, group]) => (
        <section key={series}>
          <h2>{series}</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th align="left">SKU</th><th align="left">Name</th><th>Kind</th><th>Cost</th><th>Validity</th><th /></tr></thead>
            <tbody>
              {group.map((it) => {
                const c = costs[it.itemId];
                return (
                  <>
                    <tr key={it.itemId} style={{ borderTop: '1px solid #eee' }}>
                      <td>{it.sku}</td>
                      <td>{it.name}</td>
                      <td align="center">{it.kind}</td>
                      <td align="center">{rmbFen(c?.current?.unitCostFen ?? null)}</td>
                      <td align="center">
                        <span style={{ color: BADGE[c?.status ?? 'MISSING'], fontWeight: 600 }}>{c?.status ?? 'MISSING'}</span>
                      </td>
                      <td><button onClick={() => setExpanded(expanded === it.itemId ? null : it.itemId)}>
                        {expanded === it.itemId ? 'Hide' : 'History / add cost'}
                      </button></td>
                    </tr>
                    {expanded === it.itemId && (
                      <tr key={`${it.itemId}-x`}><td colSpan={6} style={{ background: '#fafafa', padding: 12 }}>
                        <ul>
                          {(c?.history ?? []).map((v) => (
                            <li key={v.effectiveFrom + v.supplierId}>
                              {v.effectiveFrom} → {v.effectiveTo}: {rmbFen(v.unitCostFen)} ({v.priceSource}, by {v.createdBy})
                            </li>
                          ))}
                          {!(c?.history ?? []).length && <li>No cost versions yet.</li>}
                        </ul>
                        <form onSubmit={(e) => onAppendCost(it.itemId, e)} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <select required value={costForm.supplierId}
                            onChange={(e) => setCostForm({ ...costForm, supplierId: e.target.value })}>
                            <option value="">Supplier…</option>
                            {suppliers.map((s) => <option key={s.supplierId} value={s.supplierId}>{s.name}</option>)}
                          </select>
                          <input required type="number" step="0.01" min="0.01" placeholder="Cost (RMB)"
                            value={costForm.unitCostRmb} onChange={(e) => setCostForm({ ...costForm, unitCostRmb: e.target.value })} />
                          <input required type="date" value={costForm.effectiveFrom}
                            onChange={(e) => setCostForm({ ...costForm, effectiveFrom: e.target.value })} />
                          <input required type="date" value={costForm.effectiveTo}
                            onChange={(e) => setCostForm({ ...costForm, effectiveTo: e.target.value })} />
                          <button type="submit">Add cost version</button>
                        </form>
                      </td></tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </section>
      ))}
      <h2 style={{ marginTop: 32 }}>Add catalog item</h2>
      <form onSubmit={onCreateItem} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input required placeholder="SKU" value={itemForm.sku} onChange={(e) => setItemForm({ ...itemForm, sku: e.target.value })} />
        <input required placeholder="Name" value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} />
        <input required placeholder="Series" value={itemForm.series} onChange={(e) => setItemForm({ ...itemForm, series: e.target.value })} />
        <select value={itemForm.kind} onChange={(e) => setItemForm({ ...itemForm, kind: e.target.value as CatalogItem['kind'] })}>
          {['MACHINE', 'OPTION', 'CONSUMABLE', 'SERVICE'].map((k) => <option key={k}>{k}</option>)}
        </select>
        <button type="submit">Create item</button>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: Run — verify PASS**, then **commit**

```bash
git add src/pages/admin/PriceBookPage.tsx src/pages/admin/PriceBookPage.test.tsx
git commit -m "feat(admin): price book page with validity badges and cost history"
```

---

### Task 17: Quotation workbench + quotation list

The workbench is create-or-edit: `/admin/quotations/new` creates, `/admin/quotations/:quotationNumber` loads v-latest for editing (DRAFT only in P1). Server computes all pricing; the page renders whatever the resolver returns — no client-side price math beyond display formatting.

**Files:**
- Create: `src/pages/admin/QuotationWorkbenchPage.tsx`
- Create: `src/pages/admin/QuotationListPage.tsx`
- Test: `src/pages/admin/QuotationWorkbenchPage.test.tsx`
- Test: `src/pages/admin/QuotationListPage.test.tsx`
- Modify: `src/routes/AdminRoutes.tsx` (add the three remaining lazy declarations + routes from Task 15 Step 4)

- [ ] **Step 1: Write the failing tests**

Create `src/pages/admin/QuotationListPage.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Full explicit mock (no importOriginal — see PriceBookPage.test rationale).
vi.mock('../../services/priceAdminService', () => ({
  usd: (c: number | null | undefined) => (c == null ? '—' : `$${(c / 100).toFixed(2)}`),
  marginPct: (bp: number | null | undefined) => (bp == null ? '—' : `${(bp / 100).toFixed(1)}%`),
  listQuotations: vi.fn(async () => ({
    items: [{
      quotationNumber: 'Q-2026-0008', version: 1, revision: 1, status: 'DRAFT',
      schemeLabel: 'Standard', customerName: 'MIT Nano',
      totalCostUsdCents: 100000, suggestedTotalUsdCents: 160000, actualTotalUsdCents: 155000,
      actualMarginBp: 3548, belowMinMargin: false, incomplete: false, lineCount: 3,
      createdAt: 'T', updatedAt: 'T',
    }],
    nextToken: null,
  })),
}));

import { QuotationListPage } from './QuotationListPage';

describe('QuotationListPage', () => {
  it('lists quotations with margin and status', async () => {
    render(<MemoryRouter><QuotationListPage /></MemoryRouter>);
    expect(await screen.findByText('Q-2026-0008')).toBeInTheDocument();
    expect(screen.getByText('MIT Nano')).toBeInTheDocument();
    expect(screen.getByText('35.5%')).toBeInTheDocument();
  });
});
```

Create `src/pages/admin/QuotationWorkbenchPage.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const createQuotationDraft = vi.fn(async () => ({
  quotationNumber: 'Q-2026-0009', version: 1, revision: 1, status: 'DRAFT',
  schemeLabel: 'Standard', customerName: 'MIT Nano',
  totalCostUsdCents: 100000, suggestedTotalUsdCents: 160000, actualTotalUsdCents: 160000,
  actualMarginBp: 3750, belowMinMargin: false, incomplete: false, lineCount: 1,
  createdAt: 'T', updatedAt: 'T',
  lines: [{ lineNo: 1, sku: 'RIE-300', name: 'RIE Etcher', qty: 1, lineType: 'NORMAL',
    unitCostUsdCents: 100000, suggestedUnitUsdCents: 153846, actualUnitUsdCents: null,
    actualLineTotalUsdCents: 153846, costStatus: 'ACTIVE' }],
}));

// Full explicit mock (no importOriginal — see PriceBookPage.test rationale).
vi.mock('../../services/priceAdminService', () => ({
  usd: (c: number | null | undefined) => (c == null ? '—' : `$${(c / 100).toFixed(2)}`),
  marginPct: (bp: number | null | undefined) => (bp == null ? '—' : `${(bp / 100).toFixed(1)}%`),
  listCatalogItems: vi.fn(async () => ({
    items: [{ itemId: 'c1', sku: 'RIE-300', name: 'RIE Etcher', series: 'RIE', kind: 'MACHINE',
      requiredOptionSkus: [], requiresSkus: [], excludesSkus: [], createdAt: 'T', updatedAt: 'T' }],
  })),
  createQuotationDraft,
  updateQuotationDraft: vi.fn(),
  getQuotation: vi.fn(),
}));

import { QuotationWorkbenchPage } from './QuotationWorkbenchPage';

describe('QuotationWorkbenchPage (create mode)', () => {
  it('adds a line, saves a draft, and shows the returned pricing', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/quotations/new']}>
        <Routes><Route path="/admin/quotations/new" element={<QuotationWorkbenchPage />} /></Routes>
      </MemoryRouter>,
    );
    fireEvent.change(await screen.findByPlaceholderText('Customer name'), { target: { value: 'MIT Nano' } });
    fireEvent.click(screen.getByText('Add', { selector: 'button' }));
    fireEvent.click(screen.getByText('Save draft'));
    await waitFor(() => expect(createQuotationDraft).toHaveBeenCalled());
    expect(await screen.findByText('Q-2026-0009')).toBeInTheDocument();
    expect(screen.getByText('37.5%')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — verify FAIL**, then **Step 3: Implement the list page**

Create `src/pages/admin/QuotationListPage.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listQuotations, usd, marginPct, type QuotationSummary } from '../../services/priceAdminService';

export function QuotationListPage() {
  const [items, setItems] = useState<QuotationSummary[]>([]);
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = (token?: string) => {
    setLoading(true);
    listQuotations(token ? { nextToken: token } : {})
      .then((r) => {
        setItems((prev) => (token ? [...prev, ...r.items] : r.items));
        setNextToken(r.nextToken);
      })
      .catch((e) => setError(String(e.message ?? e)))
      .finally(() => setLoading(false));
  };
  useEffect(() => load(), []);

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h1>Quotations</h1>
        <Link to="/admin/quotations/new"><button>Create quotation</button></Link>
      </div>
      {error && <p role="alert" style={{ color: '#b91c1c' }}>{error}</p>}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>
          <th align="left">Number</th><th align="left">Customer</th><th>Scheme</th><th>Status</th>
          <th>Cost</th><th>Suggested</th><th>Actual</th><th>Margin</th><th>Updated</th>
        </tr></thead>
        <tbody>
          {items.map((q) => (
            <tr key={`${q.quotationNumber}-v${q.version}`} style={{ borderTop: '1px solid #eee' }}>
              <td><Link to={`/admin/quotations/${q.quotationNumber}`}>{q.quotationNumber}</Link> v{q.version}</td>
              <td>{q.customerName}</td>
              <td align="center">{q.schemeLabel}</td>
              <td align="center">{q.status}{q.incomplete ? ' ⚠︎incomplete' : ''}</td>
              <td align="right">{usd(q.totalCostUsdCents)}</td>
              <td align="right">{usd(q.suggestedTotalUsdCents)}</td>
              <td align="right">{usd(q.actualTotalUsdCents)}</td>
              <td align="right" style={{ color: q.belowMinMargin ? '#b91c1c' : undefined }}>{marginPct(q.actualMarginBp)}</td>
              <td>{q.updatedAt?.slice(0, 10)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {loading && <p>Loading…</p>}
      {nextToken && !loading && <button onClick={() => load(nextToken)}>Load more</button>}
    </div>
  );
}
```

- [ ] **Step 4: Implement the workbench**

Create `src/pages/admin/QuotationWorkbenchPage.tsx`:

```tsx
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  listCatalogItems, createQuotationDraft, updateQuotationDraft, getQuotation,
  usd, marginPct, type CatalogItem, type QuotationLineInput, type QuotationSummary,
} from '../../services/priceAdminService';

interface DraftLine extends QuotationLineInput { key: number }

export function QuotationWorkbenchPage() {
  const { quotationNumber } = useParams<{ quotationNumber?: string }>();
  const editing = Boolean(quotationNumber);

  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [schemeLabel, setSchemeLabel] = useState('Standard');
  const [rfqId, setRfqId] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [pickerId, setPickerId] = useState('');
  const [surcharge, setSurcharge] = useState({ sku: 'FREIGHT', usd: '' });
  const [totalOverride, setTotalOverride] = useState({ usd: '', reason: '' });
  const [saved, setSaved] = useState<QuotationSummary | null>(null);
  const [serverVersion, setServerVersion] = useState<{ version: number; revision: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const keySeq = useMemo(() => ({ n: 0 }), []);

  useEffect(() => {
    listCatalogItems().then((r) => setCatalog(r.items)).catch((e) => setError(String(e.message ?? e)));
  }, []);

  useEffect(() => {
    if (!quotationNumber) return;
    getQuotation(quotationNumber)
      .then((r) => {
        const latest = r.versions[r.versions.length - 1];
        if (!latest) throw new Error('NOT_FOUND: no versions');
        setSaved(latest);
        setServerVersion({ version: latest.version, revision: latest.revision });
        setCustomerName(latest.customerName);
        setSchemeLabel(latest.schemeLabel);
        setRfqId((latest.rfqId as string) ?? '');
        setLines(latest.lines.map((l, i) => ({
          key: i,
          itemId: l.itemId as string | undefined,
          sku: l.sku as string,
          qty: l.qty as number,
          lineType: l.lineType as 'NORMAL' | 'SURCHARGE',
          surchargeUsdCents: l.surchargeUsdCents as number | undefined,
          actualUnitUsdCents: (l.actualUnitUsdCents as number | null) ?? undefined,
          overrideReason: (l.overrideReason as string | null) ?? undefined,
        })));
        keySeq.n = latest.lines.length;
      })
      .catch((e) => setError(String(e.message ?? e)));
  }, [quotationNumber, keySeq]);

  const addNormal = () => {
    const item = catalog.find((c) => c.itemId === (pickerId || catalog[0]?.itemId));
    if (!item) return;
    setLines([...lines, { key: keySeq.n++, itemId: item.itemId, sku: item.sku, qty: 1, lineType: 'NORMAL' }]);
  };
  const addSurcharge = () => {
    if (!surcharge.usd) return;
    setLines([...lines, {
      key: keySeq.n++, sku: surcharge.sku, qty: 1, lineType: 'SURCHARGE',
      surchargeUsdCents: Math.round(Number(surcharge.usd) * 100),
    }]);
    setSurcharge({ sku: 'FREIGHT', usd: '' });
  };
  const patchLine = (key: number, patch: Partial<DraftLine>) =>
    setLines(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const payloadLines = lines.map(({ key, ...rest }) => rest);
      const override = totalOverride.usd
        ? { totalUsdCents: Math.round(Number(totalOverride.usd) * 100), reason: totalOverride.reason }
        : undefined;
      const res = editing && serverVersion
        ? await updateQuotationDraft({
          quotationNumber: quotationNumber!, version: serverVersion.version,
          expectedRevision: serverVersion.revision, customerName, lines: payloadLines, totalOverride: override,
        })
        : await createQuotationDraft({
          schemeLabel, customerName, rfqId: rfqId || undefined, lines: payloadLines, totalOverride: override,
        });
      setSaved(res);
      setServerVersion({ version: res.version, revision: res.revision });
    } catch (e) { setError(String((e as Error).message)); } finally { setBusy(false); }
  };

  return (
    <div style={{ padding: 24, display: 'flex', gap: 24, alignItems: 'flex-start' }}>
      <div style={{ flex: 2 }}>
        <h1>{editing ? `Edit ${quotationNumber}` : 'New quotation'}</h1>
        {error && <p role="alert" style={{ color: '#b91c1c' }}>{error}</p>}
        <div style={{ display: 'grid', gap: 8, maxWidth: 420 }}>
          <input placeholder="Customer name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
          <input placeholder="Scheme label" value={schemeLabel} disabled={editing}
            onChange={(e) => setSchemeLabel(e.target.value)} />
          <input placeholder="RFQ id (optional)" value={rfqId} disabled={editing}
            onChange={(e) => setRfqId(e.target.value)} />
        </div>

        <h2>Lines</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={pickerId} onChange={(e) => setPickerId(e.target.value)}>
            {catalog.map((c) => <option key={c.itemId} value={c.itemId}>{c.series} / {c.sku} — {c.name}</option>)}
          </select>
          <button onClick={addNormal}>Add</button>
          <input placeholder="Surcharge label" value={surcharge.sku}
            onChange={(e) => setSurcharge({ ...surcharge, sku: e.target.value })} style={{ width: 130 }} />
          <input placeholder="USD" type="number" min="0" step="0.01" value={surcharge.usd}
            onChange={(e) => setSurcharge({ ...surcharge, usd: e.target.value })} style={{ width: 90 }} />
          <button onClick={addSurcharge}>Add surcharge</button>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
          <thead><tr><th align="left">SKU</th><th>Qty</th><th>Type</th><th>Manual unit $ (override)</th><th>Reason</th><th /></tr></thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.key} style={{ borderTop: '1px solid #eee' }}>
                <td>{l.sku}</td>
                <td align="center">
                  <input type="number" min={1} value={l.qty} style={{ width: 60 }}
                    onChange={(e) => patchLine(l.key, { qty: Number(e.target.value) })} />
                </td>
                <td align="center">{l.lineType}</td>
                <td align="center">
                  <input type="number" min={0} step="0.01" style={{ width: 110 }}
                    value={l.actualUnitUsdCents != null ? l.actualUnitUsdCents / 100 : ''}
                    onChange={(e) => patchLine(l.key, {
                      actualUnitUsdCents: e.target.value === '' ? undefined : Math.round(Number(e.target.value) * 100),
                    })} />
                </td>
                <td>
                  <input placeholder="required if overridden" value={l.overrideReason ?? ''}
                    onChange={(e) => patchLine(l.key, { overrideReason: e.target.value || undefined })} />
                </td>
                <td><button onClick={() => setLines(lines.filter((x) => x.key !== l.key))}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <h3>Total override (optional)</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <input placeholder="Total USD" type="number" min="0" step="0.01" value={totalOverride.usd}
            onChange={(e) => setTotalOverride({ ...totalOverride, usd: e.target.value })} />
          <input placeholder="Reason (required with override)" value={totalOverride.reason}
            onChange={(e) => setTotalOverride({ ...totalOverride, reason: e.target.value })} style={{ flex: 1 }} />
        </div>
        <p><button onClick={save} disabled={busy || !customerName.trim() || lines.length === 0}>Save draft</button></p>
      </div>

      <aside style={{ flex: 1, border: '1px solid #ddd', borderRadius: 8, padding: 16, position: 'sticky', top: 16 }}>
        <h2>Pricing</h2>
        {!saved ? <p>Save the draft to compute pricing (server-side).</p> : (
          <>
            <p><strong>{saved.quotationNumber}</strong> v{saved.version} · {saved.status}</p>
            {saved.incomplete && (
              <p style={{ color: '#b45309' }}>⚠︎ Cost incomplete — reconfirm flagged items with the supplier. Totals show as unknown, never zero.</p>
            )}
            <dl>
              <dt>Total cost</dt><dd>{usd(saved.totalCostUsdCents)}</dd>
              <dt>Suggested total</dt><dd>{usd(saved.suggestedTotalUsdCents)}</dd>
              <dt>Actual total</dt><dd>{usd(saved.actualTotalUsdCents)}</dd>
              <dt>Actual margin</dt>
              <dd style={{ color: saved.belowMinMargin ? '#b91c1c' : '#15803d', fontWeight: 600 }}>
                {marginPct(saved.actualMarginBp)}{saved.belowMinMargin ? ' — below minimum (warning only)' : ''}
              </dd>
            </dl>
            {saved.lines && (
              <table style={{ width: '100%', fontSize: 13 }}>
                <thead><tr><th align="left">Line</th><th>Suggested</th><th>Actual total</th></tr></thead>
                <tbody>
                  {saved.lines.map((l) => (
                    <tr key={String(l.lineNo)}>
                      <td>{String(l.sku)} ×{String(l.qty)}{l.costStatus !== 'ACTIVE' && l.lineType === 'NORMAL' ? ' ⚠︎' : ''}</td>
                      <td align="right">{usd(l.suggestedUnitUsdCents as number | null)}</td>
                      <td align="right">{usd(l.actualLineTotalUsdCents as number | null)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </aside>
    </div>
  );
}
```

- [ ] **Step 5: Add the remaining route declarations from Task 15 Step 4** (PriceBookPage was created in Task 16 but its route/lazy declaration lands here together with the two quotation pages, so `tsc` stays green at every commit).

- [ ] **Step 6: Run all frontend tests + typecheck**

Run: `npx vitest run src/pages/admin/QuotationListPage.test.tsx src/pages/admin/QuotationWorkbenchPage.test.tsx src/pages/admin/PriceBookPage.test.tsx src/pages/admin/SuppliersPage.test.tsx --exclude '**/.claude/**'`
Then: `npx tsc --noEmit && npm run typecheck:amplify`
Expected: all green, no new type errors.

- [ ] **Step 7: Commit**

```bash
git add src/pages/admin/QuotationWorkbenchPage.tsx src/pages/admin/QuotationListPage.tsx src/pages/admin/QuotationWorkbenchPage.test.tsx src/pages/admin/QuotationListPage.test.tsx src/routes/AdminRoutes.tsx
git commit -m "feat(admin): quotation workbench + list (server-priced DRAFT snapshots)"
```

---

### Task 18: Supplier price import script (CSV)

Spec: Excel import is a **script**, not an upload UI. Suppliers send Excel; the owner exports the sheet to CSV. Columns: `sku,supplierName,unitCostRmb,effectiveFrom,effectiveTo`.

**Files:**
- Create: `scripts/lib/csv.ts`
- Test: `scripts/lib/csv.test.ts`
- Create: `scripts/import-supplier-prices.ts`
- Modify: `tsconfig.scripts.json` (add the new scripts to `include` so they are actually typechecked)

- [ ] **Step 1: Write the failing CSV/money helper tests**

Naive `split(',')` breaks on quoted supplier names, and `Number(x) * 100` has float error (`19.9 * 100 === 1989.9999…`). Both helpers are string-based and tested.

Create `scripts/lib/csv.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseCsv, rmbToFen } from './csv';

describe('parseCsv (RFC 4180 subset)', () => {
  it('parses plain rows and trims CRLF', () => {
    expect(parseCsv('a,b\r\n1,2\r\n')).toEqual([['a', 'b'], ['1', '2']]);
  });
  it('handles quoted fields with commas and escaped quotes', () => {
    expect(parseCsv('sku,"Beijing OEM, Ltd","said ""hi"""')).toEqual([
      ['sku', 'Beijing OEM, Ltd', 'said "hi"'],
    ]);
  });
  it('handles newlines inside quoted fields and skips blank lines', () => {
    expect(parseCsv('a,"line1\nline2"\n\nb,c\n')).toEqual([['a', 'line1\nline2'], ['b', 'c']]);
  });
  it('rejects an unterminated quote', () => {
    expect(() => parseCsv('a,"oops')).toThrow(/unterminated/i);
  });
});

describe('rmbToFen (string-based, no float math)', () => {
  it('converts yuan strings to integer fen exactly', () => {
    expect(rmbToFen('72500')).toBe(7_250_000);
    expect(rmbToFen('19.9')).toBe(1990);
    expect(rmbToFen('19.99')).toBe(1999);
    expect(rmbToFen('0.01')).toBe(1);
  });
  it('rejects malformed amounts', () => {
    for (const bad of ['', 'abc', '1.999', '-5', '1,000', '1.']) {
      expect(() => rmbToFen(bad)).toThrow(/amount/i);
    }
  });
});
```

- [ ] **Step 2: Run — verify FAIL, then implement**

Run: `npx vitest run scripts/lib/csv.test.ts --exclude '**/.claude/**'`

Create `scripts/lib/csv.ts`:

```ts
/** RFC 4180-subset CSV parser: quoted fields, escaped quotes ("" -> "),
 * commas and newlines inside quotes, CRLF, blank-line skipping. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const pushField = () => { row.push(field); field = ''; };
  const pushRow = () => {
    pushField();
    if (row.length > 1 || row[0] !== '') rows.push(row); // skip blank lines
    row = [];
  };
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i += 1; continue;
      }
      field += ch; i += 1; continue;
    }
    if (ch === '"') { inQuotes = true; i += 1; continue; }
    if (ch === ',') { pushField(); i += 1; continue; }
    if (ch === '\r' && text[i + 1] === '\n') { pushRow(); i += 2; continue; }
    if (ch === '\n') { pushRow(); i += 1; continue; }
    field += ch; i += 1;
  }
  if (inQuotes) throw new Error('CSV: unterminated quoted field');
  if (field !== '' || row.length) pushRow();
  return rows;
}

/** '72500' | '19.9' | '19.99' (yuan) -> integer fen. String math — no floats. */
export function rmbToFen(s: string): number {
  const m = s.trim().match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!m) throw new Error(`invalid RMB amount: "${s}" (expect yuan, up to 2 decimals)`);
  return Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0') || '0');
}
```

Run again: 6 passed. Then append the CSV files and the import script to `tsconfig.scripts.json` — after Task 1 its `include` already lists `generate-equipment-guide.ts` and `add-admin-user.ts`; the final array:

```json
  "include": [
    "scripts/generate-equipment-guide.ts",
    "scripts/import-supplier-prices.ts",
    "scripts/add-admin-user.ts",
    "scripts/lib/csv.ts",
    "src/**/*.ts"
  ]
```

- [ ] **Step 3: Write the import script**

Create `scripts/import-supplier-prices.ts` (auth pattern from `scripts/seed-evidence.ts`):

```ts
/**
 * Import supplier framework prices from CSV into the Price Book.
 *
 * Usage:
 *   ADMIN_EMAIL=$ADMIN_EMAIL ADMIN_PASSWORD=$ADMIN_PASSWORD \
 *     npx tsx scripts/import-supplier-prices.ts prices.csv
 *
 * CSV columns (header row required):
 *   sku,supplierName,unitCostRmb,effectiveFrom,effectiveTo
 *   RIE-300,Probe OEM,72500.00,2026-08-01,2027-02-01
 *
 * - sku matches CatalogItem.sku (case-sensitive); supplierName matches Supplier.name.
 * - unitCostRmb is in yuan with optional decimals — converted to integer fen.
 * - Overlapping-interval and concurrent-append errors (VALIDATION/CONFLICT) are
 *   reported per row; the import continues with the remaining rows.
 * - Requires amplify_outputs.json to be CURRENT (include the pb* operations):
 *     npx ampx generate outputs --app-id d244ebmxcttcdz --branch main
 * - Caller must be in the Cognito 'admin' group (scripts/add-admin-user.ts).
 */
import { readFileSync } from 'node:fs';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../amplify/data/resource';
import { authenticate } from './lib/auth';
import { parseCsv, rmbToFen } from './lib/csv';
import amplifyOutputs from '../amplify_outputs.json';

Amplify.configure(amplifyOutputs as never);
const client = generateClient<Schema>({ authMode: 'userPool' });

const file = process.argv[2];
if (!file) {
  console.error('Usage: npx tsx scripts/import-supplier-prices.ts <file.csv>');
  process.exit(1);
}

const unwrap = <T,>(data: T | string | null | undefined): T =>
  (typeof data === 'string' ? JSON.parse(data) : data) as T;

async function main() {
  await authenticate();

  const catalogRes = await client.queries.pbListCatalogItems({ authMode: 'userPool' });
  const supplierRes = await client.queries.pbListSuppliers({ authMode: 'userPool' });
  const catalog = unwrap<{ items: Array<{ itemId: string; sku: string }> }>(catalogRes.data).items;
  const suppliers = unwrap<{ items: Array<{ supplierId: string; name: string }> }>(supplierRes.data).items;
  const bySku = new Map(catalog.map((c) => [c.sku, c.itemId]));
  const byName = new Map(suppliers.map((s) => [s.name, s.supplierId]));

  const rows = parseCsv(readFileSync(file, 'utf8')).map((r) => r.map((c) => c.trim()));
  const header = rows.shift();
  const EXPECTED = ['sku', 'supplierName', 'unitCostRmb', 'effectiveFrom', 'effectiveTo'];
  if (!header || header.join(',') !== EXPECTED.join(',')) {
    throw new Error(`Unexpected header: ${header?.join(',')} (expected ${EXPECTED.join(',')})`);
  }

  let ok = 0, failed = 0;
  for (const [i, row] of rows.entries()) {
    const [sku, supplierName, unitCostRmb, effectiveFrom, effectiveTo] = row;
    const label = `row ${i + 2} (${sku} @ ${supplierName})`;
    const itemId = bySku.get(sku);
    const supplierId = byName.get(supplierName);
    if (row.length !== EXPECTED.length) { console.error(`✗ ${label}: expected ${EXPECTED.length} columns, got ${row.length}`); failed++; continue; }
    if (!itemId) { console.error(`✗ ${label}: unknown sku`); failed++; continue; }
    if (!supplierId) { console.error(`✗ ${label}: unknown supplier`); failed++; continue; }
    try {
      const res = await client.mutations.pbAppendCostVersion({
        input: JSON.stringify({
          itemId, supplierId,
          unitCostFen: rmbToFen(unitCostRmb), // string-based — no float money math
          effectiveFrom, effectiveTo,
          priceSource: 'SUPPLIER_EXCEL',
        }),
      }, { authMode: 'userPool' });
      if (res.errors?.length) throw new Error(res.errors.map((e) => e.message).join(', '));
      console.log(`✓ ${label}`);
      ok++;
    } catch (e) {
      console.error(`✗ ${label}: ${(e as Error).message}`);
      failed++;
    }
  }
  console.log(`\nDone: ${ok} imported, ${failed} failed.`);
  if (failed) process.exit(2);
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 4: Verify + commit**

The import script depends on a deployed backend, so implementation-time verification is the csv helper tests plus `npx tsc --noEmit -p tsconfig.scripts.json` staying green.

```bash
git add scripts/lib/csv.ts scripts/lib/csv.test.ts scripts/import-supplier-prices.ts tsconfig.scripts.json
git commit -m "feat(scripts): CSV supplier price import with RFC4180 parser + string fen math"
```

---

### Task 19: Final verification

- [ ] **Step 1: Full test suite**

Run: `npx vitest run --exclude '**/.claude/**'`
Expected: everything green — price-api suites AND all pre-existing suites (no regressions).

- [ ] **Step 2: Lint + typecheck**

Run: `npx eslint amplify/functions/price-api src/services/priceAdminService.ts src/pages/admin/SuppliersPage.tsx src/pages/admin/PriceBookPage.tsx src/pages/admin/QuotationWorkbenchPage.tsx src/pages/admin/QuotationListPage.tsx scripts/import-supplier-prices.ts scripts/add-admin-user.ts scripts/lib/csv.ts`
Run: `npx tsc --noEmit && npm run typecheck:amplify && npx tsc --noEmit -p tsconfig.scripts.json`
Expected: no NEW errors across all three configs (`as any` warnings pre-exist elsewhere; do not add new ones).

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: succeeds; the four new pages land in the lazy-loaded admin chunk (public bundle unchanged — check the build output sizes against a main-branch build if in doubt).

- [ ] **Step 4: Commit any stragglers and stop**

Deployment (`ampx sandbox` / PR merge → Amplify pipeline), running `scripts/add-admin-user.ts` against sandbox + prod pools, and `npx ampx generate outputs` are **operator actions** — flag them in the handoff summary, do not run them from the implementation session.

---

## Deployment checklist (operator, after merge)

1. Deploy (sandbox first: `npx ampx sandbox`; then PR → main pipeline).
2. `npx ampx generate outputs --app-id d244ebmxcttcdz --branch main` — refresh `amplify_outputs.json` so scripts see the pb* operations.
3. `npx tsx scripts/add-admin-user.ts info@ninescrolls.com` against sandbox AND `--pool us-east-2_3AE21gHBg` (prod). Re-login afterwards — group claims enter the JWT at next sign-in.
4. Seed: create suppliers → catalog items → import first CSV price list.
5. Amplify Console rewrite rules are NOT needed (all new routes live under the existing `/admin` SPA rewrite), and no sitemap entries (internal pages).

## Spec-coverage self-review (done at plan-writing time; revised after plan review)

- Admin group + server gate → Tasks 1–2. Six entities → Tasks 7–11 (Supplier, CatalogItem, CostVersion+guard, PricingPolicy, Quotation scheme/header, LineSnapshot). Guard-first CAS order → Task 9. Counter bootstrap CAS → Task 11. 45-line cap + single-transaction create/edit, single-Put-per-key → Tasks 11–12. **Concurrency invariants proven by deterministic harness (exactly-one-wins, no orphan numbers, no partial delta) → Task 12b.** Pricing semantics (margin-on-price, unknown-not-zero, fx snapshot, rounding both values) → Task 4 + 11. Allocation boundaries + largest-remainder, **weights = suggested totals** → Task 5 + Task 11 `buildSnapshot`. Four rule kinds → Task 6. Price Book/Suppliers/Workbench pages + routes → Tasks 15–17. Import script (RFC4180 parser, string fen math) → Task 18. P1 stops at DRAFT — `pbUpdateQuotationDraft` refuses non-DRAFT (Task 12); no PDF/timeline/RFQ-page code anywhere.
- **Snapshot audit completeness**: every line snapshots full cost provenance (`costSnapshot`: supplierId, CostVersion interval, currency, priceSource, reviewStatus) and override audit (`overriddenBy`/`overriddenAt` + reason); money-bearing catalog reads are strongly consistent and pagination-exhausted (Task 11).
- **Header ≡ lines reconciliation**: `actualTotalUsdCents` is always exactly Σ line totals; the rounded suggested total is advisory — adopting it goes through a total override (Task 11 docstring + test).
- Deliberately deferred to P2 (per spec): expiry-reminder cron (the Price Book badge covers P1's "what to ask" need; the cron with `isSandbox` guard ships with P2's status machine), version-copy ("edit GENERATED → new version"), Convert to Order, RFQ detail panel.

