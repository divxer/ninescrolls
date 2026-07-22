# Runbook — gmail-sync setup & operations

Channel Lambda `gmail-sync` (Customer 360 P2 comms, Part 2) polls the Gmail history API
for `info@ninescrolls.com` via a domain-wide-delegation (DWD) service account and emits
`TimelineEvent(source:'gmail')` through crm-api. Design:
`docs/superpowers/specs/2026-07-09-customer-360-p2-comms-sync-design.md` (§3 access model,
§10 infra guardrails). Infra wiring: `amplify/backend.ts` (gmail-sync section), pinned by
`amplify/backend.gmailSync.test.ts`.

The function **deploys inert by default**: with no `GMAIL_SA_SECRET_ARN` at synth there is
no secret grant and no cron, and the handler returns `status: 'not_configured'` per mailbox
instead of crash-looping. Every step below is required only to turn the channel ON.

---

## 1. §0 precondition re-check (do this FIRST, before any Google setup)

The v1 design syncs exactly ONE mailbox because of the Workspace facts verified 2026-07-09
(spec §0). Re-verify them in the Workspace Admin console before enabling — if any changed,
STOP and revisit the spec, do not just add mailboxes to `MAILBOXES`:

- `info@ninescrolls.com` is still the single real, licensed user mailbox.
- `sales@` / `support@` (and harvey/invoice/privacy/careers/ap/ar) are still **aliases of
  `info@`** — their mail delivers into the `info@` mailbox.
- Still **no Google Groups** routing customer mail elsewhere.
- `lince@` / `lna@` remain unused/empty.

## 2. Google Cloud: dedicated project + service account + DWD

⚠️ **Credential blast radius (spec R1/I4):** a `gmail.readonly` DWD service account can read
ANY mailbox in the domain by changing the impersonation subject — DWD is all-or-nothing per
scope. The mitigations in §2–§5 (dedicated project, `GetSecretValue` alarm, rotation cadence)
are **required**, not optional hardening.

1. Create a **dedicated GCP project** used for nothing else (clean revocation path), e.g.
   `ninescrolls-crm-gmail-sync`.
2. Enable the **Gmail API** in that project.
3. Create a **service account** (no GCP IAM roles needed — it only signs JWTs). Create a
   **JSON key** and download it; you need its `client_email` and `private_key`.
4. Note the SA's **OAuth2 client ID** (numeric "Unique ID").
5. In the **Workspace Admin console** → Security → Access and data control → API controls →
   **Domain-wide delegation**: add the SA client ID with scope
   `https://www.googleapis.com/auth/gmail.readonly` — exactly this one scope.
   (`gmail.metadata` is NOT sufficient — it excludes `snippet`, which the mapper uses;
   spec §3. Reads are still metadata-format only — headers + snippet, never the body.)

## 3. AWS: Secrets Manager secret

Create the secret in **us-east-2** (the backend region), encrypted with the **default
`aws/secretsmanager` key** — do NOT pick a customer-managed KMS key (see the warning below):

```bash
aws secretsmanager create-secret \
  --region us-east-2 \
  --name crm/gmail-sync/service-account \
  --description "Gmail DWD SA key for gmail-sync (Customer 360 P2)" \
  --secret-string file://sa-key.json
```

The secret string is the SA JSON key; gmail-sync reads only `client_email` and
`private_key` from it (`amplify/functions/gmail-sync/lib/gmailClient.ts`).
Delete the local `sa-key.json` after upload.

**Record the COMPLETE ARN from the create-secret output** — it ends with a 6-character
random suffix, e.g.
`arn:aws:secretsmanager:us-east-2:123456789012:secret:crm/gmail-sync/service-account-AbC12d`.
backend.ts validates this shape at synth and **fails the build loudly** if
`GMAIL_SA_SECRET_ARN` is set but lacks the suffix or is otherwise malformed
(`Secret.fromSecretCompleteArn` requires the complete ARN).

> ⚠️ **Customer-managed KMS key warning:** `grantRead` on an ARN-imported secret grants
> `secretsmanager:GetSecretValue` + `DescribeSecret` ONLY — it can NOT add `kms:Decrypt`
> (the imported reference has no key association). The default `aws/secretsmanager` key
> needs no extra grant. **If this secret is ever moved to a customer-managed KMS key, an
> explicit `kms:Decrypt` PolicyStatement on that key MUST be added in `amplify/backend.ts`**
> next to the secret grant, or every sync run will fail with AccessDenied on decrypt.

## 4. Supplying `GMAIL_SA_SECRET_ARN` (this is how the channel turns ON)

backend.ts reads `process.env.GMAIL_SA_SECRET_ARN` **at synth time**. Empty/unset ⇒ the
whole gmail-sync wiring (secret grant, cron, env) is skipped and the function deploys inert.

- **Prod (Amplify Console build):** set `GMAIL_SA_SECRET_ARN` as an **Amplify Console
  environment variable** for the prod branch (App `d244ebmxcttcdz` → main branch →
  Environment variables). That is the ONLY supported prod supply path — the Console build
  is where synth runs. Redeploy the branch after setting it.
- **Sandbox (`ampx sandbox`):** developers export it **in-shell only** when actually
  testing gmail-sync:
  ```bash
  export GMAIL_SA_SECRET_ARN='arn:aws:secretsmanager:us-east-2:...:secret:crm/gmail-sync/service-account-AbC12d'
  npx ampx sandbox
  ```
  Default developer sandboxes leave it unset — zero Google setup required to synth/deploy.
  Note: even a configured sandbox never gets the cron (`!isSandbox` gate) — invoke the
  function manually with `{ "action": "sync" }` to test.

## 5. Credential monitoring (required mitigations)

