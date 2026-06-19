# Logistics Cases — Design Spec (Phase 1)

**Date:** 2026-06-19
**Status:** Approved for implementation planning
**Module:** Logistics Cases (internal cross-border delivery & customs ledger)

---

## 1. Purpose & Context

NineScrolls sells high-value, low-volume semiconductor process equipment (ICP-RIE,
PECVD, RIE) to overseas customers and runs cross-border sample-testing projects.
The logistics that actually matters is **not** a single carrier tracking number — it is
the multi-stage delivery chain with export/import customs clearance:

```
PO → Production → FAT → Export Customs → International Freight →
Import Customs → Delivered → Installation → Acceptance
```

Sample projects (e.g. 20 test coupons shipped in, tested, shipped back) involve their
own **round-trip** logistics with customs on both legs, and are frequently more
logistics-sensitive than equipment.

Today **none of this is recorded** — it lives in email and memory. The Phase 1 goal is a
single internal ledger that answers, in 30 seconds: *"Where is this case stuck?"* and
*"Did we receive the customer's samples?"*

### Why not extend the existing `Order` model

The existing `Order` (`amplify/data/resource.ts`) models the **sales** lifecycle
(`INQUIRY → … → SHIPPED → INSTALLED → CLOSED`) and has no carrier/customs concept. More
importantly, most logistics activity is **not** tied to a sales order: incoming sample
shipments, sample returns, RMA returns, and spare parts may link to a Lead, a sample
project, a customer, or a service case — or nothing structured at all. Logistics is a
first-class concern, not an `Order` sub-field. Equipment cases *optionally* reference
their `Order`.

---

## 2. Scope

### In scope (Phase 1)
- A first-class `LogisticsCase` entity covering equipment delivery, sample logistics
  (incl. round-trip), spare parts, RMA, and demo shipments.
- Per-case **milestone chain** with a superset stage ladder; each case type enables a
  relevant subset.
- Embedded **shipment legs**, each with its own carrier, tracking, freight forwarder,
  B/L or AWB, container, and **per-leg customs status** (export on one leg, import on
  another).
- Internal-only admin UI: list (filter + paginate) and detail (milestone progress +
  legs + milestone log).
- Manual data entry only.

### Explicitly out of scope (YAGNI — Phase 2+)
- **No customer-facing UI of any kind in Phase 1.** Data model reserves fields so a
  Phase 2 read-only shared link (no login) can be generated later.
- No carrier-API auto-status polling (17track / AfterShip).
- No notifications/reminders.
- No file/document attachments (the existing `OrderDocument` pattern can be reused later
  if needed).
- No customer accounts / full portal (likely never warranted at this scale).

---

## 3. Data Model

Follows the existing codebase idiom: a `LogisticsCase` is **one DynamoDB item** modeled
as an `a.customType()` with **embedded sub-object arrays** — exactly how `Order` embeds
`OrderContact[]` and `OrderDocument[]`. This keeps Phase 1 to a single table while
structurally supporting multi-leg round-trips. No join table.

### 3.1 `LogisticsCase`

| Field | Type | Notes |
|-------|------|-------|
| `caseId` | id, required | |
| `caseNumber` | string, required | plain sequential: `NS-LOG-YYYY-0001` (no customer/region segment) |
| `caseType` | enum `CaseType`, required | discriminator |
| `relatedOrderId` | string? | convenience direct link for equipment cases |
| `relatedEntityType` | enum `RelatedEntityType`? | generic association |
| `relatedEntityId` | string? | |
| `customerName` | string, required | |
| `contactName` | string? | |
| `customsRequired` | boolean, required | **case-level**: does this case involve customs at all |
| `currentStage` | ref `LogisticsStage`, required | answers "where is it stuck" |
| `enabledStages` | `LogisticsStage[]`, required | subset for this caseType; prefilled on create. **Stored, not editable in Phase 1** (no resolver mutates it). |
| `legs` | `ShipmentLeg[]` | embedded |
| `milestoneLog` | `LogisticsLog[]` | embedded, timestamped stage events |
| `isCustomerVisible` | boolean, required | default `false`. **Frozen in Phase 1** — set at creation only, no resolver mutates it (prevents `visible=true` with a null token). Becomes mutable in Phase 2 alongside token generation. |
| `publicToken` | string? | Phase 2 read-only link token; null in Phase 1. Generated only when sharing is enabled in Phase 2. |
| `notes` | string? | |
| `createdAt` / `updatedAt` | datetime, required | |
| `createdBy` | string, required | |

### 3.2 `ShipmentLeg` (embedded)

