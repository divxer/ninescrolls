# Order Quote Expiration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `quoteValidUntil` date to orders and surface expired/expiring quotes in `/admin/orders` without changing the order state machine.

**Architecture:** Single new nullable date field on `Order`. Expiration is a derived UI concept (`status === 'QUOTE_SENT' && quoteValidUntil < today`), not a status enum value. A pure helper module supplies tri-state (`expired` / `soon` / `ok` / `none`) for badges. Server-side aggregate `expiredQuotes` is added to `OrderStats`.

**Tech Stack:** AWS Amplify Gen 2 data schema, DynamoDB (single-table), TypeScript Lambda resolvers, React + Vite, Tailwind, Vitest.

**Spec:** [docs/superpowers/specs/2026-05-09-order-quote-expiration-design.md](../specs/2026-05-09-order-quote-expiration-design.md)

---

## File Map

**Schema & types**
- Modify: `amplify/data/resource.ts` — add `quoteValidUntil` to `Order` customType and `expiredQuotes` to `OrderStats`
- Modify: `amplify/functions/order-api/lib/types.ts` — add `quoteValidUntil?: string` to `OrderItem`
- Modify: `src/types/admin.ts` — add `quoteValidUntil?: string | null` to `Order`, `expiredQuotes: number` to `OrderStats`

**Lambda resolvers**
- Modify: `amplify/functions/order-api/resolvers/createOrder.ts` — accept and persist `quoteValidUntil`
- Modify: `amplify/functions/order-api/resolvers/updateOrder.ts` — accept update, validate, append OrderLog
- Modify: `amplify/functions/order-api/lib/orderHelper.ts` — return `quoteValidUntil` in `buildOrderResponse`
- Modify: `amplify/functions/order-api/resolvers/orderStats.ts` — count `expiredQuotes`
- Modify: `amplify/functions/order-api/handler.test.ts` — add cases for create/update/stats

**Frontend pure helpers (new)**
- Create: `src/lib/orderHelpers.ts` — `isQuoteExpired`, `quoteExpiryStatus`, `daysUntilExpiry`, `addDaysISO`
- Create: `src/lib/orderHelpers.test.ts`

**Frontend UI**
- Modify: `src/pages/admin/CreateOrderPage.tsx` — `quoteValidUntil` input with linkage to `quoteDate`
- Modify: `src/components/admin/EditSpecsDialog.tsx` — add `quoteDate` and `quoteValidUntil` fields
- Modify: `src/pages/admin/OrderDetailPage.tsx` — render `Quote Valid Until` in spec card; pass field to dialog
- Modify: `src/pages/admin/OrderListPage.tsx` — row badge, "Show expired only" filter, expired-quotes alert card

---

### Task 1: Schema — add `quoteValidUntil` field and `expiredQuotes` stat

**Files:**
- Modify: `amplify/data/resource.ts:251-286`
- Modify: `amplify/data/resource.ts:293-299`

- [ ] **Step 1: Add field to Order customType**

In `amplify/data/resource.ts`, inside the `Order: a.customType({ ... })` block (around line 251–286), add `quoteValidUntil` immediately after `quoteDate`:

```ts
    quoteDate: a.date(),
    quoteValidUntil: a.date(),
    poDate: a.date(),
```

- [ ] **Step 2: Add `expiredQuotes` to OrderStats customType**

In the `OrderStats: a.customType({ ... })` block (around line 293–299), append:

```ts
  OrderStats: a.customType({
    totalActive: a.integer().required(),
    byStatus: a.json().required(),
    avgDaysToInstall: a.float(),
    upcomingDeliveries: a.integer().required(),
    overdueOrders: a.integer().required(),
    expiredQuotes: a.integer().required(),
  }),
```

- [ ] **Step 3: Type-check the schema**

Run: `npx tsc --noEmit -p amplify`
Expected: PASS (no new errors from the schema file).

- [ ] **Step 4: Commit**

```bash
git add amplify/data/resource.ts
git commit -m "feat(orders): add quoteValidUntil field and expiredQuotes stat to schema"
```

---

### Task 2: Lambda types — add `quoteValidUntil` to `OrderItem`

**Files:**
- Modify: `amplify/functions/order-api/lib/types.ts:64-99`

- [ ] **Step 1: Add field to OrderItem interface**

In `amplify/functions/order-api/lib/types.ts`, find `OrderItem` (line 64). Add `quoteValidUntil?: string;` immediately after `quoteDate?: string;`:

```ts
    quoteDate?: string;
    quoteValidUntil?: string;
    poDate?: string;
```

- [ ] **Step 2: Type-check the Lambda**

Run: `cd amplify/functions/order-api && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add amplify/functions/order-api/lib/types.ts
git commit -m "feat(orders): add quoteValidUntil to OrderItem type"
```

---

### Task 3: Frontend Order/OrderStats types — add fields

**Files:**
- Modify: `src/types/admin.ts:30-62, 101-107`

- [ ] **Step 1: Add `quoteValidUntil` to Order**

In `src/types/admin.ts`, find the `Order` interface. Add immediately after `quoteDate`:

```ts
  quoteDate?: string | null;
  quoteValidUntil?: string | null;
  poDate?: string | null;
```

- [ ] **Step 2: Add `expiredQuotes` to OrderStats**

```ts
export interface OrderStats {
  totalActive: number;
  byStatus: Record<string, number>;
  avgDaysToInstall?: number | null;
  upcomingDeliveries: number;
  overdueOrders: number;
  expiredQuotes: number;
}
```

- [ ] **Step 3: Type-check the frontend**

