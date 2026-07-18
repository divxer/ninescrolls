# RFQ Secure Drafts P4b-1 — Submit Transaction & Dependency-Ordered Outbox Model

> # ⛔ BLOCKED — NOT READY (architectural). DO NOT IMPLEMENT.
>
> Independent plan review (2026-07-15) returned **Not ready to merge — architectural**; the
> flaws were verified. **This document is a superseded draft; its (removed) task list must not
> run.** A correct P4b-1 must be re-designed against the requirements below before any code.
>
> ## Critical redesign requirements
>
> 1. **Outbox must be event-progressable.** Inserting all stage 0–3 items at once dead-ends:
>    a stream-driven worker that skips a higher stage gets no event to re-wake it. Redesign to
>    **create only stage 0 in the submit transaction**, and have **each stage's completion
>    transactionally create the next stage's item(s)** (so a new INSERT/MODIFY event drives
>    progression) — or a single **coordinator/readiness item** advanced per stage.
> 2. **No-attachment path must not deadlock.** If `attachment-move` is omitted, stage-3 emails
>    must still become eligible — use explicit per-item dependencies or write a **completed/no-op
>    attachment outcome** so the "lower stages done" gate resolves.
> 3. **Direct and upgrade must yield an identical authoritative pending RFQ.** The upgrade must
>    remove **all** draft-only attributes — `draftTokenHash`, `TTL`, `draftVersion`,
>    `lastActivityAt`, `expiresAt`, and any draft-only GSI attrs — **and** overwrite/clear every
>    form field to the submitted payload (optional fields the final submit dropped must be
>    removed, not left stale). Direct and upgrade share **one authoritative projection**; a
>    parity test proves the two results are identical except for legitimate creation metadata.
> 4. **P4b-1 owns a typed pending-item builder.** The transaction builders must **not** accept
>    arbitrary `rfqItem`/`pendingAttrs`/`removedDraftAttrs` DynamoDB maps — that punts field
>    whitelisting, indexing, normalization, and protected-field boundaries to the future handler.
>    P4b-1 provides a typed projection the transaction builders call internally.
> 5. **Attachment outcome needs a persistent contract.** Emails depend on the moved/failed
>    attachment result — define where it is stored, how it is versioned, and how the email effect
>    reads it.
>
> ## Important redesign requirements
>
> - Extract a **shared `buildReceiptItem()`** used by both `recordReceipt` and the transaction
>   builder (no 7/90-day semantic drift from a copy).
> - **Fully implement the dynamic `UpdateExpression`**: alias every attribute name, reject
>   `undefined`/protected fields and SET∩REMOVE overlap.
> - Treat `fakeDdb` as a **partial** oracle — it does not check reserved words, missing
>   `TableName`, action/size caps, duplicate item ops, or real concurrency. Note what it cannot prove.
> - Define stable **`ClientRequestToken`** ownership + format for the `TransactWrite`.
> - Outbox item schema must carry the fields **P4b-2** needs: `version`/`hash`, `createdAt`,
>   `TTL`, readiness/stage state, and `lease`/`claim` attributes.
> - Enforce the **100-action / 4 MB-transaction / 400 KB-item** limits in the builders.
> - Tests must cover the **full current formal RFQ field set + all indices** (`GSI1`/`GSI4`),
>   shipping + referrer fields, optional-field removal, and **direct⇄upgrade parity**.
> - Every task must have **complete code + runnable tests** (writing-plans rule) — no prose
>   placeholders.
>
> Confirmed still sound: dark scope, receipt 7/90-day time semantics, stored-hash upgrade
> condition (pepper-rotation-safe), atomic target transactions.
>
> ---
> _Historical architecture notes below (non-executable). The task list and all execution
> directives were removed._

First phase of the re-split P4b (see the blocked P4b record, merged #310). Intended to be pure, `fakeDdb`-tested, and dark. **Superseded — see the blocked banner above; do not implement.**

**Goal:** Provide the pure building blocks for idempotent submission — a receipt-as-transaction-item builder, the atomic **direct** and **draft-upgrade** submit-transaction builders (single `TransactWrite` each), and the **dependency-ordered outbox** item model — all as functions returning DynamoDB command inputs, unit-tested by executing them against `fakeDdb`.

**Architecture (grounded in merged source, re-read 2026-07-15 — not from memory):**
- Receipt item shape = `receiptStore.ts` (`PK=<SUBMIT_RECEIPT#…>, SK=META`, `opKind`, `binding`, `rfqId`, `referenceNumber`, `status`, `createdAt`, `replayExpiresAt`, `TTL`). `recordReceipt` is a standalone `PutCommand` and **cannot** be composed into a transaction, so P4b-1 adds `buildReceiptPut` returning a `{ Put: … }` transaction item with the same shape + `attribute_not_exists(PK)`.
- RFQ pending item shape = `submit-rfq/handler.ts` (`PK=RFQ#<rfqId>, SK=META`, `GSI1PK=RFQ_STATUS#pending`, `GSI1SK=<submittedAt>#<rfqId>`, `GSI4PK=EMAIL#<normalizedEmail>`, `GSI4SK=RFQ#<submittedAt>`, `status='pending'`, `submittedAt`, `ipHash`, `visitorId`, + form fields). The builders **take the already-constructed RFQ item / pending attributes as input** — they do not re-derive field mapping (the handler owns that in P4b-3).
- Draft item shape = `draftStore.ts` (`status='draft'`, `draftTokenHash`, `draftVersion`, `expiresAt`, `TTL`, `GSI1PK=RFQ_STATUS#draft`). The upgrade condition uses the **stored, version-verified** `draftTokenHash` verbatim (pepper-rotation-safe — see the P4b blocked record).
- `fakeDdb` (merged) supports `attribute_not_exists`, `f = :v`, `f < :v`, `f > :v` (string + number), `SET`/`ADD`/`REMOVE`, and `TransactWriteCommand` — everything these builders need. ISO timestamps compare lexicographically = chronologically, so `expiresAt > :now` is correct.

**Tech Stack:** TypeScript, `@aws-sdk/lib-dynamodb` `TransactWriteCommand`, `fakeDdb`, Vitest.

---

## Outbox dependency ordering (the state machine this models)

The live handler's effects have a real order the flat design broke. P4b-1 encodes it as a
per-item `stage`; P4b-2's worker runs a stage only after every lower stage is `done`:

| stage | effect(s) | depends on |
|------|-----------|-----------|
| 0 | `org-upsert` | — |
| 1 | `visitor-bridge`, `crm-emit` | stage 0 (needs `matchedOrgId`) |
| 2 | `attachment-move` | stage 1 |
| 3 | `confirmation-email`, `internal-email` | stage 2 (emails reference moved attachments) |

Each outbox item: `PK=RFQ_OUTBOX#<rfqId>`, `SK=<effectKind>`, `effectId` (deterministic), `stage`,
`status='pending'`, and only the minimal data that effect needs. P4b-1 builds the items; the
worker (P4b-2) enforces the stage gate and idempotent execution.

