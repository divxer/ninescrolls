# RFQ Secure Drafts and Unsubmitted Lead Management Design

## Purpose

Preserve useful RFQ information after a customer reaches Step 2, make unfinished inquiries visible to authorized administrators, and upgrade a draft into the submitted RFQ under the same ID. This design complements `2026-07-15-rfq-turnstile-recovery-design.md`; CAPTCHA remains mandatory for formal submission but is not required to save a draft.

## Definitions

- Persisted RFQ states include `draft` and the existing formal states such as `pending`, `declined`, and `converted`.
- `abandoned` is a presentation classification, not a persisted state. A draft is displayed as abandoned when `lastActivityAt` is more than 24 hours old.
- A draft expires 30 days after its last valid content change.
- Drafts are not submitted inquiries and must never be represented as customer consent to receive marketing outreach.

## Workflow 1: Data Model and Lifecycle

### Record shape

Drafts use the existing `PK=RFQ#<rfqId>, SK=META` record and carry:

- `rfqId`: cryptographically non-enumerable identifier.
- `referenceNumber`: optional until formal submission; no customer-facing confirmation is shown for a draft.
- `status`: exactly `draft` before submission.
- `createdAt`: server-generated ISO timestamp, immutable.
- `lastActivityAt`: server-generated ISO timestamp, updated only after a validated field value actually changes.
- `expiresAt`: server-generated ISO timestamp equal to `lastActivityAt + 30 days`.
- `TTL`: server-generated epoch seconds matching `expiresAt`.
- `draftTokenHash`: versioned HMAC-SHA-256 of the fixed 32-byte token using a service-side verification pepper.
- `draftVersion`: monotonic integer used for optimistic concurrency.
- `GSI1PK=RFQ_STATUS#draft`, `GSI1SK=<lastActivityAt>#<rfqId>` for both the administrator draft list and expiry cleanup. Because `expiresAt` is exactly 30 days after `lastActivityAt`, cleanup queries this partition with `GSI1SK < <now-minus-30-days>#\uffff`; it does not need a new index or a table scan.

### Exact draft field whitelist

Only these customer fields may be persisted before submission:

| Field | Validation and normalization |
|---|---|
| `name` | trim; 2–100 characters |
| `email` | Unicode NFC normalization, trim, lowercase for indexing; valid email; maximum 254 characters |
| `phone` | trim; optional; 7–30 characters; existing phone pattern |
| `institution` | trim; 2–200 characters |
| `department` | trim; optional; maximum 200 characters |
| `role` | optional; existing RFQ role enum |
| `equipmentCategory` | existing equipment-category enum |
| `specificModel` | trim; optional; maximum 100 characters |
| `applicationDescription` | trim; 10–3000 characters |
| `quantity` | integer from 1 through 100 |
| `budgetRange` | optional; existing budget enum |
| `timeline` | optional; existing timeline enum |
| `fundingStatus` | optional; existing funding-status enum |
| `needsBudgetaryQuote` | optional boolean; shipping data is not saved in the draft |

The draft schema rejects unknown keys. Optional strings sent as empty after NFC normalization and trimming mean `REMOVE`; required strings may not be removed. Partial updates run both field validation and all affected cross-field rules. Email changes atomically replace the normalized email index value. Booleans are accepted only as JSON booleans. A canonical `shared/rfq-contract.ts` owns enums, limits, normalization, and update semantics for frontend and backend; contract tests require schema parity and resolve the current `Probe-Station` frontend/backend enum drift before rollout.

The draft never stores CAPTCHA tokens, `draftToken`, create/submit idempotency material, visitor or behavior analytics, IP addresses/hashes, referrer attribution, shipping address, key specifications, existing-equipment free text, additional comments, attachments, or attachment keys.

### Lifecycle and conditional transitions

