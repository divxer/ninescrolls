# Customer 360 — P2 Comms Sync (email conversation history) Design Spec

**Status:** Design approved in principle 2026-07-09; **revised after design review R1** (2 Critical / 4 Important / 5 Minor all addressed below). **One precondition (§0) must be validated before planning starts.** Branch `feature/customer-360-p2-comms-sync` off `origin/main`.

**Goal:** Surface a customer's **email conversation history** inside the Customer 360 timeline (HubSpot-style) — every inbound/outbound email with sales@ / info@ / support@ appears inline in the org's timeline, one click to read the full thread in Gmail.

**Scope framing:** the deliberately re-scoped delivery of *bucket 1* of the original P1-spec "P2" (Gmail/comms sync). The other original-P2 buckets — auto-org-create (`email_domain_new`), fuzzy/name-match, `personId`/multi-identity Contact-merge, behavior-score writeback, the Review-New-Orgs queue — are **NOT** in scope and stay demand-gated (Review-New-Orgs was already dropped as over-engineered during 3A). The multi-email identity model is **deferred** (§5): domain resolution + Needs-Linking self-build the identity graph.

## 0. BLOCKING precondition — verify before planning (review R1/C1)

Domain-wide delegation (DWD) impersonates a **user**; the Gmail API only works against a real Gmail mailbox on a **licensed Workspace user account**. If `sales@` / `info@` / `support@` are Google **Groups** or **aliases** (common for role addresses), impersonation fails and this design cannot read them. **Action:** confirm each monitored address is a standalone licensed user with an active Gmail mailbox. If any is a Group/alias, resolve per-mailbox first (convert to a shared user seat, point at the real destination mailbox, or drop it from v1). This gates the whole approach.

## 1. Why now / what this reuses

The `TimelineEvent` model reserved the comms fields (`direction`/`externalId`/`threadId`/`from`/`to`/`subject`/`bodySnippet`, `source:'gmail'`) in P1 *for exactly this* — written `null` today (`emitTimelineEvent.ts:53` hard-nulls them; `EmitArgs` omits them). This spec fills them from Gmail, reusing the P2A emit path + `resolveLinks` + the 3A `timelineByOrg` read. There is **no existing Google/OAuth infra** (greenfield). `byExternalId` was spec-reserved but never built as a GSI — and isn't needed (dedup rides a deterministic id, §5).

**Full crm-api change set (review R1/I3 — the earlier "unchanged" framing was wrong):** all backward-compatible, but real:
1. **optional comms fields** on `CrmEmitPayload` (`amplify/lib/crm/types.ts`) + `EmitArgs` + `buildItem` (stop hard-nulling; default `null` → existing channels unaffected).
2. **`ResolveInput.channel`** (`resolveLinks.ts`) union widened with `'gmail'`.
3. **gmail unresolved-unit rule** (§5) so unresolved emails collapse **by customer email**, not messageId.
4. **`readSourceEmailForUnit` gmail case** (`link/sourceEmail.ts`, §5) so a gmail Needs-Linking unit shows the customer email/domain signal.
5. **read-mapper** `source:'gmail'` case (§6).
`resolveLinks`' resolution logic, the idempotent write, and Needs-Linking's move/backfill machinery are otherwise unchanged.

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
- **Mailboxes (v1):** sales@ / info@ / support@ (config list); noreply@ excluded. Upgrades to rep inboxes later with no auth change.
- **⚠️ Credential blast radius (review R1/I4):** a `gmail.readonly` DWD service account can read **ANY** mailbox in the domain by changing the impersonation subject (CEO/HR/legal) — DWD scoping is all-or-nothing per scope, **not** restrictable to the three role mailboxes. The AWS side is least-privileged, but the secret itself is a whole-domain read key. **Mitigations (required):** a dedicated Workspace project + SA used for nothing else (clean revocation); CloudTrail/CloudWatch alarm on `GetSecretValue` for that ARN; documented key-rotation cadence.
- **Google-side manual setup** (one-time runbook, not code): create the dedicated SA, enable DWD, authorize its client-id for `gmail.readonly` in the Admin console; verify §0 preconditions.

