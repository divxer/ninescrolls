# Historical Quotation Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import the 21 reviewed supplier rows as immutable historical quotations, with reproducible source normalization, honest dry-run results, batch rollback, and a read-only Historical admin experience—without creating DRAFT quotations or changing live quotation numbering.

> **Confidentiality — this repository is public.** The supplier/OEM name, the workbook filename and its disk path, and every ¥ figure are trade secrets that live **outside git**. They are deliberately absent from this plan. Do not add them for concreteness while implementing: use the placeholders, take real values from argv/env at run time, and keep them in the normalized JSON and the internal operator record. See the spec's Confidentiality note.

**Architecture:** Historical quotations use the existing price-api DynamoDB table but isolated primary keys (`PHIST#`) and a dedicated `HISTORICAL_QUOTATIONS` GSI partition. A deterministic normalizer produces confidential out-of-repo JSON and a manifest-ready batch identity. Four admin-gated AppSync operations provide list, detail, idempotent import, and preview/apply rollback. Live and Historical UI tabs retain independent queries and cursors.

**Tech Stack:** TypeScript, AWS Amplify Gen 2, AppSync custom operations, Lambda, DynamoDB single-table design, React, Vitest, and maintained `read-excel-file` for credential-isolated source normalization.

## Locked constraints

- Source Excel/Markdown and normalized production JSON never enter git or public object storage.
- Historical rows use `PHIST#<historicalId>` / `META`; manifests and rollback audits use `HISTIMPORT#<importBatchId>`.
- `historicalId = sha256(sourceDocument + "\x1f" + sourceRow)`; content drift is detected only by the separately canonicalized `contentHash`.
- Historical list records use `GSI1PK = HISTORICAL_QUOTATIONS`; live list behavior and `QuotationSummary.status: 'DRAFT'` stay unchanged.
- RMB structured amounts are integer `supplierAmountFen`; raw supplier/customer quote text remains mandatory.
- Data quality is a composable `dataQualityFlags[]`; empty means complete.
- Import cap is 50 rows, subject only to the explicit production-latency measurement in Task 10.
- The server stamps `importedBy` and `importedAt`; the caller supplies deterministic `importBatchId`.
- The manifest is written before rows and survives rollback. Rollback is batch-only, PREVIEW/APPLY token-bound, conditionally deletes only `PHIST#.../META` records, and writes immutable audit.
- All four operations are guarded by the existing handler-level Cognito `admin` check across both AppSync event shapes.
- The ICP budget row carries the operator-adjudicated RMB value and its reviewed `CONFLICT_RESOLVED` note as normalized data, never as hidden importer logic. The figure and note text come from the out-of-repo record; neither appears in this repo.

## File map

- Create `amplify/functions/price-api/lib/historicalQuotation.ts` and test — domain types, keys, canonical hashes, validation, rollback token.
- Create `amplify/functions/price-api/resolvers/historicalQuotationResolvers.ts` and test — list/get/import/rollback.
- Modify `amplify/functions/price-api/handler.ts`, its test, and `amplify/data/resource.ts` — four AppSync operations and full gate coverage.
- Create `scripts/lib/historicalQuotationImport.ts` and test — normalized-file schema, deterministic batch identity, supplier resolution, dry-run classification.
- Create `scripts/extract-historical-workbook.ts` and `scripts/normalize-historical-quotations.ts` — credential-free workbook parsing followed by authenticated supplier resolution.
- Create `scripts/check-historical-confidentiality.ts` — operator-supplied secret scan across all tracked text before deployment.
- Create `scripts/import-historical-quotations.ts` and `scripts/rollback-historical-import.ts` — authenticated API-only operator clients.
- Create `scripts/probe-historical-quotation-api.ts` and `scripts/seed-historical-import-sandbox.ts` — non-writing deployment probe and sandbox-only synthetic setup.
- Modify `.gitignore`, `scripts/build-hygiene.test.ts`, `tsconfig.scripts.json`, and dependencies — confidential-data guardrails and script compilation.
- Modify `src/services/priceAdminService.ts` and test — separate historical contracts and four client methods.
- Modify `src/pages/admin/QuotationListPage.tsx` and test — Live/Historical tabs with independent cursors.
- Create `src/pages/admin/HistoricalQuotationDetailPage.tsx` and test; modify `src/routes/AdminRoutes.tsx` — read-only detail route. (**Not** `src/routes/index.tsx` — that is the *public* route tree.)

---

### Task 1: Historical domain contract and canonical identities

**Files:**
- Create: `amplify/functions/price-api/lib/historicalQuotation.ts`
- Test: `amplify/functions/price-api/lib/historicalQuotation.test.ts`

**Produces:** `HistoricalQuotationInput`, `HistoricalQuotationRecord`, `historicalIdFor`, `contentHashFor`, `buildHistoricalRecord`, `rollbackTokenFor`, and validation helpers.

- [ ] **Step 1: Write failing tests for exact identity and sort-key rules**

Cover the delimiter regression, content-independent identity, nullable date fallback, and full 64-character hashes:

```ts
expect(historicalIdFor('book.xlsx', 12)).not.toBe(historicalIdFor('book.xlsx1', 2));
expect(historicalIdFor('book.xlsx', 12)).toBe(historicalIdFor('book.xlsx', 12));
expect(buildHistoricalRecord({ ...row, quotedAt: null, supplierQuotedAt: '2025-03-02' }, actor, now).GSI1SK)
  .toBe(`2025-03-02#${historicalIdFor(row.sourceDocument, row.sourceRow)}`);
