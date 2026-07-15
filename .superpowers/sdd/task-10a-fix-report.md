# Task 10a fix report — dispatch-surface classification

## Status

**DONE.** The keyspace immutability contract now classifies the complete 18-operation price API dispatch surface without treating trusted historical operator mutations as live mutations. No production code was changed, Task 10b was not performed, and no cloud operation was run.

## Scope and root cause

- Worktree: `/Users/harvey/Dev/src/cursor/ninescrolls/.claude/worktrees/historical-quotation-import`
- Changed contract: `amplify/functions/price-api/resolvers/keyspaceImmutability.test.ts`
- Root cause: the contract classified the original six reads and eight live mutations, while the handler had added four historical operations. The contract had no category for historical operator mutations, whose intended behavior is to write `PHIST#` / `HISTIMPORT#` records.

The failure was therefore classification drift in the test contract, not a production handler or resolver defect.

## RED evidence

Command:

```bash
npx vitest run amplify/functions/price-api/resolvers/keyspaceImmutability.test.ts amplify/functions/price-api/handler.test.ts
```

Result before the fix: exit 1; 1/2 files failed, 48/49 tests passed. The sole failure was:

```text
price mutation keyspace immutability > classifies the complete real dispatch surface so any future operation causes drift
expected the 18 real resolver fields to equal the 14 classified fields
```

The missing operations were:

- `pbListHistoricalQuotations`
- `pbGetHistoricalQuotation`
- `pbImportHistoricalQuotations`
- `pbRollbackHistoricalQuotationImport`

All eight existing live mutation adversarial-keyspace tests passed during the red run.

## Minimal contract fix

The test-only change:

1. Adds `pbListHistoricalQuotations` and `pbGetHistoricalQuotation` to `READ_OPERATIONS`.
2. Adds the explicit `TRUSTED_OPERATOR_MUTATIONS` category containing `pbImportHistoricalQuotations` and `pbRollbackHistoricalQuotationImport`.
3. Includes all three categories in the dispatch-surface equality gate:
   - 8 reads
   - 8 live mutation cases
   - 2 trusted historical operator mutations

The existing `cases` object and its eight parameterized adversarial identifier tests are unchanged. Consequently, live mutations still must emit owned live keys and must never emit `PHIST#` / `HISTIMPORT#` keys, while import and rollback are deliberately excluded from that inappropriate assertion because those keyspaces are their trusted mutation target.

## GREEN and verification evidence

### Focused tests

```bash
npx vitest run amplify/functions/price-api/resolvers/keyspaceImmutability.test.ts amplify/functions/price-api/handler.test.ts
```

Result: exit 0; 2/2 files passed, 49/49 tests passed.

### Amplify typecheck

```bash
npm run typecheck:amplify
```

Result: exit 0; `tsc --noEmit -p amplify/tsconfig.json` completed without errors.

### Diff hygiene

```bash
git diff --check
```

Result: exit 0; no whitespace errors.

## Concerns

None within Task 10a scope. Value-level confidentiality verification remains the explicitly separate Task 10b operator responsibility and was not run here.
