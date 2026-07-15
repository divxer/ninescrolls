# Task 7 report

## Outcome

- Added separate historical summary/detail contracts and exactly four historical service operations; live `QuotationSummary.status` remains `'DRAFT'`.
- Added a server-aware, dry-run-by-default importer. It performs one get per normalized row, predicts `IMPORTED`/`SKIPPED`/`CONFLICT`, and imports only with `--apply`.
- Added preview-first rollback; APPLY requires both the preview token and `--reason`. No script imports DynamoDB APIs or accepts record IDs.
- Added a read-only deployment probe. Its malformed import omits `importBatchId`, which the handler validates before supplier reads or manifest Put.
- Added sandbox synthetic-file seeding guarded by an independent production-pool denylist and AWS CLI resolution of the pool's owning CloudFormation stack. Both `sandbox` and `historical-import-review` are mandatory. Output is fixed to `/tmp/historical-import-sandbox-50.json`; records and supplier are explicitly fabricated.
- Centralized `MAX_IMPORT_ROWS` in the domain helper and used it by the resolver, seeder, and tests. Registered all scripts explicitly in `tsconfig.scripts.json`.

## TDD evidence

### RED — service contract

`npx vitest run src/services/priceAdminService.test.ts`

- 10 passed, 1 failed.
- Expected failure: `TypeError: listHistoricalQuotations is not a function`.

### GREEN — service contract

Same command after implementation: 11/11 passed.

### RED — CLI helper

`npx vitest run scripts/lib/historicalQuotationImport.test.ts`

- 11 passed, 5 failed.
- Expected missing helpers: `classifyHistoricalDryRun`, `validateExpectedRows`, `assertProbeResult`, `assertSandboxTarget`, and `syntheticSandboxRows`.
- These cover the separate CLI-helper and probe/seeder safety RED checkpoints; no cloud script was executed.

### GREEN and regression

`npx vitest run src/services/priceAdminService.test.ts scripts/lib/historicalQuotationImport.test.ts amplify/functions/price-api/resolvers/historicalQuotationResolvers.test.ts`

- 3 files passed, 70/70 tests passed.

## Type and security evidence

- `npx tsc --noEmit` — exit 0.
- `npx tsc --noEmit -p tsconfig.scripts.json` — exit 0.
- `git diff --check` — exit 0.
- Static search found no DynamoDB client/command imports in any of the four operator scripts.
- Static inspection confirms the only synthetic output path is under `/tmp`, the stack fixed identifier is literal, and no confidential workbook/data path is embedded.
- No cloud, authentication, production, or sandbox command was run.
