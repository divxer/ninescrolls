# Order ↔ Logistics Cross-Link Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bidirectional admin navigation between an Order and its linked Logistics Case(s): a read-only "Related Logistics Cases" panel on the Order detail page, an exact-match `relatedOrderId` filter on `listLogisticsCases`, and a label polish on the existing reverse link.

**Architecture:** Backend gains one optional exact-match query arg (no new query/index). Frontend reuses the existing service + `useLogisticsCases` hook; a new `LogisticsPanel` (mirroring `DocumentsPanel`) renders summary rows on `OrderDetailPage`, hidden unless cases exist. The Logistics→Order reverse link already exists — only its label changes.

**Tech Stack:** AWS Amplify Gen2 (AppSync custom query + Lambda resolver), TypeScript, React, react-router-dom, vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-06-20-order-logistics-cross-link-design.md`

**Reference files to mirror:**
- `src/components/admin/DocumentsPanel.tsx` — `<DocumentsPanel orderId={...} />` self-contained panel pattern
- `src/pages/admin/OrderDetailPage.tsx:374-381` — right-column panel wiring
- `amplify/functions/logistics-api/resolvers/listLogisticsCases.ts` — existing filters

---

## File Structure

**Modify:**
- `amplify/data/resource.ts` — add `relatedOrderId` arg to `listLogisticsCases`
- `amplify/functions/logistics-api/resolvers/listLogisticsCases.ts` (+ `.test.ts`) — exact filter
- `src/services/logisticsAdminService.ts` (+ `.test.ts`) — pass `relatedOrderId` through
- `src/hooks/useLogisticsCases.ts` — add `relatedOrderId` option
- `src/pages/admin/OrderDetailPage.tsx` — render `LogisticsPanel`
- `src/pages/admin/LogisticsCaseDetailPage.tsx` (+ `.test.tsx`) — reverse-link relabel

**Create:**
- `src/components/admin/LogisticsPanel.tsx` (+ `.test.tsx`)

---

## Task 1: Backend — `relatedOrderId` exact-match filter

**Files:**
- Modify: `amplify/functions/logistics-api/resolvers/listLogisticsCases.ts`
- Modify: `amplify/data/resource.ts`
- Test: `amplify/functions/logistics-api/resolvers/listLogisticsCases.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `amplify/functions/logistics-api/resolvers/listLogisticsCases.test.ts` (inside the `describe('listLogisticsCases', …)` block, before its closing `});`):

```typescript
  it('filters by relatedOrderId (exact, trimmed)', async () => {
    send.mockResolvedValueOnce({
      Items: [
        item({ caseId: 'lc-1', relatedOrderId: 'ord-1' }),
        item({ caseId: 'lc-2', relatedOrderId: 'ord-2' }),
        item({ caseId: 'lc-3' }), // no relatedOrderId
      ],
      LastEvaluatedKey: undefined,
    });
    const res = await listLogisticsCases(evt({ relatedOrderId: '  ord-1  ' }));
    expect(res.items.map((it) => it.caseId)).toEqual(['lc-1']);
  });

  it('treats a null relatedOrderId (AppSync unset) as no filter', async () => {
    send.mockResolvedValueOnce({
      Items: [item({ caseId: 'lc-1', relatedOrderId: 'ord-1' }), item({ caseId: 'lc-2' })],
      LastEvaluatedKey: undefined,
    });
    const res = await listLogisticsCases(evt({ relatedOrderId: null }));
    expect(res.items).toHaveLength(2);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run amplify/functions/logistics-api/resolvers/listLogisticsCases.test.ts`
Expected: FAIL — the relatedOrderId test returns all 3 (filter not implemented yet).

- [ ] **Step 3: Add the filter to the resolver**

In `amplify/functions/logistics-api/resolvers/listLogisticsCases.ts`, add `relatedOrderId` to the destructured arguments type:

```typescript
  const { stage, caseType, customsRequired, relatedOrderId, search, limit = 50, nextToken } =
    event.arguments as {
      // AppSync sends explicitly-unset args as `null` (not `undefined`).
      stage?: string | null; caseType?: string | null; customsRequired?: boolean | null;
      relatedOrderId?: string | null;
      search?: string | null; limit?: number; nextToken?: string | null;
    };
```

