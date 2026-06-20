# Order Search Selector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the free-text "Related order ID" input on `CreateLogisticsCasePage` with a searchable `OrderSearchSelector` that searches existing orders and stores the picked order's `orderId` (prefilling the customer when empty).

**Architecture:** A new controlled `OrderSearchSelector` component does a debounced `orderAdminService.listOrders({ search })` (server-side search already exists — no backend change), shows result rows, and on pick reports `{ orderId, institution }` to the parent. `CreateLogisticsCasePage` uses it for `relatedOrderId` only (never `relatedEntityType=ORDER`) and fills `customerName` from the order when the field is empty.

**Tech Stack:** React + TypeScript, vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-06-20-order-search-selector-design.md`

**Reference:**
- `src/services/orderAdminService.ts` — `listOrders({ search, limit })` returns `{ items, nextToken }`; order items have `orderId`, `quoteNumber`, `poNumber`, `institution`, `productModel`
- `src/pages/admin/OrderListPage.tsx:19,53` — the 300ms debounce idiom
- `src/pages/admin/CreateLogisticsCasePage.tsx` — the form being modified (free-text input at lines ~72-75)

---

## File Structure

**Create:**
- `src/components/admin/OrderSearchSelector.tsx` (+ `.test.tsx`) — debounced order search-and-pick

**Modify:**
- `src/pages/admin/CreateLogisticsCasePage.tsx` (+ `.test.tsx`) — swap the input for the selector; two labeled groups; fill `customerName` on select when empty

**Reuse (no change):**
- `src/services/orderAdminService.ts` — `listOrders`

---

## Task 1: `OrderSearchSelector` component

**Files:**
- Create: `src/components/admin/OrderSearchSelector.tsx`
- Test: `src/components/admin/OrderSearchSelector.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/components/admin/OrderSearchSelector.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../services/orderAdminService');
import { listOrders } from '../../services/orderAdminService';
import { OrderSearchSelector } from './OrderSearchSelector';

beforeEach(() => vi.mocked(listOrders).mockReset());

