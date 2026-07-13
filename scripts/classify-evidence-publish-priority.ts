/**
 * Classify every publication Evidence record with Phase-2 publish-gating fields,
 * merged into meta (non-destructive):
 *   publishPriority : 'wave1' | 'wave2' | 'wave3'
 *   verificationTier: 'A' (verbatim instrument quote captured) | 'B' (DOI+catalog, needs re-quote)
 *   capabilityRole  : 'primary' | 'substantial' | 'incidental'
 *   launchEligible  : boolean  (HARD gate = tier A AND capabilityRole != incidental)
 *
 * Design (user decision 2026-07-13): "no strong evidence → don't show". A record
 * is launch-eligible ONLY if verbatim-verified AND the tool is not an incidental
 * step — so a merely-"verified" but weak-showcase paper is never auto-published.
 * publishPriority: wave1 = the 6 hero papers (rie/icp/pecvd/sputter); wave2 = the
 * rest of the launch-eligible set; wave3 = everything else (B-tier awaiting re-quote,
 * incidental usage, snippet-tier). ibe-ribe/striper/ald stay wave3 (soft-goal only).
 *
 * Usage: set -a; source .env; set +a; npx tsx scripts/classify-evidence-publish-priority.ts
 * Idempotent (recomputes + overwrites the 4 fields each run). Raw GraphQL.
 */
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { authenticate } from './lib/auth';
import amplifyOutputs from '../amplify_outputs.json';
Amplify.configure(amplifyOutputs as any);
const client: any = generateClient();
const AUTH = { authMode: 'userPool' as const };

// slug -> [verificationTier, capabilityRole]
const CLASS: Record<string, ['A' | 'B', 'primary' | 'substantial' | 'incidental']> = {
  // --- original 2 (seed-evidence.ts) ---
  'pub-tailong-icp100a-nanomaterials-2020': ['A', 'primary'],
  'pub-tailong-icp100a-photonix-2022': ['A', 'primary'],
  // --- spotlights (5) ---
  'pub-tailong-rie100-sers-acsanm-2025': ['A', 'primary'],
  'pub-tailong-rie150-actuator-acsanm-2026': ['A', 'primary'],
  'pub-tailong-rie150a-colorrouter-lsa-2025': ['A', 'primary'],
  'pub-tailong-icp200-flowviz-lsa-2025': ['A', 'primary'],
  'pub-tailong-pecvd150ll-icp100-ptse2-apsusc-2026': ['A', 'primary'],
  // --- catalog (26) ---
  'pub-tailong-icp100a-compound-eyes-adfm-2019': ['A', 'primary'],
  'pub-tailong-icp100a-sapphire-microlens-lpt-2019': ['A', 'primary'],
  'pub-tailong-icp200-metalens-lpor-2024': ['A', 'primary'],
  'pub-tailong-icp100a-microoptics-ol-2019': ['B', 'primary'],
  'pub-tailong-icp-si3d-ao-2017': ['A', 'substantial'],
  'pub-tailong-icp-multifocal-microlens-mi-2022': ['A', 'substantial'], // B->A full-text re-quote (ICP-100A)
  'pub-tailong-icp100a-sic-microlens-lpt-2023': ['A', 'primary'],
  'pub-tailong-icp-diamond-etch-srep-2025': ['A', 'primary'], // B->A full-text re-quote (ICP-S-150)
  'pub-tailong-icp100a-antireflection-metasurface-adma-2026': ['A', 'primary'],
  'pub-tailong-icp-bite-thermoelectric-jalcom-2026': ['B', 'primary'],
  'pub-tailong-icp100-pecvd150ll-ptse2-selenization-acsami-2025': ['A', 'primary'],
  'pub-tailong-rie100-vdw-rectifier-natcommun-2021': ['A', 'substantial'],
  'pub-tailong-rie-hydrogel-generator-natcommun-2024': ['A', 'incidental'], // B->A re-quote; RIE no model, incidental step
  'pub-tailong-rie150-sidewall-trench-mre-2019': ['A', 'primary'],
  'pub-tailong-rie-mos2-satcurrent-nanores-2022': ['A', 'incidental'],
  'pub-tailong-rie150-graphene-mre-2019': ['A', 'substantial'],
  'pub-tailong-rie-zns-antireflection-oe-2021': ['A', 'primary'],
  'pub-tailong-rie-2d-logic-acsami-2024': ['A', 'incidental'],
  'pub-tailong-pecvd150ll-selenization-small-2025': ['A', 'primary'],
  'pub-tailong-pecvd-synaptic-transistor-apl-2025': ['B', 'substantial'],
  'pub-tailong-pecvd-encapsulation-apex-2020': ['B', 'substantial'],
  'pub-tailong-pecvd-sio2-tft-tsf-2024': ['A', 'substantial'],
  'pub-tailong-icpm100-pecvd-ga2o3-uv-mattod-2026': ['B', 'primary'],
  'pub-tailong-sputter100-cu-catalysis-acsami-2024': ['A', 'primary'],
  // NOTE: sputter-cu-nanotwin-mi-2024 and sputter-wo3-sensor-sensors-2025 were
  // ARCHIVED as catalog false-positives (full-text 2026-07-13): the former uses a
  // non-Tailong "VCT 300" sputter; the latter's "Tailong" is a gas supplier
  // ("Anxing Tailong Gas Chemical", ≠ Beijing Zhongke Tailong). Skipped below.
  // --- scholar-verified (12) ---
  'pub-tailong-rie100-hidden-vacancy-2dsemi-adma-2021': ['A', 'substantial'],
  'pub-tailong-rie-tendon-hydrogel-sciadv-2023': ['A', 'substantial'],
  'pub-tailong-rie-mxene-ofet-electrode-aelm-2024': ['A', 'substantial'],
  'pub-tailong-rie-metasurface-nanoimprint-apr-2022': ['A', 'primary'],
  'pub-tailong-rie-si-photonic-crystal-bic-nanoscale-2023': ['A', 'primary'],
  'pub-tailong-rie-pet-nanotemplate-nanolett-2022': ['B', 'substantial'],
  'pub-tailong-icp100a-blazed-gratings-jlt-2021': ['A', 'primary'],
  'pub-tailong-icp200-sic-colorprint-adfm-2026': ['A', 'primary'],
  'pub-tailong-icp200-complex-amplitude-aom-2024': ['A', 'primary'],
  'pub-tailong-icp-sn4oxo-litho-adfm-2025': ['A', 'substantial'],
  'pub-tailong-icprie-photoacid-litho-small-2025': ['A', 'substantial'],
  'pub-tailong-sputter-tio2-cuox-robots-raits-2026': ['A', 'primary'],
  // --- fulltext (6) ---  ibe-ribe/striper -> incidental per user; IR-source -> B (snippet)
  'pub-tailong-striper100-nanopillar-ar-nanomaterials-2022': ['A', 'incidental'],
  'pub-tailong-icps150-diamond-thermal-materials-2026': ['A', 'primary'],
  'pub-tailong-rie100-ir-source-eem-2026': ['B', 'primary'],
  'pub-tailong-neural-optrode-multi-micromachines-2025': ['A', 'incidental'],
  'pub-tailong-rie100m-polyimide-bonding-materials-2022': ['A', 'incidental'],
  'pub-tailong-rie-graphene-molecule-junction-natprotoc-2023': ['A', 'incidental'],
  // --- tail (3) ---
  'pub-tailong-rie100-nanoforest-ev-capture-acsnano-2025': ['A', 'primary'],
  'pub-tailong-rie150-wafer-graphene-cvd-acsanm-2023': ['A', 'substantial'],
  'pub-tailong-rie100-vdw-photodiode-infomat-2022': ['A', 'substantial'],
};

