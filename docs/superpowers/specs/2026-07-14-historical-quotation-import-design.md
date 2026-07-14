# Historical Quotation Import Design

**Date:** 2026-07-14
**Status:** Approved after final review (v2.1) — ready for implementation
**Scope:** Import the 21 reviewed rows of the supplier price-check workbook as immutable historical quotations without representing them as current drafts.

**Confidentiality — read before editing this document.** This repository is **public**. The workbook filename, the supplier/OEM name, the client-folder path, and every ¥ figure are trade secrets and live **outside git**: in the workbook itself, in the normalized JSON, and in the internal operator record. They are deliberately absent here, and a later editor must not "helpfully" restore them for concreteness. This is the same rule §7.1's `.gitignore` + hygiene test enforces for the bulk data — constraint 8 protects the *values*, not merely the file extension, and a design document that names the OEM and its headline number leaks the relationship without ever committing the spreadsheet. Where this spec needs to refer to those values, it refers to their *role* (`<the reviewed supplier>`, "the adjudicated ICP value"); the operator resolves them from the out-of-repo artifacts.

**Revision note.** Two review rounds.

**Round 1** reviewed v1 (`65508972`) and returned "with fixes" against three blocking defects — a nullable `quotedAt` used as a GSI sort-key component, a `CONFLICT` result the stated write mechanism could not detect, and an unrecoverable import with no rollback path — plus an Important tier covering partition strategy, money naming, data-quality modelling, and the Excel→JSON trust boundary.

**Round 2** reviewed the resulting v2, confirmed the first two blockers resolved and the whole Important tier landed, walked the import → rollback → fix → re-import cycle and found it closes — and then found the revision's own residual risk concentrated in its newest section: `importBatchId` was load-bearing for rollback but its provenance was never pinned, rollback had no defined access path, `contentHash`'s covered field set was defined two contradictory ways in one sentence, and one new test was vestigial against the shipped identity. §2.7 (batch id provenance + manifest), §3.4 (access path, token derivation), and §2.3 (pinned hash field list) are the answers.

The FX-provenance fields added in `013b5c82` are preserved and carried into §2.5. §11 records the design decisions and their rationale.

## 1. Goals and boundaries

The import must preserve the historical facts in the source workbook: customer, project/product, configuration, recorded supplier quote, quote basis, evidence type, supplier quote date, customer-facing amount, original quote number, customer quote date, and legacy status.

Historical records are reference data. They do not participate in the live DRAFT workflow, do not consume the live quotation-number counter, do not change catalog costs, and cannot be converted to orders. Missing or uncertain values remain explicit rather than being inferred.

The already-created supplier record is the default supplier reference; its exact name is carried by the normalized JSON (§4.1) and is never hardcoded in this repository. The ICP budget configuration uses the operator-adjudicated RMB value, per the user's decision — the figure itself lives in the normalized JSON alongside its adjudication note (§4.1), not here.

**Immutable does not mean uncorrectable.** Historical records cannot be edited in place — a wrong value can never be silently overwritten to hide what was imported. But a wrong *batch* can be rolled back as a unit and re-imported from corrected source data (§3.4), and the audit trail survives the rollback (§3.5). v1 conflated the two and produced a one-way import with no escape; this distinction is the central correction of v2.

## 2. Data model

### 2.1 Keys

Historical records live in their **own** GSI1 partition, not alongside live quotations:

- `PK = PHIST#<historicalId>`
- `SK = META`
- `GSI1PK = HISTORICAL_QUOTATIONS`
- `GSI1SK = <quotedAtKey>#<historicalId>`

This changes v1, which used `GSI1PK = QUOTATIONS` — the same partition `pbListQuotations` already queries (`quotationResolvers.ts:370`, `:580-588`). §11.1 records why the shared partition was rejected.

`quotedAtKey` is **total**, resolving in order: `quotedAt ?? supplierQuotedAt ?? '0000-00-00'`. Falling back to the supplier quote date keeps a row roughly in its true chronological place when only the customer date is missing; `0000-00-00` is the floor for rows with no date at all. It is not a valid ISO date, so it can never collide with a real one, and under the list's descending sort it places undated rows at the end rather than pinning them to the front. The sentinel and the fallback exist **only in the key** — no business date field is ever synthesized, so `quotedAt: null` stays explicit per §1.

Because historical records now occupy their own partition, every `GSI1SK` in it is date-only (`YYYY-MM-DD`) and internally consistent. In v1 they shared a partition with live records whose `GSI1SK` carries a full ISO-8601 timestamp (`quotationResolvers.ts:476`); date-only keys sort before same-day timestamps, so the two formats could not have coexisted coherently.

### 2.2 Identity

`historicalId` is a SHA-256 digest, lowercase hex, over exactly two lineage fields joined by a delimiter that cannot occur in either:

```
historicalId = sha256(sourceDocument + "\x1f" + String(sourceRow))
```

`sourceDocument + sourceRow` is already unique by construction — a workbook row number does not repeat within a workbook — so no further inputs are needed for uniqueness, and adding them is actively harmful. v1 hashed `sourceDocument + sourceRow + sourceQuotationNumber + customerName`, undelimited. Two defects follow:

