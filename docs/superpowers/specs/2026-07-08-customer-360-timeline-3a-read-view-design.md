# Customer 360 Timeline — Plan 3A: Read View (Design)

**Status:** Approved for planning 2026-07-08.
**Depends on (all merged + live in prod):** P1 (crm-api `TimelineEvent`/`Contact`/`resolveLinks`), P2A (channel emit wiring), 2C-sweep (reconciliation), 2C-analytics (`site_visit_session` rollup + visitor bridge).

## Goal

Make the materialized `TimelineEvent` model **visible and usable** in the admin app: a unified, reverse-chronological Customer 360 timeline on the Organization detail page that renders every customer interaction (RFQ, Lead, Order, Quote, Logistics, and resolved analytics **site visits**) as one journey, replacing the old per-entity RFQ/Orders/Leads tabs.

## Why now

The entire Customer 360 pipeline is currently **write-only**: P1 built emit/resolve/store, P2A wired channel emits, 2C keeps it consistent — but **nothing reads the materialized `TimelineEvent`**. Evidence:
- crm-api's AppSync `resolvers` map is empty (`const resolvers = {}`), so `timelineByOrg` does not exist.
- `OrganizationDetailPage` still renders the **old heuristic timeline**: `OrganizationTimeline.tsx` reads `recentRfqs`/`recentOrders`/`recentLeads` from the `organization-api` bundle, split across RFQ/Orders/Leads/Tenders tabs — exactly the "query-time, client-side, entity-siloed, not persisted" view the project set out to replace.

3A is the read/consume half of the project. It resolves the first of the two founding pains ("can't see full history"). The second ("links untrustworthy") is Plan 3B (Needs-Linking / re-link); ops observability is Plan 3C (CRM Health).

## Scope

**In scope (3A):**
1. A new `timelineByOrg` AppSync query served by crm-api (its first AppSync resolver).
2. A resolver-side mapper `TimelineEventItem → OrganizationTimelineItem` (display-friendly, structured, typed).
3. A unified timeline UI (medium-density "Timeline Cards") with client-side source filter chips, replacing the old tabs.
4. A one-time, pre-launch **catch-up** that materializes historical structured events by looping the existing cold reconciliation sweep, plus a small sweep coverage-counter enhancement.

**Explicit non-goals (deferred):**
- Needs-Linking queue, manual re-link, `manually_linked`+`linkLocked`, `writeLinkAuditLog` writes → **Plan 3B**.
- CRM Health panel (unresolved rate, sweep re-emits, rollup drift) → **Plan 3C**.
- **No analytics backfill** — 2C-analytics stays forward-only; only structured interactions are caught up.
- **No server-side kind filtering / no kind-dimension GSI** — source chips are client-side over the loaded feed.
- No changes to `organization-api` (the org bundle / header / aggregate cards stay as-is).
- No changes to analytics rollup or sweep core logic (only additive coverage counters).
- No auto-created "review" orgs — `email_domain_new`/`organization_name_match` remain unimplemented reserved values; there is no "Review-New-Orgs" queue in 3A (no such data exists).

## Architecture / data flow

`OrganizationDetailPage` loads two sources **in parallel**, independently:
- **(a)** `useOrganization(orgId)` (existing) → `organization-api` bundle → header + aggregate cards. **Unchanged.**
- **(b)** `useOrganizationTimeline(orgId, { includeInternal })` (new) → GraphQL `timelineByOrg` → crm-api resolver → Query GSI2 on `ORG#<orgId>` (reverse-chron, scoped + filtered) → each `TimelineEventItem` mapped to `OrganizationTimelineItem` → connection `{ items, nextToken }` → rendered as C-style cards + source chips + "Load more".

A timeline load error must **never** take down the header/aggregate cards (independent load + independent error surface).

---

## Section 1 — `timelineByOrg` read API

### 1.1 Query contract

```
timelineByOrg(
  orgId: String!,
  limit: Int,                 # server-clamped: default 50, max 100
  nextToken: String,          # opaque
  includeInternalOnly: Boolean # default false; admin-only visibility toggle
): OrganizationTimelineConnection!

OrganizationTimelineConnection {
  items: [OrganizationTimelineItem!]!
  nextToken: String
}
```

- Auth: `allow.authenticated()` (admin app), matching the order-api/logistics-api resolver pattern.
- Handler: crm-api `resolvers.timelineByOrg`. This is crm-api's **first** AppSync resolver — the handler already branches on `info?.fieldName`; the direct-invoke `action` path is unchanged. The resolver reads `event.arguments`.

### 1.2 DynamoDB access — **critical: GSI2 org partition is shared**

