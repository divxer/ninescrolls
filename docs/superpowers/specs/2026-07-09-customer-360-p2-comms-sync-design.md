# Customer 360 — P2 Comms Sync (email conversation history) Design Spec

**Status:** Design approved for planning 2026-07-09. Branch `feature/customer-360-p2-comms-sync` off `origin/main`.

**Goal:** Surface a customer's **email conversation history** inside the Customer 360 timeline (HubSpot-style) — every inbound/outbound email with sales@ / info@ / support@ appears inline in the org's timeline, one click to read the full thread in Gmail.

**Scope framing:** This is the deliberately re-scoped delivery of *bucket 1* of the original P1-spec "P2" (Gmail/comms sync). The other original-P2 buckets — auto-org-create (`email_domain_new`), fuzzy/name-match, `personId`/multi-identity Contact-merge, behavior-score writeback, the Review-New-Orgs queue — are **NOT** in scope and stay demand-gated (Review-New-Orgs was already dropped as over-engineered during 3A). The "minimal multi-email identity" that was floated is **deferred** (see §5): domain resolution + the Needs-Linking queue self-build the identity graph with zero new model.

## 1. Why now / what this reuses

The `TimelineEvent` model reserved the comms fields (`direction`/`externalId`/`threadId`/`from`/`to`/`subject`/`bodySnippet`, `source:'gmail'`) in P1 *for exactly this* — they're written `null` today. This spec fills them from Gmail. It reuses:
- the P2A **emit path** (`amplify/lib/crm/` `CrmEmitPayload` in `types.ts` + `emitTimelineEventToCrm` Event-invoke into crm-api) — Gmail becomes one more emitting channel. **One small extension:** the comms fields (`direction`/`from`/`to`/`subject`/`bodySnippet`/`threadId`/`externalId`) must be threaded through — today `EmitArgs` omits them and `emitTimelineEvent`'s `buildItem` hard-nulls them (`emitTimelineEvent.ts:53`). We add them as **optional** fields on `CrmEmitPayload`/`EmitArgs` and have `buildItem` use them (default `null`) — fully backward-compatible: every existing channel passes none → `null` exactly as today.
- crm-api's **`resolveLinks` ladder** (email → org/contact) and **deterministic-id idempotent write** — unchanged;
- the **Needs-Linking queue (3B)** for unresolved emails;
- the **3A `timelineByOrg`** read — no new query, no new page.

There is **no existing Google/OAuth infra** (greenfield). `byExternalId` was spec-reserved but never built as a GSI — and is not needed (dedup rides the deterministic id).

## 2. Architecture — two components

```
EventBridge cron (*/10, Stack.of(gmailSync.lambda), !isSandbox, action:'sync')
        │
        ▼
┌──────────────────────────────┐   emitTimelineEventToCrm (Event invoke, P2A path)
│  gmail-sync Lambda (NEW)      │ ───────────────────────────────────▶  crm-api (UNCHANGED)
│  = pure Google adapter         │                                       resolveLinks → TimelineEvent(source='gmail')
│  • google-auth-library JWT/DWD │                                       dedup (tev-gmail-<id>) → Needs-Linking if unresolved
│  • impersonate role mailbox    │
│  • users.history.list(watermark)│
│  • users.messages.get(metadata) │
│  • direction + customer address │
│  • skip-internal               │
│  • build CrmEmitPayload         │
│  • advance SSM watermark        │
└──────────────────────────────┘
```

**`gmail-sync`** owns everything Google-shaped and touches **no DynamoDB**; it emits via the existing crm-api path. **crm-api** owns everything CRM-shaped; its only changes are backward-compatible: the emit path gains **optional** comms fields (§1) and the read-mapper gains a `source:'gmail'` case (§6). `resolveLinks`, dedup, persistence, and Needs-Linking routing are untouched. This mirrors the P2A channel pattern (each channel is its own Lambda emitting into crm-api) and enforces least privilege: crm-api never sees the Google key; gmail-sync never touches the intelligence table.

The `historyId` watermark lives in **SSM Parameter Store** (`/crm/gmail-sync/watermark/<mailbox>`, one per mailbox) — no table grant, no stack-cycle risk, trivially resettable for ops/testing.

## 3. Access model — service account + domain-wide delegation