Run: `npx tsc --noEmit`
Expected: PASS (the new optional Order field doesn't break callers; `expiredQuotes` is required but no consumer reads it yet — no error).

- [ ] **Step 4: Commit**

```bash
git add src/types/admin.ts
git commit -m "feat(orders): add quoteValidUntil and expiredQuotes to frontend types"
```

---

### Task 4: Pure helper module — write failing tests

**Files:**
- Create: `src/lib/orderHelpers.test.ts`

- [ ] **Step 1: Write the test file**

Create `src/lib/orderHelpers.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  addDaysISO,
  daysUntilExpiry,
  isQuoteExpired,
  quoteExpiryStatus,
} from './orderHelpers';
import type { Order } from '../types/admin';

const TODAY = '2026-05-09';

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    orderId: 'o1',
    status: 'QUOTE_SENT',
    institution: 'Test U',
    productModel: 'ICP',
    createdAt: '2026-04-01T00:00:00Z',
    updatedAt: '2026-04-01T00:00:00Z',
    createdBy: 'admin',
    feedbackScheduleCreated: false,
    feedbackCount: 0,
    daysSinceLastUpdate: 0,
    source: 'MANUAL',
    ...overrides,
  };
}

describe('addDaysISO', () => {
  it('adds positive days across month boundary', () => {
    expect(addDaysISO('2026-04-30', 5)).toBe('2026-05-05');
  });
  it('handles 30-day default for quotes', () => {
    expect(addDaysISO('2026-05-09', 30)).toBe('2026-06-08');
  });
  it('returns empty string for empty input', () => {
    expect(addDaysISO('', 30)).toBe('');
  });
});

describe('daysUntilExpiry', () => {
  it('returns positive count for future date', () => {
    expect(daysUntilExpiry('2026-05-15', TODAY)).toBe(6);
  });
  it('returns 0 for today', () => {
    expect(daysUntilExpiry(TODAY, TODAY)).toBe(0);
  });
  it('returns negative count for past date', () => {
    expect(daysUntilExpiry('2026-05-04', TODAY)).toBe(-5);
  });
  it('returns null for missing date', () => {
    expect(daysUntilExpiry(null, TODAY)).toBeNull();
    expect(daysUntilExpiry(undefined, TODAY)).toBeNull();
  });
});

describe('isQuoteExpired', () => {
  it('is true for QUOTE_SENT with past validUntil', () => {
    const order = makeOrder({ status: 'QUOTE_SENT', quoteValidUntil: '2026-05-01' });
    expect(isQuoteExpired(order, TODAY)).toBe(true);
  });
  it('is false for QUOTE_SENT with future validUntil', () => {
    const order = makeOrder({ status: 'QUOTE_SENT', quoteValidUntil: '2026-06-01' });
    expect(isQuoteExpired(order, TODAY)).toBe(false);
  });
  it('is false for non-QUOTE_SENT status even if past', () => {
    const order = makeOrder({ status: 'PO_RECEIVED', quoteValidUntil: '2026-05-01' });
    expect(isQuoteExpired(order, TODAY)).toBe(false);
  });
  it('is false when quoteValidUntil is null', () => {
    const order = makeOrder({ status: 'QUOTE_SENT', quoteValidUntil: null });
    expect(isQuoteExpired(order, TODAY)).toBe(false);
  });
  it('is false when quoteValidUntil equals today (not yet expired)', () => {
    const order = makeOrder({ status: 'QUOTE_SENT', quoteValidUntil: TODAY });
    expect(isQuoteExpired(order, TODAY)).toBe(false);
  });
});

describe('quoteExpiryStatus', () => {
  it('returns "expired" for past date on QUOTE_SENT', () => {
    expect(
      quoteExpiryStatus(makeOrder({ status: 'QUOTE_SENT', quoteValidUntil: '2026-05-01' }), TODAY),
    ).toBe('expired');
  });
  it('returns "soon" within 7 days', () => {
    expect(
      quoteExpiryStatus(makeOrder({ status: 'QUOTE_SENT', quoteValidUntil: '2026-05-15' }), TODAY),
    ).toBe('soon');
  });
  it('returns "soon" exactly at 7 days', () => {
    expect(
      quoteExpiryStatus(makeOrder({ status: 'QUOTE_SENT', quoteValidUntil: '2026-05-16' }), TODAY),
    ).toBe('soon');
  });
  it('returns "ok" beyond 7 days', () => {
    expect(
      quoteExpiryStatus(makeOrder({ status: 'QUOTE_SENT', quoteValidUntil: '2026-05-17' }), TODAY),
    ).toBe('ok');
  });
  it('returns "none" when validUntil missing', () => {
    expect(
      quoteExpiryStatus(makeOrder({ status: 'QUOTE_SENT', quoteValidUntil: null }), TODAY),
    ).toBe('none');
  });
  it('returns "none" when status is not QUOTE_SENT', () => {
    expect(
      quoteExpiryStatus(makeOrder({ status: 'INQUIRY', quoteValidUntil: '2026-05-01' }), TODAY),
    ).toBe('none');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/orderHelpers.test.ts`
Expected: FAIL with module-not-found error for `./orderHelpers`.

---

### Task 5: Pure helper module — implementation

**Files:**
- Create: `src/lib/orderHelpers.ts`

- [ ] **Step 1: Write the implementation**

Create `src/lib/orderHelpers.ts`:

```ts
import type { Order } from '../types/admin';

export type QuoteExpiryStatus = 'expired' | 'soon' | 'ok' | 'none';

const SOON_DAYS = 7;

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysISO(dateISO: string, days: number): string {
  if (!dateISO) return '';
  const [y, m, d] = dateISO.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function daysUntilExpiry(
  validUntil: string | null | undefined,
  today: string = todayISO(),
): number | null {
  if (!validUntil) return null;
  const [vy, vm, vd] = validUntil.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  const v = Date.UTC(vy, vm - 1, vd);
  const t = Date.UTC(ty, tm - 1, td);
  return Math.round((v - t) / (1000 * 60 * 60 * 24));
}

export function isQuoteExpired(order: Order, today: string = todayISO()): boolean {
  if (order.status !== 'QUOTE_SENT') return false;
  if (!order.quoteValidUntil) return false;
  const remaining = daysUntilExpiry(order.quoteValidUntil, today);
  return remaining !== null && remaining < 0;
}

export function quoteExpiryStatus(
  order: Order,
  today: string = todayISO(),
): QuoteExpiryStatus {
  if (order.status !== 'QUOTE_SENT') return 'none';
  const remaining = daysUntilExpiry(order.quoteValidUntil, today);
  if (remaining === null) return 'none';
  if (remaining < 0) return 'expired';
  if (remaining <= SOON_DAYS) return 'soon';
  return 'ok';
}
```

- [ ] **Step 2: Run tests to verify pass**

Run: `npx vitest run src/lib/orderHelpers.test.ts`
Expected: PASS — all 18 tests green.

- [ ] **Step 3: Commit**

```bash
git add src/lib/orderHelpers.ts src/lib/orderHelpers.test.ts
git commit -m "feat(orders): add quote-expiry pure helpers with tests"
```

---

### Task 6: Lambda createOrder — accept and persist `quoteValidUntil`

**Files:**
- Modify: `amplify/functions/order-api/resolvers/createOrder.ts`

- [ ] **Step 1: Add field to input interface and validation**

In `createOrder.ts`, edit the `CreateOrderInput` interface to include the new field:

```ts
interface CreateOrderInput {
    quoteNumber?: string;
    institution: string;
    department?: string;
    productModel: string;
    productName?: string;
    configuration?: string;
    quoteAmount?: number;
    quoteDate?: string;
    quoteValidUntil?: string;
    estimatedDelivery?: string;
    notes?: string;
    primaryContact: { /* unchanged */
        contactName: string;
        contactEmail: string;
        contactPhone?: string;
        role: string;
        department?: string;
        isPrimary?: boolean;
        feedbackInvite?: boolean;
        notes?: string;
    };
}
```

- [ ] **Step 2: Validate `quoteValidUntil >= quoteDate`**

After the existing `if (!input.primaryContact.contactName ...)` validation, add:

```ts
    if (input.quoteValidUntil && input.quoteDate && input.quoteValidUntil < input.quoteDate) {
        throw new Error('quoteValidUntil must be on or after quoteDate');
    }
```

- [ ] **Step 3: Persist field in DynamoDB item**

In the `orderItem` object literal, add the field next to `quoteDate`:

```ts
        quoteDate: input.quoteDate,
        quoteValidUntil: input.quoteValidUntil,
        estimatedDelivery: input.estimatedDelivery,
```

- [ ] **Step 4: Type-check**

Run: `cd amplify/functions/order-api && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add amplify/functions/order-api/resolvers/createOrder.ts
git commit -m "feat(orders): persist quoteValidUntil in createOrder with validation"
```

---

### Task 7: Lambda updateOrder — accept, validate, log changes

**Files:**
- Modify: `amplify/functions/order-api/resolvers/updateOrder.ts`

- [ ] **Step 1: Add field to input and updatable list**

```ts
interface UpdateOrderInput {
    quoteNumber?: string;
    poNumber?: string;
    institution?: string;
    department?: string;
    productModel?: string;
    productName?: string;
    configuration?: string;
    quoteAmount?: number;
    quoteDate?: string;
    quoteValidUntil?: string;
    estimatedDelivery?: string;
    notes?: string;
}

const UPDATABLE_FIELDS = [
    'quoteNumber', 'poNumber', 'institution', 'department',
    'productModel', 'productName', 'configuration', 'quoteAmount',
    'quoteDate', 'quoteValidUntil',
    'estimatedDelivery', 'notes',
];
```

- [ ] **Step 2: Add validation against the existing or incoming quoteDate**

After `if (!existing) { throw ... }`, add:

```ts
    const effectiveQuoteDate = input.quoteDate ?? (existing.quoteDate as string | undefined);
    if (input.quoteValidUntil && effectiveQuoteDate && input.quoteValidUntil < effectiveQuoteDate) {
        throw new Error('quoteValidUntil must be on or after quoteDate');
    }
```

- [ ] **Step 3: Append an OrderLog entry when validUntil changes**

After the `UpdateCommand` send, before returning, add:

```ts
    if (input.quoteValidUntil !== undefined && input.quoteValidUntil !== existing.quoteValidUntil) {
        const now = new Date().toISOString();
        const { PutCommand } = await import('@aws-sdk/lib-dynamodb');
        const { getOperatorInfo } = await import('../lib/types.js');
        const { email: operator } = getOperatorInfo(event);
        await docClient.send(new PutCommand({
            TableName: TABLE_NAME(),
            Item: {
                PK: `ORDER#${orderId}`,
                SK: `LOG#${now}`,
                action: 'QUOTE_VALIDITY_UPDATED',
                operator,
                timestamp: now,
                detail: `Quote valid until: ${existing.quoteValidUntil ?? '(none)'} → ${input.quoteValidUntil ?? '(none)'}`,
            },
        }));
    }
