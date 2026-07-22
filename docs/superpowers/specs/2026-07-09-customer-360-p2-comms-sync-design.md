# Customer 360 — P2 Comms Sync (email conversation history) Design Spec

**Status:** Design approved in principle 2026-07-09; revised after design reviews **R1** (2C/4I/5m) and **R2** (durable-checkpoint invariant, full contract + rendering scope, edge-case semantics). §0 precondition **RESOLVED** (single `info@` mailbox). Branch `feature/customer-360-p2-comms-sync` off `origin/main`.

**Goal:** Surface a customer's **email conversation history** inside the Customer 360 timeline (HubSpot-style) — every inbound/outbound email with sales@ / info@ / support@ appears inline in the org's timeline, one click to read the full thread in Gmail.

**Scope framing:** the deliberately re-scoped delivery of *bucket 1* of the original P1-spec "P2" (Gmail/comms sync). The other original-P2 buckets — auto-org-create (`email_domain_new`), fuzzy/name-match, `personId`/multi-identity Contact-merge, behavior-score writeback, the Review-New-Orgs queue — are **NOT** in scope and stay demand-gated (Review-New-Orgs was already dropped as over-engineered during 3A). The multi-email identity model is **deferred** (§5): domain resolution + Needs-Linking self-build the identity graph.

## 0. Precondition — RESOLVED 2026-07-09 (Admin console verification)

