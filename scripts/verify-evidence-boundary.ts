// scripts/verify-evidence-boundary.ts
// Executable acceptance for the no-leak boundary + seed lifecycle. Asserts:
//  (a) the base Evidence model is NOT publicly readable via apiKey;
//  (b) listPublishedEvidence succeeds (errors are a failure, not an empty set)
//      and returns a well-formed array of published-only records;
//  (c) a UNIQUE seed slug is present exactly once when published and absent when
//      draft/archived — independent of any other published Evidence, and immune
//      to a broken resolver that always returns [].
// Usage:
//   EVIDENCE_TEST_TITLE="Boundary Test 2026-07-04" EVIDENCE_EXPECT=draft \
//   npx tsx scripts/verify-evidence-boundary.ts
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import outputs from '../amplify_outputs.json';
import type { Schema } from '../amplify/data/resource';
import { EVIDENCE_STATUS } from '../amplify/lib/evidence/status';

Amplify.configure(outputs);
const client = generateClient<Schema>({ authMode: 'apiKey' });

const TEST_TITLE = process.env.EVIDENCE_TEST_TITLE;
const EXPECT = process.env.EVIDENCE_EXPECT; // draft | published | archived
const PRODUCT = process.env.EVIDENCE_TEST_PRODUCT ?? 'ald';
const VALID_EXPECT = new Set(Object.values(EVIDENCE_STATUS));

async function main() {
  if (!TEST_TITLE || !EXPECT || !VALID_EXPECT.has(EXPECT as never)) {
    throw new Error('Set EVIDENCE_TEST_TITLE and EVIDENCE_EXPECT (draft|published|archived).');
  }

  // (a) base-model public read must be DENIED *by authorization* — not merely
  // "errored". A schema/resolver/service error must NOT be mistaken for a denial.
  const baseRead = await client.models.Evidence.list();
  if (!baseRead.errors || baseRead.errors.length === 0) {
    throw new Error('SECURITY FAIL: base Evidence model is publicly readable via apiKey');
  }
  // AppSync surfaces authorization failures with errorType 'Unauthorized'
  // (occasionally 'UnauthorizedException'). Fall back to a message match only if
  // the deployed error shape lacks errorType — confirm against the sandbox's
  // actual response and tighten if needed.
  const isAuthDenial = (e: { errorType?: string; message?: string }) =>
    e.errorType === 'Unauthorized' ||
    e.errorType === 'UnauthorizedException' ||
    /not\s*authorized|unauthorized/i.test(e.message ?? '');
  if (!baseRead.errors.some(isAuthDenial)) {
    throw new Error(`SECURITY FAIL: expected an authorization denial on the base model, got: ${JSON.stringify(baseRead.errors)}`);
  }
  console.log('OK: base model apiKey read denied (authorization):', baseRead.errors.find(isAuthDenial)?.message);

  // (b) custom query must SUCCEED — a null/errored response is a failure, not [].
  const res = await client.queries.listPublishedEvidence({ productSlug: PRODUCT });
  if (res.errors?.length) {
    throw new Error(`SECURITY FAIL: listPublishedEvidence errored: ${res.errors.map((e) => e.message).join(', ')}`);
  }
  const parsed = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
  if (!Array.isArray(parsed)) {
    throw new Error(`SECURITY FAIL: listPublishedEvidence returned a non-array payload: ${JSON.stringify(res.data)}`);
  }
  const items = parsed as { title?: string; status: string }[];

  // every returned record must be published
  const leaked = items.filter((e) => e.status !== EVIDENCE_STATUS.PUBLISHED);
  if (leaked.length) throw new Error(`SECURITY FAIL: ${leaked.length} non-published record(s) returned`);

  // (c) seed-identity lifecycle — matched by title (slug is not in the public payload)
  const mine = items.filter((e) => e.title === TEST_TITLE);
  if (EXPECT === EVIDENCE_STATUS.PUBLISHED) {
    if (mine.length !== 1) throw new Error(`FAIL: expected seed "${TEST_TITLE}" exactly once while published, saw ${mine.length}`);
  } else {
    if (mine.length !== 0) throw new Error(`FAIL: seed "${TEST_TITLE}" must be absent while ${EXPECT}, saw ${mine.length}`);
  }
  console.log(`OK: phase=${EXPECT}, seed "${TEST_TITLE}" occurrences=${mine.length}, all ${items.length} returned record(s) published.`);
}
main().catch((e) => { console.error(e); process.exit(1); });