- Entering Step 2 initiates idempotent draft creation.
- Valid updates use optimistic concurrency through `draftVersion`; a stale version returns the current version without overwriting newer content.
- A no-op update does not modify `lastActivityAt`, `expiresAt`, `TTL`, or `draftVersion`.
- Formal submission performs a conditional transition that permits only `status=draft → status=pending` while the token is valid and the draft is unexpired.
- The transition removes `draftTokenHash`, `TTL`, and draft-expiry index attributes atomically and replaces the draft list keys with the normal pending RFQ keys.
- The complete formal submission payload is authoritative; it need not match the last autosaved `draftVersion`. The conditional transition still verifies `status=draft`, unexpired `expiresAt`, and valid credentials.
- The draft-to-pending DynamoDB transaction also creates a submission receipt and transactional-outbox records. A retry authenticates with the distinct submit idempotency credential and reads the receipt; it never authenticates against the removed draft token or by RFQ ID alone. Successful-result replay is guaranteed for seven days from the transaction commit.
- Organization upsert, visitor linking, CRM emission, and attachment movement are idempotent effects. Their workers use leases and destination idempotency keys; attachment movement checks the deterministic destination before deleting a source. CRM retains deterministic event IDs.
- Confirmation and internal email are explicitly **at-most-once with possible loss** because SendGrid does not provide the required idempotency contract. The worker conditionally marks each email claimed before sending. A crash after claim raises an alarm and requires an operator to inspect delivery state; automation never sends that email a second time. The UI must not promise that confirmation email was sent unless the completed email effect proves it.
- During the seven-day logical replay window, a repeated submission with the same valid request binding returns the stored receipt response and creates no new outbox records. After that window, the same key returns `409 {"error":"Idempotency window expired"}` and never starts another submission. The specification does not claim exactly-once delivery for external systems.
- Formal submission, expiration cleanup, or manual deletion permanently invalidates the draft token.

## Workflow 2: Public Draft API

### Endpoints

- `POST /api/rfq/draft` creates or returns the idempotent draft.
- `GET /api/rfq/draft/<rfqId>` requires the token and returns only whitelisted fields plus lifecycle metadata needed by the form.
- `PATCH /api/rfq/draft/<rfqId>` requires the token, `draftVersion`, and a partial whitelisted payload.
- Existing `POST /api/rfq` accepts optional `rfqId` and `draftToken`; when provided it upgrades that draft instead of inserting a second record.
- No public list endpoint exists. Administrator reads continue through the existing authenticated AppSync/admin path and never accept a customer draft token.

### Three distinct credentials

1. `draftCreateNonce`: a client-generated, base64url-without-padding encoding of exactly 32 random bytes. It is sent in `X-RFQ-Draft-Create-Nonce` and provides deterministic creation only.
2. `draftToken`: a separate fixed 32-byte bearer token deterministically derived with HKDF-SHA-256 from the 256-bit nonce and domain string `ninescrolls/rfq-draft-token/v1`. The RFQ ID is independently derived with SHA-256 and domain string `ninescrolls/rfq-draft-id/v1`, then encoded as a non-enumerable identifier. These derivations do not depend on the rotating verification pepper, so an identical create retry always returns the same ID/token. The database stores only a versioned peppered token hash.
3. `submitIdempotencyKey`: a new client-generated, base64url-without-padding encoding of exactly 32 random bytes, created before formal submission and sent in `X-RFQ-Submit-Key`. It authenticates only submission retries and cannot read or update a draft.

Creation uses a conditional put; simultaneous requests using the same nonce converge on the same record. The nonce is itself secret access material and receives the same redaction controls as tokens. Verification-pepper rotation retains old verification keys for at least 30 days plus deployment overlap; stored hash prefixes select the verification key. Compromise rotation invalidates affected live draft tokens and requires customers to recreate drafts rather than silently accepting an old key.

For both draft upgrades and direct no-draft submissions, the submit service derives `SUBMIT_RECEIPT#<SHA-256(domain || submitIdempotencyKey)>`. Before writing, it canonicalizes the validated formal RFQ payload while excluding Turnstile, draft/create/submit credentials, and other intentionally one-time values. It computes a domain-separated SHA-256 binding over the canonical payload, operation kind (`draft-upgrade` or `direct`), and the RFQ ID for an upgrade.