- **CloudTrail alarm on `GetSecretValue`:** create a CloudWatch Logs metric filter on the
  CloudTrail trail for `eventName = GetSecretValue` AND
  `requestParameters.secretId` containing `crm/gmail-sync/service-account`, with an alarm →
  the existing `ninescrolls-org-api-alarms` SNS topic. Expected baseline: one read per cron
  cycle (every 10 min) from the gmail-sync execution role — alert on volume anomalies or
  any OTHER principal reading it.
- **Key-rotation cadence: every 90 days.** Rotation = create a new SA JSON key in GCP →
  `aws secretsmanager put-secret-value --secret-id crm/gmail-sync/service-account
  --secret-string file://new-key.json` → verify one sync cycle succeeds → delete the old
  key in GCP. The ARN does not change, so no redeploy is needed.
- **Revocation (compromise response):** delete the SA key in GCP (kills all JWTs signed
  with it), or remove the client-id from the Admin console DWD list (kills the whole
  channel domain-wide).

## 6. Deploy verification

Pre-merge: `npx vitest run amplify/backend.gmailSync.test.ts` (source contract) and the
sandbox synth+deploy gate:

```bash
npx ampx sandbox --identifier commsp2gate --once
# ... after the gate passes (or on abandoning the branch):
npx ampx sandbox delete --identifier commsp2gate
```

Post-deploy IAM assertion — confirm the LeadingKeys condition actually landed on the role:

```bash
ROLE=$(aws lambda get-function-configuration --function-name <gmail-sync fn name> --query 'Role' --output text | awk -F/ '{print $NF}')
for P in $(aws iam list-role-policies --role-name "$ROLE" --query 'PolicyNames[]' --output text); do
  aws iam get-role-policy --role-name "$ROLE" --policy-name "$P" --query 'PolicyDocument' | grep -q 'GMAIL_SYNC#\*' && echo "LeadingKeys condition present in $P"
done
```

Note: the function deliberately has NO reserved concurrency. A `reservedConcurrentExecutions: 1`
reservation was intended as third-layer overlap protection, but the sandbox deploy gate
(commsp2gate, 2026-07-21) proved the account's Lambda concurrency quota cannot absorb it —
CloudFormation rejects any reservation that drops unreserved concurrency below 10, and prod
deploys into the same account. Overlap safety is carried by the 300s fenced lease
(`acquireLease` ⇒ concurrent invocations return `skippedLeaseHeld`) plus the 600s cron
interval; the lease is the correctness mechanism, the reservation was defense-in-depth only.

## 7. Operations

### Backfill window

First-ever run per mailbox seeds a backfill of `newer_than:90d`
(`BACKFILL_WINDOW_DAYS = 90` in `amplify/functions/gmail-sync/handler.ts`). A stable
`configId` (hash of the paging-affecting inputs: mailbox + window; spec §7) is persisted
atomically with the backfill anchor. If the window (or mailbox identity) changes **while a
backfill is still in flight**, the next run detects the configId mismatch and deliberately
RESTARTS the backfill anchor-first (stale cursor discarded — safe, emits are idempotent).
Once the backfill has completed (phase `incremental`) the window no longer applies; to
re-run with a different window, reset the state item (below).

### Watermark / backfill-state reset

All sync state is ONE DynamoDB item on the intelligence table:
`PK = GMAIL_SYNC#<mailbox>`, `SK = STATE`. To reset (re-seed backfill + fresh watermark):

```bash
aws dynamodb delete-item \
  --table-name <NineScrollsIntelligence table name> \
  --key '{"PK":{"S":"GMAIL_SYNC#info@ninescrolls.com"},"SK":{"S":"STATE"}}'
```

The next run re-seeds from scratch (backfill window `N` again). Timeline emission is
idempotent (deterministic gmail event IDs via normalized Message-ID), so re-syncing
already-emitted messages is safe — duplicates collapse.

### Poison-mailbox alarm response

A `retryable_failure` that persists across cycles blocks that record's — and therefore the
mailbox's — advancement (the watermark never passes an unresolved record; spec §4/§7b).
Every blocked run logs a structured
`{"event":"gmail.sync.blocked", mailbox, blockedMessageId, blockedError, blockedStreak}`
line; after **3 consecutive cycles** blocked on the same message
(`POISON_STREAK_THRESHOLD` in `amplify/functions/gmail-sync/handler.ts`, ≈30 min at the
`*/10` cron) the run additionally logs
`{"event":"gmail.sync.poison", mailbox, blockedMessageId, blockedStreak}` — create the
CloudWatch metric filter/alarm on the stable string `gmail.sync.poison`. The streak is
durable (fields `blockedMessageId`/`blockedStreak` on the `GMAIL_SYNC#<mailbox>` state
item, written only via the fenced release write) and clears on the first clean run.
Response:

1. Read the `gmail.sync.blocked` / `gmail.sync.poison` lines in the gmail-sync CloudWatch
   logs — they carry the stuck Gmail message ID (`blockedMessageId`) and the projection
   error (`blockedError`) directly.
2. Transient upstream (Gmail 5xx/429): usually self-heals; verify the watermark advances on
   a later cycle.
3. Genuinely poisonous message (malformed beyond mapping, permanent API error): there is NO
   auto-skip in v1 (auto-`terminal_skip`-after-K is a demand-gated §9 fast-follow). Options,
   in order of preference: fix the mapping bug (code) and redeploy; or reset the state item
   (above) AFTER the underlying cause is fixed — reset alone just re-hits the same message.
4. If the mailbox stays blocked and timeline freshness matters more than the stuck span,
   escalate to implementing the §9 skip rather than hand-editing state — the state item's
   fenced writer (`gmailSyncState.ts`) assumes it is the only writer.
