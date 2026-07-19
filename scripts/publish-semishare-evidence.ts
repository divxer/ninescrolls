/**
 * SCOPED classify + publish for the SEMISHARE probe-station evidence line.
 *
 * Publishes ONLY the explicit tier-A slugs below (the launch set) — never scans/
 * derives the set, so it can't clobber another product line's gates. These are
 * the SEMISHARE papers whose VERBATIM instrument sentence is captured in the
 * record's meta.verification (the Nature/Science/Light + E-series ferroelectric
 * flagships). The other ~74 SEMISHARE records stay tier-B drafts (verified usage
 * per the Scholar pass, but the quote wasn't transcribed) until a re-quote pass.
 *
 * Category note: for a probe station, the electrical/optoelectronic measurement
 * IS the paper's device characterization platform, so capabilityRole is
 * `substantial` (not incidental). tier A + substantial + non-preprint/proceedings
 * => launchEligible. On publish each record is stamped verificationTier='A',
 * capabilityRole='substantial', launchEligible=true, publishPriority, so
 * published <=> launchEligible stays consistent + getEvidenceStats counts them.
 *
 * Idempotent. Preconditions abort before any write: each slug must exist, be
 * type:publication, tagged products:['probe-station'], non-archived, non-preprint.
 *
 * Usage:  set -a; source .env; set +a; npx tsx scripts/publish-semishare-evidence.ts --apply
 */
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { authenticate } from './lib/auth';
import {
  checkedGraphql,
  evidenceBySlug,
  requireApply,
  type EvidenceGraphqlClient,
  type EvidenceRecord,
} from './lib/evidenceSeedOperations';
import amplifyOutputs from '../amplify_outputs.json';

Amplify.configure(amplifyOutputs as any);
const client = generateClient() as unknown as EvidenceGraphqlClient;

const UPDATE = `mutation UpdateEvidence($input:UpdateEvidenceInput!){ updateEvidence(input:$input){ id slug status meta publishDate } }`;
const AUTH = { authMode: 'userPool' as const };

// [slug, publishPriority] — the 15 tier-A journal launch records (verbatim quote
// captured). wave1 = the 532-cite SE-6 flagship; wave2 = the rest.
const LAUNCH: Array<[string, 'wave1' | 'wave2']> = [
  ['pub-semishare-tellurium-mir-polar-natcommun-2020', 'wave1'],   // A1 SE-6, Nat Commun, 532 cites
  ['pub-semishare-amorphous-chalcogenide-natmater-2025', 'wave2'], // A2 CG-O-4, Nat Mater
  ['pub-semishare-chain-ordered-pt-h2-natcommun-2025', 'wave2'],   // A3 CG-O-4, Nat Commun
  ['pub-semishare-pbzro3-antiferroelectric-natcommun-2025', 'wave2'], // A4 E4, Nat Commun
  ['pub-semishare-algan-deepuv-microled-natphoton-2025', 'wave2'], // A5 Nat Photon
  ['pub-semishare-perovskite-singlepixel-lsa-2023', 'wave2'],      // A6 Light SA
  ['pub-semishare-perovskite-dualband-lsa-2026', 'wave2'],         // A7 Light SA
  ['pub-semishare-ferroelectric-nitrogen-sciadv-2025', 'wave2'],   // A8 E4, Sci Adv
  ['pub-semishare-kion-battery-sei-joule-2025', 'wave2'],          // A9 CG-O-4, Joule
  ['pub-semishare-antiferro-energy-storage-afm-2024', 'wave2'],    // C1 E4, Adv Funct Mater
  ['pub-semishare-pmnpt-nonlinear-dielectric-apxr-2023', 'wave2'], // C2 E4, Adv Phys Res
  ['pub-semishare-freestanding-relaxor-harvester-afm-2026', 'wave2'], // C3 E4, Adv Funct Mater
  ['pub-semishare-2d-ferroelectric-phototransistor-adma-2026', 'wave2'], // C4 E series, Adv Mater
  ['pub-semishare-mos2-mote2-ir-photogating-aelm-2024', 'wave2'],  // B9 E-4, Adv Electron Mater
  ['pub-semishare-4hsic-jbs-tempsense-small-2026', 'wave2'],       // E1 X8, Small
];

async function main() {
  requireApply(process.argv.slice(2), 'publish-semishare-evidence');
  await authenticate();

  // Preflight ALL before any write.
  const records: Array<{ rec: EvidenceRecord; meta: Record<string, any>; priority: 'wave1' | 'wave2' }> = [];
  for (const [slug, priority] of LAUNCH) {
    const rec = await evidenceBySlug(client, slug);
    if (!rec) throw new Error(`preflight: ${slug} not found`);
    if (rec.type !== 'publication') throw new Error(`preflight: ${slug} is not a publication`);
    if (rec.status === 'archived') throw new Error(`preflight: ${slug} is archived`);
    if (!rec.products?.includes('probe-station')) {
      throw new Error(`preflight: ${slug} is not tagged probe-station (${JSON.stringify(rec.products)})`);
    }
    let meta: Record<string, any> = {};
    try { meta = rec.meta ? JSON.parse(rec.meta) : {}; } catch { throw new Error(`preflight: ${slug} invalid meta JSON`); }
    if (typeof meta.journal === 'string' && /arxiv|preprint|ssrn|research square/i.test(meta.journal)) {
      throw new Error(`preflight: ${slug} looks like a preprint (journal=${meta.journal}) — refusing to publish`);
    }
    records.push({ rec, meta, priority });
  }

  const now = new Date().toISOString();
  let published = 0, converged = 0;
  for (const { rec, meta, priority } of records) {
    let metaChanged = false;
    if (meta.verificationTier !== 'A') { meta.verificationTier = 'A'; metaChanged = true; }
    if (meta.capabilityRole !== 'substantial') { meta.capabilityRole = 'substantial'; metaChanged = true; }
    if (meta.launchEligible !== true) { meta.launchEligible = true; metaChanged = true; }
    if (meta.publishPriority !== priority) { meta.publishPriority = priority; metaChanged = true; }
    const needsStatus = rec.status !== 'published';

    if (!metaChanged && !needsStatus) { console.log(`converged: ${rec.slug}`); converged++; continue; }

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
    console.log(`${needsStatus ? 'published' : 'stamped'}: ${rec.slug}`);
    published += needsStatus ? 1 : 0;
  }

  console.log(`\nDone. published=${published} converged=${converged} (of ${LAUNCH.length}).`);
  console.log('Run scripts/verify-evidence-no-oem.ts to confirm no OEM token leaks in the public payload.');
}
main().catch((e) => { console.error(e); process.exit(1); });