The transaction conditionally creates one receipt containing `rfqId`, reference number, terminal response status, operation kind, the non-reversible request-binding hash, `createdAt`, seven-day `replayExpiresAt`, and 90-day `TTL`. It stores no form PII. On a receipt hit within seven days, the server recomputes and constant-time compares the operation kind/binding before returning the result. Same-key/different-payload, same-key/different-RFQ, and cross-mode reuse return a non-submitting conflict. From day 7 through day 90, the receipt acts as a tombstone and returns the stable idempotency-window-expired response even if DynamoDB has not processed TTL. TTL is cleanup only, never logical expiry. After 90 days the bounded idempotency contract ends; clients must generate a new random key for any new inquiry.

The nonce, draft token, submit key, and their hashes must be excluded from application logs, API Gateway execution/access-log templates, error details, tracing attributes, analytics, URLs, DOM attributes, and emails. Credential-bearing responses set `Cache-Control: no-store` and `Referrer-Policy: no-referrer`. CORS explicitly allows the two named credential headers only from approved origins.

### Token verification and abuse controls

- Store only `v<keyVersion>:<HMAC-SHA-256(pepper, rawToken)>`; decode the token/hash to fixed 32-byte values and compare them with a constant-time primitive.
- Missing records, malformed credentials, bad credentials, expired drafts, deleted drafts, and submitted drafts perform a dummy fixed-length HMAC/constant-time comparison and return the same `404 {"error":"Draft unavailable"}` response.
- Require both `rfqId` and token for public read/update/upgrade.
- Only an authenticated live draft may receive `409 {"error":"Version conflict","draft":<whitelisted-current-fields>,"draftVersion":n}`. A stale update never returns data before authentication.
- Compute all timestamps and expiry values on the server; clients cannot supply them.
- Apply strict JSON content type and body-size limits, exact schemas, per-IP rate limiting, and bounded create/update frequency.
- API Gateway/WAF permits at most 10 draft creates and 120 authenticated draft reads/updates per five-minute window per source IP, with application-level conditional counters as defense in depth. The limits return `429` without extending draft retention; counter items contain no form data and expire after 10 minutes. Load/concurrency tests verify limits and allowed-origin CORS behavior.
- Draft creation does not invoke CRM, organization matching, visitor linking, email, attachment movement, or analytics persistence.
- Secrets/pepper are stored in the platform secret manager and support controlled rotation with an explicit version prefix in stored hashes.

## Workflow 3: Form Autosave and Submission Upgrade

### Creation and local recovery

- After Step 1 validates and the customer enters Step 2, create the draft once.
- Store only `rfqId`, `draftToken`, `draftCreateNonce`, `submitIdempotencyKey`, `draftVersion`, and last locally acknowledged draft payload in `sessionStorage`; never place them in local storage, the URL, DOM attributes, or analytics. Treat same-origin XSS as capable of stealing these values: retain the existing strict sanitization boundary, deploy a restrictive CSP, render no credential values, and prohibit third-party script access to draft state. Cloned-tab behavior is tested and handled as optimistic-concurrency contention, not as independent ownership.
- Reloading the same tab may read the draft using `rfqId + draftToken` and restore whitelisted fields. Closing the tab clears browser-held access material by normal session-storage behavior.
- If creation fails, show a non-blocking “progress could not be saved” status and retry a maximum of two times with bounded exponential backoff. The customer can continue filling and formally submit.

### Updates

- Debounce field changes, serialize PATCH requests, and send only changed whitelisted values. At most one PATCH is in flight.
- Retry a failed autosave at most two times with bounded exponential backoff and jitter; retries do not block typing, navigation within the form, Turnstile, or formal submission.
- Only a successful server response advances the locally acknowledged payload/version.
- Version conflicts fetch the current draft, merge only fields unchanged locally since the last acknowledgement, and never silently overwrite newer user input.
- Polling, visibility events, page presence, empty patches, and validation failures never extend retention.
- Surface a compact save status (`Saving`, `Progress saved`, or `Unable to save progress`) without claiming that the inquiry was submitted.

