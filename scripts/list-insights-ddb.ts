/**
 * List every InsightsPost in DynamoDB.
 * Usage: ADMIN_EMAIL=... ADMIN_PASSWORD=... npx tsx scripts/list-insights-ddb.ts
 */
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../amplify/data/resource';
import { authenticate } from './lib/auth';
import { insightsPosts as localPosts } from './insightsPostsData';

import amplifyOutputs from '../amplify_outputs.json';
Amplify.configure(amplifyOutputs as any);

const client = generateClient<Schema>({ authMode: 'userPool' });

async function main() {
  await authenticate();

  const all: any[] = [];
  let nextToken: string | null | undefined = undefined;
  do {
    const { data, nextToken: nt, errors } = await client.models.InsightsPost.list({
      limit: 200,
      nextToken,
      selectionSet: ['id', 'slug', 'title', 'category', 'publishDate', 'readTime'] as const,
    } as any);
    if (errors) {
      console.error('list errors:', errors);
      process.exit(1);
    }
    if (data) all.push(...data);
    nextToken = nt;
  } while (nextToken);

  all.sort((a, b) => (b.publishDate || '').localeCompare(a.publishDate || ''));

  console.log(`TOTAL in DDB: ${all.length}`);
  console.log(`TOTAL in insightsPostsData.ts: ${localPosts.length}\n`);

  const localSlugs = new Set(localPosts.map((p) => p.slug));
  const ddbSlugs = new Set(all.map((p) => p.slug));

  const onlyDdb = all.filter((p) => !localSlugs.has(p.slug));
  const onlyLocal = localPosts.filter((p) => !ddbSlugs.has(p.slug));

  console.log(`--- ONLY IN DDB (${onlyDdb.length}) ---`);
  for (const p of onlyDdb) {
    console.log(`  ${p.publishDate}  [${p.category}]  ${p.slug}  — ${p.title}`);
  }

  console.log(`\n--- ONLY IN LOCAL FILE (${onlyLocal.length}) ---`);
  for (const p of onlyLocal) {
    console.log(`  ${p.publishDate}  [${p.category}]  ${p.slug}  — ${p.title}`);
  }

  console.log(`\n--- ALL DDB POSTS (newest first) ---`);
  for (const p of all) {
    console.log(`  ${p.publishDate}  [${p.category}]  ${p.slug}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
