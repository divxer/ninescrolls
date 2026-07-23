/**
 * One-time migration: convert every remaining inline content blob in
 * insightsPostsData.ts to the HTML-backed pattern (scripts/articles/<slug>.html
 * + content: '' + NOTE guard). Article bodies are pulled from DynamoDB — the
 * single source of truth — NOT from the (possibly stale) local blobs.
 *
 * Usage: ADMIN_EMAIL=... ADMIN_PASSWORD=... npx tsx scripts/migrate-insights-to-html.ts
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../amplify/data/resource';
import { authenticate } from './lib/auth';
import amplifyOutputs from '../amplify_outputs.json';

Amplify.configure(amplifyOutputs as any);
const client = generateClient<Schema>({ authMode: 'userPool' });

const DATA_FILE = 'scripts/insightsPostsData.ts';

/** Find the end of a template literal starting right after `content: \`` (handles \` escapes). */
function findBlobEnd(src: string, start: number): number {
  for (let i = start; i < src.length; i++) {
    if (src[i] === '\\') { i++; continue; }
    if (src[i] === '`') return i;
  }
  return -1;
}

function noteFor(slug: string): string {
  return (
    `// NOTE: Article body content lives in scripts/articles/${slug}.html\n` +
    `    // (the single source of truth) and is synced to DynamoDB via update-insight-from-html.ts.\n` +
    `    // The previous inline blob here was a stale copy of the live DDB article — do NOT restore it.\n` +
    `    // The empty string ensures seed/update scripts never overwrite the live DDB content.\n` +
    `    // Metadata below is still consumed (seed-insights.ts RELATED_PRODUCTS_MAP / HERO_IMAGES_MAP).\n` +
    `    content: ''`
  );
}

async function main() {
  await authenticate();

  // 1) Pull slug -> content for every post in DDB (paginated).
  const ddb = new Map<string, string>();
  let nextToken: string | null | undefined = undefined;
  do {
    const { data, nextToken: nt, errors } = await (client.models.InsightsPost as any).list({
      limit: 100,
      nextToken,
      selectionSet: ['slug', 'content'],
    });
    if (errors) { console.error(errors); process.exit(1); }
    for (const p of data || []) ddb.set(p.slug, p.content || '');
    nextToken = nt;
  } while (nextToken);
  console.log(`DDB: ${ddb.size} posts fetched`);

  // 2) Walk the data file, replacing each blob.
  let src = readFileSync(DATA_FILE, 'utf-8');
  let converted = 0;
  const skipped: string[] = [];

  for (;;) {
    const ci = src.indexOf('content: `');
    if (ci < 0) break;

    const blobStart = ci + 'content: `'.length;
    const blobEnd = findBlobEnd(src, blobStart);
    if (blobEnd < 0) { console.error('Unterminated template literal — aborting.'); process.exit(1); }

    // slug appears after the content field in every entry
    const slugMatch = /slug: '([^']+)'/.exec(src.slice(blobEnd));
    if (!slugMatch) { console.error('No slug found after blob — aborting.'); process.exit(1); }
    const slug = slugMatch[1];

    const live = ddb.get(slug);
    if (!live || live.trim().length === 0) {
      // Not in DDB (or empty there): keep the local blob, but mark it so the loop can move on.
      skipped.push(slug);
      src = src.slice(0, ci) + 'content: /* KEEP */ `' + src.slice(blobStart);
      continue;
    }

    const outPath = `scripts/articles/${slug}.html`;
    if (existsSync(outPath)) { console.error(`${outPath} already exists — aborting to avoid clobber.`); process.exit(1); }
    writeFileSync(outPath, live + '\n');

    src = src.slice(0, ci) + noteFor(slug) + src.slice(blobEnd + 1);
    converted++;
    console.log(`converted: ${slug}  (${live.length} chars)`);
  }

  // restore KEEP markers
  src = src.replace(/content: \/\* KEEP \*\/ `/g, 'content: `');
  writeFileSync(DATA_FILE, src);

  console.log(`\nDone. converted=${converted}, kept-inline (not in DDB or empty): ${skipped.length}`);
  for (const s of skipped) console.log(`  KEPT: ${s}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