- **Undelimited concatenation is ambiguous.** `(row 1, quote "23")` and `(row 12, quote "3")` digest identically.
- **Content in the identity silently duplicates on reorder.** If a re-reviewed workbook inserts a row, every row below it shifts. With `customerName` in the digest, a shifted row produces a *new* ID and imports as a *new* record, leaving the original behind as a stale duplicate — silently, with no error. With identity keyed to position only, a shifted row produces the *same* ID with different content, which surfaces as `CONFLICT` (§3.3) and is caught.

Content drift is therefore detected by `contentHash`, never by the identity. Keeping identity minimal and content detection separate is what lets the two mechanisms compose instead of fight.

**Accepted limitations**, recorded so they are known trades rather than surprises:

- **Renaming the workbook changes every `historicalId`.** The filename is stable and under the operator's control, and rollback (§3.4) covers the case if it happens.
- **Two different workbooks sharing a basename collide.** Same basename + same row → same `historicalId`, so every row of the second workbook `CONFLICT`s (§3.3) and it cannot be imported until one is renamed. The failure is *safe* — caught per row, never a silent overwrite — and the fix is a rename. Putting `sourceDocumentHash` into the identity would remove the collision but reintroduce the far worse defect above it: any workbook edit would move every ID, so re-import would silently duplicate instead of conflicting. Safe-and-loud beats convenient-and-silent.

### 2.3 Fields — identity and classification

- `recordType: HISTORICAL_QUOTATION` — stored, and load-bearing: rollback hard-validates against it (§3.4).
- `status: HISTORICAL` — stored, with **no consumer today**. Once §5 moved to tabs with a separate `HistoricalQuotationSummary`, legacy state displays via `legacyStatus` and rollback validates `recordType`, so nothing reads this field. It is kept so a record read outside the historical resolvers — in a table export, a console query, a future generic reader — is self-describing rather than a bare `PHIST#` key. Noted explicitly so a later reader does not mistake it for a live discriminator.
- `historicalId`
- `contentHash` — SHA-256, lowercase hex, over a canonical serialization using a **fixed field order**, never arbitrary object insertion order. New in v2; §3.3 explains why it is required rather than merely useful.

`contentHash` covers exactly, and only:

> every field in §2.4, every field in §2.5, plus `dataQualityFlags` and `dataQualityNotes`.

It excludes `historicalId`, `contentHash` itself, and the six *Import lineage* fields of §2.6 (`sourceDocument`, `sourceDocumentHash`, `sourceRow`, `importBatchId`, `importedAt`, `importedBy`).

The field list is pinned here rather than described, because a near-miss is silent. Data-quality flags and notes are **inside** the hash: they are reviewed content (§4.1 puts the ICP adjudication note there deliberately), so an operator who corrects that note, or adds `UNCONFIRMED` on learning a supplier quote was oral, must get `CONFLICT` and not a `SKIPPED` that discards the correction. Lineage is **outside** the hash so that a rollback-and-re-import cycle — which necessarily changes `importedAt` and may change `importBatchId` — still compares content to content.

`status` and `recordType` are also outside the hash: they are constants for this record shape, so hashing them would add nothing.

### 2.4 Fields — the preserved source

- `customerName`
- `productName`
- `configuration`
- `supplierId`
- `supplierQuoteText`
- `supplierQuoteBasis`
- `supplierEvidenceType`
- `supplierQuotedAt` (nullable)
- `customerQuoteText`
- `sourceQuotationNumber` (nullable)
- `quotedAt` (nullable; source customer quote date)
- `legacyStatus`

Money is preserved as source text plus optional structured values:

- `supplierQuoteText` / `customerQuoteText` are **required**. `supplierAmountFen` and `customerAmountUsdCents` are populated **only** when the row expresses one unambiguous amount. The lossy representation can never exist without the lossless one beside it.
- Composite, ranged, alternative, estimated, and missing amounts remain in source text and add the appropriate `dataQualityFlags` entry.

Money field naming follows the established convention rather than inventing a parallel one. RMB is an integer count of **fen** in a field suffixed `Fen` (`types.ts:46` `unitCostFen`), and supplier currency is hard-typed `'RMB'` (`types.ts:24`, `:47`) — so there is **no** `supplierCurrency` field and no `'CNY'` literal anywhere; suppliers structurally cannot quote in anything else. Parsing goes through the existing `rmbToFen` (`csv.ts:36`), which does BigInt string parsing with no float math — the "string fen math" of commit `a4281944`. v1's `supplierAmountMinor` + `supplierCurrency` is dropped.

### 2.5 Fields — historical FX provenance

Carried forward from `013b5c82`:

- `historicalFxRate` (nullable decimal string)
- `historicalFxSource` (nullable source label)
- `historicalFxProvenance: CONFIRMED | INFERRED | UNKNOWN`
- `historicalFxNote` (nullable)

No historical FX or margin is calculated unless the source explicitly supplies the necessary inputs. If a rate can only be mathematically inferred from RMB and USD amounts, it may be stored only with `historicalFxProvenance: INFERRED`; it must never be represented as the rate confirmed on the original quotation. When the source contains no rate evidence, the four fields remain null / `UNKNOWN`.

### 2.6 Fields — lineage and data quality

Import lineage:

