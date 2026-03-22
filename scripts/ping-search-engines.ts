/**
 * Notify search engines of new URLs via IndexNow (Bing, Yandex).
 *
 * Usage:
 *   npx tsx scripts/ping-search-engines.ts <url1> [url2] ...
 *   npx tsx scripts/ping-search-engines.ts --today          # ping articles published today
 *
 * Prerequisites:
 *   - amplify_outputs.json (only for --today mode)
 */

import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../amplify/data/resource';

const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';
const INDEXNOW_KEY = 'b8f4e2a1c7d94f3e8a6b0c5d7e9f1a2b';
const BASE_URL = 'https://ninescrolls.com';

async function pingIndexNow(urls: string[]): Promise<void> {
  if (urls.length === 0) {
    console.log('No URLs to ping.');
    return;
  }

  console.log(`Pinging IndexNow with ${urls.length} URL(s)...`);
  for (const url of urls) {
    console.log(`  ${url}`);
  }

  const body = {
    host: 'ninescrolls.com',
    key: INDEXNOW_KEY,
    keyLocation: `${BASE_URL}/${INDEXNOW_KEY}.txt`,
    urlList: urls,
  };

  try {
    const response = await fetch(INDEXNOW_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(body),
    });

    if (response.ok || response.status === 202) {
      console.log(`\nIndexNow accepted (HTTP ${response.status}).`);
    } else {
      const text = await response.text();
      console.error(`\nIndexNow rejected (HTTP ${response.status}): ${text}`);
    }
  } catch (err) {
    console.error('\nIndexNow request failed:', err);
  }
}

async function fetchTodayArticles(): Promise<string[]> {
  const amplifyOutputs = await import('../amplify_outputs.json');
  Amplify.configure(amplifyOutputs.default as any);
  const client = generateClient<Schema>();

  const today = new Date().toISOString().split('T')[0];
  const urls: string[] = [];
  let cursor: string | null | undefined = undefined;

  do {
    const page = await client.models.InsightsPost.list({
      limit: 100,
      filter: { isDraft: { ne: true }, publishDate: { eq: today } },
      ...(cursor ? { nextToken: cursor } : {}),
    });

    for (const item of page.data) {
      if (!item.slug) continue;
      const path = item.contentType === 'news'
        ? `/news/${item.slug}`
        : `/insights/${item.slug}`;
      urls.push(`${BASE_URL}${path}`);
    }
    cursor = page.nextToken;
  } while (cursor);

  return urls;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage:');
    console.error('  npx tsx scripts/ping-search-engines.ts <url1> [url2] ...');
    console.error('  npx tsx scripts/ping-search-engines.ts --today');
    process.exit(1);
  }

  let urls: string[];

  if (args.includes('--today')) {
    console.log('Fetching articles published today...');
    urls = await fetchTodayArticles();
    if (urls.length === 0) {
      console.log('No articles published today.');
      return;
    }
  } else {
    urls = args.filter(a => a.startsWith('http'));
    if (urls.length === 0) {
      console.error('No valid URLs provided. URLs must start with http.');
      process.exit(1);
    }
  }

  await pingIndexNow(urls);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
