/**
 * Final full-text-verified batch (2026-07-13). 6 papers confirmed by subagents
 * reading OPEN-ACCESS full text (MDPI/PMC, Nature Protocols author PDF) or a
 * search index snippet, each naming a Tailong / Beijing Zhongke Tailong tool
 * verbatim (quote in meta.verification). Opens `striper` + `ibe-ribe` lines.
 * Also refines the ZnS record (RIE -> RIE-100, per Zhongke-Tailong snippet).
 * status:draft. Raw GraphQL. Usage requires --apply. Creates are duplicate-safe
 * by slug; the refinement converges without replacing original provenance.
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
const DISCLOSURE = 'NineScrolls is the authorized distributor of this platform (Tailong Electronics / Beijing Zhongke Tailong Electronic Technology).';

// [slug, title, products, doi, instrument, journal, year, quote, tier]
type Row = [string, string, string[], string, string, string, number, string, string];
const NEW: Row[] = [
  ['pub-tailong-striper100-nanopillar-ar-nanomaterials-2022', 'High Anti-Reflection Large-Scale Cup-Shaped Nano-Pillar Arrays via Thin Film Anodic Aluminum Oxide Replication', ['striper'], '10.3390/nano12111875', 'STRIPER-100 (used as RIE)', 'Nanomaterials', 2022, 'the reactive ion etching (RIE, STRIPER-100, Beijing Zhongke Tailong Electronic Technology, Beijing, China) with a mixed gas of 60 sccm CF4 and 20 sccm Ar, a power of 75 w, was carried out for silicon dry etching.', 'full-text (open access, PMC9181906)'],
  ['pub-tailong-icps150-diamond-thermal-materials-2026', 'Mitigating the Thermal Bottleneck in Polycrystalline Diamond Films by Gradient ICP Etching of the Nucleation Layer', ['icp-etcher'], '10.3390/ma19040759', 'ICP-S-150', 'Materials', 2026, 'freestanding films were subjected to depth-controlled inductively coupled plasma (ICP-S-150, Beijing Zhongke Tailong Electronic Technology Co., Ltd., Beijing, China) etching', 'full-text (open access, PMC)'],
  ['pub-tailong-rie100-ir-source-eem-2026', 'An Ultra-Low-Power and High-Temperature-Homogeneity Wafer-Scale Infrared Source', ['rie-etcher'], '10.1002/eem2.70208', 'RIE-100', 'Energy & Environmental Materials', 2026, 'Photosensitive PI was etched using RIE-100 from Beijing Zhongke Tailong Electronic Technology Co., Ltd., China.', 'search-index snippet (body paywalled) — re-quote from PDF before publish'],
  ['pub-tailong-neural-optrode-multi-micromachines-2025', 'Rigid-Flexible Neural Optrode with Anti-Bending Waveguides and Locally Soft Microelectrodes for Multifunctional Biocompatible Neural Regulation', ['rie-etcher', 'sputter', 'ibe-ribe'], '10.3390/mi16090983', 'RF magnetron sputter + ion-beam etcher + RIE (no model numbers)', 'Micromachines', 2025, 'a radio-frequency magnetron sputtering system (Beijing Zhongke Tailong Electronic Technology Co., Ltd.), ion beam etching machine (Beijing Zhongke Tailong Electronic Technology Co., Ltd.), a reactive ion etching (RIE) equipment (Beijing Zhongke Tailong Electronic Technology Co., Ltd.)', 'full-text (open access, PMC12471448)'],
  ['pub-tailong-rie100m-polyimide-bonding-materials-2022', 'Direct Bonding Method for Completely Cured Polyimide by Surface Activation and Wetting', ['rie-etcher'], '10.3390/ma15072529', 'RIE 100M', 'Materials', 2022, 'reactive ion etching equipment (RIE; 100M, Tailong Electronics Co., Ltd., Beijing, China) using the oxygen plasma', 'full-text (open access, PMC8999792)'],
  ['pub-tailong-rie-graphene-molecule-junction-natprotoc-2023', 'Graphene-molecule-graphene single-molecule junctions to detect electronic reactions at the molecular scale', ['rie-etcher'], '10.1038/s41596-023-00822-x', 'RIE (Tailong, no model given)', 'Nature Protocols', 2023, 'Reactive ion etching machine (Tailong Electronics)', "full-text (author open-access PDF)"],
];

const REFINE: [string, string, string, string][] = [
  ['pub-tailong-rie-zns-antireflection-oe-2021', 'RIE-100', 'RIE (Tailong)', 'Beijing Zhongke Tailong Electronic Technology Co. Ltd RIE-100 (Optics Express 2021, verbatim)'],
];

const toolType = (p: string[]) => {
  const parts: string[] = [];
  if (p.includes('icp-etcher')) parts.push('ICP etcher');
  if (p.includes('rie-etcher')) parts.push('RIE etcher');
  if (p.includes('pecvd')) parts.push('PECVD');
  if (p.includes('sputter')) parts.push('magnetron sputter');
  if (p.includes('ibe-ribe')) parts.push('ion-beam etcher');
  if (p.includes('striper')) parts.push('plasma striper');
  return parts.join(' + ') || 'plasma tool';
};
const summaryFor = (j: string, y: number, inst: string, p: string[]) =>
  `${j} (${y}) — peer-reviewed research that used Tailong Electronics process equipment (${inst}; ${toolType(p)}). NineScrolls is the authorized distributor of this platform.`;

async function main() {
  requireApply(process.argv.slice(2), 'seed-evidence-fulltext');
  await authenticate();
  let created = 0, skipped = 0, refined = 0, converged = 0;
  for (const [slug, title, products, doi, instrument, journal, year, quote, tier] of NEW) {
    const meta = {
      manufacturerAsNamed: 'Beijing Zhongke Tailong Electronic Technology', manufacturerLegalName: 'Beijing Zhongke Tailong Electronic Technology Corporation (Nano-Promiso)',
      instrumentAsNamed: instrument, relationshipDisclosure: DISCLOSURE, journal, year, doi, verifiedAt: '2026-07-13',
      sourceCategory: 'Scholar alt-keyword sweep + full-text verification',
      verification: `Full-text verified (${tier}): "${quote}" DOI: ${doi}.`,
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
  for (const [slug, newInstrument, originalInstrument, note] of REFINE) {
    const outcome = await refineEvidence(client, {
      slug,
      instrument: newInstrument,
      originalInstrument,
      via: note,
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
