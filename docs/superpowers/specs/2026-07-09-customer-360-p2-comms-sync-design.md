# Customer 360 — P2 Comms Sync (email conversation history) Design Spec

**Status:** Design approved in principle 2026-07-09; revised after design reviews **R1 / R2 / R3 / R4 / R5**. §0 precondition **RESOLVED** (single `info@` mailbox). R5: the link mutation is now **server-derived from `representativeEventId`** (no client-named partitions — closes the crafted-`unitKey` hole), own `gmailSyncState` module with **exact lease operations** (token+expiry on every write; CCFE ⇒ ownership lost ⇒ abort), completed literal contracts (ResolveInput / StoredTimelineEvent / mapper output / GraphQL / fallback-link behavior), repair-marker schema + strict status-update-XOR-delete ordering, corrected write-ownership wording, and pinned IAM (`ForAllValues:StringLike` LeadingKeys on the table ARN + synth verification). Branch `feature/customer-360-p2-comms-sync` off `origin/main`.

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
6. **`linkStructuredUnit` link contract — pass the real `unitKey` (review R3/blocker-1).** Today the mutation *reconstructs* the synthetic partition as `unresolved-${sourceType}-${sourceEntityId}`; that only works when the partition key == sourceEntityId (rfq/lead/order). gmail collapses by `customerEmail`, so reconstruction would query a **nonexistent** `unresolved-gmail-<Message-ID>` partition → move nothing → no Contact. Fix — **the server derives the unit, the client never names a partition (review R5 — client-supplied `unitKey` was insecure: syntax checks prove partition membership, not that the caller was shown that unit).** The mutation contract becomes `linkStructuredUnit({ representativeEventId, targetOrgId })`:
   - `NeedsLinkingItem` gains **`representativeEventId`** (the queue already selects a representative event per unit — expose its id).
   - The server `Get`s `TLEVENT#<representativeEventId>`, **requires `resolutionStatus='unresolved'`**, and derives everything from the **stored** event: `unitKey = event.orgId` (the synthetic partition), `sourceType = event.source`, `sourceEntityId = event.sourceEntityId` (for enrichment/backfill routing). A caller can only drain a partition for which they can name a real, currently-unresolved member event — no client-composed partition strings exist anywhere in the contract.
   - The per-event conditional move (`resolutionStatus='unresolved' AND orgId=<derived unitKey>`) stays as **defense in depth**; every link still writes an immutable `LinkAuditLog` row with the server-derived operator.
   - This applies **uniformly to all unit types** (rfq/lead/order/quote/logistics/gmail) — one contract, and it is *stricter* than the pre-existing 3B contract (which trusted client-supplied `sourceType`/`sourceEntityId`). **This touches merged 3B (mutation args + handler + queue payload + UI) — enumerated so the plan owns it.**
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
│  • fenced DDB state item        │
│    (GMAIL_SYNC#<mailbox>/STATE, │
│     advance past done records)  │
└──────────────────────────────┘
```

`gmail-sync` emits via crm-api and owns exactly **one** DynamoDB item per mailbox: its sync state. **(Review R4/blocker-2 — the earlier SSM design is replaced.)** SSM has no compare-and-swap and no fencing, and "single-writer via reserved concurrency" is not enforceable across function replacement or stale invocations — so sync state moves to a **single DynamoDB item** `GMAIL_SYNC#<mailbox>` / `SK 'STATE'` on the intelligence table, managed by a **new `gmailSyncState` module inside gmail-sync, PATTERNED after crm-api's `sweepState`** — not imported from it (`sweepState` is crm-api-local and hard-codes `CRM_SWEEP#<mode>#<pass>` keys + its own unions): lease token + `ConditionExpression`-fenced writes, true atomic CAS monotonicity, one crash-safe JSON state (watermark **and** backfill phase together — no cross-parameter atomicity claims), stale writers fenced out by token. gmail-sync's grant is **leading-key-scoped** (`dynamodb:LeadingKeys = GMAIL_SYNC#*`) — it can touch nothing else in the table. Otherwise the split mirrors the P2A channel pattern (`CRM_API_FUNCTION_NAME` env + `lambda:InvokeFunction` grant + `resourceGroupName` own stack; cron in `Stack.of(gmailSync.lambda)` → no nested-stack cycle; the state-item grant adds only a gmailSyncStack→feedbackStack edge, same direction every channel Lambda already has — no cycle).