- `sourceDocument`
- `sourceDocumentHash` — SHA-256 of the workbook bytes. New in v2. A filename identifies a file; a hash identifies a *revision* of it. Without this, `sourceDocument` points at a name whose contents may since have changed, and §1's lineage claim is weaker than it reads.
- `sourceRow`
- `importBatchId` — the rollback boundary (§3.4). In v1 this field was defined but referenced by no operation. Its provenance is pinned in §2.7, because §3.4 is unreachable without it.
- `importedAt`
- `importedBy`

Data quality:

- `dataQualityFlags: Array<INCOMPLETE | UNCONFIRMED | CONFLICT_RESOLVED>` — an empty array means complete. Changed from v1's scalar `dataQuality: COMPLETE | INCOMPLETE | UNCONFIRMED | CONFLICT_RESOLVED`; §11.2 records why.
- `dataQualityNotes[]`

### 2.7 `importBatchId` provenance and the batch manifest

`importBatchId` is the rollback boundary, so how it is minted decides whether §3.4 works at all.

**The normalizer mints it, deterministically, into the JSON:**

```
importBatchId = "HB-" + sha256(sourceDocumentHash).slice(0, 16)
```

The workbook bytes are the only input. An earlier draft also hashed a normalizer version; it was dropped because every property claimed below follows from `sourceDocumentHash` alone, while the version token adds a state nobody wants — bumping the normalizer without touching the workbook would mint a new batch id and write an orphan manifest for a file and an execution that both already exist, contradicting §3.4's framing of a batch as one reviewed file and one import execution.

Truncating to 16 hex characters (64 bits) is safe here because a collision fails **loudly**, not silently: two different workbooks colliding would hit the manifest's `attribute_not_exists` guard, find different contents, and abort batch-fatally (§6.1).

It is therefore **caller-supplied** — the one identifier the import endpoint accepts from the caller, in deliberate contrast to `importedBy` and `importedAt`, which it never accepts (§3.3). Three properties follow, and all three are load-bearing:

- **It is stable across a recovery re-run.** §6.3's partial batch is re-run from the same file, and the same file yields the same id — so rows 1–11 and rows 12–21 land in *one* batch, not two. Minting per invocation would fragment the batch across invocations, and §3.4's batch-granular rollback would then need two operations against an id the operator never saw. It would also falsify §3.4's own claim that the batch is the boundary between one reviewed file and one import execution.
- **The operator always has it.** It is visible in the JSON before any write, and §4.2 prints it. A server-minted id that is never returned would leave §3.4 unreachable and close C3 on paper only.
- **A corrected file gets a new id.** Editing the workbook changes `sourceDocumentHash`, hence the batch id — so the corrected re-import is a distinct, separately-rollbackable batch, while the row identities (§2.2) stay put so the re-import is recognized as the same rows.

**The batch manifest.** Rollback needs to find a batch's records, and there is no index on `importBatchId` — the only GSI1 key is `<quotedAtKey>#<historicalId>`. Rather than add an index or resort to a filtered partition scan (which §3.1 rightly refuses), the import writes one manifest record **before** any row:

- `PK = HISTIMPORT#<importBatchId>`
- `SK = MANIFEST`
- containing `importBatchId`, `sourceDocument`, `sourceDocumentHash`, `historicalIds[]` (every id the batch *intends* to write), `rowCount`, `createdAt`, `createdBy`.

Written first, and listing intent rather than outcome, so it stays complete even when §6.3's timeout truncates the write phase — rollback of a half-finished import still covers all 21 rows, with the unwritten ones returning `ALREADY_ABSENT`.

The manifest write is conditional on `attribute_not_exists(PK)` and, like §3.3's row writes, carries `ReturnValuesOnConditionCheckFailure: 'ALL_OLD'`. §6.1 has to distinguish "same file re-run" (identical manifest → proceed) from "different file, same id" (batch-fatal), and that is the same distinction §3.3 spends a paragraph establishing cannot be made from a bare `attribute_not_exists` failure — which reports that the item exists, never what it contains. The rule applies to this record type too.

This puts the manifest in the same `HISTIMPORT#<importBatchId>` partition as §3.5's rollback audit record, so a batch's manifest and its rollback history are one Query.

## 3. API and trust boundary

Four admin-gated price-api operations. Each is registered in the `resolvers` map (`handler.ts:23-29`), so `RESOLVER_FIELDS` grows and the `ALL_OPS` array (`handler.test.ts:40`) must gain the same four or the deep-equal assertion at `:97` fails. That coupling is deliberate and is what makes §7.1's gate-coverage requirement real rather than aspirational. Note the adjacent comment at `handler.test.ts:79` hardcodes "all 14 operations" and goes stale at 18 — update it in the same change.

The existing handler-level Cognito `admin` gate (`handler.ts:49`) remains mandatory with no per-resolver opt-out. It runs before the resolver lookup, so a non-admin cannot even probe which field names exist.

**The API is the only deletion boundary.** CLI scripts are API clients. No script holds direct DynamoDB delete permission — that would mean re-implementing table resolution, admin gating, key-space validation, pagination, retry, partial-failure recovery, and audit in a second place, producing a management plane that bypasses the gate this trust boundary exists to enforce.

### 3.1 `pbListHistoricalQuotations(input)`

A single Query on `GSI1PK = HISTORICAL_QUOTATIONS`, `ScanIndexForward: false`, with real `nextToken` / `exclusiveStartKey` cursor pagination — the same shape as `pbListQuotations` (`quotationResolvers.ts:580-588`), on a different partition. No Scan, no `FilterExpression`.

