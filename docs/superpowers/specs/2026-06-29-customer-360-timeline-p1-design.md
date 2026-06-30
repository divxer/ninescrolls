# Customer 360 Timeline — Phase 1 Design Spec

**Date:** 2026-06-29
**Status:** Approved for planning
**Scope:** Phase 1 of a multi-phase Customer Intelligence Platform for NineScrolls

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
| P2 | Gmail OAuth / Twilio / automated comms sync; deeper entity resolution (auto org/contact matching, fuzzy match, merge automation, behavior-score write-back) | Upgrade "good-enough heuristics" into "reliable automation" |
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
id                deterministic → tev-{sourceEntityType}-{sourceEntityId}-{kind}[-{seq}]
                  (re-emit / backfill UPSERTS the same row; never duplicates)
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
isInternalOnly    bool  (reuse Logistics internal/visible concept; hidden by default in UI)
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
contactId       deterministic from normalized email
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
| 5 | `email_domain_new` | corporate domain, no Org yet → **auto-create Org** (`status=review`, `createdByResolution=true`) | 0.8 |
| 6 | `organization_name_match` | normalized name == Org `displayName`/alias (**exact-normalized, no fuzzy**) | 0.7 |
| 7 | `visitor_prior_event` | `visitorId` resolved to an Org on an earlier event — **analytics/session rollups ONLY**, never RFQ/Lead/Order | 0.5 |
| — | `unresolved` | none matched → `unresolved-{type}-{id}`, Needs-Linking queue | 0 |

> **Ordering rationale:** a manually curated `Contact` (step 3) must outrank domain logic
> (steps 4–5). Example: `terry@diamondfoundry.com` already locked to Diamond Foundry while the
> Org's domain aliases are not yet maintained — trust the Contact, do not create a duplicate Org.

**Free-domain handling:** personal-domain emails (gmail/outlook/qq/163/yahoo…) skip steps 4–5
but may still hit 3 or 6; otherwise `unresolved` rather than spawning junk orgs. Auto-create
(step 5) is **corporate domains only**.

**`visitor_prior_event` restriction:** allowed only for analytics/session rollups. Never used
for strong-signal records (RFQ/Lead/Order) to avoid shared-PC / proxy contamination of real
customers.

### 4.2 Contact resolution (lightweight)

- Normalize email → lowercase/trim. **No email → `contactId = null`** (most page views).
- Exact email match → reuse, refresh `lastSeenAt`, backfill missing name/title/phone.
- No match → create `Contact` (deterministic id from email), attach resolved `orgId`.
- `linkLocked` Contact/Org is never auto-overwritten.

### 4.3 Analytics exception

`AnalyticsEvent` (high-volume public `a.model`) is **not** resolved/emitted per page view. A
session is rolled up into a **single** `site_visit_session` event at session close via the
existing `server-track` path. Resolution stays off the hot public write path.

---

## 5. Channel Emit Catalog + Consistency

### 5.1 Shared emit helper

