/**
 * Seed peer-reviewed `publication` Evidence records for the PLUTOVAC plasma
 * cleaner platform (OEM: 上海沛沅仪器设备有限公司 / Shanghai Peiyuan Instrument
 * Equipment Co.; NineScrolls sells these as Pluto-T/F/M). This is a SEPARATE
 * platform from Tailong (etch/depo) — records attach to the `plasma-cleaner`
 * product line.
 *
 * Every record below was re-verified against Crossref + publisher/PMC/arXiv full
 * text on 2026-07-19 (see docs report). ONLY papers whose full text names a
 * PLUTOVAC/PLUTO-x plasma cleaner *verbatim* are seeded here; 13 further
 * catalog papers are held (paywalled, unconfirmed) — see NOT_SEEDED below.
 *
 * No-leak boundary (critical, differs from Tailong): PLUTOVAC / Peiyuan / 沛沅 /
 * PLUTO-T/F/M are BANNED OEM tokens (scripts/lib/bannedOem.ts). They may appear
 * ONLY in fields the public `listPublishedEvidence` projection STRIPS: top-level
 * `summary`, the record `slug`, and sensitive `meta.*`. They must NEVER go in a
 * publicly-projected field (title / sourceUrl / meta.publicSummary / journal /
 * year / doi). This seeder keeps them out of all of those. No citation counts
 * are stored (they change over time).
 *
 * Records are created status:draft (hidden). Classification fields
 * (verificationTier / capabilityRole / launchEligible / publishPriority) are
 * embedded directly here (the Tailong classify-evidence-publish-priority.ts
 * table is Tailong-only), so a Phase-2 publish step for plasma-cleaner can gate
 * on them the same way.
 *
 * Usage:  set -a; source .env; set +a; npx tsx scripts/seed-evidence-plutovac.ts --apply
 */
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { authenticate } from './lib/auth';
import {
  assertUniqueSlugs,
  createEvidenceIfMissing,
  requireApply,
  type EvidenceGraphqlClient,
} from './lib/evidenceSeedOperations';
import amplifyOutputs from '../amplify_outputs.json';

Amplify.configure(amplifyOutputs as any);
const client = generateClient() as unknown as EvidenceGraphqlClient;

const MANUFACTURER = 'PLUTOVAC';
const MANUFACTURER_LEGAL =
  'Shanghai Peiyuan Instrument Equipment Co., Ltd. (上海沛沅仪器设备有限公司)';
const DISCLOSURE =
  'NineScrolls is the authorized distributor of the PLUTOVAC plasma cleaner platform (Shanghai Peiyuan Instrument Equipment).';

type Tier = 'A' | 'B';
type Role = 'primary' | 'substantial' | 'incidental';

// [slug, title, doi, sourceUrl, instrument, journal, year, role, tier, priority, quote]
type Row = [
  slug: string, title: string, doi: string, sourceUrl: string,
  instrument: string, journal: string, year: number,
  role: Role, tier: Tier, priority: 'wave1' | 'wave2' | 'wave3', quote: string,
];

