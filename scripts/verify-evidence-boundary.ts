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
import { EVIDENCE_STATUS } from '../amplify/lib/evidence/status';
import { type EvidenceGraphqlClient } from './lib/evidenceSeedOperations';
import { assertBaseEvidenceReadDenied, readPublishedEvidence } from './lib/evidencePublicRead';

Amplify.configure(outputs);
// Raw apiKey GraphQL (not the typed .queries/.models accessors) so a stale
// amplify_outputs.json introspection can't make this crash — see
// ./lib/evidencePublicRead. authMode is passed per request.
const client = generateClient() as unknown as EvidenceGraphqlClient;

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
  // Uses a raw `listEvidences` query under apiKey (see ./lib/evidencePublicRead).
  const denialMessage = await assertBaseEvidenceReadDenied(client);
  console.log('OK: base model apiKey read denied (authorization):', denialMessage);

  // (b) custom query must SUCCEED — a null/errored response is a failure, not [].
  // readPublishedEvidence throws on errors and on a null/non-array payload.
  const { records } = await readPublishedEvidence(client, PRODUCT);
  const items = records as { title?: string; status: string }[];

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