| Field | Type | Notes |
|-------|------|-------|
| `legId` | id, required | |
| `direction` | enum `LegDirection`, required | |
| `customsRequired` | boolean? | **leg-level**: does *this* leg clear customs (e.g. a domestic factory→forwarder leg may not) |
| `customsStatus` | ref `CustomsStatus`? | per-leg clearance state |
| `carrier` | string? | |
| `trackingNumber` | string? | |
| `freightForwarder` | string? | |
| `blOrAwb` | string? | bill of lading / air waybill |
| `containerNo` | string? | |
| `declaredValueUSD` | float? | |
| `hsCode` | string? | |
| `shippedAt` / `clearedAt` / `deliveredAt` | datetime? | |

### 3.3 `LogisticsLog` (embedded, mirrors `OrderLog`)

| Field | Type | Notes |
|-------|------|-------|
| `action` | string, required | |
| `fromStage` | ref `LogisticsStage`? | |
| `toStage` | ref `LogisticsStage`? | |
| `operator` | string, required | |
| `timestamp` | datetime, required | |
| `detail` | string? | free-text note |
| `internalOnly` | boolean, required | default `false`; if `true`, entry hidden from Phase 2 public view |

### 3.4 Enums

**`CaseType`**
```
SAMPLE | EQUIPMENT | SPARE_PART | RMA | DEMO
```

**`RelatedEntityType`**
```
ORDER | LEAD | SAMPLE_PROJECT | CUSTOMER | SERVICE_CASE
```

**`LegDirection`**
```
INBOUND | OUTBOUND | RETURN | DOMESTIC_TRANSFER
```

**`CustomsStatus`** (per-leg)
```
NOT_REQUIRED | DOCS_READY | FILED | EXAM | HELD | RELEASED | DUTIES_PAID | CLEARED
```
- `DOCS_READY` — export/import docs prepared (commercial invoice, packing list, COO…)
- `FILED` — customs entry filed
- `EXAM` — selected for inspection/exam
- `HELD` — held for any other reason (use `notes` for cause; no `SEIZED` value in Phase 1)
- `RELEASED` — customs released the shipment
- `DUTIES_PAID` — duties/taxes paid
- `CLEARED` — fully cleared, may proceed to next logistics stage

**`LogisticsStage`** (superset — 22 values)
```
DRAFT
AWAITING_SHIPMENT
IN_TRANSIT
EXPORT_CUSTOMS
IMPORT_CUSTOMS
CUSTOMS_HOLD
RECEIVED
TESTING
REPORT_ISSUED
READY_TO_RETURN
RETURN_IN_TRANSIT
RETURNED
PRODUCTION
FAT_SCHEDULED
FAT_PASSED
READY_TO_SHIP
DELIVERED
INSTALLATION_SCHEDULED
INSTALLED
ACCEPTED
CLOSED
CANCELLED
```

### 3.5 `enabledStages` mapping per `caseType`

The UI renders only the enabled subset; `currentStage` is always one of them.

**SAMPLE**
```
AWAITING_SHIPMENT → IN_TRANSIT → EXPORT_CUSTOMS → IMPORT_CUSTOMS → CUSTOMS_HOLD →
RECEIVED → TESTING → REPORT_ISSUED → READY_TO_RETURN → RETURN_IN_TRANSIT → RETURNED → CLOSED
```

**EQUIPMENT**
```
PRODUCTION → FAT_SCHEDULED → FAT_PASSED → READY_TO_SHIP → EXPORT_CUSTOMS → IN_TRANSIT →
IMPORT_CUSTOMS → CUSTOMS_HOLD → DELIVERED → INSTALLATION_SCHEDULED → INSTALLED → ACCEPTED → CLOSED
```

**SPARE_PART**
```
AWAITING_SHIPMENT → IN_TRANSIT → EXPORT_CUSTOMS → IMPORT_CUSTOMS → DELIVERED → CLOSED
```

**RMA**
```
AWAITING_SHIPMENT → IN_TRANSIT → IMPORT_CUSTOMS → RECEIVED → TESTING → READY_TO_RETURN →
RETURN_IN_TRANSIT → EXPORT_CUSTOMS → DELIVERED → CLOSED
```

**DEMO** — reuse the EQUIPMENT subset for Phase 1.

`DRAFT` (universal initial/holding stage) and `CANCELLED` (terminal) are **not** subject
to the `enabledStages` subset constraint — they are reachable for any case type at any
point. All other stages must be in the case's `enabledStages` to be a valid
`currentStage` or advance target.

### 3.6 Case-level vs leg-level customs (non-conflicting)

`currentStage` answers "which clearance is the **case** blocked on"; `leg.customsStatus`
records "the status of **that leg's** specific clearance". Example:
```
case.currentStage      = IMPORT_CUSTOMS
case.customsRequired   = true
legs[1].customsRequired = true
legs[1].customsStatus  = RELEASED
```

---

## 4. Technical Architecture

Mirrors the existing `Order` / `order-api` implementation.

