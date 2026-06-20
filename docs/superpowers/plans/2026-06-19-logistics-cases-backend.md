# Logistics Cases — Backend & Service Implementation Plan (Plan 1 of 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the backend (AppSync custom types + `logistics-api` Lambda resolvers over the existing single-table DynamoDB) and a thin frontend service for the internal Logistics Cases ledger.

**Architecture:** A `LogisticsCase` is one DynamoDB item in the shared `NineScrollsIntelligence` table (`PK=LOGISTICS#<caseId>`, `SK=META`), with `legs[]` and `milestoneLog[]` stored as embedded JSON attributes on that item. **All logistics cases share a single listing index partition** (`GSI1PK='LOGISTICS_CASES'`, `GSI1SK='<updatedAt>#<caseId>'`) so the default admin list is a recency-sorted **Query, never a Scan**. Stage / caseType / customsRequired filters are applied in-memory over that single-partition Query result (the partition is tiny — dozens of cases — so this is optimal and avoids overloading a second GSI). Every mutation that changes `updatedAt` rewrites `GSI1SK` to keep list ordering fresh. A new `logistics-api` Lambda mirrors the existing `order-api` (field-name → resolver dispatch). The Amplify Data schema exposes custom types + queries/mutations, all `allow.authenticated()`.

**Indexing rule (P0):** No resolver in this plan may use `ScanCommand`. `listLogisticsCases` and `logisticsStats` both Query `GSI1PK='LOGISTICS_CASES'`. If stage-filter volume ever grows enough that in-memory filtering is wasteful, promote `currentStage` to a dedicated GSI2 partition (`GSI2PK='LOGISTICS_STAGE#<stage>'`) — out of scope for Phase 1.

**Tech Stack:** AWS Amplify Gen 2 (`@aws-amplify/backend`), AppSync, DynamoDB (single-table, `@aws-sdk/lib-dynamodb`), TypeScript, vitest, Node 22 Lambda.

**Spec:** `docs/superpowers/specs/2026-06-19-logistics-cases-design.md`

**Reference files to mirror (read before starting):**
- `amplify/functions/order-api/` — handler, resolvers, `lib/`
- `amplify/data/resource.ts` — Order custom types + ops (lines ~196-590, ~777-800)
- `amplify/backend.ts` — `intelligenceTable` + GSI1 + `orderApi` grant (lines ~399-520)
- `src/services/orderAdminService.ts` — thin service pattern

---

## File Structure

**New Lambda — `amplify/functions/logistics-api/`:**
- `resource.ts` — `defineFunction` (mirrors order-api `resource.ts`)
- `handler.ts` — field-name dispatch (mirrors order-api `handler.ts`)
- `package.json` — copy of order-api `package.json`
- `lib/dynamodb.ts` — DDB doc client + `TABLE_NAME()`
- `lib/types.ts` — const arrays, TS interfaces, `getOperatorInfo`, `AppSyncEvent`
- `lib/stages.ts` — stage ladder, per-caseType enabled subsets, transition validation
- `lib/idGenerators.ts` — `generateCaseId`, `generateLegId`, `formatCaseNumber`, `nextCaseSeq`
- `lib/caseHelper.ts` — `fetchCase`, `buildCaseResponse`
- `resolvers/*.ts` — one file per operation

**Modified:**
- `amplify/data/resource.ts` — add enums, custom types, queries, mutations
- `amplify/backend.ts` — register `logisticsApi`, grant table + env

**New frontend:**
- `src/services/logisticsAdminService.ts` — thin GraphQL wrapper

**Tests:** co-located `*.test.ts` next to each `lib/` and `resolvers/` file.

---

## Storage Model (reference for all tasks)

| Item | PK | SK | Key attributes |
|------|----|----|----------------|
| Case meta | `LOGISTICS#<caseId>` | `META` | all case fields + `legs` (JSON array) + `milestoneLog` (JSON array); **`GSI1PK='LOGISTICS_CASES'`** (constant), **`GSI1SK='<updatedAt>#<caseId>'`** (rewritten on every mutation) |
| Year counter | `COUNTER#LOGISTICS_CASE` | `YEAR#<year>` | `seq` (number) |

> **Embedded-array size note:** `milestoneLog[]` and `legs[]` live on the META item (DynamoDB 400 KB item limit). Fine for Phase 1 volume. If `milestoneLog` ever approaches practical item-size limits, split it into `LOGISTICS#<caseId>` / `LOG#<timestamp>` items — not needed now.

---

## Task 1: Stage model library (`lib/stages.ts`)

**Files:**
- Create: `amplify/functions/logistics-api/lib/stages.ts`
- Test: `amplify/functions/logistics-api/lib/stages.test.ts`

- [ ] **Step 1: Write the failing test**

Create `amplify/functions/logistics-api/lib/stages.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  LOGISTICS_STAGES,
  ENABLED_STAGES,
  isStageEnabled,
  isValidStageTransition,
} from './stages.js';

describe('stages', () => {
  it('superset has all 22 stages including DRAFT and CANCELLED', () => {
    expect(LOGISTICS_STAGES).toContain('DRAFT');
    expect(LOGISTICS_STAGES).toContain('CANCELLED');
    expect(LOGISTICS_STAGES.length).toBe(22);
  });

  it('SAMPLE enables the round-trip subset but not equipment stages', () => {
    expect(ENABLED_STAGES.SAMPLE).toContain('TESTING');
    expect(ENABLED_STAGES.SAMPLE).toContain('RETURNED');
    expect(ENABLED_STAGES.SAMPLE).not.toContain('FAT_PASSED');
  });

  it('EQUIPMENT enables FAT/installation but not TESTING', () => {
    expect(ENABLED_STAGES.EQUIPMENT).toContain('FAT_PASSED');
    expect(ENABLED_STAGES.EQUIPMENT).toContain('ACCEPTED');
    expect(ENABLED_STAGES.EQUIPMENT).not.toContain('TESTING');
  });

  it('DEMO reuses the EQUIPMENT subset', () => {
    expect(ENABLED_STAGES.DEMO).toEqual(ENABLED_STAGES.EQUIPMENT);
  });

  it('isStageEnabled: DRAFT and CANCELLED are always allowed', () => {
    expect(isStageEnabled('SAMPLE', 'DRAFT')).toBe(true);
    expect(isStageEnabled('SAMPLE', 'CANCELLED')).toBe(true);
  });

  it('isStageEnabled: rejects a stage outside the case type subset', () => {
    expect(isStageEnabled('SPARE_PART', 'TESTING')).toBe(false);
    expect(isStageEnabled('SAMPLE', 'TESTING')).toBe(true);
  });

  it('isValidStageTransition: target must be enabled (or DRAFT/CANCELLED)', () => {
    expect(isValidStageTransition('EQUIPMENT', 'FAT_PASSED')).toBe(true);
    expect(isValidStageTransition('EQUIPMENT', 'TESTING')).toBe(false);
    expect(isValidStageTransition('EQUIPMENT', 'CANCELLED')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run amplify/functions/logistics-api/lib/stages.test.ts`
Expected: FAIL — cannot resolve `./stages.js`.

- [ ] **Step 3: Write the implementation**

Create `amplify/functions/logistics-api/lib/stages.ts`:

```typescript
export const CASE_TYPES = ['SAMPLE', 'EQUIPMENT', 'SPARE_PART', 'RMA', 'DEMO'] as const;
export type CaseType = typeof CASE_TYPES[number];

export const LEG_DIRECTIONS = ['INBOUND', 'OUTBOUND', 'RETURN', 'DOMESTIC_TRANSFER'] as const;
export type LegDirection = typeof LEG_DIRECTIONS[number];

export const CUSTOMS_STATUSES = [
  'NOT_REQUIRED', 'DOCS_READY', 'FILED', 'EXAM', 'HELD', 'RELEASED', 'DUTIES_PAID', 'CLEARED',
] as const;
export type CustomsStatus = typeof CUSTOMS_STATUSES[number];

export const RELATED_ENTITY_TYPES = [
  'ORDER', 'LEAD', 'SAMPLE_PROJECT', 'CUSTOMER', 'SERVICE_CASE',
] as const;
export type RelatedEntityType = typeof RELATED_ENTITY_TYPES[number];

export const LOGISTICS_STAGES = [
  'DRAFT',
  'AWAITING_SHIPMENT',
  'IN_TRANSIT',
  'EXPORT_CUSTOMS',
  'IMPORT_CUSTOMS',
  'CUSTOMS_HOLD',
  'RECEIVED',
  'TESTING',
  'REPORT_ISSUED',
  'READY_TO_RETURN',
  'RETURN_IN_TRANSIT',
  'RETURNED',
  'PRODUCTION',
  'FAT_SCHEDULED',
  'FAT_PASSED',
  'READY_TO_SHIP',
  'DELIVERED',
  'INSTALLATION_SCHEDULED',
  'INSTALLED',
  'ACCEPTED',
  'CLOSED',
  'CANCELLED',
] as const;
export type LogisticsStage = typeof LOGISTICS_STAGES[number];

/** Stages reachable for any case type, exempt from the enabledStages subset constraint. */
export const UNIVERSAL_STAGES: LogisticsStage[] = ['DRAFT', 'CANCELLED'];

const EQUIPMENT_STAGES: LogisticsStage[] = [
  'PRODUCTION', 'FAT_SCHEDULED', 'FAT_PASSED', 'READY_TO_SHIP', 'EXPORT_CUSTOMS',
  'IN_TRANSIT', 'IMPORT_CUSTOMS', 'CUSTOMS_HOLD', 'DELIVERED',
  'INSTALLATION_SCHEDULED', 'INSTALLED', 'ACCEPTED', 'CLOSED',
];

export const ENABLED_STAGES: Record<CaseType, LogisticsStage[]> = {
  SAMPLE: [
    'AWAITING_SHIPMENT', 'IN_TRANSIT', 'EXPORT_CUSTOMS', 'IMPORT_CUSTOMS', 'CUSTOMS_HOLD',
    'RECEIVED', 'TESTING', 'REPORT_ISSUED', 'READY_TO_RETURN', 'RETURN_IN_TRANSIT',
    'RETURNED', 'CLOSED',
  ],
  EQUIPMENT: EQUIPMENT_STAGES,
  SPARE_PART: [
    'AWAITING_SHIPMENT', 'IN_TRANSIT', 'EXPORT_CUSTOMS', 'IMPORT_CUSTOMS', 'DELIVERED', 'CLOSED',
  ],
  RMA: [
    'AWAITING_SHIPMENT', 'IN_TRANSIT', 'IMPORT_CUSTOMS', 'RECEIVED', 'TESTING',
    'READY_TO_RETURN', 'RETURN_IN_TRANSIT', 'EXPORT_CUSTOMS', 'DELIVERED', 'CLOSED',
  ],
  DEMO: EQUIPMENT_STAGES,
};

export function isStageEnabled(caseType: CaseType, stage: LogisticsStage): boolean {
  if (UNIVERSAL_STAGES.includes(stage)) return true;
  return ENABLED_STAGES[caseType]?.includes(stage) ?? false;
}

/** Phase 1: any enabled (or universal) target is valid — no forced linear order. */
export function isValidStageTransition(caseType: CaseType, target: LogisticsStage): boolean {
  return isStageEnabled(caseType, target);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run amplify/functions/logistics-api/lib/stages.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add amplify/functions/logistics-api/lib/stages.ts amplify/functions/logistics-api/lib/stages.test.ts
git commit -m "feat(logistics): stage ladder + per-caseType enabled subsets"
```

