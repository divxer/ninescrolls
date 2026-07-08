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

Both mutations are `allow.authenticated()` (admin route surface). **They do not accept a trusted `operator` argument**: the resolver derives `operator` from `event.identity.claims.email ?? event.identity.sub ?? 'unknown'` and records that value in the audit row. If the deployment has Cognito admin groups/claims available, the resolver also enforces the admin claim server-side; otherwise it relies on the existing admin-only authenticated surface used by the surrounding admin GraphQL APIs. Both mutations perform **server-side target validation** (§4) and are **idempotent / first-writer-wins** (§4).

### 2.1 `linkStructuredUnit({ sourceType, sourceEntityId, targetOrgId })`
1. **Validate** `targetOrgId` is a real existing org (§4); reject `unresolved-*`.
2. Query the synthetic partition `ORG#unresolved-<sourceType>-<sourceEntityId>` for events still `resolutionStatus = 'unresolved'`. **If none → return `{ alreadyLinked: true, existingOrgId? }` and write nothing** (best-effort `existingOrgId` — do not run an expensive scan just to fill it).
3. For each unresolved event, **move to `targetOrgId` as `manually_linked`** (reason `manual`) using a dedicated **conditional manual-move helper**, not a plain duplicate `emitTimelineEvent(lockedOrgId)` call. The helper rewrites the existing `TLEVENT#<id>` item with new `orgId`, GSI2 keys, `resolutionStatus='manually_linked'`, `resolutionReason='manual'`, `confidence=1`, and **removes `GSI1PK/GSI1SK`**, guarded by a condition equivalent to `resolutionStatus = 'unresolved' AND orgId = <syntheticOrgId>`. The rewrite follows P1's durable rollup ordering: write the moved row with `rollupApplied=false` first, recompute the target org, then `markRollupApplied(id)`. If another admin already moved the row, the condition fails and the event is counted as `skipped`.
4. **Contact graph completion:** unresolved structured emits did not create contacts because sentinel orgs are excluded. When the enriched source supplies an email, the move path upserts a Contact for `targetOrgId`, writes the event `contactId`, and adds/refreshes the event's `GSI4PK/GSI4SK` contact index. If no email is available or enrichment failed, the event still moves with `contactId=null` and the result records `contactStatus='missing_email'|'enrichment_error'`.
5. **Backfill source `matchedOrgId = targetOrgId` — first-writer-wins:** write only if the source `matchedOrgId` is empty/null/missing/`unresolved-*`. **If it already holds a real, different org, do NOT overwrite** — return `sourceBackfillStatus = 'conflict'` (warning/partial), the event move still stands. (Prevents clobbering a fact set by a concurrent admin or the live matcher.) Success → future events on that source auto-resolve via `existing_matchedOrgId`.
   - RFQ/Lead/Order backfill their own `RFQ#/LEAD#/ORDER#.../META.matchedOrgId`.
   - Quote and logistics have no independent org field: quote backfills the underlying order from `payload.orderId`; logistics backfills the related order. If that order cannot be found or already has a conflicting real org, return the appropriate `sourceBackfillStatus`; the event move still applies.
6. `recomputeRollupsForOrg(targetOrgId)` is called by/after the move helper for moved rows. The old org is a sentinel unresolved partition, so recomputing it is a no-op; if future sentinels become real rollup targets, the helper must also recompute the old org before marking clean.
7. `writeLinkAuditLog` — one per-unit entry (§2.3).
8. Return `{ affected, moved, skipped, errors, sourceBackfillStatus, contactStatus }`.

### 2.2 `linkVisitor({ visitorId, targetOrgId })`
1. **Validate** `targetOrgId` (§4).
2. Read `VISITOR#<visitorId>/STATE`.
   - If the bridge is already `manual` → return `{ alreadyLinked: true, existingOrgId }`, write nothing (do not overwrite a manual link, even with a different org — that is the future edit-link feature).
   - If the bridge already has a real non-manual `matchedOrgId` (`rfq_match`/`lead_match`) → **do not overwrite it in 3B**. Return `{ alreadyResolved: true, existingOrgId }` and optionally fire `reResolveVisitorSessions({ visitorId })` to clean up stale unresolved markers for that same existing bridge. Overriding an automatic visitor bridge to a different org is a future edit-link feature because existing resolved sessions would need an explicit re-point/recompute pass.