### Formal submission

- Starting formal submission increments an autosave generation, cancels debounce/retry timers, aborts requests that have not reached the server, prevents new PATCH scheduling, and waits for the sole already-in-flight PATCH to settle. Stale autosave responses are ignored. No autosave may execute after the submission fence.
- Send the complete formal RFQ payload, Turnstile token, `rfqId`, and `draftToken` directly in the request body over TLS. Sensitive credentials are redacted before any logging.
- The server validates CAPTCHA and the complete formal RFQ schema before the conditional draft upgrade.
- On success, clear all RFQ draft material from `sessionStorage` and show the existing confirmation/reference number.
- If no draft was ever created, the direct submission path still requires `X-RFQ-Submit-Key` and uses the same conditional receipt/outbox transaction; it does not preserve the current random-ID/unconditional-Put behavior.

### Privacy notice

Step 2 displays: “To preserve your progress and help us process unfinished quote requests, the information listed here may be stored securely for up to 30 days. An unfinished draft is not a submitted quote request.” The privacy policy describes the same purpose, retention period, deletion behavior, access controls, and contact method for privacy requests.

## Workflow 4: Administrator Experience and Cleanup Governance

### Administrator semantics and permissions

- Add a distinct “Unsubmitted drafts” view/filter; exclude drafts from the default formal RFQ list.
- Label every draft “Not submitted”. Display “Abandoned” only when `lastActivityAt < now - 24 hours`.
- Drafts are excluded by default from RFQ counts, conversion rate, response SLA, sales funnel, organization lead score, timeline, and notifications. Reports may include them only through an explicit draft-specific selection.
- Create dedicated Cognito groups `RFQDraftViewer` and `RFQDraftManager`. `RFQDraftViewer` may list/read drafts; `RFQDraftManager` additionally may manually delete them. Separate `listRfqDrafts`, `getRfqDraft`, and `deleteRfqDraft` AppSync operations verify the `cognito:groups` claim inside the order-api Lambda before any DynamoDB access. Existing `listRfqs/getRfq` explicitly reject `status=draft` and never return a draft. Unauthorized signed-in identities receive the same authorization error as unauthenticated callers. Resolver and integration tests cover users with no group, each group, and forged arguments.
- Record administrator view and manual-delete actions in an audit log containing actor, action, RFQ ID, and timestamp; never copy form fields or token material into audit entries.
- Audit items use `PK=RFQ_DRAFT_AUDIT#<rfqId>, SK=<timestamp>#<eventId>` with `actorSub`, `actorGroups`, `action` (`view` or `delete`), and request ID only. Audit retention follows the approved security-log policy and is independent of draft PII deletion because it contains no form fields.
- UI copy warns that a draft is not an explicit inquiry and should not be used for direct marketing outreach without a separately documented lawful basis/consent.

### Hard deletion

- A daily scheduled cleanup queries `GSI1` partition `RFQ_STATUS#draft` with query cutoff `lastActivityCutoff = passStartTime - 30 days`; it never scans the intelligence table. It atomically checkpoints `{lastActivityCutoff, LastEvaluatedKey}` and holds that cutoff immutable across every continuation invocation. It paginates until `LastEvaluatedKey` is absent or the invocation safety budget is reached.
- Each base-table delete is conditional on `status=draft AND expiresAt < now` and on the queried `draftVersion/lastActivityAt`, preventing deletion after an update or upgrade. A TTL race that yields not-found counts as success.
- Throttled/failed pages use bounded retries and then a DLQ/repair cursor. Capacity and remaining-time guards checkpoint safely. After reaching the end, a fresh first-page existence query using the same immutable cutoff detects eventually propagated/stale candidates. If any exist, the job discards the old LEK and performs another full pass with the same cutoff. Only a full fixed-cutoff pass followed by an empty existence query advances the completion watermark and discards the checkpoint; the next daily run then starts from the beginning with a newly computed cutoff. A nonzero backlog after the daily completion window alarms.
- Associated draft-only audit references must not retain copied PII. There are no draft attachments or downstream CRM records to clean.
- DynamoDB TTL is a secondary safety net, not the timeliness mechanism.
- The scheduled job emits attempted, deleted, condition-skipped, failed, and latency metrics. Any failures or a nonzero stale-draft backlog after the run trigger an operational alarm.
- Manual deletion uses the same conditional deletion service and invalidates the customer token immediately.