`GSI2PK = ORG#<orgId>` is **not** exclusive to timeline events. Per `keys.ts`, the same org partition also holds:
- Contacts: `GSI2SK = CONTACT#<email>`
- Audit log: `GSI2SK = AUDIT#<timestamp>#<id>`
- Timeline events: `GSI2SK = TLEVENT#<occurredAt>#<id>`

Therefore the query **must scope to timeline events**, or the mapper receives CONTACT/AUDIT items (blank rows at best, type errors at worst).

**Mechanism (efficient, pre-Limit):** use a **KeyConditionExpression**, not a post-Limit FilterExpression, to exclude non-timeline items:

```
KeyConditionExpression:  GSI2PK = :pk AND begins_with(GSI2SK, 'TLEVENT#')
ScanIndexForward:        false            # newest-first
Limit:                   <clamped limit>
ExclusiveStartKey:       <decoded nextToken>
FilterExpression:        voided = :false [AND isInternalOnly = :false]   # see 1.3
```

The `begins_with(GSI2SK, 'TLEVENT#')` key condition means CONTACT/AUDIT items are never read and never consume the Limit budget. (An optional defensive `entityType = 'TIMELINE_EVENT'` FilterExpression may be layered on, but the SK-prefix key condition is authoritative — every timeline event sets `GSI2SK = TLEVENT#…` in `keys.ts`.)

### 1.3 Server-side visibility filters (not client-side)

These are visibility/compliance filters and are enforced server-side — internal/voided rows are never shipped to the client:
- `voided = false` — always (no UI to show voided events in 3A).
- `isInternalOnly = false` — default; dropped only when `includeInternalOnly = true`.

Both are `FilterExpression` (they cannot be key conditions). **Consequence:** a page may return fewer than `limit` visible items; the client uses `nextToken` to "Load more". No server-side over-fetch/backfill in 3A.

### 1.4 Pagination token

`nextToken` is an **opaque** base64(JSON(`LastEvaluatedKey`)). The frontend never parses it. The resolver encodes `LastEvaluatedKey` → `nextToken` and decodes `nextToken` → `ExclusiveStartKey`. `nextToken` absent ⇒ end of history.

### 1.5 Limit clamp

Server clamps `limit` to `[1, 100]`, default `50`, to guard against an admin page passing a huge value.

---

## Section 1b — Catch-up backfill (one-time, pre-launch)

Because switching the default view from source-table tabs to the materialized read model could otherwise make a historical customer look **emptier** than before, 3A includes a one-time catch-up so historical structured events are materialized before launch. We do **not** rely on the cold sweep's current shard progress.

### 1b.1 Reuse the existing cold sweep — no new backend action

`reconcileSweep({ mode: 'cold' })` already does everything catch-up needs:
- Cold mode has **no cutoff** → scans the **full history** (not just recent).
- Covers all structured channels in order: rfq → lead → order → logistics.
- Paginates via `ChannelCursor`; `hasMore` is false only after the last channel is exhausted; resumes from persisted cursor across invocations.
- Idempotent: for each expected event, emits only if `getTimelineEvent(id)` misses (deterministic ids).
- **Naturally excludes analytics** — analytics is not a sweep channel (it is materialized by `rollupAnalyticsSessions`). This satisfies the "no analytics backfill" constraint automatically.

**Catch-up = loop `reconcileSweep({ mode: 'cold' })` until `summary.existence.hasMore === false`, then read coverage counters to confirm.** Written as a pre-launch **runbook / admin-debug step**, not a cron; it does not replace 2C-sweep.

### 1b.2 Coverage-counter enhancement (small 2C-sweep observability change)

To make coverage legible before flipping the default view, refine the existence-pass counters from source-record vs event-granularity ambiguity into an explicit set. Current `existencePass` counters are `{ scanned, missingReemitted, errors }`, where `scanned` already increments **per expected event** (inside `for (const ev of expected)`), not per source record. Final counters:

| Counter | Meaning |
|---|---|
| `sourceScanned` | **new** — per source META record processed (one record expands to N expected events) |
| `expected` | **renamed from `scanned`** — per expected timeline event examined |
| `existing` | **new** — expected events where `getTimelineEvent(id)` already hit |
| `missingReemitted` | (kept) — expected events that were missing and re-emitted |
| `errors` | (kept) — per-**event** isolated errors (get/emit failure inside reconcileExpectedEvents) |
| `sourceErrors` | **new** — a source META record whose expansion (`channel.expand`) threw; NOT counted in `expected` (that record produced zero expected events) |
| `hasMore` | (kept) — pass completion signal |

**Invariant (documented + tested):** `expected = existing + missingReemitted + errors` (event granularity). Expansion failures are tracked separately in `sourceErrors` so they do not break this equality. `sourceScanned` explains "one source record → many events."

