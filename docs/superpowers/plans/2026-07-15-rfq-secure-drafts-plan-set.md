# RFQ Secure Drafts — Plan Set Overview

> Companion to spec [`2026-07-15-rfq-secure-drafts-design.md`](../specs/2026-07-15-rfq-secure-drafts-design.md).
> The spec spans five subsystems, so per the writing-plans scope check it is decomposed
> into six sequenced plans rather than one. Each plan produces working, testable software
> on its own and maps to a step of the spec's **Rollout** section.

## Already built (spec preconditions satisfied)

The spec (line 52) requires resolving the `Probe-Station` frontend/backend enum drift and
introducing a canonical shared contract **before rollout**. That shipped independently on `main`:

- `amplify/lib/rfq/contract.ts` — `RFQ_EQUIPMENT_CATEGORY_VALUES`, `RFQ_ATTACHMENT_MIME_TYPES`, `MAX_RFQ_ATTACHMENTS`, `MAX_RFQ_ATTACHMENT_SIZE` (PRs #296–#298).
- `amplify/lib/rfq/limits.ts` — `RFQ_FIELD_LIMITS` (name/email/quantity/…), single source of truth for `.max()` on both client and server (#297).
- Attachments via presigned S3 (`temp/rfq/…`), throttling on public routes (#299, #302).
- `submit-rfq/handler.ts` dispatches by an in-body `action` field (e.g. `action: 'getUploadUrl'`); records live at `PK=RFQ#<id>, SK=META` with `GSI1PK=RFQ_STATUS#<status>`.

So the plans below **extend** the existing contract module and single-table model; they do not recreate them.

## Open design decisions (resolve before coding the affected plan)

1. **Draft transport surface** — the spec names REST routes `POST/GET/PATCH /api/rfq/draft`. `submit-rfq` currently dispatches by in-body `action`. Decision: a **dedicated `rfq-draft-api` Lambda** with its own routes (cleaner isolation of the three-credential security boundary and per-route rate limits) rather than more in-body actions on `submit-rfq`. (Plan D.)
2. **Pepper storage** — AWS Secrets Manager secret `rfq-draft-pepper` with versioned keys; stored hashes carry a `v<n>:` prefix selecting the verification key. (Plan A.)
3. **Rate limiting** — API Gateway usage plan + WAF rate rule for the two credential headers, plus application-level conditional counters as defense in depth. (Plan A/D.)

## The six plans

| Plan | Rollout step | Scope | Depends on |
|------|--------------|-------|-----------|
| **P1 — Contract & credential core** | 1 (partial) | Pure, unit-testable foundation: extend the shared contract with the draft field whitelist + Zod schema; credential library (base64url codec, HKDF token derivation, SHA-256 non-enumerable ID, versioned peppered HMAC hash + constant-time verify). No AWS, no HTTP. | contract.ts, limits.ts |
| **P2 — Draft data model & storage** | 1 | Single-table draft item (`status=draft`, `draftTokenHash`, `draftVersion`, `lastActivityAt`/`expiresAt`/`TTL`, `GSI1PK=RFQ_STATUS#draft`); storage helpers: conditional create (idempotent on nonce), optimistic-concurrency update, whitelisted read. Missing, expired, deleted, submitted, and unauthenticated records converge on a typed `DraftUnavailable` storage result; P3 alone maps it to the non-disclosing HTTP response. | P1 |
| **P3 — Public draft API** | 4 | `rfq-draft-api` Lambda: `POST /api/rfq/draft`, `GET/PATCH /api/rfq/draft/<rfqId>`; header credential parsing, cache/referrer/CORS headers, per-IP counters, credential redaction; wiring + IAM + rate-limit infra. | P2 |
| **P4 — Idempotent submission & draft→pending upgrade** | 2 | Submit receipt (`SUBMIT_RECEIPT#…`) + transactional outbox; refactor `submit-rfq` direct path to the conditional receipt/outbox transaction; `POST /api/rfq` accepts optional `rfqId`+`draftToken` to upgrade a draft in place; outbox workers (org/CRM/visitor/attachment) idempotent; at-most-once email with claim. | P2; existing submit-rfq |
| **P5 — Admin drafts + scheduled cleanup** | 3, 6 | Cognito groups `RFQDraftViewer`/`RFQDraftManager`; `listRfqDrafts`/`getRfqDraft`/`deleteRfqDraft` order-api resolvers (group-claim gated); existing `listRfqs/getRfq` reject `status=draft`; audit log; admin "Unsubmitted drafts" view; daily conditional-delete cleanup over `GSI1 RFQ_STATUS#draft` with checkpoint/DLQ/alarms. | P2 |
| **P6 — Frontend autosave** | 5 | Step-2 draft create; debounced serialized PATCH; sessionStorage-only credentials; submission fence; conflict merge; save-status UI; privacy copy. Feature-flagged. | P3, P4 |

Sequencing follows the spec's rollout: **P1 → P2 → P4 (submission idempotency, dark) → P5 (admin/cleanup, observe-only) → P3 (public draft endpoints) → P6 (autosave, flagged) → enable deletion.** P1 and P2 are pure prerequisites; the higher-risk public + submission-refactor work comes after the model and idempotency are proven.

## Detailed plans

- **P1** — [`2026-07-15-rfq-secure-drafts-p1-contract-and-crypto.md`](2026-07-15-rfq-secure-drafts-p1-contract-and-crypto.md) *(written)*
- P2–P6 — to be written after P1 review.
