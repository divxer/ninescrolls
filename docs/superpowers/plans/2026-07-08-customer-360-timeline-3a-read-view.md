# Customer 360 Timeline — Plan 3A (Read View) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface the materialized `TimelineEvent` model as a unified, reverse-chronological Customer 360 timeline on the admin Organization detail page, replacing the old per-entity RFQ/Orders/Leads tabs.

**Architecture:** A new `timelineByOrg` AppSync query (crm-api's first AppSync resolver) queries GSI2 (`ORG#<orgId>`, scoped to `TLEVENT#` via a key condition), maps each `TimelineEventItem` to a display-friendly `OrganizationTimelineItem`, and paginates via an opaque token. The frontend renders medium-density timeline cards with client-side source chips; the "Show internal" toggle refetches with a server param. A one-time pre-launch catch-up loops the existing cold reconciliation sweep so history is materialized before the default view flips.

**Tech Stack:** AWS Amplify Gen2, AppSync (`a.query`/`a.customType`), DynamoDB single table (`INTELLIGENCE_TABLE`, GSI2), `@aws-sdk/lib-dynamodb`, React + Amplify data client, vitest + @testing-library/react.

**Spec:** `docs/superpowers/specs/2026-07-08-customer-360-timeline-3a-read-view-design.md`

**Worktree/branch:** `feature/customer-360-timeline-3a` (isolated worktree off latest `origin/main`).

**Conventions verified in-repo:**
- DDB access: `import { QueryCommand } from '@aws-sdk/lib-dynamodb'; import { docClient, TABLE_NAME } from '../dynamodb';` then `docClient.send(new QueryCommand({...}))`. GSI2 physical index name is `'GSI2'` (see `lib/orgStore.ts`).
- Test mock: `vi.mock('../dynamodb', () => ({ docClient: { send: (...a: unknown[]) => mockSend(...a) }, TABLE_NAME: () => 'T' }));`
- `TimelineEventItem` fields (see `lib/types.ts`): `id, orgId, occurredAt, source, kind, summary, resolutionStatus, resolutionReason, confidence, isInternalOnly, voided, sourceEntityType, sourceEntityId, payload`.
- Per-kind stored `payload` (from `amplify/lib/crm/emit-builders.ts` + `lib/analytics/materializeSession.ts`):
  - `rfq_submitted`: `{ equipmentCategory, specificModel }`, summary `"Submitted RFQ — …"`
  - `lead_captured`: `{ type, productName }`
  - `order_created`: `{ rfqId, productModel }`, summary `"Order created[ from RFQ] — …"`
  - `order_stage_changed`: `{ fromStatus, toStatus }`, summary `"Order → <toStatus>"`
  - `quote_sent`: `{ orderId, fileName }`, summary `"Quote sent — <fileName>"`
  - logistics milestone: `{ fromStage, toStage }`
  - `site_visit_session`: `{ visitorId, pageCount, topPaths, productPagesViewed, downloads, returnVisit, activeSeconds, orgNameDisplay? }`, summary `"Site visit — N page(s) (org)"`
  - **No kind stores a monetary amount** → the item has no `amountUSD` field.
- Frontend service pattern (`src/services/organizationAdminService.ts`): `const { data, errors } = await client().queries.<name>(args, AUTH);` where `AUTH = { authMode: 'userPool' as const }`.
- Frontend hook pattern (`src/hooks/useOrganization.ts`): `useState`/`useEffect`/`useCallback`.

---

## Shared type (defined in Task 1, imported everywhere)

```ts
// amplify/functions/crm-api/lib/read/organizationTimelineItem.ts
export type ResolutionTone = 'confirmed' | 'domain-match' | 'inferred' | 'unknown';
export type TimelineChipGroup = 'rfq' | 'lead' | 'order' | 'quote' | 'logistics' | 'site_visits' | 'other';

export interface OrganizationTimelineItem {
  id: string;
  occurredAt: string;
  source: string;
  kind: string;
  sourceFilterGroup: TimelineChipGroup;
  icon: string;
  tone: ResolutionTone;
  primaryLabel: string;            // = stored summary; frontend fallback for unknown kinds
  resolutionStatus: string;
  resolutionReason: string;
  confidence: number | null;       // only for inferred/unknown tiers; else null
  isInternalOnly: boolean;
  productModel: string | null;
  specificModel: string | null;
  equipmentCategory: string | null;
  leadType: string | null;
  productName: string | null;
  stageFrom: string | null;
  stageTo: string | null;
  fileName: string | null;
  pageCount: number | null;
  activeSeconds: number | null;
  topPaths: string[] | null;
  sourceEntityType: string;
  sourceEntityId: string;
  payload: Record<string, unknown> | null;
}
```

---

## Task 1: `OrganizationTimelineItem` type + pure mapper

**Files:**
- Create: `amplify/functions/crm-api/lib/read/organizationTimelineItem.ts`
- Test: `amplify/functions/crm-api/lib/read/organizationTimelineItem.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { toOrganizationTimelineItem } from './organizationTimelineItem';

const base = {
  id: 'tev-1', orgId: 'acme.com', occurredAt: '2026-03-01T00:00:00Z',
  resolutionStatus: 'resolved', resolutionReason: 'existing_matchedOrgId', confidence: 1,
  isInternalOnly: false, voided: false, sourceEntityType: 'order', sourceEntityId: 'ord-1',
  summary: 'Order created — XPS-9', payload: { rfqId: 'rfq-9', productModel: 'XPS-9' },
} as never;

describe('toOrganizationTimelineItem', () => {
  it('maps identity/label/group/icon and gates confidence off for confirmed', () => {
    const r = toOrganizationTimelineItem({ ...base, source: 'order', kind: 'order_created' });
    expect(r).toMatchObject({
      id: 'tev-1', occurredAt: '2026-03-01T00:00:00Z', kind: 'order_created',
      sourceFilterGroup: 'order', icon: 'order', tone: 'confirmed',
      primaryLabel: 'Order created — XPS-9', productModel: 'XPS-9', confidence: null,
      sourceEntityType: 'order', sourceEntityId: 'ord-1',
    });
  });

  it('domain-match tone for email_domain_exact', () => {
    const r = toOrganizationTimelineItem({ ...base, source: 'rfq', kind: 'rfq_submitted', resolutionReason: 'email_domain_exact', payload: { equipmentCategory: 'ICP', specificModel: 'X' } } as never);
    expect(r.tone).toBe('domain-match');
    expect(r.sourceFilterGroup).toBe('rfq');
    expect(r.equipmentCategory).toBe('ICP');
  });

  it('inferred tone SHOWS confidence for visitor_prior_event (analytics)', () => {
    const r = toOrganizationTimelineItem({ ...base, source: 'analytics', kind: 'site_visit_session', resolutionReason: 'visitor_prior_event', confidence: 0.72, payload: { pageCount: 3, activeSeconds: 240, topPaths: ['/a', '/b'] } } as never);
    expect(r).toMatchObject({ tone: 'inferred', sourceFilterGroup: 'site_visits', icon: 'site_visit', confidence: 0.72, pageCount: 3, activeSeconds: 240, topPaths: ['/a', '/b'] });
  });

  it('manually_linked status forces confirmed tone regardless of reason', () => {
    const r = toOrganizationTimelineItem({ ...base, source: 'order', kind: 'order_created', resolutionStatus: 'manually_linked', resolutionReason: 'visitor_prior_event' } as never);
    expect(r.tone).toBe('confirmed');
  });

  it('unknown reason → unknown tone (keeps confidence) and unknown source → other/event', () => {
    const r = toOrganizationTimelineItem({ ...base, source: 'gmail', kind: 'email_received', resolutionReason: 'weird', confidence: 0.4, payload: {} } as never);
    expect(r).toMatchObject({ tone: 'unknown', sourceFilterGroup: 'other', icon: 'event', confidence: 0.4 });
  });

  it('maps stage/logistics keys (fromStatus/toStatus OR fromStage/toStage)', () => {
    const a = toOrganizationTimelineItem({ ...base, source: 'order', kind: 'order_stage_changed', payload: { fromStatus: 'IN_PRODUCTION', toStatus: 'SHIPPED' } } as never);
    expect(a).toMatchObject({ stageFrom: 'IN_PRODUCTION', stageTo: 'SHIPPED' });
    const b = toOrganizationTimelineItem({ ...base, source: 'logistics', kind: 'logistics_milestone', payload: { fromStage: 'BOOKED', toStage: 'IN_TRANSIT' } } as never);
    expect(b).toMatchObject({ stageFrom: 'BOOKED', stageTo: 'IN_TRANSIT', sourceFilterGroup: 'logistics', icon: 'logistics' });
  });

  it('primaryLabel falls back to summary and payload passes through as escape hatch', () => {
    const r = toOrganizationTimelineItem({ ...base, source: 'quote', kind: 'quote_sent', summary: 'Quote sent — Q-014.pdf', payload: { orderId: 'ord-1', fileName: 'Q-014.pdf' } } as never);
    expect(r).toMatchObject({ primaryLabel: 'Quote sent — Q-014.pdf', fileName: 'Q-014.pdf', sourceFilterGroup: 'quote', payload: { orderId: 'ord-1', fileName: 'Q-014.pdf' } });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run amplify/functions/crm-api/lib/read/organizationTimelineItem.test.ts`
Expected: FAIL — `toOrganizationTimelineItem` is not defined (module missing).

- [ ] **Step 3: Write minimal implementation**

```ts
// amplify/functions/crm-api/lib/read/organizationTimelineItem.ts
export type ResolutionTone = 'confirmed' | 'domain-match' | 'inferred' | 'unknown';
export type TimelineChipGroup = 'rfq' | 'lead' | 'order' | 'quote' | 'logistics' | 'site_visits' | 'other';

export interface OrganizationTimelineItem {
  id: string; occurredAt: string; source: string; kind: string;
  sourceFilterGroup: TimelineChipGroup; icon: string; tone: ResolutionTone;
  primaryLabel: string; resolutionStatus: string; resolutionReason: string; confidence: number | null;
  isInternalOnly: boolean;
  productModel: string | null; specificModel: string | null; equipmentCategory: string | null;
  leadType: string | null; productName: string | null; stageFrom: string | null; stageTo: string | null;
  fileName: string | null; pageCount: number | null; activeSeconds: number | null; topPaths: string[] | null;
  sourceEntityType: string; sourceEntityId: string; payload: Record<string, unknown> | null;
}

// A stored timeline event as read from DynamoDB (subset this mapper depends on).
export interface StoredTimelineEvent {
  id: string; occurredAt: string; source: string; kind: string; summary: string;
  resolutionStatus: string; resolutionReason: string; confidence: number;
  isInternalOnly: boolean; sourceEntityType: string; sourceEntityId: string;
  payload: Record<string, unknown> | null;
}

const GROUP_BY_SOURCE: Record<string, TimelineChipGroup> = {
  rfq: 'rfq', lead: 'lead', order: 'order', quote: 'quote', logistics: 'logistics', analytics: 'site_visits',
};
const ICON_BY_SOURCE: Record<string, string> = {
  rfq: 'rfq', lead: 'lead', order: 'order', quote: 'quote', logistics: 'logistics', analytics: 'site_visit',
};

function toTone(reason: string, status: string): ResolutionTone {
  if (status === 'manually_linked') return 'confirmed';
  switch (reason) {
    case 'manual':
    case 'existing_matchedOrgId':
    case 'contact_email_exact': return 'confirmed';
    case 'email_domain_exact':
    case 'email_domain_new': return 'domain-match';
    case 'visitor_prior_event':
    case 'organization_name_match': return 'inferred';
    default: return 'unknown';
  }
}

const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const num = (v: unknown): number | null => (typeof v === 'number' ? v : null);
const strArr = (v: unknown): string[] | null =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : null;

export function toOrganizationTimelineItem(e: StoredTimelineEvent): OrganizationTimelineItem {
  const p = (e.payload ?? {}) as Record<string, unknown>;
  const tone = toTone(e.resolutionReason, e.resolutionStatus);
  return {
    id: e.id, occurredAt: e.occurredAt, source: e.source, kind: e.kind,
    sourceFilterGroup: GROUP_BY_SOURCE[e.source] ?? 'other',
    icon: ICON_BY_SOURCE[e.source] ?? 'event',
    tone,
    primaryLabel: e.summary,
    resolutionStatus: e.resolutionStatus, resolutionReason: e.resolutionReason,
    confidence: tone === 'inferred' || tone === 'unknown' ? e.confidence : null,
    isInternalOnly: e.isInternalOnly,
    productModel: str(p.productModel), specificModel: str(p.specificModel), equipmentCategory: str(p.equipmentCategory),
    leadType: str(p.type), productName: str(p.productName),
    stageFrom: str(p.fromStatus) ?? str(p.fromStage), stageTo: str(p.toStatus) ?? str(p.toStage),
    fileName: str(p.fileName), pageCount: num(p.pageCount), activeSeconds: num(p.activeSeconds), topPaths: strArr(p.topPaths),
    sourceEntityType: e.sourceEntityType, sourceEntityId: e.sourceEntityId,
    payload: e.payload,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run amplify/functions/crm-api/lib/read/organizationTimelineItem.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add amplify/functions/crm-api/lib/read/organizationTimelineItem.ts amplify/functions/crm-api/lib/read/organizationTimelineItem.test.ts
git commit -m "feat(crm-api): OrganizationTimelineItem type + pure mapper (3A)"
```

---

## Task 2: `timelineByOrg` GSI2 query

**Files:**
- Create: `amplify/functions/crm-api/lib/read/timelineByOrg.ts`
- Test: `amplify/functions/crm-api/lib/read/timelineByOrg.test.ts`

Contract: `timelineByOrg({ orgId, limit?, nextToken?, includeInternalOnly? }) → { items: StoredTimelineEvent[]; nextToken?: string }`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
const mockSend = vi.fn();
vi.mock('../dynamodb', () => ({ docClient: { send: (...a: unknown[]) => mockSend(...a) }, TABLE_NAME: () => 'T' }));
import { timelineByOrg, encodeToken, decodeToken } from './timelineByOrg';

beforeEach(() => mockSend.mockReset());
const input = () => mockSend.mock.calls[0][0].input;

describe('timelineByOrg query', () => {
  it('scopes to TLEVENT# via begins_with KEY condition (not entityType filter) and reads GSI2 descending', async () => {
    mockSend.mockResolvedValueOnce({ Items: [], LastEvaluatedKey: undefined });
    await timelineByOrg({ orgId: 'acme.com' });
    const q = input();
    expect(q.IndexName).toBe('GSI2');
    expect(q.KeyConditionExpression).toBe('GSI2PK = :pk AND begins_with(GSI2SK, :tl)');
    expect(q.ExpressionAttributeValues[':pk']).toBe('ORG#acme.com');
    expect(q.ExpressionAttributeValues[':tl']).toBe('TLEVENT#');
    expect(q.ScanIndexForward).toBe(false);
  });

  it('default view filters voided=false AND isInternalOnly=false', async () => {
    mockSend.mockResolvedValueOnce({ Items: [] });
    await timelineByOrg({ orgId: 'acme.com' });
    const q = input();
    expect(q.FilterExpression).toBe('voided = :false AND isInternalOnly = :false');
    expect(q.ExpressionAttributeValues[':false']).toBe(false);
  });

  it('includeInternalOnly=true drops the internal filter but keeps voided=false', async () => {
    mockSend.mockResolvedValueOnce({ Items: [] });
    await timelineByOrg({ orgId: 'acme.com', includeInternalOnly: true });
    const q = input();
    expect(q.FilterExpression).toBe('voided = :false');
  });

  it('clamps limit: default 50, max 100, min 1', async () => {
    mockSend.mockResolvedValue({ Items: [] });
    await timelineByOrg({ orgId: 'a' }); expect(input().Limit).toBe(50);
    mockSend.mockClear(); await timelineByOrg({ orgId: 'a', limit: 999 }); expect(input().Limit).toBe(100);
    mockSend.mockClear(); await timelineByOrg({ orgId: 'a', limit: 0 }); expect(input().Limit).toBe(1);
  });

  it('nextToken round-trips an opaque base64 of LastEvaluatedKey', async () => {
    const key = { GSI2PK: 'ORG#a', GSI2SK: 'TLEVENT#z', PK: 'TLEVENT#z', SK: 'A' };
    mockSend.mockResolvedValueOnce({ Items: [], LastEvaluatedKey: key });
    const out = await timelineByOrg({ orgId: 'a' });
    expect(out.nextToken).toBe(encodeToken(key));
    expect(decodeToken(out.nextToken!)).toEqual(key);
    mockSend.mockClear(); mockSend.mockResolvedValueOnce({ Items: [] });
    await timelineByOrg({ orgId: 'a', nextToken: out.nextToken });
    expect(input().ExclusiveStartKey).toEqual(key);
  });

  it('no LastEvaluatedKey → nextToken undefined (end of history)', async () => {
    mockSend.mockResolvedValueOnce({ Items: [{ id: 'tev-1' }] });
    const out = await timelineByOrg({ orgId: 'a' });
    expect(out.nextToken).toBeUndefined();
    expect(out.items).toEqual([{ id: 'tev-1' }]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run amplify/functions/crm-api/lib/read/timelineByOrg.test.ts`
Expected: FAIL — module/exports not defined.

- [ ] **Step 3: Write minimal implementation**

```ts
// amplify/functions/crm-api/lib/read/timelineByOrg.ts
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../dynamodb';
import type { StoredTimelineEvent } from './organizationTimelineItem';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const clampLimit = (n?: number) => Math.min(MAX_LIMIT, Math.max(1, n ?? DEFAULT_LIMIT));

export const encodeToken = (key: Record<string, unknown>): string =>
  Buffer.from(JSON.stringify(key), 'utf8').toString('base64');
export const decodeToken = (token: string): Record<string, unknown> =>
  JSON.parse(Buffer.from(token, 'base64').toString('utf8')) as Record<string, unknown>;

export async function timelineByOrg(args: {
  orgId: string; limit?: number; nextToken?: string; includeInternalOnly?: boolean;
}): Promise<{ items: StoredTimelineEvent[]; nextToken?: string }> {
  const values: Record<string, unknown> = { ':pk': `ORG#${args.orgId}`, ':tl': 'TLEVENT#', ':false': false };
  const filter = args.includeInternalOnly ? 'voided = :false' : 'voided = :false AND isInternalOnly = :false';
  const res = await docClient.send(new QueryCommand({
    TableName: TABLE_NAME(), IndexName: 'GSI2',
    KeyConditionExpression: 'GSI2PK = :pk AND begins_with(GSI2SK, :tl)',
    FilterExpression: filter,
    ExpressionAttributeValues: values,
    ScanIndexForward: false,
    Limit: clampLimit(args.limit),
    ExclusiveStartKey: args.nextToken ? decodeToken(args.nextToken) : undefined,
  }));
  const key = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  return {
    items: (res.Items ?? []) as StoredTimelineEvent[],
    nextToken: key ? encodeToken(key) : undefined,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run amplify/functions/crm-api/lib/read/timelineByOrg.test.ts`
Expected: PASS (6 tests). The first test is invariant (a): CONTACT/AUDIT items in the shared `ORG#<orgId>` partition are excluded at the **key condition** level (`begins_with(GSI2SK, 'TLEVENT#')`), never read.

- [ ] **Step 5: Commit**

```bash
git add amplify/functions/crm-api/lib/read/timelineByOrg.ts amplify/functions/crm-api/lib/read/timelineByOrg.test.ts
git commit -m "feat(crm-api): timelineByOrg GSI2 query (begins_with TLEVENT#, filters, opaque token) (3A)"
```

---

## Task 3: Wire `resolvers.timelineByOrg` in handler (keep direct-action path)

**Files:**
- Modify: `amplify/functions/crm-api/handler.ts`
- Test: `amplify/functions/crm-api/handler.test.ts` (add cases)

- [ ] **Step 1: Write the failing test** (append to `handler.test.ts`)

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
const timelineByOrgMock = vi.fn();
vi.mock('./lib/read/timelineByOrg', () => ({ timelineByOrg: (a: unknown) => timelineByOrgMock(a) }));
import { handler } from './handler';

beforeEach(() => timelineByOrgMock.mockReset());

describe('handler — timelineByOrg AppSync resolver', () => {
  it('routes an AppSync fieldName to the resolver, maps items, returns connection', async () => {
    timelineByOrgMock.mockResolvedValueOnce({
      items: [{ id: 'tev-1', occurredAt: '2026-03-01T00:00:00Z', source: 'order', kind: 'order_created', summary: 'Order created — X', resolutionStatus: 'resolved', resolutionReason: 'existing_matchedOrgId', confidence: 1, isInternalOnly: false, sourceEntityType: 'order', sourceEntityId: 'ord-1', payload: { productModel: 'X' } }],
      nextToken: 'TOK',
    });
    const res = await handler({ info: { fieldName: 'timelineByOrg' }, arguments: { orgId: 'acme.com', limit: 10, includeInternalOnly: true } } as never) as { items: unknown[]; nextToken?: string };
    expect(timelineByOrgMock).toHaveBeenCalledWith({ orgId: 'acme.com', limit: 10, nextToken: undefined, includeInternalOnly: true });
    expect(res.nextToken).toBe('TOK');
    expect(res.items[0]).toMatchObject({ id: 'tev-1', sourceFilterGroup: 'order', tone: 'confirmed', primaryLabel: 'Order created — X', productModel: 'X' });
  });

  it('still dispatches a direct-invoke action (does not break the action path)', async () => {
    // unknown action throws via the ACTION path, proving direct-invoke is still routed there
    await expect(handler({ action: 'definitely_not_a_real_action' } as never)).rejects.toThrow(/unknown action/);
  });

  it('unknown fieldName throws via the resolver path', async () => {
    await expect(handler({ info: { fieldName: 'nope' } } as never)).rejects.toThrow(/unknown fieldName/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run amplify/functions/crm-api/handler.test.ts`
Expected: FAIL — first test: `timelineByOrg` resolver not registered (`unknown fieldName "timelineByOrg"`).

- [ ] **Step 3: Write minimal implementation** (edit `handler.ts`)

Add imports near the top:

```ts
import { timelineByOrg } from './lib/read/timelineByOrg';
import { toOrganizationTimelineItem } from './lib/read/organizationTimelineItem';
```

Replace the empty resolvers line `const resolvers: Record<string, (e: AppSyncEvent) => Promise<unknown>> = {};` with:

```ts
const resolvers: Record<string, (e: AppSyncEvent) => Promise<unknown>> = {
  timelineByOrg: async (e) => {
    const a = (e.arguments ?? {}) as { orgId?: string; limit?: number; nextToken?: string; includeInternalOnly?: boolean };
    const { items, nextToken } = await timelineByOrg({
      orgId: a.orgId ?? '', limit: a.limit, nextToken: a.nextToken, includeInternalOnly: a.includeInternalOnly ?? false,
    });
    return { items: items.map(toOrganizationTimelineItem), nextToken: nextToken ?? null };
  },
};
```

(The direct-invoke `actions` dispatch and the `handler` routing are unchanged — invariant (f).)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run amplify/functions/crm-api/handler.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add amplify/functions/crm-api/handler.ts amplify/functions/crm-api/handler.test.ts
git commit -m "feat(crm-api): timelineByOrg AppSync resolver; keep direct-action path (3A)"
```

---

## Task 4: Existence-pass coverage counters (`sourceScanned`/`expected`/`existing`)

**Files:**
- Modify: `amplify/functions/crm-api/lib/sweep/existencePass.ts`
- Modify: `amplify/functions/crm-api/lib/sweep/existencePass.test.ts`

- [ ] **Step 1: Update the failing test** — replace the two `counters` expectations in the existing `reconcileExpectedEvents` tests and add an invariant test.

In the existing test "emits ONLY the missing events and counts them", change the counters init and assertion:

```ts
    const counters = { sourceScanned: 0, expected: 0, existing: 0, missingReemitted: 0, errors: 0 };
    await reconcileExpectedEvents(expected, { getTimelineEvent, emit }, counters);
    expect(emit).toHaveBeenCalledTimes(1);
    expect(counters).toMatchObject({ expected: 2, existing: 1, missingReemitted: 1, errors: 0 });
    expect(counters.expected).toBe(counters.existing + counters.missingReemitted + counters.errors); // invariant
```

In the "isolates a per-event error" test:

```ts
    const counters = { sourceScanned: 0, expected: 0, existing: 0, missingReemitted: 0, errors: 0 };
    await reconcileExpectedEvents(expected, { getTimelineEvent, emit }, counters);
    expect(counters).toMatchObject({ expected: 2, existing: 0, missingReemitted: 1, errors: 1 });
    expect(counters.expected).toBe(counters.existing + counters.missingReemitted + counters.errors);
```

Add a new test asserting `sourceScanned` (per source record) vs `expected` (per event) in `runExistencePage`:

```ts
  it('counts sourceScanned per source record and expected per expanded event', async () => {
    // one ORDER META record → order_created (missing) + one stage log (present)
    mockSend
      .mockResolvedValueOnce({ Items: [{ PK: 'ORDER#ord-1', SK: 'META', createdAt: '2026-03-01T00:00:00Z', productModel: 'X', matchedOrgId: 'acme.com' }] }) // channel scan
      .mockResolvedValueOnce({ Items: [{ PK: 'ORDER#ord-1', SK: 'LOG#olog-1', toStatus: 'SHIPPED', fromStatus: 'IN_PRODUCTION', timestamp: '2026-04-01T00:00:00Z' }] }); // loadOrderChildren
    getTimelineEventMock.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'exists' });
    emitMock.mockResolvedValue(undefined);
    const out = await runExistencePage({ mode: 'cold', limit: 100, cursor: { channel: 'order' } });
    expect(out.counters.sourceScanned).toBe(1);
    expect(out.counters.expected).toBe(out.counters.existing + out.counters.missingReemitted + out.counters.errors);
    expect(out.counters.missingReemitted).toBe(1);
    expect(out.counters.existing).toBe(1);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run amplify/functions/crm-api/lib/sweep/existencePass.test.ts`
Expected: FAIL — `expected`/`existing`/`sourceScanned` undefined on counters.

- [ ] **Step 3: Update the implementation** (`existencePass.ts`)

Change the interface:

```ts
export interface ExistenceCounters { sourceScanned: number; expected: number; existing: number; missingReemitted: number; errors: number; }
```

Update `reconcileExpectedEvents` loop body:

```ts
  for (const ev of expected) {
    counters.expected += 1;
    try {
      const existing = await deps.getTimelineEvent(ev.id);
      if (existing) { counters.existing += 1; }
      else { await deps.emit(ev.args); counters.missingReemitted += 1; }
    } catch (err) {
      counters.errors += 1;
      console.error(JSON.stringify({ event: 'crm.sweep.existence.error', id: ev.id, error: err instanceof Error ? err.message : String(err) }));
    }
  }
```

In `runExistencePage`, change the counters init and increment `sourceScanned` per item:

```ts
  const counters: ExistenceCounters = { sourceScanned: 0, expected: 0, existing: 0, missingReemitted: 0, errors: 0 };
  // ...
  for (const item of (res.Items ?? []) as Array<Record<string, unknown>>) {
    counters.sourceScanned += 1;
    try {
      await reconcileExpectedEvents(await channel.expand(item), deps, counters);
    } catch (err) {
      counters.errors += 1;
      console.error(JSON.stringify({ event: 'crm.sweep.existence.expand_error', pk: item.PK, error: err instanceof Error ? err.message : String(err) }));
    }
  }
```

Also update any other existing test in this file that still references `{ scanned: ... }` (search the file for `scanned` and rename assertions to `expected`, adding `existing` where a hit occurs).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run amplify/functions/crm-api/lib/sweep/existencePass.test.ts`
Expected: PASS. Then run the reconcileSweep test that aggregates counters:
Run: `npx vitest run amplify/functions/crm-api/lib/sweep/reconcileSweep.test.ts`
Expected: PASS (counters are aggregated generically via `Object.entries`, so no rename needed there; fix any literal `scanned` assertion if present).

- [ ] **Step 5: Commit**

```bash
git add amplify/functions/crm-api/lib/sweep/existencePass.ts amplify/functions/crm-api/lib/sweep/existencePass.test.ts
git commit -m "feat(crm-api): existence-pass coverage counters sourceScanned/expected/existing (3A catch-up observability)"
```

---

## Task 5: AppSync schema — `timelineByOrg` query + connection types

**Files:**
- Modify: `amplify/data/resource.ts`

- [ ] **Step 1: Add the import** (top of file, after the other function imports)

```ts
import { crmApi } from '../functions/crm-api/resource';
```

- [ ] **Step 2: Add the custom types** (place near `OrderConnection`, inside the schema object)

```ts
  OrganizationTimelineItem: a.customType({
    id: a.string().required(),
    occurredAt: a.string().required(),
    source: a.string().required(),
    kind: a.string().required(),
    sourceFilterGroup: a.string().required(),
    icon: a.string().required(),
    tone: a.string().required(),
    primaryLabel: a.string().required(),
    resolutionStatus: a.string().required(),
    resolutionReason: a.string().required(),
    confidence: a.float(),
    isInternalOnly: a.boolean().required(),
    productModel: a.string(),
    specificModel: a.string(),
    equipmentCategory: a.string(),
    leadType: a.string(),
    productName: a.string(),
    stageFrom: a.string(),
    stageTo: a.string(),
    fileName: a.string(),
    pageCount: a.integer(),
    activeSeconds: a.integer(),
    topPaths: a.string().array(),
    sourceEntityType: a.string().required(),
    sourceEntityId: a.string().required(),
    payload: a.json(),
  }),

  OrganizationTimelineConnection: a.customType({
    items: a.ref('OrganizationTimelineItem').array().required(),
    nextToken: a.string(),
  }),
```

- [ ] **Step 3: Add the query** (in the queries region, next to `getOrganization`)

```ts
  timelineByOrg: a
    .query()
    .arguments({
      orgId: a.string().required(),
      limit: a.integer(),
      nextToken: a.string(),
      includeInternalOnly: a.boolean(),
    })
    .returns(a.ref('OrganizationTimelineConnection').required())
    .handler(a.handler.function(crmApi))
    .authorization((allow) => [allow.authenticated()]),
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit -p amplify/tsconfig.json`
Expected: PASS (no type errors). NOTE: crm-api is already `resourceGroupName: 'data'`, so this first AppSync resolver on crm-api introduces no new nested-stack cycle. The AppSync wiring itself is validated by the Amplify Console synth/deploy (cannot run `ampx pipeline-deploy` locally) — flag in the PR that deploy is the gate.

- [ ] **Step 5: Commit**

```bash
git add amplify/data/resource.ts
git commit -m "feat(data): timelineByOrg query + OrganizationTimelineItem/Connection types (crm-api first AppSync resolver) (3A)"
```

---

## Task 6: Frontend service — `getOrganizationTimeline`

**Files:**
- Modify: `src/services/organizationAdminService.ts`

- [ ] **Step 1: Add the service function** (mirrors `getOrganization`)

```ts
export interface TimelineQueryArgs {
  orgId: string;
  limit?: number;
  nextToken?: string;
  includeInternalOnly?: boolean;
}

export async function getOrganizationTimeline(args: TimelineQueryArgs) {
  const { data, errors } = await client().queries.timelineByOrg(args, AUTH);
  if (errors?.length) throw new Error(errors.map((e) => e.message).join(', '));
  return data;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (the generated client type includes `timelineByOrg` after Task 5). If the local generated schema type is stale, this may error — regenerate is a deploy-time concern; the hook test (Task 7) mocks the service, so it does not depend on the generated type.

- [ ] **Step 3: Commit**

```bash
git add src/services/organizationAdminService.ts
git commit -m "feat(admin): getOrganizationTimeline service call (3A)"
```

---

## Task 7: `useOrganizationTimeline` hook

**Files:**
- Create: `src/hooks/useOrganizationTimeline.ts`
- Test: `src/hooks/useOrganizationTimeline.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import * as svc from '../services/organizationAdminService';
vi.mock('../services/organizationAdminService');
import { useOrganizationTimeline } from './useOrganizationTimeline';

beforeEach(() => vi.resetAllMocks());

describe('useOrganizationTimeline', () => {
  it('loads the first page (default includeInternalOnly=false) and exposes items + hasMore', async () => {
    vi.mocked(svc.getOrganizationTimeline).mockResolvedValueOnce({ items: [{ id: 'tev-1' }], nextToken: 'T1' } as never);
    const { result } = renderHook(() => useOrganizationTimeline('acme.com'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items).toHaveLength(1);
    expect(result.current.hasMore).toBe(true);
    expect(svc.getOrganizationTimeline).toHaveBeenCalledWith({ orgId: 'acme.com', nextToken: undefined, includeInternalOnly: false });
  });

  it('loadMore APPENDS the next page and forwards the nextToken', async () => {
    vi.mocked(svc.getOrganizationTimeline)
      .mockResolvedValueOnce({ items: [{ id: 'tev-1' }], nextToken: 'T1' } as never)
      .mockResolvedValueOnce({ items: [{ id: 'tev-2' }], nextToken: null } as never);
    const { result } = renderHook(() => useOrganizationTimeline('acme.com'));
    await waitFor(() => expect(result.current.hasMore).toBe(true));
    await act(async () => { await result.current.loadMore(); });
    expect(result.current.items.map((i: { id: string }) => i.id)).toEqual(['tev-1', 'tev-2']);
    expect(result.current.hasMore).toBe(false);
    expect(svc.getOrganizationTimeline).toHaveBeenLastCalledWith({ orgId: 'acme.com', nextToken: 'T1', includeInternalOnly: false });
  });

  it('setIncludeInternal(true) REFETCHES from scratch with the param (not a client reveal)', async () => {
    vi.mocked(svc.getOrganizationTimeline)
      .mockResolvedValueOnce({ items: [{ id: 'ext' }], nextToken: null } as never)
      .mockResolvedValueOnce({ items: [{ id: 'ext' }, { id: 'internal' }], nextToken: null } as never);
    const { result } = renderHook(() => useOrganizationTimeline('acme.com'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { result.current.setIncludeInternal(true); });
    await waitFor(() => expect(result.current.items).toHaveLength(2));
    expect(svc.getOrganizationTimeline).toHaveBeenLastCalledWith({ orgId: 'acme.com', nextToken: undefined, includeInternalOnly: true });
  });

  it('surfaces errors', async () => {
    vi.mocked(svc.getOrganizationTimeline).mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => useOrganizationTimeline('acme.com'));
    await waitFor(() => expect(result.current.error?.message).toBe('boom'));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/hooks/useOrganizationTimeline.test.tsx`
Expected: FAIL — hook not defined.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/hooks/useOrganizationTimeline.ts
import { useState, useEffect, useCallback } from 'react';
import * as svc from '../services/organizationAdminService';

type TimelineData = Awaited<ReturnType<typeof svc.getOrganizationTimeline>>;
type Item = NonNullable<TimelineData>['items'][number];

export function useOrganizationTimeline(orgId: string | undefined) {
  const [items, setItems] = useState<Item[]>([]);
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [includeInternal, setIncludeInternalState] = useState(false);

  const load = useCallback(async (token: string | undefined, append: boolean, includeInternalOnly: boolean) => {
    if (!orgId) return;
    setLoading(true);
    try {
      const res = await svc.getOrganizationTimeline({ orgId, nextToken: token, includeInternalOnly });
      const page = (res?.items ?? []) as Item[];
      setItems((prev) => (append ? [...prev, ...page] : page));
      setNextToken((res?.nextToken as string | null) ?? null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { void load(undefined, false, includeInternal); }, [load, includeInternal]);

  const loadMore = useCallback(async () => {
    if (nextToken) await load(nextToken, true, includeInternal);
  }, [load, nextToken, includeInternal]);

  const setIncludeInternal = useCallback((v: boolean) => { setIncludeInternalState(v); }, []);

  return { items, loading, error, hasMore: nextToken !== null, loadMore, includeInternal, setIncludeInternal };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/hooks/useOrganizationTimeline.test.tsx`
Expected: PASS (4 tests). The third test is invariant (c): toggling internal REFETCHES with the param.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useOrganizationTimeline.ts src/hooks/useOrganizationTimeline.test.tsx
git commit -m "feat(admin): useOrganizationTimeline hook (loadMore append + includeInternal refetch) (3A)"
```

---

## Task 8: Frontend per-kind templates (`timelineItemTemplates.ts`)

**Files:**
- Create: `src/components/admin/timelineItemTemplates.ts`
- Test: `src/components/admin/timelineItemTemplates.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { composeTimelineText, CHIP_LABELS, toneBadge } from './timelineItemTemplates';

const item = (o: Record<string, unknown>) => ({
  kind: 'order_created', primaryLabel: 'fallback', productModel: null, specificModel: null,
  equipmentCategory: null, leadType: null, productName: null, stageFrom: null, stageTo: null,
  fileName: null, pageCount: null, activeSeconds: null, topPaths: null, ...o,
}) as never;

describe('timelineItemTemplates', () => {
  it('composes known kinds from structured fields (not from summary)', () => {
    expect(composeTimelineText(item({ kind: 'order_stage_changed', stageFrom: 'IN_PRODUCTION', stageTo: 'SHIPPED' })).title).toBe('Order stage: IN_PRODUCTION → SHIPPED');
    expect(composeTimelineText(item({ kind: 'quote_sent', fileName: 'Q-014.pdf' })).title).toBe('Quote sent');
    expect(composeTimelineText(item({ kind: 'quote_sent', fileName: 'Q-014.pdf' })).snippet).toBe('Q-014.pdf');
    expect(composeTimelineText(item({ kind: 'site_visit_session', pageCount: 3, activeSeconds: 245 })).title).toBe('Site visit');
    expect(composeTimelineText(item({ kind: 'site_visit_session', pageCount: 3, activeSeconds: 245 })).snippet).toBe('3 pages · 4m 5s');
  });

  it('falls back to primaryLabel for an unknown kind', () => {
    const r = composeTimelineText(item({ kind: 'future_kind_xyz', primaryLabel: 'Something happened' }));
    expect(r.title).toBe('Something happened');
    expect(r.snippet).toBeNull();
  });

  it('exposes chip labels and tone→badge class', () => {
    expect(CHIP_LABELS.site_visits).toBe('Site visits');
    expect(toneBadge('inferred')).toContain('amber');
    expect(toneBadge('confirmed')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/admin/timelineItemTemplates.test.ts`
Expected: FAIL — module not defined.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/components/admin/timelineItemTemplates.ts
import type { OrganizationTimelineItem } from '../../hooks/useOrganizationTimeline';

export const CHIP_LABELS: Record<string, string> = {
  all: 'All', rfq: 'RFQ', lead: 'Lead', order: 'Order', quote: 'Quote', logistics: 'Logistics', site_visits: 'Site visits',
};

export const ICON_GLYPH: Record<string, string> = {
  rfq: '📄', lead: '✉️', order: '📦', quote: '💬', logistics: '🚚', site_visit: '🌐', event: '•',
};

export function toneBadge(tone: string): string {
  switch (tone) {
    case 'confirmed': return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
    case 'domain-match': return 'bg-sky-50 text-sky-700 border border-sky-200';
    case 'inferred': return 'bg-amber-50 text-amber-700 border border-amber-200';
    default: return 'bg-slate-100 text-slate-600 border border-slate-200';
  }
}

export const TONE_LABEL: Record<string, string> = {
  confirmed: 'Confirmed', 'domain-match': 'Domain match', inferred: 'Inferred', unknown: 'Unknown link',
};

const fmtDuration = (s: number): string => {
  const m = Math.floor(s / 60), sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
};

type Item = Pick<OrganizationTimelineItem, 'kind' | 'primaryLabel' | 'stageFrom' | 'stageTo' | 'fileName' | 'pageCount' | 'activeSeconds' | 'productModel' | 'equipmentCategory' | 'leadType' | 'productName'>;

export function composeTimelineText(item: Item): { title: string; snippet: string | null } {
  switch (item.kind) {
    case 'rfq_submitted':
      return { title: 'RFQ submitted', snippet: item.equipmentCategory ?? item.primaryLabel };
    case 'lead_captured':
      return { title: 'Lead captured', snippet: item.productName ?? item.leadType ?? null };
    case 'order_created':
      return { title: 'Order created', snippet: item.productModel ?? null };
    case 'order_stage_changed':
      return { title: `Order stage: ${item.stageFrom ?? '—'} → ${item.stageTo ?? '—'}`, snippet: null };
    case 'quote_sent':
      return { title: 'Quote sent', snippet: item.fileName ?? null };
    case 'logistics_milestone':
      return { title: `Logistics: ${item.stageFrom ?? '—'} → ${item.stageTo ?? '—'}`, snippet: null };
    case 'site_visit_session':
      return {
        title: 'Site visit',
        snippet: [item.pageCount != null ? `${item.pageCount} page${item.pageCount === 1 ? '' : 's'}` : null,
                  item.activeSeconds != null ? fmtDuration(item.activeSeconds) : null].filter(Boolean).join(' · ') || null,
      };
    default:
      return { title: item.primaryLabel, snippet: null };
  }
}
```

Also re-export the item type from the hook so this module and the component share one type. In `useOrganizationTimeline.ts`, add:

```ts
export type OrganizationTimelineItem = Item;
```

(where `Item` is the derived element type in Task 7).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/admin/timelineItemTemplates.test.ts`
Expected: PASS (3 tests). Unknown-kind fallback = invariant graceful degradation.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/timelineItemTemplates.ts src/components/admin/timelineItemTemplates.test.ts src/hooks/useOrganizationTimeline.ts
git commit -m "feat(admin): per-kind timeline templates + tone badges + chip labels (3A)"
```

---

## Task 9: Replace `OrganizationTimeline` with the unified card view

**Files:**
- Rewrite: `src/components/admin/OrganizationTimeline.tsx`
- Test: `src/components/admin/OrganizationTimeline.test.tsx`

The component now takes the timeline hook's outputs as props (the page owns the hook — Task 10).

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { OrganizationTimeline } from './OrganizationTimeline';

const items = [
  { id: 'a', occurredAt: '2026-03-02T00:00:00Z', source: 'order', kind: 'order_created', sourceFilterGroup: 'order', icon: 'order', tone: 'confirmed', primaryLabel: 'Order created — X', resolutionStatus: 'resolved', resolutionReason: 'existing_matchedOrgId', confidence: null, isInternalOnly: false, productModel: 'X', specificModel: null, equipmentCategory: null, leadType: null, productName: null, stageFrom: null, stageTo: null, fileName: null, pageCount: null, activeSeconds: null, topPaths: null, sourceEntityType: 'order', sourceEntityId: 'ord-1', payload: null },
  { id: 'b', occurredAt: '2026-03-01T00:00:00Z', source: 'analytics', kind: 'site_visit_session', sourceFilterGroup: 'site_visits', icon: 'site_visit', tone: 'inferred', primaryLabel: 'Site visit — 3 pages', resolutionStatus: 'resolved', resolutionReason: 'visitor_prior_event', confidence: 0.72, isInternalOnly: false, productModel: null, specificModel: null, equipmentCategory: null, leadType: null, productName: null, stageFrom: null, stageTo: null, fileName: null, pageCount: 3, activeSeconds: 240, topPaths: ['/x'], sourceEntityType: 'analytics_session', sourceEntityId: 'sess-1', payload: null },
] as never[];

const baseProps = { items, loading: false, error: null as Error | null, hasMore: false, loadMore: vi.fn(), includeInternal: false, setIncludeInternal: vi.fn() };

describe('OrganizationTimeline', () => {
  it('renders mixed kinds as cards', () => {
    render(<OrganizationTimeline {...baseProps} />);
    expect(screen.getByText('Order created')).toBeTruthy();
    expect(screen.getByText('Site visit')).toBeTruthy();
  });

  it('source chips filter ONLY the loaded items (client-side)', () => {
    render(<OrganizationTimeline {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Site visits' }));
    expect(screen.queryByText('Order created')).toBeNull();
    expect(screen.getByText('Site visit')).toBeTruthy();
  });

  it('"Load more" calls loadMore only when hasMore', () => {
    const loadMore = vi.fn();
    const { rerender } = render(<OrganizationTimeline {...baseProps} hasMore={false} loadMore={loadMore} />);
    expect(screen.queryByRole('button', { name: /load more/i })).toBeNull();
    rerender(<OrganizationTimeline {...baseProps} hasMore loadMore={loadMore} />);
    fireEvent.click(screen.getByRole('button', { name: /load more/i }));
    expect(loadMore).toHaveBeenCalled();
  });

  it('"Show internal" toggle calls setIncludeInternal(true) (drives a refetch upstream, not a client reveal)', () => {
    const setIncludeInternal = vi.fn();
    render(<OrganizationTimeline {...baseProps} setIncludeInternal={setIncludeInternal} />);
    fireEvent.click(screen.getByRole('checkbox', { name: /show internal/i }));
    expect(setIncludeInternal).toHaveBeenCalledWith(true);
  });

  it('shows skeleton on initial load, inline retry on error, and chip-empty hint', () => {
    const { rerender } = render(<OrganizationTimeline {...baseProps} items={[]} loading />);
    expect(screen.getByTestId('timeline-skeleton')).toBeTruthy();
    rerender(<OrganizationTimeline {...baseProps} items={[]} loading={false} error={new Error('x')} />);
    expect(screen.getByText(/couldn.t load timeline/i)).toBeTruthy();
    rerender(<OrganizationTimeline {...baseProps} items={[]} loading={false} error={null} />);
    expect(screen.getByText(/no recorded interactions/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/admin/OrganizationTimeline.test.tsx`
Expected: FAIL — old component has a different (tabs) API/exports.

- [ ] **Step 3: Write minimal implementation** (replace file contents)

```tsx
// src/components/admin/OrganizationTimeline.tsx
import { useMemo, useState } from 'react';
import type { OrganizationTimelineItem } from '../../hooks/useOrganizationTimeline';
import { CHIP_LABELS, ICON_GLYPH, TONE_LABEL, toneBadge, composeTimelineText } from './timelineItemTemplates';

interface Props {
  items: OrganizationTimelineItem[];
  loading: boolean;
  error: Error | null;
  hasMore: boolean;
  loadMore: () => void;
  includeInternal: boolean;
  setIncludeInternal: (v: boolean) => void;
}

const CHIPS = ['all', 'rfq', 'lead', 'order', 'quote', 'logistics', 'site_visits'] as const;

export function OrganizationTimeline({ items, loading, error, hasMore, loadMore, includeInternal, setIncludeInternal }: Props) {
  const [chip, setChip] = useState<string>('all');
  const filtered = useMemo(
    () => (chip === 'all' ? items : items.filter((i) => i.sourceFilterGroup === chip)),
    [items, chip],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-2 flex-wrap">
          {CHIPS.map((c) => (
            <button
              key={c}
              onClick={() => setChip(c)}
              className={`px-3 py-1 rounded-full text-xs border ${chip === c ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200'}`}
            >
              {CHIP_LABELS[c]}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-500">
          <input type="checkbox" checked={includeInternal} onChange={(e) => setIncludeInternal(e.target.checked)} />
          Show internal
        </label>
      </div>

      {loading && items.length === 0 ? (
        <div data-testid="timeline-skeleton" className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => <div key={i} className="h-16 rounded-lg bg-slate-100 animate-pulse" />)}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Couldn’t load timeline. <button className="underline" onClick={loadMore}>Retry</button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-slate-200 p-6 text-center text-sm text-slate-500">
          {items.length === 0 ? 'No recorded interactions yet.' : 'No results in the loaded range — Load more.'}
        </div>
      ) : (
        <ol className="flex flex-col gap-3">
          {filtered.map((item) => {
            const { title, snippet } = composeTimelineText(item);
            return (
              <li key={item.id} className="flex gap-3 rounded-lg border border-slate-200 p-3">
                <div className="text-lg leading-none">{ICON_GLYPH[item.icon] ?? ICON_GLYPH.event}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm text-slate-800">{title}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] ${toneBadge(item.tone)}`}>
                      {TONE_LABEL[item.tone] ?? item.tone}{item.confidence != null ? ` · ${Math.round(item.confidence * 100)}%` : ''}
                    </span>
                    {item.isInternalOnly && <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-500">internal</span>}
                  </div>
                  {snippet && <div className="text-xs text-slate-500 truncate">{snippet}</div>}
                </div>
                <time className="text-[11px] text-slate-400 whitespace-nowrap">{new Date(item.occurredAt).toLocaleDateString()}</time>
              </li>
            );
          })}
        </ol>
      )}

      {hasMore && !loading && (
        <button onClick={loadMore} className="self-center px-4 py-2 text-xs rounded-full border border-slate-300 text-slate-600">
          Load more
        </button>
      )}
    </div>
  );
}
```

Note: the old exports `RfqEntry`/`OrderEntry`/`LeadEntry` are removed — Task 10 stops importing them.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/admin/OrganizationTimeline.test.tsx`
Expected: PASS (5 tests). Invariant (d): chips filter only loaded `items`. Invariant (c) at component level: the toggle calls `setIncludeInternal`.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/OrganizationTimeline.tsx src/components/admin/OrganizationTimeline.test.tsx
git commit -m "feat(admin): unified Customer 360 timeline cards + chips + Load more, replacing tabs (3A)"
```

---

## Task 10: Wire the detail page (parallel load, isolate timeline error)

**Files:**
- Modify: `src/pages/admin/OrganizationDetailPage.tsx`
- Test: `src/pages/admin/OrganizationDetailPage.test.tsx` (create if absent)

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
vi.mock('../../hooks/useOrganization', () => ({ useOrganization: vi.fn() }));
vi.mock('../../hooks/useOrganizationTimeline', () => ({ useOrganizationTimeline: vi.fn() }));
import { useOrganization } from '../../hooks/useOrganization';
import { useOrganizationTimeline } from '../../hooks/useOrganizationTimeline';
import OrganizationDetailPage from './OrganizationDetailPage';

const renderAt = () => render(
  <MemoryRouter initialEntries={['/admin/organizations/acme.com']}>
    <Routes><Route path="/admin/organizations/:orgId" element={<OrganizationDetailPage />} /></Routes>
  </MemoryRouter>,
);

beforeEach(() => vi.resetAllMocks());

describe('OrganizationDetailPage', () => {
  it('renders the header even when the timeline errors (isolated failure)', () => {
    vi.mocked(useOrganization).mockReturnValue({ data: { organization: { orgId: 'acme.com', displayName: 'Acme', totalOrderValueUSD: 0 } }, loading: false, error: null, refresh: vi.fn() } as never);
    vi.mocked(useOrganizationTimeline).mockReturnValue({ items: [], loading: false, error: new Error('down'), hasMore: false, loadMore: vi.fn(), includeInternal: false, setIncludeInternal: vi.fn() } as never);
    renderAt();
    expect(screen.getByText('Acme')).toBeTruthy();               // header survived
    expect(screen.getByText(/couldn.t load timeline/i)).toBeTruthy(); // timeline error inline
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/pages/admin/OrganizationDetailPage.test.tsx`
Expected: FAIL — page still renders the old tabs component / doesn't use `useOrganizationTimeline`.

- [ ] **Step 3: Update the page**

- Remove the `RfqEntry`/`OrderEntry`/`LeadEntry` imports and the old `<OrganizationTimeline recentRfqs=… recentOrders=… recentLeads=… />` usage.
- Add the timeline hook alongside `useOrganization` and pass its outputs to the new component. Keep the header + aggregate cards exactly as they are.

```tsx
import { useOrganizationTimeline } from '../../hooks/useOrganizationTimeline';
import { OrganizationTimeline } from '../../components/admin/OrganizationTimeline';
// ...inside the component, after `const { data } = useOrganization(orgId);`
const timeline = useOrganizationTimeline(orgId);
// ...replace the old <OrganizationTimeline .../> block with:
<OrganizationTimeline
  items={timeline.items}
  loading={timeline.loading}
  error={timeline.error}
  hasMore={timeline.hasMore}
  loadMore={timeline.loadMore}
  includeInternal={timeline.includeInternal}
  setIncludeInternal={timeline.setIncludeInternal}
/>
```

(The org bundle load and the timeline load are independent `useState` cycles in their own hooks, so a timeline error never blocks the header render.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/pages/admin/OrganizationDetailPage.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/admin/OrganizationDetailPage.tsx src/pages/admin/OrganizationDetailPage.test.tsx
git commit -m "feat(admin): OrgDetailPage uses materialized timeline; header isolated from timeline error (3A)"
```

---

## Task 11: Catch-up runbook (+ optional driver)

**Files:**
- Create: `docs/runbooks/2026-07-08-customer-360-3a-timeline-catchup.md`
- Optional (only if trivially cheap at execution): `scripts/catch-up-timeline.ts`

- [ ] **Step 1: Write the runbook**

```markdown
# Runbook — Customer 360 3A pre-launch timeline catch-up

**When:** once, before flipping the OrganizationDetailPage default view to the materialized timeline.
**What:** materialize any historical structured interactions (RFQ/Lead/Order/Quote/Logistics) not yet in `TimelineEvent`, by running the existing cold reconciliation sweep to completion. Analytics is forward-only and intentionally NOT backfilled.

## Steps
1. Find the crm-api Lambda:
   `aws lambda list-functions --region us-east-2 --query "Functions[?contains(FunctionName,'crm-api')].FunctionName" --output text`
2. Loop the cold sweep until it reports completion (it resumes from its own persisted cursor between invokes; the daily cron shares the same cursor and cooperates):
   ```bash
   FN=<crm-api function name>
   while :; do
     aws lambda invoke --region us-east-2 --function-name "$FN" \
       --cli-binary-format raw-in-base64-out \
       --payload '{"action":"reconcileSweep","mode":"cold"}' /tmp/out.json >/dev/null
     cat /tmp/out.json
     # stop when summary.existence.hasMore === false
     python3 -c "import json,sys; s=json.load(open('/tmp/out.json')).get('summary',{}).get('existence',{}); sys.exit(0 if s.get('hasMore') else 1)" || break
   done
   ```
3. Confirm coverage from the last summary log (`crm.analytics`… no — `crm.sweep.summary`): the existence counters must satisfy `expected = existing + missingReemitted + errors`, with `errors == 0`. `sourceScanned` shows how many source records were expanded.
4. Spot-check a couple of known historical customers in the admin UI: their RFQ/Order/Quote events now appear in the unified timeline.

## Rollback
None required — the sweep is idempotent (deterministic ids; re-runs only hit `existing`). If `errors > 0`, inspect the `crm.sweep.existence.error` / `expand_error` logs and re-run.
```

- [ ] **Step 2: Commit**

```bash
git add docs/runbooks/2026-07-08-customer-360-3a-timeline-catchup.md
git commit -m "docs(runbook): 3A pre-launch timeline catch-up via cold sweep loop"
```

---

## Task 12: Green-bar checkpoint

**Files:** none (verification only)

- [ ] **Step 1: Full backend + frontend test run**

Run: `npx vitest run --exclude '**/.claude/**' amplify/functions/crm-api src/hooks/useOrganizationTimeline.test.tsx src/components/admin/OrganizationTimeline.test.tsx src/components/admin/timelineItemTemplates.test.ts src/pages/admin/OrganizationDetailPage.test.tsx`
Expected: PASS, no failures.

- [ ] **Step 2: Typecheck (root + amplify)**

Run: `npx tsc --noEmit && npx tsc --noEmit -p amplify/tsconfig.json`
Expected: PASS.

- [ ] **Step 3: Lint the changed surface**

Run: `npx eslint amplify/functions/crm-api src/hooks/useOrganizationTimeline.ts src/components/admin/OrganizationTimeline.tsx src/components/admin/timelineItemTemplates.ts --ext ts,tsx`
Expected: PASS (no new violations beyond the existing baseline).

- [ ] **Step 4: Commit any final fixups**

```bash
git status
git add -A && git commit -m "chore(3A): green-bar — timeline read view complete" || echo "nothing to commit"
```

---

## Self-Review (against the spec)

**Spec coverage:**
- §1.1 query contract → Task 5 (schema) + Task 3 (resolver). ✓
- §1.2 `begins_with(GSI2SK,'TLEVENT#')` key condition (shared GSI2 partition) → Task 2 (test asserts it). ✓ (invariant a)
- §1.3 server-side `voided`/`isInternalOnly` filters → Task 2. ✓ (invariant b)
- §1.4 opaque nextToken → Task 2 (encode/decode round-trip). ✓
- §1.5 limit clamp 50/100 → Task 2. ✓
- §1b catch-up via cold sweep loop → Task 11; counter enhancement → Task 4. ✓ (invariant e)
- §2.2 `OrganizationTimelineItem` fields (no `amountUSD`) → Task 1. ✓
- §2.2 `primaryLabel` fallback = summary → Task 1 + Task 8 unknown-kind fallback. ✓
- §2.4 client-side source chips over loaded feed → Task 9. ✓ (invariant d)
- §2.4 "Show internal" = refetch → Task 7 + Task 9. ✓ (invariant c)
- §3.1 resolution tiers (Confirmed/Domain/Inferred/Unknown) + confidence gating → Task 1 + Task 8. ✓
- §3.2/§3.3 empty/skeleton/inline-error/Load more → Task 9. ✓
- §4 change surface (10 units) → Tasks 1–11. ✓
- Direct-action path preserved → Task 3 test. ✓ (invariant f)
- Header isolated from timeline error → Task 10 test. ✓

**Placeholder scan:** none — every code step has complete code; Task 11's optional script is explicitly optional with the full runbook provided.

**Type consistency:** `OrganizationTimelineItem`/`StoredTimelineEvent` (Task 1) used by Tasks 2/3/8/9; `toOrganizationTimelineItem` (Task 1) called in Task 3; `timelineByOrg`/`encodeToken`/`decodeToken` (Task 2) used in Task 3; `getOrganizationTimeline` (Task 6) used in Task 7; `composeTimelineText`/`CHIP_LABELS`/`toneBadge`/`ICON_GLYPH`/`TONE_LABEL` (Task 8) used in Task 9; `ExistenceCounters` fields (Task 4) consistent across `reconcileExpectedEvents`/`runExistencePage`. Hook returns `{ items, loading, error, hasMore, loadMore, includeInternal, setIncludeInternal }` — same shape consumed by Task 9 props and Task 10 wiring.