Add a normalized filter value next to `term`:

```typescript
  const term = search?.trim() || undefined;
  const orderFilter = relatedOrderId?.trim() || undefined;
```

Add the clause to `passesFilters`:

```typescript
  const passesFilters = (it: Record<string, unknown>) =>
    (!stage || it.currentStage === stage)
    && (!caseType || it.caseType === caseType)
    && (customsRequired === undefined || customsRequired === null || it.customsRequired === customsRequired)
    && (!orderFilter || it.relatedOrderId === orderFilter)
    && (!term || matchesSearch(it, term));
```

- [ ] **Step 4: Add the schema argument**

In `amplify/data/resource.ts`, in the `listLogisticsCases` query `.arguments({ ... })` block, add `relatedOrderId`:

```typescript
  listLogisticsCases: a
    .query()
    .arguments({
      stage: a.ref('LogisticsStage'),
      caseType: a.ref('CaseType'),
      customsRequired: a.boolean(),
      relatedOrderId: a.string(),
      search: a.string(),
      limit: a.integer(),
      nextToken: a.string(),
    })
    .returns(a.ref('LogisticsCaseConnection').required())
    .handler(a.handler.function(logisticsApi))
    .authorization((allow) => [allow.authenticated()]),
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run amplify/functions/logistics-api/resolvers/listLogisticsCases.test.ts`
Expected: PASS (all, including the 2 new tests).
Run: `npx tsc --noEmit 2>&1 | grep -iE "listLogisticsCases|data/resource" || echo clean`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add amplify/functions/logistics-api/resolvers/listLogisticsCases.ts amplify/functions/logistics-api/resolvers/listLogisticsCases.test.ts amplify/data/resource.ts
git commit -m "feat(logistics): add exact-match relatedOrderId filter to listLogisticsCases"
```

---

## Task 2: Service — pass `relatedOrderId` through

**Files:**
- Modify: `src/services/logisticsAdminService.ts`
- Test: `src/services/logisticsAdminService.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/services/logisticsAdminService.test.ts` inside the `describe('logisticsAdminService', …)` block:

```typescript
  it('listLogisticsCases forwards relatedOrderId as its own arg, not via search', async () => {
    queries.listLogisticsCases.mockResolvedValueOnce({ data: { items: [], nextToken: null }, errors: null });
    await listLogisticsCases({ relatedOrderId: 'ord-1' });
    const args = queries.listLogisticsCases.mock.calls[0][0];
    expect(args.relatedOrderId).toBe('ord-1');
    expect(args.search).toBeUndefined(); // never conflated with fuzzy search
  });