A dedicated partition is what makes cursor pagination possible. Both alternatives fail: filtering a shared partition by `recordType` applies the filter *after* the read, so reaching 21 historical rows means reading through every live quotation, returning short and empty pages, degrading as live quotations accumulate. Fanning out across partitions and merging (the `listRfqs.ts:32-80` pattern) explicitly abandons cursor pagination — "no single cursor spans three independently-paginated partitions" (`listRfqs.ts:38-40`) — which would regress the existing "Load more" button.

### 3.2 `pbGetHistoricalQuotation(input)`

Returns one immutable record for detail display, via a strongly-consistent `GetItem` on `PHIST#<historicalId>` / `META`.

### 3.3 `pbImportHistoricalQuotations(input)`

Accepts one batch and returns per-row `IMPORTED | SKIPPED | CONFLICT | FAILED`. `CONFLICT` is a first-class member of the enum; v1 returned it from the prose while omitting it from the enum.

Each row is a `Put` conditional on `attribute_not_exists(PK)`, issued with `ReturnValuesOnConditionCheckFailure: 'ALL_OLD'`. When the condition fails, the `ConditionalCheckFailedException` **carries the existing item**, and the handler compares its `contentHash`:

- equal → `SKIPPED` (idempotent re-run)
- different → `CONFLICT`, and nothing is written for that row

`ALL_OLD` is used rather than a follow-up `GetItem` because it is atomic and one round trip instead of two. A conditional-Put-then-Get has a third, undefined branch: if the item is deleted between the failed Put and the Get, the Get returns nothing and neither `SKIPPED` nor `CONFLICT` applies. A single-operator admin script makes that race unlikely, but the primitive that removes it is free.

v1 specified `attribute_not_exists(PK)` alone and asserted the same two-way distinction, which that condition cannot deliver: a failed conditional Put reports that the item *exists*, never what it contains. v1 compounded the gap by testing "normalized-content hashes" in §7 while declaring no such field in §2 — a test for a field that did not exist.

No transaction. A single duplicate row must not roll back unrelated valid rows.

**Batch cap: 50 rows.** Derived, not inherited. Writes are independent conditional `Put`s, not `TransactWriteItems`, so the 100-action transaction limit does not apply — and that limit is the sole basis for the 45-line quotation cap in the parent spec (`2026-07-13-quotation-pricebook-design.md:96`), which v1 borrowed as "up to 45 rows" with no derivation of its own. `BatchWriteItem` is unusable here regardless, since it cannot carry condition expressions. The real bounds are the price-api Lambda's 30s timeout at 512MB (`resource.ts:12-13`) and AppSync payload size; 50 sequential conditional Puts sits far inside both. Implementation must confirm the headroom under real latency and lower the cap if it does not hold (§10.1). At 21 rows this workbook is a **single** batch.

The import endpoint never accepts caller-provided table keys, `importedBy`, or `importedAt` — the server stamps identity and time from the authenticated caller. `importBatchId` is the deliberate exception and *is* caller-supplied, for the reasons pinned in §2.7.

### 3.4 `pbRollbackHistoricalQuotationImport(input)`

`input` is `{ importBatchId, mode, rollbackToken? }`.

Named for what it is — compensation for an import transaction — rather than `pbDeleteHistoricalQuotationBatch`, which would read as a general-purpose quotation delete.

**Batch granularity only.** This phase offers no `deleteHistoricalQuotation(historicalId)` and no multi-select delete in the UI. The batch is the audit boundary between a reviewed input file and one import execution; correcting data means fixing the source JSON and re-importing the whole batch, not patching rows in the database.

**Hard deletion conditions.** Every record must satisfy *all* of the following server-side, expressed as a condition on the delete itself — never merely as a query filter:

```
recordType    == HISTORICAL_QUOTATION
importBatchId == <requested importBatchId>
PK begins_with "PHIST#"
SK            == "META"
```

Querying by `importBatchId` and deleting what comes back is not sufficient. If the GSI is ever misconfigured, the data polluted, or the query returns another entity, these conditions are what stand between a rollback and a deleted live quotation. Records failing any condition are `BLOCKED`, never deleted.

**Two phases.** `mode: PREVIEW` writes nothing and returns `matchedCount`, `deletableCount`, `blockedCount`, `historicalIds`, `sourceDocuments`, `warnings`, and a `rollbackToken`. `mode: APPLY` requires that token, so a preview the operator has read cannot be applied against a table that changed underneath it. A frontend confirmation dialog is not a substitute.

The token is:

```
rollbackToken = sha256(importBatchId + "\x1f" + sorted(deletable historicalIds).join("\x1f")
                       + "\x1f" + sorted(contentHash of each deletable record).join("\x1f"))
```

`APPLY` recomputes it from live table state and rejects a mismatch. Binding the *content hashes* and not merely the ids is what makes the token do its job: if a record is deleted, added to the batch, or replaced between preview and apply, the recomputed token differs and the apply fails closed. A bare timestamp-plus-nonce would expire the token without ever noticing that the thing being deleted had changed. There is no separate TTL — the token is invalid precisely when the world it described no longer holds, which is the only condition that matters.

