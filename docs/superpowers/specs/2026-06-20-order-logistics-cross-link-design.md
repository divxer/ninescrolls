# Order ↔ Logistics Cross-Link — Design Spec

**Date:** 2026-06-20
**Status:** Approved for implementation planning
**Scope:** Bidirectional navigation between an Order and its linked Logistics Case(s).

---

## 1. Purpose

When an equipment Order ships cross-border, a `LogisticsCase` (linked via `relatedOrderId`)
tracks its delivery/customs progress. Today the two are unconnected in the admin UI: from an
Order you can't see its logistics, and the Logistics → Order link is present but under-labeled.

This adds a lightweight, read-only cross-link in both directions so an operator viewing an
Order can answer *"where is this shipment / has it cleared customs?"* with one click, and vice
versa. The Order page stays a sales/order-lifecycle page — it gains a **context entry point**,
not a logistics detail view.

## 2. Scope

### In scope
- **Backend:** add an exact-match `relatedOrderId` filter argument to `listLogisticsCases`.
- **Order side:** a new read-only `LogisticsPanel` on `OrderDetailPage` listing the order's
  linked logistics cases (summary rows linking to the logistics detail page). Hidden entirely
  when there are none.
- **Logistics side:** relabel the existing reverse link to `Related Order: <id>` (cosmetic).

### Out of scope (explicitly not built — deferred)
- Expanding shipment legs / customs detail inline on the Order page (that's what the Logistics
  detail page is for).
- "Create a Logistics Case from this Order" (would need prefill logic — customer, orderId,
  `caseType=EQUIPMENT` — deferred to a later phase).
- Any reverse lookup of Order data on the Logistics page beyond the link it already has.

## 3. Backend — exact-match filter on `listLogisticsCases`

`listLogisticsCases` currently filters by `stage` / `caseType` / `customsRequired` / `search`.
`relatedOrderId` is only reachable via the fuzzy `search` field — too loose for a precise
"this order's cases" lookup. Add a dedicated argument.

- **Schema** (`amplify/data/resource.ts`): add `relatedOrderId: a.string()` to the
  `listLogisticsCases` query arguments.
- **Resolver** (`amplify/functions/logistics-api/resolvers/listLogisticsCases.ts`):
  - Destructure `relatedOrderId` (typed `string | null` — AppSync sends unset args as `null`).
  - Add to `passesFilters`: `(!relatedOrderId || it.relatedOrderId === relatedOrderId)`.
  - The truthy `!relatedOrderId` guard treats `null`/`undefined`/`''` as "no filter", matching
    the `stage`/`caseType` pattern and avoiding the `customsRequired === undefined` null bug
    fixed in PR #195.
- No new query, no new index — reuses the GSI1 `LOGISTICS_CASES` Query + in-memory filter.

## 4. Order side — `LogisticsPanel`

A self-contained, read-only panel keyed by `orderId`, mirroring the existing
`DocumentsPanel orderId={...}` / `ContactsPanel` pattern on `OrderDetailPage`.

- **Component:** `src/components/admin/LogisticsPanel.tsx` — `<LogisticsPanel orderId={...} />`.
- **Data:** extend the existing service + hook rather than adding a parallel path:
  - `logisticsAdminService.listLogisticsCases` gains an optional `relatedOrderId` arg (passed
    through to the query when set).
  - `useLogisticsCases` gains a `relatedOrderId` option (forwarded to the service).
  - The panel calls `useLogisticsCases({ relatedOrderId: orderId })`.
- **Render:** while `loading` **and** when there are **zero cases → render nothing**
  (the section only appears once cases are loaded and non-empty — most orders have no logistics,
  and showing a spinner that then collapses would flash on every order). Otherwise a
  "Related Logistics Cases" section with one row per case:
  - `caseNumber` → `<Link to="/admin/logistics/{caseId}">`
  - `caseType` (via `CASE_TYPE_LABELS`)
  - current stage → `<StageBadge>`
  - customs: "Customs required" / "No customs" (from `customsRequired`)
  - `updatedAt` (formatted `en-US`)
- **Wiring:** rendered on `OrderDetailPage` near `ContactsPanel` / `DocumentsPanel`.
- **Error handling:** the panel is non-blocking — a fetch error renders nothing (or a small
  inline error) and never breaks the Order page. The hook already exposes `error`.

Example:

```
Related Logistics Cases
──────────────────────
NS-LOG-2026-0003   Equipment   In Transit   Customs required   Jun 20, 2026
NS-LOG-2026-0004   Spare Part   Delivered    No customs          Jun 24, 2026
```

## 5. Logistics side — reverse-link label polish (no rebuild)

`LogisticsCaseDetailPage` already renders the reverse link
(`LogisticsCaseDetailPage.tsx:98-99`) with the correct rules: link only when `relatedOrderId`
exists, fallback to `{relatedEntityType}: {relatedEntityId}` otherwise, no inline order data,
no reverse lookup, non-blocking. **Do not rebuild it.** Only change the presentation:

- From the inline `· Order {relatedOrderId}` to a clearer **`Related Order: {relatedOrderId}`**
  (still a `<Link to="/admin/orders/{relatedOrderId}">`).
- Keep the existing fallback for `relatedEntityType=ORDER` without `relatedOrderId`:
  `Related: ORDER {relatedEntityId}`.

## 6. Data Flow

```
OrderDetailPage
  └─ LogisticsPanel(orderId)
       └─ useLogisticsCases({ relatedOrderId: orderId })
            └─ listLogisticsCases service ({ relatedOrderId })
                 └─ AppSync listLogisticsCases(relatedOrderId) → GSI1 Query + filter
       → rows link to /admin/logistics/:caseId

LogisticsCaseDetailPage
  └─ "Related Order: <id>" → /admin/orders/:relatedOrderId   (already wired; relabel only)
```

## 7. Testing

- **Resolver:** `listLogisticsCases` returns only cases whose `relatedOrderId` matches; a
  `relatedOrderId: null` arg (AppSync-style) is treated as no-filter (returns all). Add to the
  existing `listLogisticsCases.test.ts`.
- **Service/hook:** `listLogisticsCases({ relatedOrderId })` forwards the arg; `useLogisticsCases`
  passes it through.
- **LogisticsPanel:** renders rows (caseNumber link, stage badge, customs label) when cases
  exist; renders nothing when the list is empty.
- **Reverse link:** `LogisticsCaseDetailPage` shows `Related Order: <id>` when `relatedOrderId`
  is set; shows the `Related: ORDER <id>` fallback otherwise (extend the existing detail test).

## 8. Files

**Modify:**
- `amplify/data/resource.ts` — `relatedOrderId` arg on `listLogisticsCases`
- `amplify/functions/logistics-api/resolvers/listLogisticsCases.ts` (+ test) — filter
- `src/services/logisticsAdminService.ts` (+ test) — `relatedOrderId` passthrough
- `src/hooks/useLogisticsCases.ts` — `relatedOrderId` option
- `src/pages/admin/OrderDetailPage.tsx` — render `LogisticsPanel`
- `src/pages/admin/LogisticsCaseDetailPage.tsx` (+ test) — reverse-link relabel

**Create:**
- `src/components/admin/LogisticsPanel.tsx` (+ test)
