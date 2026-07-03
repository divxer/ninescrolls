# Customer 360 Timeline — Plan 2C-analytics: `site_visit_session` Rollup Design

**Status:** Approved for planning 2026-07-01.
**Builds on:** P1 foundation (crm-api data layer, merged `53ecdd59`), P2A channel wiring (merged `efe03b99`), 2C-sweep (merged `f60998ec` + hotfix `ab0db489`).
**Honors:** P1 spec §4.3 (analytics session rollup) and §5.2 (signal threshold) — those decisions are inherited, not re-litigated here.

---

## 1. Goal & Scope

Materialize website analytics sessions as **`site_visit_session`** timeline events with real org resolution, so a customer's anonymous research trail appears on their Organization 360 timeline — including retroactively, the moment they identify themselves via an RFQ or Lead.

**In scope:**
1. **`VISITOR#` identity bridge** — written by `submit-lead` today and by `submit-rfq` after this plan adds RFQ `visitorId` capture/storage, plus a one-time paginated backfill of existing RFQ/Lead rows that already carry one.
2. **`rollupAnalyticsSessions`** — a crm-api action on a 30-min EventBridge cron that closes analytics sessions (30-min inactivity) and materializes qualifying ones as timeline events.
3. **`reResolveVisitorSessions`** — a bounded, async action fired on bridge creation/upgrade that re-resolves that visitor's previously-unresolved session events.

**Out of scope:** admin UI (Plan 3 renders session events via the existing byOrg GSI2 read); historical session backfill (P1: analytics is **forward-only** — the rollup starts from a go-live watermark; pre-existing page views are never sessionized); adding the analytics channel to the reconciliation sweep (the rollup is self-healing via its own durable cursor + deterministic re-emit; sweep-auditing analytics is deferred); org auto-creation (never — P1 invariant).

**Core invariant:** **IP-inferred org names never resolve a session.** Resolution happens only via the bridge (a real submission identity) or P1's `visitor_prior_event` inheritance rung; everything else lands per-event `unresolved-analytics-{sessionId}`. The IP-org name appears in the event payload as display context only.

**Confirmed code facts this design rests on** (verified 2026-07-01):
- Analytics rows live in a **separate table** (`ANALYTICS_EVENT_TABLE`, written by the `server-track` `/d` Lambda) — NOT the intelligence table. GSIs: `eventType+timestamp` and `sessionId+timestamp`.
- `sessionId` (frontend localStorage, 30-min idle timeout) is present on **`page_time_flush` rows only**; `page_view_store` rows (`pv-${pageViewId}`) carry visitorId/path/UTM/IP-org and join to flushes via `pageViewId` (deterministic `GetItem pv-${pageViewId}`).
- `submit-lead` captures an **optional `visitorId`** on stored records. `submit-rfq` does **not** yet capture/store it; this plan includes adding RFQ frontend payload plumbing + Lambda schema/storage before RFQ can write the bridge. There is NO GSI on `visitorId`, so backfill is paginated scan-only.
- P1 already reserved: kind `site_visit_session`; deterministic id `tev-analytics-session-${sessionId}` (`crm-api/lib/timelineId.ts:40`); a later rollup of the same session updates the same row; the `visitor_prior_event` rung (0.5 confidence, analytics-only, never creates orgs).
- Flush rows carry `flushReason ∈ [route_change, pagehide, hidden, heartbeat, recovery]`, `activeSeconds`, `maxScrollDepth`, `isBot`, `isFinal`, `flushSequence`.

---

## 2. Data Model (all new items in INTELLIGENCE_TABLE)

### 2.1 Identity bridge — `PK: VISITOR#<visitorId>`, `SK: 'STATE'`

```
{ matchedOrgId: string|null, orgSource: 'rfq_match'|'lead_match'|null,
  email: string|null, sourceEntityType: 'rfq'|'lead', sourceEntityId: string,
  firstSeenAt: ISO, updatedAt: ISO }
```