// NOTE: `title` and `sourceUrl` are PUBLIC — verified OEM-free (no paper title
// contains "PLUTOVAC"; sourceUrl is doi.org / arxiv.org only).
const NEW: Row[] = [
  ['pub-plutovac-phase-shifter-micromachines-2025',
    'Design and Fabrication of Ultrathin Metallic Phase Shifters for Visible and Near-Infrared Wavelengths',
    '10.3390/mi16010074', 'https://doi.org/10.3390/mi16010074',
    'PLUTO-F', 'Micromachines', 2025, 'primary', 'A', 'wave1',
    'Finally, we placed the double-layer aluminum nanowire gratings in a PLUTO-F plasma surface treatment system (PLUTOVAC, Shanghai, China) to obtain an ultrathin metallic phase shifter using the oxygen plasma ashing process.'],
  ['pub-plutovac-optofluidic-mzi-boe-2024',
    'Optofluidic chip with directly printed polymer optical waveguide Mach-Zehnder interferometer sensors for label-free biodetection',
    '10.1364/BOE.523055', 'https://doi.org/10.1364/BOE.523055',
    'PLUTO-T', 'Biomedical Optics Express', 2024, 'substantial', 'A', 'wave2',
    'Plasma cleaning was conducted using PLUTO-T Plasma Cleaner (PLUTOVAC, Shanghai, China) with a power of 200 W for 5 min.'],
  ['pub-plutovac-singlemol-fiber-arxiv-2025',
    'High-Contrast Interferometric Imaging of Single-Molecule Dynamics on Optical Fibers',
    'arXiv:2510.10061', 'https://arxiv.org/abs/2510.10061',
    'PLUTO-T', 'arXiv preprint', 2025, 'substantial', 'A', 'wave3',
    'In order to obtain a clean microfiber surface and enhance protein affinity, we used a plasma cleaner (PLUTOVAC, PLUTO-T) to perform plasma treatment for 60 s, aiming to achieve hydroxylation of the surface.'],
  ['pub-plutovac-metal-3d-nanoprint-natcommun-2023',
    'Metal 3D nanoprinting with coupled fields',
    '10.1038/s41467-023-40577-3', 'https://doi.org/10.1038/s41467-023-40577-3',
    'PLUTO-T', 'Nature Communications', 2023, 'incidental', 'A', 'wave3',
    'the removal of PR became easier by the means of plasma etching (PE-25, Plasma Etch and PLUTO-T, Plutovac).'],
  ['pub-plutovac-nanoantibiotics-sciadv-2023',
    'Transformable nano-antibiotics for mechanotherapy and immune activation against drug-resistant Gram-negative bacteria',
    '10.1126/sciadv.adg9601', 'https://doi.org/10.1126/sciadv.adg9601',
    'PLUTO-M', 'Science Advances', 2023, 'incidental', 'A', 'wave3',
    'carbon-coated 200-mesh copper grids ... were freshly treated by glow discharge using a plasma cleaner (Pluto-M, PLUTOVAC).'],
  ['pub-plutovac-laseremission-microdroplet-lsa-2025',
    'Laser-emission vibrational microscopy of microdroplet arrays for high-throughput screening of hyperlipidemia',
    '10.1038/s41377-025-02015-5', 'https://doi.org/10.1038/s41377-025-02015-5',
    'PLUTO-T', 'Light: Science & Applications', 2025, 'incidental', 'A', 'wave3',
    'First, the glass slide was cleaned using a plasma cleaner (PLUTOVAC, PLUTO-T) for 1 min.'],
  ['pub-plutovac-bulkcusp-natcommun-2026',
    'Bulk-cusp microstructure for controllable multi-directional liquid spreading',
    '10.1038/s41467-025-68237-8', 'https://doi.org/10.1038/s41467-025-68237-8',
    'PLUTO-T', 'Nature Communications', 2026, 'incidental', 'A', 'wave3',
    'the as-fabricated surfaces were treated in a plasma cleaner (Pluto-T, PLUTOVAC, Shanghai, China) at a power of 100 W for 10 s.'],
  ['pub-plutovac-dl-microfluidic-labchip-2026',
    'Deep learning-driven microfluidic chip architecture design for intelligent particle motion control',
    '10.1039/D5LC01185J', 'https://doi.org/10.1039/D5LC01185J',
    'PLUTO-F', 'Lab on a Chip', 2026, 'incidental', 'A', 'wave3',
    'The PDMS layer and glass substrate were surface-activated using an oxygen plasma treatment system (Plutovac, PLUTO-F) and irreversibly bonded to form sealed microchannels.'],
  ['pub-plutovac-saw-boundary-pre-2025',
    'Re-examining the boundary conditions in modelling SAW-driven acoustofluidic streaming',
    '10.1103/2fbn-rlzp', 'https://doi.org/10.1103/2fbn-rlzp',
    'PLUTO-T', 'Physical Review E', 2025, 'incidental', 'A', 'wave3',
    'The chamber was bonded to the substrate, aided by a plasma cleaner (Pluto-T, Plutovac, Shanghai, China).'],
  // Tier B: verbatim quote recovered from search-index summaries, not a direct
  // full-text fetch, and the model is unspecified ("PLUTOVAC, China"). Held for a
  // publish-time full-text re-quote.
  ['pub-plutovac-butterfly-wing-cej-2023',
    'Topological butterfly wings for human induced pluripotent stem cell-derived cardiomyocyte maturation and myocardial infarction treatment',
    '10.1016/j.cej.2023.144635', 'https://doi.org/10.1016/j.cej.2023.144635',
    'PLUTOVAC (model unspecified)', 'Chemical Engineering Journal', 2023, 'incidental', 'B', 'wave3',
    'Butterfly wings (BFWs) were treated with oxygen plasma using a plasma cleaner (PLUTOVAC, China) to obtain a hydrophilic surface [recovered from ScienceDirect search-index summary; re-quote from PDF before publish].'],
];

const roleLabel = (r: Role) =>
  r === 'primary' ? 'a defining fabrication step'
  : r === 'substantial' ? 'a substantial device-fabrication step'
  : 'an ancillary (surface-prep/cleaning) step';

const summaryFor = (journal: string, year: number, instrument: string, role: Role) =>
  `${journal} (${year}) — peer-reviewed research that used the ${MANUFACTURER} ${instrument} plasma cleaner as ${roleLabel(role)}. NineScrolls is the authorized distributor of this platform.`;