describe('OrderSearchSelector', () => {
  it('debounced-searches with the trimmed term and lets you pick an order', async () => {
    vi.mocked(listOrders).mockResolvedValue({
      items: [{ orderId: 'ord-1', institution: 'HORIBA', quoteNumber: 'NS-Q-2026-HRB-001', productModel: '4" RIE' }],
      nextToken: null,
    } as never);
    const onSelect = vi.fn();
    render(<OrderSearchSelector value="" onSelect={onSelect} />);
    fireEvent.change(screen.getByLabelText('Search order'), { target: { value: '  horiba  ' } });
    await waitFor(() => expect(listOrders).toHaveBeenCalledWith({ search: 'horiba', limit: 10 }));
    const row = await screen.findByText('NS-Q-2026-HRB-001');
    fireEvent.click(row);
    expect(onSelect).toHaveBeenCalledWith({ orderId: 'ord-1', institution: 'HORIBA' });
  });

  it('shows a plain "Linked order" label for a preset value and never reverse-looks-up', () => {
    render(<OrderSearchSelector value="ord-77" onSelect={vi.fn()} />);
    expect(screen.getByText('Linked order: ord-77')).toBeInTheDocument();
    expect(listOrders).not.toHaveBeenCalled();
  });

  it('uses selectedLabel for a preset value when provided', () => {
    render(<OrderSearchSelector value="ord-77" selectedLabel="NS-Q-9 · ACME" onSelect={vi.fn()} />);
    expect(screen.getByText('NS-Q-9 · ACME')).toBeInTheDocument();
  });

  it('clear calls onSelect(null)', () => {
    const onSelect = vi.fn();
    render(<OrderSearchSelector value="ord-77" onSelect={onSelect} />);
    fireEvent.click(screen.getByText('Clear'));
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it('does not call listOrders for an empty/whitespace query', () => {
    render(<OrderSearchSelector value="" onSelect={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Search order'), { target: { value: '   ' } });
    expect(listOrders).not.toHaveBeenCalled();
  });

  it('shows an inline error and does not throw on search failure', async () => {
    vi.mocked(listOrders).mockRejectedValueOnce(new Error('boom'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(<OrderSearchSelector value="" onSelect={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Search order'), { target: { value: 'x' } });
    expect(await screen.findByText('Search failed')).toBeInTheDocument();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/admin/OrderSearchSelector.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the component**

Create `src/components/admin/OrderSearchSelector.tsx`:

```tsx
import { useState, useEffect } from 'react';
import * as orderSvc from '../../services/orderAdminService';

interface OrderResult {
  orderId: string;
  institution: string;
  quoteNumber?: string | null;
  poNumber?: string | null;
  productModel?: string | null;
}

interface OrderSearchSelectorProps {
  value: string;                                   // current relatedOrderId ('' when none)
  onSelect: (order: { orderId: string; institution: string } | null) => void;
  selectedLabel?: string;                          // optional pre-known label for an existing value
}

const SEARCH_DEBOUNCE_MS = 300;

function orderLabel(o: OrderResult): string {
  return o.quoteNumber || o.poNumber || o.orderId;
}

export function OrderSearchSelector({ value, onSelect, selectedLabel }: OrderSearchSelectorProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<OrderResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<OrderResult | null>(null);

  useEffect(() => {
    const term = query.trim();
    if (!term) { setResults([]); setLoading(false); setError(false); return; }
    setLoading(true); setError(false);
    let cancelled = false;
    const t = setTimeout(() => {
      orderSvc.listOrders({ search: term, limit: 10 })
        .then((data) => {
          if (cancelled) return;
          setResults((data?.items as OrderResult[]) || []);
          setLoading(false);
        })
        .catch((e) => {
          if (cancelled) return;
          console.warn('OrderSearchSelector: order search failed —', e instanceof Error ? e.message : String(e));
          setError(true); setResults([]); setLoading(false);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query]);

  function pick(o: OrderResult) {
    setSelected(o);
    setQuery('');
    setResults([]);
    onSelect({ orderId: o.orderId, institution: o.institution });
  }

  function clear() {
    setSelected(null);
    onSelect(null);
  }

  // A set value renders a chip. Rich (quote#/institution) only for an order picked this
  // session; otherwise selectedLabel, else a plain label — NEVER a reverse lookup.
  if (value) {
    const chip = selected
      ? `${orderLabel(selected)} · ${selected.institution}`
      : (selectedLabel || `Linked order: ${value}`);
    return (
      <div className="mt-1 flex items-center gap-2">
        <span className="inline-flex items-center rounded-full bg-surface-container-high px-3 py-1.5 text-sm">{chip}</span>
        <button type="button" onClick={clear} className="text-xs text-error hover:underline">Clear</button>
      </div>
    );
  }

  return (
    <div className="relative mt-1">
      <input
        aria-label="Search order"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search order by quote #, PO #, institution, product…"
        className="block w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm"
      />
      {query.trim() && (
        <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-outline-variant bg-surface shadow-lg">
          {loading && <div className="px-3 py-2 text-xs text-on-surface-variant">Searching…</div>}
          {error && <div className="px-3 py-2 text-xs text-error">Search failed</div>}
          {!loading && !error && !results.length && (
            <div className="px-3 py-2 text-xs text-on-surface-variant">No orders found</div>
          )}
          {results.map((o) => (
            <button
              key={o.orderId} type="button" onClick={() => pick(o)}
              className="block w-full px-3 py-2 text-left text-sm hover:bg-surface-container-low"
            >
              <span className="font-semibold">{orderLabel(o)}</span>
              <span className="text-on-surface-variant"> · {o.institution}</span>
              {o.productModel && <span className="text-on-surface-variant"> · {o.productModel}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/admin/OrderSearchSelector.test.tsx`
Expected: PASS (6 tests).
Run: `npx tsc --noEmit 2>&1 | grep -i OrderSearchSelector || echo clean`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/OrderSearchSelector.tsx src/components/admin/OrderSearchSelector.test.tsx
git commit -m "feat(logistics-ui): OrderSearchSelector — debounced order search-and-pick"
```

---

## Task 2: Wire `OrderSearchSelector` into `CreateLogisticsCasePage`

**Files:**
- Modify: `src/pages/admin/CreateLogisticsCasePage.tsx`
- Test: `src/pages/admin/CreateLogisticsCasePage.test.tsx`

- [ ] **Step 1: Write the failing tests**

Append to `src/pages/admin/CreateLogisticsCasePage.test.tsx`. First add the OrderSearchSelector mock near the other `vi.mock` calls at the top of the file:

```typescript
vi.mock('../../components/admin/OrderSearchSelector', () => ({
  OrderSearchSelector: ({ value, onSelect }: { value: string; onSelect: (o: { orderId: string; institution: string } | null) => void }) => (
    <div data-testid="order-selector">
      <span>val:{value}</span>
      <button type="button" onClick={() => onSelect({ orderId: 'ord-5', institution: 'HORIBA' })}>pick-order</button>
      <button type="button" onClick={() => onSelect(null)}>clear-order</button>
    </div>
  ),
}));
```

Then append these tests inside the `describe('CreateLogisticsCasePage', …)` block:

```typescript
  it('selecting an order sets relatedOrderId and fills customerName when empty', async () => {
    vi.mocked(createLogisticsCase).mockResolvedValueOnce({ caseId: 'lc-1' } as never);
    render(<MemoryRouter><CreateLogisticsCasePage /></MemoryRouter>);
    fireEvent.click(screen.getByText('pick-order'));            // customerName starts empty → filled from order
    fireEvent.click(screen.getByText('Create Case'));
    await waitFor(() => expect(createLogisticsCase).toHaveBeenCalled());
    const input = vi.mocked(createLogisticsCase).mock.calls[0][0] as Record<string, unknown>;
    expect(input.relatedOrderId).toBe('ord-5');
    expect(input.customerName).toBe('HORIBA');
    expect(input.relatedEntityType).toBeUndefined();           // order pick must NOT set relatedEntityType
  });

  it('selecting an order does NOT overwrite a customer name the user already typed', async () => {
    vi.mocked(createLogisticsCase).mockResolvedValueOnce({ caseId: 'lc-1' } as never);
    render(<MemoryRouter><CreateLogisticsCasePage /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText(/Customer/i), { target: { value: 'BAE Systems' } });
    fireEvent.click(screen.getByText('pick-order'));
    fireEvent.click(screen.getByText('Create Case'));
    await waitFor(() => expect(createLogisticsCase).toHaveBeenCalled());
    const input = vi.mocked(createLogisticsCase).mock.calls[0][0] as Record<string, unknown>;
    expect(input.customerName).toBe('BAE Systems');
    expect(input.relatedOrderId).toBe('ord-5');
  });

  it('clearing the order resets relatedOrderId', async () => {
    vi.mocked(createLogisticsCase).mockResolvedValueOnce({ caseId: 'lc-1' } as never);
    render(<MemoryRouter><CreateLogisticsCasePage /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText(/Customer/i), { target: { value: 'BAE' } });
    fireEvent.click(screen.getByText('pick-order'));
    fireEvent.click(screen.getByText('clear-order'));
    fireEvent.click(screen.getByText('Create Case'));
    await waitFor(() => expect(createLogisticsCase).toHaveBeenCalled());
    const input = vi.mocked(createLogisticsCase).mock.calls[0][0] as Record<string, unknown>;
    expect(input.relatedOrderId).toBeUndefined();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/pages/admin/CreateLogisticsCasePage.test.tsx`
Expected: FAIL — `pick-order` testid/button not found (selector not wired yet).

- [ ] **Step 3: Wire the selector + customerName fill into the page**

In `src/pages/admin/CreateLogisticsCasePage.tsx`:

Add the import:

```tsx
import { OrderSearchSelector } from '../../components/admin/OrderSearchSelector';
```

Add a handler inside the component (after the `set` helper):

```tsx
  function handleOrderSelect(order: { orderId: string; institution: string } | null) {
    if (order) {
      setForm((f) => ({
        ...f,
        relatedOrderId: order.orderId,
        // Fill the customer ONLY when empty — never clobber a name the user typed.
        customerName: f.customerName.trim() === '' ? order.institution : f.customerName,
      }));
    } else {
      setForm((f) => ({ ...f, relatedOrderId: '' }));
    }
  }
```

Replace the "Related order ID" `<label>…<input/></label>` block (currently ~lines 72-75) with a **Related Order** group using the selector:

```tsx
      <div className="block text-sm">Related Order
        <OrderSearchSelector value={form.relatedOrderId} onSelect={handleOrderSelect} />
      </div>
```

Wrap the existing `relatedEntityType` / `relatedEntityId` grid in an **Other Related Entity** group label (keep the two fields and their behavior unchanged):

```tsx
      <fieldset className="block text-sm">
        <legend>Other Related Entity</legend>
        <div className="grid grid-cols-2 gap-3 mt-1">
          <label className="block text-sm">Related entity type
            <select value={form.relatedEntityType} onChange={(e) => set('relatedEntityType', e.target.value)}
              className="mt-1 block w-full rounded-lg border border-outline-variant bg-surface px-3 py-2">
              <option value="">—</option>
              {RELATED_ENTITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label className="block text-sm">Related entity ID
            <input value={form.relatedEntityId} onChange={(e) => set('relatedEntityId', e.target.value)}
              className="mt-1 block w-full rounded-lg border border-outline-variant bg-surface px-3 py-2" />
          </label>
        </div>
      </fieldset>
```

(The `submit()` function is unchanged — it already sends `relatedOrderId` only when set and keeps the both-or-neither check for `relatedEntityType`/`relatedEntityId`.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/pages/admin/CreateLogisticsCasePage.test.tsx`
Expected: PASS (existing tests + 3 new).
Run: `npx tsc --noEmit 2>&1 | grep -i CreateLogisticsCasePage || echo clean`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/pages/admin/CreateLogisticsCasePage.tsx src/pages/admin/CreateLogisticsCasePage.test.tsx
git commit -m "feat(logistics-ui): order search selector on create form (relatedOrderId only, fills customer when empty)"
```

---

## Task 3: Final verification

**Files:** none.

- [ ] **Step 1: Sweep + typecheck + build**

Run: `npx vitest run src/components/admin/OrderSearchSelector.test.tsx src/pages/admin/CreateLogisticsCasePage.test.tsx`
Expected: ALL PASS.
Run: `npx tsc --noEmit 2>&1 | grep -iE "OrderSearchSelector|CreateLogisticsCasePage" || echo clean`
Expected: clean.
Run: `npm run build 2>&1 | grep -E "built in|error TS" | head`
Expected: `✓ built in …` (ignore the post-build generate-seo NetworkError — unrelated).

- [ ] **Step 2: Commit any fixes**

```bash
git add -A && git commit -m "chore(logistics-ui): order-search-selector verification fixes" || echo "nothing to commit"
```

---

## Done

The "Related order ID" free-text input is replaced by a search-and-pick selector. No backend change (`listOrders` search reused). Phase 2 — a "Create Logistics Case" action on `OrderDetailPage` that deep-links with prefilled order context — is a separate later spec.

## Self-Review checklist (run after writing all tasks)

- Spec §4 `OrderSearchSelector` (debounced search, result rows, pick → onSelect, chip, clear, selectedLabel/Linked-order, no reverse lookup, internal OrderResult, error+warn) → Task 1 ✓
- Spec §5 page changes (Related Order group + selector; Other Related Entity group; fill customerName only when empty; relatedOrderId only, no relatedEntityType) → Task 2 ✓
- Spec §3 rule (selector writes relatedOrderId only, never relatedEntityType=ORDER) → Task 2 test asserts `relatedEntityType` undefined ✓
- No backend change ✓ · Phase 2 deferred ✓