The R1/C1 blocking question is settled by direct inspection of the ninescrolls.com Workspace Admin console:
- **ninescrolls.com is Google Workspace** (MX → `aspmx.l.google.com`; `google-site-verification` TXT; SPF `include:_spf.google.com`).
- **`info@ninescrolls.com` is the single real, active, licensed user mailbox** (Harvey Qin, Super Admin, 359 MB Gmail in use). DWD can impersonate it.
- **`sales@` and `support@` are ALIASES of `info@`** (confirmed in the user's alternate-emails list, alongside harvey/invoice/privacy/careers/ap/ar) — their mail delivers **into the `info@` mailbox**.
- **No Google Groups exist** ("organization doesn't have any groups yet"). The only other users, `lince@` / `lna@`, have ~0 GB (empty/unused).

**Consequence — v1 syncs exactly ONE mailbox: `info@ninescrolls.com`.** That single mailbox already contains all sales@/support@/info@ (and other-alias) customer mail, so there is no multi-mailbox impersonation, no Group problem, and one watermark. The `"us = @ninescrolls.com"` direction rule (§5) already treats every alias as internal. Rep personal inboxes remain a demand-gated upgrade (§9).

## 1. Why now / what this reuses

The `TimelineEvent` model reserved the comms fields (`direction`/`externalId`/`threadId`/`from`/`to`/`subject`/`bodySnippet`, `source:'gmail'`) in P1 *for exactly this* — written `null` today (`emitTimelineEvent.ts:53` hard-nulls them; `EmitArgs` omits them). This spec fills them from Gmail, reusing the P2A emit path + `resolveLinks` + the 3A `timelineByOrg` read. There is **no existing Google/OAuth infra** (greenfield). `byExternalId` was spec-reserved but never built as a GSI — and isn't needed (dedup rides a deterministic id, §5).

**Full crm-api + frontend change set (review R1/I3 + R2 — every touch point; all backward-compatible):**
1. **`TimelineIdInput`** (`timelineId.ts`) gains a `gmail` variant → deterministic `tev-gmail-<hash(Message-ID)>` (the emit path builds the id via `timelineId(idInput)`, so a raw id can't be passed — the union needs the case).
2. **optional comms fields** on `CrmEmitPayload` (`amplify/lib/crm/types.ts`) + `EmitArgs` + `buildItem` (stop hard-nulling; default `null` → existing channels unaffected).
3. a **durable normalized `payload.customerEmail`** stamped at emit — the single field Needs-Linking + the unresolved-id key off (NOT re-parsed from `from`/`to` at read time, which would require re-deriving direction).
4. **`ResolveInput.channel`** (`resolveLinks.ts`) union widened with `'gmail'`; gmail **unresolved-unit rule** → collapse by `customerEmail` (§5).
5. **`readSourceEmailForUnit` gmail case** (`link/sourceEmail.ts`) → returns `payload.customerEmail` so a gmail Needs-Linking unit shows the email + domain signal.
6. **rendering (NOT "mapper only" — R2/rendering-scope):** `OrganizationTimelineItem` customType (`data/resource.ts`) gains `direction` / `bodySnippet` / `externalUrl` fields (it carries none today); the mapper populates them and `GROUP_BY_SOURCE`/`ICON_BY_SOURCE` gain `gmail`; regenerated frontend types; the timeline component renders the email row + **Email** chip + a **safe** external link (`target="_blank" rel="noopener noreferrer"`). Detail in §6.
`resolveLinks`' resolution logic, the idempotent write, and Needs-Linking's move/backfill are otherwise unchanged.

## 2. Architecture — two components

```
EventBridge cron (*/10, Stack.of(gmailSync.lambda), !isSandbox, reservedConcurrency:1, action:'sync')
        │
        ▼
┌──────────────────────────────┐   emit (SYNCHRONOUS invoke — §4), per-message
│  gmail-sync Lambda (NEW)      │ ───────────────────────────────────▶  crm-api (emit + resolveLinks)
│  = pure Google adapter         │   ◀───────── projected? (confirm) ──────  TimelineEvent(source='gmail')
│  • google-auth-library JWT/DWD │
│  • impersonate role mailbox    │
│  • users.history.list(watermark)│
│  • users.messages.get(metadata) │
│  • direction + customer address │
│  • dedup key = RFC822 Message-ID│
│  • advance SSM watermark        │
│    (only past confirmed msgs)   │
└──────────────────────────────┘
```

`gmail-sync` touches **no DynamoDB**; it emits via crm-api. `crm-api` owns resolution/persistence (change set §1). Mirrors the P2A channel pattern (`backend.ts` submit-rfq/lead: `CRM_API_FUNCTION_NAME` env + `lambda:InvokeFunction` grant + `resourceGroupName` own stack; cron in `Stack.of(gmailSync.lambda)` → no nested-stack cycle). Watermark lives in **SSM Parameter Store** (`/crm/gmail-sync/watermark/<mailbox>`).

## 3. Access model — service account + domain-wide delegation

- Workspace **service account + DWD** impersonates each role mailbox via signed JWT. No interactive OAuth / consent / token-refresh.
- SA JSON key in **Secrets Manager** `crm/gmail-sync/service-account`; gmail-sync IAM `secretsmanager:GetSecretValue` on that ARN only.
- **Scope `gmail.readonly`**, but every read is `messages.get(format=metadata, metadataHeaders=[From,To,Cc,Bcc,Subject,Date,Message-ID,References,List-Unsubscribe])` → **headers + snippet only, never the body** (`gmail.metadata` scope excludes `snippet`, so `readonly` is required — confirmed).
- **Mailbox (v1): `info@ninescrolls.com` only** (config list of one — see §0; sales@/support@/etc. are aliases delivering into it, so one mailbox captures everything). Kept as a list so rep inboxes can be added later with no auth change.
- **⚠️ Credential blast radius (review R1/I4):** a `gmail.readonly` DWD service account can read **ANY** mailbox in the domain by changing the impersonation subject (CEO/HR/legal) — DWD scoping is all-or-nothing per scope, **not** restrictable to the three role mailboxes. The AWS side is least-privileged, but the secret itself is a whole-domain read key. **Mitigations (required):** a dedicated Workspace project + SA used for nothing else (clean revocation); CloudTrail/CloudWatch alarm on `GetSecretValue` for that ARN; documented key-rotation cadence.
- **Google-side manual setup** (one-time runbook, not code): create the dedicated SA, enable DWD, authorize its client-id for `gmail.readonly` in the Admin console; verify §0 preconditions.

## 4. Sync mechanism — poll history API, durable watermark

- Cron `*/10` (`Stack.of(gmailSync.lambda)`, `!isSandbox`, **`reservedConcurrentExecutions:1`** so a slow run / re-anchor backfill can't overlap a second run — review R1/M1).
- Per mailbox: read SSM `historyId` watermark → `users.history.list(startHistoryId=watermark, historyTypes=[messageAdded])`, paginate → new message ids (includes **Sent** items → outbound; verify a real Sent item produces a `messageAdded` record during the spike — R1/M4) → `messages.get(format=metadata)` → map.
- **Durability model (review R1/I2 — gmail has NO sweep heal, because it writes no source-of-truth the 2C existence sweep can re-derive):** emit **synchronously** (`invokeCrmApi {sync:true}`) and confirm projection per message, with per-message error isolation. Process messages in `historyId` order; **advance the watermark only past a contiguous prefix of confirmed projections** — stop at the first failure so nothing is skipped. A failed message is retried next cron (idempotent re-emit, §5). *(Sync invoke is a deliberate, documented deviation from the "sync = tests/debug only" note in `invoke-crm-api.ts` — justified because gmail has no other durability backstop.)* **Poison handling:** a message failing across many cycles blocks its mailbox's advancement — logged + alarmed (a mailbox whose watermark hasn't advanced in N cycles); an automatic poison-skip-after-K is an explicit fast-follow (§9), not v1.
- **Monotonic watermark (never moves backward):** `reservedConcurrentExecutions:1` prevents overlap, and the SSM write is **conditional** — only advance to a *strictly greater* `historyId` than the stored one. Belt-and-suspenders so a stale/re-anchor run can never rewind the checkpoint.
- **`historyId` expiry (404/400):** re-anchor via the bounded backfill routine (§7) — logged coverage note, never fatal.
- **Central invariant (review R2):** *a mailbox checkpoint advances only after every preceding message has been durably persisted (confirmed sync projection) — never merely dispatched.* The contiguous-confirmed-prefix rule above is the enforcement.

## 5. Mapping, resolution & the identity decision

**Direction + "who is the customer":** "us" = any `@ninescrolls.com` address.
- `From` external → **inbound**, customer = `From`.
- `From` is `@ninescrolls.com` (Sent items) → **outbound**, customer = first external in `To`/`Cc` (`Bcc` for a Bcc-only sent item — R1/M3).
- **Skip** if every participant is `@ninescrolls.com` (internal mail).
- **Explicitly skip `DRAFT` and `CHAT`** — filter on the message's `labelIds` (don't rely on "querying real messages only"; a `messages.get` can still return a draft/chat).
- **Skip by destination alias (required — info@ is a shared catch-all).** Because sales@/support@/info@/**ap@/ar@/invoice@/careers@/privacy@/harvey@** all deliver into the one `info@` mailbox (§0), a raw sync would pull vendor invoices (ap@/invoice@), job applicants (careers@), GDPR requests (privacy@), and accounting (ar@) into the CRM. So key off **which of our addresses the mail actually involves** and keep only customer-facing ones:
  - the "our-address" = the `@ninescrolls.com` recipient in `To`/`Cc` for **inbound**, or the `From` alias for **outbound** (the original alias survives in the `To`/`From` headers even after catch-all delivery — no extra fetch needed).
  - **keep** only if that address's local-part is in a config allowlist `CUSTOMER_ALIASES` = `{ info, sales, support }`; otherwise **skip**. If a message involves *several* of our addresses, keep it when *any* is in the allowlist (err toward inclusion for customer aliases).
  - `harvey@` is deliberately **out** of the default allowlist (personal); add it only if Harvey runs customer sales from it — a one-line config change, called out so it's a conscious choice, not an accidental drop.

**Dedup key (review R1/C2 — Gmail message ids are per-mailbox, NOT global):** use the RFC822 **`Message-ID` header** → `tev-gmail-<sha of normalized Message-ID>`. This is stable across mailboxes, so an email cc'ing sales@ **and** info@ dedups to ONE timeline event (the Gmail per-mailbox id would have created two). Missing/blank `Message-ID` (rare) → fall back to the Gmail message id + log. The Gmail message id is **not** used as an identity key (the deep-link uses the RFC822 id via `rfc822msgid:` search — §6 — so we never need the Gmail id downstream).

**Map → `CrmEmitPayload`:**
```
source:'gmail'  kind:'email'  direction:'inbound'|'outbound'
idInput → tev-gmail-<hash(Message-ID)>          occurredAt: Gmail internalDate (canonical — NOT the Date header, which is client-set/spoofable)
resolveInput: { email:<customerEmail>, channel:'gmail', sourceEntityType:'gmail', sourceEntityId:<Message-ID> }
from / to / subject / bodySnippet(=Gmail snippet) / threadId / externalId(=Message-ID)
payload: { customerEmail:<normalized>, gmailLink, mailbox, cc? }    isInternalOnly:false
```
`payload.customerEmail` is the **durable, normalized** customer address computed once here (inbound `From` / outbound first-external recipient), so downstream (unresolved-id + Needs-Linking enrichment) reads one field instead of re-deriving direction from `from`/`to`.

**Resolution — reuse `resolveLinks`, with a gmail unresolved-unit rule (review R1/I1):**
- resolves via the existing ladder `contact_email_exact` → `email_domain_exact`; on a hit the email lands on that org (and contact) — **no new logic**.
- On a miss, the synthetic unresolved org is keyed on `payload.customerEmail`: `unresolved-gmail-<customerEmail>` (NOT `<messageId>`). So all unresolved emails from one address **collapse into a single Needs-Linking unit** — an admin links the person once and every past *and* future email from that address resolves (`contact_email_exact`). Without this, each email is its own signal-less unit (the R1/I1 defect).
- **`readSourceEmailForUnit` gains a `gmail` case** that returns `payload.customerEmail` from the unit's representative event so the Needs-Linking unit shows the email + domain signal (gmail has no source-META row to read, unlike rfq/order; reading the one durable field avoids re-deriving direction at read time). gmail's source-backfill is `no_source` (an email has no `matchedOrgId` META to stamp — correct).

**Identity decision — DEFER the multi-email/`personId` model (approved):** same-company aliases resolve via `email_domain_exact`; free-mail addresses bind to a Contact on first Needs-Linking, then auto-resolve. The graph self-builds; no `personId`/`ContactIdentity` model in v1.

## 6. Rendering (Customer 360 timeline) — full stack, not "mapper only" (review R2)

The `OrganizationTimelineItem` type has **no** email display fields today (verified: it carries per-kind fields like `stageFrom`/`fileName` but no `subject`/`snippet`/`direction`/`externalUrl`), and `GROUP_BY_SOURCE`/`ICON_BY_SOURCE` have no `gmail`. So the render path spans:
1. **GraphQL** (`data/resource.ts` `OrganizationTimelineItem` customType): add `direction: a.string()`, `bodySnippet: a.string()`, `externalUrl: a.string()`.
2. **Mapper** (`organizationTimelineItem.ts`): `source:'gmail'`/`kind:'email'` case → `primaryLabel`=subject (fallback "(no subject)"), `bodySnippet`, `direction`, `externalUrl`=`payload.gmailLink`; add `gmail` to `GROUP_BY_SOURCE` (a new `'email'` chip group) + `ICON_BY_SOURCE` (direction Material Symbol: inbound `mail` / outbound `send`); resolution-tier badge unchanged.
3. **Frontend** (regenerated Amplify types + the timeline component + `buildSourceLink`): render the email row (subject + snippet + direction icon), add the **Email** source-filter chip, and open `externalUrl` as a **safe external link** — `target="_blank" rel="noopener noreferrer"` (it leaves the app to Gmail).
`gmailLink` = `https://mail.google.com/mail/u/0/#search/rfc822msgid:<Message-ID>` (opens the exact message in whoever-clicks's own Gmail). `isInternalOnly:false` (timeline is admin-only). **v1 = one row per message**, chronological (matches HubSpot); `threadId` stored → future thread-collapse is pure UI, no data change.

## 7. Initial backfill (one-time per mailbox)

On first sync (no watermark) or a re-anchor (§4):
1. **Capture the anchor FIRST** — read the mailbox's current `historyId` (a cheap `messages.list(maxResults=1)` / `getProfile`) and hold it, **before** the seed. (Review R2: capturing it *after* the seed would lose any message that arrives *during* the backfill.)
2. `messages.list(q='newer_than:<N>d')` (N config, default 90) — **paginated + resumable** (persist a page cursor so a mid-run timeout resumes, not restarts — R1/M5) → `messages.get(metadata)` → map + emit.
3. Only after the seed completes, set the watermark to the **anchor captured in step 1** → incremental replays anything that landed during the seed (idempotent, deterministic ids), so nothing is missed.

## 7b. Edge cases & failure semantics (review R2)

- **Repeated history entries:** `history.list` can return the same message id across pages/runs (and `messageAdded`+later `messageDeleted` for the same id). The deterministic-id idempotent write makes reprocessing a no-op — never a duplicate row.
- **Deleted / trashed / inaccessible message:** a `messages.get` returning **404/`notFound`** (message trashed between the history entry and the fetch) → **skip that id and continue** (do not fail the run, do not block the checkpoint on it) + log.
- **Poison message (non-404, keeps failing to project):** blocks its mailbox's checkpoint advancement per §4; logged + alarmed after N cycles; auto-skip-after-K is a §9 fast-follow.
- **Pagination failure:** a `history.list`/`messages.list` page error aborts the run without advancing the watermark; next cron resumes from the last checkpoint (idempotent).
- **Rate limits (429 / `rateLimitExceeded`):** bounded exponential backoff + retry within the invocation; if still limited, end the run without advancing past the last confirmed message (resume next cron). At NineScrolls volume (one mailbox) this is not expected — Gmail per-user is 250 quota-units/s (get=5, list=5, history=2).
- **Checkpoint semantics:** the watermark is the `historyId` of the newest message in the **contiguous confirmed-projected prefix** (§4) — monotonic, advanced only after durable persistence.

## 8. Testing (TDD)

**gmail-sync (mock Google client):** direction; external-customer extraction (inbound From / outbound first-external To/Cc/Bcc) → durable `payload.customerEmail`; skip-all-internal; **skip `DRAFT`/`CHAT` labelIds**; **destination-alias allowlist** (keep info/sales/support; skip ap/ar/invoice/careers/privacy/harvey; keep-if-any-recipient-is-customer-alias); **dedup key = hash(Message-ID)** (same email in two mailboxes → one event) + missing-Message-ID fallback; **occurredAt = internalDate** (not the Date header); **watermark: advances only past a contiguous confirmed prefix; mid-run projection failure leaves it at the last confirmed message; conditional write never rewinds**; **deleted message (`messages.get` 404) → skip-and-continue, checkpoint not blocked**; `historyId`-expiry → resumable re-anchor; **backfill captures the anchor BEFORE the seed** + pagination/resume; rate-limit backoff. **crm-api:** `TimelineIdInput` gmail variant → `tev-gmail-<hash(Message-ID)>`; emit persists comms fields + `payload.customerEmail` when provided (and `null`/absent when omitted — existing channels unaffected); `ResolveInput.channel:'gmail'`; unresolved gmail collapses to `unresolved-gmail-<customerEmail>`; `readSourceEmailForUnit` gmail case returns `payload.customerEmail`; mapper `source:'gmail'` → `direction`/`bodySnippet`/`externalUrl` + `email` chip group + direction icon. **Frontend/schema:** `OrganizationTimelineItem` exposes `direction`/`bodySnippet`/`externalUrl`; email-row render; Email chip filter; external link has `rel="noopener noreferrer"`.

## 9. Non-goals (demand-gated)

Full-body storage; on-demand body fetch; thread-collapse UI; real-time Gmail push (Pub/Sub); `personId`/multi-identity/Contact-merge; auto-org-create; fuzzy/name-match; behavior-score writeback; rep personal inboxes; send/reply-from-CRM; recipient fan-out (one event per external recipient); automatic poison-skip-after-K; no-reply/bulk denylist (add only if role-mailbox noise proves bad).

## 10. Infra / deploy / ops guardrails

- New Lambda `amplify/functions/gmail-sync/`, own `resourceGroupName:'gmail-sync-stack'`, `reservedConcurrentExecutions:1`, ~120s; cron in `Stack.of(gmailSync.lambda)` (no data-stack grant → no cycle).
- Dep: `google-auth-library` + `fetch` to Gmail REST (not full `googleapis`).
- IAM (least privilege): `secretsmanager:GetSecretValue` (SA key ARN); `ssm:GetParameter`/`PutParameter` (`/crm/gmail-sync/watermark/*`); `lambda:InvokeFunction` (crm-api) + `CRM_API_FUNCTION_NAME` env. Plus the R1/I4 credential mitigations (dedicated SA/project, `GetSecretValue` alarm, rotation).
- **Privacy (honest framing — R1/M2):** no email *bodies* in DynamoDB, but the `snippet` is body-*derived* (~first 200 chars) and can contain quoted sensitive content; it lives in `INTELLIGENCE_TABLE`, visible to authenticated admins only. Not "zero body-content" — "no full body."
- `!isSandbox`-gated end-to-end. Runbook: §0 precondition validation; GCP SA/DWD/scope setup; watermark reset; backfill window `N`; poison-mailbox alarm response.
- gmail-sync writes nothing to DynamoDB; crm-api change set is §1.
