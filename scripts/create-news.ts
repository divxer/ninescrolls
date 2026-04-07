/**
 * Create a news article in DynamoDB from an HTML file.
 *
 * Usage:
 *   ADMIN_EMAIL=$ADMIN_EMAIL ADMIN_PASSWORD=$ADMIN_PASSWORD npx tsx scripts/create-news.ts <html-file> [--publish]
 *
 * Options:
 *   --publish  Publish immediately (skip draft) and notify Bing/Yandex via IndexNow
 *
 * Example:
 *   npx tsx scripts/create-news.ts ~/marketing/insight/article.html              # as draft
 *   npx tsx scripts/create-news.ts ~/marketing/insight/article.html --publish    # publish + ping
 *   npx tsx scripts/create-news.ts ~/marketing/insight/article.html --category Event  # set category
 *
 * The script extracts title, content, and metadata from the HTML file,
 * then creates an InsightsPost record with contentType='news'.
 */

import { readFileSync } from 'fs';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../amplify/data/resource';
import { authenticate } from './lib/auth';

import amplifyOutputs from '../amplify_outputs.json';
Amplify.configure(amplifyOutputs as any);

const client = generateClient<Schema>({ authMode: 'userPool' });

function generateSlug(title: string): string {
  const raw = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  if (raw.length <= 80) return raw;
  return raw.slice(0, 80).replace(/-[^-]*$/, '');
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function estimateReadTime(text: string): number {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

function extractBodyContent(html: string): string {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return bodyMatch ? bodyMatch[1].trim() : html;
}

function extractTitle(html: string): string {
  // Try <h1> first, then <title>
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1Match) return stripHtml(h1Match[1]);
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch) return stripHtml(titleMatch[1]);
  return 'Untitled News';
}

function extractFirstImage(html: string): string {
  const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return imgMatch ? imgMatch[1] : '';
}

async function createNews(filePath: string) {
  await authenticate();

  const html = readFileSync(filePath, 'utf-8');
  const title = extractTitle(html);
  const bodyContent = extractBodyContent(html);

  // Clean body content for storage
  let cleaned = bodyContent;
  // Remove <h1> (already used as title)
  cleaned = cleaned.replace(/<h1[^>]*>[\s\S]*?<\/h1>/i, '');
  // Remove byline paragraph (NineScrolls.com | date)
  cleaned = cleaned.replace(/<p><strong>NineScrolls\.com<\/strong>[^<]*<\/p>/i, '');
  // Remove the first <img> (will be shown as hero via imageUrl)
  cleaned = cleaned.replace(/<img[^>]*>/i, '');
  // Remove inline Table of Contents (rendered via sidebar TOC component)
  cleaned = cleaned.replace(/<h2[^>]*>\s*Table of Contents\s*<\/h2>\s*<ul>[\s\S]*?<\/ul>/i, '');
  const content = cleaned.trim();

  // Extract excerpt from body text, skipping TOC section
  const withoutToc = content
    .replace(/<h2[^>]*>Table of Contents<\/h2>/i, '')
    .replace(/<ul>[\s\S]*?<\/ul>/i, ''); // remove first <ul> (TOC links)
  const plainText = stripHtml(withoutToc);
  const slug = generateSlug(title);
  const readTime = estimateReadTime(stripHtml(content));
  const excerpt = plainText.replace(/^\s+/, '').slice(0, 200);
  const today = new Date().toISOString().split('T')[0];
  const coverImage = extractFirstImage(bodyContent);

  console.log(`Title: ${title}`);
  console.log(`Slug: ${slug}`);
  console.log(`Read time: ${readTime} min`);
  console.log(`Content length: ${content.length} chars`);
  console.log(`Excerpt: ${excerpt.slice(0, 80)}...`);
  console.log(`Cover image: ${coverImage || '(none - will use category placeholder)'}`);

  // Check slug uniqueness
  const { data: existing } = await client.models.InsightsPost.listInsightsPostBySlug({ slug });
  if (existing && existing.length > 0) {
    console.error(`\nSlug "${slug}" already exists! Aborting.`);
    process.exit(1);
  }

  const publish = process.argv.includes('--publish');
  const categoryIdx = process.argv.indexOf('--category');
  const category = categoryIdx !== -1 && process.argv[categoryIdx + 1]
    ? process.argv[categoryIdx + 1]
    : 'Industry';

  const { data, errors } = await client.models.InsightsPost.create({
    slug,
    title,
    content,
    excerpt,
    author: 'NineScrolls Team',
    publishDate: today,
    category,
    readTime,
    imageUrl: coverImage || `/assets/images/news/${slug}`,
    tags: [],
    contentType: 'news',
    isDraft: !publish,
  });

  if (errors) {
    console.error('\nCreate failed:', errors);
    process.exit(1);
  }

  console.log(`\nCreated successfully${publish ? ' (published)' : ' (as draft)'}!`);
  console.log(`  id: ${data?.id}`);
  console.log(`  slug: ${slug}`);
  console.log(`  contentType: news`);
  console.log(`  isDraft: ${!publish}`);

  if (publish) {
    // Ping IndexNow (Bing/Yandex) for instant indexing
    const articleUrl = `https://ninescrolls.com/news/${slug}`;
    console.log(`\nNotifying search engines: ${articleUrl}`);
    await pingIndexNow(articleUrl);
    console.log('\nSitemap/RSS will update automatically (served dynamically via Lambda).');
  } else {
    console.log(`\nNext steps:`);
    console.log(`  1. Upload a cover image via admin`);
    console.log(`  2. Review and publish at /admin/insights/${data?.id}/edit`);
  }
}

const INDEXNOW_KEY = process.env.INDEXNOW_KEY ?? '';

async function pingIndexNow(url: string) {
  try {
    const response = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host: 'ninescrolls.com',
        key: INDEXNOW_KEY,
        keyLocation: `https://ninescrolls.com/${INDEXNOW_KEY}.txt`,
        urlList: [url],
      }),
    });
    if (response.ok || response.status === 202) {
      console.log(`  IndexNow accepted (HTTP ${response.status})`);
    } else {
      console.warn(`  IndexNow rejected (HTTP ${response.status})`);
    }
  } catch (err) {
    console.warn('  IndexNow ping failed (non-blocking):', err);
  }
}

// CLI entry
// Skip flags and their values (e.g. --category Event)
const flagsWithValues = new Set(['--category']);
const positionalArgs: string[] = [];
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i].startsWith('--')) {
    if (flagsWithValues.has(process.argv[i])) i++; // skip value
  } else {
    positionalArgs.push(process.argv[i]);
  }
}
const filePath = positionalArgs[0];
if (!filePath) {
  console.error('Usage: npx tsx scripts/create-news.ts <html-file> [--publish] [--category <cat>]');
  console.error('  --publish           Publish immediately and notify search engines');
  console.error('  --category <cat>    Set category (Industry|Product|Event|Partnership)');
  process.exit(1);
}

createNews(filePath).catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