---

## Task 2: ID generators (`lib/idGenerators.ts`)

**Files:**
- Create: `amplify/functions/logistics-api/lib/idGenerators.ts`
- Test: `amplify/functions/logistics-api/lib/idGenerators.test.ts`

`caseId`/`legId` are random (like `order-api` `generateOrderId`). `caseNumber` is human-facing sequential `NS-LOG-<year>-<4-digit seq>`; the atomic counter read lives in the resolver (Task 7), so here we only unit-test the pure formatter.

- [ ] **Step 1: Write the failing test**

Create `amplify/functions/logistics-api/lib/idGenerators.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { generateCaseId, generateLegId, formatCaseNumber } from './idGenerators.js';

describe('idGenerators', () => {
  it('generateCaseId is prefixed and unique', () => {
    const a = generateCaseId();
    const b = generateCaseId();
    expect(a).toMatch(/^lc-\d{8}-[0-9a-f]{4}$/);
    expect(a).not.toBe(b);
  });

  it('generateLegId is prefixed', () => {
    expect(generateLegId()).toMatch(/^leg-[0-9a-f]{6}$/);
  });

  it('formatCaseNumber zero-pads to 4 digits', () => {
    expect(formatCaseNumber(2026, 1)).toBe('NS-LOG-2026-0001');
    expect(formatCaseNumber(2026, 42)).toBe('NS-LOG-2026-0042');
    expect(formatCaseNumber(2026, 12345)).toBe('NS-LOG-2026-12345');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run amplify/functions/logistics-api/lib/idGenerators.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `amplify/functions/logistics-api/lib/idGenerators.ts`:

```typescript
import crypto from 'node:crypto';

export function generateCaseId(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `lc-${date}-${crypto.randomBytes(2).toString('hex')}`;
}

export function generateLegId(): string {
  return `leg-${crypto.randomBytes(3).toString('hex')}`;
}

