/**
 * Verify public/llms.txt and public/llms-full.txt list every published
 * Insights article in DynamoDB.
 *
 * News articles (contentType === 'news') are excluded by design: llms.txt
 * links only the /news listing page, matching the sitemap's news-decay policy.
 *
 * Usage: ADMIN_EMAIL=... ADMIN_PASSWORD=... npx tsx scripts/check-llms-sync.ts
 * Exits 1 if any published insight is missing from either file (run before
 * publishing a new article, and after, to confirm the llms sync step landed).
 */
import { readFileSync } from 'node:fs';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../amplify/data/resource';
import { authenticate } from './lib/auth';

import amplifyOutputs from '../amplify_outputs.json';
Amplify.configure(amplifyOutputs as any);

const client = generateClient<Schema>({ authMode: 'userPool' });

function slugsInFile(path: string): Set<string> {
  const text = readFileSync(path, 'utf8');
  const matches = text.matchAll(/ninescrolls\.com\/insights\/([a-z0-9-]+)/g);
  return new Set([...matches].map((m) => m[1]));
}

async function main() {
  await authenticate();

  const all: any[] = [];
  let nextToken: string | null | undefined = undefined;
  do {
    const { data, nextToken: nt, errors } = await client.models.InsightsPost.list({
      limit: 200,
      nextToken,
      selectionSet: ['slug', 'title', 'category', 'publishDate', 'contentType', 'isDraft'] as const,
    } as any);
    if (errors) {
      console.error('list errors:', errors);
      process.exit(1);
    }
    if (data) all.push(...data);
    nextToken = nt;
  } while (nextToken);

  const published = all.filter((p) => p.isDraft !== true && p.contentType !== 'news');
  const files = ['public/llms.txt', 'public/llms-full.txt'];

  let failed = false;
  for (const file of files) {
    const inFile = slugsInFile(file);
    const missing = published
      .filter((p) => !inFile.has(p.slug))
      .sort((a, b) => (b.publishDate || '').localeCompare(a.publishDate || ''));
    const ddbSlugs = new Set(published.map((p) => p.slug));
    const stale = [...inFile].filter((s) => !ddbSlugs.has(s));

    console.log(`\n${file}: ${inFile.size} insight links, ${published.length} published insights in DDB`);
    if (missing.length > 0) {
      failed = true;
      console.log(`  MISSING (${missing.length}):`);
      for (const p of missing) {
        console.log(`    ${p.publishDate}  [${p.category}]  ${p.slug}  — ${p.title}`);
      }
    }
    if (stale.length > 0) {
      failed = true;
      console.log(`  STALE (in file but not published in DDB) (${stale.length}):`);
      for (const s of stale) console.log(`    ${s}`);
    }
    if (missing.length === 0 && stale.length === 0) console.log('  OK — in sync');
  }

  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
