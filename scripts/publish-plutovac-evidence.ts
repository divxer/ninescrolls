/**
 * SCOPED publisher for the plasma-cleaner (PLUTOVAC) evidence line.
 *
 * Publishes ONLY the explicit slugs below — it never scans/derives the set, so
 * it CANNOT clobber another product line's publish gates the way the global
 * publish-launch-eligible-evidence.ts would.
 *
 * SET = the 8 peer-reviewed, tier-A journal papers. The arXiv preprint
 * (pub-plutovac-singlemol-fiber-arxiv-2025) and the tier-B snippet-only record
 * (pub-plutovac-butterfly-wing-cej-2023) are deliberately excluded.
 *
 * Category exception (why 6 "incidental" papers are here): plasma cleaners are
 * BY DESIGN a surface-prep tool — cleaning / activation / bonding-prep IS their
 * job. So an "incidental" role in a peer-reviewed (tier-A) paper is a legitimate
 * endorsement for THIS product line, unlike an etch/depo tool where an incidental
 * clean step is weak. We therefore publish tier-A journal papers regardless of
 * capabilityRole, and stamp meta.launchEligible=true + meta.launchRationale on the
 * incidental ones so `published <=> launchEligible` stays consistent.
 *
 * Safety preconditions (abort before any write if violated): each slug must
 * exist, be type:publication, tagged products:['plasma-cleaner'],
 * meta.verificationTier==='A', NOT a preprint (journal must not contain "arXiv"),
 * and not be archived. (launchEligible is NOT required — that's the point.)
 *
 * Idempotent: converges when already published AND meta already stamped.
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

const UPDATE = `mutation UpdateEvidence($input:UpdateEvidenceInput!){ updateEvidence(input:$input){ id slug status meta publishDate } }`;
const AUTH = { authMode: 'userPool' as const };

const LAUNCH_RATIONALE =
  'plasma-cleaner category: surface cleaning/activation/bonding-prep IS the tool\'s designed purpose, so an incidental role in a peer-reviewed (tier-A) paper is a legitimate endorsement. Publish-approved 2026-07-19.';

// The 8 peer-reviewed tier-A journal papers. Preprint #20 and tier-B #7 excluded.
const SLUGS = [
  'pub-plutovac-phase-shifter-micromachines-2025',   // #9  PLUTO-F, Micromachines 2025, primary
  'pub-plutovac-optofluidic-mzi-boe-2024',           // #5  PLUTO-T, Biomed. Opt. Express 2024, substantial
  'pub-plutovac-metal-3d-nanoprint-natcommun-2023',  // #2  PLUTO-T, Nature Communications 2023, incidental
  'pub-plutovac-nanoantibiotics-sciadv-2023',        // #4  PLUTO-M, Science Advances 2023, incidental
  'pub-plutovac-laseremission-microdroplet-lsa-2025',// #8  PLUTO-T, Light: Sci & Appl 2025, incidental
  'pub-plutovac-saw-boundary-pre-2025',              // #17 PLUTO-T, Physical Review E 2025, incidental
  'pub-plutovac-bulkcusp-natcommun-2026',            // #21 PLUTO-T, Nature Communications 2026, incidental
  'pub-plutovac-dl-microfluidic-labchip-2026',       // #22 PLUTO-F, Lab on a Chip 2026, incidental
];

interface Rec { id: string; slug: string; status?: string; publishDate?: string | null; meta?: string | null; type?: string; products?: string[] | null; }

async function main() {
  requireApply(process.argv.slice(2), 'publish-plutovac-evidence');
  await authenticate();

  // Preflight ALL slugs before any write (fail fast, no partial publish).
  const records: Array<{ rec: Rec; meta: Record<string, any> }> = [];
  for (const slug of SLUGS) {
    const rec = await evidenceBySlug(client, slug) as Rec | null;
    if (!rec) throw new Error(`preflight: ${slug} not found`);
    if (rec.type !== 'publication') throw new Error(`preflight: ${slug} is not a publication (${rec.type})`);
    if (rec.status === 'archived') throw new Error(`preflight: ${slug} is archived`);
    if (!rec.products?.includes('plasma-cleaner')) {
      throw new Error(`preflight: ${slug} is not tagged plasma-cleaner (${JSON.stringify(rec.products)})`);
    }
    let meta: Record<string, any> = {};
    try { meta = rec.meta ? JSON.parse(rec.meta) : {}; } catch { throw new Error(`preflight: ${slug} has invalid meta JSON`); }
    if (meta.verificationTier !== 'A') {
      throw new Error(`preflight: ${slug} is not verificationTier A (got ${JSON.stringify(meta.verificationTier)})`);
    }
    if (typeof meta.journal === 'string' && /arxiv/i.test(meta.journal)) {
      throw new Error(`preflight: ${slug} looks like a preprint (journal=${meta.journal}) — refusing to publish`);
    }
    records.push({ rec, meta });
  }

  const now = new Date().toISOString();
  let published = 0, converged = 0, reclassified = 0;
  for (const { rec, meta } of records) {
    // Stamp the launch decision so published <=> launchEligible stays consistent.
    // Only incidental records need the override; primary/substantial already qualify.
    let metaChanged = false;
    if (meta.capabilityRole === 'incidental') {
      if (meta.launchEligible !== true) { meta.launchEligible = true; metaChanged = true; }
      if (!meta.launchRationale) { meta.launchRationale = LAUNCH_RATIONALE; metaChanged = true; }
      if (meta.publishPriority === 'wave3') { meta.publishPriority = 'wave2'; metaChanged = true; }
    }
    const needsStatus = rec.status !== 'published';

    if (!metaChanged && !needsStatus) {
      console.log(`converged (already published): ${rec.slug}`);
      converged++;
      continue;
    }

    const input: Record<string, unknown> = { id: rec.id };
    if (needsStatus) input.status = 'published';
    if (metaChanged) input.meta = JSON.stringify(meta);
    if (needsStatus && !rec.publishDate) input.publishDate = now;

    const res = await checkedGraphql<{ data: { updateEvidence: { id?: string; status?: string } | null } }>(
      client, { query: UPDATE, variables: { input }, ...AUTH }, `publish ${rec.slug}`,
    );
    if (!res.data.updateEvidence?.id) throw new Error(`publish ${rec.slug} failed: no record returned`);
    if (needsStatus && res.data.updateEvidence.status !== 'published') {
      throw new Error(`publish ${rec.slug} failed: published postcondition not met`);
    }

    const tags = [needsStatus ? 'published' : 'meta-only', metaChanged ? 'launch-stamped' : ''].filter(Boolean).join(', ');
    console.log(`${needsStatus ? 'published' : 'reclassified'}: ${rec.slug}  (${tags})`);
    if (needsStatus) published++; else reclassified++;
  }

  console.log(`\nDone. published=${published} reclassified=${reclassified} converged=${converged} (of ${SLUGS.length}).`);
  console.log('Now run scripts/verify-evidence-no-oem.ts to confirm no PLUTOVAC token leaks in the public payload.');
}
main().catch((e) => { console.error(e); process.exit(1); });