## 4. Sync mechanism — poll history API, durable watermark

- Cron `*/10` (`Stack.of(gmailSync.lambda)`, `!isSandbox`, **`reservedConcurrentExecutions:1`** so a slow run / re-anchor backfill can't overlap a second run — review R1/M1).
- Per mailbox: read SSM `historyId` watermark → `users.history.list(startHistoryId=watermark, historyTypes=[messageAdded])`, paginate → new message ids (includes **Sent** items → outbound; verify a real Sent item produces a `messageAdded` record during the spike — R1/M4) → `messages.get(format=metadata)` → map.
- **Durability model (review R1/I2 — gmail has NO sweep heal, because it writes no source-of-truth the 2C existence sweep can re-derive):** emit **synchronously** (`invokeCrmApi {sync:true}`) and confirm projection per message, with per-message error isolation. Process messages in `historyId` order; **advance the watermark only past a contiguous prefix of confirmed projections** — stop at the first failure so nothing is skipped. A failed message is retried next cron (idempotent re-emit, §5). *(Sync invoke is a deliberate, documented deviation from the "sync = tests/debug only" note in `invoke-crm-api.ts` — justified because gmail has no other durability backstop.)* **Poison handling:** a message failing across many cycles blocks its mailbox's advancement — logged + alarmed (a mailbox whose watermark hasn't advanced in N cycles); an automatic poison-skip-after-K is an explicit fast-follow (§9), not v1.
- **`historyId` expiry (404/400):** re-anchor via the bounded backfill routine (§7) — logged coverage note, never fatal.

## 5. Mapping, resolution & the identity decision

**Direction + "who is the customer":** "us" = any `@ninescrolls.com` address.
- `From` external → **inbound**, customer = `From`.
- `From` is `@ninescrolls.com` (Sent items) → **outbound**, customer = first external in `To`/`Cc` (`Bcc` for a Bcc-only sent item — R1/M3).
- **Skip** if every participant is `@ninescrolls.com` (internal mail). Drafts/chats excluded by querying real messages only.

**Dedup key (review R1/C2 — Gmail message ids are per-mailbox, NOT global):** use the RFC822 **`Message-ID` header** → `tev-gmail-<sha of normalized Message-ID>`. This is stable across mailboxes, so an email cc'ing sales@ **and** info@ dedups to ONE timeline event (the Gmail per-mailbox id would have created two). Missing/blank `Message-ID` (rare) → fall back to the Gmail message id + log. The Gmail message id is **not** used as an identity key (the deep-link uses the RFC822 id via `rfc822msgid:` search — §6 — so we never need the Gmail id downstream).

**Map → `CrmEmitPayload`:**
```
source:'gmail'  kind:'email'  direction:'inbound'|'outbound'
idInput → tev-gmail-<hash(Message-ID)>          occurredAt: Date/internalDate
resolveInput: { email:<customer address>, channel:'gmail', sourceEntityType:'gmail', sourceEntityId:<Message-ID> }
from / to / subject / bodySnippet(=Gmail snippet) / threadId / externalId(=Message-ID)
payload: { gmailLink, mailbox, cc? }            isInternalOnly:false
```

**Resolution — reuse `resolveLinks`, with a gmail unresolved-unit rule (review R1/I1):**
- resolves via the existing ladder `contact_email_exact` → `email_domain_exact`; on a hit the email lands on that org (and contact) — **no new logic**.
- On a miss, the synthetic unresolved org is keyed on the **normalized customer email**: `unresolved-gmail-<customerEmail>` (NOT `<messageId>`). So all unresolved emails from one address **collapse into a single Needs-Linking unit** — an admin links the person once and every past *and* future email from that address resolves (`contact_email_exact`). Without this, each email is its own signal-less unit (the R1/I1 defect).
- **`readSourceEmailForUnit` gains a `gmail` case** that returns the customer email from the unit's representative event (`from` for inbound / `to` for outbound / `payload`) so the Needs-Linking unit shows the email + domain signal (gmail has no source-META row to read, unlike rfq/order). gmail's source-backfill is `no_source` (an email has no `matchedOrgId` META to stamp — correct).