```

(Replace dynamic imports with static top-of-file imports if you prefer; the file currently uses static imports — match the file's style by hoisting `PutCommand` and `getOperatorInfo` to the top.)

Final hoisted version of the imports at top of file:

```ts
import { UpdateCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../lib/dynamodb.js';
import { fetchOrder, buildFullOrderResponse } from '../lib/orderHelper.js';
import { getOperatorInfo } from '../lib/types.js';
import type { AppSyncEvent } from '../lib/types.js';
```

And the inline block becomes:

```ts
    if (input.quoteValidUntil !== undefined && input.quoteValidUntil !== existing.quoteValidUntil) {
        const now = new Date().toISOString();
        const { email: operator } = getOperatorInfo(event);
        await docClient.send(new PutCommand({
            TableName: TABLE_NAME(),
            Item: {
                PK: `ORDER#${orderId}`,
                SK: `LOG#${now}`,
                action: 'QUOTE_VALIDITY_UPDATED',
                operator,
                timestamp: now,
                detail: `Quote valid until: ${existing.quoteValidUntil ?? '(none)'} → ${input.quoteValidUntil ?? '(none)'}`,
            },
        }));
    }
```

- [ ] **Step 4: Type-check**

Run: `cd amplify/functions/order-api && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add amplify/functions/order-api/resolvers/updateOrder.ts
git commit -m "feat(orders): updateOrder accepts quoteValidUntil with log + validation"
```

---

### Task 8: Lambda orderHelper — return `quoteValidUntil` in response

**Files:**
- Modify: `amplify/functions/order-api/lib/orderHelper.ts:53-101`

- [ ] **Step 1: Add field to buildOrderResponse**

In `buildOrderResponse`, after `quoteDate: order.quoteDate || null,` add:

```ts
        quoteDate: order.quoteDate || null,
        quoteValidUntil: order.quoteValidUntil || null,
        poDate: order.poDate || null,
```

- [ ] **Step 2: Type-check**

Run: `cd amplify/functions/order-api && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add amplify/functions/order-api/lib/orderHelper.ts
git commit -m "feat(orders): expose quoteValidUntil in order response builder"
```

---

### Task 9: Lambda orderStats — count `expiredQuotes`

**Files:**
- Modify: `amplify/functions/order-api/resolvers/orderStats.ts`

- [ ] **Step 1: Query QUOTE_SENT orders and count expired**

Replace the existing `// Count upcoming deliveries` block and the final `return` with:

```ts
    // Count upcoming deliveries (estimatedDelivery in next 30 days)
    let upcomingDeliveries = 0;
    let overdueOrders = 0;
    const now = new Date();
    const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const today = now.toISOString().slice(0, 10);
    const futureDate = thirtyDaysLater.toISOString().slice(0, 10);

    // Check active orders for delivery dates
    const activeStatuses = ['PO_RECEIVED', 'IN_PRODUCTION', 'SHIPPED'];
    for (const status of activeStatuses) {
        const result = await docClient.send(new QueryCommand({
            TableName: TABLE_NAME(),
            IndexName: 'GSI1',
            KeyConditionExpression: 'GSI1PK = :pk',
            ExpressionAttributeValues: { ':pk': `ORDER_STATUS#${status}` },
        }));
        for (const order of result.Items || []) {
            const ed = order.estimatedDelivery as string | undefined;
            if (ed) {
                if (ed >= today && ed <= futureDate) {
                    upcomingDeliveries++;
                }
                if (ed < today && status !== 'SHIPPED') {
                    overdueOrders++;
                }
            }
        }
    }

    // Count expired quotes (QUOTE_SENT with quoteValidUntil < today)
    let expiredQuotes = 0;
    const quoteSentResult = await docClient.send(new QueryCommand({
        TableName: TABLE_NAME(),
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :pk',
        ExpressionAttributeValues: { ':pk': 'ORDER_STATUS#QUOTE_SENT' },
    }));
    for (const order of quoteSentResult.Items || []) {
        const vu = order.quoteValidUntil as string | undefined;
        if (vu && vu < today) {
            expiredQuotes++;
        }
    }

    return {
        totalActive,
        byStatus,
        avgDaysToInstall,
        upcomingDeliveries,
        overdueOrders,
        expiredQuotes,
    };
}
```

- [ ] **Step 2: Type-check**

Run: `cd amplify/functions/order-api && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add amplify/functions/order-api/resolvers/orderStats.ts
git commit -m "feat(orders): orderStats includes expiredQuotes count"
```

---

### Task 10: Lambda tests — extend handler.test.ts

**Files:**
- Modify: `amplify/functions/order-api/handler.test.ts`

- [ ] **Step 1: Add createOrder test for quoteValidUntil**

Find the existing `describe('createOrder'`, ...)` block. Add a new `it(...)` test inside it:

```ts
    it('persists quoteValidUntil and rejects validUntil < quoteDate', async () => {
        mockPut.mockResolvedValue({});
        mockGet.mockResolvedValue({
            Item: { PK: 'ORDER#x', SK: 'META', orderId: 'x', status: 'INQUIRY', institution: 'I', productModel: 'ICP', createdAt: 't', updatedAt: 't', createdBy: 'a', source: 'MANUAL', feedbackScheduleCreated: false, quoteDate: '2026-05-01', quoteValidUntil: '2026-06-01' },
        });
        mockQuery.mockResolvedValue({ Items: [] });

        await handler(makeAppSyncEvent('createOrder', {
            input: JSON.stringify({
                institution: 'I',
                productModel: 'ICP',
                quoteDate: '2026-05-01',
                quoteValidUntil: '2026-06-01',
                primaryContact: { contactName: 'N', contactEmail: 'e@x.com', role: 'PI' },
            }),
        }, 'Mutation'));

        const putCalls = mockPut.mock.calls;
        const orderPut = putCalls.find(c => mockPut.mock.results[putCalls.indexOf(c)]);
        expect(orderPut).toBeTruthy();
        // Verify the field flowed into a Put — assert via the implementation arg
        const orderItem = (mockSend.mock.calls.find(c => (c[0] as { Item?: { quoteValidUntil?: string } }).Item?.quoteValidUntil)?.[0] as { Item: { quoteValidUntil: string } }).Item;
        expect(orderItem.quoteValidUntil).toBe('2026-06-01');

        await expect(handler(makeAppSyncEvent('createOrder', {
            input: JSON.stringify({
                institution: 'I',
                productModel: 'ICP',
                quoteDate: '2026-06-01',
                quoteValidUntil: '2026-05-01',
                primaryContact: { contactName: 'N', contactEmail: 'e@x.com', role: 'PI' },
            }),
        }, 'Mutation'))).rejects.toThrow(/quoteValidUntil/);
    });
```

- [ ] **Step 2: Add updateOrder test for log + validation**

Inside the existing `describe('updateOrder'` block (or near other update tests), add:

```ts
    it('writes QUOTE_VALIDITY_UPDATED log when validUntil changes', async () => {
        mockGet.mockResolvedValue({
            Item: {
                PK: 'ORDER#x', SK: 'META', orderId: 'x', status: 'QUOTE_SENT',
                institution: 'I', productModel: 'ICP',
                createdAt: 't', updatedAt: 't', createdBy: 'a', source: 'MANUAL',
                feedbackScheduleCreated: false,
                quoteDate: '2026-05-01', quoteValidUntil: '2026-05-31',
            },
        });
        mockUpdate.mockResolvedValue({});
        mockPut.mockResolvedValue({});
        mockQuery.mockResolvedValue({ Items: [] });

        await handler(makeAppSyncEvent('updateOrder', {
            orderId: 'x',
            input: JSON.stringify({ quoteValidUntil: '2026-06-15' }),
        }, 'Mutation'));

        const logPut = mockSend.mock.calls
            .map(c => c[0] as { Item?: { action?: string } })
            .find(arg => arg.Item?.action === 'QUOTE_VALIDITY_UPDATED');
        expect(logPut).toBeTruthy();
    });

    it('rejects update with validUntil before quoteDate', async () => {
        mockGet.mockResolvedValue({
            Item: {
                PK: 'ORDER#x', SK: 'META', orderId: 'x', status: 'QUOTE_SENT',
                institution: 'I', productModel: 'ICP',
                createdAt: 't', updatedAt: 't', createdBy: 'a', source: 'MANUAL',
                feedbackScheduleCreated: false,
                quoteDate: '2026-05-15',
            },
        });
        await expect(handler(makeAppSyncEvent('updateOrder', {
            orderId: 'x',
            input: JSON.stringify({ quoteValidUntil: '2026-05-01' }),
        }, 'Mutation'))).rejects.toThrow(/quoteValidUntil/);
    });
```

- [ ] **Step 3: Add orderStats test for expiredQuotes**

Inside the existing `describe('orderStats'` block, add:

```ts
    it('counts QUOTE_SENT orders with past quoteValidUntil as expiredQuotes', async () => {
        const today = new Date().toISOString().slice(0, 10);
        const past = '2020-01-01';
        const future = '2099-01-01';

        mockQuery.mockImplementation(() => {
            // Return zero for every status except QUOTE_SENT (which we return below per call sequence)
            return Promise.resolve({ Count: 0, Items: [] });
        });

        // Override only the QUOTE_SENT scan — the resolver issues distinct Query calls per status,
        // so we use a sequence-aware mock by intercepting the QueryCommand argument.
        mockSend.mockImplementation((cmd: { ExpressionAttributeValues?: Record<string, string> }) => {
            const pk = cmd.ExpressionAttributeValues?.[':pk'];
            if (pk === 'ORDER_STATUS#QUOTE_SENT') {
                return Promise.resolve({
                    Count: 3,
                    Items: [
                        { quoteValidUntil: past },
                        { quoteValidUntil: past },
                        { quoteValidUntil: future },
                    ],
                });
            }
            return Promise.resolve({ Count: 0, Items: [] });
        });

        const result = await handler(makeAppSyncEvent('orderStats', {}, 'Query'));
        expect(result.expiredQuotes).toBe(2);

        // Reset shared mock for downstream tests
        mockSend.mockReset();
    });
```

> **Note:** if the orderStats test's `mockSend` override interferes with later tests, rebuild the mock chain in an `afterEach` or move this test to the end of its describe block. The reset call above guards against bleed.

- [ ] **Step 4: Run the Lambda test suite**

Run: `cd amplify/functions/order-api && npx vitest run handler.test.ts`
Expected: PASS — all existing + 4 new tests green.

- [ ] **Step 5: Commit**

```bash
git add amplify/functions/order-api/handler.test.ts
git commit -m "test(orders): cover quoteValidUntil create/update/stats"
```

---

### Task 11: CreateOrderPage — add `quoteValidUntil` input with linkage

**Files:**
- Modify: `src/pages/admin/CreateOrderPage.tsx`

- [ ] **Step 1: Add state and linkage logic**

In `CreateOrderPage` (around the existing date hooks at line 29–30):

```tsx
  // Dates
  const [quoteDate, setQuoteDate] = useState(new Date().toISOString().split('T')[0]);
  const [quoteValidUntil, setQuoteValidUntil] = useState('');
  const [validUntilTouched, setValidUntilTouched] = useState(false);
  const [estimatedDelivery, setEstimatedDelivery] = useState('');
```

Add an effect import at the top:

```tsx
import { useState, useEffect } from 'react';
import { addDaysISO } from '../../lib/orderHelpers';
```

Add the linkage effect immediately after the state declarations:

```tsx
  // Auto-default validUntil to quoteDate + 30 days while user hasn't touched it
  useEffect(() => {
    if (validUntilTouched) return;
    setQuoteValidUntil(quoteDate ? addDaysISO(quoteDate, 30) : '');
  }, [quoteDate, validUntilTouched]);
```

- [ ] **Step 2: Add validation in handleSubmit**

Inside `handleSubmit`, after the existing required-fields check, add:

```tsx
    if (quoteValidUntil && quoteDate && quoteValidUntil < quoteDate) {
      setError('Quote Valid Until must be on or after Quote Date.');
      return;
    }
```

In the `svc.createOrder({ ... })` call, add the field after `quoteDate`:

```tsx
        quoteDate: quoteDate || undefined,
        quoteValidUntil: quoteValidUntil || undefined,
        estimatedDelivery: estimatedDelivery || undefined,
```

- [ ] **Step 3: Add the input next to Quote Date**

In the JSX under the Dates section (around line 265), change the grid to include the new input. Replace the existing `<div className="grid grid-cols-2 gap-4">` block in Section 4 with:

```tsx
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">
                Quote Date
              </label>
              <input
                type="date"
                value={quoteDate}
                onChange={(e) => setQuoteDate(e.target.value)}
                className="w-full bg-surface-container-low border-none rounded-lg py-2.5 px-3 text-sm focus:ring-1 focus:ring-secondary focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">
                Quote Valid Until
              </label>
              <input
                type="date"
                value={quoteValidUntil}
                min={quoteDate || undefined}
                onChange={(e) => {
                  setValidUntilTouched(true);
                  setQuoteValidUntil(e.target.value);
                }}
                className="w-full bg-surface-container-low border-none rounded-lg py-2.5 px-3 text-sm focus:ring-1 focus:ring-secondary focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">
                Estimated Delivery
              </label>
              <input
                type="date"
                value={estimatedDelivery}
                onChange={(e) => setEstimatedDelivery(e.target.value)}
                className="w-full bg-surface-container-low border-none rounded-lg py-2.5 px-3 text-sm focus:ring-1 focus:ring-secondary focus:outline-none"
              />
            </div>
          </div>
```

- [ ] **Step 4: Type-check and run dev server**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Verify in browser via preview**

Use preview tools (start preview, navigate to `/admin/orders/new`, check that "Quote Valid Until" defaults to quoteDate + 30 days, that changing quoteDate updates it, and that manually editing it then changing quoteDate no longer auto-updates).

- [ ] **Step 6: Commit**

```bash
git add src/pages/admin/CreateOrderPage.tsx
git commit -m "feat(orders): CreateOrderPage adds Quote Valid Until input with linkage"
```

---

### Task 12: EditSpecsDialog — add `quoteDate` and `quoteValidUntil` fields

**Files:**
- Modify: `src/components/admin/EditSpecsDialog.tsx`
- Modify: `src/pages/admin/OrderDetailPage.tsx:369-388` (props passed)

- [ ] **Step 1: Extend dialog state and props**

In `EditSpecsDialog.tsx`, extend the `initial` prop type and state:

```tsx
import { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { PRODUCT_MODELS } from '../../types/admin';
import { addDaysISO } from '../../lib/orderHelpers';
```

```tsx
  initial: {
    productModel?: string | null;
    productName?: string | null;
    configuration?: string | null;
    quoteAmount?: number | null;
    quoteNumber?: string | null;
    poNumber?: string | null;
    department?: string | null;
    quoteDate?: string | null;
    quoteValidUntil?: string | null;
  };
```

```tsx
  const [quoteDate, setQuoteDate] = useState(initial.quoteDate || '');
  const [quoteValidUntil, setQuoteValidUntil] = useState(initial.quoteValidUntil || '');
  const [validUntilTouched, setValidUntilTouched] = useState(Boolean(initial.quoteValidUntil));

  useEffect(() => {
    if (validUntilTouched) return;
    setQuoteValidUntil(quoteDate ? addDaysISO(quoteDate, 30) : '');
  }, [quoteDate, validUntilTouched]);

  const dateInvalid = Boolean(quoteValidUntil && quoteDate && quoteValidUntil < quoteDate);
```

- [ ] **Step 2: Include fields in `updates` and disable submit on invalid date**

In `handleSubmit`, add to the `updates` object:

```tsx
      const updates: Record<string, unknown> = {
        productModel: productModel || null,
        productName: productName || null,
        configuration: configuration || null,
        quoteAmount: quoteAmountRaw ? quoteAmountNum : null,
        quoteNumber: quoteNumber || null,
        poNumber: poNumber || null,
        department: department || null,
        quoteDate: quoteDate || null,
        quoteValidUntil: quoteValidUntil || null,
      };
```

And the early return guard:

```tsx
    if (amountInvalid || dateInvalid) return;
```

Update the disabled prop on the Save button:

```tsx
disabled={submitting || amountInvalid || dateInvalid}
```

- [ ] **Step 3: Render the two inputs in the dialog body**

After the existing `<div className="grid grid-cols-2 gap-4">` block that holds `PO Number` and `Department`, add a new grid row:

```tsx
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Quote Date</label>
            <input
              type="date"
              value={quoteDate}
              onChange={(e) => setQuoteDate(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Quote Valid Until</label>
            <input
              type="date"
              value={quoteValidUntil}
              min={quoteDate || undefined}
              onChange={(e) => {
                setValidUntilTouched(true);
                setQuoteValidUntil(e.target.value);
              }}
              className={inputCls}
            />
            {dateInvalid && (
              <span className="text-error text-[10px] mt-1 block">Must be on or after Quote Date</span>
            )}
          </div>
        </div>
```

- [ ] **Step 4: Pass new fields from OrderDetailPage**

In `src/pages/admin/OrderDetailPage.tsx` (around line 374–382 where `EditSpecsDialog` is rendered), extend the `initial` object:

```tsx
          initial={{
            productModel: order.productModel,
            productName: order.productName,
            configuration: order.configuration,
            quoteAmount: order.quoteAmount,
            quoteNumber: order.quoteNumber,
            poNumber: order.poNumber,
            department: order.department,
            quoteDate: order.quoteDate,
            quoteValidUntil: order.quoteValidUntil,
          }}
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/EditSpecsDialog.tsx src/pages/admin/OrderDetailPage.tsx
git commit -m "feat(orders): EditSpecsDialog edits quoteDate and quoteValidUntil"
```

---

### Task 13: OrderDetailPage — render `Quote Valid Until` with status

**Files:**
- Modify: `src/pages/admin/OrderDetailPage.tsx`

- [ ] **Step 1: Import the helper**

At the top of the file (with other imports):

```tsx
import { quoteExpiryStatus, daysUntilExpiry } from '../../lib/orderHelpers';
```

- [ ] **Step 2: Render the field in the Product Specifications grid**

In the spec card grid (around lines 280–313), append a new cell after the `Created By` cell:

```tsx
              <div className="space-y-1">
                <label className="text-[0.6875rem] uppercase tracking-widest font-bold text-on-surface-variant/70">Quote Valid Until</label>
                {(() => {
                  const status = quoteExpiryStatus(order);
                  const remaining = daysUntilExpiry(order.quoteValidUntil ?? null);
                  if (!order.quoteValidUntil) {
                    return <p className="text-sm text-outline italic">-</p>;
                  }
                  const color = status === 'expired'
                    ? 'text-error'
                    : status === 'soon'
                      ? 'text-tertiary'
                      : 'text-on-surface';
                  const suffix = status === 'expired' && remaining !== null
                    ? ` (expired ${Math.abs(remaining)}d ago)`
                    : status === 'soon' && remaining !== null
                      ? ` (expires in ${remaining}d)`
                      : '';
                  return (
                    <p className={`text-sm font-semibold ${color}`}>
                      {order.quoteValidUntil}{suffix}
                    </p>
                  );
                })()}
              </div>
```

(If `text-tertiary` doesn't render amber in your Tailwind theme, substitute `text-amber-600` or the project's amber token — confirm by checking `tailwind.config.js` or rendered output.)

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/pages/admin/OrderDetailPage.tsx
git commit -m "feat(orders): OrderDetailPage shows Quote Valid Until with expiry styling"
```

---

### Task 14: OrderListPage — row badge, "Show expired only" filter, alert card

**Files:**
- Modify: `src/pages/admin/OrderListPage.tsx`

- [ ] **Step 1: Import the helper**

```tsx
import { quoteExpiryStatus, daysUntilExpiry, isQuoteExpired } from '../../lib/orderHelpers';
```

- [ ] **Step 2: Add `expiredOnly` filter state**

After the existing `const [search, setSearch] = useState('');`:

```tsx
  const [expiredOnly, setExpiredOnly] = useState(false);
```

- [ ] **Step 3: Apply the filter in the existing `filtered` memo**

Replace the body of the `filtered` useMemo with:

```tsx
  const filtered = useMemo(() => {
    let list = orders;
    if (expiredOnly) list = list.filter(o => isQuoteExpired(o));
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(o =>
      o.institution.toLowerCase().includes(q) ||
      o.quoteNumber?.toLowerCase().includes(q) ||
      o.poNumber?.toLowerCase().includes(q) ||
      o.productModel.toLowerCase().includes(q) ||
      o.productName?.toLowerCase().includes(q),
    );
  }, [orders, search, expiredOnly]);
```

- [ ] **Step 4: Render the checkbox in the table header bar**

Inside the existing toolbar (the `<div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 md:gap-3">`, around line 196), add as a new sibling **before** the status `<select>`:

```tsx
              <label className="flex items-center gap-2 text-xs text-on-surface-variant cursor-pointer">
                <input
                  type="checkbox"
                  checked={expiredOnly}
                  onChange={(e) => setExpiredOnly(e.target.checked)}
                  className="rounded border-outline-variant"
                />
                Show expired only
              </label>
```

- [ ] **Step 5: Add a badge component and render it in both row layouts**

Define a small inline component near the top of the file (after `formatCurrency`):

```tsx
function ExpiryBadge({ order }: { order: { status: string; quoteValidUntil?: string | null } }) {
  const status = quoteExpiryStatus(order as Parameters<typeof quoteExpiryStatus>[0]);
  if (status === 'none' || status === 'ok') return null;
  const remaining = daysUntilExpiry(order.quoteValidUntil ?? null);
  if (status === 'expired') {
    return (
      <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-error-container text-on-error-container">
        Expired
      </span>
    );
  }
  return (
    <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-tertiary-fixed text-on-tertiary-fixed-variant">
      Expires in {remaining}d
    </span>
  );
}
```

In the **mobile** card (around line 230, immediately after `<StatusBadge status={order.status} />`):

```tsx
                  <StatusBadge status={order.status} />
                  <ExpiryBadge order={order} />
```

In the **desktop** table row (around line 294, in the Status `<td>`):

```tsx
                    <td className="px-6 py-5">
                      <StatusBadge status={order.status} />
                      <ExpiryBadge order={order} />
                    </td>
```

- [ ] **Step 6: Add an "Expired Quotes" alert card to the summary panel**

In the right column summary panel (around line 369, after the Stalled Transmission Alert), add a new alert card. First, compute the count:

```tsx
  const expiredCount = useMemo(
    () => orders.filter(o => isQuoteExpired(o)).length,
    [orders],
  );
```

Then add the rendered card after the stalled-order block (closing brace at line 391):

```tsx
          {expiredCount > 0 && (
            <div className="p-6 border border-outline-variant/20 rounded-xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded bg-error-container flex items-center justify-center">
                  <span className="material-symbols-outlined text-on-error-container">schedule</span>
                </div>
                <div>
                  <p className="text-xs font-bold text-on-surface">Expired Quotes</p>
                  <p className="text-[10px] text-on-surface-variant uppercase tracking-tighter">{expiredCount} need re-issue</p>
                </div>
              </div>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                {expiredCount} sent quote{expiredCount !== 1 ? 's have' : ' has'} passed its validity date.
              </p>
              <button
                onClick={() => { setExpiredOnly(true); setStatusFilter('All'); }}
                className="mt-4 w-full py-2 bg-surface text-[10px] font-bold uppercase tracking-widest border border-outline-variant/30 hover:bg-surface-container-low transition-colors rounded flex items-center justify-center text-on-surface"
              >
                Filter Expired
              </button>
            </div>
          )}
```

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 8: Browser verification**

Start preview server, navigate to `/admin/orders`. Confirm:
- A `QUOTE_SENT` order with a past `quoteValidUntil` shows the red `Expired` badge in both the desktop row and mobile card.
- "Show expired only" checkbox filters the list.
- The "Expired Quotes" alert card appears in the right panel when `expiredCount > 0`, and clicking "Filter Expired" toggles the checkbox.
- An order whose `quoteValidUntil` is within 7 days renders the amber `Expires in Nd` badge.

If no real data exists, manually set a test record's `quoteValidUntil` via the new edit dialog (Task 12) before running this verification.

- [ ] **Step 9: Commit**

```bash
git add src/pages/admin/OrderListPage.tsx
git commit -m "feat(orders): OrderListPage shows expiry badge, filter, and alert card"
```

---

### Task 15: CreateOrderPage component test (introduces RTL to the project)

**Files:**
- Modify: `package.json` — add `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom` dev deps
- Modify: `vitest.config.ts` — add `environment: 'jsdom'` and setup file
- Create: `src/test-setup.ts`
- Create: `src/pages/admin/CreateOrderPage.test.tsx`

> **Note:** This project currently has no React component tests (only `src/services/behaviorAnalytics.test.ts`). This task introduces React Testing Library because the spec calls for a CreateOrderPage component test. If you'd rather rely on the browser smoke test in Task 11 Step 5 and skip this task, raise that with the user before proceeding.

- [ ] **Step 1: Install dev dependencies**

Run:
```bash
npm install --save-dev @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

- [ ] **Step 2: Update vitest config**

Read `vitest.config.ts`. If the `test` block lacks `environment`, add:

```ts
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    // preserve any existing options
  },
