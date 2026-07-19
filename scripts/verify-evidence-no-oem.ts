// scripts/verify-evidence-no-oem.ts
// Live acceptance: FAIL if any OEM token appears in the anonymous (apiKey)
// listPublishedEvidence payload. Two blacklists combined:
//   (1) static — scripts/lib/bannedOem.ts (known brand names + model strings);
//   (2) dynamic — harvested at runtime from the AUTHENTICATED records' own
//       sensitive meta (manufacturerAsNamed / manufacturerLegalName /
//       instrumentAsNamed) and slugs, so even an uncatalogued model can't slip.
// Run AFTER deploying the whitelist projection (and again AFTER publishing).
// Usage: set -a; source .env; set +a; npx tsx scripts/verify-evidence-no-oem.ts
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import outputs from '../amplify_outputs.json';
import { authenticate } from './lib/auth';
import { listRawEvidence, type EvidenceGraphqlClient } from './lib/evidenceSeedOperations';
import { readPublishedEvidence } from './lib/evidencePublicRead';
import { findBannedTokens } from './lib/bannedOem';

Amplify.configure(outputs);

const PRODUCTS = ['icp-etcher', 'rie-etcher', 'pecvd', 'sputter', 'ibe-ribe', 'striper', 'plasma-cleaner', 'e-beam-evaporator', 'pluto-t', 'pluto-f', 'pluto-m', 'pluto-30'];
const SENSITIVE_META_KEYS = ['manufacturerAsNamed', 'manufacturerLegalName', 'instrumentAsNamed', 'instrumentRefinedFrom', 'instrumentRefinedVia'];

async function harvestSensitive(): Promise<string[]> {
  await authenticate();
  const authedRaw = generateClient() as unknown as EvidenceGraphqlClient;
  const values = new Set<string>();
  for (const rec of await listRawEvidence(authedRaw)) {
    if (rec.slug) values.add(rec.slug);
    let meta: Record<string, unknown> = {};
    try { meta = rec.meta ? JSON.parse(rec.meta) : {}; } catch { meta = {}; }
    for (const key of SENSITIVE_META_KEYS) {
      const v = meta[key];
      if (typeof v === 'string' && v.trim().length >= 3) values.add(v);
    }
  }
  // Drop any harvested token that is a substring of a known-safe product slug
  // (e.g. a bare "ICP" would false-positive against the payload's own `products`
  // field). Distinctive brand/model strings are never product-slug substrings,
  // so they are retained.
  return [...values].filter((token) => {
    const t = token.toLowerCase();
    return !PRODUCTS.some((slug) => slug.includes(t));
  });
}

async function main() {
  const dynamicTokens = await harvestSensitive();
  console.log(`Harvested ${dynamicTokens.length} sensitive internal strings to scan for.`);
  // Raw apiKey GraphQL (not the typed .queries accessor) so a stale
  // amplify_outputs.json introspection can't make this crash — see
  // ./lib/evidencePublicRead.
  const anon = generateClient() as unknown as EvidenceGraphqlClient;

  const targets: Array<{ label: string; productSlug?: string }> = [
    { label: 'ALL (every published record)' }, // product-agnostic — catches any slug, incl. future ones
    ...PRODUCTS.map((slug) => ({ label: slug, productSlug: slug })),
  ];

  let failed = false;
  for (const { label, productSlug } of targets) {
    const { raw, records } = await readPublishedEvidence(anon, productSlug);
    const lower = raw.toLowerCase();
    const dynamicHits = dynamicTokens.filter((t) => lower.includes(t.toLowerCase()));
    const hits = [...new Set([...findBannedTokens(raw), ...dynamicHits])];
    if (hits.length) {
      failed = true;
      console.error(`LEAK on ${label}: ${hits.join(', ')}`);
    } else {
      console.log(`OK ${label}: clean (${records.length} record(s))`);
    }
  }
  if (failed) {
    console.error('\nSECURITY FAIL: OEM tokens present in a public payload.');
    process.exit(1);
  }
  console.log('\nOK: no static or harvested OEM tokens in any public product payload.');
}
main().catch((e) => { console.error(e); process.exit(1); });