- A Google **Workspace service account** with **domain-wide delegation (DWD)** impersonates each role mailbox via a signed JWT. **No interactive OAuth, no per-user consent, no token-refresh dance.**
- Service-account JSON key stored in **Secrets Manager** `crm/gmail-sync/service-account`; gmail-sync IAM `secretsmanager:GetSecretValue` on that ARN only.
- **Scope `gmail.readonly`**, but every read is `messages.get(format=metadata, metadataHeaders=[From,To,Cc,Subject,Date,Message-ID,List-Unsubscribe])` → returns **headers + snippet only, never the body**. Zero-body-ingestion is enforced at the request boundary. (`gmail.metadata` scope is tighter but excludes `snippet`, which we want — documented trade-off.)
- **Mailboxes (v1):** `sales@`, `info@`, `support@` (config list). `noreply@` excluded (automated transactional mail is already captured as lead/rfq events). Upgrades to rep personal inboxes later with **no auth change** (DWD impersonates any domain user).
- **Google-side manual setup** (one-time, in a runbook — not code): create the SA, enable DWD, authorize its client-id for `gmail.readonly` in the Workspace Admin console.

## 4. Sync mechanism — poll via history API

- EventBridge cron `*/10` (in `Stack.of(gmailSync.lambda)`, `!isSandbox`) fires `gmail-sync {action:'sync'}`.
- Per mailbox: read the SSM `historyId` watermark → `users.history.list(startHistoryId=watermark, historyTypes=[messageAdded])`, paginate → collect new message ids → `messages.get(format=metadata)` each → map + emit.
- **Watermark advanced only on success** — a Lambda failure/timeout leaves it unchanged; the next cron resumes gaplessly. Combined with the deterministic id + idempotent write, partial retries are safe.
- **`historyId` expiry (404/400)**: Gmail expires a `historyId` after long inactivity. On that error, **re-anchor** — run the bounded backfill routine (§7), which seeds the timeline and captures the mailbox's current `historyId` as the new watermark. Logged as a coverage note, never fatal.
- Latency 5–15 min is fine for a history view; real-time push (Pub/Sub) is an explicit non-goal (§9).

## 5. Mapping, resolution & the identity decision

