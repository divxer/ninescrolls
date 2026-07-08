# Customer 360 Timeline — Plan 3B: Needs-Linking + Manual Re-link (Design)

**Status:** Approved for planning 2026-07-08.
**Depends on (all merged + live in prod):** P1 (`resolveLinks`/`emitTimelineEvent`/`recomputeRollupsForOrg`/`writeLinkAuditLog`), P2A, 2C-sweep, 2C-analytics (visitor bridge + `reResolveVisitorSessions`), 3A (read view).

## Goal

Solve the second founding pain — **"links untrustworthy"** — by giving admins a **Needs-Linking queue** that surfaces unresolved TimelineEvents as actionable **link units**, plus a **manual re-link** workflow that resolves each unit to a real organization in a way that is durable, auditable, and self-converging (fixes the source fact, not just one row).

## Why now

3A made the timeline visible and confirmed a real backlog: **~65 unresolved events in prod** (via the sparse GSI1 `TLEVENT_STATUS#unresolved`), across `unresolved-order-*`, `unresolved-rfq-*`, and `unresolved-analytics-*` synthetic partitions. These never resolved to a real org (corporate domain with no existing org, personal email, or an analytics visitor with no bridge). Until an admin can link them, they stay invisible under synthetic partitions and their source facts stay unmatched.

## Scope

**In scope (3B):** one Needs-Linking queue + two **unit-aware** link paths.
1. `needsLinkingQueue` read (collapse unresolved events to link units + server-side enrichment).
2. `linkStructuredUnit` — RFQ/Lead/Order/Quote/Logistics link by **source entity**.
3. `linkVisitor` — `site_visit_session` link by **visitor** (bridge + retro-resolve).
4. Two-pane triage UI (queue list + type-adaptive detail + org picker + impact preview).

**Explicit non-goals (deferred):**
- **Org auto-create / "create org from domain" / review-org workflow** — 3B links to **existing orgs only**. A unit whose domain has no existing org stays in the queue with a "create org first" state. (Fast-follow: reopens auto-create ownership + org-quality gate — out of MVP.)
- **Bulk apply-to-domain** — deferred (needs enrichment + preview/undo semantics).
- **Editing an already-resolved link** ("re-link a mistake") — the queue only surfaces *unresolved* units; correcting a wrong link is a separate future edit-link feature.
- **Event-only relink** — not a primary path; at most a future admin/debug escape hatch.
- **Persistent skip / snooze / ignore** — introduces new per-unit state; MVP does not persist skip. On successful link the UI auto-advances to the next unit; an optional pure-client `Next` (no persistence) is allowed.
- **CRM Health panel** → Plan 3C.

## Architecture / data flow

Admin opens the Needs-Linking page → `useNeedsLinkingQueue` → GraphQL `needsLinkingQueue` → crm-api resolver reads GSI1 unresolved (paginated), **collapses events into link units** (structured: by synthetic partition / `sourceEntityId`; analytics: by `visitorId`) and **enriches** each unit server-side. Admin selects a unit → detail pane shows the enriched signal + an org search (reusing `organizationAdminService.listOrganizations({search})`) + an impact preview → admin picks a real org → `linkStructuredUnit` or `linkVisitor` mutation → crm-api performs the move/retro + backfill + recompute + audit → the unit leaves GSI1 and the queue.

---

## Section 1 — `needsLinkingQueue` read + enrichment

### 1.1 Query contract
```
needsLinkingQueue(limit: Int, nextToken: String): NeedsLinkingConnection!
NeedsLinkingConnection { items: [NeedsLinkingItem!]!, nextToken: String }
```
Auth `allow.authenticated()`. Handler: crm-api resolver. Reads GSI1 `TLEVENT_STATUS#unresolved` (sparse; only unresolved events carry `GSI1PK`), descending, paginated.

### 1.2 Filters (server-side)
- Only `voided = false`.
- **Exclude `isInternalOnly = true`** by default (MVP has no "include internal unresolved" toggle).

### 1.3 Collapse events → link units
- **Structured** (`source` ∈ rfq/lead/order/quote/logistics): unit key = the synthetic `orgId` (`unresolved-<source>-<sourceEntityId>`); all of that source entity's events share it. `linkUnitType = 'structured'`.
- **Analytics** (`source = analytics`): unit key = `visitorId` (from the event payload). `linkUnitType = 'analytics'`.
- **Collapse is per-loaded-page (approximate).** `eventCount` is a display hint for the current slice, **not an authoritative total**. The link mutation re-queries the full unit at execution time, so correctness never depends on queue paging (§4).