Ripple: `ExistenceCounters` interface + the increment sites + existing tests; the memory-planned CloudWatch metric filter targets `missingReemitted`, which is unchanged.

### 1b.3 Optional driver script

`scripts/catch-up-timeline.ts` (loop + summary print) is **optional** — decided at plan time only if trivially cheap. Default deliverable is the documented runbook (the loop is a handful of `aws lambda invoke` calls, mirroring the `backfillVisitorBridge` catch-up already run for 2C-analytics).

---

## Section 2 — `OrganizationTimelineItem` + rendering

### 2.1 Contract boundary

The crm-api resolver maps raw `TimelineEventItem` → a stable, display-friendly `OrganizationTimelineItem`. **React never parses raw `payload`**; it consumes typed fields. Final UI copy (title/snippet templates) lives in the **frontend**, so re-wording / i18n needs no Lambda redeploy.

### 2.2 `OrganizationTimelineItem` fields (backend returns)

- **identity/time:** `id`, `occurredAt`
- **grouping:** `source`, `kind`, `sourceFilterGroup` (chip bucket: `RFQ | Lead | Order | Quote | Logistics | Site visits`, computed from kind/source)
- **display primitives:** `icon` (semantic key), `tone`, `primaryLabel`, `secondaryLabel?`
- **structured details (all optional, populated per kind):** `amountUSD?`, `productModel?`, `stageFrom?`, `stageTo?`, `fileName?`, `pageCount?`, `activeSeconds?`, `topPaths?`
- **link primitives:** `sourceEntityType`, `sourceEntityId`, `link?`
- **resolution:** `resolutionStatus`, `resolutionReason`, `confidence`
- **flags:** `isInternalOnly`, `voided` (always false in the default feed; present for completeness)
- **escape hatch:** `payload?` (AWSJSON) — debug/future only; normal rendering never depends on it.

**Graceful degradation:** structured fields are the normal contract, but `primaryLabel`/`secondaryLabel` are always populated (from the stored `summary`) so an **unknown future kind** renders a sensible row instead of a blank one.

### 2.3 Frontend owns

Per-`kind` final title/snippet templates; source chip labels; icon rendering from `icon`; amount/date/relative-time formatting; filter-chip state and the "Show internal" toggle state.

### 2.4 Filtering — two layers

- **Server-side (visibility/compliance):** `voided`, `isInternalOnly` (Section 1.3). The **"Show internal" toggle is not a client filter** — flipping it sets `includeInternalOnly=true` and **refetches**. Its React state lives in the frontend; its action is "change param + refetch".
- **Client-side (UI convenience):** source chips `All / RFQ / Lead / Order / Quote / Logistics / Site visits`, filtering only the **currently-loaded** canonical feed. `timelineByOrg` always paginates the full canonical stream.
  - Default `limit = 50`.
  - Documented limitation: a chip filters only loaded pages; when sparse, "Load more" pulls more of the canonical feed. Server-side kind filtering / a kind GSI is **out of 3A scope**.

---

## Section 3 — Resolution badge, empty/loading/error states

### 3.1 Resolution badge = link provenance (not resolved-vs-unresolved)

In the byOrg view, every event is already linked to this org (unresolved events carry a synthetic `ORG#unresolved-<type>-<id>` partition and never appear under a real org). So the badge conveys **how the link was made / how trustworthy it is**, tiered from `resolutionReason` (+ `confidence`):

| Tier | `resolutionReason` (and status) | Visual |
|---|---|---|
| **Confirmed** | `manual`, `existing_matchedOrgId`, `contact_email_exact`, status `manually_linked` | low-chrome / small ✓, neutral tone |
| **Domain match** | `email_domain_exact` (forward-safe: `email_domain_new`) | subtle "domain match" — same company, possibly different person |
| **Inferred** | `visitor_prior_event` (forward-safe: `organization_name_match`) | amber "inferred · NN%"; admin may want to double-check (feeds 3B) |
| **Unknown link** | any unrecognized reason | low-key but visible `Unknown link` — never silently mislead |

- `manually_linked` (status) additionally shows a manual/lock marker (admin-set, auditable).
- `confidence` (0–1) is shown only for the **Inferred** and **Unknown** tiers; Confirmed/Domain are effectively 1.0 and show no number.

### 3.2 Empty states

