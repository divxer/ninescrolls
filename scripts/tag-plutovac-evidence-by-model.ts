/**
 * Per-model product tagging for PLUTOVAC plasma-cleaner Evidence.
 *
 * Adds each record's confirmed model SKU slug (pluto-t/f/m) to `products`,
 * KEEPING `plasma-cleaner` so the /products/plasma-cleaner overview still shows
 * the full aggregate. Result: each Pluto SKU page (which queries its own slug)
 * shows only the papers that used THAT model, while the overview shows all.
 *
 * Public-safety note: pluto-t/f/m are NineScrolls's own public product names
 * (they are the page URLs/titles), NOT the OEM secret — exposing them as public
 * product slugs is fine. The OEM brand (PLUTOVAC/Peiyuan) stays banned + stripped.
 * This is why `PLUTO-T/F/M` were removed from scripts/lib/bannedOem.ts and
 * pluto-* added to verify-evidence-no-oem's PRODUCTS scan.
 *
 * Idempotent: converges when the model slug is already present.
 *
 * Usage:  set -a; source .env; set +a; npx tsx scripts/tag-plutovac-evidence-by-model.ts --apply
 */
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { authenticate } from './lib/auth';
import {
  checkedGraphql,
  evidenceBySlug,
  requireApply,
  type EvidenceGraphqlClient,
} from './lib/evidenceSeedOperations';
import amplifyOutputs from '../amplify_outputs.json';

Amplify.configure(amplifyOutputs as any);
const client = generateClient() as unknown as EvidenceGraphqlClient;

const UPDATE = `mutation UpdateEvidence($input:UpdateEvidenceInput!){ updateEvidence(input:$input){ id slug products } }`;
const AUTH = { authMode: 'userPool' as const };

// [slug, modelSlug] — model confirmed verbatim in the paper (see the seeder).
// #7 (butterfly-wing) has an unspecified model → no SKU tag (overview-only).
const MODEL: Array<[string, 'pluto-t' | 'pluto-f' | 'pluto-m']> = [
  ['pub-plutovac-phase-shifter-micromachines-2025', 'pluto-f'],   // #9
  ['pub-plutovac-dl-microfluidic-labchip-2026', 'pluto-f'],       // #22
  ['pub-plutovac-optofluidic-mzi-boe-2024', 'pluto-t'],           // #5
  ['pub-plutovac-metal-3d-nanoprint-natcommun-2023', 'pluto-t'],  // #2
  ['pub-plutovac-laseremission-microdroplet-lsa-2025', 'pluto-t'],// #8
  ['pub-plutovac-saw-boundary-pre-2025', 'pluto-t'],              // #17
  ['pub-plutovac-bulkcusp-natcommun-2026', 'pluto-t'],            // #21
  ['pub-plutovac-nanoantibiotics-sciadv-2023', 'pluto-m'],        // #4
  ['pub-plutovac-singlemol-fiber-arxiv-2025', 'pluto-t'],         // #20 (held preprint; tag for future)
];

async function main() {
  requireApply(process.argv.slice(2), 'tag-plutovac-evidence-by-model');
  await authenticate();

  // Preflight all before any write.
  const plan: Array<{ id: string; slug: string; products: string[]; changed: boolean }> = [];
  for (const [slug, modelSlug] of MODEL) {
    const rec = await evidenceBySlug(client, slug);
    if (!rec) throw new Error(`preflight: ${slug} not found`);
    if (rec.type !== 'publication') throw new Error(`preflight: ${slug} is not a publication`);
    const current = rec.products ?? [];
    if (!current.includes('plasma-cleaner')) {
      throw new Error(`preflight: ${slug} lost its plasma-cleaner tag (${JSON.stringify(current)})`);
    }
    // plasma-cleaner first (aggregate), then the model slug. Dedup.
    const next = [...new Set(['plasma-cleaner', modelSlug, ...current])];
    plan.push({ id: rec.id!, slug, products: next, changed: !current.includes(modelSlug) });
  }

  let tagged = 0, converged = 0;
  for (const { id, slug, products, changed } of plan) {
    if (!changed) { console.log(`converged (already tagged): ${slug}`); converged++; continue; }
    const res = await checkedGraphql<{ data: { updateEvidence: { products?: string[] } | null } }>(
      client, { query: UPDATE, variables: { input: { id, products } }, ...AUTH }, `tag ${slug}`,
    );
    const got = res.data.updateEvidence?.products ?? [];
    if (!got.includes(products[1])) throw new Error(`tag ${slug} failed: model slug not persisted`);
    console.log(`tagged: ${slug} -> [${got.join(', ')}]`);
    tagged++;
  }

  console.log(`\nDone. tagged=${tagged} converged=${converged} (of ${MODEL.length}).`);
  console.log('Run scripts/verify-evidence-no-oem.ts to confirm no OEM leak on the new per-model payloads.');
}
main().catch((e) => { console.error(e); process.exit(1); });