## Testing and Acceptance Criteria

### Data model and API

- Concurrent identical create requests return the same RFQ ID and token and leave one record.
- Creation remains idempotent across verification-pepper rotation; compromised-key invalidation follows the documented recreate path.
- Token output is 256 bits; storage contains only a versioned peppered hash; comparisons use the constant-time verifier.
- Unknown/unapproved fields are rejected and absent from DynamoDB.
- Unauthorized read/update attempts reveal neither existence nor status.
- No-op and invalid updates do not change activity or expiry.
- Stale-version updates cannot overwrite newer values.
- Only an unexpired authenticated draft can transition to pending.
- Submission retries return the existing result and each external side effect occurs at most once.
- Receipt tests cover same-key/different-payload, same-key/different-RFQ, cross-mode reuse, day-7 logical expiry, lingering TTL records, and day-90 bounded-contract cleanup.
- Direct no-draft submissions are idempotent under concurrent calls and response loss.
- Tests cover worker crashes before/after claim and destination calls, proving the documented lease/idempotency behavior and the explicit possible-loss semantics for email.
- API tests cover credential length/encoding, dummy constant-time verification paths, exact non-disclosing errors, CORS headers, cache headers, rate-limit concurrency, and controlled log/tracing redaction.

### Frontend

- Draft creation begins only after valid Step 1 → Step 2 transition.
- Autosave and recovery preserve only whitelisted fields and never block editing or submission.
- Tests cover out-of-order responses, cloned-tab version conflicts, unmount, submission fencing, and aborted/scheduled retries.
- Two failed retries produce a non-blocking failure status.
- Successful submission clears session credentials; retry, expiration, and CAPTCHA failures preserve form content.
- UI and privacy policy contain the approved retention/non-submission explanation.

### Administrator and cleanup

- Drafts are visibly distinct, role-restricted, and excluded from formal metrics by default.
- Abandoned classification changes after 24 hours without persisting a second state.
- Cleanup queries the expiry access path, conditionally deletes only expired drafts, and reports metrics/alarms.
- Automated tests prove a concurrently upgraded pending RFQ cannot be deleted by cleanup.
- Cleanup tests cover multi-page traversal, continuation cursors, throttling/DLQ repair, stale GSI entries, TTL races, capacity/time checkpoints, and post-run backlog measurement.
- Contract tests prove frontend/backend enum parity and canonical normalization/removal semantics.

## Rollout

1. Add the canonical contract, draft/receipt/outbox/audit item schemas, Cognito groups, secret versions, IAM grants, rate-limit infrastructure, schedules, DLQ, metrics, and alarms. Existing submission remains active.
2. Deploy outbox workers first in dark mode, then refactor the existing direct submission path to the idempotent receipt/outbox transaction. Verify compatibility before enabling draft creation.
3. Deploy separate role-restricted administrator draft resolvers and cleanup in observe-only mode; assign least-privilege groups and validate audit records.
4. Deploy public draft endpoints with rate limiting and monitoring; validate concurrency, secret-version verification, and redaction in production logs.
5. Deploy frontend autosave behind a feature flag and monitor create/update/conflict/error rates. Then enable the administrator draft view after privacy copy approval.
6. Enable conditional deletion only after an observe-only cleanup run matches expected candidates. Remove the feature flag after cleanup and submission idempotency complete an operational soak period.

Rollback disables new draft creation/autosave first, while public read/update and idempotent submission receipts remain available until all live drafts expire. Rollback never converts `pending` back to `draft`, removes a verification key still referenced by live hashes, disables cleanup without an equivalent deletion path, or restores inline side effects alongside active outbox workers.
