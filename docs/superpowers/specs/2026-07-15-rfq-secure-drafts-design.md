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
- `draftTokenHash`: HMAC-SHA-256 of the 256-bit token using a service-side pepper.
- `draftVersion`: monotonic integer used for optimistic concurrency.
- `GSI1PK=RFQ_STATUS#draft`, `GSI1SK=<lastActivityAt>#<rfqId>` for both the administrator draft list and expiry cleanup. Because `expiresAt` is exactly 30 days after `lastActivityAt`, cleanup queries this partition with `GSI1SK < <now-minus-30-days>#\uffff`; it does not need a new index or a table scan.

### Exact draft field whitelist

Only these customer fields may be persisted before submission:

| Field | Validation and normalization |
|---|---|
| `name` | trim; 2–100 characters |
| `email` | trim, lowercase for indexing; valid email; maximum 254 characters |
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

The draft schema rejects unknown keys. It never stores CAPTCHA tokens, `draftToken`, idempotency material, visitor or behavior analytics, IP addresses/hashes, referrer attribution, shipping address, key specifications, existing-equipment free text, additional comments, attachments, or attachment keys.

### Lifecycle and conditional transitions

- Entering Step 2 initiates idempotent draft creation.
- Valid updates use optimistic concurrency through `draftVersion`; a stale version returns the current version without overwriting newer content.
- A no-op update does not modify `lastActivityAt`, `expiresAt`, `TTL`, or `draftVersion`.
- Formal submission performs a conditional transition that permits only `status=draft → status=pending` while the token is valid and the draft is unexpired.
- The transition removes `draftTokenHash`, `TTL`, and draft-expiry index attributes atomically and replaces the draft list keys with the normal pending RFQ keys.
- A repeated submission of an already-pending record returns the original successful RFQ result and never repeats organization upsert, visitor linking, CRM emission, or emails. The draft-to-pending transaction creates one durable effect-ledger item per downstream action. Workers conditionally claim each effect before execution and mark it complete afterward; claimed-but-incomplete effects raise an operational alarm for manual recovery rather than being executed automatically a second time. CRM events retain their existing deterministic event IDs, and organization/visitor operations retain their existing idempotent keys.
- Formal submission, expiration cleanup, or manual deletion permanently invalidates the draft token.

## Workflow 2: Public Draft API

### Endpoints

- `POST /api/rfq/draft` creates or returns the idempotent draft.
- `GET /api/rfq/draft/<rfqId>` requires the token and returns only whitelisted fields plus lifecycle metadata needed by the form.
- `PATCH /api/rfq/draft/<rfqId>` requires the token, `draftVersion`, and a partial whitelisted payload.
- Existing `POST /api/rfq` accepts optional `rfqId` and `draftToken`; when provided it upgrades that draft instead of inserting a second record.
- No public list endpoint exists. Administrator reads continue through the existing authenticated AppSync/admin path and never accept a customer draft token.

### Idempotent creation

Before the first create request, the browser generates a 256-bit random `draftCreateNonce` and stores it in `sessionStorage`. It is sent only in a dedicated request header, never in a URL or analytics event. The service derives two domain-separated HMAC-SHA-256 values using the server pepper: a non-enumerable RFQ ID and the 256-bit `draftToken`. Therefore an identical retry returns the same ID/token without storing token plaintext. Creation uses a conditional put; simultaneous duplicate requests converge on the same record.

The nonce, derived token, and token hash must be excluded from application logs, API access logs under project control, error details, tracing attributes, analytics, URLs, and emails.

### Token verification and abuse controls

- Store only a service-peppered HMAC-SHA-256 token hash.
- Decode fixed-length values and compare them with a constant-time primitive.
- Require both `rfqId` and token for public read/update/upgrade.
- Reject expired, submitted, and deleted drafts identically so responses do not reveal record state.
- Compute all timestamps and expiry values on the server; clients cannot supply them.
- Apply strict JSON content type and body-size limits, exact schemas, per-IP rate limiting, and bounded create/update frequency.
- Draft creation does not invoke CRM, organization matching, visitor linking, email, attachment movement, or analytics persistence.
- Secrets/pepper are stored in the platform secret manager and support controlled rotation with an explicit version prefix in stored hashes.

## Workflow 3: Form Autosave and Submission Upgrade

### Creation and local recovery

- After Step 1 validates and the customer enters Step 2, create the draft once.
- Store only `rfqId`, `draftToken`, `draftCreateNonce`, `draftVersion`, and last locally acknowledged draft payload in `sessionStorage`; never place them in local storage, the URL, DOM attributes, or analytics.
- Reloading the same tab may read the draft using `rfqId + draftToken` and restore whitelisted fields. Closing the tab clears browser-held access material by normal session-storage behavior.
- If creation fails, show a non-blocking “progress could not be saved” status and retry a maximum of two times with bounded exponential backoff. The customer can continue filling and formally submit.