## 3. Access model — service account + domain-wide delegation

- Workspace **service account + DWD** impersonates each role mailbox via signed JWT. No interactive OAuth / consent / token-refresh.
- SA JSON key in **Secrets Manager** `crm/gmail-sync/service-account`; gmail-sync IAM `secretsmanager:GetSecretValue` on that ARN only.
- **Scope `gmail.readonly`**, but every read is `messages.get(format=metadata, metadataHeaders=[From,To,Cc,Bcc,Subject,Date,Message-ID,References,List-Unsubscribe])` → **headers + snippet only, never the body** (`gmail.metadata` scope excludes `snippet`, so `readonly` is required — confirmed).
- **Mailbox (v1): `info@ninescrolls.com` only** (config list of one — see §0; sales@/support@/etc. are aliases delivering into it, so one mailbox captures everything). Kept as a list so rep inboxes can be added later with no auth change.
- **⚠️ Credential blast radius (review R1/I4):** a `gmail.readonly` DWD service account can read **ANY** mailbox in the domain by changing the impersonation subject (CEO/HR/legal) — DWD scoping is all-or-nothing per scope, **not** restrictable to the three role mailboxes. The AWS side is least-privileged, but the secret itself is a whole-domain read key. **Mitigations (required):** a dedicated Workspace project + SA used for nothing else (clean revocation); CloudTrail/CloudWatch alarm on `GetSecretValue` for that ARN; documented key-rotation cadence.
- **Google-side manual setup** (one-time runbook, not code): create the dedicated SA, enable DWD, authorize its client-id for `gmail.readonly` in the Admin console; verify §0 preconditions.

## 4. Sync mechanism — poll history API, durable watermark

