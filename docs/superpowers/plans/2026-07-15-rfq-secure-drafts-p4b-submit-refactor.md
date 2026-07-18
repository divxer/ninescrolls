# RFQ Secure Drafts P4b — Idempotent Submission & Draft→Pending Upgrade Plan

> # ⛔ BLOCKED — DO NOT IMPLEMENT THE TASKS BELOW AS WRITTEN
>
> Independent plan review (2026-07-15) found **the original implementation plan is not
> implementable (architectural)**. This BLOCKED document is itself a mergeable historical /
> restructure record — only the superseded tasks must never run. The claims were verified
> against merged `origin/main`. The original draft references a P4a API that does not exist and
> mis-orders the live cutover. **The detailed P4b-1…P4b-4 task plans do not exist yet** — they
> will be written from the revised architecture below and each re-reviewed before any code.
>
> ## Verified corrections (checked against `origin/main`)
>
> 1. **`checkReceipt(deps, receiptId, binding)` now *requires* `binding`** (the #309 review made
>    it mandatory; it dereferences `binding` unconditionally). The plan's "no-binding pre-probe"
>    does not exist — the submit path must canonicalize + compute the binding *before* the single
>    receipt check.
> 2. **`recordReceipt` is a standalone conditional `PutCommand`**, not a transaction-op builder.
>    A new helper must build the receipt as a `TransactWrite` **Put** item; `recordReceipt` cannot
>    be composed into the transaction.
> 3. **Live success response is `200 { success: true, message, referenceNumber, rfqId }`** — not
>    `{ referenceNumber, rfqId }` and not `201`. The receipt (P4a) stores **only the terminal fields**
>    `status`, `rfqId`, `referenceNumber` — not the whole response body. A replay therefore
>    **reconstructs** the identical `200 { success: true, message, referenceNumber, rfqId }` from the
>    stored terminal fields plus the fixed `success: true` + standard confirmation `message`. The
>    smoke test asserts 200 and the reconstructed shape.
> 4. **Do not hardcode "129 tests."** Require the *entire existing `handler.test.ts` suite to pass
>    unchanged* and record the actual count at execution time.
> 5. **Draft-upgrade is authoritative from the submitted payload, and pepper-rotation-safe.** The
>    upgrade must (a) **strongly-consistent read** the draft; (b) verify the request token with
>    `verifyDraftToken(storedHash, token, resolvePepper)` — which selects the pepper by the stored
>    hash's `v<n>` prefix, so a draft signed under an older *still-supported* key still validates;
>    (c) build the *complete* pending RFQ item from the validated formal submission; then (d)
>    conditionally `Update` the draft's `rfqId` under `status = 'draft' AND draftTokenHash = <the
>    exact stored hash just read> AND expiresAt > now`. **Use the stored hash verbatim as the
>    condition value — never a hash recomputed from the request token** (recomputing assumes the
>    current pepper and would wrongly reject a rotated-but-valid draft). On success set
>    `status = 'pending'` + the pending index keys and **remove** `draftTokenHash`, `TTL`, and the
>    draft `GSI1*` index attributes. The draft's stored partial fields are not trusted as the RFQ of record.
>
> ## Blocking architectural fixes folded into the revision
>
> - **Effect dependency order is real and must be preserved:** `org-upsert → (visitor-bridge, CRM-emit) → attachment-move → emails`. Six independent outbox records are wrong — the outbox is a **dependency-ordered state machine** (a stage completes before its dependents are eligible), not a flat fan-out.
> - **Cutover ordering must be frontend-first.** Requiring `X-RFQ-Submit-Key` before P6 sends it 400s **every** live submission — the exact outage class #296 fixed. Order: (a) frontend sends the key (compat, ignored server-side), (b) handler *opt-in* accepts it, (c) only later make it mandatory.
> - **Flag rollback must not duplicate — and a receipt is a durable barrier, not drainable work.** A receipt-bearing retry that falls back to the legacy random-id path creates a duplicate RFQ + duplicate effects. Rollback design must: keep **receipt-aware routing** reachable (a retry always resolves via its receipt), **pause the producer**, let the **dependency-ordered outbox drain**, and **forbid any receipt-carrying retry from taking the random-id path**. Receipts persist as the idempotency record — you cannot "drain" them.
> - **Email promise, stated precisely:** claim-before-send guarantees *at most one automatic send attempt, delivery may be lost, never auto-resent* — it does **not** guarantee SendGrid at-most-once delivery.
> - **Executable design required for:** attachment-move idempotency, `TransactionCanceledException` cause classification, stream poison-record handling, DLQ, retry/backoff, and observability/alarms.
>
> ## Transaction-cancellation decision table (to design in P4b-1)
>
> | Signal | Classification | Response |
> |---|---|---|
> | Receipt exists · binding matches · within 7d | replay | `200`, reconstructed `{success:true, message, referenceNumber, rfqId}` from the stored terminal fields |
> | Receipt exists · binding differs | conflict | `409` idempotency conflict |
> | Receipt exists · `now ≥ replayExpiresAt` | window-expired | stable `409` window-expired |
> | Draft-upgrade condition failed (token / status / expiry) | unavailable | uniform `404 Draft unavailable` |
> | Any other `TransactionCanceledException` cause | ambiguous | **fail closed → `500`** (never a false success) |
>
> The receipt read that disambiguates a cancelled transaction MUST be **strongly consistent**.
>
> ## Revised structure — four phases, split into four PRs (reviewer's conclusion)
>
> - **P4b-1** — receipt-as-transaction-item builder (new helper, not `recordReceipt`) + the atomic submit transaction builder (direct `Put` / draft-upgrade conditional `Update`) + the **dependency-ordered outbox state machine** model. Pure, `fakeDdb`-tested, dark.
> - **P4b-2** — `rfq-outbox-worker` (DynamoDB Streams + Lambda event-source mapping — **not** an EventBridge Pipe), stage-ordered drain, DLQ, retries, alarms, at-most-once email claim. Deployed **dark**.
> - **P4b-3** — frontend sends `X-RFQ-Submit-Key` (compat) + handler **opt-in** accepts the idempotent path; mandatory validation stays OFF; full legacy suite unchanged.
> - **P4b-4** — make the header mandatory, soak, then remove the legacy branch + flag. Rollback = receipt-aware routing + paused producer + drained outbox (receipts persist; they are never "drained").
>
> Review conclusions on the four questions: (1) full RFQ Put/Update + receipt conditional Put + a *minimal* outbox stage in one transaction, ambiguous result resolved by a **strongly-consistent** receipt read; (2) claim-before-send with the precise promise above; (3) **must split** — not one PR; (4) **DynamoDB Streams + Lambda event-source mapping**, not a Pipe.
>
> ---

---

## Historical appendix — original draft (NON-EXECUTABLE, superseded)

The first draft of this plan proposed a two-phase (`RFQ_IDEMPOTENT_SUBMIT`) refactor with a
single `TransactWrite` composing `recordReceipt`, a no-binding `checkReceipt` pre-probe, six
independent (flat) outbox effects, a server-mandatory `X-RFQ-Submit-Key`, and an "instant" flag
rollback. **Every one of those specifics is wrong** for the reasons in the banner above
(non-existent P4a API, broken effect ordering, guaranteed 400-outage on cutover, duplicate-on-
rollback, imprecise email guarantee). Its task list, TDD steps, run commands, sub-skill
directive, and deploy instructions have been **removed** so no agent executes them.

Nothing below this line is an instruction. The authoritative direction is the four-phase
restructure (P4b-1…P4b-4) in the banner; those detailed plans are **not yet written and not yet
reviewed**, and each must pass the same plan-review gate before any code.
