/**
 * SCOPED publisher for the plasma-cleaner (PLUTOVAC) evidence line.
 *
 * Publishes ONLY the explicit slugs below (the two peer-reviewed, launch-eligible
 * papers) — it never scans/derives the set, so it CANNOT clobber another product
 * line's publish gates the way the global publish-launch-eligible-evidence.ts
 * would. The arXiv preprint (pub-plutovac-singlemol-fiber-arxiv-2025) is
 * deliberately held as a draft.
 *
 * Safety preconditions (abort before any write if violated): each slug must
 * exist, be type:publication, tagged products:['plasma-cleaner'], carry
 * meta.launchEligible===true, and not be archived.
 *
 * Idempotent: an already-published record converges (no write). Draft → sets
 * status:published + publishDate (ISO now, only when absent — matches the admin
 * auto-stamp).
 *
 * Usage:  set -a; source .env; set +a; npx tsx scripts/publish-plutovac-evidence.ts --apply
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

const UPDATE = `mutation UpdateEvidence($input:UpdateEvidenceInput!){ updateEvidence(input:$input){ id slug status publishDate } }`;
const AUTH = { authMode: 'userPool' as const };

// The two peer-reviewed launch-eligible plasma-cleaner papers. The preprint
// (#20) is intentionally NOT here.
const SLUGS = [
  'pub-plutovac-phase-shifter-micromachines-2025', // #9  PLUTO-F, Micromachines 2025, primary
  'pub-plutovac-optofluidic-mzi-boe-2024',         // #5  PLUTO-T, Biomed. Opt. Express 2024, substantial
];

async function main() {
  requireApply(process.argv.slice(2), 'publish-plutovac-evidence');
  await authenticate();

  // Preflight ALL slugs before any write (fail fast, no partial publish).
  const records = [] as Array<{ id: string; slug: string; status?: string; publishDate?: string | null }>;
  for (const slug of SLUGS) {
    const rec = await evidenceBySlug(client, slug);
    if (!rec) throw new Error(`preflight: ${slug} not found`);
    if (rec.type !== 'publication') throw new Error(`preflight: ${slug} is not a publication (${rec.type})`);
    if (rec.status === 'archived') throw new Error(`preflight: ${slug} is archived`);
    if (!rec.products?.includes('plasma-cleaner')) {
      throw new Error(`preflight: ${slug} is not tagged plasma-cleaner (${JSON.stringify(rec.products)})`);
    }
    let meta: Record<string, unknown> = {};
    try { meta = rec.meta ? JSON.parse(rec.meta) : {}; } catch { /* handled below */ }
    if (meta.launchEligible !== true) {
      throw new Error(`preflight: ${slug} is not launchEligible (refusing to publish an incidental/tier-B record)`);
    }
    records.push(rec as any);
  }

  const now = new Date().toISOString();
  let published = 0, converged = 0;
  for (const rec of records) {
    if (rec.status === 'published') {
      console.log(`converged (already published): ${rec.slug}`);
      converged++;
      continue;
    }
    const input: Record<string, unknown> = { id: rec.id, status: 'published' };
    if (!rec.publishDate) input.publishDate = now;
    const res = await checkedGraphql<{ data: { updateEvidence: { status?: string } | null } }>(
      client, { query: UPDATE, variables: { input }, ...AUTH }, `publish ${rec.slug}`,
    );
    if (res.data.updateEvidence?.status !== 'published') {
      throw new Error(`publish ${rec.slug} failed: published postcondition not met`);
    }
    console.log(`published: ${rec.slug}`);
    published++;
  }

  console.log(`\nDone. published=${published} converged=${converged} (of ${SLUGS.length}).`);
  console.log('Now run scripts/verify-evidence-no-oem.ts to confirm no PLUTOVAC token leaks in the public payload.');
}
main().catch((e) => { console.error(e); process.exit(1); });