- Cron `*/10` (`Stack.of(gmailSync.lambda)`, `!isSandbox`, **`reservedConcurrentExecutions:1`** so a slow run / re-anchor backfill can't overlap a second run — review R1/M1).
- Per mailbox: read the `historyId` watermark from the fenced `GMAIL_SYNC#<mailbox>/STATE` item (§2) → `users.history.list(startHistoryId=watermark, historyTypes=[messageAdded])`, paginate → new message ids (includes **Sent** items → outbound; verify a real Sent item produces a `messageAdded` record during the spike — R1/M4) → `messages.get(format=metadata)` → map.
- **Durability model (review R1/I2 — gmail has NO sweep heal, because it writes no source-of-truth the 2C existence sweep can re-derive):** emit **synchronously** (`invokeCrmApi {sync:true}`) and confirm projection per message. *(Sync invoke is a deliberate, documented deviation from the "sync = tests/debug only" note in `invoke-crm-api.ts` — justified because gmail has no other durability backstop.)*
- **Per-message outcome (review R3):** each message resolves to exactly one of `persisted` (sync projection confirmed) · `terminal_skip(reason)` (never succeeds — `messages.get` 404, or filtered by alias/DRAFT/CHAT/internal) · `retryable_failure` (transient). `persisted` and `terminal_skip` let the checkpoint pass the message; `retryable_failure` blocks it.
- **Checkpoint at HISTORY-RECORD boundaries, not per message (review R3/blocker-3).** `history.list` returns history *records*, each with a `historyId` and possibly **several** `messagesAdded`. A record is done only when **every** message in it is `persisted`/`terminal_skip`. Advance the watermark across the **contiguous prefix of fully-done records**, stopping at the first record holding a `retryable_failure` (so a still-pending sibling in that record is never skipped). On a fully-clean run, commit the response's **top-level `historyId`**. Advancing to one message's position could skip an unprocessed sibling sharing the record.
- **Fenced, atomic, monotonic watermark (review R4/blocker-2 — replaces the SSM design; exact lease operations per R5):** state item `GMAIL_SYNC#<mailbox>/STATE` (§2), via the new `gmailSyncState` module. **Exact operations:**
  - **acquire**: `SET lease=:tok, leaseExpiresAt=:exp, lastRunAt=:now` with `ConditionExpression: attribute_not_exists(lease) OR leaseExpiresAt < :now` → returns the token or null (lease held).
  - **progress / heartbeat / state write**: every write conditions on **BOTH** `lease = :tok AND leaseExpiresAt > :now` (matching fencing token **and** unexpired lease — a token whose lease lapsed must not write even if no one re-acquired yet).
  - **release**: `REMOVE lease, leaseExpiresAt` + final state, conditioned on `lease = :tok`.
  - **Any `ConditionalCheckFailedException` on any of these ⇒ ownership lost ⇒ stop writing and exit the run immediately** (never retry the write, never continue processing) — the next cron re-acquires cleanly.
  A stale writer (old deployment function, manual invoke, expired lease-holder) is fenced by the store, not by ops assumptions. `reservedConcurrentExecutions:1` remains defense-in-depth only. **`historyId` comparisons use decimal `BigInt`** — uint64 exceeds `Number.MAX_SAFE_INTEGER`, and string comparison is lexicographic (`"9" > "10"`); the monotonic guard compares `BigInt(new) > BigInt(stored)` inside the fenced write.
- **Poison message:** a `retryable_failure` persisting across cycles blocks its record's (and the mailbox's) advancement — logged + alarmed after N cycles; auto-`terminal_skip`-after-K is a §9 fast-follow.
- **`startHistoryId` expiry — endpoint-aware detection (review R4):** re-anchor (§7) ONLY when the error comes from **`users.history.list`** AND the parsed Google error body (`error.status` / `errors[].reason` / `details`) matches the expired-history signal (HTTP 404, `status:"NOT_FOUND"` / reason `notFound` **on that endpoint** — Gmail's documented behavior for an out-of-date `startHistoryId`). A 404 from **`messages.get`** is a deleted message → `terminal_skip`; a 400 anywhere is a malformed-request bug to surface loudly, never a silent re-seed. Classification is by *(endpoint, status, reason)* tuple, not status code alone.
- **Central invariant (R2, unchanged):** a mailbox checkpoint advances only after every preceding message is durably persisted (or `terminal_skip`) — never merely dispatched.

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

**Dedup key (review R1/C2 — Gmail message ids are per-mailbox, NOT global):** use the RFC822 **`Message-ID` header** → `tev-gmail-<sha of normalized Message-ID>`. This is stable across mailboxes, so an email cc'ing sales@ **and** info@ dedups to ONE timeline event (the Gmail per-mailbox id would have created two). Missing/blank `Message-ID` (rare) → fall back to a **mailbox-namespaced** id `tev-gmail-<mailbox>-<gmailMsgId>` (the Gmail id is per-mailbox, so the namespace keeps it unique if the same body somehow appears in two mailboxes) + log. The Gmail message id is **not** used as an identity key (the deep-link uses the RFC822 id via `rfc822msgid:` search — §6 — so we never need the Gmail id downstream).

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

**Contact creation must be repair-covered (review R4; schema + ordering pinned per R5):** the Contact created on link is the whole payoff for gmail (future `contact_email_exact` auto-resolution), but `manualMoveTimelineEvent` creates it *best-effort post-move*. Extend the 3C repair machinery:
- **Marker schema delta** (`RepairMarkerItem`, structured markers): `+ customerEmail: string | null` (the unit's normalized customer email, stamped at link time alongside the existing `contactStatus`).
- **Replay ordering** (`replayStructuredSideEffects`, one pass): ① backfill (conditional, unchanged) → ② audit (deterministic id, unchanged) → ③ **contact**: if `contactStatus !== 'linked'` and `customerEmail` present → `upsertContact(customerEmail, targetOrgId, …)` (idempotent, deterministic `contactIdForEmail`); capture the new status. The pass returns per-effect outcomes; the caller then makes **one** decision: **all three done ⇒ `deleteRepairMarker`; otherwise ⇒ a single fenced marker `Update`** persisting the refreshed `contactStatus` (+ `attemptCount`/`lastError` per the 3C matrix). Status-update and delete are **mutually exclusive on the same pass** — never update-then-delete (crash between them would resurrect a stale status), and a crash after ③ but before the marker write is safe because every effect is idempotent on the next pass.
Without this, a failed contact upsert is recorded but never healed, silently breaking future auto-resolution.

**Identity decision — DEFER the multi-email/`personId` model (approved):** same-company aliases resolve via `email_domain_exact`; free-mail addresses bind to a Contact on first Needs-Linking, then auto-resolve. The graph self-builds; no `personId`/`ContactIdentity` model in v1.

**Literal wire contracts (review R4 — normative for the plan):**
```ts
// timelineId.ts — TimelineIdInput union gains:
| { source: 'gmail'; rfc822MessageId: string }            // → `tev-gmail-${sha256(normalize(rfc822MessageId)).slice(0,16)}`
| { source: 'gmail'; mailbox: string; gmailMessageId: string } // fallback when Message-ID header is missing/blank
                                                          // → `tev-gmail-${mailbox}-${gmailMessageId}` (per-mailbox id needs the namespace)

// EmitArgs / CrmEmitPayload — new OPTIONAL fields (absent → buildItem writes null, existing channels untouched):
direction?: 'inbound' | 'outbound';
externalId?: string;        // normalized RFC822 Message-ID (or `${mailbox}:${gmailMessageId}` in fallback)
threadId?: string;          // Gmail threadId
from?: string;              // raw From header value
to?: string;                // raw To header value (comma-joined if several)
subject?: string;
bodySnippet?: string;       // Gmail `snippet`
// payload (gmail): { customerEmail: string /* normalized, non-empty */, gmailLink: string, mailbox: string, cc?: string }

// resolveLinks.ts — ResolveInput (channel union widened; email drives the ladder):
interface ResolveInput {
  sourceEntityType: string; sourceEntityId: string;
  channel: 'analytics'|'lead'|'rfq'|'quote'|'order'|'logistics'|'manual'|'gmail';   // ← 'gmail' added
  matchedOrgId?: string; email?: string;            // gmail passes email = payload.customerEmail
  lockedOrgId?: string; lockedContactId?: string; visitorId?: string;
}

// linkStructuredUnit mutation args (3B contract change — server derives the unit, R5):
{ representativeEventId: string; targetOrgId: string }
// server: Get TLEVENT#<id> → require resolutionStatus==='unresolved' → unitKey=event.orgId,
//         sourceType=event.source, sourceEntityId=event.sourceEntityId. No client-named partitions.

// NeedsLinkingItem (queue payload) gains:
representativeEventId: string;                       // id of the unit's representative event

// StoredTimelineEvent (read-mapper INPUT) gains (all present on TimelineEventItem, exposed to the mapper):
direction: 'inbound'|'outbound'|null; externalId: string|null; threadId: string|null;
from: string|null; to: string|null; subject: string|null; bodySnippet: string|null;

// OrganizationTimelineItem — mapper OUTPUT + GraphQL customType + frontend type all gain (nullable):
direction?: 'inbound'|'outbound'|null;               // a.string() in GraphQL
bodySnippet?: string|null;                           // a.string()
externalUrl?: string|null;                           // a.string() — validated https://mail.google.com origin client-side

// gmailLink construction (payload.gmailLink):
//   with Message-ID:  https://mail.google.com/mail/u/0/#search/rfc822msgid:<encodeURIComponent(normalized Message-ID)>
//   WITHOUT Message-ID (fallback ids): rfc822msgid search is impossible → link the THREAD instead:
//   https://mail.google.com/mail/u/0/#all/<gmail threadId>   (same /u/0 caveat; if threadId is also absent, omit the link → externalUrl:null, row renders without an open action)
```
`normalize(Message-ID)` = trim + strip surrounding `<>` + lowercase — applied identically at emit and anywhere the id is recomputed.

## 6. Rendering (Customer 360 timeline) — full stack, not "mapper only" (review R2)

The `OrganizationTimelineItem` type has **no** email display fields today (verified: it carries per-kind fields like `stageFrom`/`fileName` but no `subject`/`snippet`/`direction`/`externalUrl`), and `GROUP_BY_SOURCE`/`ICON_BY_SOURCE` have no `gmail`. So the render path spans:
1. **GraphQL** (`data/resource.ts` `OrganizationTimelineItem` customType): add `direction: a.string()`, `bodySnippet: a.string()`, `externalUrl: a.string()`.
2. **Mapper** (`organizationTimelineItem.ts`): its **input type `StoredTimelineEvent` must include the comms fields** it reads (`subject`, `bodySnippet`, `direction`, `externalId`, `from`, `to`) — they exist on `TimelineEventItem` but the mapper's input interface must expose them. The `source:'gmail'`/`kind:'email'` case → `primaryLabel`=subject (fallback "(no subject)"), `bodySnippet`, `direction`, `externalUrl`; add `gmail` to `GROUP_BY_SOURCE` (new `'email'` chip group) + `ICON_BY_SOURCE` (direction Material Symbol: inbound `mail` / outbound `send`); resolution-tier badge unchanged.
3. **Frontend** (regenerated Amplify types + the timeline component + `buildSourceLink`): render the email row (subject + snippet + direction icon), add the **Email** source-filter chip, and open `externalUrl` as a **safe external link** — `target="_blank" rel="noopener noreferrer"`, and before rendering **validate the URL origin is exactly `https://mail.google.com`** (defense-in-depth against a malformed stored link).
- **`gmailLink`** is built at emit time as `https://mail.google.com/mail/u/0/#search/rfc822msgid:<encodeURIComponent(Message-ID)>` (the Message-ID is **URL-encoded** — it can contain `@`, `<>`, `+`). ⚠️ `/u/0` opens the **first-signed-in** Google account in the clicker's browser; if that isn't the ninescrolls account the search runs in the wrong account. Documented caveat — acceptable for admin use (they know to be on the ninescrolls login); a future refinement can drop `/u/0` or use an account-agnostic form.

`isInternalOnly:false` (timeline is admin-only). **v1 = one row per message**, chronological (matches HubSpot); `threadId` stored → future thread-collapse is pure UI, no data change.

## 7. Initial backfill (one-time per mailbox)

On first sync (no watermark) or a re-anchor (§4), backfill runs as a **durable, resumable state machine** (review R3/blocker-4 — a page cursor alone loses the pre-seed anchor on timeout):
1. **Capture the anchor, then persist the full backfill state BEFORE the first page.** Read the mailbox's current `historyId` (cheap `getProfile`) and write — into the same fenced `GMAIL_SYNC#<mailbox>/STATE` item (§2/§4, one atomic JSON, no cross-parameter claims) — `{ phase:'backfill', anchorHistoryId, pageToken:null, window:'newer_than:<N>d', configId }`. Capturing the anchor *after* the seed would lose messages arriving *during* it.
2. Page through `messages.list(q=window, pageToken)` → `messages.get(metadata)` → map + emit. **The `pageToken` advances ONLY when every message on that page is `persisted` or `terminal_skip` (review R4/blocker-1)** — any `retryable_failure` on the page ⇒ **retain the input cursor** (the whole page retries next run; idempotent re-emits are no-ops). Advancing past a page with a retryable failure would skip that message *permanently* (backfill pages, unlike incremental history, never come back). A mid-run timeout resumes from the stored `{anchorHistoryId, pageToken}` — the **exact original anchor**, never a re-captured one.
3. When the last page completes cleanly, one fenced write sets `{ phase:'incremental', historyId: anchorHistoryId }` (watermark = the stored anchor, backfill fields cleared — a single-item transition, crash-safe by construction). Incremental then replays anything that landed during the seed (idempotent, deterministic ids) — nothing missed.

## 7b. Edge cases & failure semantics (review R2)

- **Repeated history entries:** `history.list` can return the same message id across pages/runs (and `messageAdded` + a later `messageDeleted` for the same id). The deterministic-id idempotent write makes reprocessing a no-op — never a duplicate row.
- **Deleted / trashed / inaccessible message:** `messages.get` → **404/`notFound`** ⇒ **`terminal_skip('not_found')`** (skip the id, do NOT block the record's checkpoint) + log.
- **Poison message:** a `retryable_failure` that keeps failing ⇒ blocks its record + mailbox advancement (§4); alarmed after N cycles.
- **Pagination failure:** a `history.list`/`messages.list` page error aborts the run without advancing the watermark; next cron resumes (incremental) or from the durable backfill state (§7).
- **Rate limits (429 / `rateLimitExceeded`):** bounded exponential backoff + retry within the invocation; if still limited, end without advancing past the last done record (resume next cron). Not expected at one-mailbox volume — Gmail per-user is 250 quota-units/s (get=5, list=5, history=2).
- **Checkpoint semantics (§4):** the watermark is the `historyId` at the boundary of the **contiguous prefix of fully-done history records** (every message `persisted`/`terminal_skip`) — monotonic, single-writer, advanced only after durable persistence; a clean run commits the response-level top-level `historyId`.

## 8. Testing (TDD)

**gmail-sync (mock Google client):** direction; external-customer extraction (inbound From / outbound first-external To/Cc/Bcc) → durable `payload.customerEmail`; skip-all-internal; **skip `DRAFT`/`CHAT` labelIds**; **destination-alias allowlist** (keep info/sales/support; skip ap/ar/invoice/careers/privacy/harvey; keep-if-any-recipient-is-customer-alias); **dedup key = hash(Message-ID)** (same email in two mailboxes → one event) + **mailbox-namespaced missing-Message-ID fallback**; **occurredAt = internalDate**; **per-message outcome enum** (persisted / terminal_skip / retryable_failure); **record-boundary checkpoint** — a history record with 2 messages where one is `retryable_failure` → watermark stays *before* that record (sibling not skipped); **fenced state writes** — a stale lease-token's write fails the condition (never rewinds); **`BigInt` historyId comparison** (`"9"` vs `"10"` ordering case); **deleted message 404 → `terminal_skip`, checkpoint not blocked**; **endpoint-aware expired-`startHistoryId` detection** (history.list 404/notFound re-anchors; a `messages.get` 404 does not); **backfill durable anchor + page-complete cursor** — timeout mid-seed resumes from the *stored* `anchorHistoryId`+`pageToken`, and **the `pageToken` advances only when every message on the page is persisted/terminal_skip** (a retryable_failure retains the input cursor); rate-limit backoff. **crm-api:** `TimelineIdInput` gmail variant → `tev-gmail-<hash(Message-ID)>`; emit persists comms fields + `payload.customerEmail` when provided (and `null`/absent when omitted — existing channels unaffected); `ResolveInput.channel:'gmail'`; unresolved gmail collapses to `unresolved-gmail-<customerEmail>`; **`linkStructuredUnit` server-derives the unit from `representativeEventId`** (Get stored event → require `resolutionStatus='unresolved'` → unitKey=event.orgId; **rejects** a resolved/missing/voided representative event; a gmail representative drains `unresolved-gmail-<email>`; existing types behavior-identical); **lease-lost abort** — any fenced-write CCFE ⇒ stop processing immediately, no further writes; **repair replay ordering** — retries `upsertContact` when `contactStatus !== 'linked'`, and per pass does EITHER one marker status-update OR the delete (all-three-done), never both; **fallback link behavior** — missing Message-ID ⇒ thread link; missing threadId too ⇒ `externalUrl:null`, row renders without an open action; `readSourceEmailForUnit` gmail case returns `payload.customerEmail`; mapper `source:'gmail'` → `direction`/`bodySnippet`/`externalUrl` + `email` chip group + direction icon. **End-to-end (the R3 blocker-1 path):** unresolved gmail unit in the queue → link mutation with its `representativeEventId` → server derives `unresolved-gmail-<email>` → **all** the customer's events move to the target org → Contact created for `customerEmail` → a *subsequent* email from that address auto-resolves via `contact_email_exact`. **Frontend/schema:** `OrganizationTimelineItem` + the mapper input type expose `direction`/`bodySnippet`/`externalUrl`; email-row render; Email chip; external link `rel="noopener noreferrer"` + origin-validated + URL-encoded Message-ID.

## 9. Non-goals (demand-gated)

Full-body storage; on-demand body fetch; thread-collapse UI; real-time Gmail push (Pub/Sub); `personId`/multi-identity/Contact-merge; auto-org-create; fuzzy/name-match; behavior-score writeback; rep personal inboxes; send/reply-from-CRM; recipient fan-out (one event per external recipient); automatic poison-skip-after-K; no-reply/bulk denylist (add only if role-mailbox noise proves bad).

## 10. Infra / deploy / ops guardrails

- New Lambda `amplify/functions/gmail-sync/`, own `resourceGroupName:'gmail-sync-stack'`, `reservedConcurrentExecutions:1`, ~120s; cron in `Stack.of(gmailSync.lambda)` (no data-stack grant → no cycle).
- Dep: `google-auth-library` + `fetch` to Gmail REST (not full `googleapis`).
- IAM (least privilege, exact shape per review R5): `secretsmanager:GetSecretValue` (SA key ARN); DynamoDB `GetItem`/`PutItem`/`UpdateItem` with **`Resource: <intelligence table ARN>`** (base table only, no `/index/*`) and **`Condition: { "ForAllValues:StringLike": { "dynamodb:LeadingKeys": ["GMAIL_SYNC#*"] } }`**; `lambda:InvokeFunction` (crm-api) + `CRM_API_FUNCTION_NAME` env. **Synth verification required before merge:** inspect the synthesized template to confirm (a) the policy carries the LeadingKeys condition as written, and (b) the table grant introduces only a `gmailSyncStack → feedbackStack` edge (no reverse edge → no nested-stack cycle — the class that broke deploys twice before). Plus the R1/I4 credential mitigations (dedicated SA/project, `GetSecretValue` alarm, rotation).
- **Wire types / nullability (review R3 follow-up — the plan pins these exactly):** `direction:'inbound'|'outbound'|null`; the new `OrganizationTimelineItem` fields `direction`/`bodySnippet`/`externalUrl` are **nullable** (`a.string()`), populated only for `source:'gmail'`; `EmitArgs`/`CrmEmitPayload` comms fields are all **optional** (default `null`); `payload.customerEmail` is a normalized non-empty string on gmail events. No existing field's nullability changes.
- **Privacy (honest framing — R1/M2):** no email *bodies* in DynamoDB, but the `snippet` is body-*derived* (~first 200 chars) and can contain quoted sensitive content; it lives in `INTELLIGENCE_TABLE`, visible to authenticated admins only. Not "zero body-content" — "no full body."
- `!isSandbox`-gated end-to-end. Runbook: §0 precondition validation; GCP SA/DWD/scope setup; watermark reset; backfill window `N`; poison-mailbox alarm response.
- **Write-ownership boundary (corrected per R5):** gmail-sync writes **only its own `GMAIL_SYNC#<mailbox>/STATE` item** (nothing else — enforced by the LeadingKeys condition); **all timeline business data is written by crm-api**. crm-api change set is §1.