3. If the bridge has no real org (missing bridge or `matchedOrgId=null`), upsert the bridge: `matchedOrgId = targetOrgId`, **`orgSource = 'manual'`** — a NEW highest-authority provenance that RFQ/Lead matching must never downgrade or overwrite. This uses a dedicated manual bridge helper or a widened `upsertVisitorBridge` contract; the existing RFQ/Lead-only helper must not infer `rfq_match`/`lead_match` for this path.
4. `reResolveVisitorSessions({ visitorId })` — retro-resolves the visitor's unresolved sessions to the bridge org (existing machinery; bounded by `maxSessions` with `RETRO#STATE` resume). Invoke with a generous budget; report resolved count and whether more are pending (resume + retry finishes them). Sessions become `resolved` via the bridge — the lock lives at the bridge (`manual`), not on each event.
5. `writeLinkAuditLog` — one per-unit entry (§2.3).
6. Return `{ visitorId, sessionsResolved, pending, existingOrgId? }`.

### 2.3 Audit payload (fixed)
Per-unit `LinkAuditLog` carries: `unitType`, `unitKey`, `targetOrgId`, `affectedEventIds`, `affectedCount`, `operator`, and one of `sourceBackfillStatus`/`contactStatus` (structured) or `retroSummary` (analytics). Admin actions are traceable from the audit log alone — not reconstructed from CloudWatch. **This requires extending the existing audit model**: add a `details: AWSJSON`/`Record<string, unknown>` field to `LinkAuditLogItem`, `LinkAuditLog` GraphQL custom type, and `writeLinkAuditLog` (or add a sibling `writeUnitLinkAuditLog` wrapper) so the per-unit payload is stored durably.

---

## Section 3 — UI: two-pane triage

**Layout:** a two-pane triage inbox (not a modal) — admins work a continuous triage loop; the list preserves context while the detail adapts per unit type.
- **Left (queue list):** units grouped `Structured` / `Site visitors`; each row = unit title + primary signal (domain / IP-org + geo) + `eventCount`.
- **Right (selected unit detail):**
  - Type-specific signal panel (structured: email/domain/model; analytics: IP-org/geo/topPaths/session count).
  - **Org search** reusing `listOrganizations({search})` → **name/fuzzy candidates** (exact-domain already failed at resolve time, so this is a "find the existing org" helper, not a domain-exact match). Selecting a candidate fills the target.
  - **"No existing org" dead-end copy:** "No exact domain match. Create the org first — 3B links to existing orgs only." No auto-create.
  - **Impact preview (required, doubles as confirmation copy — no extra modal):**
    - structured: "Links the currently loaded events for this unit to <org>, updates the source matchedOrgId when safe, recomputes rollups, writes 1 audit entry. The mutation will re-query and process all still-unresolved events for this unit."
    - analytics: "Sets the visitor bridge to <org> (manual) and re-resolves this visitor's unresolved sessions, writes 1 audit entry. The mutation result shows the authoritative count."
  - **Link button disabled until a target org is selected.**