async function main() {
  requireApply(process.argv.slice(2), 'seed-evidence-plutovac');
  assertUniqueSlugs(NEW.map(([slug]) => slug), 'seed-evidence-plutovac');
  await authenticate();

  let created = 0, skipped = 0;
  for (const [slug, title, doi, sourceUrl, instrument, journal, year, role, tier, priority, quote] of NEW) {
    // Preprints are never launch-eligible while held — otherwise the GLOBAL
    // publish-launch-eligible-evidence.ts (which publishes ANY launchEligible
    // draft, product-agnostic) would auto-publish a held preprint.
    const isPreprint = /arxiv/i.test(journal);
    // CATEGORY EXCEPTION (do not "fix" this back): for the plasma-cleaner line,
    // tier-A peer-reviewed JOURNAL papers are launch-worthy even when
    // capabilityRole==='incidental' (surface cleaning/activation/bonding-prep IS
    // the tool's designed purpose). That promotion is applied at PUBLISH time by
    // scripts/publish-plutovac-evidence.ts (stamps launchEligible=true +
    // launchRationale). A future plutovac classifier must NOT re-derive these
    // incidental records back to launchEligible=false with the generic formula.
    const launchEligible = tier === 'A' && role !== 'incidental' && !isPreprint;
    const meta = {
      manufacturerAsNamed: MANUFACTURER,
      manufacturerLegalName: MANUFACTURER_LEGAL,
      instrumentAsNamed: instrument,
      relationshipDisclosure: DISCLOSURE,
      journal, year, doi,
      verifiedAt: '2026-07-19',
      sourceCategory: 'PLUTOVAC Google Scholar citation report + 2026-07 full-text re-verification',
      verification: `Full-text/index evidence (verified 2026-07-19): "${quote}" DOI/source Crossref-verified.`,
      verificationTier: tier,
      capabilityRole: role,
      launchEligible,
      publishPriority: priority,
    };
    const input = {
      slug, title, type: 'publication', status: 'draft',
      products: ['plasma-cleaner'],
      summary: summaryFor(journal, year, instrument, role),
      sourceUrl, // public-safe: doi.org / arxiv.org only
      meta: JSON.stringify(meta),
    };
    const outcome = await createEvidenceIfMissing(client, input);
    if (outcome === 'created') {
      console.log(`created: ${slug}  (${instrument}, tier ${tier}, ${role}${launchEligible ? ', launch-eligible' : ''})`);
      created++;
    } else {
      console.log(`skip (exists): ${slug}`);
      skipped++;
    }
  }

  console.log(`\nDone. created=${created} skipped=${skipped} (of ${NEW.length}).`);
  console.log('Reminder: run scripts/verify-evidence-no-oem.ts after any publish to confirm no PLUTOVAC token leaks.');
}
main().catch((e) => { console.error(e); process.exit(1); });

/*
 * NOT SEEDED — 13 catalog papers whose PLUTOVAC attribution could NOT be
 * confirmed against accessible full text on 2026-07-19 (paywall/Cloudflare).
 * All are real papers with Crossref-verified DOIs, but per the framework's
 * false-positive discipline they are held until a verbatim instrument quote is
 * captured. 3 are flagged "possible false positive" (no PLUTOVAC mention found
 * in any accessible source): #1, #6, #10.
 *   #1  Electrochemical molecular intercalation... — Nature PROTOCOLS (doc said
 *       Nature Commun — WRONG) 10.1038/s41596-023-00865-0 — possible FP
 *   #3  Fishbone-like micro-textured surface — 10.1016/j.triboint.2024.109932
 *   #6  3D-Printed High-Entropy Alloy Nanoarchitectures — 10.1002/smll.202409900 — possible FP
 *   #10 Gas-Phase Assembly of Semiconductor Nanostructures — 10.1002/smll.202504668 — possible FP (core plasma is spark-discharge synthesis, not cleaning)
 *   #11 SAW-driven modular acoustofluidic tweezer — 10.1039/D4LC00924J
 *   #12 Nano-Silica Double-Layer AR Coatings (KDP) — 10.1002/smtd.202400544
 *   #13 CRISPR/Cas12a SiNW FET sensor — 10.1016/j.bios.2025.117936
 *   #14 Lithography-Assisted AuNP Micropatterns — 10.1109/BioSensors61405.2024.10712674
 *   #15 Core-Shell Yarn Woven Metafabric — 10.1007/s42765-025-00628-4
 *   #16 Sheathless prefocusing SU-8/PDMS — 10.1039/D5LC00887E
 *   #18 PLA/anthocyanin bilayer colorimetric films — SSRN 6064465 (→ LWT 2026)
 *   #23 Direct Printing Au/MoS2 SERS — 10.1002/smtd.202501968
 *   #25 PEDOT:PSS transparent strain sensor — 微纳电子技术 2024 (no DOI)
 *
 * DUPLICATES removed from the 25 (so 23 distinct works; 10 verified above):
 *   #19 = #8 (same DOI 10.1038/s41377-025-02015-5)
 *   #24 ≈ #5 (PhD thesis vs journal version of the same optofluidic work)
 */