**Provenance rule (structural, not advisory):** `matchedOrgId` may ONLY be populated from RFQ/Lead identity matching (`orgSource` records which). No code path may write an IP-derived org here — this is what keeps the core invariant enforceable as the codebase grows.

**Upgrade-only conflict rule:** a real (non-empty) `matchedOrgId` is never downgraded. A later submission updates the bridge only if it carries a real org (latest-real-wins) or fills a previously-null `email`.

### 2.2 Session marker — `PK: VISITOR#<visitorId>`, `SK: SESSION#<sessionId>`

Written by materialization for every processed session **that has a `visitorId`** (including below-threshold ones; see §6 for the visitorId-less carve-out):

```
{ sessionId, timelineEventId,           // = tev-analytics-session-<sessionId>
  occurredAt: ISO,                       // session start
  resolutionStatus: 'resolved'|'unresolved'|'below_threshold',
  resolvedOrgId: string|null,
  lastFlushTs: ISO, flushCount: number, inputHash: string,   // selected flush/page-view content digest
  emittedAt: ISO }
```

Purpose: (a) **bounded retro-resolve** — one `Query PK=VISITOR#<id> AND begins_with(SK,'SESSION#')`, no GSI, no scan; (b) **idempotency** — normal rollup re-runs skip a session iff the materialization input is unchanged (`inputHash` over sorted flush ids/pageView ids plus the selected flush/page-view fields used for threshold + payload, with `lastFlushTs`/`flushCount` stored separately for debug) **and** no resolution upgrade is now available; retro calls use an explicit `forceReemit` mode, so unchanged input still re-emits when identity changed; (c) replay/debug metadata (`timelineEventId`, `resolvedOrgId`).

### 2.3 The session event

Kind `site_visit_session`, id `tev-analytics-session-${sessionId}` (P1-reserved). `occurredAt` = the session's **earliest flush timestamp** (flushes are the session's authoritative rows; deterministic from session content). `isInternalOnly: false`.

**Payload:** `{ visitorId, pageCount, topPaths (≤5), productPagesViewed, downloads, returnVisit, activeSeconds, maxScrollDepth, orgNameDisplay (IP-org, display-only), utmSource, utmMedium, utmCampaign, trafficChannel, country, region }`.

**Signal sources:** the authoritative session envelope is the `page_time_flush` set for `sessionId`. Parent `pv-${pageViewId}` rows supply paths, product identifiers, UTM/traffic, geo/IP-org display, and behavior counters (`productPagesViewed`, `pdfDownloads`, `returnVisits`) that the frontend had accumulated by that page view. The P1 threshold is computed from those joined parent rows: product path/product id, RFQ page path (route visit, not RFQ form submission), max `pdfDownloads`, max `returnVisits`, or `pageCount >= 3`. Standalone `page_view_store` rows such as `pdf_download` / `rfq_submit` do not carry `sessionId`; they are not required for 2C rollup correctness. If implementation later adds bounded same-visitor time-window enrichment for named event types, it must be tested separately and must not introduce table scans.

**resolveInput:** channel `analytics`, sourceEntityType `analytics`, sourceEntityId = sessionId. Three tiers:
1. **Bridge exists at emit time** → pass its `{ matchedOrgId, email }` — a bridged session resolves exactly like a structured channel (the email came from a real submission, not IP inference; P1 resolves to *existing* orgs only, so still no auto-create).
2. **No bridge, but the visitor has a prior `resolved` marker** → pass `priorVisitorOrgId` = the latest resolved marker's `resolvedOrgId` (this is how the caller supplies P1's `visitor_prior_event` rung — the markers ARE the prior-event lookup; one Query, already fetched for idempotency).
3. **Neither** → pass nothing → per-event `unresolved-analytics-{sessionId}` (matches current `resolveLinks` sentinel construction).

---

## 3. Rollup Job — `rollupAnalyticsSessions`

