# Order Search Selector (link an existing Order when creating a Logistics Case) — Design Spec

**Date:** 2026-06-20
**Status:** Approved for implementation planning
**Phase:** 1.5 of the Order↔Logistics linking work (Phase 2 — "Create Logistics Case from an Order" — is a separate later spec).

---

## 1. Purpose

`CreateLogisticsCasePage` currently links an Order via a free-text **"Related order ID"** `<input>` — you must know and type the internal id (`ord-20260101-ab3f`), which nobody memorizes. People know **quote numbers** (`NS-Q-…`), **institutions**, and **product models**. This replaces that input with a searchable **`OrderSearchSelector`**: type any of those, pick the matching order, and the form stores its `orderId` (and prefills the customer).

This keeps `LogisticsCase` independently creatable (samples, RMA, demos often have no Order) — it improves *how you attach an Order when there is one*, without binding logistics creation to Orders.

## 2. Scope

### In scope
- Replace the free-text `relatedOrderId` input in `CreateLogisticsCasePage` with an `OrderSearchSelector` component.
- The selector searches orders via the existing `orderAdminService.listOrders({ search })` (server-side, already matches quote#/PO#/institution/product). **No backend change.**
- On select: set `relatedOrderId = order.orderId` and prefill `customerName = order.institution` (editable).
- Re-organize the create form's relation fields into two labeled groups: **Related Order** (the selector) and **Other Related Entity** (the existing `relatedEntityType` / `relatedEntityId` fields).

### Out of scope (explicitly deferred)
- **Phase 2 — "Create Logistics Case" action on `OrderDetailPage`** (deep-link into the create page with prefilled order context). Separate spec.
- Any backend/schema change (`listOrders` search already exists).
- A picker for non-Order entities (LEAD / SAMPLE_PROJECT / …) — those keep the existing free-text `relatedEntityType` / `relatedEntityId` fields for now.

## 3. Association model (the rule)

- **`relatedOrderId`** is the dedicated field for an **Order** association. The Order↔Logistics bidirectional link (`LogisticsPanel`, the reverse "Related Order" link, the `relatedOrderId` exact-match filter) all depend on it.
- **`relatedEntityType` / `relatedEntityId`** are for a **non-Order** association (LEAD / SAMPLE_PROJECT / CUSTOMER / SERVICE_CASE).
- The `OrderSearchSelector` writes **`relatedOrderId` only**. It must **NOT** write `relatedEntityType=ORDER` or `relatedEntityId` — doing so would create a duplicate source of truth for the same Order.
- Filling both `relatedOrderId` AND a non-Order `relatedEntityType`/`relatedEntityId` is **allowed** and means a genuine *dual* association (e.g. an Order plus a Service Case), not a redundant re-expression of the same Order.

## 4. `OrderSearchSelector` component

`src/components/admin/OrderSearchSelector.tsx` — a controlled search-and-pick selector.

**Interface:**
```ts
// A search result row the selector renders and keeps internally for the chip.
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
```

The component keeps the **full `OrderResult`** of a freshly-clicked order in local state so the chip can show quote#/institution. The `onSelect` callback to the parent still passes only `{ orderId, institution }` (all the parent needs: `relatedOrderId` + `customerName`).

**Behavior:**
- A text input ("Search order by quote #, PO #, institution, product…"); typing debounces (~300ms) and calls `orderAdminService.listOrders({ search: term, limit: 10 })`.
- Renders a dropdown of matches; each row shows `quoteNumber` (or `poNumber` fallback), `institution`, `productModel` — e.g. `NS-Q-2026-HRB-001 · HORIBA · 4" RIE`.
- Clicking a row calls `onSelect({ orderId, institution })`, stores the full `OrderResult` locally, and collapses the dropdown; the chosen order shows as a **chip** (`{quote# || po4 || orderId} · {institution}`) with a **clear (×)** button.
- **Displaying an already-set `value` (no fresh selection this session):** the component does **NOT** reverse-look-up the order. If `selectedLabel` is provided, show it; otherwise show a plain `Linked order: {value}`. (Fresh selection within the session shows the richer quote#/institution chip from the stored `OrderResult`.)
- Clear (×) calls `onSelect(null)` (sets `relatedOrderId = ''`) and drops the local `OrderResult`; it does **not** wipe `customerName`.
- Search states: while loading → a small "Searching…" hint; no matches → "No orders found"; on error → a small inline message + `console.warn` (non-blocking — the rest of the create form still works).
- Empty query → no dropdown.

## 5. `CreateLogisticsCasePage` changes

- Replace the **"Related order ID"** `<input>` with the `OrderSearchSelector`, under a **"Related Order"** label.
- Group the existing `relatedEntityType` (select) + `relatedEntityId` (input) under a **"Other Related Entity"** label (unchanged behavior; still optional; the both-or-neither rule from the create form stays).
- `onSelect(order)`:
  - `order` set → `relatedOrderId = order.orderId`; **fill `customerName` only when it is currently empty** (`customerName.trim() === ''` → set `order.institution`). If the user already typed a customer name, **do not overwrite** it. The field stays editable either way.
  - `order = null` (cleared) → `relatedOrderId = ''`; leave `customerName` as-is.
- `customerName` remains **required** (you can pick an order to fill it, or type it directly).
- Submit is unchanged: `relatedOrderId` is sent only when set (it already is).

## 6. Data Flow

```
CreateLogisticsCasePage
  └─ OrderSearchSelector(value=relatedOrderId)
       └─ debounced → orderAdminService.listOrders({ search, limit: 10 })
       └─ onSelect(order) → set relatedOrderId = order.orderId, customerName = order.institution
  → submit → createLogisticsCase({ ..., relatedOrderId })
```

## 7. Error handling

- Order search failure is **non-blocking**: the selector shows an inline error + `console.warn`s; the create form remains fully usable (you can still type a customer and create a case without an order).
- No new global error surfaces.

## 8. Testing

- **`OrderSearchSelector`:**
  - typing debounces and calls `listOrders` with the trimmed `search` term;
  - renders result rows (quote#/institution/product); clicking a row calls `onSelect({ orderId, institution })` and shows the quote#/institution chip;
  - a preset `value` without a fresh selection shows `Linked order: {value}` (or `selectedLabel` if given) and does **NOT** call `listOrders` to resolve it;
  - clicking clear calls `onSelect(null)`;
  - empty query → no dropdown / no `listOrders` call; search error → inline message, no throw.
- **`CreateLogisticsCasePage`:**
  - selecting an order sets `relatedOrderId`; with an empty customer field it fills `customerName` from the order's institution;
  - selecting an order when `customerName` already has a value does **NOT** overwrite it;
  - clearing the order resets `relatedOrderId` but leaves `customerName`;
  - it does **NOT** set `relatedEntityType`/`relatedEntityId` from an order selection;
  - submit sends the selected `relatedOrderId`.

## 9. Files

**Create:**
- `src/components/admin/OrderSearchSelector.tsx` (+ `.test.tsx`)

**Modify:**
- `src/pages/admin/CreateLogisticsCasePage.tsx` (+ `.test.tsx`) — swap the input for the selector, two labeled groups, prefill customerName on select

**Reuse (no change):**
- `src/services/orderAdminService.ts` — `listOrders({ search, limit })`
