# Customer 360 Timeline — Plan 2C-sweep: Reconciliation Sweep Design Spec

**Date:** 2026-06-30
**Status:** Approved — proceed to writing-plans
**Scope:** The reconciliation sweep half of Plan 2C — the durability backstop for the timeline projection. Builds on merged P1 (`crm-api`) + 2A (channel wiring). The analytics `site_visit_session` rollup is a **separate** sub-plan (2C-analytics), out of scope here.

---

## 1. Context & Position

2A wired 8 business channels to emit timeline events via **async fire-and-forget** Lambda invoke (`InvocationType:'Event'`, AWS 2× retry). That makes "business write committed but timeline projection missing" an expected, eventually-consistent state — and the **reconciliation sweep is the loop that closes it**. It also heals P1's durable partial-failure marker (`rollupApplied=false` / `rollupPendingOrgId`).

Because 2A's emit is async, the business Lambdas do **not** set any `timelineSynced` flag on source records — so the sweep is **purely existence-based**: enumerate source records, compute the expected deterministic timeline id (via the same 2A builders + P1 `timelineId`), and re-emit only if the `TimelineEvent` is missing.

**2C is split** into two independent spec→plan→build cycles:
- **2C-sweep (this spec)** — re-emit missing events + repair dirty rollups.
- **2C-analytics (separate)** — `site_visit_session` rollup; deferred because its org-resolution is genuinely hard (analytics rows carry only an ISP/display org, never a canonical eTLD+1 `orgId`; resolution would require a `visitorId`→org correlation, and RFQ has no `visitorId` field).

---

## 2. Architecture

The sweep is **CRM's own self-healing**, not a new channel — so it lives inside `crm-api` and reuses everything **in-process** (no per-event re-invoke).

- **Entry:** a new `crm-api` direct-invoke action (extends the 2A `action` dispatch):
  ```
  { action: 'reconcileSweep', mode: 'hot' | 'cold', cursor?, limit? }
  ```
  It calls `emitTimelineEvent` / `getTimelineEvent` / `recomputeRollupsForOrg` and the `amplify/lib/crm` builders directly.
- **Two independent passes:**
  1. **Existence pass** (§3) — re-emit *missing* events.
  2. **Dirty-rollup pass** (§4) — repair `rollupApplied=false`.