**Access path.** The operation reads the batch manifest (§2.7) at `HISTIMPORT#<importBatchId>` / `MANIFEST` with one `GetItem`, then addresses each `historicalId` in it by primary key. No index on `importBatchId`, no `FilterExpression`, no Scan — consistent with §3.1's refusal of exactly those. A missing manifest is batch-fatal (§6.1): an unknown batch id must fail loudly, not silently match zero records and report a successful rollback.

**Not atomic; idempotent instead.** The operation issues per-record conditional deletes and collects `DELETED | ALREADY_ABSENT | BLOCKED | FAILED`. A record already gone counts `ALREADY_ABSENT` and does not fail the operation, so re-running a partially-completed rollback converges. Transactional deletion is not used: it would permanently bind every future import batch to the transaction limit — exactly the borrowed-constant mistake §3.3 corrects.

Operator flow: preview rollback → verify batch, counts, and source documents → apply → correct the normalized JSON → re-run dry-run → re-import.

### 3.5 Rollback audit

Deleting the historical records must not also delete the fact that they were deleted. Each applied rollback writes one immutable audit record:

- `PK = HISTIMPORT#<importBatchId>`
- `SK = ROLLBACK#<timestamp>`

Containing `importBatchId`, `requestedBy`, `confirmedBy`, `requestedAt`, `completedAt`, `reason`, `matchedCount`, `deletedCount`, `failedCount`, `deletedHistoricalIds[]`, `sourceDocumentHash`.

The manifest (§2.7) is **not** deleted by rollback. It and the audit record share the `HISTIMPORT#<importBatchId>` partition and together are the surviving record of what was imported and what removed it — deleting the manifest would erase the very evidence this section exists to keep.

`reason` is mandatory. The system today has a single administrator, so two-person approval is not enforced — and the record states plainly that confirmation was single-operator rather than dressing it up as a dual review.

## 4. Import scripts and source mapping

Two scripts plus a rollback client. Constraint 8 forbids the source *data* in the repository; it does not forbid the *code* that reads it.

### 4.1 `scripts/normalize-historical-quotations.ts`

Reads the workbook from an out-of-repo path supplied by argv or environment variable, and deterministically emits the normalized JSON. v1 said the JSON was "generated from the reviewed Excel source" without saying by whom or verified how — which left open that a human hand-transcribes 21 rows × ~14 fields. Under that reading, §1's preservation guarantee degrades to a *typing* guarantee, and the entire lineage apparatus faithfully records the provenance of possibly-wrong values.

A committed generator makes the transformation reproducible, reviewable, and diffable. It computes `sourceDocumentHash`, and resolves the supplier once (§4.3), pinning the resolved `supplierId` into the JSON.

The ICP adjudication lives **in the JSON as data**, not in script logic: the adjudicated RMB value, `dataQualityFlags: ['CONFLICT_RESOLVED']`, and the note text. v1 put the override in the importer, which meant the JSON would carry one value and the script would silently substitute another — the adjudicated number would exist only in code, invisible in the reviewed artifact, quietly undercutting the "preserve the source" posture.

The note must record the *adjudication*, not merely the conflict. Its required shape, with the figures supplied by the operator from the out-of-repo record:

> Manually adjudicated &lt;date&gt;: RMB &lt;adjudicated value&gt; confirmed; Markdown summary value RMB &lt;superseded value&gt; superseded.

The same reasoning that keeps the value out of the importer keeps it out of this document: a figure hardcoded here would be a second source of truth competing with the reviewed JSON, and this repository is public.

### 4.2 `scripts/import-historical-quotations.ts`

1. Authenticates through the existing admin script flow.
2. Reads the normalized JSON. It does **not** verify `sourceDocumentHash` against the workbook — it never opens the workbook; §4.1's normalizer is the only component that does. The importer passes the hash through as lineage. Verifying that the JSON still matches the workbook is §7.2's operator step, which re-runs the normalizer and diffs — the only place the two artifacts are both in hand.
3. Validates **every row in the file** — not a hardcoded 21. `--expect-rows 21` is an operator-supplied assertion, which preserves §7.2's reconciliation guarantee while keeping the tool reusable against a re-reviewed workbook with a different row count.
4. Runs a **server-consulting dry run** by default (§4.4).
5. Requires `--apply` for production writes.
6. Sends the batch to `pbImportHistoricalQuotations`.
7. Prints the `importBatchId` first — it is the only handle on §3.4's rollback, and an operator who never sees it cannot undo the import — then imported, skipped, conflicted, and failed counts, and every row carrying a `dataQualityFlags` entry.
8. Re-runs safely without duplication.

`scripts/rollback-historical-import.ts --batch <id> [--apply]` is a thin client over §3.4 — it preserves the command-line ergonomics without opening a second database management channel.

### 4.3 Supplier resolution

Resolve the supplier by exact name against `pbListSuppliers`, which Queries `GSI1PK='SUPPLIERS'` (`supplierResolvers.ts:117-123`) bounded by `MAX_SUPPLIERS = 10` (`:17`) — cheap and Scan-free. The name to match is an input, not a constant: it comes from the operator (argv or environment) and is recorded into the normalized JSON, never committed.