const WAVE1 = new Set([
  'pub-tailong-rie100-sers-acsanm-2025',
  'pub-tailong-rie150-actuator-acsanm-2026',
  'pub-tailong-rie150a-colorrouter-lsa-2025',
  'pub-tailong-icp200-flowviz-lsa-2025',
  'pub-tailong-pecvd150ll-icp100-ptse2-apsusc-2026',
  'pub-tailong-sputter100-cu-catalysis-acsami-2024',
]);

const LIST = `query L($t:String){ listEvidences(limit:200,nextToken:$t){ items{ id slug type status meta } nextToken } }`;
const UPDATE = `mutation U($i:UpdateEvidenceInput!){ updateEvidence(input:$i){ id } }`;

async function main() {
  await authenticate();
  let items: any[] = [], t: string | null = null;
  do {
    const r: any = await client.graphql({ query: LIST, variables: { t }, ...AUTH });
    items.push(...(r.data.listEvidences.items ?? [])); t = r.data.listEvidences.nextToken;
  } while (t);
  const pubs = items.filter((i) => i.type === 'publication' && i.status !== 'archived');

  const tally: any = { wave1: 0, wave2: 0, wave3: 0, A: 0, B: 0, primary: 0, substantial: 0, incidental: 0, eligible: 0 };
  const unmapped: string[] = [];
  for (const rec of pubs) {
    const cls = CLASS[rec.slug];
    if (!cls) { unmapped.push(rec.slug); }
    const [tier, role] = cls ?? ['B', 'incidental'];
    const launchEligible = tier === 'A' && role !== 'incidental';
    const publishPriority = WAVE1.has(rec.slug) ? 'wave1' : launchEligible ? 'wave2' : 'wave3';
    const meta = rec.meta ? JSON.parse(rec.meta) : {};
    meta.verificationTier = tier; meta.capabilityRole = role;
    meta.launchEligible = launchEligible; meta.publishPriority = publishPriority;
    await client.graphql({ query: UPDATE, variables: { i: { id: rec.id, meta: JSON.stringify(meta) } }, ...AUTH });
    tally[publishPriority]++; tally[tier]++; tally[role]++; if (launchEligible) tally.eligible++;
  }
  console.log(`classified ${pubs.length} publication records`);
  console.log('  publishPriority:', JSON.stringify({ wave1: tally.wave1, wave2: tally.wave2, wave3: tally.wave3 }));
  console.log('  verificationTier:', JSON.stringify({ A: tally.A, B: tally.B }));
  console.log('  capabilityRole:', JSON.stringify({ primary: tally.primary, substantial: tally.substantial, incidental: tally.incidental }));
  console.log('  launchEligible:', tally.eligible);
  if (unmapped.length) console.log('  ⚠ UNMAPPED (defaulted B/incidental/wave3):', JSON.stringify(unmapped));
}
main().catch((e) => { console.error(e); process.exit(1); });