- **Cron:** EventBridge `Rule`s created **only `if (!isSandbox)`** (mirroring the Tender-Watch block at `backend.ts:~973`), targeting `crm-api` with `RuleTargetInput.fromObject({ action:'reconcileSweep', mode })`. **Cadence is tunable config, not a correctness invariant** — initial: **hot every ~30 min**, **cold daily off-peak** (e.g. 03:00 UTC, after the 02:xx Tender block).
- **Config:** `crm-api` `timeoutSeconds` → ~120 (a max, not a cost; doesn't affect request invokes — each Lambda invocation is its own execution env, so the sweep never starves live emits). Every invocation is `limit`-bounded; progress is durable across fires (§5).
- **Reuse, zero new grants:** `crm-api` already has `INTELLIGENCE_TABLE` read/write; the sweep touches only the shared table. (`AnalyticsEvent` is 2C-analytics only.)

**Scope exclusion — no void reconciliation.** The sweep re-emits events for *existing* source records; it does **not** void timeline events for cancelled/deleted/archived sources. "Missing source" is overloaded (deletion vs archival vs legacy partial data vs a scan/query gap) and deserves its own design.

---

## 3. Existence Pass

Re-emit only *missing* events. For each enumerated source record, build the expected `EmitArgs` via the **same 2A builders**, compute its id, `getTimelineEvent(id)`, and `emitTimelineEvent(...)` only if absent. Re-emit is idempotent: it produces the exact id live-emit would have (stable source timestamp), so present events can never duplicate.

**Deterministic channel order + cursor (resumable across heterogeneous sources):**
`rfq → lead → order → logistics` (4 channels). The cursor is `{ channel, lastEvaluatedKey }` — it records which channel + intra-channel scan position the pass has reached, advancing channel-by-channel, so progress resumes cleanly without one ambiguous global table-scan cursor. The **`order` channel yields three event kinds** (`order_created` from META + `order_stage_changed` from `STATUS_CHANGE` `LOG#` children + `quote_sent` from `QUOTATION` `DOC#` children) by querying the order's partition (child query paginated). Each channel is discriminated by **`PK` prefix + `SK='META'`** (source META rows do **not** carry an `entityType` attribute) and uses its **own recency field** for hot (`submittedAt` for rfq/lead; `updatedAt` for order/logistics) — never one global `updatedAt` filter.

**Per-channel enumeration** — use the **cheapest existing access path per source; fall back to `scan` + `FilterExpression` where no suitable GSI exists** (source item shapes are not perfectly uniform). Confirmed source shapes: RFQ `PK:RFQ#…/SK:META` (`submittedAt`, `matchedOrgId`); LEAD `PK:LEAD#…/SK:META` (`submittedAt`, `type`, `matchedOrgId`); ORDER `PK:ORDER#…/SK:META` (`createdAt`/`updatedAt`, `matchedOrgId`) with children `SK:LOG#…` (`id` olog-, `action`, `toStatus`) and `SK:DOC#${stage}#${docId}` (`docId`, `docType`, `fileName`); LOGISTICS `PK:LOGISTICS#…/SK:META` (`updatedAt`, `relatedOrderId`, `milestoneLog[]` with `id` mlog-). **None carry `entityType`.**

| Channel | Source / sub-entry | Expected event(s) | Builder |
|---|---|---|---|
| rfq | `RFQ#…/META` | `rfq_submitted` (1) | `buildRfqEmitArgs(rfq, rfq.matchedOrgId)` |
| lead | `LEAD#…/META` | `lead_captured` (1) | `buildLeadEmitArgs(lead, lead.matchedOrgId)` |
| order-meta | `ORDER#…/META` | `order_created` (1) | `buildOrderCreatedEmitArgs` |
| order-logs | `ORDER#…` `LOG#…` with `action='STATUS_CHANGE'` (stable `olog-` id) | `order_stage_changed` (per status log) | `buildOrderStageChangedEmitArgs(order, log)` |
| order-docs | `ORDER#…` `DOC#…` with `docType='QUOTATION'` (stable `doc-` id) | `quote_sent` (per quote doc) | `buildQuoteSentEmitArgs(order, doc)` |
| logistics | `LOGISTICS#…/META` each `milestoneLog[]` entry (stable `mlog-` id) | `logistics_milestone` (per entry: CASE_CREATED + STAGE_ADVANCED) | `buildLogisticsMilestoneEmitArgs`; org from related order |

**Critical maintenance invariant.** The sweep's enumeration must produce **exactly** the set of events live-emit produces — same kinds, same stable-key ids — or it under-emits (misses) or over-emits (orphan ids live-emit never makes). It therefore mirrors each 2A site's emit condition (e.g. `order_stage_changed` only for `STATUS_CHANGE` logs; `quote_sent` only for `QUOTATION` docs). **Adding a future emit site requires updating this enumeration to match.** `occurredAt` is read from the stored record's business timestamp (`submittedAt` / `log.timestamp` / `doc.uploadedAt` / `milestone.timestamp`), guaranteeing the sweep's id equals live-emit's.

**Hot vs cold scope:**
- **hot — best-effort.** Recent audit via parent `updatedAt > now−24h` *where reliable*, plus any cheap child-recency source that exists. NOTE: parent `updatedAt` does not reliably cover child sub-entries — e.g. `confirmDocumentUpload` writes `DOC#`/`LOG#` but may not bump `ORDER#/META.updatedAt`, so a dropped `quote_sent` can escape hot. That is acceptable: hot is best-effort.
- **cold — authoritative + exhaustive.** The full set, paginated across fires via the durable cursor; **guarantees eventual coverage of child rows without global recency indexes**.

**Existence check:** one `getTimelineEvent(expectedId)` per expected event (cheap; `BatchGetItem` is a later optimization). Per-record errors are isolated (§5).

**The signal this gives us:** a persistently rising `missingReemitted` count means **live emit (2A) is drifting/broken**, not transient noise — the most valuable health signal the sweep produces.

---

## 4. Dirty-Rollup Pass

Heal `rollupApplied=false` (P1's partial-emit-failure marker). **Cold-only:** a dirty row is *present* (the existence pass skips it), and finding it has no index → a scan, which belongs in the exhaustive pass. The lag is acceptable — the timeline *events* are already correct; only the org *count* aggregates lag ≤ 1 cold cycle, and dirty rows are rare (only on a mid-flight emit crash).

**Find:** scan the shared table filtered to `entityType='TIMELINE_EVENT' AND rollupApplied = false` — **no GSI** (an exceptional state isn't worth expanding the P1 data model / migration surface). Bounded by `limit` + the dirty-pass cursor (rarely paginates).

**Repair each dirty row** (reusing P1 semantics — no hand-rolled logic):
1. if `rollupPendingOrgId` set → `recomputeRollupsForOrg(rollupPendingOrgId)` (the durable old-org marker from a crashed link-move);
2. `recomputeRollupsForOrg(orgId)`;
3. mark clean via the **shared `markRollupApplied(id)` helper** (extracted from `emitTimelineEvent` — §6).

`recomputeRollupsForOrg` is authoritative + idempotent. **Sentinel guard:** the plan must verify `recomputeRollupsForOrg` already no-ops `unresolved-`/sentinel orgs (P1's `isRealOrg` guard suggests it does); if not, the sweep explicitly skips `orgId.startsWith('unresolved-')` before recompute, matching P1.

This is exactly P1's own duplicate-path repair (recompute affected orgs → mark clean), **driven by a scan instead of a re-emit** — so it can't drift from live behavior, and needs no source-record read.

---

## 5. Cursor / Lease, Error Handling, Idempotency, Observability

**Durable state — one item per `mode#pass`** (independent cursors so a long source audit and a dirty scan never clobber each other):
- `CRM_SWEEP#hot#existence / STATE`
- `CRM_SWEEP#cold#existence / STATE`
- `CRM_SWEEP#cold#dirty-rollups / STATE`

Fields: `cursor` (channel position + `LastEvaluatedKey`), `hasMore`, `lease` (token + `leaseExpiresAt`), `lastRunAt`, `lastCompletedAt`, `lastSummary`.

**Per-invocation flow for a pass:**
1. **Acquire lease** — conditional update: set `lease`/`leaseExpiresAt = now + max(2 × lambdaTimeout, 5min)` only if no active lease (or expired). **Lease duration tracks the Lambda timeout** so it stays correct if the timeout is later tuned up. If another run holds an active lease → **skip this pass** (overlap guard: a still-running cold run, or hot every 30 min, never double-processes). Expiry auto-recovers a crashed run.
2. **Resume** from the stored `cursor` (or an admin-supplied **override cursor** for debug; or fresh if the prior cycle completed).
3. Process up to **`limit`** records.
4. **Persist after EACH page** — cursor (advanced `LastEvaluatedKey`/channel), summary counters, and a lease heartbeat. A mid-pass throw therefore resumes from the last successfully persisted page, not the pass start.
5. At the **final page** — clear cursor (next cold cycle starts fresh), `hasMore=false`, set `lastCompletedAt`, release lease.

**Error isolation:** each record's processing is wrapped — a malformed/failing record is logged (id + error) + increments `errors`, and the batch continues; it stays missing/dirty and is retried next cycle. A whole-pass throw is caught; the lease expires and the next fire resumes from the persisted cursor.

**Idempotency:** existence re-emit is deterministic-id idempotent; dirty repair is recompute-authoritative — so re-runs, overlapping cycles, and replays never duplicate or double-count.

**Run summary** (returned + logged as `crm.sweep.summary`): `{ mode, pass, scanned, missingReemitted, dirtyFound, repaired, errors, hasMore }`. Plan 3's CRM Health surfaces last hot/cold run times + these counts. **Alarm-worthy:** persistently rising `missingReemitted` (live emit broken), non-zero `errors`, or stuck `hasMore`.

---

## 6. Change Surface

- **Small P1 refactor:** extract the inline `markRollupClean` arrow in `crm-api/lib/emitTimelineEvent.ts` into an exported `markRollupApplied(id)` helper; `emitTimelineEvent` and the sweep both call it (so the repair path can't drift). Verify `recomputeRollupsForOrg`'s sentinel no-op (else add the `unresolved-` skip in the sweep).
- **New `crm-api/lib/sweep/`:**
  - `sweepState.ts` — durable cursor/lease on `CRM_SWEEP#<mode>#<pass>/STATE` (read, acquire-lease, persist-page heartbeat, release).
  - `existencePass.ts` — deterministic-order per-channel enumeration → expected id via 2A builders → `getTimelineEvent` → `emitTimelineEvent` if missing.
  - `dirtyRollupPass.ts` — scan `rollupApplied=false` → recompute(pending)+recompute(org) → `markRollupApplied`.
  - `reconcileSweep.ts` — action entry: `hot`→existence(recent); `cold`→existence(full)+dirty.
- **`crm-api/handler.ts`** — add the `reconcileSweep` action to the dispatch.
- **`crm-api/resource.ts`** — `timeoutSeconds: 120`.
- **`amplify/backend.ts`** — two EventBridge `Rule`s (`!isSandbox`) → `crm-api` with `RuleTargetInput.fromObject({action:'reconcileSweep', mode})`; no new grants.
- The sweep reads stored items **defensively** (`Record<string,unknown>` → builder inputs) to avoid heavy cross-function type coupling with order-api/logistics-api/submit-* item types.

---

## 7. Testing

| Layer | Coverage |
|---|---|
| `markRollupApplied` (unit) + emit regression | helper does `SET rollupApplied=:t REMOVE rollupPendingOrgId`; `emitTimelineEvent` suite still green after the extraction |
| `sweepState` (unit, mocked ddb) | acquire-lease skips when an active lease exists; lease = `max(2×timeout,5min)`; per-page persist advances cursor + heartbeat; final page clears cursor + releases; admin override cursor |
| `existencePass` (unit, mocked store/emit/builders) | missing → emit with correct id/args; present → no emit; deterministic channel order; each channel incl. `order_stage_changed` **only for STATUS_CHANGE logs**, `quote_sent` **only for QUOTATION docs**, one `logistics_milestone` per entry; hot filters `updatedAt>cutoff`; per-record error isolation; pagination (`limit`→cursor) |
| `dirtyRollupPass` (unit) | dirty rows → recompute(pendingOrgId)+recompute(orgId)+`markRollupApplied`; sentinel `unresolved-` skipped; none dirty → no-op; pagination |
| `reconcileSweep` + handler (unit) | hot→existence only; cold→both passes; lease-held→skip; summary shape; `{action:'reconcileSweep'}` dispatches; emit/AppSync paths intact |
| backend (typecheck) | `Rule` + `RuleTargetInput` + 120s timeout |

---

## 8. Out of Scope (this spec)

- **Void/cancellation reconciliation** — needs its own design (overloaded "missing source").
- **Analytics `site_visit_session` rollup** — the separate 2C-analytics cycle.
- **A `rollupApplied` GSI** — deliberately not added; the dirty pass scans (exceptional state).
- **Admin/debug manual trigger UI** — Plan 3 (it reuses the same `reconcileSweep` action; no new entry point).
- **`BatchGetItem` existence-check optimization** — a later perf improvement, not P1-correctness.