**Identity decision — DEFER the multi-email/`personId` model (approved):** same-company aliases resolve via `email_domain_exact`; free-mail addresses bind to a Contact on first Needs-Linking, then auto-resolve. The graph self-builds; no `personId`/`ContactIdentity` model in v1.

## 6. Rendering (Customer 360 timeline) — read-mapper only

`toOrganizationTimelineItem` gains a `source:'gmail'`/`kind:'email'` case: `primaryLabel`=subject (fallback "(no subject)"), secondary=`bodySnippet`, icon=direction Material Symbol (inbound `mail`/outbound `send`), resolution-tier badge unchanged. `buildSourceLink` gains `gmail → payload.gmailLink` (`https://mail.google.com/mail/u/0/#search/rfc822msgid:<Message-ID>` — opens the exact message in whoever-clicks's own Gmail). Client-side source chips gain an **"Email"** chip. `isInternalOnly:false` (timeline is admin-only). **v1 = one row per message**, chronological (matches HubSpot); `threadId` stored → future thread-collapse is pure UI, no data change.

## 7. Initial backfill (one-time per mailbox)

On first sync (no watermark) or a re-anchor (§4): `messages.list(q='newer_than:<N>d')` (N config, default 90) — **paginated + resumable** (persist a page cursor so a mid-run timeout resumes, not restarts — R1/M5) → `messages.get(metadata)` → map + emit → capture the mailbox's current `historyId` as the seed watermark → incremental after. Idempotent (deterministic ids).

## 8. Testing (TDD)

**gmail-sync (mock Google client):** direction; external-customer extraction (inbound From / outbound first-external To/Cc/Bcc); skip-all-internal; **dedup key = hash(Message-ID)**, incl. the same email in two mailboxes → one event; missing-Message-ID fallback; **watermark advances only past a contiguous confirmed prefix; a mid-run projection failure leaves the watermark at the last confirmed message**; `historyId`-expiry → resumable re-anchor; backfill pagination/resume. **crm-api:** emit persists comms fields when provided (and `null` when omitted); `ResolveInput.channel:'gmail'`; unresolved gmail collapses to `unresolved-gmail-<email>`; `readSourceEmailForUnit` gmail case returns the customer email; read-mapper `source:'gmail'` render + Email chip. **Frontend:** email-row render + chip filter.

## 9. Non-goals (demand-gated)

Full-body storage; on-demand body fetch; thread-collapse UI; real-time Gmail push (Pub/Sub); `personId`/multi-identity/Contact-merge; auto-org-create; fuzzy/name-match; behavior-score writeback; rep personal inboxes; send/reply-from-CRM; recipient fan-out (one event per external recipient); automatic poison-skip-after-K; no-reply/bulk denylist (add only if role-mailbox noise proves bad).

## 10. Infra / deploy / ops guardrails

- New Lambda `amplify/functions/gmail-sync/`, own `resourceGroupName:'gmail-sync-stack'`, `reservedConcurrentExecutions:1`, ~120s; cron in `Stack.of(gmailSync.lambda)` (no data-stack grant → no cycle).
- Dep: `google-auth-library` + `fetch` to Gmail REST (not full `googleapis`).
- IAM (least privilege): `secretsmanager:GetSecretValue` (SA key ARN); `ssm:GetParameter`/`PutParameter` (`/crm/gmail-sync/watermark/*`); `lambda:InvokeFunction` (crm-api) + `CRM_API_FUNCTION_NAME` env. Plus the R1/I4 credential mitigations (dedicated SA/project, `GetSecretValue` alarm, rotation).
- **Privacy (honest framing — R1/M2):** no email *bodies* in DynamoDB, but the `snippet` is body-*derived* (~first 200 chars) and can contain quoted sensitive content; it lives in `INTELLIGENCE_TABLE`, visible to authenticated admins only. Not "zero body-content" — "no full body."
- `!isSandbox`-gated end-to-end. Runbook: §0 precondition validation; GCP SA/DWD/scope setup; watermark reset; backfill window `N`; poison-mailbox alarm response.
- gmail-sync writes nothing to DynamoDB; crm-api change set is §1.
