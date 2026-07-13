/**
 * Seed publication-type Evidence records into DynamoDB via Amplify (admin auth).
 * Far faster / repeatable / reviewable than clicking the admin form.
 *
 * Usage:
 *   npx tsx scripts/seed-evidence.ts
 *   (creds from .env, or: ADMIN_EMAIL=... ADMIN_PASSWORD=... npx tsx scripts/seed-evidence.ts)
 *
 * Prerequisites:
 *   1. amplify_outputs.json MUST be CURRENT (include the Evidence model). The
 *      local copy is often stale — regenerate against the deployed backend first:
 *        npx ampx generate outputs --app-id d244ebmxcttcdz --branch main
 *      (If Evidence is missing from the introspection, client.models.Evidence is
 *      undefined and this script exits early with a clear message.)
 *   2. ADMIN_EMAIL / ADMIN_PASSWORD (Cognito admin) in .env or environment.
 *
 * Idempotent: skips a record whose slug already exists.
 * Records are created as status:'draft' (NOT public) for review before publish.
 *
 * Provenance note: these are `publication` evidence for the ICP platform
 * NineScrolls is the authorized distributor of; each paper names the instrument
 * as "Tailong Electronics ICP-100A". The meta preserves the honest attribution.
 * Only full-text-verified papers are included (see meta.verification).
 */
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../amplify/data/resource';
import { authenticate } from './lib/auth';

import amplifyOutputs from '../amplify_outputs.json';
Amplify.configure(amplifyOutputs as any);

const client = generateClient<Schema>({ authMode: 'userPool' });

const DISCLOSURE =
  'NineScrolls is the authorized distributor of this platform (Tailong Electronics)';
const summaryFor = (instrument: string) =>
  `Peer-reviewed research using the ICP platform for which NineScrolls is the authorized ` +
  `distributor, identified in the publication as the Tailong Electronics ${instrument}.`;

interface EvidenceSeed {
  slug: string;
  title: string;
  type: string;
  products: string[];
  sourceUrl: string;
  summary: string;
  meta: Record<string, unknown>;
  status: string;
}

const RECORDS: EvidenceSeed[] = [
  {
    slug: 'pub-tailong-icp100a-nanomaterials-2020',
    title: 'Periodic Microstructures Fabricated by Laser Interference with Subsequent Etching',
    type: 'publication',
    products: ['icp-etcher'],
    sourceUrl: 'https://doi.org/10.3390/nano10071313',
    summary: summaryFor('ICP-100A'),
    meta: {
      manufacturerAsNamed: 'Tailong Electronics',
      instrumentAsNamed: 'ICP-100A',
      relationshipDisclosure: DISCLOSURE,
      journal: 'Nanomaterials',
      year: 2020,
      doi: '10.3390/nano10071313',
      verifiedAt: '2026-07-13',
      verification:
        'full-text quote: "inductively coupled plasma (ICP, ICP-100A, TAILONG ELECTRONICS, Beijing, China)" — open access, PMC7407610',
    },
    status: 'draft',
  },
  {
    slug: 'pub-tailong-icp100a-photonix-2022',
    title: 'Biomimetic sapphire windows enabled by inside-out femtosecond laser deep-scribing',
    type: 'publication',
    products: ['icp-etcher'],
    sourceUrl: 'https://doi.org/10.1186/s43074-022-00047-3',
    summary: summaryFor('ICP-100A'),
    meta: {
      manufacturerAsNamed: 'Tailong Electronics',
      instrumentAsNamed: 'ICP-100A',
      relationshipDisclosure: DISCLOSURE,
      journal: 'PhotoniX',
      year: 2022,
      doi: '10.1186/s43074-022-00047-3',
      verifiedAt: '2026-07-13',
      verification:
        'full-text quote: "inductively coupled plasma system (ICP-100A, Tailong Electronics, Ltd)" — open access, PDF p.3',
    },
    status: 'draft',
  },
];

async function slugExists(slug: string): Promise<boolean> {
  const { data } = await client.models.Evidence.listEvidenceBySlug({ slug });
  return (data ?? []).length > 0;
}

async function main() {
  await authenticate();

  if (!client.models.Evidence) {
    console.error(
      'client.models.Evidence is undefined — amplify_outputs.json is stale (missing the Evidence model).\n' +
        'Regenerate: npx ampx generate outputs --app-id d244ebmxcttcdz --branch main'
    );
    process.exit(1);
  }

  for (const rec of RECORDS) {
    if (await slugExists(rec.slug)) {
      console.log(`skip (slug exists): ${rec.slug}`);
      continue;
    }
    const { data, errors } = await client.models.Evidence.create({
      slug: rec.slug,
      title: rec.title,
      type: rec.type,
      products: rec.products,
      sourceUrl: rec.sourceUrl,
      summary: rec.summary,
      // a.json() / AWSJSON MUST be a JSON string (same convention as InsightsPost
      // relatedProducts/faqs) — passing a raw object is rejected by AppSync.
      meta: JSON.stringify(rec.meta),
      status: rec.status,
    });
    if (errors) {
      console.error(`FAILED ${rec.slug}:`, errors);
      process.exit(1);
    }
    console.log(`created draft: id=${data?.id}  ${rec.slug}`);
  }

  console.log(
    '\nDone. Records are status:draft (NOT public). Review in /admin/evidence, then publish when ready.'
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