```

> Note: this test file mocks `client().queries.listLogisticsCases` (the auto-client), which is correct — the service still uses `client().queries.listLogisticsCases`. (The earlier explicit-`graphql` experiment was reverted; the real fix for the empty list was the resolver's null-arg handling.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/services/logisticsAdminService.test.ts`
Expected: FAIL — `args.relatedOrderId` is undefined (service doesn't pass it yet).

- [ ] **Step 3: Add `relatedOrderId` to the service**

In `src/services/logisticsAdminService.ts`, add `relatedOrderId` to the `ListLogisticsArgs` interface and forward it:

```typescript
interface ListLogisticsArgs {
  stage?: string;
  caseType?: string;
  customsRequired?: boolean;
  relatedOrderId?: string;
  search?: string;
  limit?: number;
  nextToken?: string;
}

export async function listLogisticsCases(opts: ListLogisticsArgs = {}) {
  const args: Record<string, unknown> = {};
  if (opts.stage) args.stage = opts.stage;
  if (opts.caseType) args.caseType = opts.caseType;
  if (opts.customsRequired !== undefined) args.customsRequired = opts.customsRequired;
  if (opts.relatedOrderId) args.relatedOrderId = opts.relatedOrderId;
  if (opts.search) args.search = opts.search;
  if (opts.limit) args.limit = opts.limit;
  if (opts.nextToken) args.nextToken = opts.nextToken;
  const { data, errors } = await client().queries.listLogisticsCases(args as any, AUTH);
  if (errors?.length) throw new Error(errors.map((e) => e.message).join(', '));
  return unwrapPayload(data);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/services/logisticsAdminService.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/logisticsAdminService.ts src/services/logisticsAdminService.test.ts
git commit -m "feat(logistics-ui): service forwards relatedOrderId filter"
```

---

## Task 3: Hook — `relatedOrderId` option

**Files:**
- Modify: `src/hooks/useLogisticsCases.ts`
- Test: `src/hooks/useLogisticsCases.test.tsx`

- [ ] **Step 1: Write the failing test**

Append to `src/hooks/useLogisticsCases.test.tsx` inside the `describe('useLogisticsCases', …)` block:

```typescript
  it('forwards relatedOrderId to the service', async () => {
    svc.listLogisticsCases.mockResolvedValueOnce({ items: [], nextToken: null });
    const { result } = renderHook(() => useLogisticsCases({ relatedOrderId: 'ord-1' }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(svc.listLogisticsCases).toHaveBeenCalledWith(
      expect.objectContaining({ relatedOrderId: 'ord-1' }),
    );
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/hooks/useLogisticsCases.test.tsx`
Expected: FAIL — `relatedOrderId` not forwarded (the call won't contain it).

- [ ] **Step 3: Add the option to the hook**

In `src/hooks/useLogisticsCases.ts`, add `relatedOrderId` to the options interface and the two service calls (initial + `loadMore`):

```typescript
interface UseLogisticsCasesOptions {
  stage?: string;
  caseType?: string;
  customsRequired?: boolean;
  relatedOrderId?: string;
  search?: string;
  pageSize?: number;
}

export function useLogisticsCases(options: UseLogisticsCasesOptions = {}) {
  const { stage, caseType, customsRequired, relatedOrderId, search, pageSize = 50 } = options;
  // ... (state declarations unchanged) ...

  const fetchFirstPage = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setNextToken(null);
    svc.listLogisticsCases({ stage, caseType, customsRequired, relatedOrderId, search, limit: pageSize })
      .then((data) => {
        if (cancelled) return;
        setCases((data?.items as LogisticsCase[]) || []);
        setNextToken((data?.nextToken as string | null) ?? null);
        setLoading(false);
      })
      .catch((err) => { if (!cancelled) { setError(err); setLoading(false); } });
    return () => { cancelled = true; };
  }, [stage, caseType, customsRequired, relatedOrderId, search, pageSize]);

  const loadMore = useCallback(() => {
    if (!nextToken || loadingMore) return;
    setLoadingMore(true);
    svc.listLogisticsCases({ stage, caseType, customsRequired, relatedOrderId, search, limit: pageSize, nextToken })
      .then((data) => {
        setCases((prev) => [...prev, ...((data?.items as LogisticsCase[]) || [])]);
        setNextToken((data?.nextToken as string | null) ?? null);
        setLoadingMore(false);
      })
      .catch((err) => { setError(err); setLoadingMore(false); });
  }, [nextToken, loadingMore, stage, caseType, customsRequired, relatedOrderId, search, pageSize]);

  // ... (refresh wrapper, useEffect, return unchanged) ...
}
```

> Only `useLogisticsCases` changes — `useLogisticsCase` and `useLogisticsStats` are untouched. Apply the edits to the existing function (add `relatedOrderId` to the options type, the destructure, both `svc.listLogisticsCases({...})` calls, and both `useCallback` dependency arrays).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/hooks/useLogisticsCases.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useLogisticsCases.ts src/hooks/useLogisticsCases.test.tsx
git commit -m "feat(logistics-ui): useLogisticsCases accepts relatedOrderId option"
```

---

## Task 4: `LogisticsPanel` component

**Files:**
- Create: `src/components/admin/LogisticsPanel.tsx`
- Test: `src/components/admin/LogisticsPanel.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/admin/LogisticsPanel.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../hooks/useLogisticsCases');
import { useLogisticsCases } from '../../hooks/useLogisticsCases';
import { LogisticsPanel } from './LogisticsPanel';

const mockHook = (over: Record<string, unknown>) =>
  vi.mocked(useLogisticsCases).mockReturnValue({
    cases: [], loading: false, loadingMore: false, hasMore: false, error: null,
    refresh: vi.fn(), loadMore: vi.fn(), ...over,
  } as never);

beforeEach(() => vi.mocked(useLogisticsCases).mockReset());

describe('LogisticsPanel', () => {
  it('renders linked cases with caseNumber link, stage badge, and customs label', () => {
    mockHook({ cases: [{
      caseId: 'lc-1', caseNumber: 'NS-LOG-2026-0003', caseType: 'EQUIPMENT',
      currentStage: 'IN_TRANSIT', customsRequired: true, updatedAt: '2026-06-20T00:00:00Z',
    }] });
    render(<MemoryRouter><LogisticsPanel orderId="ord-1" /></MemoryRouter>);
    expect(screen.getByText('NS-LOG-2026-0003').closest('a')).toHaveAttribute('href', '/admin/logistics/lc-1');
    expect(screen.getByText('Equipment')).toBeInTheDocument();
    expect(screen.getByText('In Transit')).toBeInTheDocument();
    expect(screen.getByText('Customs required')).toBeInTheDocument();
  });

  it('renders nothing when there are no linked cases', () => {
    mockHook({ cases: [] });
    const { container } = render(<MemoryRouter><LogisticsPanel orderId="ord-1" /></MemoryRouter>);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing while loading', () => {
    mockHook({ cases: [], loading: true });
    const { container } = render(<MemoryRouter><LogisticsPanel orderId="ord-1" /></MemoryRouter>);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing and warns on error', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockHook({ cases: [], error: new Error('boom') });
    const { container } = render(<MemoryRouter><LogisticsPanel orderId="ord-1" /></MemoryRouter>);
    expect(container).toBeEmptyDOMElement();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/admin/LogisticsPanel.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `LogisticsPanel`**

Create `src/components/admin/LogisticsPanel.tsx`:

```tsx
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useLogisticsCases } from '../../hooks/useLogisticsCases';
import { StageBadge } from './StageBadge';
import { CASE_TYPE_LABELS, type CaseType } from '../../types/logistics';

export function LogisticsPanel({ orderId }: { orderId: string }) {
  const { cases, loading, error } = useLogisticsCases({ relatedOrderId: orderId });

  useEffect(() => {
    // Depend on the message (not the Error instance) so a new instance each render
    // doesn't re-warn on every render.
    if (error) console.warn('LogisticsPanel: failed to load related logistics cases —', error.message);
  }, [error?.message]);

  // Non-blocking: stay invisible while loading, on error, or when the order has no logistics.
  if (loading || error || !cases.length) return null;

  return (
    <section className="rounded-xl border border-outline-variant p-4 space-y-3">
      <h2 className="text-sm font-bold uppercase tracking-wider text-on-surface-variant">
        Related Logistics Cases
      </h2>
      <div className="divide-y divide-outline-variant">
        {cases.map((c) => (
          <div key={c.caseId} className="flex flex-wrap items-center gap-3 py-2 text-sm">
            <Link to={`/admin/logistics/${c.caseId}`} className="font-semibold text-primary hover:underline">
              {c.caseNumber}
            </Link>
            <span className="text-on-surface-variant">{CASE_TYPE_LABELS[c.caseType as CaseType]}</span>
            <StageBadge stage={c.currentStage} />
            <span className="text-xs text-on-surface-variant">
              {c.customsRequired ? 'Customs required' : 'No customs'}
            </span>
            <span className="ml-auto text-xs text-on-surface-variant">
              {new Date(c.updatedAt).toLocaleDateString('en-US')}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/admin/LogisticsPanel.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/LogisticsPanel.tsx src/components/admin/LogisticsPanel.test.tsx
git commit -m "feat(logistics-ui): read-only LogisticsPanel for an order (hidden when empty)"
```

---

## Task 5: Wire `LogisticsPanel` into `OrderDetailPage` (with wiring test)

**Files:**
- Modify: `src/pages/admin/OrderDetailPage.tsx`
- Test: `src/pages/admin/OrderDetailPage.test.tsx` (new — small wiring test)

A focused wiring test catches the easy-to-miss mistakes (forgot the import, wrong placement, wrong prop). It mocks `LogisticsPanel` as a sentinel and the order data hooks + sibling panels, then asserts the panel rendered with the order id.

- [ ] **Step 1: Write the failing wiring test**

Create `src/pages/admin/OrderDetailPage.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const mockOrder = {
  orderId: 'ord-1', status: 'INQUIRY', institution: 'Test University', department: 'Physics',
  productModel: 'ICP-RIE-200', productName: 'Etcher', configuration: 'Standard',
  quoteNumber: null, poNumber: null, quoteAmount: null, notes: null,
  quoteDate: null, quoteValidUntil: null, poDate: null, productionStartDate: null,
  shipDate: null, installDate: null, closeDate: null, rfqId: null,
  createdAt: '2026-01-01T00:00:00Z', createdBy: 'u', createdByEmail: 'u@x.com', contacts: [],
};

vi.mock('../../hooks/useOrders', () => ({
  useOrder: () => ({ order: mockOrder, loading: false, error: null, refresh: vi.fn() }),
  useOrderLogs: () => ({ logs: [], loading: false }),
}));
vi.mock('../../components/admin/ContactsPanel', () => ({ ContactsPanel: () => null }));
vi.mock('../../components/admin/DocumentsPanel', () => ({ DocumentsPanel: () => null }));
vi.mock('../../components/admin/ActivityLog', () => ({ ActivityLog: () => null }));
vi.mock('../../components/admin/LogisticsPanel', () => ({
  LogisticsPanel: ({ orderId }: { orderId: string }) => <div data-testid="logistics-panel">LP:{orderId}</div>,
}));

import { OrderDetailPage } from './OrderDetailPage';

describe('OrderDetailPage wiring', () => {
  it('renders LogisticsPanel with the order id', () => {
    render(
      <MemoryRouter initialEntries={['/admin/orders/ord-1']}>
        <Routes><Route path="/admin/orders/:orderId" element={<OrderDetailPage />} /></Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId('logistics-panel')).toHaveTextContent('LP:ord-1');
  });
});
```

> If `OrderDetailPage` reads an order field not in `mockOrder` and the render throws, add that field to `mockOrder` (it accesses: orderId, status, institution, department, productModel/productName/configuration, the quote/po/production/ship/install/close dates, quoteAmount, quoteNumber, poNumber, notes, rfqId, createdAt, createdBy, createdByEmail, contacts).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/pages/admin/OrderDetailPage.test.tsx`
Expected: FAIL — `logistics-panel` testid not found (panel not wired yet).

- [ ] **Step 3: Add the import**

In `src/pages/admin/OrderDetailPage.tsx`, alongside the other panel imports (near `DocumentsPanel`):

```typescript
import { LogisticsPanel } from '../../components/admin/LogisticsPanel';
```

- [ ] **Step 4: Render it in the right column**

In the right-column block (after `<DocumentsPanel orderId={order.orderId} currentStatus={order.status} />`, before `<ActivityLog .../>`), add:

```tsx
          <DocumentsPanel orderId={order.orderId} currentStatus={order.status} />

          <LogisticsPanel orderId={order.orderId} />

          <ActivityLog logs={logs} loading={logsLoading} />
```

- [ ] **Step 5: Run test to verify it passes + typecheck**

Run: `npx vitest run src/pages/admin/OrderDetailPage.test.tsx`
Expected: PASS.
Run: `npx tsc --noEmit 2>&1 | grep -iE "OrderDetailPage|LogisticsPanel" || echo clean`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/pages/admin/OrderDetailPage.tsx src/pages/admin/OrderDetailPage.test.tsx
git commit -m "feat(logistics-ui): show Related Logistics Cases on the order detail page"
```

---

## Task 6: Logistics detail — reverse-link label polish

**Files:**
- Modify: `src/pages/admin/LogisticsCaseDetailPage.tsx`
- Test: `src/pages/admin/LogisticsCaseDetailPage.test.tsx`

The reverse link already exists (`LogisticsCaseDetailPage.tsx:98-99`) with the correct rules. Only the label changes: `· Order {id}` → `Related Order: {id}`.

- [ ] **Step 1: Write the failing test**

Append to `src/pages/admin/LogisticsCaseDetailPage.test.tsx` inside the `describe('LogisticsCaseDetailPage', …)` block:

```typescript
  it('shows a labeled Related Order link when relatedOrderId is set', async () => {
    hooks.useLogisticsCase.mockReturnValue({
      logisticsCase: { ...sampleCase, relatedOrderId: 'ord-77' },
      loading: false, error: null, refresh: vi.fn(),
    });
    renderAt();
    await waitFor(() => expect(screen.getByText(/Related Order:/)).toBeInTheDocument());
    expect(screen.getByText('ord-77').closest('a')).toHaveAttribute('href', '/admin/orders/ord-77');
  });
```

> Uses the test file's existing `hooks.useLogisticsCase` mock, `sampleCase`, and `renderAt()` helper from the Task 6A detail tests.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/pages/admin/LogisticsCaseDetailPage.test.tsx`
Expected: FAIL — current label is `Order ord-77`, not `Related Order: ord-77`.

- [ ] **Step 3: Relabel the reverse link**

In `src/pages/admin/LogisticsCaseDetailPage.tsx`, change the related-order line (currently lines ~98-99):

```tsx
        {c.relatedOrderId && <> · Related Order: <Link className="text-primary hover:underline" to={`/admin/orders/${c.relatedOrderId}`}>{c.relatedOrderId}</Link></>}
        {!c.relatedOrderId && c.relatedEntityType && <> · Related: {c.relatedEntityType} {c.relatedEntityId}</>}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/pages/admin/LogisticsCaseDetailPage.test.tsx`
Expected: PASS (existing tests + the new one).

- [ ] **Step 5: Commit**

```bash
git add src/pages/admin/LogisticsCaseDetailPage.tsx src/pages/admin/LogisticsCaseDetailPage.test.tsx
git commit -m "feat(logistics-ui): label the reverse Order link as 'Related Order:'"
```

---

## Task 7: Final verification

**Files:** none.

- [ ] **Step 1: Full cross-link test sweep**

Run: `npx vitest run amplify/functions/logistics-api/resolvers/listLogisticsCases.test.ts src/services/logisticsAdminService.test.ts src/hooks/useLogisticsCases.test.tsx src/components/admin/LogisticsPanel.test.tsx src/pages/admin/OrderDetailPage.test.tsx src/pages/admin/LogisticsCaseDetailPage.test.tsx`
Expected: ALL PASS.

- [ ] **Step 2: Typecheck + build**

Run: `npx tsc --noEmit 2>&1 | grep -iE "logistic|OrderDetailPage" || echo clean`
Expected: clean.
Run: `npm run build 2>&1 | grep -E "built in|error TS" | head`
Expected: `✓ built in …` (ignore the post-build generate-seo NetworkError — unrelated).

- [ ] **Step 3: Commit any fixes**

```bash
git add -A && git commit -m "chore(logistics): cross-link verification fixes" || echo "nothing to commit"
```

---

## Done

Backend exact-match `relatedOrderId` filter + Order-side `LogisticsPanel` + Logistics-side reverse-link polish. The backend change requires an Amplify deploy to take effect on production (the `listLogisticsCases` schema/resolver change).

## Self-Review checklist (run after writing all tasks)

- Spec §3 backend filter (trim + null guard) → Task 1 ✓
- Spec §4 LogisticsPanel (3-state render, hidden when empty, console.warn on error, summary rows) → Task 4 ✓; service/hook plumbing → Tasks 2–3 ✓; OrderDetailPage wiring → Task 5 ✓
- Spec §5 reverse-link relabel only (no rebuild) → Task 6 ✓
- Spec §7 tests incl. "relatedOrderId not via search" → Task 2 ✓; null-arg no-filter + trimmed match → Task 1 ✓
- No leg expansion / no create-from-order → not present ✓