```

- [ ] **Step 3: Create the setup file**

Create `src/test-setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 4: Write the component test**

Create `src/pages/admin/CreateOrderPage.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { CreateOrderPage } from './CreateOrderPage';

vi.mock('../../services/orderAdminService', () => ({
  createOrder: vi.fn().mockResolvedValue({ orderId: 'new1' }),
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <CreateOrderPage />
    </MemoryRouter>,
  );
}

describe('CreateOrderPage — quote validity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('defaults Quote Valid Until to Quote Date + 30 days', () => {
    renderPage();
    const quoteDate = screen.getByLabelText(/Quote Date/i) as HTMLInputElement;
    const validUntil = screen.getByLabelText(/Quote Valid Until/i) as HTMLInputElement;
    const today = new Date().toISOString().slice(0, 10);
    expect(quoteDate.value).toBe(today);
    const expected = new Date(quoteDate.value);
    expected.setUTCDate(expected.getUTCDate() + 30);
    expect(validUntil.value).toBe(expected.toISOString().slice(0, 10));
  });

  it('updates validUntil when quoteDate changes (untouched)', async () => {
    const user = userEvent.setup();
    renderPage();
    const quoteDate = screen.getByLabelText(/Quote Date/i) as HTMLInputElement;
    const validUntil = screen.getByLabelText(/Quote Valid Until/i) as HTMLInputElement;

    await user.clear(quoteDate);
    await user.type(quoteDate, '2026-06-01');
    expect(validUntil.value).toBe('2026-07-01');
  });

  it('freezes validUntil after the user edits it', async () => {
    const user = userEvent.setup();
    renderPage();
    const quoteDate = screen.getByLabelText(/Quote Date/i) as HTMLInputElement;
    const validUntil = screen.getByLabelText(/Quote Valid Until/i) as HTMLInputElement;

    await user.clear(validUntil);
    await user.type(validUntil, '2026-12-31');

    await user.clear(quoteDate);
    await user.type(quoteDate, '2026-06-01');

    expect(validUntil.value).toBe('2026-12-31');
  });
});
```