But supplier name is neither unique nor immutable: `pbCreateSupplier` has no name-uniqueness condition (`supplierResolvers.ts:37-51` guards only the count cap and PK collision), and `name` is freely editable (`SUPPLIER_MUTABLE`, `:77`). The script must therefore fail loudly on **0 matches and on >1 match** — v1's §6 handled only the 0 case. Resolution happens once, during normalization (§4.1), and the resolved `supplierId` is pinned into the JSON, so an OEM rename between dry-run and `--apply` cannot silently retarget the import.

### 4.4 Dry run

The dry run resolves each row's `historicalId` via `pbGetHistoricalQuotation` and reports predicted `IMPORTED / SKIPPED / CONFLICT` counts against **actual table state**.

v1's dry run validated locally only. Since `SKIPPED` and `CONFLICT` are decided server-side against stored content (§3.3), a local-only preview reports "21 rows valid" on a second run where all 21 will in fact be skipped, or where 3 will conflict. The operator's model — "the dry run showed 21, so 21 will import" — is wrong in precisely the case that matters most: the recovery re-run after a partial failure (§6.3). At 21 rows the extra round trips are free, and this is what gives the pre-`--apply` review something real to review.

## 5. Admin UI

The quotation admin page gains a **Live | Historical** segmented control. Each tab is one Query against one partition with its own cursor, so both paginate correctly and the existing live list is untouched.

v1 specified a single blended list. That does not survive contact with the sort keys: live rows order by `updatedAt` (recent), historical rows by `quotedAt` (legacy dates), under a descending sort (`ScanIndexForward: false`, `quotationResolvers.ts:585`) with a default `Limit` of 50 (`:570-571`) and a "Load more" button (`QuotationListPage.tsx:22`). All 21 historical rows would sort below every live quotation permanently and fall off page 1 as soon as live quotations exceed 50 — so "displayed together" would have been false in practice, and false in a way that worsens over time. Tabs are the honest version of the same intent. Co-display was a v1 design choice, not one of the project's hard constraints.

Historical rows show:

- original quote number when present, otherwise `Historical #<sourceRow>`;
- customer;
- product/project instead of live scheme;
- legacy status;
- customer amount when structurally available;
- source quote date;
- data-quality badge — the first flag present in the fixed display order **`INCOMPLETE` → `UNCONFIRMED` → `CONFLICT_RESOLVED`**, plus a count when the row carries more than one.

That order is stipulated here because §11.2's whole argument is that an undefined precedence forces an implementer to invent one, and demanding a "most severe" badge without defining severity would reintroduce exactly that. It ranks by how much a reader should distrust the number: `INCOMPLETE` means the value is absent, `UNCONFIRMED` means it is present but unverified, `CONFLICT_RESOLVED` means a human already settled it. It is a **display ordering only** — nothing is stored, dropped, or ranked at write time, which is what makes it safe to pick a convention here and revise it later.

Two structural details v1's display rules missed, both at `QuotationListPage.tsx:21`: the row key is `` `${q.quotationNumber}-${q.version}` ``, which historical records have neither of — all 21 would collide on `"undefined-undefined"`. Historical rows key on `historicalId`. And the Number cell links to `/admin/quotations/${q.quotationNumber}`; historical detail is `/admin/quotations/historical/<historicalId>`, served by `pbGetHistoricalQuotation`, since `pbGetQuotation` keys on `PQUO#<quotationNumber>` (`quotationResolvers.ts:537`) and cannot serve these.

The historical tab uses its own `HistoricalQuotationSummary` type. The live `QuotationSummary.status: 'DRAFT'` union (`priceAdminService.ts:166`) is therefore **not** widened — separate resolvers returning separate types means no shared list code needs to discriminate on `recordType` at all.

Historical records are read-only. The detail page contains configuration, raw supplier quote, quote basis, evidence type, original dates/status, FX provenance (§2.5), source document/row/hash, and data-quality notes. Live DRAFT actions, PDF generation, conversion, and price editing are absent.

Empty quotation screens add setup guidance linking Supplier → Price Book → New quotation, while historical import remains a script-only administrative operation in this phase.

## 6. Error handling and auditability

### 6.1 Two failure classes

v1 read as contradictory — "entire batch is rejected before writes" beside per-row results. The model is coherent but was never named, so an implementer would have guessed:

- **Batch-fatal preconditions** abort before any write. For **import**: unknown or ambiguous supplier, malformed batch, batch over the cap (§3.3), absent `importBatchId`, a caller-predicted `historicalId`/`contentHash` that differs from the server recomputation, or a manifest that exists with different contents. The prediction check makes a normalizer/deployed-Lambda hash-contract skew fail closed instead of writing records under keys different from the dry-run preview. For **rollback**: a missing manifest, or a `rollbackToken` that does not match the preview.
- **Row-level validation failures** return per-row `FAILED` and do not block sibling rows.

v2's first draft listed "missing or unknown `importBatchId`" among the *import* preconditions, which is incoherent: an import's batch id is new by definition, so "unknown" is the normal case. Unknown-batch is a rollback precondition. The two operations are separated above.

### 6.2 Per-row outcomes

- Missing customer or product: fails validation → `FAILED`.
- Missing amounts: imports with `INCOMPLETE`.
- Estimated, oral, or supplier-attribution-pending data: imports with `UNCONFIRMED`.
- The approved ICP budget discrepancy: imports with `CONFLICT_RESOLVED`.
- These flags **compose** — a row may carry several (§11.2).
- Duplicate import: `SKIPPED`, no mutation.
- Same key, different content: `CONFLICT`, nothing written for that row.