**Direction + "who is the customer":** "us" = any `@ninescrolls.com` address.
- `From` external → **inbound**, customer = `From`.
- `From` is `@ninescrolls.com` (the mailbox's own Sent items) → **outbound**, customer = first external address in `To`/`Cc`.
- **Skip** if every participant is `@ninescrolls.com` (pure internal mail is not customer comms). Drafts/chats excluded by querying real messages only. v1 stays lenient beyond that; a no-reply/bulk denylist is a fast-follow (§9), surfaced not silently filtered.

**Map → `CrmEmitPayload`** (reuses the P2A contract; crm-api's emit resolves + persists):
```
source:             'gmail'
kind:               'email'                    (vs 'email_manual' for hand-logged notes)
direction:          'inbound' | 'outbound'
id (idInput):       stable key → tev-gmail-<messageId>   (Gmail message id is stable + globally unique → idempotent)
occurredAt:         Date header / internalDate
resolveInput.email: <customer address>          (the external party — drives resolution)
from / to / subject / bodySnippet (= Gmail snippet) / threadId / externalId (= messageId)
payload:            { gmailLink, mailbox, cc? }
isInternalOnly:     false                        (shown by default; timeline is admin-only)
```
`gmailLink` = `https://mail.google.com/mail/u/0/#search/rfc822msgid:<Message-ID>` — opens the exact message in whoever-clicks's own Gmail, robust across shared-mailbox members. Multiple external recipients on an outbound email → resolve by the **primary** (first external) address, one event; recipient fan-out is a fast-follow.

**Resolution — 100% reuse:** `resolveInput.email` flows through the existing `resolveLinks` ladder in crm-api: `contact_email_exact` → `email_domain_exact` → else `unresolved-gmail-<messageId>` → **Needs-Linking (3B)** as a structured unit an admin links once.

**Identity decision — DEFER the multi-email/`personId` model (approved):**
- **Same-company, different address** (`bob@acme.com` → `bob.smith@acme.com`) already resolves to the same org via `email_domain_exact` — domain resolution covers it with no identity model.
- **Personal / free-mail** (`bob@gmail.com`) → Needs-Linking once; the moment an admin links it, a Contact exists for that address, so every future email from it auto-resolves via `contact_email_exact`. **The system self-builds the identity graph through Needs-Linking** — no `personId`/`ContactIdentity` model in v1. Demand-gated.

## 6. Rendering (Customer 360 timeline) — read-mapper only

Email events land in the same `byOrg` timeline; the only change is `toOrganizationTimelineItem`:
- new `source:'gmail'` / `kind:'email'` case: `primaryLabel` = subject (fallback `"(no subject)"`); secondary = `bodySnippet`; icon = direction-based Material Symbol (inbound `mail` / outbound `send`); resolution-tier badge from `resolutionReason` (unchanged).
- `buildSourceLink` gains `gmail → payload.gmailLink` — the row's "open" deep-links out to Gmail (new tab) instead of an internal `/admin/...` route.
- the client-side **source filter chips** gain an **"Email"** chip.
- `isInternalOnly:false` → shown by default; the timeline is already admin-only, so the snippet (a preview sliver) is only ever seen by authenticated admins.
- **Thread handling (v1):** one row per message, chronological (matches HubSpot; same-thread messages sit adjacent by time). `threadId` is stored → a future "collapse into conversation" is pure-UI with no data change.

No new page, no new query — rides 3A `timelineByOrg` unchanged.

## 7. Initial backfill (one-time per mailbox)

`history.list` only works forward from a `historyId`. On first sync (no watermark) — or on a `historyId`-expiry re-anchor (§4) — run a bounded seed:
- `messages.list(q='newer_than:<N>d')` (N config, e.g. 90) → `messages.get(metadata)` each → map + emit;
- capture the mailbox's **current `historyId`** as the seed watermark → incremental forever after.
Idempotent (deterministic ids), so re-running the seed re-emits the same events harmlessly.

## 8. Testing (TDD)

**gmail-sync (mock the Google client):** direction determination; external-customer extraction (inbound `From`, outbound first-external `To`/`Cc`); skip-all-internal; payload mapping (source/kind/direction/id/comms fields/gmailLink); deterministic `tev-gmail-<id>`; watermark advance-only-on-success; `historyId`-expiry → bounded re-anchor; backfill seed captures current historyId; pagination across history pages.
**crm-api:** resolution/dedup logic unchanged; add a test that the emit path **persists the comms fields** when provided (and still writes `null` when omitted — the existing channels' behavior); add one read-mapper test for `source:'gmail'` (subject/snippet/direction/link-out) + the "Email" source chip.
**Frontend:** render test for an email row (subject/snippet/direction icon/external link) + source-chip filter.

## 9. Non-goals (explicit, demand-gated)

Full-body storage; on-demand body fetch (a possible later hybrid); thread-collapse UI; real-time Gmail push (Pub/Sub); `personId`/multi-identity/Contact-merge; auto-org-create (`email_domain_new`); fuzzy/name-match; behavior-score writeback; rep personal inboxes; send/reply-from-CRM; recipient fan-out; no-reply/bulk denylist (add only if role-mailbox noise proves bad).

## 10. Infra / deploy / ops guardrails

- **New Lambda** `amplify/functions/gmail-sync/` with its own `resourceGroupName: 'gmail-sync-stack'`; cron Rule in `Stack.of(gmailSync.lambda)` (no data-stack grant → no nested-stack cycle).
- **Dependency:** `google-auth-library` + `fetch` to Gmail REST (not the monolithic `googleapis` SDK — bundle/cold-start).
- **IAM (least privilege):** `secretsmanager:GetSecretValue` (SA key ARN); `ssm:GetParameter`/`PutParameter` (`/crm/gmail-sync/watermark/*`); `lambda:InvokeFunction` (crm-api) + `CRM_API_FUNCTION_NAME` env — the exact submit-rfq/lead pattern.
- **`!isSandbox`-gated** end-to-end: no sandbox ever touches production Gmail.
- **Runbook:** GCP service-account + DWD + Admin-console scope authorization; watermark reset; first-run backfill window `N`.
- gmail-sync writes **nothing** to DynamoDB (emits via crm-api); crm-api changes are minimal + backward-compatible: optional comms fields on the emit path (`CrmEmitPayload`/`EmitArgs`/`buildItem`, §1) + the read-mapper `source:'gmail'` case (§6).
