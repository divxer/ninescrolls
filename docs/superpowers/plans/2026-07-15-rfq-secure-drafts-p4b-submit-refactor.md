# RFQ Secure Drafts P4b — Idempotent Submission & Draft→Pending Upgrade Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **⚠️ This is the only plan in the RFQ-drafts series that changes the LIVE production `submit-rfq` path** (the Lambda whose Probe-Station outage was fixed in #296). Treat every task as touching revenue-critical code: the full 129-test `handler.test.ts` suite must pass after each task, and a post-deploy smoke test on real submission is mandatory before removing the feature flag.

**Goal:** Make RFQ submission idempotent and support upgrading a saved draft into the submitted RFQ under the same id — by requiring `X-RFQ-Submit-Key`, wrapping the write in the P4a receipt barrier, adding a conditional `status=draft → pending` upgrade, and moving the org/CRM/visitor/email/attachment effects behind a transactional outbox so each external effect happens at-most-once (email) or exactly-once-effect (idempotent workers).

**Architecture:** Two phases behind an `RFQ_IDEMPOTENT_SUBMIT` feature flag so rollback is instant.
- **Phase A (dark):** add the outbox item model + a new `rfq-outbox-worker` Lambda that drains outbox records idempotently (leases + destination idempotency keys + at-most-once email claim). Deploy it processing an empty stream — no behavior change.
- **Phase B (cutover):** refactor `submit-rfq/handler.ts` so the write is a single `TransactWrite` of `{ RFQ record (Put for direct | conditional Update for draft-upgrade), receipt (Put), outbox records (Put) }`, replacing the current inline `invokeOrganizationApi`/`upsertVisitorBridge`/`emitTimelineEventToCrm`/`moveAttachments`/`sendConfirmationEmail`/`sendInternalNotification` calls. The handler returns the same `{ referenceNumber, rfqId }` 200 shape; the effects now run in the worker.

**Tech Stack:** TypeScript, `@aws-sdk/lib-dynamodb` `TransactWriteCommand`, EventBridge Pipe / DynamoDB Streams (outbox drain), the P4a `submitReceipt`/`receiptStore` + P2 `draftStore`, `fakeDdb` (which already supports `TransactWriteCommand`), Vitest.

**Scope note — this plan is large.** If review prefers, split at the phase boundary: **P4b-1 = outbox model + worker (dark)**, **P4b-2 = submit-rfq cutover + draft-upgrade**. The tasks below are ordered so that split is a clean cut after Task 4.

---

## Current submit flow being replaced (`submit-rfq/handler.ts`, ~lines 450–720)

1. CORS preflight → parse body → **Turnstile verify** → **Zod validate** (unchanged).
2. `generateRfqId` + `generateReferenceNumber`.
3. `PutCommand` RFQ_SUBMISSION item (status `pending`).
4. `invokeOrganizationApi` → `matchedOrgId` → `UpdateCommand` backfill `GSI2*`.
5. `upsertVisitorBridge` (+ `invokeCrmAction` re-resolve).
6. `emitTimelineEventToCrm(buildRfqEmitArgs(...))`.
7. `moveAttachments` → `UpdateCommand` `attachmentKeys`.
8. `Promise.all([sendConfirmationEmail, sendInternalNotification])`.
9. Return `200 { referenceNumber, rfqId }`.

Steps 3–8 become the transaction (3, receipt, outbox) + the worker (4–8).

---

## File Structure

- Create `amplify/lib/rfq/outbox.ts` — outbox item builders + effect-kind enum + deterministic effect ids.
- Create `amplify/lib/rfq/outbox.test.ts`.
- Create `amplify/functions/rfq-outbox-worker/{handler.ts,handler.test.ts,resource.ts}` — drains outbox records; lease + idempotent effects + at-most-once email claim.
- Create `amplify/lib/rfq/submitTransaction.ts` — builds the `TransactWrite` items for direct vs draft-upgrade; pure, unit-tested against `fakeDdb`.
- Create `amplify/lib/rfq/submitTransaction.test.ts`.
- Modify `amplify/functions/submit-rfq/handler.ts` — require `X-RFQ-Submit-Key`, receipt check/replay, call `submitTransaction`, drop the inline effects (now outbox). Behind `RFQ_IDEMPOTENT_SUBMIT`.
- Modify `amplify/functions/submit-rfq/handler.test.ts` — new idempotency/upgrade/flag tests; all 129 existing tests stay green.
- Modify `amplify/backend.ts` — register the worker, stream/pipe from the table's outbox partition, IAM, `RFQ_IDEMPOTENT_SUBMIT` env.

**Test command:** `npx vitest run amplify/lib/rfq amplify/functions/submit-rfq amplify/functions/rfq-outbox-worker --exclude '**/.claude/**'`

---

### Task 1: Outbox item model