### 6.3 Atomicity

**The write phase is not atomic across rows.** Independent conditional `Put`s mean a Lambda timeout or throttle at row 12 leaves rows 1–11 committed while the caller sees only an error. This is tolerable *because* idempotency makes the re-run safe — but that is a load-bearing property, not an incidental one, and v1 relied on it without stating it. It is also exactly what made v1's local-only dry run (§4.4) dangerous: the recovery re-run is the case where an honest preview matters most.

### 6.4 Immutability mechanism

v1 asserted "Historical records are read-only" and listed editing under "not included" — a scope statement, not a mechanism. The actual guarantee, stated so a future phase cannot dissolve it silently:

- No mutation operation accepts a `PHIST#` or `HISTIMPORT#` key. `pbUpdateQuotationDraft` addresses `PQUO#{quotationNumber}` / `V#{version}`; a caller cannot construct an input reaching either partition. Immutability holds **by key-space construction**.
- Import writes — both rows and the manifest — are conditional on `attribute_not_exists(PK)`, so the import path cannot overwrite either.
- `pbRollbackHistoricalQuotationImport` is the **sole** exception, and only for `PHIST#` records: whole batches only, with the hard key-space and entity-type conditions of §3.4. Its `PK begins_with "PHIST#"` condition is also what makes §3.5's "the manifest is not deleted by rollback" a structural fact rather than an assertion — rollback cannot address a `HISTIMPORT#` key even if asked to.

The guarantee covers `HISTIMPORT#` (manifest and audit) exactly as it covers `PHIST#`, and for the same three reasons. §7.1 tests both prefixes: §3.5 makes these records the surviving evidence of an import, so a future generic price-table update that could reach them would erase the audit trail while every test still passed — which is the failure §6.4 exists to prevent.

Because this currently holds by accident of key layout, §7.1 asserts it with a test — otherwise the first phase to add a generic price-table update breaks it and nothing fails.

Every record stores source lineage and operator identity. Source files remain outside git and are never uploaded to public storage — and §7.1 enforces that mechanically rather than restating it.

## 7. Testing and verification

### 7.1 CI-runnable, against a synthetic fixture

The real workbook and its normalized JSON are out-of-repo by §4 and §6, so CI can see neither. v1 listed "exact 21-row dry-run reconciliation" among the unit tests; that test could only ever run against a fixture (reconciling nothing real) or not run at all. Unit tests therefore use a **synthetic 3-row fixture** exercising every path:

- deterministic `historicalId`, including the delimiter case constructible against **v2's** identity: `("book.xlsx", row 12)` and `("book.xlsx1", row 2)` must differ — both concatenate to `"book.xlsx12"` without the separator. (v2's first draft carried v1's example, `(row 1, "23")` vs `(row 12, "3")`, which is only constructible when the quote number is in the digest — it is not, so that test cannot be written against the shipped mechanism. Same class of defect as v1's vestigial "merge partitions" test.)
- `contentHash` stability across re-normalization, and sensitivity to **each** field in §2.3's covered set — including `dataQualityNotes`, since a corrected adjudication note must produce `CONFLICT` rather than `SKIPPED`;
- `contentHash` is *insensitive* to every lineage field, so a rollback-and-re-import cycle compares content to content;
- **a null-`quotedAt` row is returned by `pbListHistoricalQuotations`** — the direct regression test for the v1 sort-key defect — plus the `supplierQuotedAt` fallback and the `0000-00-00` floor;
- handler admin gate for all four new ops across both event shapes, via the existing table-driven test (`handler.test.ts:81`), with `ALL_OPS` (`:40`) extended so the coverage assertion at `:97` passes;
- validation and `dataQualityFlags` composition, including a row carrying two flags;
- FX provenance: an inferable rate stores `INFERRED` and never `CONFIRMED`; no rate evidence leaves all four fields null / `UNKNOWN`;
- idempotent duplicate import → `SKIPPED`;
- same key + different content → `CONFLICT`, nothing written;
- mixed-result batches; batch-fatal vs row-level failure classes, for import and rollback separately (§6.1);
- **the trust boundary holds**: caller-provided `importedBy` / `importedAt` / table keys are rejected or ignored in favour of server-stamped values (§3.3), while a caller-provided `importBatchId` is accepted (§2.7). This is the class §6.4 argues must be tested or nothing fails;
- batch-cap enforcement (§3.3) is batch-fatal;
- supplier resolution fails loudly on 0 matches **and** on >1 (§4.3);
- `importBatchId` is stable across two normalizer runs over the same workbook bytes, and changes when the bytes change (§2.7);
- the manifest is written before any row, lists intent, survives rollback, and a missing manifest makes rollback batch-fatal (§2.7, §3.4);
- **the full recovery cycle**: import → rollback → edit JSON → re-import succeeds, with `historicalId` unchanged and `attribute_not_exists(PK)` passing after the delete;
- `pbListHistoricalQuotations` is a single Query with working cursor pagination — no Scan, no `FilterExpression`;
- rollback: preview/apply token binding; `BLOCKED` on each hard condition individually (wrong `recordType`, wrong `importBatchId`, non-`PHIST#` PK, non-`META` SK); idempotent re-rollback → `ALREADY_ABSENT`; audit record written;
- **mutation resolvers cannot address a `PHIST#` *or* `HISTIMPORT#` key** (§6.4), and rollback cannot delete a `HISTIMPORT#` record;
- UI: historical rows key on `historicalId`, render no live actions, and route to the historical detail path.

