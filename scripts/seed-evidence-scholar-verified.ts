/**
 * (1) Seed the under-seeded Tailong RIE/ICP/Sputter papers surfaced during the
 *     Google Scholar re-verification (keyword "Tailong Electronics", 2026-07-13).
 *     HIGHER verification tier than the catalog batch: the instrument string was
 *     seen VERBATIM in the Scholar snippet (stored in meta.verification). DOIs
 *     Crossref-verified. All status:draft.
 * (2) Apply 3 model-string refinements to already-seeded records where Scholar
 *     showed a more specific model than the catalog had.
 *
 * Usage:  set -a; source .env; set +a; npx tsx scripts/seed-evidence-scholar-verified.ts --apply
 * Raw GraphQL (Evidence not in local introspection). Creates are duplicate-safe
 * by slug; refinements converge to deterministic metadata and summary values.
 */
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { authenticate } from './lib/auth';
import {
  createEvidenceIfMissing,
  refineEvidence,
  requireApply,
} from './lib/evidenceSeedOperations';
import amplifyOutputs from '../amplify_outputs.json';

Amplify.configure(amplifyOutputs as any);
const client: any = generateClient();
const DISCLOSURE =
  'NineScrolls is the authorized distributor of this platform (Tailong Electronics / Beijing Zhongke Tailong Electronic Technology).';
const toolType = (p: string[]) =>
  p.includes('sputter') ? 'magnetron sputter' : p.includes('pecvd') && p.includes('icp-etcher') ? 'ICP etching + PECVD'
  : p.includes('icp-etcher') ? 'ICP etcher' : p.includes('rie-etcher') ? 'RIE etcher' : p.includes('pecvd') ? 'PECVD system' : 'plasma tool';
const summaryFor = (journal: string, year: number, instrument: string, p: string[]) =>
  `${journal} (${year}) — peer-reviewed research that used the Tailong Electronics ${instrument} (${toolType(p)}). NineScrolls is the authorized distributor of this platform.`;

// [slug, title, products, doi, instrument, journal, year, scholarSnippet]
type Row = [string, string, string[], string, string, string, number, string];
const NEW: Row[] = [
  ['pub-tailong-rie100-hidden-vacancy-2dsemi-adma-2021', 'Hidden vacancy benefit in monolayer 2D semiconductors', ['rie-etcher'], '10.1002/adma.202007051', 'RIE-100', 'Advanced Materials', 2021, 'The plasma etchings were finished in a Tailong Electronics RIE 100.'],
  ['pub-tailong-rie-tendon-hydrogel-sciadv-2023', 'Multifunctional tendon-mimetic hydrogels', ['rie-etcher'], '10.1126/sciadv.ade6973', 'RIE (Tailong)', 'Science Advances', 2023, 'patterned by reactive ion etching (RIE; Tailong Electronics).'],
  ['pub-tailong-rie-mxene-ofet-electrode-aelm-2024', 'Large-area electrode deposition and patterning for monolayer organic field-effect transistors by vacuum-filtrated MXene', ['rie-etcher'], '10.1002/aelm.202300570', 'RIE (Tailong)', 'Advanced Electronic Materials', 2024, 'etched by reactive ion etching (RIE) (Tailong electronics, 100 W).'],
  ['pub-tailong-rie-metasurface-nanoimprint-apr-2022', 'Tuning metasurface dimensions by soft nanoimprint lithography and reactive ion etching', ['rie-etcher'], '10.1002/adpr.202200127', 'RIE (Tailong)', 'Advanced Photonics Research', 2022, 'For RIE (Tailong Electronics RIE), by adjusting the etching time, gas flow, and power.'],
  ['pub-tailong-rie-si-photonic-crystal-bic-nanoscale-2023', 'Large-area silicon photonic crystal supporting bound states in the continuum and optical sensing formed by nanoimprint lithography', ['rie-etcher'], '10.1039/d3na00001j', 'RIE (Tailong)', 'Nanoscale Advances', 2023, 'For the RIE (Tailong Electronics RIE) process, by adjusting the etching time, gas flow, and power.'],
  ['pub-tailong-rie-pet-nanotemplate-nanolett-2022', 'Porous polyethylene terephthalate nanotemplate electrodes for sensitive intracellular recording of action potentials', ['rie-etcher'], '10.1021/acs.nanolett.2c00258', 'RIE (Tailong)', 'Nano Letters', 2022, 'Indexed under "Tailong Electronics"; RIE per internal catalog — specific model not in visible snippet, re-quote at publish.'],
  ['pub-tailong-icp100a-blazed-gratings-jlt-2021', 'Wear-resistant blazed gratings fabricated by etching-assisted femtosecond laser lithography', ['icp-etcher'], '10.1109/JLT.2021.3066976', 'ICP-100A', 'Journal of Lightwave Technology', 2021, 'etching by an inductively coupled plasma system (ICP, ICP-100A, Tailong Electronics).'],
  ['pub-tailong-icp200-sic-colorprint-adfm-2026', 'High-Performance Color Printing and Information Encryption Enabled by Silicon Carbide Metasurface', ['icp-etcher'], '10.1002/adfm.202526191', 'ICP-200', 'Advanced Functional Materials', 2026, 'inductively coupled plasma reactive ion etching (Tailong Electronics, ICP-200) was carried out.'],
  ['pub-tailong-icp200-complex-amplitude-aom-2024', 'Broadband Complex Amplitude-Modulated Metasurfaces for Nanoprinting and Vectorial Hologram with Continuously Varying Linear Polarization Distributions', ['icp-etcher'], '10.1002/adom.202401227', 'ICP-200', 'Advanced Optical Materials', 2024, 'inductively coupled plasma reactive ion etching (Tailong Electronics, ICP-200) was implemented.'],
  ['pub-tailong-icp-sn4oxo-litho-adfm-2025', 'Sub-10-nm Lithography for Sn4-Oxo Clusters: Effect of Molecular Polarity on Sensitivity and Resolution', ['icp-etcher'], '10.1002/adfm.202423957', 'ICP-I-load-lock', 'Advanced Functional Materials', 2025, 'An ICP-I-load-lock system (Beijing Tailong Electronics Co. Ltd.) was used for the etching tests.'],
  ['pub-tailong-icprie-photoacid-litho-small-2025', 'Enhanced Lithography Performance with Imino/Imido Benzenesulfonate Photoacid Generator-Bound Polymer Resists', ['icp-etcher'], '10.1002/smll.202412297', 'ICP-RIE', 'Small', 2025, 'performed on an inductively coupled plasma coupled reactive ion etching (ICP-RIE) machine (Tailong Electronics China).'],
  ['pub-tailong-sputter-tio2-cuox-robots-raits-2026', 'TiO2-CuOx Coatings with Self-Cleaning and Antibacterial Functions and Their Potential Applications in Medical Robots', ['sputter'], '10.1109/RAITS68656.2026.11580152', 'HighThroughput100-6A', '2026 International Conference (IEEE)', 2026, 'the HighThroughput100-6A high-throughput magnetron sputtering coating machine manufactured by Tailong Electronics.'],
];