### 1.4 Enrichment (asymmetric)
- **Analytics: no enrichment** — signal comes from the event payload (`orgNameDisplay` (IP guess), `country`, `region`, `topPaths`, `pageCount`, `visitorId`).
- **Structured: enrich from the source record** — GetItem the source META to derive `email` → `domain` (eTLD+1). Reuse the existing source-email logic from `existencePass` (`RFQ#/LEAD# META.email`; order via `GSI4PK EMAIL#` else linked RFQ; quote via `payload.orderId`'s order; logistics via related order). Plus `productModel`/`equipmentCategory` from the event payload.
- **Enrichment failure is isolated per-unit** (mirrors the sweep's per-record isolation): a missing/broken source record returns the unit with `signal.enrichmentStatus = 'missing_source' | 'error'` and the UI shows "source unavailable". One bad source never fails the whole page.

### 1.5 `NeedsLinkingItem` shape
`{ unitKey, linkUnitType: 'structured'|'analytics', source, kind (representative), occurredAt (most recent), eventCount, sourceEntityId?, visitorId?, signal: { email?, domain?, productModel?, equipmentCategory?, orgNameDisplay?, country?, region?, topPaths?, enrichmentStatus: 'ok'|'missing_source'|'error' } }`

---

## Section 2 — Link mutation contracts

Both mutations are `allow.authenticated()` (admin). Both perform **server-side target validation** (§4) and are **idempotent / first-writer-wins** (§4).

### 2.1 `linkStructuredUnit({ sourceType, sourceEntityId, targetOrgId, operator })`
1. **Validate** `targetOrgId` is a real existing org (§4); reject `unresolved-*`.
2. Query the synthetic partition `ORG#unresolved-<sourceType>-<sourceEntityId>` for events still `resolutionStatus = 'unresolved'`. **If none → return `{ alreadyLinked: true, existingOrgId? }` and write nothing** (best-effort `existingOrgId` — do not run an expensive scan just to fill it).
3. For each unresolved event, **move to `targetOrgId` as `manually_linked`** (reason `manual`), via the existing emit link-move path (`resolveLinks` already returns `manually_linked` for a `lockedOrgId`): re-point `GSI2PK → ORG#<targetOrgId>`, **drop `GSI1PK/GSI1SK`** (leave unresolved index), recompute rollups. Per-event conditional (move only if still unresolved) isolates races; a bad event is skipped, not fatal.
4. **Backfill source `matchedOrgId = targetOrgId` — first-writer-wins:** write only if the source `matchedOrgId` is empty/null/missing/`unresolved-*`. **If it already holds a real, different org, do NOT overwrite** — return `sourceBackfillStatus = 'conflict'` (warning/partial), the event move still stands. (Prevents clobbering a fact set by a concurrent admin or the live matcher.) Success → future events on that source auto-resolve via `existing_matchedOrgId`.
5. `recomputeRollupsForOrg(targetOrgId)`.
6. `writeLinkAuditLog` — one per-unit entry (§2.3).
7. Return `{ affected, moved, skipped, errors, sourceBackfillStatus }`.

### 2.2 `linkVisitor({ visitorId, targetOrgId, operator })`
1. **Validate** `targetOrgId` (§4).
2. Read `VISITOR#<visitorId>/STATE`. **If bridge is already `manual` → return `{ alreadyLinked: true, existingOrgId }`, write nothing** (do not overwrite a manual link, even with a different org — that is the future edit-link feature).
3. Upsert the bridge: `matchedOrgId = targetOrgId`, **`orgSource = 'manual'`** — a NEW highest-authority provenance that RFQ/Lead matching must never downgrade or overwrite.
4. `reResolveVisitorSessions({ visitorId })` — retro-resolves the visitor's unresolved sessions to the bridge org (existing machinery; bounded by `maxSessions` with `RETRO#STATE` resume). Invoke with a generous budget; report resolved count and whether more are pending (resume + retry finishes them). Sessions become `resolved` via the bridge — the lock lives at the bridge (`manual`), not on each event.
5. `writeLinkAuditLog` — one per-unit entry (§2.3).
6. Return `{ visitorId, sessionsResolved, pending, existingOrgId? }`.

### 2.3 Audit payload (fixed)
Per-unit `LinkAuditLog` carries: `unitType`, `unitKey`, `targetOrgId`, `affectedEventIds`, `affectedCount`, `operator`, and one of `sourceBackfillStatus` (structured) / `retroSummary` (analytics). Admin actions are traceable from the audit log alone — not reconstructed from CloudWatch.

---

## Section 3 — UI: two-pane triage

**Layout:** a two-pane triage inbox (not a modal) — admins work a continuous triage loop; the list preserves context while the detail adapts per unit type.
- **Left (queue list):** units grouped `Structured` / `Site visitors`; each row = unit title + primary signal (domain / IP-org + geo) + `eventCount`.
- **Right (selected unit detail):**
  - Type-specific signal panel (structured: email/domain/model; analytics: IP-org/geo/topPaths/session count).
  - **Org search** reusing `listOrganizations({search})` → **name/fuzzy candidates** (exact-domain already failed at resolve time, so this is a "find the existing org" helper, not a domain-exact match). Selecting a candidate fills the target.
  - **"No existing org" dead-end copy:** "No exact domain match. Create the org first — 3B links to existing orgs only." No auto-create.
  - **Impact preview (required, doubles as confirmation copy — no extra modal):**
    - structured: "Links N events to <org>, sets matchedOrgId on <sourceEntityId>, recomputes rollups, writes 1 audit entry."
    - analytics: "Sets the visitor bridge to <org> (manual) and re-resolves N sessions, writes 1 audit entry."
  - **Link button disabled until a target org is selected.**
- **No persistent skip.** On success the UI auto-advances to the next unit. An optional pure-client `Next` (no persistence, no audit) is allowed.
- **Known limitation (documented, not a bug):** a unit whose domain has no existing org (and the admin won't create one now) recurs at the top of the queue each session — it belongs to the deferred create-org fast-follow.
- Loading/error/empty states follow 3A conventions (skeleton, inline retry, "No units to link" empty state).

---

## Section 4 — Change surface, invariants, testing

### 4.1 Idempotency / concurrency contract
The authority of each mutation is **the set still-unresolved at execution time**:
- Structured: unresolved events under the synthetic partition. Empty → `alreadyLinked` no-op (no writes, no backfill). Already-`manually_linked` events left the synthetic partition, so they are never re-moved or silently re-pointed. Per-event conditional writes isolate races.
- Analytics: bridge not already `manual`. Already-`manual` → `alreadyLinked` no-op (no re-upsert, no re-retro).
- **First-writer-wins; the second admin sees "already linked."** Source backfill is also first-writer-wins (§2.1.4): never overwrite a real, different `matchedOrgId`.

### 4.2 Target org validation (server-side, both mutations)
`GetItem ORG#<targetOrgId>/META`; reject if absent or if `targetOrgId` matches `unresolved-*`. The frontend picker is convenience only; the backend is the gate.

### 4.3 `manual` provenance (visitor bridge)
`amplify/lib/crm/visitor-bridge.ts` gains `orgSource: 'manual'` as the **highest** tier: `manual` is never downgraded/overwritten by `rfq_match`/`lead_match`, and a second `manual` to a different org is rejected (§2.2.2), not clobbered.

### 4.4 Change surface
- **Backend (crm-api):** `lib/read/needsLinkingQueue.ts`; `lib/link/linkStructuredUnit.ts`; `lib/link/linkVisitor.ts`; `handler.ts` (+1 query resolver, +2 mutation resolvers); `amplify/lib/crm/visitor-bridge.ts` (+`manual` tier); a small `orgExists(orgId)` check (reuse `orgStore`).
- **Schema (`amplify/data/resource.ts`):** `needsLinkingQueue` query + `NeedsLinkingItem`/`NeedsLinkingConnection`; `linkStructuredUnit` + `linkVisitor` mutations + result types; all `allow.authenticated()`.
- **Frontend:** `useNeedsLinkingQueue` hook; `NeedsLinkingPage` (two-pane) + `UnitList` + type-adaptive `UnitDetail` + org-search (reuse `organizationAdminService.listOrganizations`); `needsLinkingQueue`/`linkStructuredUnit`/`linkVisitor` service calls; a new admin route + nav entry.

### 4.5 Testing surface (vitest)
- **Backend:**
  - `linkStructuredUnit`: moves unresolved events to target (manually_linked, GSI1 dropped, GSI2 re-pointed); backfills source `matchedOrgId` only when empty; **does not overwrite a real different `matchedOrgId`** (→ `conflict`); writes one per-unit audit with fixed payload; **idempotent already-linked no-op writes nothing**; **rejects a non-existent / `unresolved-*` target**; per-event error isolated into `errors`.
  - `linkVisitor`: upserts bridge `manual`; triggers `reResolveVisitorSessions`; **already-`manual` → no-op** (no re-upsert); rejects invalid target; audit fixed payload.
  - `visitor-bridge`: `manual` is not downgraded by a subsequent `rfq_match`/`lead_match` upsert.
  - `needsLinkingQueue`: collapses events to units (structured by synthetic key, analytics by visitorId); enriches structured from source; **enrichment failure isolated** (`enrichmentStatus`); excludes voided + internal.
- **Frontend:** queue groups by unit type; detail adapts structured vs analytics; **link disabled until org selected**; impact-preview text renders per type; link action calls the correct mutation; auto-advance on success.

## Open items for the plan
- Exact per-source enrichment reuse (extract shared `sourceEmail`/`sourceDomain` helper from `existencePass`, or import).
- Whether the structured move re-emits via `emitTimelineEvent(lockedOrgId)` or a direct conditional GSI move — pick the one with the smaller blast radius at plan time; both must drop GSI1 + recompute.
- `NeedsLinkingItem.kind` "representative" pick when a unit has multiple event kinds (e.g. order_created + stage changes) — newest, or a fixed priority.
- **Structured backfill target per source type:** rfq/lead/order write their own `RFQ#/LEAD#/ORDER# META.matchedOrgId`. quote/logistics have no own org field — their backfill target is the **underlying order** (quote → its `payload.orderId` order; logistics → the related order). In practice these are rare (an unresolved quote/logistics usually means its order was unresolved — linking the order resolves them); plan decides whether 3B backfills the underlying order or defers quote/logistics backfill (event move still applies regardless).
