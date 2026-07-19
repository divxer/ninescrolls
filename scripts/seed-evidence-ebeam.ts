/**
 * Seed the 3 peer-reviewed evaporation papers cited on the MEB-600 e-beam
 * product page as publication-type Evidence records (admin auth, status:draft).
 * This migrates the hardcoded static `research` block in eBeamEvaporatorConfig.ts
 * into the Evidence Framework single source of truth (SSoT), so the e-beam page
 * upgrades from the static card list to the dynamic ProductEvidence module.
 *
 * Attribution note — MEB-600 is NineScrolls's OWN product model, not an OEM
 * internal instrument string like the Tailong models. It is therefore NOT
 * treated as a banned token: no `manufacturerAsNamed` / `instrumentAsNamed`
 * meta keys are written here (those keys are harvested-as-banned by
 * verify-evidence-no-oem). MEB-600 provenance lives in a non-sensitive
 * `platform` key + the free-text `verification`. The equipment OEM is never named.
 *
 * DOIs resolved + verified via doi.org (2026-07-18):
 *   P1 Wan 2024   10.1021/acsami.4c01807                    (Crossref; ACS)
 *   P2 Luo 2023   10.11972/j.issn.1001-9014.2023.06.027     (resolves; CSTM registrar, NOT in Crossref)
 *   P3 Su 2025    — no resolvable DOI / stable URL found — HELD (tier B, launchEligible=false)
 *
 * Usage:  set -a; source .env; set +a; npx tsx scripts/seed-evidence-ebeam.ts --apply
 * Raw GraphQL (local amplify_outputs.json introspection lacks the Evidence model).
 * Duplicate-safe by slug: an existing record is skipped and left untouched.
 * NO dynamic citation counts stored.
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

interface Seed {
  slug: string;
  title: string;
  products: string[];
  sourceUrl?: string;
  summary: string;
  meta: Record<string, unknown>;
}

const base = (o: Partial<Seed['meta']>) => ({
  platform: 'MEB-600', // internal provenance only — never surfaced by the public projection
  verifiedAt: '2026-07-18',
  sourceCategory: 'MEB-600 product-page migration',
  ...o,
});

const RECORDS: Seed[] = [
  {
    slug: 'pub-ebeam-pbs-microplate-acsami-2024',
    title: 'Dimension-Confined Growth of a Crack-Free PbS Microplate Array for Infrared Image Sensing',
    products: ['e-beam-evaporator'],
    sourceUrl: 'https://doi.org/10.1021/acsami.4c01807',
    summary:
      'ACS Applied Materials & Interfaces (2024) — infrared image-sensing research using MEB-600 e-beam/thermal evaporation for PbS/MgO process layers. Migrated from the team-vetted NineScrolls e-beam product-page research block.',
    meta: base({
      journal: 'ACS Applied Materials & Interfaces',
      year: 2024,
      doi: '10.1021/acsami.4c01807',
      publicSummary:
        'Crack-free PbS microplate arrays for infrared image sensing, with evaporation of PbS/MgO process layers.',
      verification:
        'DOI 10.1021/acsami.4c01807 resolved and verified via Crossref/doi.org 2026-07-18 (title, journal ACS Applied Materials & Interfaces, year 2024, first author Wan). MEB-600 evaporation attribution migrated from the team-vetted NineScrolls e-beam product-page research block; verbatim full-text instrument re-quote recommended before further reuse.',
    }),
  },
  {
    slug: 'pub-ebeam-coronene-cmos-jimw-2023',
    title: 'Coronene Enhanced CMOS Image Sensor',
    products: ['e-beam-evaporator'],
    sourceUrl: 'https://doi.org/10.11972/j.issn.1001-9014.2023.06.027',
    summary:
      'Journal of Infrared and Millimeter Waves (2023) — UV down-conversion film; coronene deposited by vacuum thermal evaporation onto CMOS image sensors to extend ultraviolet response. Migrated from the team-vetted NineScrolls e-beam product-page research block.',
    meta: base({
      journal: 'Journal of Infrared and Millimeter Waves',
      year: 2023,
      doi: '10.11972/j.issn.1001-9014.2023.06.027',
      doiRegistrar: 'CSTM (China; DOI resolves via doi.org but is not indexed in Crossref)',
      publicSummary:
        'Ultraviolet down-conversion coronene film thermally evaporated onto CMOS image sensors to extend their UV response.',
      verification:
        'DOI 10.11972/j.issn.1001-9014.2023.06.027 resolves via doi.org (registrar CSTM, not indexed in Crossref); title "晕苯增强CMOS图像传感器 / Coronene enhanced CMOS image sensor", journal 红外与毫米波学报 (J. Infrared Millim. Waves) 2023, 42(6):931, first author Luo Lei. Paper uses vacuum thermal evaporation of coronene; MEB-600 attribution migrated from the team-vetted NineScrolls e-beam product-page research block.',
    }),
  },
  {
    // HELD: no resolvable DOI or stable source URL located (2026-07-18). Seeded to
    // capture the citation in the SSoT, but classified tier B (launchEligible=false
    // in the classifier) and given NO sourceUrl, so it is never published/shown
    // until a source is supplied. Mirrors the unresolved-DOI ALD paper precedent.
    slug: 'pub-ebeam-gezns-photonic-crystal-bsjtu-2025',
    title: 'Ge/ZnS Photonic Crystal Infrared-Wave Transmitting Properties',
    products: ['e-beam-evaporator'],
    // no sourceUrl — no resolvable DOI / stable URL
    summary:
      'Basic Sciences Journal of Textile Universities (2025) — Ge/ZnS photonic-crystal fabrication using evaporation for infrared optical stacks. HELD: no resolvable DOI or source URL found (2026-07-18); needs a source before it can be published.',
    meta: base({
      journal: 'Basic Sciences Journal of Textile Universities',
      year: 2025,
      held: true,
      heldReason:
        'No resolvable DOI or stable source URL located as of 2026-07-18 (Crossref, doi.org, and web/Chinese-language search all negative). Awaiting a DOI or publisher URL before publish.',
      verification:
        'Title/journal/year as cited on the team-vetted NineScrolls e-beam product-page research block (Su et al., Basic Sciences Journal of Textile Universities, 2025). No DOI or stable URL found to date; not Crossref-indexed. Held tier B, launchEligible=false, until a source is supplied.',
    }),
  },
];

async function main() {
  requireApply(process.argv.slice(2), 'seed-evidence-ebeam');
  assertUniqueSlugs(RECORDS.map((rec) => rec.slug), 'seed-evidence-ebeam');
  await authenticate();
  let created = 0;
  let skipped = 0;
  for (const rec of RECORDS) {
    const input: Record<string, unknown> & { slug: string } = {
      slug: rec.slug,
      title: rec.title,
      type: 'publication',
      status: 'draft',
      products: rec.products,
      summary: rec.summary,
      meta: JSON.stringify(rec.meta), // AWSJSON must be a JSON string
    };
    if (rec.sourceUrl) input.sourceUrl = rec.sourceUrl;
    const outcome = await createEvidenceIfMissing(client, input);
    if (outcome === 'created') {
      console.log(`created: ${rec.slug}`);
      created++;
    } else {
      console.log(`skip (exists): ${rec.slug}`);
      skipped++;
    }
  }
  console.log(`\nDone. created=${created} skipped=${skipped} total=${RECORDS.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