- **No persistent skip.** On success the UI removes/evicts every loaded item with the same `unitKey`, then auto-advances to the next unit (or refetches the current page if the list is empty). An optional pure-client `Next` (no persistence, no audit) is allowed.
- **Known limitation (documented, not a bug):** a unit whose domain has no existing org (and the admin won't create one now) recurs at the top of the queue each session — it belongs to the deferred create-org fast-follow.
- Loading/error/empty states follow 3A conventions (skeleton, inline retry, "No units to link" empty state).

---

## Section 4 — Change surface, invariants, testing

### 4.1 Idempotency / concurrency contract
The authority of each mutation is **the set still-unresolved at execution time**:
- Structured: unresolved events under the synthetic partition. Empty → `alreadyLinked` no-op (no writes, no backfill). Already-`manually_linked` events left the synthetic partition, so they are never re-moved or silently re-pointed. Per-event conditional rewrites isolate races; a stale writer cannot move a row whose `resolutionStatus/orgId` no longer match the unresolved synthetic unit.
- Analytics: bridge has no real org. Already-`manual` → `alreadyLinked` no-op (no re-upsert, no re-retro). Already real non-manual → `alreadyResolved` no-op (optionally retrigger retro for stale unresolved markers under the same bridge).
- **First-writer-wins; the second admin sees "already linked."** Source backfill is also first-writer-wins (§2.1.4): never overwrite a real, different `matchedOrgId`.

### 4.2 Target org validation (server-side, both mutations)
`GetItem ORG#<targetOrgId>/META`; reject if absent or if `targetOrgId` matches `unresolved-*`. The frontend picker is convenience only; the backend is the gate.

### 4.3 `manual` provenance (visitor bridge)
`amplify/lib/crm/visitor-bridge.ts` gains `orgSource: 'manual'` as the **highest** tier: `manual` is never downgraded/overwritten by `rfq_match`/`lead_match`, and a second `manual` to a different org is rejected (§2.2.2), not clobbered. The type must widen from RFQ/Lead-only provenance to include manual source metadata without letting IP-derived org names write the bridge.

### 4.4 Change surface
- **Backend (crm-api):** `lib/read/needsLinkingQueue.ts`; `lib/link/linkStructuredUnit.ts`; `lib/link/linkVisitor.ts`; `lib/link/manualMoveTimelineEvent.ts` (conditional event move + contact completion + rollup dirty/clean ordering); `handler.ts` (+1 query resolver, +2 mutation resolvers); `amplify/lib/crm/visitor-bridge.ts` (+`manual` tier/helper); `auditStore`/`types` (+details payload); a small `orgExists(orgId)` check (reuse `orgStore`).
- **Schema (`amplify/data/resource.ts`):** `needsLinkingQueue` query + `NeedsLinkingItem`/`NeedsLinkingConnection`; `linkStructuredUnit` + `linkVisitor` mutations + result types; `LinkAuditLog.details` (or equivalent unit-audit payload); all `allow.authenticated()`, with resolver-side admin guard if group claims exist.
- **Frontend:** `useNeedsLinkingQueue` hook; `NeedsLinkingPage` (two-pane) + `UnitList` + type-adaptive `UnitDetail` + org-search (reuse `organizationAdminService.listOrganizations`); `needsLinkingQueue`/`linkStructuredUnit`/`linkVisitor` service calls; a new admin route + nav entry.

### 4.5 Testing surface (vitest)
- **Backend:**
  - `linkStructuredUnit`: conditionally moves unresolved events to target (manually_linked, GSI1 dropped, GSI2 re-pointed); a stale move after another admin linked the event is skipped; moved rows are written dirty (`rollupApplied=false`), target rollup is recomputed, then `markRollupApplied`; enriched email creates/updates contact + event contact index; backfills source/underlying-order `matchedOrgId` only when empty; **does not overwrite a real different `matchedOrgId`** (→ `conflict`); writes one per-unit audit with fixed details payload; **idempotent already-linked no-op writes nothing**; **rejects a non-existent / `unresolved-*` target**; per-event error isolated into `errors`.
  - `linkVisitor`: writes bridge `manual` only when no real bridge exists; triggers `reResolveVisitorSessions`; **already-`manual` → no-op**; existing non-manual real bridge → `alreadyResolved` no-op (+ optional stale-marker retro); rejects invalid target; audit fixed payload.
  - `visitor-bridge`: `manual` is not downgraded by a subsequent `rfq_match`/`lead_match` upsert, and RFQ/Lead upserts cannot overwrite an existing manual bridge.
  - `auditStore`/schema: per-unit details are stored in the audit item and exposed through `LinkAuditLog.details`.
  - `needsLinkingQueue`: collapses events to units (structured by synthetic key, analytics by visitorId); enriches structured from source; **enrichment failure isolated** (`enrichmentStatus`); excludes voided + internal.
- **Frontend:** queue groups by unit type; detail adapts structured vs analytics; **link disabled until org selected**; impact-preview text renders per type without overstating page-local counts; link action calls the correct mutation; success evicts all loaded rows with the same `unitKey` and auto-advances/refetches.

## Open items for the plan
- Exact per-source enrichment reuse (extract shared `sourceEmail`/`sourceDomain` helper from `existencePass`, or import).
- `NeedsLinkingItem.kind` "representative" pick when a unit has multiple event kinds (e.g. order_created + stage changes) — newest, or a fixed priority.
