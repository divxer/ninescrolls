/**
 * One-time migration: set contentType='news' on all InsightsPost records
 * whose category belongs to newsCategories (Industry, Product, Event, Partnership).
 *
 * Usage:
 *   ADMIN_EMAIL=$ADMIN_EMAIL ADMIN_PASSWORD=$ADMIN_PASSWORD npx tsx scripts/migrate-news-content-type.ts
 *
 * Add --dry-run to preview changes without writing.
 */

import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { signIn } from 'aws-amplify/auth';
import type { Schema } from '../amplify/data/resource';

import amplifyOutputs from '../amplify_outputs.json';
Amplify.configure(amplifyOutputs as any);

const client = generateClient<Schema>({ authMode: 'userPool' });
const rawClient = generateClient({ authMode: 'userPool' });

const NEWS_CATEGORIES = new Set(['Industry', 'Product', 'Event', 'Partnership']);

async function authenticate() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD environment variables.');
    process.exit(1);
  }
  console.log(`Signing in as ${email}...`);
  const { isSignedIn } = await signIn({ username: email, password });
  if (!isSignedIn) {
    console.error('Sign-in failed.');
    process.exit(1);
  }
  console.log('Authenticated.\n');
}

async function fetchAll() {
  const all: Schema['InsightsPost']['type'][] = [];
  let cursor: string | null | undefined = undefined;

  do {
    const page = await client.models.InsightsPost.list({
      limit: 100,
      ...(cursor ? { nextToken: cursor } : {}),
    });
    all.push(...page.data);
    cursor = page.nextToken;
  } while (cursor);

  return all;
}

async function migrate(dryRun: boolean) {
  await authenticate();

  const posts = await fetchAll();
  console.log(`Total records: ${posts.length}`);

  const toUpdate = posts.filter(
    p => NEWS_CATEGORIES.has(p.category) && p.contentType !== 'news'
  );

  console.log(`Records to update: ${toUpdate.length}`);
  if (toUpdate.length === 0) {
    console.log('Nothing to do.');
    return;
  }

  console.log('\nRecords:');
  for (const p of toUpdate) {
    console.log(`  [${p.category}] ${p.title.slice(0, 70)}  (contentType: ${p.contentType ?? 'null'})`);
  }

  if (dryRun) {
    console.log('\n--dry-run: no changes written.');
    return;
  }

  console.log('\nUpdating...');
  let success = 0;
  let failed = 0;

  for (const p of toUpdate) {
    try {
      const result = await rawClient.graphql({
        query: `mutation UpdateInsightsPost($input: UpdateInsightsPostInput!) {
          updateInsightsPost(input: $input) { id contentType }
        }`,
        variables: { input: { id: p.id, contentType: 'news' } },
      });
      console.log(`  OK: ${p.title.slice(0, 50)}`);
      success++;
    } catch (err: any) {
      console.error(`  FAILED: ${p.title.slice(0, 50)} — ${err.message || JSON.stringify(err)}`);
      failed++;
    }
  }

  console.log(`\nDone. ${success} updated, ${failed} failed.`);
}

const dryRun = process.argv.includes('--dry-run');
migrate(dryRun).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
