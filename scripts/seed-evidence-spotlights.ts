/**
 * Seed the 5 "Publication Spotlight" papers as publication-type Evidence records
 * (admin auth, status:draft). Sourced from our own DynamoDB Publication Spotlight
 * insight articles — each written from the full paper; the instrument/manufacturer
 * strings below are quoted from OUR article bodies (paywall-free, verified at
 * authoring). articleSlug links each record to its explainer as the payload.
 *
 * Uses RAW GraphQL (not the typed client) because the local amplify_outputs.json
 * introspection does not include the Evidence model — the typed client.models.Evidence
 * is undefined. The GraphQL endpoint + userPool auth ARE present, so raw mutations
 * validate against the deployed schema. Same workaround used for the first 2 drafts.
 *
 * Usage:  set -a; source .env; set +a; npx tsx scripts/seed-evidence-spotlights.ts --apply
 * Duplicate-safe: skips a record whose slug already exists (listEvidenceBySlug).
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

const DISCLOSURE =
  'NineScrolls is the authorized distributor of this platform (Beijing Zhongke Tailong Electronics).';

interface Seed {
  slug: string;
  title: string;
  products: string[];
  articleSlug: string;
  sourceUrl: string;
  summary: string;
  meta: Record<string, unknown>;
}

const base = (o: Partial<Seed['meta']>) => ({
  relationshipDisclosure: DISCLOSURE,
  verifiedAt: '2026-07-13',
  sourceCategory: 'Publication Spotlight',
  ...o,
});

const RECORDS: Seed[] = [
  {
    slug: 'pub-tailong-rie100-sers-acsanm-2025',
    title: 'Composite Nanotube Arrays for Pesticide Detection Assisted with Machine Learning Based on SERS Effect',
    products: ['rie-etcher'],
    articleSlug: 'rie100-composite-nanotube-formation-sers',
    sourceUrl: 'https://doi.org/10.1021/acsanm.5c01351',
    summary:
      'An RIE-100 reactive-ion etcher under SF₆ plasma self-organizes ordered composite nanotube arrays (~330 nm) that act as a high-enhancement SERS substrate — a constructive, not subtractive, use of an etcher.',
    meta: base({
      manufacturerAsNamed: 'Beijing Zhongke Tailong Electronic Technology',
      instrumentAsNamed: 'RIE-100',
      journal: 'ACS Applied Nano Materials',
      year: 2025,
      doi: '10.1021/acsanm.5c01351',
      verification:
        'Instrument named verbatim in NineScrolls Publication Spotlight article rie100-composite-nanotube-formation-sers: "RIE-100, Beijing Zhongke Tailong Electronic Technology".',
    }),
  },
  {
    slug: 'pub-tailong-rie150-actuator-acsanm-2026',
    title: 'An Environment-Powered Soft Actuator Enabled by Water and Light Highly Absorptive Nanoforests',
    products: ['rie-etcher'],
    articleSlug: 'rie150-nanoforest-soft-actuator',
    sourceUrl: 'https://doi.org/10.1021/acsanm.5c05598',
    summary:
      'RIE-150 oxygen-plasma etching produces the light- and water-absorptive nanoforest structures that enable a dual-mode, environment-powered soft actuator (record humidity response 23.06°/s, ~85% broadband absorption).',
    meta: base({
      manufacturerAsNamed: 'Beijing Zhongke Tailong Electronics Co.',
      instrumentAsNamed: 'RIE-150',
      journal: 'ACS Applied Nano Materials',
      year: 2026,
      doi: '10.1021/acsanm.5c05598',
      verification:
        'Instrument named in NineScrolls Publication Spotlight article rie150-nanoforest-soft-actuator: "RIE-150 Reactive Ion Etching system (Beijing Zhongke Tailong Electronics)".',
    }),
  },
  {
    slug: 'pub-tailong-rie150a-colorrouter-lsa-2025',
    title: 'On-chip nonlocal metasurface for color router: conquering efficiency-loss from spatial-multiplexing',
    products: ['rie-etcher'],
    articleSlug: 'rie150a-metasurface-color-router',
    sourceUrl: 'https://doi.org/10.1038/s41377-025-02146-9',
    summary:
      'A q-BIC metasurface color router fabricated with RIE-150A reactive-ion etching, overcoming the efficiency loss of spatial multiplexing (~20 nm narrowband linewidth).',
    meta: base({
      manufacturerAsNamed: 'Beijing Zhongke Tailong Electronics Co.',
      instrumentAsNamed: 'RIE-150A',
      journal: 'Light: Science & Applications',
      year: 2025,
      doi: '10.1038/s41377-025-02146-9',
      verification:
        'Instrument named in NineScrolls Publication Spotlight article rie150a-metasurface-color-router: "RIE-150A Reactive Ion Etcher (Beijing Zhongke Tailong Electronics Co.)".',
    }),
  },
  {
    slug: 'pub-tailong-icp200-flowviz-lsa-2025',
    title: 'Non-invasive and fully two-dimensional quantitative visualization of transparent flow fields enabled by photonic spin',
    products: ['icp-etcher'],
    articleSlug: 'icp200-metasurface-flow-visualization',
    sourceUrl: 'https://doi.org/10.1038/s41377-025-01793-2',
    summary:
      'Silicon-nanopillar metasurfaces dry-etched on an ICP-200 (C₄F₈/SF₆) enable non-invasive, fully two-dimensional quantitative visualization of transparent flow fields.',
    meta: base({
      manufacturerAsNamed: 'Beijing Zhongke Tailong Electronics Co.',
      instrumentAsNamed: 'ICP-200',
      journal: 'Light: Science & Applications',
      year: 2025,
      doi: '10.1038/s41377-025-01793-2',
      verification:
        'Instrument named in NineScrolls Publication Spotlight article icp200-metasurface-flow-visualization: "Equipment ICP-200 (Tailong Electronics)" / "Manufacturer: Beijing Zhongke Tailong Electronics".',
    }),
  },
  {
    slug: 'pub-tailong-pecvd150ll-icp100-ptse2-apsusc-2026',
    title: 'Broadband and high-speed micro-scale PtSe2/Si 2D-3D PIN photodetector for on-chip polarization-encoded communication and imaging',
    products: ['pecvd', 'icp-etcher'],
    articleSlug: 'pecvd-icp-ptse2-photodetector',
    sourceUrl: 'https://doi.org/10.1016/j.apsusc.2026.166329',
    summary:
      'PECVD-150LL SiO₂ passivation and ICP-100 device patterning enable a CMOS-compatible PtSe₂/Si PIN photodetector with ~260 kHz 3-dB bandwidth for polarization-encoded optical communication.',
    meta: base({
      manufacturerAsNamed: 'Beijing Zhongke Tailong Electronics Co.',
      instrumentAsNamed: 'PECVD-150LL; ICP-100',
      journal: 'Applied Surface Science',
      year: 2026,
      doi: '10.1016/j.apsusc.2026.166329',
      verification:
        'Instruments named in NineScrolls Publication Spotlight article pecvd-icp-ptse2-photodetector: "PECVD-150LL ... ICP-100 ... Manufacturer: Beijing Zhongke Tailong Electronics".',
    }),
  },
];

async function main() {
  requireApply(process.argv.slice(2), 'seed-evidence-spotlights');
  assertUniqueSlugs(RECORDS.map((rec) => rec.slug), 'seed-evidence-spotlights');
  await authenticate();
  let created = 0;
  let skipped = 0;
  for (const rec of RECORDS) {
    const input = {
      slug: rec.slug,
      title: rec.title,
      type: 'publication',
      status: 'draft',
      products: rec.products,
      summary: rec.summary,
      articleSlug: rec.articleSlug,
      sourceUrl: rec.sourceUrl,
      meta: JSON.stringify(rec.meta), // AWSJSON must be a JSON string
    };
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