- Org with zero timeline events (after catch-up): friendly empty state ("No recorded interactions yet") — **not** an error, and distinct from "loading". New/prospect orgs are legitimately empty; catch-up ensures real customers are not.
- Chip empty within the loaded range: "No results in the loaded range — Load more" (ties to §2.4's client-filter limitation).

### 3.3 Loading / error / pagination

- Initial load: **skeleton cards** (C-style), matching the existing admin loading pattern (not a large spinner).
- Error: **inline retry** ("Couldn't load timeline — Retry") that does not clear the header or already-rendered cards.
- Pagination: explicit **"Load more"** button (predictable; fits opaque `nextToken`, client chips, and the "filter empty but more loadable" hint). No infinite scroll. When `nextToken` is null, show "end of history".
- Header/aggregate cards load independently; a timeline error is isolated from the header.

---

## Section 4 — Change surface & testing

### 4.1 Backend (crm-api)

1. `lib/read/timelineByOrg.ts` — GSI2 query (`begins_with(GSI2SK,'TLEVENT#')` key condition, `ScanIndexForward=false`, clamped Limit, `ExclusiveStartKey` from decoded token, `voided`/`isInternalOnly` FilterExpression), opaque nextToken encode/decode. Returns `{ items: TimelineEventItem[], nextToken }`.
2. `lib/read/toOrganizationTimelineItem.ts` — **pure mapper** (highest-logic unit): `sourceFilterGroup`, `icon`+`tone`, resolution tier, `primaryLabel` fallback from `summary`, per-kind structured fields, link primitives, `confidence` gating.
3. `handler.ts` — add `resolvers.timelineByOrg` (parse `event.arguments`, call query, map items). Direct-action path unchanged.
4. `lib/sweep/existencePass.ts` — coverage-counter enhancement (§1b.2): add `sourceScanned` + `existing`, rename `scanned`→`expected`; update `ExistenceCounters` + increment sites + tests.

### 4.2 Schema (`amplify/data/resource.ts`)

5. Import `crmApi`; define `OrganizationTimelineItem` customType + `OrganizationTimelineConnection` + the `timelineByOrg` query with `.handler(a.handler.function(crmApi))` and `.authorization(allow.authenticated())`. First AppSync resolver on crm-api — **no new stack cycle** (crm-api is already `resourceGroupName: 'data'`).

### 4.3 Frontend

6. `src/hooks/useOrganizationTimeline.ts` — mirrors `useOrganization`; state: `items`, `nextToken`, `loading`, `error`, `includeInternal`; actions: `loadMore` (append), `setIncludeInternal` (refetch from scratch).
7. `src/components/admin/OrganizationTimeline.tsx` — **replace** the tabs component with the unified C-cards view + source chips (client filter over loaded items) + "Load more" + skeleton/inline-error/empty states.
8. `src/components/admin/timelineItemTemplates.ts` — frontend thin templates: per-kind title/snippet from structured fields; icon key → component; tone → badge classes; kind → chip group labels; unknown kind → `primaryLabel` fallback.
9. `src/pages/admin/OrganizationDetailPage.tsx` — wire the new hook alongside `useOrganization`; keep header + aggregate cards; swap the timeline section; isolate timeline error from the header.

### 4.4 Catch-up

10. Runbook doc (§1b): loop `reconcileSweep({ mode:'cold' })` to `hasMore=false`; confirm coverage via the new counters (`expected = existing + missingReemitted + errors` at event granularity); operators verify both `errors == 0` AND `sourceErrors == 0`. Optional `scripts/catch-up-timeline.ts`.

### 4.5 Testing surface (vitest, existing patterns)

- **Backend:**
  - `toOrganizationTimelineItem`: each kind → correct `sourceFilterGroup`/icon/tone/structured fields/resolution tier; unknown reason → `Unknown link`; `manually_linked` marker; `confidence` shown only for Inferred/Unknown.
  - `timelineByOrg`: KeyCondition uses `begins_with(GSI2SK,'TLEVENT#')`; **CONTACT/AUDIT items in the same `ORG#<orgId>` partition are never returned**; `ScanIndexForward=false`; `voided`/`isInternalOnly` filter expressions; `includeInternalOnly` path drops the internal filter; nextToken encode/decode round-trip; empty result.
  - `existencePass` counters: on a source record expanding to N expected events, at event granularity `expected = existing + missingReemitted + errors`; source-level expansion failures increment `sourceErrors` separately (not part of `expected` count).
- **Frontend:**
  - `OrganizationTimeline`: mixed kinds render; chips filter the loaded set; "Load more" appends; "Show internal" triggers a refetch with the param (not a client filter); skeleton/empty/error states; unknown-kind fallback to `primaryLabel`.

## Open items for the plan

- Exact `sourceFilterGroup` mapping table (which `kind`s → which chip), pinned in the plan alongside the mapper.
- The precise per-kind structured-field population (order/quote → amount/model/stage/fileName; analytics → pageCount/activeSeconds/topPaths; status changes → stageFrom/stageTo).
- Whether to ship the optional `scripts/catch-up-timeline.ts` (decide by cost at plan time).