**Trigger & durable state:** EventBridge cron every 30 min → `{action:'rollupAnalyticsSessions'}`. The Rule lives in **`Stack.of(backend.crmApi.resources.lambda)`** with `!isSandbox` (the PR #229 nested-stack-cycle lesson). Lease + watermark cursor reuse the shipped `sweepState` helpers (state key `CRM_SWEEP#analytics#sessions`; the module's mode/pass unions widen to accept it): token-conditioned persists, per-page heartbeat, lease = max(2×timeout, 5min).

**State shape:** `{ watermark, activeRunCutoff|null, pageCursor|null, pendingSessionIds:string[] }`. `activeRunCutoff` freezes the time window for an incomplete run. `pageCursor` is the analytics GSI `LastEvaluatedKey` for the current run. `pendingSessionIds` stores candidate session ids already discovered but not yet processed when the invocation hits `MAX_SESSIONS_PER_INVOCATION` or time budget.

**Windowing — discover → close-check → materialize:**
1. **Discover.** If no run is active, set `activeRunCutoff = now − 30min`. Query the analytics table's `eventType+timestamp` GSI for `page_time_flush` rows with `ts ∈ (watermark − overlap, activeRunCutoff]`, where overlap = 10 min (clock skew / late beacons), resuming from `pageCursor` if present. Collect distinct `sessionId`s; skip `isBot` rows and rows without a sessionId. Drain `pendingSessionIds` before reading the next GSI page. If the session cap/time budget is hit after a page is read, persist the unprocessed session ids into `pendingSessionIds` plus the page's `LastEvaluatedKey`.
2. **Close-check.** Per candidate, query the `sessionId+timestamp` GSI for ALL of that session's flushes — full session content never depends on the discovery window. If `lastFlush > now − 30min` the session is still open: leave it for a later run (its newer flushes guarantee rediscovery).
3. **Materialize** (the ONE path, shared with retro-resolve):
   - Fast-skip only in normal rollup mode when an existing marker's `{inputHash}` matches the freshly computed one **and** the current bridge/prior resolution would not upgrade the marker. Retro passes `forceReemit:true`, so an unresolved session with unchanged input still re-emits once a bridge exists.
   - Join page context per distinct `pageViewId` via `GetItem pv-${pageViewId}` (paths, product pages, visitorId, UTM, IP-org display).
   - Apply the **P1 §5.2 signal threshold**: product page ∨ RFQ page ∨ download ∨ return visit ∨ ≥3 pages. Below threshold → write/refresh the marker with `resolutionStatus:'below_threshold'` and **NO event** (homepage bounces never enter a customer timeline). If a below-threshold marker's `inputHash` later changes (e.g. recovery flushes), the session is **re-evaluated** and emits if it now passes — first emit, same deterministic id.
   - If the joined session has a `visitorId`, read `VISITOR#<visitorId>/STATE`; emit via `emitTimelineEvent` with bridge `{matchedOrgId, email}` or with neither.
   - Write/refresh the marker.
4. **Complete.** Only when `pendingSessionIds` is empty and the GSI query reaches the end (`LastEvaluatedKey` absent), advance `watermark := activeRunCutoff`, then clear `activeRunCutoff`, `pageCursor`, and `pendingSessionIds`. Incomplete runs never advance the watermark.

**Conventions (inherited from the sweep):** per-session error isolation (structured log + counter, batch continues); `MAX_SESSIONS_PER_INVOCATION` safety cap with cursor/backlog persist (incomplete run returns `hasMore:true` and resumes next fire against the same `activeRunCutoff`); info-level summary log **`crm.analytics.rollup.summary`** `{discovered, closed, emitted, belowThreshold, skippedBots, bridgeResolved, priorResolved, unresolved, errors, hasMore}`.

**Accepted limitation (documented):** `recovery`-reason flushes arrive on a visitor's *next* visit carrying old timestamps; they will not re-open an already-finalized discovery window on their own. Durations are best-effort; the deterministic id + inputHash re-materialization mean any rediscovery updates the same row (P1 §4.3) — degradation, not corruption.

---

## 4. Retro-Resolve — `reResolveVisitorSessions`

**Trigger:** in `submit-rfq`/`submit-lead`, after a bridge write that **upgrades identity** (new `VISITOR#` item, or null→real `matchedOrgId`), fire the same async Event-invoke pattern those Lambdas already use for 2A emits: `{action:'reResolveVisitorSessions', visitorId}` — fire-and-forget, failure non-fatal to the submission.

**Action:** check `VISITOR#<id>/RETRO#STATE` for a resume cursor, else start from `startSessionSk` (optional param) or the beginning. `Query PK=VISITOR#<visitorId>, begins_with(SK,'SESSION#')`; for each marker still `unresolved` (skip `below_threshold` and `resolved`), **re-run the §3 materialize routine with `forceReemit:true`** — payload rebuilt fresh (picks up any late data), re-emitted under the same deterministic id with the bridge now present even when `inputHash` is unchanged. P1's link-move machinery (`rollupPendingOrgId` → recompute → `LinkAuditLog`) moves the event between org rollups; marker updated with `resolvedOrgId`/`resolutionStatus`.

**Bounds & resume:** loops in-invocation under a generous cap (a session ≈ one query + a few GetItems + emit; hundreds fit in 120 s). If `LastEvaluatedKey` remains, persist `VISITOR#<id>/RETRO#STATE {cursor}` + a warning log; any later fire (next submission by the same visitor, or a manual invoke) resumes from it. Idempotent throughout: already-resolved markers are skipped; emits are deterministic.

**Race safety:** the rollup reads the bridge at emit time and retro fires after the bridge write — whichever runs second converges on the same deterministic row; no lost updates. **Failure mode:** a dropped async invoke leaves sessions unresolved until the visitor's next submission re-fires it (documented; Plan 3 health can count unresolved-markers-with-bridge as an alarm signal).

---

## 5. Change Surface + Backfill

- **`submit-rfq` / `submit-lead`:** after store + org match, write the `VISITOR#/STATE` bridge via a shared helper in `amplify/lib/crm/` (2A pattern — both Lambdas already write INTELLIGENCE_TABLE and already Event-invoke crm-api); on an identity upgrade, fire `reResolveVisitorSessions`. RFQ must first add `visitorId` to the frontend request payload, `rfqSchema`, stored `RFQ#.../META`, and tests; Lead already has this field.
- **New `crm-api/lib/analytics/`:** `visitorBridge.ts` (read + upgrade-only write rules + provenance), `sessionWindow.ts` (discover/close), `materializeSession.ts` (join → threshold → payload → emit → marker; the one shared path), `rollupAnalyticsSessions.ts` (lease/cursor driver), `reResolveVisitorSessions.ts`.
- **`crm-api/handler.ts`:** three new actions — `rollupAnalyticsSessions`, `reResolveVisitorSessions`, `backfillVisitorBridge`. (Timeout already 120 s from 2C-sweep.)
- **`amplify/backend.ts`:** grant crm-api **read** on the AnalyticsEvent table + `ANALYTICS_EVENT_TABLE` env (mirror server-track's wiring); one cron Rule (`*/30`) in `Stack.of(backend.crmApi.resources.lambda)`, `!isSandbox`.
- **One-time backfill:** `backfillVisitorBridge {cursor?}` — paginated scan of RFQ/LEAD METAs carrying `visitorId` → upgrade-only bridge writes, returning `{nextCursor, hasMore}` (P1 backfill-driver pattern; invoked manually post-deploy). Existing RFQs will participate only if they already carry `visitorId` after the RFQ capture change deploys; older RFQs without it are naturally skipped. **No retro fire during the initial bridge backfill by default** — markers only exist for post-go-live sessions (forward-only), so there is nothing to re-resolve yet; a manual retro invoke remains valid later if ever needed.

---

## 6. Edge Cases & Invariants

- **Bots:** `isBot` flushes skipped at discovery; the pv-join re-checks (belt-and-suspenders).
- **No sessionId** (noscript pixel, legacy rows): never sessionized.
- **Flush-less pages:** invisible to the rollup (accepted — flushes fire on route change/pagehide/hidden/heartbeat, so coverage is near-universal).
- **Session with no `visitorId` anywhere:** the event **still materializes normally** — the deterministic id needs only the (present, valid) `sessionId`. It cannot use `visitor_prior_event` without a visitor key, so it resolves only through non-visitor inputs if present; otherwise it lands unresolved. It gets **no `VISITOR#` marker**, because there is no visitor key to file it under; the no-marker rule is specifically about lacking a retro-resolve handle, not about event materialization. (Guard against literal `VISITOR#undefined` keys.)
- **Multi-tab:** safe — sessionId is per-browser localStorage; `tabId` is ignored for grouping.
- **Clock skew / late beacons:** absorbed by the 10-min discovery overlap.
- **Bridge conflicts:** §2.1 upgrade-only + provenance rules.
- **Plan-level verification tasks:** (a) `emitTimelineEvent`'s existing same-id re-emit path must update payload/org on re-emit (P1 fifth-round recompute rules cover org/kind/occurredAt/voided/isInternalOnly changes — confirm payload refresh, extend if needed); both the inputHash re-materialization and retro-resolve depend on this. (b) `resolveLinks` must accept the `analytics` channel + `priorVisitorOrgId` input and apply the `visitor_prior_event` rung as P1 reserved it (confirm the actual `ResolveInput` shape at `crm-api/lib/resolveLinks.ts` before building). The plan must verify both against the code before building on them.

---

## 7. Testing

| Layer | Coverage |
|---|---|
| `visitorBridge` (unit) | upgrade matrix: new / null→real / real→latest-real / **never downgrade** / provenance enforced (IP-org write structurally impossible); email fill |
| `sessionWindow` (unit) | cutoff math (`(watermark−overlap, runCutoff]`), fixed active run cutoff, open-session skip via close-check, bot + no-sessionId filters |
| `materializeSession` (unit) | threshold matrix incl. **below→above on inputHash change**; marker contents (timelineEventId, resolvedOrgId, inputHash); bridge/prior/bare `resolveInput`; pv-join; unchanged-input unresolved marker + new bridge re-emits in `forceReemit` mode |
| rollup driver (unit/high-fidelity command sequence) | lease-held skip, fixed `activeRunCutoff`, analytics GSI `LastEvaluatedKey` persist, pending-session backlog, `MAX_SESSIONS` cap → `hasMore`, summary counters, watermark advances only on complete run |
| retro (unit/high-fidelity command sequence) | bounded to one visitor; skips `below_threshold`/`resolved`; `RETRO#STATE` persist + resume; shared materialize path with `forceReemit:true`; unchanged-hash retro updates marker/org |
| handler + submit-* (unit) | three-action dispatch; Lead bridge-write + upgrade-fire; RFQ visitorId schema/storage/frontend payload + bridge-write + upgrade-fire (existing suites stay green) |
| backend (typecheck/command sequence) | analytics-table grant + env + cron Rule in `Stack.of(crmApi)`; analytics GSI query shape |

Green-bar: full crm-api + submit-rfq/submit-lead suites, `tsc --noEmit -p amplify/tsconfig.json`, eslint.

---

## 8. Deferred (not in this plan)

Admin UI for sessions (Plan 3); sweep-auditing the analytics channel; historical (pre-go-live) session backfill; visitor-level dedup/merge across devices (P2 identity work); alarms/metric filters on `crm.analytics.rollup.summary` (Plan 3 CRM Health, alongside the sweep's `missingReemitted`/`hasMore` signals); TTL/retention policy for analytics rows.
