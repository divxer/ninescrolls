/**
 * One-off correction: the held arXiv preprint (#20) was seeded launchEligible=true
 * (tier A, substantial) while kept as a draft. The GLOBAL
 * publish-launch-eligible-evidence.ts publishes ANY launchEligible draft
 * (product-agnostic), so it would auto-publish this held preprint. Force
 * launchEligible=false + a held marker so it stays a draft until it's peer-reviewed.
 *
 * The seeder now computes launchEligible=false for preprints, so a fresh re-seed
 * is already correct; this fixes the record that predates that change on prod.
 *
 * Idempotent: converges when already held. Only touches the explicit slug.
 *
 * Usage:  set -a; source .env; set +a; npx tsx scripts/hold-plutovac-preprint.ts --apply
 */
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { authenticate } from './lib/auth';
import {
  checkedGraphql,
  evidenceBySlug,
  requireApply,
  type EvidenceGraphqlClient,
} from './lib/evidenceSeedOperations';
import amplifyOutputs from '../amplify_outputs.json';

Amplify.configure(amplifyOutputs as any);
const client = generateClient() as unknown as EvidenceGraphqlClient;

const UPDATE = `mutation UpdateEvidence($input:UpdateEvidenceInput!){ updateEvidence(input:$input){ id slug status meta } }`;
const AUTH = { authMode: 'userPool' as const };

const SLUG = 'pub-plutovac-singlemol-fiber-arxiv-2025'; // #20, arXiv preprint
const HELD_REASON = 'arXiv preprint — held as draft until peer-reviewed; not launch-eligible.';

async function main() {
  requireApply(process.argv.slice(2), 'hold-plutovac-preprint');
  await authenticate();

  const rec = await evidenceBySlug(client, SLUG);
  if (!rec) throw new Error(`${SLUG} not found`);
  if (rec.status === 'published') {
    throw new Error(`${SLUG} is already published — refusing to silently hold a live record; investigate first`);
  }
  const meta = rec.meta ? JSON.parse(rec.meta) : {};
  if (meta.launchEligible === false && meta.held === true && meta.heldReason === HELD_REASON) {
    console.log(`converged (already held): ${SLUG}`);
    return;
  }
  meta.launchEligible = false;
  meta.held = true;
  meta.heldReason = HELD_REASON;

  const res = await checkedGraphql<{ data: { updateEvidence: { meta?: string } | null } }>(
    client, { query: UPDATE, variables: { input: { id: rec.id, meta: JSON.stringify(meta) } }, ...AUTH }, `hold ${SLUG}`,
  );
  const got = res.data.updateEvidence?.meta ? JSON.parse(res.data.updateEvidence.meta) : {};
  if (got.launchEligible !== false || got.held !== true) {
    throw new Error(`hold ${SLUG} failed: held postcondition not met`);
  }
  console.log(`held: ${SLUG} (launchEligible=false, held=true)`);
}
main().catch((e) => { console.error(e); process.exit(1); });