export function formatCaseNumber(year: number, seq: number): string {
  return `NS-LOG-${year}-${String(seq).padStart(4, '0')}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run amplify/functions/logistics-api/lib/idGenerators.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add amplify/functions/logistics-api/lib/idGenerators.ts amplify/functions/logistics-api/lib/idGenerators.test.ts
git commit -m "feat(logistics): id + caseNumber generators"
```

---

## Task 3: Types + DDB client libs (`lib/types.ts`, `lib/dynamodb.ts`)

**Files:**
- Create: `amplify/functions/logistics-api/lib/types.ts`
- Create: `amplify/functions/logistics-api/lib/dynamodb.ts`
- Test: `amplify/functions/logistics-api/lib/types.test.ts`

- [ ] **Step 1: Write the failing test**

Create `amplify/functions/logistics-api/lib/types.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { getOperatorInfo } from './types.js';

describe('getOperatorInfo', () => {
  it('falls back to admin when no identity', () => {
    expect(getOperatorInfo({ info: { fieldName: 'x', parentTypeName: 'Query' }, arguments: {} }))
      .toEqual({ sub: 'admin', email: 'admin' });
  });

  it('prefers claims.email', () => {
    const r = getOperatorInfo({
      info: { fieldName: 'x', parentTypeName: 'Query' },
      arguments: {},
      identity: { sub: 'u-1', claims: { email: 'harvey@ninescrolls.com' } },
    });
    expect(r).toEqual({ sub: 'u-1', email: 'harvey@ninescrolls.com' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run amplify/functions/logistics-api/lib/types.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementations**

Create `amplify/functions/logistics-api/lib/dynamodb.ts`:

```typescript
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const ddbClient = new DynamoDBClient({});
export const docClient = DynamoDBDocumentClient.from(ddbClient);

export const TABLE_NAME = () => process.env.INTELLIGENCE_TABLE!;
```

(No `SLACK_WEBHOOK_URL` — Phase 1 has no notifications.)

Create `amplify/functions/logistics-api/lib/types.ts`:

```typescript
import type {
  CaseType, LegDirection, CustomsStatus, RelatedEntityType, LogisticsStage,
} from './stages.js';

export interface AppSyncEvent {
  info: { fieldName: string; parentTypeName: string };
  arguments: Record<string, unknown>;
  identity?: { sub: string; username?: string; claims?: Record<string, unknown> };
}

export function getOperatorInfo(event: AppSyncEvent): { sub: string; email: string } {
  const id = event.identity;
  if (!id) return { sub: 'admin', email: 'admin' };
  const email = (id.claims?.email as string)
    || (id.claims?.['cognito:email'] as string)
    || id.username
    || id.sub
    || 'admin';
  return { sub: id.sub || 'admin', email };
}

export interface ShipmentLeg {
  legId: string;
  direction: LegDirection;
  customsRequired?: boolean;
  customsStatus?: CustomsStatus;
  carrier?: string;
  trackingNumber?: string;
  trackingUrl?: string; // optional manual/auto-built link; Phase 1 has NO carrier-API polling
  freightForwarder?: string;
  blOrAwb?: string;
  containerNo?: string;
  declaredValueUSD?: number;
  hsCode?: string;
  shippedAt?: string;
  clearedAt?: string;
  deliveredAt?: string;
}

export interface LogisticsLogEntry {
  action: string;
  fromStage?: LogisticsStage | null;
  toStage?: LogisticsStage | null;
  operator: string;
  timestamp: string;
  detail?: string;
  internalOnly: boolean;
}

export interface LogisticsCaseItem {
  PK: string;
  SK: 'META';
  GSI1PK: 'LOGISTICS_CASES'; // constant listing partition — never per-stage
  GSI1SK: string;            // '<updatedAt>#<caseId>'
  caseId: string;
  caseNumber: string;
  caseType: CaseType;
  relatedOrderId?: string;
  relatedEntityType?: RelatedEntityType;
  relatedEntityId?: string;
  customerName: string;
  contactName?: string;
  customsRequired: boolean;
  currentStage: LogisticsStage;
  enabledStages: LogisticsStage[];
  legs: ShipmentLeg[];
  milestoneLog: LogisticsLogEntry[];
  isCustomerVisible: boolean;
  publicToken?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

/** GraphQL-facing shape: identical to the item minus DDB keys. */
export type LogisticsCaseResponse = Omit<LogisticsCaseItem, 'PK' | 'SK' | 'GSI1PK' | 'GSI1SK'>;

export function toCaseResponse(item: LogisticsCaseItem): LogisticsCaseResponse {
  const { PK, SK, GSI1PK, GSI1SK, ...rest } = item;
  return rest;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run amplify/functions/logistics-api/lib/types.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add amplify/functions/logistics-api/lib/types.ts amplify/functions/logistics-api/lib/dynamodb.ts amplify/functions/logistics-api/lib/types.test.ts
git commit -m "feat(logistics): DDB client + case/leg/log types"
```

---

## Task 4: Case helper (`lib/caseHelper.ts`)

**Files:**
- Create: `amplify/functions/logistics-api/lib/caseHelper.ts`
- Test: `amplify/functions/logistics-api/lib/caseHelper.test.ts`

- [ ] **Step 1: Write the failing test**

Create `amplify/functions/logistics-api/lib/caseHelper.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const send = vi.fn();
vi.mock('./dynamodb.js', () => ({
  docClient: { send: (...a: unknown[]) => send(...a) },
  TABLE_NAME: () => 'TestTable',
}));

import { fetchCase } from './caseHelper.js';

beforeEach(() => send.mockReset());

describe('fetchCase', () => {
  it('returns the META item for a caseId', async () => {
    send.mockResolvedValueOnce({ Item: { caseId: 'lc-1', SK: 'META', currentStage: 'DRAFT' } });
    const c = await fetchCase('lc-1');
    expect(c?.caseId).toBe('lc-1');
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('returns null when not found', async () => {
    send.mockResolvedValueOnce({});
    expect(await fetchCase('missing')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run amplify/functions/logistics-api/lib/caseHelper.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `amplify/functions/logistics-api/lib/caseHelper.ts`:

```typescript
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from './dynamodb.js';
import type { LogisticsCaseItem, LogisticsCaseResponse } from './types.js';
import { toCaseResponse } from './types.js';

export async function fetchCase(caseId: string): Promise<LogisticsCaseItem | null> {
  const res = await docClient.send(new GetCommand({
    TableName: TABLE_NAME(),
    Key: { PK: `LOGISTICS#${caseId}`, SK: 'META' },
  }));
  return (res.Item as LogisticsCaseItem) ?? null;
}

export async function buildCaseResponse(caseId: string): Promise<LogisticsCaseResponse | null> {
  const item = await fetchCase(caseId);
  return item ? toCaseResponse(item) : null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run amplify/functions/logistics-api/lib/caseHelper.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add amplify/functions/logistics-api/lib/caseHelper.ts amplify/functions/logistics-api/lib/caseHelper.test.ts
git commit -m "feat(logistics): case fetch/build helpers"
```

---

## Task 5: `createLogisticsCase` resolver

**Files:**
- Create: `amplify/functions/logistics-api/resolvers/createLogisticsCase.ts`
- Test: `amplify/functions/logistics-api/resolvers/createLogisticsCase.test.ts`

Behavior: validate input, atomically increment the year counter for `caseNumber`, write the META item with `currentStage='DRAFT'`, empty `legs`, one `milestoneLog` entry (`CASE_CREATED`), `enabledStages` from the case type.

- [ ] **Step 1: Write the failing test**

Create `amplify/functions/logistics-api/resolvers/createLogisticsCase.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const send = vi.fn();
vi.mock('../lib/dynamodb.js', () => ({
  docClient: { send: (...a: unknown[]) => send(...a) },
  TABLE_NAME: () => 'TestTable',
}));

import { createLogisticsCase } from './createLogisticsCase.js';

beforeEach(() => send.mockReset());

function evt(input: Record<string, unknown>) {
  return {
    info: { fieldName: 'createLogisticsCase', parentTypeName: 'Mutation' },
    arguments: { input: JSON.stringify(input) },
    identity: { sub: 'u-1', claims: { email: 'harvey@ninescrolls.com' } },
  };
}

describe('createLogisticsCase', () => {
  it('creates a DRAFT case with sequential caseNumber and enabled subset', async () => {
    // 1st send = counter UpdateCommand → returns seq; 2nd = PutCommand; 3rd = GetCommand (buildCaseResponse)
    send
      .mockResolvedValueOnce({ Attributes: { seq: 7 } })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ Item: { PK: 'LOGISTICS#lc-x', SK: 'META', caseId: 'lc-x', currentStage: 'DRAFT' } });

    const res = await createLogisticsCase(
      evt({ caseType: 'EQUIPMENT', customerName: 'HORIBA', customsRequired: true }),
    );

    const put = send.mock.calls[1][0].input;
    expect(put.Item.currentStage).toBe('DRAFT');
    expect(put.Item.caseType).toBe('EQUIPMENT');
    expect(put.Item.caseNumber).toMatch(/^NS-LOG-\d{4}-0007$/);
    expect(put.Item.enabledStages).toContain('FAT_PASSED');
    expect(put.Item.legs).toEqual([]);
    expect(put.Item.milestoneLog).toHaveLength(1);
    expect(put.Item.milestoneLog[0].action).toBe('CASE_CREATED');
    expect(put.Item.GSI1PK).toBe('LOGISTICS_CASES');
    expect(put.Item.GSI1SK).toMatch(/#lc-/);
    expect(res).not.toBeNull();
  });

  it('rejects an unknown caseType', async () => {
    await expect(createLogisticsCase(evt({ caseType: 'BOGUS', customerName: 'X' })))
      .rejects.toThrow(/caseType/);
  });

  it('rejects a missing customerName', async () => {
    await expect(createLogisticsCase(evt({ caseType: 'SAMPLE' })))
      .rejects.toThrow(/customerName/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run amplify/functions/logistics-api/resolvers/createLogisticsCase.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `amplify/functions/logistics-api/resolvers/createLogisticsCase.ts`:

```typescript
import { PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../lib/dynamodb.js';
import { generateCaseId, formatCaseNumber } from '../lib/idGenerators.js';
import { buildCaseResponse } from '../lib/caseHelper.js';
import { getOperatorInfo } from '../lib/types.js';
import type { AppSyncEvent, LogisticsCaseItem } from '../lib/types.js';
import {
  CASE_TYPES, ENABLED_STAGES, RELATED_ENTITY_TYPES,
  type CaseType, type RelatedEntityType,
} from '../lib/stages.js';

interface CreateInput {
  caseType: string;
  customerName?: string;
  contactName?: string;
  customsRequired?: boolean;
  relatedOrderId?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  notes?: string;
}

async function nextCaseSeq(year: number): Promise<number> {
  const res = await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME(),
    Key: { PK: 'COUNTER#LOGISTICS_CASE', SK: `YEAR#${year}` },
    UpdateExpression: 'ADD seq :one',
    ExpressionAttributeValues: { ':one': 1 },
    ReturnValues: 'UPDATED_NEW',
  }));
  return (res.Attributes?.seq as number) ?? 1;
}

export async function createLogisticsCase(event: AppSyncEvent) {
  const { input: raw } = event.arguments as { input: string | CreateInput };
  const input: CreateInput = typeof raw === 'string' ? JSON.parse(raw) : raw;

  if (!CASE_TYPES.includes(input.caseType as CaseType)) {
    throw new Error(`caseType must be one of: ${CASE_TYPES.join(', ')}`);
  }
  if (!input.customerName || !input.customerName.trim()) {
    throw new Error('customerName is required');
  }
  if (input.relatedEntityType
    && !RELATED_ENTITY_TYPES.includes(input.relatedEntityType as RelatedEntityType)) {
    throw new Error(`relatedEntityType must be one of: ${RELATED_ENTITY_TYPES.join(', ')}`);
  }

  const caseType = input.caseType as CaseType;
  const now = new Date().toISOString();
  const year = Number(now.slice(0, 4));
  const caseId = generateCaseId();
  const seq = await nextCaseSeq(year);
  const caseNumber = formatCaseNumber(year, seq);
  const { sub: operatorId, email: operator } = getOperatorInfo(event);

  const item: LogisticsCaseItem = {
    PK: `LOGISTICS#${caseId}`,
    SK: 'META',
    GSI1PK: 'LOGISTICS_CASES',
    GSI1SK: `${now}#${caseId}`,
    caseId,
    caseNumber,
    caseType,
    relatedOrderId: input.relatedOrderId || undefined,
    relatedEntityType: input.relatedEntityType as RelatedEntityType | undefined,
    relatedEntityId: input.relatedEntityId || undefined,
    customerName: input.customerName.trim(),
    contactName: input.contactName || undefined,
    customsRequired: input.customsRequired ?? false,
    currentStage: 'DRAFT',
    enabledStages: ENABLED_STAGES[caseType],
    legs: [],
    milestoneLog: [{
      action: 'CASE_CREATED',
      fromStage: null,
      toStage: 'DRAFT',
      operator,
      timestamp: now,
      detail: `${caseType} case created for ${input.customerName.trim()}`,
      internalOnly: false,
    }],
    isCustomerVisible: false,
    notes: input.notes || undefined,
    createdAt: now,
    updatedAt: now,
    createdBy: operatorId,
  };

  await docClient.send(new PutCommand({ TableName: TABLE_NAME(), Item: item }));
  return buildCaseResponse(caseId);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run amplify/functions/logistics-api/resolvers/createLogisticsCase.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add amplify/functions/logistics-api/resolvers/createLogisticsCase.ts amplify/functions/logistics-api/resolvers/createLogisticsCase.test.ts
git commit -m "feat(logistics): createLogisticsCase resolver with sequential caseNumber"
```

---

## Task 6: `getLogisticsCase` resolver

**Files:**
- Create: `amplify/functions/logistics-api/resolvers/getLogisticsCase.ts`
- Test: `amplify/functions/logistics-api/resolvers/getLogisticsCase.test.ts`

- [ ] **Step 1: Write the failing test**

Create `amplify/functions/logistics-api/resolvers/getLogisticsCase.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const send = vi.fn();
vi.mock('../lib/dynamodb.js', () => ({
  docClient: { send: (...a: unknown[]) => send(...a) },
  TABLE_NAME: () => 'TestTable',
}));

import { getLogisticsCase } from './getLogisticsCase.js';

beforeEach(() => send.mockReset());

describe('getLogisticsCase', () => {
  it('returns the case response without DDB keys', async () => {
    send.mockResolvedValueOnce({
      Item: { PK: 'LOGISTICS#lc-1', SK: 'META', GSI1PK: 'x', GSI1SK: 'y', caseId: 'lc-1', currentStage: 'DRAFT' },
    });
    const res = await getLogisticsCase({
      info: { fieldName: 'getLogisticsCase', parentTypeName: 'Query' },
      arguments: { caseId: 'lc-1' },
    });
    expect(res?.caseId).toBe('lc-1');
    expect((res as Record<string, unknown>).PK).toBeUndefined();
  });

  it('throws when caseId missing', async () => {
    await expect(getLogisticsCase({
      info: { fieldName: 'getLogisticsCase', parentTypeName: 'Query' }, arguments: {},
    })).rejects.toThrow(/caseId/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run amplify/functions/logistics-api/resolvers/getLogisticsCase.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `amplify/functions/logistics-api/resolvers/getLogisticsCase.ts`:

```typescript
import { buildCaseResponse } from '../lib/caseHelper.js';
import type { AppSyncEvent } from '../lib/types.js';

export async function getLogisticsCase(event: AppSyncEvent) {
  const { caseId } = event.arguments as { caseId?: string };
  if (!caseId) throw new Error('caseId is required');
  return buildCaseResponse(caseId);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run amplify/functions/logistics-api/resolvers/getLogisticsCase.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add amplify/functions/logistics-api/resolvers/getLogisticsCase.ts amplify/functions/logistics-api/resolvers/getLogisticsCase.test.ts
git commit -m "feat(logistics): getLogisticsCase resolver"
```

---

## Task 7: `listLogisticsCases` resolver

**Files:**
- Create: `amplify/functions/logistics-api/resolvers/listLogisticsCases.ts`
- Test: `amplify/functions/logistics-api/resolvers/listLogisticsCases.test.ts`

**No Scan.** Always Query the single listing partition `GSI1PK='LOGISTICS_CASES'` with `ScanIndexForward=false` (newest first — `GSI1SK` is `<updatedAt>#<caseId>`). Apply `stage` / `caseType` / `customsRequired` / `search` as in-memory filters across paged Query results (loop up to `MAX_PAGES` to fill a page). base64 `nextToken` pagination.

- [ ] **Step 1: Write the failing test**

Create `amplify/functions/logistics-api/resolvers/listLogisticsCases.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';

const send = vi.fn();
vi.mock('../lib/dynamodb.js', () => ({
  docClient: { send: (...a: unknown[]) => send(...a) },
  TABLE_NAME: () => 'TestTable',
}));

import { listLogisticsCases } from './listLogisticsCases.js';

beforeEach(() => send.mockReset());

function item(over: Record<string, unknown>) {
  return {
    PK: `LOGISTICS#${over.caseId}`, SK: 'META', GSI1PK: 'LOGISTICS_CASES', GSI1SK: 'y',
    caseId: 'lc-x', caseType: 'EQUIPMENT', currentStage: 'IN_TRANSIT',
    customsRequired: true, updatedAt: '2026-06-01T00:00:00Z', legs: [], milestoneLog: [],
    ...over,
  };
}

function evt(args: Record<string, unknown>) {
  return { info: { fieldName: 'listLogisticsCases', parentTypeName: 'Query' }, arguments: args };
}

describe('listLogisticsCases', () => {
  it('always Queries the LOGISTICS_CASES listing partition and never Scans', async () => {
    send.mockResolvedValueOnce({ Items: [item({ caseId: 'lc-1' })], LastEvaluatedKey: undefined });
    const res = await listLogisticsCases(evt({}));

    // P0: every command issued must be a QueryCommand, none a ScanCommand.
    for (const call of send.mock.calls) {
      expect(call[0]).toBeInstanceOf(QueryCommand);
      expect(call[0]).not.toBeInstanceOf(ScanCommand);
    }
    const cmd = send.mock.calls[0][0].input;
    expect(cmd.IndexName).toBe('GSI1');
    expect(cmd.ExpressionAttributeValues[':pk']).toBe('LOGISTICS_CASES');
    expect(cmd.ScanIndexForward).toBe(false);
    expect(res.items[0].caseId).toBe('lc-1');
    expect((res.items[0] as Record<string, unknown>).PK).toBeUndefined();
    expect(res.nextToken).toBeNull();
  });

  it('filters by stage in-memory over the listing Query (still no Scan)', async () => {
    send.mockResolvedValueOnce({
      Items: [item({ caseId: 'lc-1', currentStage: 'IN_TRANSIT' }), item({ caseId: 'lc-2', currentStage: 'DELIVERED' })],
      LastEvaluatedKey: undefined,
    });
    const res = await listLogisticsCases(evt({ stage: 'IN_TRANSIT' }));
    expect(send.mock.calls[0][0]).toBeInstanceOf(QueryCommand);
    expect(res.items).toHaveLength(1);
    expect(res.items[0].currentStage).toBe('IN_TRANSIT');
  });

  it('filters by caseType in-memory', async () => {
    send.mockResolvedValueOnce({
      Items: [item({ caseId: 'lc-1', caseType: 'SAMPLE' }), item({ caseId: 'lc-2', caseType: 'EQUIPMENT' })],
      LastEvaluatedKey: undefined,
    });
    const res = await listLogisticsCases(evt({ caseType: 'SAMPLE' }));
    expect(res.items).toHaveLength(1);
    expect(res.items[0].caseType).toBe('SAMPLE');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run amplify/functions/logistics-api/resolvers/listLogisticsCases.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `amplify/functions/logistics-api/resolvers/listLogisticsCases.ts`:

```typescript
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../lib/dynamodb.js';
import { toCaseResponse } from '../lib/types.js';
import type { AppSyncEvent, LogisticsCaseItem } from '../lib/types.js';

const SEARCH_FIELDS = ['caseNumber', 'customerName', 'contactName', 'relatedOrderId'] as const;
const LISTING_PK = 'LOGISTICS_CASES';
const MAX_PAGES = 20;

function matchesSearch(it: Record<string, unknown>, needle: string): boolean {
  const q = needle.toLowerCase();
  return SEARCH_FIELDS.some((f) => {
    const v = it[f];
    return typeof v === 'string' && v.toLowerCase().includes(q);
  });
}

export async function listLogisticsCases(event: AppSyncEvent) {
  const { stage, caseType, customsRequired, search, limit = 50, nextToken } =
    event.arguments as {
      stage?: string; caseType?: string; customsRequired?: boolean;
      search?: string; limit?: number; nextToken?: string;
    };

  const effectiveLimit = Math.min(Math.max(limit || 50, 1), 200);
  const startKey = nextToken ? JSON.parse(Buffer.from(nextToken, 'base64').toString()) : undefined;
  const term = search?.trim() || undefined;

  const passesFilters = (it: Record<string, unknown>) =>
    (!stage || it.currentStage === stage)
    && (!caseType || it.caseType === caseType)
    && (customsRequired === undefined || it.customsRequired === customsRequired)
    && (!term || matchesSearch(it, term));

  // P0: ALWAYS Query the single listing partition, newest first. Never Scan.
  const collected: Record<string, unknown>[] = [];
  let key = startKey;
  for (let page = 0; page < MAX_PAGES; page++) {
    const r = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME(),
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: { ':pk': LISTING_PK },
      ScanIndexForward: false, // GSI1SK = '<updatedAt>#<caseId>' → recency-sorted
      ExclusiveStartKey: key,
    }));
    collected.push(...(r.Items || []).filter(passesFilters));
    key = r.LastEvaluatedKey;
    if (!key || collected.length >= effectiveLimit) break;
  }

  const items = collected.slice(0, effectiveLimit);

  return {
    items: items.map((it) => toCaseResponse(it as unknown as LogisticsCaseItem)),
    nextToken: key ? Buffer.from(JSON.stringify(key)).toString('base64') : null,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run amplify/functions/logistics-api/resolvers/listLogisticsCases.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add amplify/functions/logistics-api/resolvers/listLogisticsCases.ts amplify/functions/logistics-api/resolvers/listLogisticsCases.test.ts
git commit -m "feat(logistics): listLogisticsCases resolver with listing query"
```

---

## Task 8: `advanceLogisticsStage` resolver

**Files:**
- Create: `amplify/functions/logistics-api/resolvers/advanceLogisticsStage.ts`
- Test: `amplify/functions/logistics-api/resolvers/advanceLogisticsStage.test.ts`

Behavior: fetch case; validate `targetStage` is enabled for the case type (or DRAFT/CANCELLED); append a `milestoneLog` entry; update `currentStage`, `GSI1SK`, `updatedAt` (the listing partition `GSI1PK='LOGISTICS_CASES'` stays constant — only the recency sort key changes).

- [ ] **Step 1: Write the failing test**

Create `amplify/functions/logistics-api/resolvers/advanceLogisticsStage.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const send = vi.fn();
vi.mock('../lib/dynamodb.js', () => ({
  docClient: { send: (...a: unknown[]) => send(...a) },
  TABLE_NAME: () => 'TestTable',
}));

import { advanceLogisticsStage } from './advanceLogisticsStage.js';

beforeEach(() => send.mockReset());

const baseCase = {
  PK: 'LOGISTICS#lc-1', SK: 'META', GSI1PK: 'LOGISTICS_CASES', GSI1SK: 'x',
  caseId: 'lc-1', caseNumber: 'NS-LOG-2026-0001', caseType: 'EQUIPMENT',
  customerName: 'HORIBA', customsRequired: true, currentStage: 'DRAFT',
  enabledStages: ['PRODUCTION', 'FAT_PASSED'], legs: [], milestoneLog: [],
  isCustomerVisible: false, createdAt: 'x', updatedAt: 'x', createdBy: 'u',
};

function evt(args: Record<string, unknown>) {
  return {
    info: { fieldName: 'advanceLogisticsStage', parentTypeName: 'Mutation' },
    arguments: args,
    identity: { sub: 'u-1', claims: { email: 'harvey@ninescrolls.com' } },
  };
}

describe('advanceLogisticsStage', () => {
  it('advances to an enabled stage and appends a log entry', async () => {
    send
      .mockResolvedValueOnce({ Item: { ...baseCase } })            // fetchCase
      .mockResolvedValueOnce({})                                   // UpdateCommand
      .mockResolvedValueOnce({ Item: { ...baseCase, currentStage: 'PRODUCTION' } }); // build response
    const res = await advanceLogisticsStage(evt({ caseId: 'lc-1', targetStage: 'PRODUCTION', detail: 'kickoff' }));
    const upd = send.mock.calls[1][0].input;
    expect(upd.ExpressionAttributeValues[':stage']).toBe('PRODUCTION');
    // Listing partition is constant; only the recency sort key is refreshed.
    expect(upd.ExpressionAttributeValues[':gsi1sk']).toMatch(/#lc-1$/);
    expect(upd.UpdateExpression).not.toContain('GSI1PK');
    expect(upd.ExpressionAttributeValues[':log'][0].toStage).toBe('PRODUCTION');
    expect(res?.currentStage).toBe('PRODUCTION');
  });

  it('rejects a stage not enabled for the case type', async () => {
    send.mockResolvedValueOnce({ Item: { ...baseCase } });
    await expect(advanceLogisticsStage(evt({ caseId: 'lc-1', targetStage: 'TESTING' })))
      .rejects.toThrow(/not enabled/i);
  });

  it('throws when the case does not exist', async () => {
    send.mockResolvedValueOnce({ Item: null });
    await expect(advanceLogisticsStage(evt({ caseId: 'missing', targetStage: 'PRODUCTION' })))
      .rejects.toThrow(/not found/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run amplify/functions/logistics-api/resolvers/advanceLogisticsStage.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `amplify/functions/logistics-api/resolvers/advanceLogisticsStage.ts`:

```typescript
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../lib/dynamodb.js';
import { fetchCase, buildCaseResponse } from '../lib/caseHelper.js';
import { getOperatorInfo } from '../lib/types.js';
import type { AppSyncEvent, LogisticsLogEntry } from '../lib/types.js';
import { isValidStageTransition, LOGISTICS_STAGES, type LogisticsStage } from '../lib/stages.js';

export async function advanceLogisticsStage(event: AppSyncEvent) {
  const { caseId, targetStage, detail, internalOnly } = event.arguments as {
    caseId?: string; targetStage?: string; detail?: string; internalOnly?: boolean;
  };
  if (!caseId || !targetStage) throw new Error('caseId and targetStage are required');
  if (!LOGISTICS_STAGES.includes(targetStage as LogisticsStage)) {
    throw new Error(`Unknown stage: ${targetStage}`);
  }

  const current = await fetchCase(caseId);
  if (!current) throw new Error(`Logistics case not found: ${caseId}`);

  const stage = targetStage as LogisticsStage;
  if (!isValidStageTransition(current.caseType, stage)) {
    throw new Error(`Stage ${stage} is not enabled for caseType ${current.caseType}`);
  }

  const now = new Date().toISOString();
  const { email: operator } = getOperatorInfo(event);
  const entry: LogisticsLogEntry = {
    action: 'STAGE_ADVANCED',
    fromStage: current.currentStage,
    toStage: stage,
    operator,
    timestamp: now,
    detail: detail || undefined,
    internalOnly: internalOnly ?? false,
  };
  const milestoneLog = [...(current.milestoneLog || []), entry];

  await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME(),
    Key: { PK: `LOGISTICS#${caseId}`, SK: 'META' },
    // GSI1PK stays 'LOGISTICS_CASES' (listing partition) — only GSI1SK is refreshed
    // so the case re-sorts to the top of the recency-ordered list.
    UpdateExpression:
      'SET currentStage = :stage, GSI1SK = :gsi1sk, milestoneLog = :log, updatedAt = :now',
    ExpressionAttributeValues: {
      ':stage': stage,
      ':gsi1sk': `${now}#${caseId}`,
      ':log': milestoneLog,
      ':now': now,
    },
  }));

  return buildCaseResponse(caseId);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run amplify/functions/logistics-api/resolvers/advanceLogisticsStage.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add amplify/functions/logistics-api/resolvers/advanceLogisticsStage.ts amplify/functions/logistics-api/resolvers/advanceLogisticsStage.test.ts
git commit -m "feat(logistics): advanceLogisticsStage with enabledStages validation"
```

---

## Task 9: `updateLogisticsCase` resolver (editable fields)

**Files:**
- Create: `amplify/functions/logistics-api/resolvers/updateLogisticsCase.ts`
- Test: `amplify/functions/logistics-api/resolvers/updateLogisticsCase.test.ts`

Edits a whitelist of mutable fields (`customerName`, `contactName`, `customsRequired`, `relatedOrderId`, `relatedEntityType`, `relatedEntityId`, `notes`, `isCustomerVisible`). Never edits `caseType`, `currentStage`, `legs`, `milestoneLog`, identifiers (those have dedicated resolvers).

- [ ] **Step 1: Write the failing test**

Create `amplify/functions/logistics-api/resolvers/updateLogisticsCase.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const send = vi.fn();
vi.mock('../lib/dynamodb.js', () => ({
  docClient: { send: (...a: unknown[]) => send(...a) },
  TABLE_NAME: () => 'TestTable',
}));

import { updateLogisticsCase } from './updateLogisticsCase.js';

beforeEach(() => send.mockReset());

function evt(input: Record<string, unknown>) {
  return {
    info: { fieldName: 'updateLogisticsCase', parentTypeName: 'Mutation' },
    arguments: { caseId: 'lc-1', input: JSON.stringify(input) },
    identity: { sub: 'u-1', claims: { email: 'harvey@ninescrolls.com' } },
  };
}

describe('updateLogisticsCase', () => {
  it('updates whitelisted fields, refreshes GSI1SK, ignores frozen/unknown fields', async () => {
    send.mockResolvedValueOnce({}).mockResolvedValueOnce({ Item: { caseId: 'lc-1' } });
    await updateLogisticsCase(evt({
      customerName: 'BAE', customsRequired: true,
      caseType: 'HACK',            // unknown → ignored
      isCustomerVisible: true,     // Phase 2 frozen → ignored
    }));
    const upd = send.mock.calls[0][0].input;
    expect(upd.ExpressionAttributeValues[':customerName']).toBe('BAE');
    expect(upd.ExpressionAttributeValues[':customsRequired']).toBe(true);
    expect(upd.ExpressionAttributeValues[':gsi1sk']).toMatch(/#lc-1$/);
    expect(upd.ExpressionAttributeValues[':isCustomerVisible']).toBeUndefined();
    expect(JSON.stringify(upd)).not.toContain('HACK');
  });

  it('rejects an invalid relatedEntityType', async () => {
    await expect(updateLogisticsCase(evt({ relatedEntityType: 'BOGUS' })))
      .rejects.toThrow(/relatedEntityType/);
  });

  it('throws when no editable fields supplied', async () => {
    await expect(updateLogisticsCase(evt({}))).rejects.toThrow(/no.*fields/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run amplify/functions/logistics-api/resolvers/updateLogisticsCase.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `amplify/functions/logistics-api/resolvers/updateLogisticsCase.ts`:

```typescript
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../lib/dynamodb.js';
import { buildCaseResponse } from '../lib/caseHelper.js';
import type { AppSyncEvent } from '../lib/types.js';
import { RELATED_ENTITY_TYPES, type RelatedEntityType } from '../lib/stages.js';

// Phase 1: caseType, currentStage, enabledStages, legs, milestoneLog, isCustomerVisible,
// and publicToken are NOT editable here (dedicated resolvers or frozen to Phase 2).
const EDITABLE = [
  'customerName', 'contactName', 'customsRequired',
  'relatedOrderId', 'relatedEntityType', 'relatedEntityId',
  'notes',
] as const;

export async function updateLogisticsCase(event: AppSyncEvent) {
  const { caseId, input: raw } = event.arguments as { caseId?: string; input: string | Record<string, unknown> };
  if (!caseId) throw new Error('caseId is required');
  const input: Record<string, unknown> = typeof raw === 'string' ? JSON.parse(raw) : raw;

  if (input.relatedEntityType !== undefined
    && !RELATED_ENTITY_TYPES.includes(input.relatedEntityType as RelatedEntityType)) {
    throw new Error(`relatedEntityType must be one of: ${RELATED_ENTITY_TYPES.join(', ')}`);
  }

  const now = new Date().toISOString();
  // Baseline always refreshes updatedAt + the recency sort key.
  const setParts: string[] = ['updatedAt = :now', 'GSI1SK = :gsi1sk'];
  const values: Record<string, unknown> = { ':now': now, ':gsi1sk': `${now}#${caseId}` };

  for (const field of EDITABLE) {
    if (input[field] !== undefined) {
      setParts.push(`${field} = :${field}`);
      values[`:${field}`] = input[field];
    }
  }

  if (setParts.length === 2) throw new Error('No editable fields supplied');

  await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME(),
    Key: { PK: `LOGISTICS#${caseId}`, SK: 'META' },
    UpdateExpression: `SET ${setParts.join(', ')}`,
    ExpressionAttributeValues: values,
  }));

  return buildCaseResponse(caseId);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run amplify/functions/logistics-api/resolvers/updateLogisticsCase.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add amplify/functions/logistics-api/resolvers/updateLogisticsCase.ts amplify/functions/logistics-api/resolvers/updateLogisticsCase.test.ts
git commit -m "feat(logistics): updateLogisticsCase whitelisted-field editor"
```

---

## Task 10: Leg mutations (`addLeg`, `updateLeg`, `removeLeg`)

**Files:**
- Create: `amplify/functions/logistics-api/resolvers/legMutations.ts`
- Test: `amplify/functions/logistics-api/resolvers/legMutations.test.ts`

All three mutate the embedded `legs[]` array on the META item via read-modify-write.

- [ ] **Step 1: Write the failing test**

Create `amplify/functions/logistics-api/resolvers/legMutations.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const send = vi.fn();
vi.mock('../lib/dynamodb.js', () => ({
  docClient: { send: (...a: unknown[]) => send(...a) },
  TABLE_NAME: () => 'TestTable',
}));

import { addLeg, updateLeg, removeLeg } from './legMutations.js';

beforeEach(() => send.mockReset());

const caseWithLeg = (legs: unknown[]) => ({
  Item: {
    PK: 'LOGISTICS#lc-1', SK: 'META', caseId: 'lc-1', caseType: 'SAMPLE',
    customerName: 'X', currentStage: 'DRAFT', enabledStages: [], legs, milestoneLog: [],
    customsRequired: false, isCustomerVisible: false, createdAt: 'x', updatedAt: 'x', createdBy: 'u',
  },
});

function evt(fieldName: string, args: Record<string, unknown>) {
  return { info: { fieldName, parentTypeName: 'Mutation' }, arguments: args, identity: { sub: 'u' } };
}

describe('leg mutations', () => {
  it('addLeg appends a leg with a generated id and validates direction', async () => {
    send.mockResolvedValueOnce(caseWithLeg([])).mockResolvedValueOnce({}).mockResolvedValueOnce(caseWithLeg([{}]));
    await addLeg(evt('addLeg', { caseId: 'lc-1', input: JSON.stringify({ direction: 'INBOUND', carrier: 'FedEx' }) }));
    const upd = send.mock.calls[1][0].input;
    expect(upd.ExpressionAttributeValues[':legs']).toHaveLength(1);
    expect(upd.ExpressionAttributeValues[':legs'][0].legId).toMatch(/^leg-/);
    expect(upd.ExpressionAttributeValues[':legs'][0].direction).toBe('INBOUND');
  });

  it('addLeg rejects an invalid direction', async () => {
    send.mockResolvedValueOnce(caseWithLeg([]));
    await expect(addLeg(evt('addLeg', { caseId: 'lc-1', input: JSON.stringify({ direction: 'SIDEWAYS' }) })))
      .rejects.toThrow(/direction/);
  });

  it('updateLeg edits an existing leg by id', async () => {
    send.mockResolvedValueOnce(caseWithLeg([{ legId: 'leg-1', direction: 'INBOUND' }]))
      .mockResolvedValueOnce({}).mockResolvedValueOnce(caseWithLeg([{}]));
    await updateLeg(evt('updateLeg', { caseId: 'lc-1', legId: 'leg-1', input: JSON.stringify({ customsStatus: 'RELEASED' }) }));
    const upd = send.mock.calls[1][0].input;
    expect(upd.ExpressionAttributeValues[':legs'][0].customsStatus).toBe('RELEASED');
  });

  it('updateLeg throws when leg id not found', async () => {
    send.mockResolvedValueOnce(caseWithLeg([{ legId: 'leg-1' }]));
    await expect(updateLeg(evt('updateLeg', { caseId: 'lc-1', legId: 'nope', input: '{}' })))
      .rejects.toThrow(/leg not found/i);
  });

  it('removeLeg drops the leg by id', async () => {
    send.mockResolvedValueOnce(caseWithLeg([{ legId: 'leg-1' }, { legId: 'leg-2' }]))
      .mockResolvedValueOnce({}).mockResolvedValueOnce(caseWithLeg([{}]));
    await removeLeg(evt('removeLeg', { caseId: 'lc-1', legId: 'leg-1' }));
    const upd = send.mock.calls[1][0].input;
    expect(upd.ExpressionAttributeValues[':legs']).toHaveLength(1);
    expect(upd.ExpressionAttributeValues[':legs'][0].legId).toBe('leg-2');
  });

  it('removeLeg throws when leg id not found (no silent success)', async () => {
    send.mockResolvedValueOnce(caseWithLeg([{ legId: 'leg-1' }]));
    await expect(removeLeg(evt('removeLeg', { caseId: 'lc-1', legId: 'nope' })))
      .rejects.toThrow(/leg not found/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run amplify/functions/logistics-api/resolvers/legMutations.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `amplify/functions/logistics-api/resolvers/legMutations.ts`:

```typescript
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../lib/dynamodb.js';
import { fetchCase, buildCaseResponse } from '../lib/caseHelper.js';
import { generateLegId } from '../lib/idGenerators.js';
import type { AppSyncEvent, ShipmentLeg } from '../lib/types.js';
import { LEG_DIRECTIONS, CUSTOMS_STATUSES, type LegDirection, type CustomsStatus } from '../lib/stages.js';

const LEG_FIELDS = [
  'direction', 'customsRequired', 'customsStatus', 'carrier', 'trackingNumber', 'trackingUrl',
  'freightForwarder', 'blOrAwb', 'containerNo', 'declaredValueUSD', 'hsCode',
  'shippedAt', 'clearedAt', 'deliveredAt',
] as const;

function validateLegInput(input: Record<string, unknown>): void {
  if (input.direction !== undefined
    && !LEG_DIRECTIONS.includes(input.direction as LegDirection)) {
    throw new Error(`direction must be one of: ${LEG_DIRECTIONS.join(', ')}`);
  }
  if (input.customsStatus !== undefined
    && !CUSTOMS_STATUSES.includes(input.customsStatus as CustomsStatus)) {
    throw new Error(`customsStatus must be one of: ${CUSTOMS_STATUSES.join(', ')}`);
  }
}

function pickLegFields(input: Record<string, unknown>): Partial<ShipmentLeg> {
  const out: Record<string, unknown> = {};
  for (const f of LEG_FIELDS) if (input[f] !== undefined) out[f] = input[f];
  return out as Partial<ShipmentLeg>;
}

async function persistLegs(caseId: string, legs: ShipmentLeg[]) {
  const now = new Date().toISOString();
  await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME(),
    Key: { PK: `LOGISTICS#${caseId}`, SK: 'META' },
    UpdateExpression: 'SET legs = :legs, updatedAt = :now, GSI1SK = :gsi1sk',
    ExpressionAttributeValues: { ':legs': legs, ':now': now, ':gsi1sk': `${now}#${caseId}` },
  }));
  return buildCaseResponse(caseId);
}

export async function addLeg(event: AppSyncEvent) {
  const { caseId, input: raw } = event.arguments as { caseId?: string; input: string | Record<string, unknown> };
  if (!caseId) throw new Error('caseId is required');
  const input: Record<string, unknown> = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (!input.direction) throw new Error('direction is required');
  validateLegInput(input);

  const current = await fetchCase(caseId);
  if (!current) throw new Error(`Logistics case not found: ${caseId}`);

  const leg: ShipmentLeg = { legId: generateLegId(), direction: input.direction as LegDirection, ...pickLegFields(input) };
  return persistLegs(caseId, [...(current.legs || []), leg]);
}

export async function updateLeg(event: AppSyncEvent) {
  const { caseId, legId, input: raw } = event.arguments as {
    caseId?: string; legId?: string; input: string | Record<string, unknown>;
  };
  if (!caseId || !legId) throw new Error('caseId and legId are required');
  const input: Record<string, unknown> = typeof raw === 'string' ? JSON.parse(raw) : raw;
  validateLegInput(input);

  const current = await fetchCase(caseId);
  if (!current) throw new Error(`Logistics case not found: ${caseId}`);
  const legs = current.legs || [];
  const idx = legs.findIndex((l) => l.legId === legId);
  if (idx === -1) throw new Error(`Leg not found: ${legId}`);

  legs[idx] = { ...legs[idx], ...pickLegFields(input) };
  return persistLegs(caseId, legs);
}

export async function removeLeg(event: AppSyncEvent) {
  const { caseId, legId } = event.arguments as { caseId?: string; legId?: string };
  if (!caseId || !legId) throw new Error('caseId and legId are required');

  const current = await fetchCase(caseId);
  if (!current) throw new Error(`Logistics case not found: ${caseId}`);
  const existing = current.legs || [];
  if (!existing.some((l) => l.legId === legId)) throw new Error(`Leg not found: ${legId}`);
  return persistLegs(caseId, existing.filter((l) => l.legId !== legId));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run amplify/functions/logistics-api/resolvers/legMutations.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add amplify/functions/logistics-api/resolvers/legMutations.ts amplify/functions/logistics-api/resolvers/legMutations.test.ts
git commit -m "feat(logistics): add/update/remove embedded shipment legs"
```

---

## Task 11: `logisticsStats` resolver

**Files:**
- Create: `amplify/functions/logistics-api/resolvers/logisticsStats.ts`
- Test: `amplify/functions/logistics-api/resolvers/logisticsStats.test.ts`

**Queries** the `LOGISTICS_CASES` listing partition (same as the list — no Scan); returns counts by `caseType`, counts by `currentStage`, count of customs-in-progress cases (`currentStage` in {EXPORT_CUSTOMS, IMPORT_CUSTOMS, CUSTOMS_HOLD}), and count of stalled cases (non-terminal `currentStage`, `updatedAt` older than 14 days).

- [ ] **Step 1: Write the failing test**

Create `amplify/functions/logistics-api/resolvers/logisticsStats.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';

const send = vi.fn();
vi.mock('../lib/dynamodb.js', () => ({
  docClient: { send: (...a: unknown[]) => send(...a) },
  TABLE_NAME: () => 'TestTable',
}));

import { logisticsStats } from './logisticsStats.js';

beforeEach(() => send.mockReset());

describe('logisticsStats', () => {
  it('aggregates counts by type, stage, customs, and stalled via a GSI1 Query', async () => {
    const old = '2020-01-01T00:00:00Z';
    send.mockResolvedValueOnce({
      Items: [
        { caseType: 'EQUIPMENT', currentStage: 'IMPORT_CUSTOMS', updatedAt: old },
        { caseType: 'SAMPLE', currentStage: 'TESTING', updatedAt: new Date().toISOString() },
        { caseType: 'SAMPLE', currentStage: 'CLOSED', updatedAt: old },
      ],
      LastEvaluatedKey: undefined,
    });
    const s = await logisticsStats({ info: { fieldName: 'logisticsStats', parentTypeName: 'Query' }, arguments: {} });
    expect(send.mock.calls[0][0]).toBeInstanceOf(QueryCommand);
    const byType = JSON.parse(s.byType);
    const byStage = JSON.parse(s.byStage);
    expect(byType.SAMPLE).toBe(2);
    expect(byStage.IMPORT_CUSTOMS).toBe(1);
    expect(s.customsInProgress).toBe(1);
    expect(s.stalledCases).toBe(1); // EQUIPMENT/IMPORT_CUSTOMS is old & non-terminal; CLOSED excluded
    expect(s.totalActive).toBe(2);  // CLOSED excluded
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run amplify/functions/logistics-api/resolvers/logisticsStats.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `amplify/functions/logistics-api/resolvers/logisticsStats.ts`:

```typescript
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../lib/dynamodb.js';
import type { AppSyncEvent } from '../lib/types.js';

const CUSTOMS_STAGES = new Set(['EXPORT_CUSTOMS', 'IMPORT_CUSTOMS', 'CUSTOMS_HOLD']);
const TERMINAL_STAGES = new Set(['CLOSED', 'CANCELLED']);
const STALLED_DAYS = 14;
const MAX_PAGES = 20;

export async function logisticsStats(_event: AppSyncEvent) {
  // Query the single listing partition — never Scan.
  const items: Record<string, unknown>[] = [];
  let key: Record<string, unknown> | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const r = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME(),
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: { ':pk': 'LOGISTICS_CASES' },
      ExclusiveStartKey: key,
    }));
    items.push(...(r.Items || []));
    key = r.LastEvaluatedKey;
    if (!key) break;
  }

  const byType: Record<string, number> = {};
  const byStage: Record<string, number> = {};
  let customsInProgress = 0;
  let stalledCases = 0;
  let totalActive = 0;

  const cutoff = Date.now() - STALLED_DAYS * 86_400_000;

  for (const it of items) {
    const type = it.caseType as string;
    const stage = it.currentStage as string;
    byType[type] = (byType[type] || 0) + 1;
    byStage[stage] = (byStage[stage] || 0) + 1;
    if (CUSTOMS_STAGES.has(stage)) customsInProgress += 1;
    if (!TERMINAL_STAGES.has(stage)) {
      totalActive += 1;
      const updated = Date.parse((it.updatedAt as string) || '');
      if (!Number.isNaN(updated) && updated < cutoff) stalledCases += 1;
    }
  }

  return {
    totalActive,
    byType: JSON.stringify(byType),
    byStage: JSON.stringify(byStage),
    customsInProgress,
    stalledCases,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run amplify/functions/logistics-api/resolvers/logisticsStats.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add amplify/functions/logistics-api/resolvers/logisticsStats.ts amplify/functions/logistics-api/resolvers/logisticsStats.test.ts
git commit -m "feat(logistics): logisticsStats aggregation resolver"
```

---

## Task 12: Lambda handler + resource (`handler.ts`, `resource.ts`, `package.json`)

**Files:**
- Create: `amplify/functions/logistics-api/handler.ts`
- Create: `amplify/functions/logistics-api/resource.ts`
- Create: `amplify/functions/logistics-api/package.json`

No new unit test (the handler is a dispatch shim covered by resolver tests). Verified by typecheck in Task 14.

- [ ] **Step 1: Create `package.json`**

Create `amplify/functions/logistics-api/package.json` (copy of order-api):

```json
{
  "name": "logistics-api",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "@aws-sdk/client-dynamodb": "^3.0.0",
    "@aws-sdk/lib-dynamodb": "^3.0.0"
  }
}
```

- [ ] **Step 2: Create `resource.ts`**

Create `amplify/functions/logistics-api/resource.ts`:

```typescript
import { defineFunction } from '@aws-amplify/backend';

export const logisticsApi = defineFunction({
  name: 'logistics-api',
  entry: './handler.ts',
  runtime: 22,
  timeoutSeconds: 30,
  memoryMB: 512,
});
```

- [ ] **Step 3: Create `handler.ts`**

Create `amplify/functions/logistics-api/handler.ts`:

```typescript
import { createLogisticsCase } from './resolvers/createLogisticsCase.js';
import { getLogisticsCase } from './resolvers/getLogisticsCase.js';
import { listLogisticsCases } from './resolvers/listLogisticsCases.js';
import { advanceLogisticsStage } from './resolvers/advanceLogisticsStage.js';
import { updateLogisticsCase } from './resolvers/updateLogisticsCase.js';
import { addLeg, updateLeg, removeLeg } from './resolvers/legMutations.js';
import { logisticsStats } from './resolvers/logisticsStats.js';

const resolvers: Record<string, (event: any) => Promise<any>> = {
  listLogisticsCases,
  getLogisticsCase,
  logisticsStats,
  createLogisticsCase,
  updateLogisticsCase,
  advanceLogisticsStage,
  addLeg,
  updateLeg,
  removeLeg,
};

export const handler = async (event: any) => {
  const fieldName = event.info?.fieldName ?? event.fieldName;
  if (!fieldName) {
    console.error('logistics-api: full event:', JSON.stringify(event));
    throw new Error(`Cannot determine fieldName. Event keys: ${Object.keys(event).join(', ')}`);
  }

  const resolver = resolvers[fieldName];
  if (!resolver) throw new Error(`No resolver for field: ${fieldName}`);

  const normalizedEvent = event.info
    ? event
    : { ...event, info: { fieldName, parentTypeName: event.typeName }, arguments: event.arguments };

  return resolver(normalizedEvent);
};
```

- [ ] **Step 4: Verify it typechecks**

Run: `npx tsc --noEmit -p amplify/functions/logistics-api/tsconfig.json 2>/dev/null || npx tsc --noEmit`
Expected: no errors in `amplify/functions/logistics-api/**`. (If order-api has no per-function tsconfig, the repo-level typecheck in Task 14 covers this — proceed.)

- [ ] **Step 5: Commit**

```bash
git add amplify/functions/logistics-api/handler.ts amplify/functions/logistics-api/resource.ts amplify/functions/logistics-api/package.json
git commit -m "feat(logistics): lambda handler dispatch + function resource"
```

---

## Task 13: AppSync schema — enums, custom types, queries, mutations

**Files:**
- Modify: `amplify/data/resource.ts`

Add to the schema object, following the existing Order block style. **Custom types must be added before the queries/mutations that reference them.** Place enums + custom types near the Order block (after line ~290), and the queries/mutations in their respective sections (after the Order queries ~590 / mutations ~800).

- [ ] **Step 1: Add enums + custom types**

In `amplify/data/resource.ts`, after the `OrderStats`/related custom types block, add:

```typescript
  // =========================================================================
  // Logistics Cases — internal cross-border delivery & customs ledger
  // =========================================================================

  CaseType: a.enum(['SAMPLE', 'EQUIPMENT', 'SPARE_PART', 'RMA', 'DEMO']),

  LegDirection: a.enum(['INBOUND', 'OUTBOUND', 'RETURN', 'DOMESTIC_TRANSFER']),

  CustomsStatus: a.enum([
    'NOT_REQUIRED', 'DOCS_READY', 'FILED', 'EXAM', 'HELD', 'RELEASED', 'DUTIES_PAID', 'CLEARED',
  ]),

  RelatedEntityType: a.enum(['ORDER', 'LEAD', 'SAMPLE_PROJECT', 'CUSTOMER', 'SERVICE_CASE']),

  LogisticsStage: a.enum([
    'DRAFT', 'AWAITING_SHIPMENT', 'IN_TRANSIT', 'EXPORT_CUSTOMS', 'IMPORT_CUSTOMS',
    'CUSTOMS_HOLD', 'RECEIVED', 'TESTING', 'REPORT_ISSUED', 'READY_TO_RETURN',
    'RETURN_IN_TRANSIT', 'RETURNED', 'PRODUCTION', 'FAT_SCHEDULED', 'FAT_PASSED',
    'READY_TO_SHIP', 'DELIVERED', 'INSTALLATION_SCHEDULED', 'INSTALLED', 'ACCEPTED',
    'CLOSED', 'CANCELLED',
  ]),

  ShipmentLeg: a.customType({
    legId: a.id().required(),
    direction: a.ref('LegDirection').required(),
    customsRequired: a.boolean(),
    customsStatus: a.ref('CustomsStatus'),
    carrier: a.string(),
    trackingNumber: a.string(),
    trackingUrl: a.string(),
    freightForwarder: a.string(),
    blOrAwb: a.string(),
    containerNo: a.string(),
    declaredValueUSD: a.float(),
    hsCode: a.string(),
    shippedAt: a.datetime(),
    clearedAt: a.datetime(),
    deliveredAt: a.datetime(),
  }),

  LogisticsLogEntry: a.customType({
    action: a.string().required(),
    fromStage: a.ref('LogisticsStage'),
    toStage: a.ref('LogisticsStage'),
    operator: a.string().required(),
    timestamp: a.datetime().required(),
    detail: a.string(),
    internalOnly: a.boolean().required(),
  }),

  LogisticsCase: a.customType({
    caseId: a.id().required(),
    caseNumber: a.string().required(),
    caseType: a.ref('CaseType').required(),
    relatedOrderId: a.string(),
    relatedEntityType: a.ref('RelatedEntityType'),
    relatedEntityId: a.string(),
    customerName: a.string().required(),
    contactName: a.string(),
    customsRequired: a.boolean().required(),
    currentStage: a.ref('LogisticsStage').required(),
    enabledStages: a.ref('LogisticsStage').array().required(),
    legs: a.ref('ShipmentLeg').array(),
    milestoneLog: a.ref('LogisticsLogEntry').array(),
    isCustomerVisible: a.boolean().required(),
    publicToken: a.string(),
    notes: a.string(),
    createdAt: a.datetime().required(),
    updatedAt: a.datetime().required(),
    createdBy: a.string().required(),
  }),

  LogisticsCaseConnection: a.customType({
    items: a.ref('LogisticsCase').array().required(),
    nextToken: a.string(),
  }),

  LogisticsStats: a.customType({
    totalActive: a.integer().required(),
    byType: a.json().required(),
    byStage: a.json().required(),
    customsInProgress: a.integer().required(),
    stalledCases: a.integer().required(),
  }),
```

- [ ] **Step 2: Add the function import + queries**

At the top of `amplify/data/resource.ts`, add the import alongside the other function imports:

```typescript
import { logisticsApi } from '../functions/logistics-api/resource';
```

In the Queries section (near the Order queries), add:

```typescript
  listLogisticsCases: a
    .query()
    .arguments({
      stage: a.ref('LogisticsStage'),
      caseType: a.ref('CaseType'),
      customsRequired: a.boolean(),
      search: a.string(),
      limit: a.integer(),
      nextToken: a.string(),
    })
    .returns(a.ref('LogisticsCaseConnection').required())
    .handler(a.handler.function(logisticsApi))
    .authorization((allow) => [allow.authenticated()]),

  getLogisticsCase: a
    .query()
    .arguments({ caseId: a.id().required() })
    .returns(a.ref('LogisticsCase'))
    .handler(a.handler.function(logisticsApi))
    .authorization((allow) => [allow.authenticated()]),

  logisticsStats: a
    .query()
    .returns(a.ref('LogisticsStats').required())
    .handler(a.handler.function(logisticsApi))
    .authorization((allow) => [allow.authenticated()]),
```

- [ ] **Step 3: Add the mutations**

In the Mutations section (near the Order mutations), add:

```typescript
  createLogisticsCase: a
    .mutation()
    .arguments({ input: a.json().required() })
    .returns(a.ref('LogisticsCase').required())
    .handler(a.handler.function(logisticsApi))
    .authorization((allow) => [allow.authenticated()]),

  updateLogisticsCase: a
    .mutation()
    .arguments({ caseId: a.id().required(), input: a.json().required() })
    .returns(a.ref('LogisticsCase').required())
    .handler(a.handler.function(logisticsApi))
    .authorization((allow) => [allow.authenticated()]),

  advanceLogisticsStage: a
    .mutation()
    .arguments({
      caseId: a.id().required(),
      targetStage: a.ref('LogisticsStage').required(),
      detail: a.string(),
      internalOnly: a.boolean(),
    })
    .returns(a.ref('LogisticsCase').required())
    .handler(a.handler.function(logisticsApi))
    .authorization((allow) => [allow.authenticated()]),

  addLeg: a
    .mutation()
    .arguments({ caseId: a.id().required(), input: a.json().required() })
    .returns(a.ref('LogisticsCase').required())
    .handler(a.handler.function(logisticsApi))
    .authorization((allow) => [allow.authenticated()]),

  updateLeg: a
    .mutation()
    .arguments({ caseId: a.id().required(), legId: a.id().required(), input: a.json().required() })
    .returns(a.ref('LogisticsCase').required())
    .handler(a.handler.function(logisticsApi))
    .authorization((allow) => [allow.authenticated()]),

  removeLeg: a
    .mutation()
    .arguments({ caseId: a.id().required(), legId: a.id().required() })
    .returns(a.ref('LogisticsCase').required())
    .handler(a.handler.function(logisticsApi))
    .authorization((allow) => [allow.authenticated()]),
```

- [ ] **Step 4: Typecheck the schema**

Run: `npx tsc --noEmit`
Expected: no new errors referencing `LogisticsCase`, `logisticsApi`, or the new ops. (Pre-existing unrelated failures may exist — confirm none are in `amplify/data/resource.ts` or logistics files.)

- [ ] **Step 5: Commit**

```bash
git add amplify/data/resource.ts
git commit -m "feat(logistics): AppSync schema — types, queries, mutations"
```

---

## Task 14: Backend wiring (`amplify/backend.ts`)

**Files:**
- Modify: `amplify/backend.ts`

- [ ] **Step 1: Register the function in `defineBackend`**

Add the import near the other function imports (top of file, alongside `orderApi`):

```typescript
import { logisticsApi } from './functions/logistics-api/resource';
```

Add `logisticsApi,` to the `defineBackend({ ... })` object (near `orderApi,`).

- [ ] **Step 2: Grant table access + env**

After the existing `backend.orderApi` grant block (~line 520), add:

```typescript
intelligenceTable.grantReadWriteData(backend.logisticsApi.resources.lambda);
backend.logisticsApi.addEnvironment('INTELLIGENCE_TABLE', intelligenceTable.tableName);
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors in `amplify/backend.ts`.

- [ ] **Step 4: Full logistics test sweep**

Run: `npx vitest run amplify/functions/logistics-api`
Expected: PASS — all resolver + lib tests green.

- [ ] **Step 5: Commit**

```bash
git add amplify/backend.ts
git commit -m "feat(logistics): wire logistics-api to intelligence table"
```

---

## Task 15: Frontend service (`logisticsAdminService.ts`)

**Files:**
- Create: `src/services/logisticsAdminService.ts`
- Test: `src/services/logisticsAdminService.test.ts`

Mirrors `orderAdminService.ts`: thin wrappers over the generated client, `userPool` auth, error unwrapping.

- [ ] **Step 1: Write the failing test**

Create `src/services/logisticsAdminService.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const queries = {
  listLogisticsCases: vi.fn(),
  getLogisticsCase: vi.fn(),
  logisticsStats: vi.fn(),
};
const mutations = {
  createLogisticsCase: vi.fn(),
  advanceLogisticsStage: vi.fn(),
};

vi.mock('./amplifyClient', () => ({
  getAmplifyDataClient: () => ({ queries, mutations }),
}));

import { listLogisticsCases, createLogisticsCase, advanceLogisticsStage } from './logisticsAdminService.js';

beforeEach(() => {
  Object.values(queries).forEach((f) => f.mockReset());
  Object.values(mutations).forEach((f) => f.mockReset());
});

describe('logisticsAdminService', () => {
  it('listLogisticsCases passes through filters and returns data', async () => {
    queries.listLogisticsCases.mockResolvedValueOnce({ data: { items: [], nextToken: null }, errors: null });
    const res = await listLogisticsCases({ caseType: 'SAMPLE' });
    expect(queries.listLogisticsCases).toHaveBeenCalledWith({ caseType: 'SAMPLE' }, { authMode: 'userPool' });
    expect(res?.items).toEqual([]);
  });

  it('createLogisticsCase JSON-stringifies the input', async () => {
    mutations.createLogisticsCase.mockResolvedValueOnce({ data: { caseId: 'lc-1' }, errors: null });
    await createLogisticsCase({ caseType: 'EQUIPMENT', customerName: 'HORIBA' });
    const arg = mutations.createLogisticsCase.mock.calls[0][0];
    expect(typeof arg.input).toBe('string');
    expect(JSON.parse(arg.input).customerName).toBe('HORIBA');
  });

  it('throws when the API returns errors', async () => {
    mutations.advanceLogisticsStage.mockResolvedValueOnce({ data: null, errors: [{ message: 'nope' }] });
    await expect(advanceLogisticsStage('lc-1', 'PRODUCTION')).rejects.toThrow('nope');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/services/logisticsAdminService.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `src/services/logisticsAdminService.ts`:

```typescript
import { getAmplifyDataClient } from './amplifyClient';

const client = getAmplifyDataClient;
const AUTH = { authMode: 'userPool' as const };

interface ListLogisticsArgs {
  stage?: string;
  caseType?: string;
  customsRequired?: boolean;
  search?: string;
  limit?: number;
  nextToken?: string;
}

export async function listLogisticsCases(opts: ListLogisticsArgs = {}) {
  const args: Record<string, unknown> = {};
  if (opts.stage) args.stage = opts.stage;
  if (opts.caseType) args.caseType = opts.caseType;
  if (opts.customsRequired !== undefined) args.customsRequired = opts.customsRequired;
  if (opts.search) args.search = opts.search;
  if (opts.limit) args.limit = opts.limit;
  if (opts.nextToken) args.nextToken = opts.nextToken;
  const { data, errors } = await client().queries.listLogisticsCases(args as any, AUTH);
  if (errors?.length) throw new Error(errors.map((e) => e.message).join(', '));
  return data;
}

export async function getLogisticsCase(caseId: string) {
  const { data, errors } = await client().queries.getLogisticsCase({ caseId } as any, AUTH);
  if (errors?.length) throw new Error(errors.map((e) => e.message).join(', '));
  return data;
}

export async function fetchLogisticsStats() {
  const { data, errors } = await client().queries.logisticsStats(AUTH as any);
  if (errors?.length) throw new Error(errors.map((e) => e.message).join(', '));
  return data;
}

export async function createLogisticsCase(input: Record<string, unknown>) {
  const { data, errors } = await client().mutations.createLogisticsCase(
    { input: JSON.stringify(input) } as any, AUTH,
  );
  if (errors?.length) throw new Error(errors.map((e) => e.message).join(', '));
  return data;
}

export async function updateLogisticsCase(caseId: string, input: Record<string, unknown>) {
  const { data, errors } = await client().mutations.updateLogisticsCase(
    { caseId, input: JSON.stringify(input) } as any, AUTH,
  );
  if (errors?.length) throw new Error(errors.map((e) => e.message).join(', '));
  return data;
}

export async function advanceLogisticsStage(
  caseId: string, targetStage: string, detail?: string, internalOnly?: boolean,
) {
  const { data, errors } = await client().mutations.advanceLogisticsStage(
    { caseId, targetStage, detail, internalOnly } as any, AUTH,
  );
  if (errors?.length) throw new Error(errors.map((e) => e.message).join(', '));
  return data;
}

export async function addLeg(caseId: string, input: Record<string, unknown>) {
  const { data, errors } = await client().mutations.addLeg(
    { caseId, input: JSON.stringify(input) } as any, AUTH,
  );
  if (errors?.length) throw new Error(errors.map((e) => e.message).join(', '));
  return data;
}

export async function updateLeg(caseId: string, legId: string, input: Record<string, unknown>) {
  const { data, errors } = await client().mutations.updateLeg(
    { caseId, legId, input: JSON.stringify(input) } as any, AUTH,
  );
  if (errors?.length) throw new Error(errors.map((e) => e.message).join(', '));
  return data;
}

export async function removeLeg(caseId: string, legId: string) {
  const { data, errors } = await client().mutations.removeLeg({ caseId, legId } as any, AUTH);
  if (errors?.length) throw new Error(errors.map((e) => e.message).join(', '));
  return data;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/services/logisticsAdminService.test.ts`
Expected: PASS (3 tests). Note: the `createLogisticsCase` test asserts `mutations` is reached; if the generated client types are unavailable at test time, the `as any` casts keep this compiling.

- [ ] **Step 5: Commit**

```bash
git add src/services/logisticsAdminService.ts src/services/logisticsAdminService.test.ts
git commit -m "feat(logistics): frontend admin service layer"
```

---

## Task 16: Final verification sweep

**Files:** none (verification only)

- [ ] **Step 1: Run the full logistics test set**

Run: `npx vitest run amplify/functions/logistics-api src/services/logisticsAdminService.test.ts`
Expected: ALL PASS.

- [ ] **Step 2: Typecheck the whole repo**

Run: `npx tsc --noEmit`
Expected: no NEW errors attributable to logistics files. (Compare against the known pre-existing failures noted in project memory; if any new error references a logistics path, fix it before proceeding.)

- [ ] **Step 3: Lint the new files**

Run: `npx eslint amplify/functions/logistics-api src/services/logisticsAdminService.ts`
Expected: clean (or only pre-existing rule exceptions consistent with order-api).

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "chore(logistics): verification sweep fixes" || echo "nothing to commit"
```

---

## Done — Backend Complete

At this point the Logistics Cases **API + data layer** is implemented and unit-tested. Deploying the Amplify backend (`npx ampx sandbox` / pipeline) provisions the schema; the generated client then exposes the new queries/mutations to the frontend.

**Next:** Plan 2 (Admin UI) — `useLogisticsCases` / `useLogisticsStats` hooks, `src/types/admin` logistics types, `LogisticsCaseListPage`, `LogisticsCaseDetailPage` (milestone progress bar over `enabledStages`, legs table, milestone-log timeline), `CreateLogisticsCasePage`, and route + admin-nav registration. To be authored once this backend is merged and the client types are generated.