Add to `scripts/build-hygiene.test.ts` — which already asserts repo-level invariants in CI — a test that no `*.xlsx` / `*.xls` is tracked, and add those globs plus the normalized-JSON path to `.gitignore`. Neither exists today, so constraint 8 is currently policy stated three times with nothing stopping a `git add`. This converts it into a guarantee, which is the standing lesson of `feedback_business_docs_no_commit`.

### 7.2 Operator-executed, one-time

Not CI tests — a checklist for the real import:

- re-run `normalize-historical-quotations.ts` against the workbook and confirm the JSON is byte-identical; a real reconciliation against a real source of truth, possible only because §4.1 made generation reproducible;
- dry-run reports 21 predicted `IMPORTED`, 0 `CONFLICT`;
- review the dry-run output row by row before `--apply`;
- post-import: 21 historical records, zero DRAFT records created, live counter unchanged, all 21 visible in the Historical tab (including any undated row).

## 8. Explicitly not included

- Editing historical records in place, in any phase.
- Deleting individual historical records. Rollback is batch-scoped (§3.4).
- Recomputing historical margin from current FX or price policy.
- Representing an inferred FX rate as a confirmed one (§2.5).
- Converting historical records to orders.
- Creating catalog items or current CostVersions from historical quotes.
- Uploading source Excel/Markdown files to the website or repository.
- A general-purpose UI import wizard in this phase.
- Two-person approval on rollback — single-operator confirmation, recorded honestly as such (§3.5).

## 9. Constraint traceability

| # | Constraint | Delivered by |
|---|---|---|
| 1 | Standalone `HISTORICAL`, not disguised DRAFT | §2.1 `PHIST#` key space; §2.3 `recordType` (`status` is stored but has no consumer); §7.2 zero-DRAFT check |
| 2 | Preserve quote number, date, status, source row | §2.4/§2.6 lineage fields + `sourceDocumentHash`; §4.1 reproducible generator; §7.2 byte-identical re-normalization |
| 3 | Do not consume live quotation numbering | §2.1 separate key space — the counter CAS protocol (`quotationResolvers.ts:341-366`) is never entered; §7.2 counter check |
| 4 | No recomputed margin from current FX | §2.5 provenance fields; §8 |
| 5 | Ambiguous amount → source text + quality flag | §2.4 — quote text required, structured values conditional |
| 6 | ICP = adjudicated RMB value + adjudication note | §4.1 — as reviewed data in the normalized JSON, with a note recording the adjudication; figure deliberately not in this repo |
| 7 | Idempotent duplicate skip | §2.2 stable identity; §3.3 `contentHash` compare; §6.3 |
| 8 | Source files out of repo and attachments | §4 code-not-data split; §7.1 `.gitignore` + hygiene test |
| 9 | Immutable / read-only | §6.4 — mechanism, not scope statement; §7.1 test |

## 10. Open questions for implementation

Only one remains. `rollbackToken` was previously open here; it was load-bearing enough to pin, so it is now specified in §3.4.

1. Confirm 50 sequential conditional Puts fit the 30s / 512MB price-api Lambda (`resource.ts:12-13`) under real AppSync latency; lower the cap if not (§3.3). This is a measurement, not a design question — the cap is a bound on an already-correct mechanism, and lowering it changes no behaviour beyond requiring a second batch.

## 11. Decision record

### 11.1 Why historical records get their own GSI1 partition

v1 placed them on `GSI1PK = QUOTATIONS` while §7 required a test for "merging live and historical partitions" — a contradiction, since one partition has nothing to merge. The fix had to eliminate the contradiction *and* guarantee historical records remain reachable by pagination.

Three options were weighed. Shared partition + `recordType` filter: post-read filtering, so short and empty pages, degrading as live quotations grow. Shared partition unfiltered (v1): historical rows sort below all live rows forever and fall off page 1 at 50. Multi-partition fan-out and merge (the `listRfqs.ts` pattern): explicitly abandons cursor pagination and would regress "Load more".

A dedicated partition costs nothing the others don't, and buys real cursor pagination, coherent per-partition sort semantics (the date-only vs. ISO-timestamp mismatch disappears), zero regression risk to the live list, no widening of the live `status` union, and no shared list code discriminating on `recordType`. The UI cost is a tab instead of a blended list — which the sort keys were never going to deliver anyway.

### 11.2 Why `dataQualityFlags` is a set

v1 declared one enum value per record while §6 defined three independent conditions. Nothing makes them exclusive: the ICP row is `CONFLICT_RESOLVED`, and if its supplier quote was oral it is *also* `UNCONFIRMED`, and if the supplier quote date is absent it is *also* `INCOMPLETE`. With no stated precedence, an implementer invents one, and information is destroyed at write time and cannot be recovered.

The concrete harm is the flag's own purpose failing: an auditor filtering "every unconfirmed row" misses rows classified `CONFLICT_RESOLVED`. `dataQualityNotes[]` carries prose but is not queryable, and a single badge renders only the winner. The three values are orthogonal facts; `COMPLETE` is not their peer but the absence of all three — hence an empty array. Cheap now; a data migration later.