expect(buildHistoricalRecord({ ...row, quotedAt: null, supplierQuotedAt: null }, actor, now).GSI1SK)
  .toMatch(/^0000-00-00#/);
```

- [ ] **Step 2: Write table-driven hash-coverage tests**

Create one baseline row. Mutate each §2.4 field, each §2.5 field, `dataQualityFlags`, and `dataQualityNotes`; every mutation must change `contentHash`. Mutate each lineage field (`sourceDocument`, `sourceDocumentHash`, `sourceRow`, `importBatchId`, `importedAt`, `importedBy`) independently; none may change it. Verify flags are sorted/canonicalized before hashing so semantically identical sets hash equally.

- [ ] **Step 3: Write validation, money, FX, and rollback-token tests**

Assert required raw text, `supplierAmountFen` integer/non-negative semantics, no `supplierCurrency`, composable flags, `INFERRED` never becoming `CONFIRMED`, and UNKNOWN with null rate/source. Assert token stability under input order and sensitivity to adding/removing/replacing any id or content hash.

- [ ] **Step 4: Run RED**

Run: `npx vitest run amplify/functions/price-api/lib/historicalQuotation.test.ts`

- [ ] **Step 5: Implement fixed-order canonical serialization**

Use an explicit ordered tuple/object of exactly the spec-covered fields. Do not hash arbitrary object insertion order. Build keys as:

```ts
PK: `PHIST#${historicalId}`,
SK: 'META',
GSI1PK: 'HISTORICAL_QUOTATIONS',
GSI1SK: `${quotedAt ?? supplierQuotedAt ?? '0000-00-00'}#${historicalId}`,
recordType: 'HISTORICAL_QUOTATION',
status: 'HISTORICAL',
```

Stamp `importedBy` and `importedAt` only in `buildHistoricalRecord`; never accept them from normalized row input.

- [ ] **Step 6: Verify and commit**

```bash
npx vitest run amplify/functions/price-api/lib/historicalQuotation.test.ts
git add amplify/functions/price-api/lib/historicalQuotation.ts amplify/functions/price-api/lib/historicalQuotation.test.ts
git commit -m "feat(pricebook): define historical quotation contract"
```

---

### Task 2: Deterministic normalization and confidential-data hygiene

**Files:**
- Create: `scripts/lib/historicalQuotationImport.ts`
- Create: `scripts/lib/historicalQuotationImport.test.ts`
- Create: `scripts/fixtures/historical-quotations.synthetic.json`
- Create: `scripts/extract-historical-workbook.ts`
- Create: `scripts/normalize-historical-quotations.ts`
- Create: `scripts/check-historical-confidentiality.ts`
- Modify: `package.json`, `package-lock.json`, `tsconfig.scripts.json`, `.gitignore`, `scripts/build-hygiene.test.ts`

**Produces:** normalized-file parser, workbook hash and batch ID, exact supplier resolution, deterministic JSON writer, synthetic CI fixture.

- [ ] **Step 1: Add failing tests for batch provenance and supplier resolution**

```ts
expect(importBatchIdFor(bytes)).toMatch(/^HB-[a-f0-9]{16}$/);
expect(importBatchIdFor(bytes)).toBe(importBatchIdFor(Buffer.from(bytes)));
expect(importBatchIdFor(Buffer.concat([bytes, Buffer.from('x')]))).not.toBe(importBatchIdFor(bytes));
expect(() => resolveSupplierId([], 'Fixture Supplier Co')).toThrow(/0 exact matches/);
expect(() => resolveSupplierId([supplier, { ...supplier, supplierId: 's2' }], supplier.name)).toThrow(/2 exact matches/);
```

Use fabricated supplier names in tests. The real name is irrelevant to `resolveSupplierId` — it is a parameter, and hardcoding the real one would leak it into a public repo for no test value.

**Known-answer vectors (required).** The three assertions above pass under a *different* algorithm than the spec's: a `"\x00"` delimiter, or a zero-padded `sourceRow`, satisfies all of them. Same hole for `importBatchIdFor` — a single `sha256(bytes)` passes, but §2.7 pins `sha256(sourceDocumentHash)`, a hash **of the hash**. These derive primary keys and the rollback handle, so once a record is written the algorithm is a persistence-format commitment, and `contentHash` is one too — changing canonicalization silently turns every unchanged re-import from `SKIPPED` into `CONFLICT`. Freeze one literal vector each for `historicalIdFor`, `contentHashFor`, and `importBatchIdFor`:

```ts
// Frozen. Changing these values is a DATA MIGRATION, not a refactor.
expect(historicalIdFor('book.xlsx', 12)).toBe(
  'fa45627efad19b4d61f2ca11a83df3915c2c6f9a1d369ce3bc9d97ae3eefd8e7',
);
expect(importBatchIdFor(Buffer.from('probe'))).toBe('HB-f3978f5542584999');
expect(contentHashFor(contentFixture)).toBe(
  '7c069195a5019edb14290df6b77c9520d3baf223f7d99f9e429963e2794141a3',
);
```

`contentFixture` must serialize to this exact ordered value tuple before SHA-256; the literal makes the vector independently reproducible rather than deriving the expectation from the function under test:

```ts
['Acme Lab', 'Fixture Tool', 'Base', 'sup-fixture', 'RMB quote', 'written',
 'WRITTEN', '2025-01-01', 'USD quote', 'Q-1', '2025-01-02', 'sent',
 12345, 67890, '7.0000', 'Fixture FX', 'INFERRED',
 'Derived from source amounts', ['UNCONFIRMED'], ['Fixture note']]
```

- [ ] **Step 2: Add a synthetic three-row fixture**

Exercise: one complete row, one null-date/ambiguous-amount row with two flags, and one inferred-FX row. The fixture is fabricated and contains no real client/source values.

- [ ] **Step 3: Install the maintained parser and isolate untrusted parsing**

```bash
npm install --save-dev read-excel-file
```

Use the current maintained registry release and commit the lockfile. Run `npm audit --omit=dev` and `npm audit` after installation; do not add an audit suppression. This remains a devDependency and must never enter Lambda or web bundles.

Create `scripts/extract-historical-workbook.ts` as the only module importing `read-excel-file`. It accepts the workbook path, emits parsed source rows as JSON on stdout, never imports Amplify/auth modules, and runs in a child process with an allowlisted environment that excludes `ADMIN_EMAIL`, `ADMIN_PASSWORD`, AWS credentials, and tokens. `normalize-historical-quotations.ts` may authenticate for supplier resolution only after that child exits successfully. This separates parsing of an external archive from production credentials.

- [ ] **Step 4: Add build-hygiene tests before ignore rules**

`scripts/build-hygiene.test.ts` currently only uses `readFileSync` — this adds the first `child_process` usage to it. Use `execFileSync('git', ['ls-files', '-z'])` and assert no tracked path ends in `.xlsx`, `.xls`, `.xlsm`, or `.xlsb`; do not hand-roll a filesystem walk (tracked ≠ present). Assert the default normalized production output path is ignored.

Add an operator-only repository scan that reads newline-separated secrets from `HISTORICAL_CONFIDENTIAL_TERMS_FILE` and checks **all tracked text files**, not only `docs/`. It runs in Task 10b before deploy. CI cannot know those secret values, so do not present an env-skipped CI assertion as a guarantee.

Implement that scan as `scripts/check-historical-confidentiality.ts`: obtain tracked paths with `git ls-files -z`, skip binary files after a NUL-byte probe, search every remaining tracked file for every non-empty term, print only file/line locations (never echo the secret), and exit non-zero on any match.

```gitignore
*.xlsx
*.xls
*.xlsm
*.xlsb
scripts/data/historical-quotations.normalized.json
```

The normalizer rejects workbook, adjudication-record, or output paths that resolve inside the git worktree. During operator setup, add the exact confidential source filenames to `.git/info/exclude` as a local second guard. Markdown/CSV cannot be globally ignored because this repository intentionally tracks those formats; path rejection plus the operator secret scan protects this workflow without breaking legitimate content.

- [ ] **Step 5: Run RED**

```bash
npx vitest run scripts/lib/historicalQuotationImport.test.ts scripts/build-hygiene.test.ts
```

- [ ] **Step 6: Implement the normalizer**

Read workbook and output as the first two positional arguments used by Task 10b; retain `--workbook` / `--output` and environment fallbacks for non-conflicting invocations. Read supplier name and adjudication-record path from flags/env — none is a constant in this repo. Reject duplicate, missing, unknown, extra positional, or positional/flag-conflicting arguments. The confidential adjudication JSON is outside the worktree and has exact schema `{ sourceRow: number, adjudicatedRmb: string, supersededRmb: string, adjudicatedAt: string }`; reject missing/extra fields and require its `sourceRow` to match exactly one parsed row. Compute `sourceDocumentHash` from original bytes and `importBatchId = "HB-" + sha256(sourceDocumentHash).slice(0, 16)`. Query `pbListSuppliers`, require exactly one exact-name match, and pin that `supplierId` in every output row. Convert only unambiguous RMB using existing `rmbToFen`; preserve every raw quote string.

Keep the ICP adjudication as emitted row data, with the values read from the workbook and the operator record rather than typed here:

```ts
dataQualityFlags: ['CONFLICT_RESOLVED'],
dataQualityNotes: [adjudicationNote],   // supplied by operator; shape per spec §4.1
supplierAmountFen: rmbToFen(adjudicatedRmb),
```

Sort properties and rows deterministically and terminate output with one newline so repeated normalization is byte-identical. **Test that byte-stability in CI**: serialize the synthetic fixture twice and assert byte equality. §7.2's operator reconciliation is otherwise the only check, and it runs once, manually, against the real workbook — far too late and too narrow for a guarantee the whole re-normalization story rests on.

The normalizer imports the shared pure `historicalIdFor` and `contentHashFor` helpers from Task 1 and emits both values on every normalized row. These are operator-visible predictions used by dry run and manifest construction, not trusted write authority: Task 4 requires price-api to recompute both from the accepted source fields and to **abort the batch** if a prediction disagrees.

This is a `scripts/` → `amplify/` import. It is legal and has precedent (`scripts/backfill-organizations.ts` value-imports from `amplify/lib/organization/etld`), resolving under the root tsconfig's `moduleResolution: "bundler"`. Note the `amplify/` side uses ESM `./x.js`-extension import specifiers. Verify this import compiles early — it is the one cross-boundary dependency in the plan, and finding it broken at Task 7's typecheck would be late.

- [ ] **Step 7: Compile scripts and commit**

`tsconfig.scripts.json` uses an explicit file **allowlist**, not a glob. Add the Task 2 files now:

```jsonc
"scripts/lib/historicalQuotationImport.ts",
"scripts/extract-historical-workbook.ts",
"scripts/normalize-historical-quotations.ts",
"scripts/check-historical-confidentiality.ts",
```

Task 7 adds its two client paths only after those files exist; listing missing files here would make `tsc` silently ignore them and falsely suggest coverage.

```bash
npx vitest run scripts/lib/historicalQuotationImport.test.ts scripts/build-hygiene.test.ts
npx tsc --noEmit -p tsconfig.scripts.json
git add package.json package-lock.json tsconfig.scripts.json .gitignore scripts/build-hygiene.test.ts scripts/lib/historicalQuotationImport.ts scripts/lib/historicalQuotationImport.test.ts scripts/fixtures/historical-quotations.synthetic.json scripts/extract-historical-workbook.ts scripts/normalize-historical-quotations.ts scripts/check-historical-confidentiality.ts
git commit -m "feat(pricebook): normalize confidential historical quotes"
```

---

### Task 3: Historical list and detail resolvers

**Files:**
- Create: `amplify/functions/price-api/resolvers/historicalQuotationResolvers.ts`
- Create: `amplify/functions/price-api/resolvers/historicalQuotationResolvers.test.ts`

**Produces:** `pbListHistoricalQuotations` and `pbGetHistoricalQuotation`.

- [ ] **Step 1: Write failing list tests**

Assert one `QueryCommand` against `IndexName: 'GSI1'`, `GSI1PK = HISTORICAL_QUOTATIONS`, descending order, bounded limit, correct base64 cursor round-trip, no `ScanCommand`, and no `FilterExpression`. Include rows whose `quotedAt` is null and verify supplier-date/floor-key rows are returned.

- [ ] **Step 2: Write failing detail tests**

Assert strongly consistent `GetCommand` using `PHIST#<historicalId>` / `META`, stripped table keys, typed NOT_FOUND, and rejection of malformed IDs before reading.

- [ ] **Step 3: Run RED, implement, and run GREEN**

```bash
npx vitest run amplify/functions/price-api/resolvers/historicalQuotationResolvers.test.ts
```

Reuse the existing cursor encoding shape from `pbListQuotations`, but do not modify `quotationResolvers.ts` or its live partition.

- [ ] **Step 4: Commit**

```bash
git add amplify/functions/price-api/resolvers/historicalQuotationResolvers.ts amplify/functions/price-api/resolvers/historicalQuotationResolvers.test.ts
git commit -m "feat(pricebook): read historical quotations separately"
```

---

### Task 4: Manifest-first idempotent import

**Files:**
- Modify: `amplify/functions/price-api/resolvers/historicalQuotationResolvers.ts`
- Modify: `amplify/functions/price-api/resolvers/historicalQuotationResolvers.test.ts`

**Produces:** `pbImportHistoricalQuotations` returning per-row `IMPORTED | SKIPPED | CONFLICT | FAILED`.

- [ ] **Step 1: Write failing manifest tests**

Assert the first write is `HISTIMPORT#<batch>` / `MANIFEST`, conditional on absence, with `ReturnValuesOnConditionCheckFailure: 'ALL_OLD'`; it lists all intended historical IDs even when a later row fails. Same-file manifest replay proceeds; same batch ID with differing document hash/IDs aborts batch-fatally before row writes.

Manifest replay equivalence is the canonical comparison of exactly `importBatchId`, `sourceDocument`, `sourceDocumentHash`, sorted `historicalIds`, and `rowCount`. It explicitly excludes server-stamped `createdAt` and `createdBy`. Add tests proving reordered IDs replay successfully while any added, removed, or changed intended ID is batch-fatal.

- [ ] **Step 2: Write failing row-outcome and trust-boundary tests**

Cover successful conditional Put, duplicate/equal hash → SKIPPED, duplicate/different hash → CONFLICT, mixed batch with validation FAILED plus valid IMPORTED, cap accepted and cap+1 batch-fatal. Inspect commands to prove caller table keys/operator/time are ignored and server identity/time are stamped.

**A mismatched prediction is batch-fatal, not ignored.** The resolver recomputes `historicalId` and `contentHash` from the accepted row fields; if a caller-supplied prediction disagrees with the recomputation, abort the batch before any write (§6.1 precondition). Test both a matching prediction (proceeds) and a forged/stale one (batch-fatal, zero writes).

Rejecting rather than ignoring is what makes §4.4's dry run honest. The dry run addresses the table by the JSON's *predicted* `historicalId` and compares the JSON's *predicted* `contentHash` — both sides local. The normalizer runs from the working tree; the resolver runs from the **deployed** Lambda. Change the canonicalization, re-run the normalizer, forget to deploy: the predictions now disagree with the server, the dry run reports "21 IMPORTED, 0 CONFLICT", and `--apply` does something else entirely — silently. That is precisely the operator model §4.4 was written to kill ("the dry run showed 21, so 21 will import"). Comparison costs one line and converts an invisible skew into a loud abort, which is the spec's posture throughout (§2.2 "Safe-and-loud beats convenient-and-silent"; §2.7's truncation is safe because "a collision fails **loudly**").

Export a single `MAX_IMPORT_ROWS` constant that the resolver, the CLI, and both test literals derive from, so Task 10 Step 3's measurement can adjust the cap in one line rather than a grep across three layers.

- [ ] **Step 3: Run RED**

```bash
npx vitest run amplify/functions/price-api/resolvers/historicalQuotationResolvers.test.ts
```

Confirm the failures are the expected assertions. This task modifies an existing module, so module-not-found no longer guarantees RED — and these are conditional monetary writes, where a vacuously-green test is worse than no test.

- [ ] **Step 4: Require atomic existing-item evidence**

Each row Put must include:

```ts
ConditionExpression: 'attribute_not_exists(PK)',
ReturnValuesOnConditionCheckFailure: 'ALL_OLD',
```

On `ConditionalCheckFailedException`, compare `error.Item.contentHash`; do not issue a follow-up Get and do not silently retry monetary writes.

- [ ] **Step 5: Implement batch-fatal preflight and independent writes**

Validate batch shape, `importBatchId`, supplier **existence** (§6.1's precondition is "unknown or ambiguous supplier" — an existence check against the table, not shape validation; resolution and ambiguity are already the normalizer's job per §4.3), and the row cap, all before manifest/row writes. No transaction and no `BatchWriteItem`: row outcomes remain independent and recoverable by replay.

For every accepted row, recompute `historicalId`, `contentHash`, `quotedAtKey`, and all table keys server-side using Task 1 helpers. **Never** use a caller-supplied `historicalId`/`contentHash` for keys, validation, or collision classification — and per Step 2, abort the batch if a supplied prediction disagrees with the recomputation rather than silently proceeding. The manifest's intended IDs are built from recomputed IDs, not copied from JSON.

- [ ] **Step 6: Verify recovery after partial failure and commit**

```bash
npx vitest run amplify/functions/price-api/resolvers/historicalQuotationResolvers.test.ts
git add amplify/functions/price-api/resolvers/historicalQuotationResolvers.ts amplify/functions/price-api/resolvers/historicalQuotationResolvers.test.ts
git commit -m "feat(pricebook): import historical quote batches idempotently"
```

---

### Task 5: Preview/apply batch rollback and surviving audit

**Files:**
- Modify: `amplify/functions/price-api/resolvers/historicalQuotationResolvers.ts`
- Modify: `amplify/functions/price-api/resolvers/historicalQuotationResolvers.test.ts`

**Produces:** `pbRollbackHistoricalQuotationImport` with `DELETED | ALREADY_ABSENT | BLOCKED | FAILED` results.

- [ ] **Step 1: Write failing PREVIEW tests**

Read `HISTIMPORT#<batch>/MANIFEST` strongly consistently, then Get every intended `PHIST#id/META`. Return counts, IDs, documents, warnings, and token. Missing manifest is batch-fatal. PREVIEW writes nothing.

- [ ] **Step 2: Write failing APPLY safety tests**

Reject absent/mismatched token before deletion. Recompute token from current deletable IDs and content hashes. Test each delete condition independently: wrong `recordType`, wrong `importBatchId`, non-`PHIST#` PK, or non-`META` SK returns BLOCKED. Assert no resolver path can target `HISTIMPORT#` for deletion.

**APPLY iterates the manifest's intended ids, not PREVIEW's deletable set.** Issue one conditional delete per `historicalId` in `HISTIMPORT#<batch>/MANIFEST`, reporting `ALREADY_ABSENT` where the record does not exist; the token binds only the *deletable* subset. This distinction is load-bearing: if APPLY iterated the deletable set instead, then every state change that could produce `ALREADY_ABSENT` would also invalidate the token first, `ALREADY_ABSENT` would be unreachable dead code, and §2.7's guarantee that "rollback of a half-finished import still covers all 21 rows" would quietly evaporate — the manifest would be listing intent for nobody.

Inspect the actual `DeleteCommand` and require one conjunctive condition on the delete itself—not only a pre-read check:

```ts
ConditionExpression:
  'recordType = :recordType AND importBatchId = :batch AND begins_with(PK, :prefix) AND SK = :meta',
ExpressionAttributeValues: {
  ':recordType': 'HISTORICAL_QUOTATION', ':batch': importBatchId,
  ':prefix': 'PHIST#', ':meta': 'META',
},
```

- [ ] **Step 3: Write idempotency and audit tests**

Partial delete failure invalidates the original token because live deletable state changed. Assert stale-token APPLY fails closed; recovery runs a fresh PREVIEW and then APPLY its newly returned token. That replay converges — deletes are monotone (nothing recreates a `PHIST#` record except an import), so each partial APPLY strictly shrinks the deletable set and the loop terminates. Missing rows report `ALREADY_ABSENT`. APPLY requires `reason`.

Audit uses `HISTIMPORT#<batch>` / `ROLLBACK#<timestamp>`, is conditionally immutable, and the manifest remains. Assert **all eleven** spec §3.5 fields individually rather than a summary:

```
importBatchId, requestedBy, confirmedBy, requestedAt, completedAt, reason,
matchedCount, deletedCount, failedCount, deletedHistoricalIds[], sourceDocumentHash
```

`requestedBy` and `confirmedBy` are separate fields on purpose and must not be collapsed into one `actor`. §3.5's point is that with a single administrator the record "states plainly that confirmation was single-operator rather than dressing it up as a dual review" — one merged field destroys exactly the honesty the section exists to preserve.

- [ ] **Step 4: Write full recovery-cycle test**

Import → PREVIEW → APPLY → change the synthetic workbook/source bytes → rerun normalization → re-import. Assert the same `historicalId` (same source filename/row), a new content hash and a new batch ID (changed workbook bytes), successful `attribute_not_exists(PK)`, and retained old rollback audit. Do not edit normalized JSON directly and then expect a new batch ID: `importBatchId` derives only from workbook bytes.

Also assert the **truncated-import rollback**, which is the case §2.7's manifest exists for: write 11 of 21 rows, then PREVIEW → APPLY, and require 11 `DELETED` + 10 `ALREADY_ABSENT` + 0 `FAILED`. This test only passes if APPLY iterates the **manifest's** intended ids (see Step 2), so it is what keeps `ALREADY_ABSENT` from becoming dead code.

- [ ] **Step 5: Run RED**

```bash
npx vitest run amplify/functions/price-api/resolvers/historicalQuotationResolvers.test.ts
```

Confirm the failures are the *expected* ones, not module-resolution noise. This task modifies an existing module, so "file doesn't exist" no longer guarantees RED for free — a mis-specified `expect(...).not.toHaveBeenCalled()` on a path that never runs passes green from the first minute. This is conditional deletion of monetary records; a vacuous green here is the worst outcome in the plan.

- [ ] **Step 6: Assert immutability over the EXISTING mutation surface**

**Files:** create `amplify/functions/price-api/resolvers/keyspaceImmutability.test.ts`

Spec §7.1 requires that *mutation resolvers cannot address a `PHIST#` **or** `HISTIMPORT#` key* — not just that rollback won't. Nothing else in this plan tests it, and §9 routes constraint 9 (Immutable / read-only) through exactly this assertion. §6.4 states the stakes: the guarantee currently holds **by key-space construction**, i.e. by accident of how each resolver builds its key — "otherwise the first phase to add a generic price-table update breaks it and nothing fails."

Drive every mutation resolver in the `resolvers` map (`pbCreateQuotationDraft`, `pbUpdateQuotationDraft`, `pbCreateSupplier`, `pbUpdateSupplier`, `pbCreateCatalogItem`, `pbUpdateCatalogItem`, `pbAppendCostVersion`, `pbUpdatePricingPolicy`) with adversarial identifier inputs — `PHIST#x`, `HISTIMPORT#x`, `../PHIST#x`, `x#PHIST#y` — and assert the emitted command's `Key.PK` / `Item.PK` still matches that resolver's own prefix (`/^PQUO#/`, `/^PSUP#/`, `/^PCAT#/`, …) and never begins with `PHIST#` or `HISTIMPORT#`.

Derive the resolver list from the real dispatch map, in the style of `handler.test.ts:97`'s `RESOLVER_FIELDS` deep-equal, so a future mutation op cannot be added without either appearing here or failing the suite. That is the difference between a guarantee and a comment.

- [ ] **Step 7: Implement, verify, and commit**

```bash
npx vitest run amplify/functions/price-api/resolvers/historicalQuotationResolvers.test.ts amplify/functions/price-api/resolvers/keyspaceImmutability.test.ts
git add amplify/functions/price-api/resolvers/historicalQuotationResolvers.ts amplify/functions/price-api/resolvers/historicalQuotationResolvers.test.ts amplify/functions/price-api/resolvers/keyspaceImmutability.test.ts
git commit -m "feat(pricebook): rollback historical quote batches safely"
```

---

### Task 6: AppSync schema and complete admin-gate surface

**Files:**
- Modify: `amplify/data/resource.ts`
- Modify: `amplify/functions/price-api/handler.ts`
- Modify: `amplify/functions/price-api/handler.test.ts`

**Produces:** four authenticated AppSync operations whose Lambda dispatch remains admin-only.

- [ ] **Step 1: Extend handler mocks and `ALL_OPS` first**

Add `pbListHistoricalQuotations`, `pbGetHistoricalQuotation`, `pbImportHistoricalQuotations`, and `pbRollbackHistoricalQuotationImport` to `ALL_OPS` (`handler.test.ts:40`). Update the stale “all 14 operations” comment at `:79` to 18. Existing table-driven tests must reject non-admins for both `info.fieldName` and top-level `fieldName`, prove resolver non-dispatch, and deep-equal the real resolver map (`:97`).

Concretely: add a `vi.mock` for the new `historicalQuotationResolvers` module and spread its mocks into `resolverMocks` (see the existing pattern at `handler.test.ts:49-52`). Without that, `:97`'s `RESOLVER_FIELDS` deep-equal fails in a confusing way that looks like a handler bug rather than a missing mock.

- [ ] **Step 2: Run RED**

Run: `npx vitest run amplify/functions/price-api/handler.test.ts`

- [ ] **Step 3: Add handler entries and schema declarations**

Pin the four cross-layer contracts and use `a.json()` payloads consistently:

```ts
pbListHistoricalQuotations: a.query()
  .arguments({ limit: a.integer(), nextToken: a.string() })
  .returns(a.json().required())
  .handler(a.handler.function(priceApi))
  .authorization((allow) => [allow.authenticated()]),

pbGetHistoricalQuotation: a.query()
  .arguments({ input: a.json().required() }) // { historicalId }
  .returns(a.json().required()),

pbImportHistoricalQuotations: a.mutation()
  .arguments({ input: a.json().required() })
  // { importBatchId, sourceDocument, sourceDocumentHash, rows: HistoricalQuotationInput[] }
  .returns(a.json().required()),

pbRollbackHistoricalQuotationImport: a.mutation()
  .arguments({ input: a.json().required() })
  // { importBatchId, mode: 'PREVIEW' | 'APPLY', rollbackToken?, reason? }
  .returns(a.json().required()),
```

Attach the same price-api handler and `allow.authenticated()` declaration to all four. `reason` is forbidden/ignored in PREVIEW and required in APPLY; `rollbackToken` is required only in APPLY. Do not add price-api to any cross-Lambda invoke loop.

- [ ] **Step 4: Verify and commit**

```bash
npx vitest run amplify/functions/price-api/handler.test.ts
npm run typecheck:amplify
git add amplify/data/resource.ts amplify/functions/price-api/handler.ts amplify/functions/price-api/handler.test.ts
git commit -m "feat(pricebook): expose historical quotation administration"
```

---

### Task 7: Frontend service contracts and server-aware operator clients

**Files:**
- Modify: `src/services/priceAdminService.ts`
- Modify: `src/services/priceAdminService.test.ts`
- Create: `scripts/import-historical-quotations.ts`
- Create: `scripts/rollback-historical-import.ts`
- Create: `scripts/probe-historical-quotation-api.ts`
- Create: `scripts/seed-historical-import-sandbox.ts`
- Modify: `scripts/lib/historicalQuotationImport.ts` and its test (created in Task 2; Step 3 extends them)
- Modify: `tsconfig.scripts.json`

**Produces:** separate `HistoricalQuotationSummary`/detail types, four web client methods, dry-run-by-default import CLI, preview/apply rollback CLI.

- [ ] **Step 1: Add failing service tests**

Assert exact operation selection and JSON wrapping for list/get/import/rollback. Keep `QuotationSummary.status` unchanged. Historical types must require `historicalId`, raw quote text, lineage, FX provenance, and flags; they must not expose live mutation fields/actions.

- [ ] **Step 2: Run service tests RED**

Run `npx vitest run src/services/priceAdminService.test.ts` and confirm the failures are missing historical methods/types, not unrelated module setup.

- [ ] **Step 3: Implement client methods**

```ts
export const listHistoricalQuotations = (opts = {}) =>
  unwrap<{ items: HistoricalQuotationSummary[]; nextToken: string | null }>(
    client().queries.pbListHistoricalQuotations(opts, AUTH),
  );
```

Add corresponding detail/import/rollback methods without widening live unions.

- [ ] **Step 4: Add script-helper tests for honest dry run**

For every normalized row, call `pbGetHistoricalQuotation`; absent predicts IMPORTED, equal `contentHash` predicts SKIPPED, differing hash predicts CONFLICT. Test `--expect-rows` against actual file length and ensure no hardcoded 21 in reusable validation.

- [ ] **Step 5: Run CLI helper tests RED**

Run `npx vitest run scripts/lib/historicalQuotationImport.test.ts` and confirm the new server-aware classification assertions fail before implementation.

- [ ] **Step 6: Implement import CLI**

Follow the established admin-script flow — see `scripts/import-supplier-prices.ts:20-44` for the working example:

```ts
Amplify.configure(amplifyOutputs);
const client = generateClient<Schema>({ authMode: 'userPool' });
await authenticate();                    // scripts/lib/auth.ts — reads ADMIN_EMAIL/ADMIN_PASSWORD from .env
// …then per-call { authMode: 'userPool' }
```

Print the batch ID first. Default is the server-consulting dry run; only `--apply` calls import. Print counts and every flagged row. Do not open the workbook or claim to verify its hash — the importer never sees the workbook (spec §4.2 step 2).

- [ ] **Step 7: Implement rollback CLI**

`--batch <id>` calls PREVIEW and prints source/counts/warnings/token. Only `--apply --reason <text>` sends APPLY with that returned token. It never imports DynamoDB clients or accepts individual IDs.

- [ ] **Step 8: Add failing probe/seeder safety tests**

Test that the probe treats typed server VALIDATION/NOT_FOUND responses as successful field reachability but rejects GraphQL unknown-field/network errors; assert the malformed import probe cannot reach a manifest Put. Test that the seeder rejects the configured production pool, independently resolves the loaded pool's CloudFormation stack, refuses a stack name that lacks both `sandbox` and `historical-import-review`, uses a fabricated supplier, emits exactly `MAX_IMPORT_ROWS`, and writes only under `/tmp`.

- [ ] **Step 9: Run probe/seeder tests RED**

Run `npx vitest run scripts/lib/historicalQuotationImport.test.ts` and confirm these new assertions fail before either script exists.

- [ ] **Step 10: Implement safe deployment probe and sandbox seeder**

`probe-historical-quotation-api.ts` authenticates through the current outputs and proves the deployed schema/handler contains all four operations without writing: list with limit 1; get a syntactically valid nonexistent ID and require typed NOT_FOUND; call import with deliberately malformed/missing `importBatchId` and require server-side VALIDATION before manifest creation; call rollback PREVIEW for a nonexistent batch and require typed NOT_FOUND. A GraphQL “unknown field” error fails the probe.

`seed-historical-import-sandbox.ts` is sandbox-only. It authenticates, creates or exact-matches one fabricated supplier, generates a deterministic 50-row synthetic normalized file using the shared hash helpers and that real sandbox `supplierId`, writes it to `/tmp/historical-import-sandbox-50.json`, and prints its batch ID. It requires `ALLOW_SANDBOX_SEED=1` and `PRODUCTION_POOL_ID`; rejects when the loaded pool equals that production denylist; then independently invokes the already-required AWS CLI (`cloudformation describe-stack-resources` followed by `describe-stacks`) to resolve the loaded pool's owning stack and requires its actual stack name to contain both `sandbox` and the fixed identifier `historical-import-review`. A caller echoing the loaded pool into an env var is not a sandbox proof; do not add another AWS SDK dependency solely for this guard.

- [ ] **Step 11: Verify GREEN and commit**

Add all four Task 7 scripts to the explicit `tsconfig.scripts.json` include list now that they exist.

```bash
npx vitest run src/services/priceAdminService.test.ts scripts/lib/historicalQuotationImport.test.ts
npx tsc --noEmit
npx tsc --noEmit -p tsconfig.scripts.json
git add src/services/priceAdminService.ts src/services/priceAdminService.test.ts scripts/import-historical-quotations.ts scripts/rollback-historical-import.ts scripts/probe-historical-quotation-api.ts scripts/seed-historical-import-sandbox.ts scripts/lib/historicalQuotationImport.ts scripts/lib/historicalQuotationImport.test.ts tsconfig.scripts.json
git commit -m "feat(pricebook): add historical quote operator clients"
```

---

### Task 8: Live/Historical quotation list UX

**Files:**
- Modify: `src/pages/admin/QuotationListPage.tsx`
- Modify: `src/pages/admin/QuotationListPage.test.tsx`

**Produces:** segmented tabs with isolated state and truthful empty/setup guidance.

- [ ] **Step 1: Write failing tab and cursor tests**

Assert initial Live query only, Historical query on tab selection, independent item arrays/loading/errors/next tokens, correct “Load more” target per active tab, and no loss of live state when switching back.

- [ ] **Step 2: Write failing historical-row tests**

Assert the row key **directly**, not by proxy: render ≥2 historical rows and either give each row `data-testid={historicalId}` and assert uniqueness, or spy on `console.error` for React's "Encountered two children with the same key" warning. "Stable rendering/reorder behavior" would not catch this — React renders duplicate-keyed siblings anyway, it only warns. Spec §5's concern is concrete: with the live key `` `${q.quotationNumber}-${q.version}` ``, all 21 historical rows collide on `"undefined-undefined"`.

Also assert: link `/admin/quotations/historical/<historicalId>`, fallback label `Historical #<sourceRow>`, product/project column, legacy status, USD amount/date, and fixed badge precedence `INCOMPLETE → UNCONFIRMED → CONFLICT_RESOLVED` with `+N` count.

- [ ] **Step 3: Write absence-of-live-actions and empty-state tests**

Historical rows must not show version, cost/margin edit controls, PDF, conversion, or Create action. Live behavior remains unchanged. Empty live state links Supplier → Price Book → New quotation; historical empty state explains script-only import without offering upload.

- [ ] **Step 4: Run UI tests RED**

Run `npx vitest run src/pages/admin/QuotationListPage.test.tsx` and confirm failures demonstrate the absent tab/historical rendering behavior.

- [ ] **Step 5: Implement accessible segmented tabs**

Use buttons with `role="tab"`, `aria-selected`, and associated panels. Do not issue both queries eagerly. Preserve the existing table styling while rendering separate table bodies rather than a discriminated shared union.

- [ ] **Step 6: Verify GREEN and commit**

```bash
npx vitest run src/pages/admin/QuotationListPage.test.tsx
git add src/pages/admin/QuotationListPage.tsx src/pages/admin/QuotationListPage.test.tsx
git commit -m "feat(admin): separate live and historical quotations"
```

---

### Task 9: Immutable historical detail page and route

**Files:**
- Create: `src/pages/admin/HistoricalQuotationDetailPage.tsx`
- Create: `src/pages/admin/HistoricalQuotationDetailPage.test.tsx`
- Modify: `src/routes/AdminRoutes.tsx`

**Produces:** `/admin/quotations/historical/:historicalId`.

- [ ] **Step 1: Write failing detail tests**

Cover loading/error/not-found, raw supplier/customer quotes, configuration, basis/evidence, original quote/dates/status, structured money only when present, all quality flags/notes, FX provenance/source/note, and source document/row/hash.

- [ ] **Step 2: Assert read-only behavior**

The rendered page contains no edit/save/PDF/send/convert/order action. Inferred FX is visibly labelled “Inferred”; UNKNOWN never displays a manufactured rate or margin.

- [ ] **Step 3: Run detail tests RED**

Run `npx vitest run src/pages/admin/HistoricalQuotationDetailPage.test.tsx` and confirm failure is the missing page/behavior.

- [ ] **Step 4: Implement page and lazy route**

Add the route to `src/routes/AdminRoutes.tsx`, alongside the existing quotation routes at `:72-74`:

```tsx
<Route path="quotations" element={<QuotationListPage />} />
<Route path="quotations/new" element={<QuotationWorkbenchPage />} />
<Route path="quotations/:quotationNumber" element={<QuotationWorkbenchPage />} />
```

Use the exact path `quotations/historical/:historicalId` (the tree is nested under `/admin`). **Declaration order does not matter** — this repo is on `react-router-dom ^6.30.4`, which ranks routes by specificity rather than matching in source order, and `quotations/historical/:historicalId` (3 segments) cannot be captured by `quotations/:quotationNumber` (2 segments) under any ordering. The existing `quotations/new` vs `quotations/:quotationNumber` pair at `:73-74` already relies on that ranking. Do not reorder anything to "avoid capture"; there is no capture to avoid.

Follow the file's existing lazy shape — `lazyWithReload` with a **named** export, not a default:

```tsx
const HistoricalQuotationDetailPage = lazyWithReload(() =>
  import('../pages/admin/HistoricalQuotationDetailPage')
    .then((m) => ({ default: m.HistoricalQuotationDetailPage })));
```

- [ ] **Step 5: Verify GREEN and commit**

```bash
npx vitest run src/pages/admin/HistoricalQuotationDetailPage.test.tsx src/pages/admin/QuotationListPage.test.tsx
npx tsc --noEmit
git add src/pages/admin/HistoricalQuotationDetailPage.tsx src/pages/admin/HistoricalQuotationDetailPage.test.tsx src/routes/AdminRoutes.tsx
git commit -m "feat(admin): show immutable historical quote details"
```

---

### Task 10a: Cross-layer verification (subagent-executable)

**Files:**
- Modify: this plan only if measured commands/results require correction.

**Prerequisite:** `amplify_outputs.json` must exist at the worktree root. It is untracked and **absent from a fresh worktree**, and without it `npx tsc --noEmit`, `npx tsc --noEmit -p tsconfig.scripts.json`, and `npm run build` all fail on `Cannot find module '../amplify_outputs.json'` — *before any plan code is written*. Copy it from the canonical checkout first, or you will read a pre-existing environment failure as your own regression.

- [ ] **Step 1: Run the focused suite**

```bash
npx vitest run \
  amplify/functions/price-api/lib/historicalQuotation.test.ts \
  amplify/functions/price-api/resolvers/historicalQuotationResolvers.test.ts \
  amplify/functions/price-api/resolvers/keyspaceImmutability.test.ts \
  amplify/functions/price-api/handler.test.ts \
  scripts/lib/historicalQuotationImport.test.ts \
  scripts/build-hygiene.test.ts \
  src/services/priceAdminService.test.ts \
  src/pages/admin/QuotationListPage.test.tsx \
  src/pages/admin/HistoricalQuotationDetailPage.test.tsx
```

- [ ] **Step 2: Run repository verification**

```bash
npx tsc --noEmit
npm run typecheck:amplify
npx tsc --noEmit -p tsconfig.scripts.json
npm test -- --run
npm run build
git diff --check
```

- [ ] **Step 3: Cross-layer contract review**

Compare the exact four names and payloads across schema, handler, resolver, service, and scripts. Confirm: 18-op gate table equals dispatch map; no Scan/FilterExpression; no shared `QUOTATIONS` historical reads; no `supplierAmountMinor`, `supplierCurrency`, `CNY`, scalar `dataQuality`, 45-row cap, `/history/` route, or live status widening remains. Also confirm no OEM name, ¥ figure, or client path has crept into any tracked file.

**Task 10a ends here. Stop and hand off to the operator.**

---

### Task 10b: Deployment, sandbox measurement, and production import (OPERATOR-EXECUTED)

> ## 🛑 STOP — DO NOT EXECUTE AS A SUBAGENT
>
> Every step below deploys cloud infrastructure or performs **real writes**. A subagent must not run any of them, must not "verify" them, and must not check their boxes. Report that implementation is complete and Task 10b is pending a human operator, then stop.
>
> These steps need the confidential workbook, the internal operator record, and `ADMIN_EMAIL`/`ADMIN_PASSWORD` — none of which a subagent should hold. The checkbox syntax is retained only so the human can track the runbook.

- [ ] **Step 1: Deploy the sandbox backend and generate current outputs**

Before any deployment, run the operator-supplied secret scan across the reviewed commit. Then deploy the backend once and write outputs into the worktree:

```bash
export HISTORICAL_CONFIDENTIAL_TERMS_FILE="…" # out-of-repo newline-separated terms
test -n "$HISTORICAL_CONFIDENTIAL_TERMS_FILE"
npx tsx scripts/check-historical-confidentiality.ts "$HISTORICAL_CONFIDENTIAL_TERMS_FILE"
npx ampx sandbox --once --identifier historical-import-review --outputs-out-dir .
```

`amplify_outputs.json` supplies endpoint/auth configuration but does **not** enumerate custom GraphQL fields. Create and confirm a sandbox user, add it to `admin`, seed a fabricated supplier/file, and use the authenticated non-writing probe to prove operation deployment:

```bash
export SANDBOX_ADMIN_EMAIL="sandbox-historical-import@example.invalid"
export ADMIN_EMAIL="$SANDBOX_ADMIN_EMAIL"
export ADMIN_PASSWORD="${SANDBOX_ADMIN_PASSWORD:?set a temporary sandbox password}"
POOL_ID=$(node -e "console.log(require('./amplify_outputs.json').auth.user_pool_id)")
REGION=${POOL_ID%%_*}
test -n "$PRODUCTION_POOL_ID" # independent denylist; obtain from current production outputs

aws cognito-idp admin-get-user --region "$REGION" --user-pool-id "$POOL_ID" \
  --username "$ADMIN_EMAIL" >/dev/null 2>&1 || \
aws cognito-idp admin-create-user --region "$REGION" --user-pool-id "$POOL_ID" \
  --username "$ADMIN_EMAIL" --user-attributes Name=email,Value="$ADMIN_EMAIL" \
  Name=email_verified,Value=true --message-action SUPPRESS
aws cognito-idp admin-set-user-password --region "$REGION" --user-pool-id "$POOL_ID" \
  --username "$ADMIN_EMAIL" --password "$ADMIN_PASSWORD" --permanent
npx tsx scripts/add-admin-user.ts "$ADMIN_EMAIL" --pool "$POOL_ID"

npx tsx scripts/probe-historical-quotation-api.ts
ALLOW_SANDBOX_SEED=1 PRODUCTION_POOL_ID="$PRODUCTION_POOL_ID" \
  npx tsx scripts/seed-historical-import-sandbox.ts
```

The seeder must report a real sandbox `supplierId`, exactly 50 rows, `/tmp/historical-import-sandbox-50.json`, and a batch ID. Stop if user creation, group assignment, supplier creation, or any safe probe fails.

- [ ] **Step 2: 50-row latency measurement (sandbox)**

Against sandbox, import `/tmp/historical-import-sandbox-50.json` with `--apply` and record duration below the Lambda 30-second timeout. If insufficient headroom, lower `MAX_IMPORT_ROWS` (Task 4 Step 2 makes this one line) and update the tests/spec measurement note; do not alter semantics or split the reviewed 21-row batch unless measurement requires it. Roll back the printed batch through PREVIEW/APPLY using `scripts/rollback-historical-import.ts` and confirm manifest/audit survival.

After sandbox measurement, clear sandbox credentials before changing outputs:

```bash
unset ADMIN_EMAIL ADMIN_PASSWORD SANDBOX_ADMIN_PASSWORD
```

- [ ] **Step 3: Merge and verify the production backend deployment**

Run the confidentiality scan again against the exact commit to be merged; abort on any match. This second gate catches tracked changes made after sandbox verification. Then merge through the normal main-branch workflow, wait for the Amplify deployment to finish successfully, and regenerate outputs from the deployed target—not from a stale checkout:

```bash
test -n "$AMPLIFY_APP_ID"
npx tsx scripts/check-historical-confidentiality.ts "$HISTORICAL_CONFIDENTIAL_TERMS_FILE"
npx ampx generate outputs --app-id "$AMPLIFY_APP_ID" --branch main --out-dir .

: "${PRODUCTION_ADMIN_EMAIL:?set the existing production admin email}"
: "${PRODUCTION_ADMIN_PASSWORD:?set its production password}"
test "$PRODUCTION_ADMIN_EMAIL" != "$SANDBOX_ADMIN_EMAIL"
export ADMIN_EMAIL="$PRODUCTION_ADMIN_EMAIL"
export ADMIN_PASSWORD="$PRODUCTION_ADMIN_PASSWORD"
npx tsx scripts/probe-historical-quotation-api.ts
```

Fresh outputs are necessary for endpoint/auth targeting but cannot prove custom fields exist. The production probe above performs no writes and must reach all four server resolvers using credentials distinct from the sandbox user. Stop on GraphQL unknown-field, auth, or network errors. Do not run `ampx pipeline-deploy` ad hoc when the normal Amplify main-branch pipeline is the release authority.

- [ ] **Step 4: Operator reconciliation before production apply**

Set `HISTORICAL_WORKBOOK_PATH` to the workbook in the out-of-repo client folder — never paste the path into this file, per spec §4.1 ("an out-of-repo path supplied by argv or environment variable") and the Confidentiality note:

```bash
export HISTORICAL_WORKBOOK_PATH="…"   # out-of-repo; do not commit
export HISTORICAL_SUPPLIER_NAME="…"   # out-of-repo; do not commit
export HISTORICAL_ADJUDICATION_PATH="…" # out-of-repo confidential JSON

# Add exact local filenames to the non-versioned exclude file.
printf '%s\n' "$(basename "$HISTORICAL_WORKBOOK_PATH")" \
  "$(basename "$HISTORICAL_ADJUDICATION_PATH")" >> .git/info/exclude

npx tsx scripts/normalize-historical-quotations.ts \
  "$HISTORICAL_WORKBOOK_PATH" /tmp/historical-quotations.normalized.json \
  --adjudication "$HISTORICAL_ADJUDICATION_PATH"
npx tsx scripts/import-historical-quotations.ts \
  /tmp/historical-quotations.normalized.json --expect-rows 21
```

Re-run normalization and byte-diff the outputs. Review all 21 dry-run rows and require predicted `21 IMPORTED / 0 CONFLICT` for the first import. Verify the ICP value and its adjudication note explicitly against the operator record.

- [ ] **Step 5: Apply and verify invariants (PRODUCTION)**

```bash
npx tsx scripts/import-historical-quotations.ts \
  /tmp/historical-quotations.normalized.json --expect-rows 21 --apply
```

Record the printed `importBatchId` in the internal deployment record — it is the only handle on rollback. Verify zero DRAFT creation, unchanged live quotation counter, and no catalog/CostVersion mutation with strongly consistent base-table/detail reads. Poll the Historical GSI list with bounded exponential backoff for up to two minutes until all expected rows are visible; a timeout is a verification failure, while transient absence before the deadline is normal GSI propagation. Re-run the dry run and require 21 SKIPPED / 0 CONFLICT.

- [ ] **Step 6: Record rollback readiness without deleting production data**

Run rollback PREVIEW only. Confirm 21 matched/deletable, correct source document/hash, zero blocked. Store the batch ID in the internal deployment record. Do not APPLY unless correcting the batch.

- [ ] **Step 7: Final check**

```bash
git status --short
git log --oneline --decorate -12
```

Commit only necessary verification/runbook corrections. Never commit the workbook, the normalized production JSON, the supplier name, or any ¥ figure. `/tmp/historical-quotations.normalized.json` stays out of the repo.

## Plan self-review checklist

- [ ] No OEM/supplier name, ¥ figure, workbook filename, or client path appears in any tracked file. This repo is **public**.
- [ ] Every v2.1 spec constraint (§1–§11) maps to at least one task and one verification — including §7.1's immutability assertion over the **existing** mutation surface (Task 5 Step 6), which §9 routes constraint 9 through.
- [ ] Tasks 1, 2, 3, 4, 5, 6 each have an explicit RED step before implementation.
- [ ] Identity, content, and batch-id hashes have frozen known-answer vectors, not just shape assertions.
- [ ] Task 10b is fenced off from subagent execution and reads as operator-only.
- [ ] `historicalId` has exactly two lineage inputs and `contentHash` has the pinned coverage/exclusion set.
- [ ] Manifest-first import, ALL_OLD collision classification, partial replay, rollback token, hard delete conditions, and audit survival form one tested recovery cycle.
- [ ] Historical list is an independent partition/query/cursor and the live quotation type/resolver remain untouched.
- [ ] Money names, FX provenance, quality flags, ICP adjudication, and operator stamping match the spec exactly.
- [ ] No confidential production data or placeholder code is included.
- [ ] Search passes with no stale v1 terms: shared historical `QUOTATIONS`, 45-row cap, scalar `dataQuality`, `supplierAmountMinor`, `/history/`, or blended list union.
