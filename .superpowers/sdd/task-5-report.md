# Task 5 report

## RED evidence

Command: `npx vitest run amplify/functions/price-api/resolvers/historicalQuotationResolvers.test.ts`

Observed: 8 expected failures (`TypeError: pbRollbackHistoricalQuotationImport is not a function`), while the existing 25 tests remained green. This established non-vacuous RED against the missing rollback behavior, not module-resolution noise.

## GREEN evidence

Command: `npx vitest run amplify/functions/price-api/resolvers/historicalQuotationResolvers.test.ts amplify/functions/price-api/resolvers/keyspaceImmutability.test.ts`

Observed: 2 files passed, 44 tests passed, 0 failed.

Command: `npm run typecheck:amplify`

Observed: `tsc --noEmit -p amplify/tsconfig.json` exited 0 with no diagnostics.

Command: `git diff --check`

Observed: exited 0 with no whitespace errors.

## Implemented files

- `amplify/functions/price-api/resolvers/historicalQuotationResolvers.ts`
- `amplify/functions/price-api/resolvers/historicalQuotationResolvers.test.ts`
- `amplify/functions/price-api/resolvers/keyspaceImmutability.test.ts`

## Behavior and self-review

- PREVIEW strongly consistently reads the immutable manifest and every intended primary key, and emits no writes.
- The token binds the current deletable IDs and content hashes; APPLY rejects missing/stale tokens before issuing a delete.
- APPLY iterates manifest intent, making `ALREADY_ABSENT` reachable. The 21-row truncated test proves 11 `DELETED`, 10 `ALREADY_ABSENT`, and 0 `FAILED`.
- Every delete carries the exact four-conjunct atomic condition and can address only a server-built `PHIST#<manifest-id>` key.
- Conditional failures use returned low-level DynamoDB `Item` evidence to distinguish `BLOCKED` from `ALREADY_ABSENT`; unexpected exceptions become `FAILED`.
- The immutable surviving audit has exactly the eleven domain fields plus PK/SK; `requestedBy` and `confirmedBy` remain separate. The manifest is never deleted.
- The dispatch-derived keyspace guard fails when a future create/update/append resolver is added without classification and checks all eight current mutation resolvers against adversarial identifiers.

## Concerns

- Rollback is intentionally non-transactional. Any partial APPLY changes live state, so its token cannot be reused; the operator must PREVIEW again before replay.
- Audit timestamp collisions fail closed through `attribute_not_exists(PK)`; no audit record can be overwritten.

## Commit

Recorded after final verification in the commit named `feat(pricebook): rollback historical quote batches safely`.

## Review-fix cycle

RED was observed with five targeted failures: intended-ID preview output, malformed manifest ID rejection,
loaded-ID mismatch blocking, missing pre-delete intent, and missing surviving evidence when final audit persistence fails.

The fix adds an immutable `ROLLBACK_INTENT#<requestedAt>` safety record before the first delete. It records
actor/confirmation, reason, token, source hash/documents, intended IDs, matched IDs/count, and uses
`attribute_not_exists(PK)`. The final `ROLLBACK#<completedAt>` record remains the exact eleven-field domain
audit (plus PK/SK). A final-audit failure now propagates after the already-persisted intent has survived.

Manifest IDs are validated as lowercase 64-hex before key construction, loaded `historicalId` must match
manifest intent, and PREVIEW returns all intended IDs. Partial APPLY recovery is exercised end-to-end:
the original token becomes stale, a fresh PREVIEW returns a new token, and replay converges.

The previous source-text keyspace check was replaced with actual invocation of every mutation resolver in
the real dispatch surface for all four adversarial IDs. Tests inspect real emitted write commands recursively,
assert resolver-owned prefixes, reject `PHIST#`/`HISTIMPORT#`, and deep-equal the complete dispatch
classification so future operation drift fails closed.
