/**
 * Seed script for migrating hardcoded insights posts to DynamoDB via Amplify.
 *
 * Usage:
 *   npx tsx scripts/seed-insights.ts
 *
 * Prerequisites:
 *   - Amplify sandbox or production environment running
 *   - amplify_outputs.json exists in project root
 */

import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../amplify/data/resource';
import { buildInsightRecord } from './lib/insightRecord';

// Load Amplify config
import amplifyOutputs from '../amplify_outputs.json';
Amplify.configure(amplifyOutputs as any);

const client = generateClient<Schema>();

// ─── Import existing hardcoded posts ─────────────────────────────────────────
// Legacy data extracted from src/types/index.ts before migration
import { insightsPosts } from './insightsPostsData';

async function seedInsights() {
  console.log(`\nSeeding ${insightsPosts.length} insights posts to DynamoDB...\n`);

  // Preflight: build EVERY record before creating ANY. buildInsightRecord fails
  // closed (throws) when a body cannot be resolved — a missing/empty
  // scripts/articles/<slug>.html must abort the whole seed, never produce a
  // metadata-only stub.
  const records: ReturnType<typeof buildInsightRecord>[] = [];
  const unresolvable: string[] = [];
  for (const post of insightsPosts) {
    try {
      records.push(buildInsightRecord(post));
    } catch (err) {
      unresolvable.push(`${post.slug}: ${err instanceof Error ? err.message : err}`);
    }
  }
  if (unresolvable.length > 0) {
    console.error(`ABORT: ${unresolvable.length} post(s) have no resolvable body — nothing was created:`);
    for (const msg of unresolvable) console.error(`  ${msg}`);
    process.exit(1);
  }
  console.log(`Preflight OK: all ${records.length} bodies resolved.\n`);

  let success = 0;
  let failed = 0;
  let skipped = 0;

  for (const record of records) {
    // Idempotency guard: this loop uses .create() with no natural key, so re-running it
    // against a populated table would duplicate every record. A duplicate is dangerous for
    // articles whose body lives in scripts/articles/<slug>.html (empty content here): the
    // render query picks the first record from the slug GSI, so an empty-content duplicate
    // could shadow the live article. Skip any slug that already exists — never clobber.
    const { data: existing } = await client.models.InsightsPost.listInsightsPostBySlug({ slug: record.slug });
    if (existing && existing.length > 0) {
      console.log(`  SKIP: ${record.slug} already exists (id: ${existing[0].id})`);
      skipped++;
      continue;
    }

    try {
      const { data, errors } = await client.models.InsightsPost.create(record);

      if (errors) {
        console.error(`  FAIL: ${record.slug}`, errors);
        failed++;
      } else {
        console.log(`  OK: ${record.slug} (id: ${data?.id})`);
        success++;
      }
    } catch (err) {
      console.error(`  FAIL: ${record.slug}`, err);
      failed++;
    }
  }

  console.log(`\nDone. Success: ${success}, Skipped (already existed): ${skipped}, Failed: ${failed}\n`);
  if (failed > 0) process.exit(1);
}

seedInsights().catch((err) => { console.error(err); process.exit(1); });