// [slug, newInstrument, originalInstrument] — refine to Scholar's exact model
const REFINE: [string, string, string][] = [
  ['pub-tailong-icp-si3d-ao-2017', 'ICP-100A', 'ICP (Tailong)'],
  ['pub-tailong-pecvd-sio2-tft-tsf-2024', 'ICP-PECVD-150', 'PECVD (Tailong)'],
  ['pub-tailong-rie-2d-logic-acsami-2024', 'RIE-100', 'RIE (Tailong)'],
];

async function main() {
  requireApply(process.argv.slice(2), 'seed-evidence-scholar-verified');
  await authenticate();

  // (1) seed new
  let created = 0, skipped = 0;
  for (const [slug, title, products, doi, instrument, journal, year, snippet] of NEW) {
    const meta = {
      manufacturerAsNamed: 'Tailong Electronics',
      manufacturerLegalName: 'Beijing Zhongke Tailong Electronic Technology Corporation (Nano-Promiso)',
      instrumentAsNamed: instrument,
      relationshipDisclosure: DISCLOSURE,
      journal, year, doi,
      verifiedAt: '2026-07-13',
      sourceCategory: 'Tailong citation catalog + Scholar re-verification',
      verification: `Google Scholar (keyword "Tailong Electronics", verified 2026-07-13) snippet: "${snippet}" DOI Crossref-verified.`,
    };
    const input = { slug, title, type: 'publication', status: 'draft', products, summary: summaryFor(journal, year, instrument, products), sourceUrl: `https://doi.org/${doi}`, meta: JSON.stringify(meta) };
    const outcome = await createEvidenceIfMissing(client, input);
    if (outcome === 'created') {
      console.log(`created: ${slug}  (${products.join('+')}, ${instrument})`);
      created++;
    } else {
      console.log(`skip (exists): ${slug}`);
      skipped++;
    }
  }

  // (2) refine existing
  let refined = 0, converged = 0;
  for (const [slug, newInstrument, originalInstrument] of REFINE) {
    const outcome = await refineEvidence(client, {
      slug,
      instrument: newInstrument,
      originalInstrument,
      via: 'Google Scholar "Tailong Electronics" verbatim snippet, 2026-07-13',
      summaryFor: (record, meta) => summaryFor(
        meta.journal,
        meta.year,
        newInstrument,
        record.products ?? [],
      ),
    });
    if (outcome === 'missing') console.log(`refine skip (not found): ${slug}`);
    if (outcome === 'converged') { console.log(`refine converged: ${slug}`); converged++; }
    if (outcome === 'refined') { console.log(`refined: ${slug}  ${originalInstrument} -> ${newInstrument}`); refined++; }
  }

  console.log(`\nDone. created=${created} skipped=${skipped} refined=${refined} converged=${converged}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