- [ ] **Step 5: Run the new test**

Run: `npx vitest run src/pages/admin/CreateOrderPage.test.tsx`
Expected: PASS — 3 tests green.

- [ ] **Step 6: Run the full test suite to ensure no regressions**

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/test-setup.ts src/pages/admin/CreateOrderPage.test.tsx
git commit -m "test(orders): CreateOrderPage component test for validUntil linkage"
```

---

### Task 16: Final verification

- [ ] **Step 1: Run all unit tests**

Run: `npm test`
Expected: PASS — no failures across frontend and Lambda suites.

- [ ] **Step 2: Type-check whole repo**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Visual smoke test in dev server**

Start preview server (`npm run dev` via preview tools). Walk the full flow:
1. `/admin/orders/new` — create an order with a custom validUntil; confirm linkage (default = quoteDate+30, manual edit freezes auto-recompute).
2. `/admin/orders/:id` — open the edit specs dialog; change validUntil; confirm activity log entry appears with action `QUOTE_VALIDITY_UPDATED`.
3. `/admin/orders` — confirm the badge, the "Show expired only" filter, and the alert card.

- [ ] **Step 5: Final commit if any tweaks made during smoke test**

```bash
git add -A
git commit -m "chore(orders): polish quote-expiration UI from smoke test"
```

(Skip if no changes.)

---

## Out of scope (do not implement)

- New `EXPIRED` enum value on `OrderStatus`.
- Background jobs, cron, or Lambda schedules for state transitions.
- Customer- or admin-facing email notifications.
- Bulk-edit / bulk-extend tooling.
- OCR/LLM extraction of validity from uploaded quotation PDFs.
- Backfill of `quoteValidUntil` for existing orders.