### Updates

- Debounce field changes and send only changed whitelisted values.
- Retry a failed autosave at most two times with bounded exponential backoff and jitter; retries do not block typing, navigation within the form, Turnstile, or formal submission.
- Only a successful server response advances the locally acknowledged payload/version.
- Version conflicts fetch the current draft, merge only fields unchanged locally since the last acknowledgement, and never silently overwrite newer user input.
- Polling, visibility events, page presence, empty patches, and validation failures never extend retention.
- Surface a compact save status (`Saving`, `Progress saved`, or `Unable to save progress`) without claiming that the inquiry was submitted.

### Formal submission

- Formal submission waits only for an already-running autosave request to settle; it does not wait for scheduled retries.
- Send the complete formal RFQ payload, Turnstile token, `rfqId`, and `draftToken` directly in the request body over TLS. Sensitive credentials are redacted before any logging.
- The server validates CAPTCHA and the complete formal RFQ schema before the conditional draft upgrade.
- On success, clear all RFQ draft material from `sessionStorage` and show the existing confirmation/reference number.
- If no draft was ever created, preserve the existing new-RFQ submission path.

### Privacy notice

Step 2 displays: “To preserve your progress and help us process unfinished quote requests, the information listed here may be stored securely for up to 30 days. An unfinished draft is not a submitted quote request.” The privacy policy describes the same purpose, retention period, deletion behavior, access controls, and contact method for privacy requests.

## Workflow 4: Administrator Experience and Cleanup Governance

### Administrator semantics and permissions

- Add a distinct “Unsubmitted drafts” view/filter; exclude drafts from the default formal RFQ list.
- Label every draft “Not submitted”. Display “Abandoned” only when `lastActivityAt < now - 24 hours`.
- Drafts are excluded by default from RFQ counts, conversion rate, response SLA, sales funnel, organization lead score, timeline, and notifications. Reports may include them only through an explicit draft-specific selection.
- Restrict draft list/detail access to named administrator roles with a documented business need. This authorization is separate from customer token verification.
- Record administrator view and manual-delete actions in an audit log containing actor, action, RFQ ID, and timestamp; never copy form fields or token material into audit entries.
- UI copy warns that a draft is not an explicit inquiry and should not be used for direct marketing outreach without a separately documented lawful basis/consent.

### Hard deletion

- A daily scheduled cleanup queries `GSI1` partition `RFQ_STATUS#draft` with a `GSI1SK` cutoff corresponding to `lastActivityAt < now - 30 days`; it never scans the intelligence table. It then verifies the stored `expiresAt < now` before deletion.
- Each delete is conditional on both `status=draft` and the stored `expiresAt` still being earlier than the cleanup cutoff.
- Associated draft-only audit references must not retain copied PII. There are no draft attachments or downstream CRM records to clean.
- DynamoDB TTL is a secondary safety net, not the timeliness mechanism.
- The scheduled job emits attempted, deleted, condition-skipped, failed, and latency metrics. Any failures or a nonzero stale-draft backlog after the run trigger an operational alarm.
- Manual deletion uses the same conditional deletion service and invalidates the customer token immediately.

## Testing and Acceptance Criteria

### Data model and API

- Concurrent identical create requests return the same RFQ ID and token and leave one record.
- Token output is 256 bits; storage contains only a versioned peppered hash; comparisons use the constant-time verifier.
- Unknown/unapproved fields are rejected and absent from DynamoDB.
- Unauthorized read/update attempts reveal neither existence nor status.
- No-op and invalid updates do not change activity or expiry.
- Stale-version updates cannot overwrite newer values.
- Only an unexpired authenticated draft can transition to pending.
- Submission retries return the existing result and each external side effect occurs at most once.

### Frontend

- Draft creation begins only after valid Step 1 → Step 2 transition.
- Autosave and recovery preserve only whitelisted fields and never block editing or submission.
- Two failed retries produce a non-blocking failure status.
- Successful submission clears session credentials; retry, expiration, and CAPTCHA failures preserve form content.
- UI and privacy policy contain the approved retention/non-submission explanation.

### Administrator and cleanup

- Drafts are visibly distinct, role-restricted, and excluded from formal metrics by default.
- Abandoned classification changes after 24 hours without persisting a second state.
- Cleanup queries the expiry access path, conditionally deletes only expired drafts, and reports metrics/alarms.
- Automated tests prove a concurrently upgraded pending RFQ cannot be deleted by cleanup.

## Rollout

1. Deploy the data model, secret, indexes, admin authorization, and cleanup job without exposing the public API.
2. Deploy public draft endpoints with rate limiting and monitoring; validate idempotency and redaction in production logs.
3. Deploy frontend autosave behind a feature flag and monitor create/update/error rates.
4. Enable the administrator draft view after privacy copy and role assignment are approved.
5. Remove the feature flag only after cleanup metrics and submission-upgrade idempotency have completed an operational soak period.
