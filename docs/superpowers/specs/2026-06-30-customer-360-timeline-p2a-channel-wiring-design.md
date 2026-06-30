# Customer 360 Timeline — Plan 2A: Channel Wiring Design Spec

**Date:** 2026-06-30
**Status:** Approved — proceed to writing-plans
**Scope:** Plan 2A of the Customer 360 Timeline. Wires the merged P1 `emitTimelineEvent` into the live channel source-writes so new interactions flow into the timeline in real time. Builds on P1 (PR #223).

---

## 1. Context & Position

P1 shipped the data foundation: `crm-api` with `emitTimelineEvent`, `resolveLinks` (resolves
**existing** orgs only via canonical eTLD+1), idempotent + durable rollups, Contact/TimelineEvent/
LinkAuditLog storage. Nothing is wired to channels yet.

Plan 2 (channel wiring + auto-create + backfill + sweep) is **decomposed into three independent
spec→plan→build cycles**:

| | Deliverable | Value | Depends on |
|---|---|---|---|
| **2A (this spec)** | Wire `emitTimelineEvent` into the 5 source Lambdas (8 emit sites) via an async invoke helper | New interactions reach the timeline in real time | P1 interfaces only |
| 2B | Paginated historical backfill job + dry-run reconciliation report | Existing history becomes visible | 2A emit semantics |
| 2C | Analytics `site_visit_session` rollup + hot/cold reconciliation sweep | Analytics in timeline + durability backstop | 2A |

### Two decisions settled during design (both confirmed)

1. **Org auto-create = reuse the existing `invokeOrganizationApi`, not a shared-lib extraction or a
   CRM re-implementation.** `organization-api` already owns canonical org identity (eTLD+1), and
   `submit-rfq` / `submit-lead` / `convert-rfq-to-order` already synchronously invoke it
   (`amplify/lib/organization/invoke-org-api.ts`) and obtain `matchedOrgId`. So:
   - RFQ / Lead / converted Order → feed the **existing** `matchedOrgId` to emit.
   - Manual `createOrder` → add one `invokeOrganizationApi` call to get/create the canonical org and
     backfill `Order.matchedOrgId`, then emit.
   - Logistics → take `matchedOrgId` from the related Order; never create an org itself.
   - Analytics → no auto-create; existing org / prior-visitor signal, else `unresolved`.
2. **Emit invoke is asynchronous (`InvocationType: 'Event'`).** Emit is a pure projection — the
   caller needs nothing back. Async gives zero business-path latency; AWS retries 2× (+ optional DLQ);
   emit's deterministic ids make retries/double-delivery safe; real projection failures are observed
   by `crm-api` logs/retries and the 2C sweep, **not** the caller.

---

## 2. Architecture & Invoke Contract

A shared helper + a direct-invoke entry point on `crm-api`, mirroring the `invokeOrganizationApi`
pattern. Business Lambdas only ever build a plain payload and fire it — they never touch CRM's
DynamoDB keys, GSIs, or rollup internals.

### `amplify/lib/crm/` (new shared module, mirrors `amplify/lib/organization/`)

- **`types.ts`** — the wire contract. `CrmEmitPayload = { action: 'emitTimelineEvent'; args: EmitArgs }`.
  **The contract lives here**; both sides import it. `crm-api` maps the payload to its internal
  `emitTimelineEvent`, so business Lambdas do not reach into `crm-api/lib` internals. (`EmitArgs`
  mirrors the P1 `crm-api/lib/emitTimelineEvent.ts` shape.)
- **`invoke-crm-api.ts`**:
  ```
  invokeCrmApi(payload: CrmEmitPayload, opts?: { sync?: boolean }): Promise<void>
  emitTimelineEventToCrm(args: EmitArgs, opts?: { sync?: boolean }): Promise<void>   // convenience wrapper
  ```
  - default: `LambdaClient` `InvokeCommand`, `InvocationType: 'Event'` (fire-and-forget).
  - default async path: a dispatch failure is **logged and swallowed** — never thrown into the
    business path (`event: crm.emit.dispatch_failed`, source ids, kind).
  - `{ sync: true }` (tests / backfill-debug only, **never on the business path**):
    `InvocationType: 'RequestResponse'`, **throws** on invoke/function error so callers can observe.
  - reads `CRM_API_FUNCTION_NAME` from env.
- **`emit-builders.ts`** — pure `EmitArgs` builders (one per channel kind), unit-testable with no
  AWS: `buildRfqEmitArgs`, `buildLeadEmitArgs`, `buildOrderCreatedEmitArgs`,
  `buildOrderStageChangedEmitArgs`, `buildQuoteSentEmitArgs`, `buildLogisticsMilestoneEmitArgs`
  (covers both stage-advance and case-create).
- `*.test.ts` alongside each.

### `crm-api/handler.ts` (modified)
Add a **direct-invoke branch** (mirrors `organization-api`'s `dispatchAction`): a payload with
`{ action: 'emitTimelineEvent', args }` and no AppSync markers (`info`/`fieldName`) routes to the
existing `emitTimelineEvent(args)`. Unknown `action` → error. The AppSync field path (Plan 3 queries)
stays separate. **No public GraphQL surface is added in 2A** — `crm-api` is reachable only via
internal Lambda invoke.

### `amplify/backend.ts` (modified)
- Grant `lambda:InvokeFunction` on `crmApi` + set `CRM_API_FUNCTION_NAME` env to the **5 source
  Lambdas** covering the 8 emit sites: `submitRfq`, `submitLead`, `convertRfqToOrder`, `orderApi`,
  `logisticsApi`. (Mirror the org-api grant block at `backend.ts:~1028`.)
- **Additionally** grant `orderApi` invoke perms on `organizationApi` + `ORGANIZATION_API_FUNCTION_NAME`
  env — `order-api` is not in the current org-api grant list, and manual `createOrder` needs it.

---

## 3. Per-Channel Emit Mapping (8 sites)

Each business Lambda builds an `EmitArgs` via a pure builder, then fires `emitTimelineEventToCrm(...)`
**after the source write commits**. `occurredAt` is always the source record's business timestamp
(see §4) — never `Date.now()`.

| # | Site (after commit) | `source` / `kind` | `idInput` | `resolveInput` (org link) | summary |
|---|---|---|---|---|---|
| 1 | `submit-rfq` :597 | rfq / `rfq_submitted` | `{rfq_submitted, rfqId}` | `matchedOrgId` (existing org-api invoke) + `email` | "Submitted RFQ — {model/category}" |
| 2 | `submit-lead` :681 | lead / `lead_captured` | `{lead_captured, leadId}` | `matchedOrgId` (backfilled :672) + `email` | by type: "Downloaded {product}" / "Contact: {inquiryType}" / "Newsletter signup" |
| 3 | `convert-rfq-to-order` :216 | order / `order_created` | `{order_created, orderId}` | `finalMatchedOrgId` (see note) + `email` | "Order created from RFQ — {model}" |
| 4 | `order-api/createOrder` :139 | order / `order_created` | `{order_created, orderId}` | `matchedOrgId` (**new** org-api invoke + backfill) + primary `email` | "Order created — {model}" |
| 5 | `order-api/updateOrderStatus` :178 | order / `order_stage_changed` | `{order_stage_changed, orderId, orderLogId, toStatus, occurredAt}` | `Order.matchedOrgId` primary; primary-contact `email` fallback **only if already loaded** | "Order → {newStatus}" |
| 6 | `order-api/confirmDocumentUpload` :104 (docType=`QUOTATION`) | quote / `quote_sent` | `{quote_sent, quoteDocId: docId}` | `Order.matchedOrgId` primary; same email fallback rule | "Quote sent — {fileName}" |
| 7 | `logistics-api/advanceLogisticsStage` :65 | logistics / `logistics_milestone` | `{logistics_milestone, caseId, milestoneId, stage: toStage, occurredAt}` | `matchedOrgId` from related `Order`; else `unresolved` | "Logistics: {toStage}" |
| 8 | `logistics-api/createLogisticsCase` :96 | logistics / `logistics_milestone` | `{logistics_milestone, caseId, milestoneId: CASE_CREATED id, stage: 'DRAFT'}` | same as #7 | "Logistics case created — {caseType}" |

### Precision points
- **kind reconciliation:** order status changes → `order_stage_changed` (one row per transition,
  keyed by the stable `olog-` id); logistics → `logistics_milestone` (keyed by the `mlog-` id). This
  stays consistent with P1's `timelineId` — **no per-status kinds**.
- **`isInternalOnly` passthrough (sites #7/#8):** logistics milestone/case entries carry an
  `internalOnly` flag — it MUST be passed into `EmitArgs.isInternalOnly` so internal logistics events
  never advance customer-facing `lastActivityAt` or show by default.
- **#3 `finalMatchedOrgId`:** `finalMatchedOrgId = orgResult.matchedOrgId ?? rfq.matchedOrgId`. Emit
  with this exact value (the one the org-api backfill actually wrote), never the pre-backfill local
  RFQ object — avoids the "backfilled DDB but emitted stale" footgun.
- **#4 manual `createOrder` org link:** before emit, `invokeOrganizationApi({ source:'order', email:
  primaryContactEmail, institution, submittedAt, scoreDelta })` → `matchedOrgId`, write it back to
  `Order.matchedOrgId`, then emit with that value. No email → `matchedOrgId` null → resolves via
  contact/domain or `unresolved` (Needs-Linking). This is the one site needing the new
  `orderApi → organizationApi` permission. Org-api invoke failure is non-fatal (order still created).
- **#5/#6 email fallback (committed choice):** primary link is `Order.matchedOrgId`. A primary-contact
  email is passed as a fallback **only when the resolver already has it in hand (zero extra query)**.
  For older unmatched manual orders where it is not already loaded, the event resolves `unresolved`
  and **2B backfill repairs it** — 2A does **not** add a speculative contact fetch.

### Deferred from 2A (noted, not built here)
- `rfq_status_changed` (convert / decline) — cheap but low-value; optional follow-on.
- `site_visit_session` (analytics) → 2C. Admin `manual` notes → Plan 3.

---

## 4. Ordering, Idempotency & Failure

**Invariant — emit strictly after source commit; a business mutation never synchronously depends on
timeline materialization.** Each site fires only after its `Put`/`Update` succeeds. If the source
write fails, nothing is emitted. If the source commits but the Lambda crashes before dispatch, the
source row simply has no timeline event yet — healed by the 2C existence-based sweep (compute the
expected deterministic id per source record, re-emit if missing). This is why async fire-and-forget
is safe: **the sweep is the durability backstop, not the invoke.**

**Idempotency — deterministic id + stable `occurredAt`:**
- `occurredAt` is always the source record's business timestamp (RFQ `submittedAt`, the
  `olog-`/`mlog-` entry timestamp, etc.) — never `Date.now()` at emit time. This guarantees live-emit
  and 2B-backfill produce the **same** id and **same** row, so they dedupe rather than duplicate.
- Duplicate ids collapse through P1's idempotent path; **rollups are applied once on first create and
  repaired/recomputed when an existing event changes or remains pending.** AWS async-retry (2×),
  double-delivery, and "sweep + live both fired" are therefore all safe.

**Failure handling, layer by layer:**

| Failure | Behavior |
|---|---|
| Source write fails | No emit; business path handles its own error. |
| Dispatch (`InvokeCommand`) fails | Default wrapper **logs** (`crm.emit.dispatch_failed`) and returns; business write already committed and returns OK; sweep re-emits later. |
| `crm-api` emit throws / partial | AWS async-retries 2× → optional DLQ; P1 `rollupApplied`/`rollupPendingOrgId` durability + 2C sweep complete the repair. |
| Org-api invoke fails (#4) | Non-fatal (matches existing submission flows): order created, `matchedOrgId` null, emit resolves `unresolved` → Needs-Linking. |

---

## 5. Testing Strategy

| Layer | Coverage |
|---|---|
| **Builders (unit, pure)** | each builder → exact `EmitArgs`: stable `occurredAt` = source timestamp; deterministic `idInput`; `resolveInput.matchedOrgId`/`email`; `isInternalOnly` passthrough (logistics); per-type summaries (lead types, status values). The dense, cheap layer. |
| **`invokeCrmApi` (unit)** | default → `InvocationType:'Event'` + `{action:'emitTimelineEvent'}` payload; dispatch failure → **logged, not thrown**. Async `Event` success means only that **Lambda accepted the event — NOT that the CRM projection succeeded** (projection failure is observed via `crm-api` logs/retries/2C sweep, not the caller). `{sync:true}` → `RequestResponse`, **throws** on invoke/function error. |
| **`crm-api` dispatch (unit)** | `{action:'emitTimelineEvent', args}` routes to `emitTimelineEvent`; unknown action errors; AppSync path unaffected. |
| **Per-channel wiring (integration, mocked ddb + mocked `invokeCrmApi`)** | emit fired after commit; **business write still succeeds when dispatch throws**; #3 `finalMatchedOrgId = orgResult ?? rfq.matchedOrgId`; #4 org-api invoke + `matchedOrgId` backfill + emit-with-final; #7/#8 `isInternalOnly` + related-order `matchedOrgId`; #6 only fires for `docType==='QUOTATION'`. |
| **Regression** | existing order-api / logistics-api / submit-* suites green (emit is additive + mocked). |

---

## 6. Change Surface (for the plan)

**New:** `amplify/lib/crm/{types.ts, invoke-crm-api.ts, emit-builders.ts}` (+ tests).
**Modified:** `crm-api/handler.ts` (direct-invoke branch); `amplify/backend.ts` (5× `crmApi` invoke
grants + env; `orderApi → organizationApi` grant + env); the 8 source sites (builder + dispatch after
commit; `createOrder` also adds the org-api upsert + `matchedOrgId` backfill).

**Natural task decomposition:** (1) foundation — shared `amplify/lib/crm/` module + `crm-api`
direct-invoke dispatch + `backend.ts` wiring; (2) one task per channel site (or grouped by Lambda);
(3) green-bar + regression.

---

## 7. Out of Scope / Forward Dependencies

- **2B backfill** consumes the same builders + emit semantics (stable `occurredAt`, deterministic ids)
  to materialize history and repair `unresolved` legacy events (incl. unmatched manual orders).
- **2C** adds the analytics `site_visit_session` rollup and the hot/cold reconciliation sweep — the
  durability backstop this design relies on. The sweep + any DLQ must be guarded `if (!isSandbox)`.
- No public GraphQL surface for `crm-api` in 2A; admin queries/UI are Plan 3.
