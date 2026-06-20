# Logistics Cases — Admin UI Skeleton (Plan 2 draft, NO CODE)

> **Status:** SKELETON ONLY. Do not implement. This fixes scope/layout/fields so Plan 2 can
> be turned into a concrete TDD plan **after** the backend is deployed and the AppSync client
> types are generated. All field names below are provisional until verified against the
> generated `Schema['LogisticsCase']` type.

**Gate before writing Plan 2 proper:**
1. `npx ampx sandbox` — deploy backend, regenerate client types + `amplify_outputs.json`.
2. Confirm schema generation succeeded (no `LogisticsCase` errors).
3. Smoke test: `createLogisticsCase` → `listLogisticsCases` → `getLogisticsCase` → `advanceLogisticsStage`.
4. Reconcile field nullability / enum names / JSON-vs-array wrapping against generated types,
   then convert this skeleton into a task-by-task plan.

---

## Layering (mirror the Orders stack)

```
logisticsAdminService.ts (done)  →  hooks  →  pages
                                     types/admin (shared)  ·  components/admin (shared widgets)
```

- **Hooks (new):** `src/hooks/useLogisticsCases.ts` (`useLogisticsCases(filters)` with
  `cases / loading / loadingMore / hasMore / error / loadMore`, mirroring `useOrders`),
  `useLogisticsStats()`, `useLogisticsCase(caseId)`.
- **Types (new, in `src/types/admin`):** `LogisticsCase`, `ShipmentLeg`, `LogisticsLogEntry`,
  `CaseType`, `LogisticsStage`, `CustomsStatus`, `LegDirection`, plus `STAGE_LABELS`,
  `CASE_TYPE_LABELS`, `CUSTOMS_STATUS_LABELS`, and `ENABLED_STAGES` (duplicated client-side
  for the progress bar / create form). Derive from generated `Schema` types where possible.
- **Shared widgets:** reuse `StatusBadge` pattern; add a `StageBadge` + Material-Symbols icon
  map per stage (like `STATUS_ICONS` in `OrderListPage`).

---

## Routes (add to `src/routes/index.tsx`, mirror orders block)

```
admin/logistics            → LogisticsCaseListPage
admin/logistics/new        → CreateLogisticsCasePage
admin/logistics/:caseId    → LogisticsCaseDetailPage
```

Lazy-import each; add an admin-nav entry "Logistics" alongside "Orders".

---

## Page 1: LogisticsCaseListPage (mirror OrderListPage)

**Filters (top bar):**
- caseType chips: All / Sample / Equipment / Spare Part / RMA / Demo
- stage dropdown (All + the 22 stages, or grouped)
- customsRequired toggle (All / Customs / No-customs)
- debounced search (caseNumber, customerName, contactName, relatedOrderId)

**Stat tiles (from `logisticsStats`):** Total active · Customs in progress · Stalled (>14d) ·
counts by caseType.

**Table columns:**
| Col | Source |
|-----|--------|
| Case # | `caseNumber` (link to detail) |
| Type | `caseType` badge |
| Customer | `customerName` (+ `contactName` sub) |
| Current stage | `currentStage` → `StageBadge` |
| Customs | `customsRequired` ? flag + worst-leg `customsStatus` |
| Legs | `legs.length` |
| Updated | `updatedAt` relative |

Infinite scroll / "load more" via `nextToken` (mirror `useOrders.loadMore`).

---

## Page 2: LogisticsCaseDetailPage (mirror OrderDetailPage)

**Header:** caseNumber · caseType · customerName/contactName · related-entity link
(`relatedOrderId` → order detail; else `relatedEntityType`/`relatedEntityId`).

**Milestone progress bar:** render **only `enabledStages`** in order, highlight
`currentStage`; completed = stages before current in the log. "Advance stage" control →
`advanceLogisticsStage(caseId, targetStage, detail?, internalOnly?)`; target options limited
to `enabledStages` (+ CANCELLED). Soft warning banner if `customsRequired` and a customs-leg
has no `customsStatus`.

**Legs section:** card/row per leg — direction, carrier + trackingNumber (+ auto
`trackingUrl` link if present), freightForwarder, blOrAwb, containerNo, customsStatus badge,
declaredValueUSD, hsCode, shipped/cleared/delivered dates. Add / edit / remove leg →
`addLeg` / `updateLeg` / `removeLeg`.

**Milestone log timeline:** reverse-chron `milestoneLog`; show action, from→to stage,
operator, timestamp, detail; visually mark `internalOnly` entries (Phase 2 will hide these
from the public view).

**Edit panel:** whitelisted fields only — customerName, contactName, customsRequired,
relatedOrderId, relatedEntityType, relatedEntityId, notes → `updateLogisticsCase`.

---

## Page 3: CreateLogisticsCasePage (mirror CreateOrderPage)

**Fields:** caseType (required, drives nothing else client-side — `enabledStages` set
server-side), customerName (required), contactName, customsRequired (toggle),
relatedOrderId / relatedEntityType + relatedEntityId, notes. Submit →
`createLogisticsCase(input)` → redirect to new case detail. Case opens at `DRAFT`; first
stage advance happens on the detail page.

---

## Verification (Plan 2 proper will specify)

- Hook unit tests (mock `logisticsAdminService`).
- List filter/pagination behavior.
- Detail: progress bar renders only `enabledStages`; advance control rejects non-enabled
  targets (server already enforces — UI just constrains options).
- Create → redirect, opens at DRAFT.
- Manual smoke pass against the deployed sandbox before merge.
