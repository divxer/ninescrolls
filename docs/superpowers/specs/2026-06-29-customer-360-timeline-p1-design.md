# Customer 360 Timeline — Phase 1 Design Spec

**Date:** 2026-06-29
**Status:** Implemented (PR #223) — see reconciliation note below
**Scope:** Phase 1 of a multi-phase Customer Intelligence Platform for NineScrolls

---

## ⚠️ Implementation reconciliation (PR #223) — READ FIRST

During implementation review it was confirmed that **organization-api already owns org identity**:
the canonical `orgId` is the **eTLD+1 domain** (`ORG#diamondfoundry.com / META`), resolved via
`GSI2 ORG_DOMAIN#<domain>` + `ORG_DOMAIN_LOOKUP` aliases (shared `amplify/lib/organization/etld.ts`).
To avoid CRM minting duplicate orgs, P1's scope was narrowed. **What actually shipped in P1 differs
from the rung-by-rung text below — this banner is authoritative where they conflict:**

- **P1 `resolveLinks` resolves EXISTING orgs only and creates NO orgs.** Ladder as built:
  `manual → existing_matchedOrgId → contact_email_exact → email_domain_exact (canonical eTLD+1 via
  ORG_DOMAIN# lookup) → visitor_prior_event (analytics only) → unresolved`.
- **DEFERRED TO P2:** rung **`email_domain_new`** (auto-create review org) and rung
  **`organization_name_match`**. A corporate domain with no existing org → **`unresolved`** (→ Needs-Linking).
- **Not built in P1 (moved to P2):** `createReviewOrgFromDomain`, `generateOrgId`, the bespoke
  `ORGDOMAIN#`/`ORGNAME#` indexes, `ORG_STATUS#review` writes, the "Review New Orgs" queue. P2 must
  build auto-create on the **shared/canonical organization-api upsert**, not a CRM re-implementation.
- **Still valid as written:** TimelineEvent/Contact/LinkAuditLog storage, deterministic ids,
  idempotent + durable rollups (incl. `rollupPendingOrgId` repair evidence), Needs-Linking,
  server-side `internalOnly` (Plan 3), the §10 clarifications. CRM rollups write `ORG#<eTLD+1>/META`.

Sections §3.3, §3.5(¶ note), §4.1 (rungs 5–6), §4.3 guard, §6.3, §7.3 (Review New Orgs), and the
§8.3/§10 auto-create items are superseded for P1 per the above; they describe the eventual P2 behavior.

---

## 1. Context & Motivation

NineScrolls already has ~80% of a CRM, but it is not organized or trusted as one. Customer
data exists across siloed systems — `AnalyticsEvent`, `LeadSubmission`, `RfqSubmission`,
`Order`, `LogisticsCase` — and the unified "Customer 360" view is **computed at query time,
client-side, via heuristic matching**, and is **not persisted**. Cross-channel links are
manual or heuristic (`Order.matchedOrgId` set by hand; behavior scores never written back;
RFQ matched by institution-name text + timestamp proximity).

The user's framing: this is **not** "we need a CRM like HubSpot." It is:

> Build a Customer 360 platform for high-value B2B equipment sales, where every customer
> interaction — website visits, leads, RFQs, quotes, orders, logistics — is **automatically
> linked into a trusted, persisted timeline**. Sales workflow is built on top of this
> foundation, not the other way around.

The two stated pain points — *"can't see a customer's full interaction history"* and
*"links are untrustworthy / manually maintained"* — are **two layers of one problem**: there
is no reliable entity-resolution layer beneath the timeline, so the timeline is unreliable.

### Existing architecture (confirmed)

- Business entities (`Order`, `RfqSubmission`, `LeadSubmission`, `LogisticsCase`,
  `Organization`) are **`a.customType` served by dedicated Lambdas** (`orderApi`,
  `logisticsApi`, `organizationApi`) over their own DynamoDB tables, with deterministic IDs +
  GSIs. Only high-volume public-write data (`AnalyticsEvent`, `ArticleQuestion`) uses
  `a.model`.
- A `getCustomerTimeline` query (email-based, query-time union, via `orderApi`) and an
  `organizationApi` serving `OrganizationDetailBundle` **already exist** — Phase 1 *upgrades*
  these, it is not greenfield.
- `organizationApi` already has an `upsertFromSubmission` org-matching path; Phase 1
  **centralizes** that into a shared resolver so all channels match identically.

---

## 2. Phasing (decomposition)

This is too large for one spec. It is decomposed into independent spec → plan → build cycles.
**This spec covers Phase 1 only.**

| Phase | Deliverable | One-liner |
|---|---|---|
| **P1 (this spec)** | Materialized `TimelineEvent` + lightweight `Contact` + write-time org/contact resolution + backfill of structured data + upgraded Organization 360 UI + manual note/email/call entry | Make existing data **trustworthy, persisted, visible** |
| P2 | Gmail OAuth / Twilio / automated comms sync; deeper entity resolution (auto org/contact matching, fuzzy match, **`personId` / Contact merge & multi-identity**, behavior-score write-back) | Upgrade "good-enough heuristics" into "reliable automation" |
| P3 | Sales workflow (follow-up reminders, Next Action, Deal Stage / board, quote-expiry tracking) | Grow proactive actions on top of the Timeline |

### Chosen architecture: Scheme A — Materialized Timeline

Source tables remain the source of truth. Every **meaningful** interaction is materialized
into a persisted `TimelineEvent` carrying a **resolved `orgId` / `contactId`**. The Customer
360 view reads `TimelineEvent` by `orgId` (one indexed query). Rejected alternatives: Scheme B
(reliable FKs + query-time union — pushes complexity to every read, degrades as Gmail/Twilio/
support channels are added) and Scheme C (persist existing client-side aggregation — ossifies
the untrustworthy heuristics, does not solve the core problem).

### P1 boundaries

```
P1 = Materialized TimelineEvent
   + Lightweight Contact (email-exact matching + manual correction only)
   + Write-time org/contact resolution (one shared resolver)
   + Backfill of existing structured data
   + Organization 360 UI (upgrade existing)
   + Manual note/email/call entry
```

Gmail / Twilio / support are **schema-reserved only** — enum values and fields exist, **no
integration, no OAuth, no webhooks** in P1. Contact is **lightweight**: email-exact match +
manual correction; **no fuzzy/name matching, no merge automation** (P2).

---

## 3. Data Model

New persisted entities follow the **`a.customType` + Lambda + DynamoDB + GSI** pattern
(matching Order/Logistics), owned by a new `crm-api` Lambda. Not `a.model`.

### 3.1 `TimelineEvent`

```
id                deterministic, built from a STABLE source key (never a mutable seq) — see §3.5
orgId             resolved at write; if unresolvable → unresolved-{sourceEntityType}-{sourceEntityId}
                  (per-event id — NO global UNRESOLVED partition / hot-key)
resolutionStatus  resolved | unresolved | manually_linked
resolutionReason  manual | existing_matchedOrgId | contact_email_exact | email_domain_exact
                  | email_domain_new | organization_name_match | visitor_prior_event | unresolved
confidence        0.0 – 1.0 (see resolution ladder)
contactId?        resolved at write (email exact-match); null when no email present
occurredAt        business time of the interaction (datetime)
source            analytics | lead | rfq | quote | order | logistics | manual
                  | gmail | twilio | support     ← reserved values, NOT integrated in P1
kind              site_visit_session | rfq_submitted | rfq_status_changed | quote_sent |
                  order_created | order_stage_changed | logistics_milestone | lead_captured |
                  note | call | email_manual | ...
summary           one-line, render-ready ("Submitted RFQ for ICP-1000W")
sourceEntityType / sourceEntityId   pointer back to the authoritative record
isInternalOnly    bool  (reuse Logistics internal/visible concept; hidden by default AND
                         enforced server-side — see §8.1)
voided            bool  (source cancelled/deleted → greyed, not removed)
createdBy         operator (manual entries)
payload           json  (channel-specific extras)
# ── reserved for P2 comms, written null in P1 ──
direction         inbound | outbound
externalId        gmailMessageId / twilioSid
threadId / from / to / subject / bodySnippet
createdAt / updatedAt
```

**GSIs**
- `byOrg`: `orgId` (PK) + `occurredAt` (SK) — the Customer 360 read.
- `byContact`: `contactId` (PK) + `occurredAt` (SK).
- `bySourceEntity`: `sourceEntityType#sourceEntityId` — idempotency + "this record's events".
- `byExternalId`: reserved for P2 Gmail/Twilio dedup.

### 3.2 `Contact` (lightweight, P1)

```
contactId       deterministic from normalized email (P1 trade-off — see note)
email           required, lowercased/trimmed   ← the ONLY match key in P1
name / title / role
phone?          reserved for P2 Twilio matching; nullable
orgId           resolved
source          where first seen (rfq | lead | order | manual)
firstSeenAt / lastSeenAt
linkLocked      bool  ← if admin manually fixed orgId, auto-resolution never overwrites
createdAt / updatedAt
```

**GSIs:** `byEmail` (email), `byOrg` (orgId). No fuzzy/name matching, no merge automation (P2).

> **P1 trade-off — email-derived `contactId`:** in P1 `contactId` is derived from the normalized
> email and is **intentionally non-mergeable automatically** — if a person changes email they
> appear as two contacts. This is accepted for P1. **P2** introduces a generated `personId` plus
> a multi-identity model (sketch below) so a person can hold several emails/phones and contacts
> can be merged. P1 code should not assume `contactId == hash(email)` is permanent.
>
> ```
> # P2 direction (NOT built in P1):
> Contact         { contactId(generated), primaryEmail, emails[], ... }
> ContactIdentity { type = email|phone|gmail|twilio, value, contactId }
> ```

### 3.3 `Organization` — minimal additions

Add only:
```
primaryContactId?
linkLocked?            (manual-correction guard)
createdByResolution?   (true when auto-created by resolver step email_domain_new)
```
`status` reuses existing string; auto-created orgs get `status = review`. All other fields
(counts, leadScore, ownerSalesRep, first/last seen, latest*Date) already exist and remain the
rollup target.

### 3.4 `LinkAuditLog` (new)

Every re-link / manual correction writes an immutable audit record:
```
id
timelineEventId? / contactId? / orgId?   (what was corrected)
oldOrgId / newOrgId
oldContactId / newContactId
operator
reason
timestamp
```

### 3.5 Deterministic id rules (REQUIRED — must use stable source keys, never mutable seq)

Ids must key off **stable, immutable source identifiers** (a log-entry id, a version id) — never
a recomputable sequence number, which shifts if history is reordered, deleted, or inserted.

```
order_created          tev-order-{orderId}-created
order_stage_changed    tev-order-{orderId}-stage-{orderLogId}
rfq_submitted          tev-rfq-{rfqId}-submitted
rfq_status_changed     tev-rfq-{rfqId}-status-{statusLogId}        (or {changedAtHash} fallback)
quote_sent             tev-quote-{quoteVersionId}                  (per quote version, not Order)
lead_captured          tev-lead-{leadId}
logistics_milestone    tev-logistics-{caseId}-log-{logEntryId}
site_visit_session     tev-analytics-session-{sessionId}          (one per session — see §4.3)
manual (note/call/...) tev-manual-{generatedId}
```

> **Planning dependency:** if a source table does **not** yet expose a stable per-event id
> (e.g. `OrderLog.id`, a logistics log-entry id, an RFQ status-log id, a quote version id),
> **planning must add it first**. This is a hard prerequisite for idempotency.

### Design invariants
1. **Nothing is ever dropped** — unresolvable events get a per-event `unresolved-…` orgId and
   surface in the Needs-Linking queue; the write never fails.
2. **Idempotent by deterministic id** — backfill / re-processing updates the same row.
3. **`linkLocked` guard** — manual corrections are never auto-overwritten.

---

## 4. Write-time Org / Contact Resolution

One shared library — `resolveLinks(input)` — imported by **every** domain Lambda write path
**and** the backfill path. Returns `{ orgId, contactId, resolutionStatus, resolutionReason,
confidence }`. This centralizes today's divergent `upsertFromSubmission` matching — the root
cause of the "untrustworthy" feeling.

### 4.1 Org resolution ladder (first match wins)

| # | reason | rule | confidence |
|---|---|---|---|
| 1 | `manual` | source record / prior event is `linkLocked` / admin-set | 1.0 |
| 2 | `existing_matchedOrgId` | source carries `matchedOrgId` (e.g. `Order.matchedOrgId`) | 1.0 |
| 3 | `contact_email_exact` | existing `Contact` with that email already has an `orgId` | 0.9 |
| 4 | `email_domain_exact` | email domain = Org `primaryDomain`/`aliasDomains`, **excluding free domains** | 0.95 |
| 5 | `email_domain_new` | **[DEFERRED TO P2 — see top banner]** corporate domain, no Org yet → auto-create. In P1 this case → `unresolved` (no org creation). | 0.8 |
| 6 | `organization_name_match` | **[DEFERRED TO P2 — see top banner]** normalized name == Org `displayName`/alias. Not implemented in P1 (no name index). | 0.7 |
| 7 | `visitor_prior_event` | `visitorId` resolved to an Org on an earlier event — **analytics/session rollups ONLY**, never RFQ/Lead/Order | 0.5 |
| — | `unresolved` | none matched → `unresolved-{type}-{id}`, Needs-Linking queue | 0 |

> **Ordering rationale:** a manually curated `Contact` (step 3) must outrank domain logic
> (steps 4–5). Example: `terry@diamondfoundry.com` already locked to Diamond Foundry while the
> Org's domain aliases are not yet maintained — trust the Contact, do not create a duplicate Org.

**Free-domain handling:** personal-domain emails (gmail/outlook/qq/163/yahoo…) skip steps 4–5
but may still hit 3 or 6; otherwise `unresolved` rather than spawning junk orgs.

**`email_domain_new` auto-create guards (anti-garbage):**
- **Strong-signal channels only** — auto-create is allowed when the source is **RFQ / Lead /
  Order**. An **analytics-only** event (anonymous visit + IP/org inference) **must NOT**
  auto-create an Organization; it resolves against existing orgs or goes `unresolved`.
- **Domain denylist** — never auto-create for: free email providers, generic hosting providers,
  proxy / cloud / CDN domains, and a maintained known-vendor list. Such domains go `unresolved`
  (or name-match) instead, keeping the Review-New-Orgs queue clean.

**`visitor_prior_event` restriction:** allowed only for analytics/session rollups. Never used
for strong-signal records (RFQ/Lead/Order) to avoid shared-PC / proxy contamination.

### 4.2 Contact resolution (lightweight)

- Normalize email → lowercase/trim. **No email → `contactId = null`** (most page views).
- Exact email match → reuse, refresh `lastSeenAt`, backfill missing name/title/phone.
- No match → create `Contact` (deterministic id from email), attach resolved `orgId`.
- `linkLocked` Contact/Org is never auto-overwritten.

### 4.3 Analytics session rollup (definition)

`AnalyticsEvent` (high-volume public `a.model`) is **not** resolved/emitted per page view. A
session is rolled up into a **single** `site_visit_session` event. Session lifecycle:

- **Session close = 30 min inactivity.** A scheduled rollup processes sessions whose
  `lastSeenAt < now − 30min` (there is rarely a real browser "close" event).
- **One event per `sessionId`**, deterministic id `tev-analytics-session-{sessionId}` (a later
  rollup of the same session updates the same row — page count etc. may grow until finalized).
- Enters the Timeline only above the **signal threshold** (§5.2).
- Resolution stays off the hot public write path; `visitor_prior_event` applies here only and
  **never** auto-creates an Org (§4.1 guard).

---

## 5. Channel Emit Catalog + Consistency

### 5.1 Shared emit helper

```
emitTimelineEvent({
  source, kind, sourceEntityType, sourceEntityId, stableKey,
  occurredAt, summary, resolveInput, payload, isInternalOnly?, createdBy?
})
→ resolveLinks() → upsert Contact → UPSERT TimelineEvent (deterministic id, §3.5) → bump Org rollups
```

### 5.2 Catalog (P1)

| Channel (Lambda) | kind(s) | Emitted when | Resolve signal |
|---|---|---|---|
| RFQ (`orderApi`) | `rfq_submitted`, `rfq_status_changed` | new RFQ; converted/declined | email, org-text, visitorId |
| Lead (`orderApi`/submit-lead) | `lead_captured` | contact / download-gate / newsletter | email, org-text, visitorId |
| Order (`orderApi`) | `order_created`, `order_stage_changed` | create; **one row per `OrderLog` transition** | `matchedOrgId` (strong), primary contact email |
| Quote (`orderApi`) | `quote_sent` | **quote document/version creation or explicit "send" action** — NOT a bare `quoteDate` edit | inherits Order resolution |
| Logistics (`logisticsApi`) | `logistics_milestone` | each stage change / log entry; honors `internalOnly` | `relatedOrderId` → its Org |
| Manual (`crm-api`) | `note`, `call`, `email_manual` | admin adds from 360 UI | explicit Org/Contact → `manual`, 1.0 |
| Analytics (scheduled rollup) | `site_visit_session` | session closed (§4.3), **above signal threshold** | visitorId, IP-org |

**Analytics signal threshold** — a session enters the Timeline only if it includes:
`product_page_viewed | rfq_page_viewed | download | return_visit | session_pages ≥ 3`.
Homepage-only single-page visits never enter a customer Timeline.

**Manual `email_manual`** — key-milestone note only ("Customer replied asking for footprint",
"Quote sent by email"). **Not** a daily Gmail-sync surrogate.

### 5.3 Consistency guarantees

1. **Emit only after the source write commits** — same Lambda, after the DDB put succeeds.
   The source record is always authoritative; the Timeline is a projection.
2. **Idempotent deterministic id (§3.5)** — keyed off stable log/version ids. Re-emit / backfill
   updates the same row.
3. **Non-blocking** — emit is wrapped; failure is logged + queued for the sweep; it **never**
   rolls back or blocks the business write.
4. **Rollups increment on first create only** — conditional put keyed on the deterministic id,
   so re-runs do not inflate counts. (Re-link consistency is handled by recompute — §7.3.)
5. **Monotonic rollups** — `lastActivityAt = max(existing, event.occurredAt)` (and same for
   `latestRFQ/Order/LeadDate`). Backfilling old events never drags "recent activity" backwards.

---

## 6. Backfill / Migration

Backfill uses the **exact same** `resolveLinks` + `emitTimelineEvent` code path as live writes
(no parallel migration logic). Idempotent → safely re-runnable.

### 6.1 Mechanism — server-side, paginated job (one mutation = one page)

A `crm-api` admin mutation `runTimelineBackfill({ channel, dryRun, cursor, limit })`:
- Runs **inside the Lambda** (same IAM/SDK/resolver as production — avoids local-script drift).
- **One invocation processes ONE page only** — it does **not** attempt to finish the whole
  channel in a single call (Lambda timeout). Returns `{ nextCursor, processedCount, hasMore }`.
- A small `scripts/backfill-timeline.ts` driver (existing `scripts/` + admin-creds pattern) — or
  an admin button — **loops** the mutation until `hasMore == false`.
- Idempotent (re-run over a page is a no-op update).

### 6.2 Scope

| Channel | Scope | Why |
|---|---|---|
| RFQ / Lead / Order / Quote / Logistics | **Full history** | Low volume, high value, strong resolve signals |
| Analytics `site_visit_session` | **Forward-only** (or short recent window via date bound) | Historical session reconstruction is expensive + noisy; forward rollup is where the value is |

### 6.3 Dry-run report (before any write)

`dryRun: true` writes nothing and returns a reconciliation report:
- per-channel row → event counts; resolved / review / unresolved breakdown;
- resolution-reason distribution;
- **top unresolved domains**, **top auto-created review orgs**, **sample suspicious matches**
  (to spot school/company/gmail mis-merges before committing).

### 6.4 Cutover

1. Backfill (dry-run → real, looped to completion).
2. Parallel-run: old `getCustomerTimeline` and new `byOrg` read; compare on known orgs (HORIBA,
   Diamond Foundry).
3. Switch 360 UI to `TimelineEvent`. Keep old query one release as fallback, then retire.

### 6.5 Ongoing reconciliation

Cheap check: `Organization.orderCount` == count of `order_created` events for that org (same for
rfq/lead). Mismatch flags a resolver/rollup bug early. Wired into §7 observability.

---

## 7. Error Handling, Recovery & Linking Queues

Principle: **source tables authoritative; Timeline is an eventually-consistent projection.** A
failed emit must never lose data and never block business writes.

### 7.1 Layer 1 — inline emit (after commit)
After source DDB put succeeds, single attempt, wrapped. Success → event written + rollups
bumped. Failure → log + set `timelineSynced=false` on the source record (a 1-field hint, no new
infra). Business write already committed.

### 7.2 Layer 2 — reconciliation sweep (hot path + cold audit)
Existence-based: for each source record in scope, **compute the expected deterministic
TimelineEvent id(s) and check existence** → missing → (re-)emit idempotently. `timelineSynced=false`
is only a fast-path index, **never the sole trigger** (a forgotten-emit path may have no flag).

To avoid scanning the entire source set every 15 minutes, the sweep is **two-tier**:

| Tier | Frequency | Scope |
|---|---|---|
| **Hot sweep** | ~every 15 min | only records with `updatedAt > now − 24h` **or** `timelineSynced=false` |
| **Cold audit** | daily / weekly | full set, **sharded or sampled** — catches forgotten emits the hot path missed |

Both also run the §6.5 reconciliation drift check.

> ⚠️ Per the Amplify env constraint, scheduled crons **fire in the live sandbox too** — both
> sweeps must be guarded with `if (!isSandbox)` so a dev sandbox does not double-process
> production-shaped data.

### 7.3 Admin queues + re-link rollup consistency

| Queue | Contains | Action |
|---|---|---|
| **Needs Linking** | events with `resolutionStatus=unresolved` | pick correct Org/Contact → `manually_linked` + `linkLocked` + confidence 1.0, re-point orgId, **recompute rollups (below)**, **write `LinkAuditLog`**. Offer **"apply to all events from same email/domain/visitor"** — **same-domain bulk is corporate-domain only** (disabled for free domains) |
| **Review New Orgs** | auto-created orgs (`status=review`, `createdByResolution=true`) | approve / rename / **merge into existing Org** (re-points child events; recompute rollups; writes `LinkAuditLog`) |

**Re-link rollup consistency (REQUIRED):** a re-link / merge moves events between orgs, so
incremental counting is **not** safe (old org would keep a stale count, new org would miss it,
and `lastActivityAt` cannot simply decrement). Re-link therefore triggers a **full rollup
recompute for both affected orgs**, not an incremental delta:

```
on re-link(event, oldOrgId → newOrgId):
  recomputeRollupsForOrg(oldOrgId)   # counts, latest*Date, lastActivityAt re-derived from its events
  recomputeRollupsForOrg(newOrgId)
```

This is a low-frequency manual operation, so a full recompute per affected org is entirely
acceptable and is the only way to keep counts and `lastActivityAt` correct.

### 7.4 Observability
Emit success/fail, **unresolved rate**, auto-create rate, sweep re-emit count, rollup-drift
count, resolution-reason distribution → small admin "CRM Health" panel. Alarm signal:
unresolved rate spike, or sweep repeatedly re-emitting the same rows (a real bug, not transience).

### 7.5 Edge cases (P1 stance)
- **Source corrected** → re-emit updates the same row; `linkLocked` manual link preserved.
- **Source voided/cancelled** → `voided=true` on its events (greyed, not removed).
- **Contact email change / duplicate-person merge** → **P2** (`personId` + multi-identity).

---

## 8. Customer 360 UI, Manual Entry & Testing

### 8.1 360 view — upgrade, not greenfield
Re-point existing `OrganizationDetailPage` / `OrgDetail` dossier from the query-time union onto
the persisted `byOrg` TimelineEvent read. Existing components (`ActivityLedger`,
`LinkedLeadsPanel`, `PagesVisitedCard`) become TimelineEvent-powered.

```
HORIBA  ·  horiba.com  ·  Education/Industry  ·  Owner: Harvey  ·  ★ Target
─────────────────────────────────────────────────────────────────────
[ Add activity ]   filter: [all sources ▾]   ☐ show internal-only
─────────────────────────────────────────────────────────────────────
 2026-06-18  🌐 Visited site — 4 pages (incl. ICP-1000W)      domain·0.95
 2026-06-18  📄 Downloaded ICP brochure                        domain·0.95
 2026-06-19  📨 Submitted RFQ — ICP-1000W                     [open RFQ →]
 2026-06-20  💬 Note: customer asked for footprint            Harvey · manual
 2026-06-21  🧾 Quote NS-2026-014 sent — $48,000              [open Order →]
 2026-06-28  📦 Logistics: US Customs Cleared
─────────────────────────────────────────────────────────────────────
Contacts (3)   ·   RFQs 2 · Orders 1 · Leads 4 · $48k · first seen 6/18
```

- Each row carries a **resolution badge** (`domain·0.95`, `manual`, `name·0.7`), a link to the
  source record, and a **re-link** action (feeds Needs-Linking; writes `LinkAuditLog`).
- **`internalOnly` filtering is enforced server-side, not only in the UI (REQUIRED).** The
  query layer must default to **excluding** `internalOnly` events; only an authenticated admin
  query with explicit `includeInternalOnly=true` may return them. UI default-hidden + admin
  toggle is the presentation layer; the API is the security boundary — because the Timeline will
  carry costs, internal notes, logistics exceptions, quote strategy, and sensitive customer info.
- Voided rows greyed.

### 8.2 Manual entry + queues + health
- **Add activity** modal: type (`note | call | email_manual`), `occurredAt` (defaults now,
  **editable** for backdating a milestone), summary, optional Contact, internal-only toggle.
  Resolves explicitly to the current org → `manual`, 1.0.
- **Needs Linking** & **Review New Orgs** pages (§7.3) — new admin routes, **lazy-loaded** per
  the bundle rule (admin routes already split out).
- **CRM Health** panel (§7.4).

### 8.3 Testing (TDD, matching order-api / logistics-api suites)

| Layer | Tests |
|---|---|
| `resolveLinks` (unit) | table-driven per ladder rung; **ordering** (contact-email beats domain — the Terry case); free-domain skips 4–5; `email_domain_new` blocked for analytics-only + denylist domains; `visitor_prior_event` rejected for RFQ/Lead/Order; auto-create stamps `review` + `createdByResolution` |
| Emit/idempotency (unit) | **deterministic id keyed off stable log/version id** (re-emit after log reorder/insert/delete does NOT duplicate); rollup `max()` monotonic; **count-on-create-only** |
| Catalog (unit) | each channel emits expected kind/summary; analytics threshold; analytics session id = `tev-analytics-session-{sessionId}`, one per session; `quote_sent` from doc/version not `quoteDate` edit |
| Failure/sweep (integration) | emit-after-commit; failure flags + sweep **existence-based** re-emit; forgotten-emit (no flag) still caught; **hot vs cold sweep scope** |
| Backfill (integration) | dry-run report counts; **paginated loop (`hasMore`/`nextCursor`)**; idempotent re-run; monotonic rollup preserved |
| Re-link/audit (integration) | unresolved → manual link → `linkLocked` survives re-emit; **re-link triggers recompute for BOTH old & new org**; bulk-apply gated to corporate domain; **re-link writes `LinkAuditLog` with old/new org+contact, operator, reason, timestamp** |
| Authorization (integration) | non-admin query never returns `internalOnly` events; admin `includeInternalOnly=true` does |

---

## 9. Summary

P1 reduces to: **one resolver + one emit helper that every channel shares**, a materialized
`TimelineEvent` table, a lightweight `Contact`, two cleanup queues, an audit log, and an
upgraded 360 page — with Gmail/Twilio/support fields reserved for later. Source tables stay
authoritative; the Timeline becomes a trustworthy, persisted, auditable projection of them.

### Reserved for later phases
- **P2:** Gmail OAuth + Twilio sync (fields/enums already reserved); auto org/contact matching,
  fuzzy match, **`personId` + multi-identity Contact merge**; behavior-score write-back to
  Organization.
- **P3:** Sales workflow — follow-up reminders, Next Action, Deal Stage / board, quote-expiry
  tracking — built on the Timeline.

---

## 10. Planning Notes / Required Clarifications

These were raised in design review and **must be resolved/detailed during planning** before
implementation. Direction is unchanged; these are engineering-correctness requirements.

1. **Deterministic IDs must use stable source log/version IDs, not mutable sequence numbers**
   (§3.5). If a source table lacks a stable per-event id (`OrderLog.id`, logistics log-entry id,
   RFQ status-log id, quote version id), **adding it is a prerequisite task**.
2. **Re-link must trigger a full rollup recompute for both the old and new org** — not an
   incremental delta (§7.3). `recomputeRollupsForOrg(oldOrgId)` + `recomputeRollupsForOrg(newOrgId)`.
3. **Analytics session close = inactivity timeout (30 min); one rollup per `sessionId`** with id
   `tev-analytics-session-{sessionId}` (§4.3). Scheduled rollup processes `lastSeenAt < now−30min`.
4. **`internalOnly` filtering must be enforced server-side, not only in the UI** (§8.1). The API
   is the security boundary; admins opt in via `includeInternalOnly=true`.
5. **`email_domain_new` auto-create is disabled for analytics-only events** and gated by a
   free/hosting/proxy/CDN/known-vendor **denylist** (§4.1) to keep the Review queue clean.
6. **Backfill is a paginated, job-style mutation — one invocation handles one page only**
   (§6.1), returning `{ nextCursor, processedCount, hasMore }`; a driver loops it.
7. **The reconciliation sweep has a hot path + a cold audit path, not a full scan every 15 min**
   (§7.2). Both guarded with `if (!isSandbox)`.
8. **Contact email-derived IDs are accepted for P1, but P2 `personId` / merge / multi-identity
   must be anticipated** (§3.2) — P1 code must not hard-assume `contactId == hash(email)` forever.
