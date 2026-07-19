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
import type { Schema } from '../amplify/data/resource';
import outputs from '../amplify_outputs.json';
import { authenticate } from './lib/auth';
import { listRawEvidence, type EvidenceGraphqlClient } from './lib/evidenceSeedOperations';
import { findBannedTokens } from './lib/bannedOem';

Amplify.configure(outputs);

const PRODUCTS = ['icp-etcher', 'rie-etcher', 'pecvd', 'sputter', 'ibe-ribe', 'striper'];
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
  const anon = generateClient<Schema>({ authMode: 'apiKey' });

  const targets: Array<{ label: string; productSlug?: string }> = [
    { label: 'ALL (every published record)' }, // product-agnostic — catches any slug, incl. future ones
    ...PRODUCTS.map((slug) => ({ label: slug, productSlug: slug })),
  ];

  let failed = false;
  for (const { label, productSlug } of targets) {
    const res = await anon.queries.listPublishedEvidence(productSlug ? { productSlug } : {});
    if (res.errors?.length) {
      throw new Error(`listPublishedEvidence(${label}) errored: ${res.errors.map((e) => e.message).join(', ')}`);
    }
    const payload = typeof res.data === 'string' ? res.data : JSON.stringify(res.data ?? []);
    const lower = payload.toLowerCase();
    const dynamicHits = dynamicTokens.filter((t) => lower.includes(t.toLowerCase()));
    const hits = [...new Set([...findBannedTokens(payload), ...dynamicHits])];
    const parsed = JSON.parse(payload);
    const count = Array.isArray(parsed) ? (parsed as unknown[]).length : 0;
    if (hits.length) {
      failed = true;
      console.error(`LEAK on ${label}: ${hits.join(', ')}`);
    } else {
      console.log(`OK ${label}: clean (${count} record(s))`);
    }
  }
  if (failed) {
    console.error('\nSECURITY FAIL: OEM tokens present in a public payload.');
    process.exit(1);
  }
  console.log('\nOK: no static or harvested OEM tokens in any public product payload.');
}
main().catch((e) => { console.error(e); process.exit(1); });