- **Storage: the shared single table** `NineScrollsIntelligence` (same table Orders/RFQs/Leads
  use) — **not** a new dedicated table. A case is one item: `PK='LOGISTICS#<caseId>'`,
  `SK='META'`, with `legs[]` and `milestoneLog[]` embedded as JSON attributes. A year-scoped
  counter item (`PK='COUNTER#LOGISTICS_CASE'`, `SK='YEAR#<year>'`) backs the sequential
  `caseNumber`.
- **Listing index (no Scan):** all cases share one listing partition on GSI1 —
  `GSI1PK='LOGISTICS_CASES'`, `GSI1SK='<updatedAt>#<caseId>'`. The default admin list and
  stats are **recency-sorted Queries on this partition, never Scans**. `stage` / `caseType` /
  `customsRequired` / `search` are applied as in-memory filters over the (tiny) single-partition
  result. Every mutation that touches `updatedAt` rewrites `GSI1SK` to keep ordering fresh. If
  stage-filter volume ever grows, promote `currentStage` to a dedicated GSI2 partition
  (`GSI2PK='LOGISTICS_STAGE#<stage>'`) — out of scope for Phase 1.
- **`amplify/data/resource.ts`**: add the custom types + enums above, plus operations:
  - `listLogisticsCases` — GSI1 `LOGISTICS_CASES` Query + in-memory filter + pagination.
  - `getLogisticsCase`
  - `createLogisticsCase` — prefills `enabledStages` from `caseType`, always sets
    `currentStage = DRAFT`. The case only enters a business stage on the first
    `advanceLogisticsStage` call.
  - `updateLogisticsCase` — edits a whitelist of mutable fields only (not `caseType`,
    `currentStage`, `enabledStages`, `legs`, `milestoneLog`, `isCustomerVisible`, `publicToken`).
  - `advanceLogisticsStage` — validates target ∈ `enabledStages` (or is `DRAFT`/
    `CANCELLED`), appends a `LogisticsLog` entry, updates `currentStage` + `updatedAt` + `GSI1SK`.
  - `addLeg` / `updateLeg` / `removeLeg` — mutate the embedded `legs[]`.
  - `logisticsStats` — counts by `caseType` and `currentStage`, count of
    customs-in-progress cases, count of stalled cases.
- **`amplify/functions/logistics-api/`** — new Lambda dir, structured like `order-api`;
  granted read/write on the shared `INTELLIGENCE_TABLE`.
- **`src/services/logisticsAdminService.ts`** + types — mirrors `orderAdminService.ts`.

---

## 5. Admin UI (internal only)

- **`src/pages/admin/LogisticsCaseListPage.tsx`** — mirrors `OrderListPage`. Table with
  filters (caseType / currentStage / customsRequired); columns: caseNumber, type,
  customer, `currentStage` badge, customs flag, last updated. Server-side search +
  pagination.
- **`src/pages/admin/LogisticsCaseDetailPage.tsx`** — mirrors `OrderDetailPage`. Renders:
  - milestone progress bar over `enabledStages` only, highlighting `currentStage`;
  - legs list (per-leg carrier / tracking / customsStatus / dates);
  - `milestoneLog` timeline;
  - related-entity link (Order/Lead/etc.).
- Route registration follows the existing admin routing pattern (and Amplify rewrite
  rules per project convention).

---

## 6. Data Flow

1. Create case → choose `caseType` → `enabledStages` prefilled, `currentStage = DRAFT`.
2. Add leg(s) → set direction, carrier/tracking, `customsRequired`, `customsStatus`.
3. Advance stage → validate target ∈ `enabledStages` → append `LogisticsLog` → update
   `currentStage`.

---

## 7. Error Handling

- Advancing to a stage not in `enabledStages` → reject; return the current
  `enabledStages` so the caller can correct.
- `case.customsRequired = true` but a customs-bearing leg has no `customsStatus` →
  **soft warning** on the detail page (non-blocking).
- `CANCELLED` allowed from any stage; terminal.

---

## 8. Testing (vitest, existing patterns)

- `enabledStages` mapping per `caseType` is correct.
- Stage-advance validation rejects out-of-subset targets and appends a log entry.
- Round-trip sample case: two legs (`INBOUND` + `RETURN`) each carry independent
  `customsStatus`.
- `listLogisticsCases` filtering + pagination.
- Create prefills `enabledStages` and initial `currentStage`.

---

## 9. Relationship to `Order`

`Order` is unchanged. Equipment cases link via `relatedOrderId`. A Phase 2 enhancement
may add a "Related logistics cases" panel to `OrderDetailPage` (not in Phase 1).

---

## 10. Phasing

| Phase | Scope |
|-------|-------|
| **Phase 1 (this spec)** | Internal ledger: data model, resolvers, admin list + detail. No customer UI. |
| Phase 2 | Read-only shared link (no login) driven by `isCustomerVisible` + `publicToken`, showing `currentStage` + non-`internalOnly` milestones. |
| Phase 3 | Full customer portal — likely never warranted. |