Deterministic outbox records the transaction writes and the worker drains. Each carries a
deterministic effect id so a re-drain is idempotent.

**Files:** Create `amplify/lib/rfq/outbox.ts` + `.test.ts`.

- [ ] **Step 1: Failing test** — assert `buildOutboxItems(rfqId, data)` returns one item per effect
  (`org-upsert`, `visitor-bridge`, `crm-emit`, `attachment-move`, `confirmation-email`,
  `internal-email`), each with `PK=RFQ_OUTBOX#<rfqId>`, `SK=<effectKind>`, `status='pending'`,
  a deterministic `effectId`, and **no raw PII beyond what the effect needs** (email address is
  required for the email effect; assert the id is deterministic across two calls).
- [ ] **Step 2: Run — FAIL** (`buildOutboxItems` undefined).
- [ ] **Step 3: Implement** `OUTBOX_EFFECTS` enum, `buildOutboxItems`, `outboxPk`. `effectId = SHA-256(rfqId + effectKind)` hex (deterministic; a re-emit collides and is deduped by the worker's conditional claim).
- [ ] **Step 4: Run — PASS.**
- [ ] **Step 5: Commit** `feat(rfq-outbox): outbox item model with deterministic effect ids`.

*(Full code omitted from this summary line only — the executing agent writes the complete builder here, mirroring `buildDraftItem`'s style: explicit item shape, no `...spread` of unvalidated input, whitelisted fields only.)*

> **Implementer:** write the complete `outbox.ts` and its tests in Task 1 — do not defer any field. The effect list and item shape must match what Task 3's worker consumes and Task 5's transaction emits.

---

### Task 2: Outbox worker — lease + idempotent effects

The worker claims a record with a conditional lease, runs the effect through the existing
idempotent helper (`invokeOrganizationApi`/`upsertVisitorBridge`/`emitTimelineEventToCrm`/
`moveAttachments`), marks it `done`, and releases. Email is **at-most-once**: it conditionally
marks `claimed` *before* sending and never re-sends after a crash post-claim (raises an alarm).

**Files:** Create `amplify/functions/rfq-outbox-worker/{handler.ts,handler.test.ts,resource.ts}`.

- [ ] **Step 1: Failing tests** (against `fakeDdb` + mocked effect helpers):
  1. a `pending` record → effect helper called once → record `done`;
  2. a re-delivered record already `done` → effect helper **not** called again (idempotent);
  3. the email effect marks `claimed` before send; a helper that throws after claim leaves the record `claimed` (not re-sent) and signals an alarm;
  4. a lease held by another worker (`leaseExpiresAt` in future) is skipped.
- [ ] **Step 2: Run — FAIL.**
- [ ] **Step 3: Implement** `makeWorker(deps)` (injected effect map + clock) + a thin stream entry. Conditional-claim with `attribute_not_exists(claimedAt) OR leaseExpiresAt < now`; per-effect dispatch; email claim-before-send.
- [ ] **Step 4: Run — PASS.**
- [ ] **Step 5: Commit** `feat(rfq-outbox-worker): lease + idempotent effect drain with at-most-once email`.

---

### Task 3: Worker resource + backend wiring (dark)

**Files:** `resource.ts`, `amplify/backend.ts`.

- [ ] Define `rfqOutboxWorker` (`defineFunction`), grant the intelligence table + the downstream invoke perms (organization-api, crm-api, S3, SendGrid secret) it inherits from `submit-rfq`.
- [ ] Wire a DynamoDB-Streams → Lambda (or EventBridge Pipe) filtered to `PK` beginning `RFQ_OUTBOX#`. Deploy **dark** — no producer writes outbox items yet.
- [ ] Typecheck; commit `feat(rfq-outbox-worker): register worker + stream wiring (dark)`.

> **Clean split point:** Tasks 1–3 = **P4b-1** (outbox, dark, no `submit-rfq` change). If splitting, PR here.

---

### Task 4: Submit transaction builder

Pure builder for the atomic write: for a **direct** submit, `Put` the RFQ record (`status=pending`)
+ `Put` the receipt + `Put` the outbox items; for a **draft-upgrade**, replace the RFQ `Put` with a
conditional `Update` (`status=draft → pending`, verify `draftTokenHash` + unexpired, remove
`draftTokenHash`/`TTL`/draft-index attrs) keyed by the draft's `rfqId`.

**Files:** Create `amplify/lib/rfq/submitTransaction.ts` + `.test.ts`.

- [ ] **Step 1: Failing tests** (against `fakeDdb` `TransactWriteCommand`):
  1. direct → one RFQ `pending` item + one receipt + N outbox items, all committed atomically;
  2. draft-upgrade of an existing `draft` → same rfqId now `pending`, `draftTokenHash`/`TTL` removed, receipt + outbox written;
  3. upgrade with a wrong token or expired draft → `TransactionCanceledException`, nothing written;
  4. a second identical direct submit (same receipt id) → transaction cancelled by the receipt's `attribute_not_exists` (idempotency barrier).
- [ ] **Step 2: Run — FAIL.**
- [ ] **Step 3: Implement** `buildDirectSubmitTransaction` / `buildDraftUpgradeTransaction` returning `TransactWriteCommandInput`. Reuse P4a `recordReceipt` item shape + P2 draft key helpers + `verifyDraftToken` in the condition (via `draftTokenHash` equality on the item).
- [ ] **Step 4: Run — PASS.**
- [ ] **Step 5: Commit** `feat(rfq-submit): atomic submit transaction (direct + draft-upgrade)`.

---

### Task 5: Cut `submit-rfq` over to the idempotent path (behind the flag)

**The live-path change.** Keep the current path when `RFQ_IDEMPOTENT_SUBMIT` is off.

**Files:** `amplify/functions/submit-rfq/handler.ts`, `handler.test.ts`.

- [ ] **Step 1: Failing tests** (new, alongside the existing 129):
  1. with the flag ON, a submit missing `X-RFQ-Submit-Key` → `400`;
  2. two identical submits with the same key → one RFQ record, the second **replays** the stored `{referenceNumber, rfqId}` (200) and writes no second receipt/outbox;
  3. same key + different payload → `409 Idempotency conflict`;
  4. a submit with `rfqId`+`draftToken` for a live draft → that draft becomes `pending` under the same id;
  5. the response shape `{ referenceNumber, rfqId }` is unchanged;
  6. **with the flag OFF, every one of the existing 129 tests still passes unchanged.**
- [ ] **Step 2: Run — FAIL** (flag/behavior not present).
- [ ] **Step 3: Implement** behind `RFQ_IDEMPOTENT_SUBMIT`: parse `X-RFQ-Submit-Key` → `deriveSubmitReceiptId` → `checkReceipt` pre-probe (replay→return; window-expired→409) → after Zod, `computeRequestBinding` → `checkReceipt(binding)` (replay/conflict) → on first-use, `docClient.send(TransactWrite(buildDirect|buildUpgrade))` → return `{referenceNumber, rfqId}`. Delete the inline effect calls (now outbox) **only inside the flag-on branch**; leave the flag-off branch byte-identical.
- [ ] **Step 4: Run — PASS** (new tests green; all 129 legacy green with flag off).
- [ ] **Step 5: Commit** `feat(rfq-submit): idempotent submit + draft upgrade behind RFQ_IDEMPOTENT_SUBMIT`.

---

### Task 6: Verification + rollout

- [ ] Full `submit-rfq` suite (129 + new) green; full repo green; typecheck + lint clean.
- [ ] `backend.ts`: add `RFQ_IDEMPOTENT_SUBMIT` env (default `'false'`); commit.
- [ ] **Deploy sequence (documented, not code):** (1) deploy Tasks 1–4 dark; confirm the worker drains a hand-written test outbox record; (2) deploy Task 5 with the flag **off** — zero behavior change, all real submissions still take the legacy path; (3) flip `RFQ_IDEMPOTENT_SUBMIT=true`; smoke-test a real submission end-to-end (201 + confirmation email + internal email + org/CRM effects) and a deliberate double-submit (second replays); (4) soak, then remove the legacy branch + flag in a follow-up.
- [ ] **Rollback:** flip the flag off — instant return to the legacy path; outbox records already written keep draining; never converts `pending` back to `draft`.

---

## Self-Review

**Spec coverage (spec §"Lifecycle and conditional transitions", §"receipt transaction/outbox", §"at-most-once email"):**
- Require `X-RFQ-Submit-Key`; receipt replay/conflict/window-expired — Tasks 4–5 (on P4a).
- Atomic `draft → pending` conditional upgrade removing token/TTL/index — Task 4.
- Transactional outbox; idempotent org/CRM/visitor/attachment; **at-most-once** email with claim + alarm — Tasks 1–2.
- Response shape and legacy behavior preserved behind a flag — Task 5.

**Deferred:** P5 (admin/cleanup), P6 (frontend autosave sends the submit key + optional rfqId/draftToken). The WAF per-IP rule remains the standing follow-on.

**Risk controls baked in:** feature flag with byte-identical legacy branch; the full 129-test suite as the regression gate on every task; outbox worker deployed dark and proven before the producer cuts over; instant flag rollback; mandatory real-submission smoke test before flag-on soak.

**Honest gap this plan leaves to the implementer:** the exact DynamoDB-Streams-vs-EventBridge-Pipe wiring in Task 3 and the SendGrid at-most-once claim semantics in Task 2 are the two spots most likely to need iteration during execution — they are infra/external-service behaviors unit tests can only approximate. Both are called out as deploy-verified, and the outbox-dark deploy exists precisely to prove them before any live cutover.