```
emitTimelineEvent({
  source, kind, sourceEntityType, sourceEntityId,
  occurredAt, summary, resolveInput, payload, isInternalOnly?, createdBy?
})
→ resolveLinks() → upsert Contact → UPSERT TimelineEvent (deterministic id) → bump Org rollups
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
| Analytics (`server-track` rollup) | `site_visit_session` | one per session at close, **above signal threshold** | visitorId, IP-org |

**Analytics signal threshold** — a session enters the Timeline only if it includes:
`product_page_viewed | rfq_page_viewed | download | return_visit | session_pages ≥ 3`.
Homepage-only single-page visits never enter a customer Timeline.

**Manual `email_manual`** — key-milestone note only ("Customer replied asking for footprint",
"Quote sent by email"). **Not** a daily Gmail-sync surrogate.

### 5.3 Consistency guarantees

1. **Emit only after the source write commits** — same Lambda, after the DDB put succeeds.
   The source record is always authoritative; the Timeline is a projection.
2. **Idempotent deterministic id** — `order_stage_changed` keyed off `OrderLog` entry id,
   `logistics_milestone` off log-entry id, etc. Re-emit / backfill updates the same row.
3. **Non-blocking** — emit is wrapped; failure is logged + queued for the sweep; it **never**
   rolls back or blocks the business write.
4. **Rollups increment on first create only** — conditional put keyed on the deterministic id,
   so re-runs do not inflate counts. Replaces scattered per-channel counting.
5. **Monotonic rollups** — `lastActivityAt = max(existing, event.occurredAt)` (and same for
   `latestRFQ/Order/LeadDate`). Backfilling old events never drags "recent activity" backwards.

---

## 6. Backfill / Migration

Backfill uses the **exact same** `resolveLinks` + `emitTimelineEvent` code path as live writes
(no parallel migration logic). Idempotent → safely re-runnable.

### 6.1 Mechanism — server-side

A `crm-api` admin mutation `runTimelineBackfill({ channel, dryRun, cursor, limit })`:
- Runs **inside the Lambda** (same IAM/SDK/resolver as production — avoids local-script drift).
- **Resumable** via cursor; idempotent (re-run over a page is a no-op update).
- Triggered from a small `scripts/backfill-timeline.ts` driver (existing `scripts/` + admin-creds
  pattern) or an admin button.

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

1. Backfill (dry-run → real).
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

### 7.2 Layer 2 — scheduled reconciliation sweep (durable safety net)
A scheduled Lambda (~every 15 min) that:
1. For each source record, **computes the expected deterministic TimelineEvent id(s) and checks
   existence** → missing → (re-)emit idempotently. `timelineSynced=false` is only a fast-path
   index, **never the sole trigger** (a forgotten-emit path may have no flag at all).
2. Runs the §6.5 reconciliation check → flags drift.

> ⚠️ Per the Amplify env constraint, scheduled crons **fire in the live sandbox too** — this
> sweep must be guarded with `if (!isSandbox)` so a dev sandbox does not double-process
> production-shaped data.

### 7.3 Admin queues

| Queue | Contains | Action |
|---|---|---|
| **Needs Linking** | events with `resolutionStatus=unresolved` | pick correct Org/Contact → `manually_linked` + `linkLocked` + confidence 1.0, re-point orgId, re-run rollups, **write `LinkAuditLog`**. Offer **"apply to all events from same email/domain/visitor"** — **same-domain bulk is corporate-domain only** (disabled for free domains) |
| **Review New Orgs** | auto-created orgs (`status=review`, `createdByResolution=true`) | approve / rename / **merge into existing Org** (re-points child events; writes `LinkAuditLog`) |

### 7.4 Observability
Emit success/fail, **unresolved rate**, auto-create rate, sweep re-emit count, rollup-drift
count, resolution-reason distribution → small admin "CRM Health" panel. Alarm signal:
unresolved rate spike, or sweep repeatedly re-emitting the same rows (a real bug, not transience).

### 7.5 Edge cases (P1 stance)
- **Source corrected** → re-emit updates the same row; `linkLocked` manual link preserved.
- **Source voided/cancelled** → `voided=true` on its events (greyed, not removed).
- **Contact email change / duplicate-person merge** → **P2** (no fuzzy/merge automation in P1).

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
- **`internalOnly` events hidden by default**, shown only via the admin toggle — logistics
  internals, costs, internal notes never default into the customer interaction history.
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
| `resolveLinks` (unit) | table-driven per ladder rung; **ordering** (contact-email beats domain — the Terry case); free-domain skips 4–5; `visitor_prior_event` rejected for RFQ/Lead/Order; auto-create stamps `review` + `createdByResolution` |
| Emit/idempotency (unit) | deterministic id; re-emit updates not duplicates; rollup `max()` monotonic; **count-on-create-only** |
| Catalog (unit) | each channel emits expected kind/summary; analytics threshold (homepage-only excluded; product/RFQ/download/≥3-pages included); `quote_sent` from doc/version not `quoteDate` edit |
| Failure/sweep (integration) | emit-after-commit; failure flags + sweep **existence-based** re-emit; forgotten-emit (no flag) still caught |
| Backfill (integration) | dry-run report counts; idempotent re-run; monotonic rollup preserved |
| Linking/audit (integration) | unresolved → manual link → `linkLocked` survives re-emit; bulk-apply gated to corporate domain; **re-link writes `LinkAuditLog` with old/new org+contact, operator, reason, timestamp** |

---

## 9. Summary

P1 reduces to: **one resolver + one emit helper that every channel shares**, a materialized
`TimelineEvent` table, a lightweight `Contact`, two cleanup queues, an audit log, and an
upgraded 360 page — with Gmail/Twilio/support fields reserved for later. Source tables stay
authoritative; the Timeline becomes a trustworthy, persisted, auditable projection of them.

### Reserved for later phases
- **P2:** Gmail OAuth + Twilio sync (fields/enums already reserved); auto org/contact matching,
  fuzzy match, duplicate-person merge automation; behavior-score write-back to Organization.
- **P3:** Sales workflow — follow-up reminders, Next Action, Deal Stage / board, quote-expiry
  tracking — built on the Timeline.
