/**
 * SECOND SCOPED publish for the SEMISHARE probe-station line: the 18 held tier-B
 * records that a 2026-07-19 verbatim re-quote pass (8 parallel agents, Google
 * Scholar full-text snippets + open-access PMC/MDPI/RSC-ESI full text) promoted
 * to tier A by CAPTURING the exact instrument sentence. Each row's quote below is
 * the verbatim (or verbatim-clause, where the index snippet truncated the leading
 * subject) sentence naming SEMISHARE + the probe-station model.
 *
 * The other ~56 held records remain tier-B drafts — their full text is behind
 * hard paywalls (ACS/Wiley/Springer/IEEE/Elsevier) with no open copy, so the
 * exact sentence could not be captured (agents refused to quote search-engine
 * paraphrases). Preprints/proceedings stay held regardless.
 *
 * Per record: stamp meta.verification (with the captured quote), verificationTier
 * ='A', capabilityRole='substantial' (probe station = the paper's measurement
 * platform), launchEligible=true, publishPriority='wave2'; status draft→published.
 * Idempotent; preconditions abort before any write. All 18 are journals (no
 * preprint/proceedings).
 *
 * Usage:  set -a; source .env; set +a; npx tsx scripts/publish-semishare-requote.ts --apply
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

// [slug, verbatim instrument quote captured in the 2026-07-19 re-quote pass]
const REQUOTE: Array<[string, string]> = [
  ['pub-semishare-isfet-galactosidase-sensors-2024', 'The optimization of buffer composition and studies of GLA reaction with melibiose on ISFETs were performed using an Agilent B1500A semiconductor device parameter analyzer and an H8 probe station (Semishare Co., Ltd., Shenzhen, China).'],
  ['pub-semishare-igzo-tft-onestep-nanomaterials-2022', 'The electrical properties of a-InGaZnO TFTs were measured at room temperature using an atmospheric probe station (Optem 70XL, Semishare, HongKong, China) and semiconductor parameter analyzer (Keysight B2912A).'],
  ['pub-semishare-4hsic-pcss-tpel-2023', 'We use Semi-automatic probe station (SEMISHARE X-6) and high voltage DC power supply (KEITHLEY 2657A).'],
  ['pub-semishare-4hsic-mos-gateox-ted-2023', '...device analyzer (B1505A) on a probe station (Semishare SH-8).'],
  ['pub-semishare-4hsic-carbon-cap-jem-2025', '...semiconductor device analyzer (Agilent B1505A) on a probe station (Semishare SH-8).'],
  ['pub-semishare-gete-rf-switch-jos-2025', 'Variable temperature resistance (R–T) measurements were conducted on a curve tracking platform equipped with a probe station (SEMISHARE H8).'],
  ['pub-semishare-gan-driver-ht-buck-ietpe-2023', 'High-temperature measurements were carried out using a Semishare SE-6 probe station.'],
  ['pub-semishare-in2se3-in2o3-nvm-npj2d-2022', 'Electrical and optoelectronic properties were measured on a conventional probe station (Semishare, SM-4) by employing a semiconductor parameter analyzer unit (Keysight B1500).'],
  ['pub-semishare-ac-transport-materials-2025', 'Transport and charge properties of the obtained structures were studied by measuring and analyzing the I–V characteristics ... using a SEMISHARE M6 probe station (SEMISHARE Technology, Shenzhen, China).'],
  ['pub-semishare-ac-thermofield-materials-2026', 'The electrical properties of the obtained films were studied by measuring and analyzing current–voltage (I-V) characteristics using a SEMISHARE MG probe station (SEMISHARE Technology, Changzhou, China) and a Progress-3000 parameter analyzer.'],
  ['pub-semishare-mim-nb2o5-transport-applnano-2026', 'These measurements were carried out on a SEMISHARE M6 probe station (SEMISHARE Technology, Changzhou, China) using a Progress-3000 parameter analyzer for I–V curves and a TH512 analyzer for C–V profiling.'],
  ['pub-semishare-diffusive-memristor-reservoir-aelm-2025', 'The device was connected to one of the measurement units using a two-probe (W tips) configuration on the high and low-temperature vacuum probe station (SCG-O-4, SEMISHARE) in an ambient atmosphere.'],
  ['pub-semishare-vo2-encryption-advsci-2023', 'The Electrical Measurement was carried out in a Semishare four-probe station with a Keithley 2450 SourceMeter and a coaxial heating chuck.'],
  ['pub-semishare-cscu2i3-microwire-uv-acsami-2024', 'The electrical characteristics (I–V, I–T) were measured on a semiconductor device analyzer (B1500A, Keysight, US) equipped with a probe station (Semishare, China) and a silver probe.'],
  ['pub-semishare-1d-perovskite-microbelt-jpcl-2024', 'The photovoltaic response characteristics were measured by a semiconductor parameter analyzer (Model 4200A-SCS, Keithley) and a probe station (Model SM-4, Semishare).'],
  ['pub-semishare-rbcu2i3-mapbbr3-lateral-acsaelm-2024', '... were measured using a semiconductor device analyzer (B1500A, Keysight) coupled with a probe station (M4, SEMISHARE) under 355 and 450 nm solid-state laser sources.'],
  ['pub-semishare-rbcu2i3-microwire-uv-nanotech-2023', '... measured by a semiconductor parameter analyzer (B1500A, Keysight) equipped with a probe station (M4, SEMISHARE).'],
  ['pub-semishare-airstable-microwire-jmcc-2015', '... Keithley 4200-SCS semiconductor characterization system and a Semishare SE-4 probe station.'],
];

async function main() {
  requireApply(process.argv.slice(2), 'publish-semishare-requote');
  await authenticate();

  // Preflight ALL before any write.
  const plan: Array<{ rec: EvidenceRecord; meta: Record<string, any>; quote: string }> = [];
  for (const [slug, quote] of REQUOTE) {
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
      throw new Error(`preflight: ${slug} looks like a preprint (journal=${meta.journal}) — refusing`);
    }
    plan.push({ rec, meta, quote });
  }

  const now = new Date().toISOString();
  let published = 0, converged = 0;
  for (const { rec, meta, quote } of plan) {
    const requoteVerification = `SEMISHARE probe station named verbatim in the paper (2026-07-19 re-quote pass; Google Scholar full-text snippet / open-access full text): "${quote}" DOI/source Crossref-verified.`;
    let metaChanged = false;
    if (meta.verification !== requoteVerification) { meta.verification = requoteVerification; metaChanged = true; }
    if (meta.verificationTier !== 'A') { meta.verificationTier = 'A'; metaChanged = true; }
    if (meta.capabilityRole !== 'substantial') { meta.capabilityRole = 'substantial'; metaChanged = true; }
    if (meta.launchEligible !== true) { meta.launchEligible = true; metaChanged = true; }
    if (meta.publishPriority !== 'wave2') { meta.publishPriority = 'wave2'; metaChanged = true; }
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

  console.log(`\nDone. published=${published} converged=${converged} (of ${REQUOTE.length}).`);
  console.log('Run scripts/verify-evidence-no-oem.ts to confirm no OEM token leaks in the public payload.');
}
main().catch((e) => { console.error(e); process.exit(1); });
