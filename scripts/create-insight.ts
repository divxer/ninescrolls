/**
 * Create an insights article in DynamoDB from an HTML file.
 *
 * This is the preferred way to author new insights articles — write content
 * as a standalone HTML file instead of editing the monolithic insightsPostsData.ts.
 *
 * Usage:
 *   npm run create-insight -- <html-file> [options]
 *
 * Options:
 *   --publish           Publish immediately (skip draft) and notify search engines
 *   --category <cat>    Set category (default: derived from content or "Plasma Processing")
 *   --author <name>     Set author (default: "NineScrolls Engineering")
 *   --tags <t1,t2,...>  Comma-separated tags
 *
 * Example:
 *   npm run create-insight -- ~/articles/new-etching-guide.html
 *   npm run create-insight -- ~/articles/new-etching-guide.html --publish --tags "RIE,Etching"
 *
 * HTML file format:
 *   - <title> or <h1> → article title
 *   - <body> content → article body (h1 is removed, used as title)
 *   - First <img> → placeholder cover image URL (upload real cover via upload-news-image)
 *
 * After creating:
 *   1. Upload a cover image: npm run upload-news-image -- <slug> <image-file>
 *   2. Review at /admin/insights/<id>/edit
 *   3. Publish when ready
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
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
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
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1Match) return stripHtml(h1Match[1]);
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch) return stripHtml(titleMatch[1]);
  return 'Untitled Article';
}

function extractFirstImage(html: string): string {
  const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return imgMatch ? imgMatch[1] : '';
}

async function createInsight(filePath: string) {
  await authenticate();

  const html = readFileSync(filePath, 'utf-8');
  const title = extractTitle(html);
  const bodyContent = extractBodyContent(html);

  // Clean body content
  let cleaned = bodyContent;
  cleaned = cleaned.replace(/<h1[^>]*>[\s\S]*?<\/h1>/i, '');
  cleaned = cleaned.replace(/<h2[^>]*>\s*Table of Contents\s*<\/h2>\s*<ul>[\s\S]*?<\/ul>/i, '');
  const content = cleaned.trim();

  const plainText = stripHtml(content);
  const slug = generateSlug(title);
  const readTime = estimateReadTime(plainText);
  const excerpt = plainText.replace(/^\s+/, '').slice(0, 200);
  const today = new Date().toISOString().split('T')[0];
  const coverImage = extractFirstImage(bodyContent);

  // Parse CLI flags
  const publish = process.argv.includes('--publish');

  const categoryIdx = process.argv.indexOf('--category');
  const category = categoryIdx !== -1 && process.argv[categoryIdx + 1]
    ? process.argv[categoryIdx + 1]
    : 'Plasma Processing';

  const authorIdx = process.argv.indexOf('--author');
  const author = authorIdx !== -1 && process.argv[authorIdx + 1]
    ? process.argv[authorIdx + 1]
    : 'NineScrolls Engineering';

  const tagsIdx = process.argv.indexOf('--tags');
  const tags = tagsIdx !== -1 && process.argv[tagsIdx + 1]
    ? process.argv[tagsIdx + 1].split(',').map(t => t.trim()).filter(Boolean)
    : [];

  console.log(`Title: ${title}`);
  console.log(`Slug: ${slug}`);
  console.log(`Category: ${category}`);
  console.log(`Author: ${author}`);
  console.log(`Read time: ${readTime} min`);
  console.log(`Content length: ${content.length} chars`);
  console.log(`Excerpt: ${excerpt.slice(0, 80)}...`);
  console.log(`Tags: ${tags.length > 0 ? tags.join(', ') : '(none)'}`);
  console.log(`Cover image: ${coverImage || '(none - upload via upload-news-image)'}`);

  // Check slug uniqueness
  const { data: existing } = await client.models.InsightsPost.listInsightsPostBySlug({ slug });
  if (existing && existing.length > 0) {
    console.error(`\nSlug "${slug}" already exists! Aborting.`);
    process.exit(1);
  }

  const { data, errors } = await client.models.InsightsPost.create({
    slug,
    title,
    content,
    excerpt,
    author,
    publishDate: today,
    category,
    readTime,
    imageUrl: coverImage || `/assets/images/insights/${slug}`,
    tags,
    contentType: 'insight',
    isDraft: !publish,
  });

  if (errors) {
    console.error('\nCreate failed:', errors);
    process.exit(1);
  }

  console.log(`\nCreated successfully${publish ? ' (published)' : ' (as draft)'}!`);
  console.log(`  id: ${data?.id}`);
  console.log(`  slug: ${slug}`);
  console.log(`  contentType: insight`);
  console.log(`  isDraft: ${!publish}`);

  if (publish) {
    const INDEXNOW_KEY = process.env.INDEXNOW_KEY ?? '';
    if (INDEXNOW_KEY) {
      const articleUrl = `https://ninescrolls.com/insights/${slug}`;
      console.log(`\nNotifying search engines: ${articleUrl}`);
      try {
        const response = await fetch('https://api.indexnow.org/indexnow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify({
            host: 'ninescrolls.com',
            key: INDEXNOW_KEY,
            keyLocation: `https://ninescrolls.com/${INDEXNOW_KEY}.txt`,
            urlList: [articleUrl],
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
  } else {
    console.log(`\nNext steps:`);
    console.log(`  1. Upload a cover image: npm run upload-news-image -- ${slug} <image-file>`);
    console.log(`  2. Review and publish at /admin/insights/${data?.id}/edit`);
  }
}

// CLI entry
const flagsWithValues = new Set(['--category', '--author', '--tags']);
const positionalArgs: string[] = [];
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i].startsWith('--')) {
    if (flagsWithValues.has(process.argv[i])) i++;
  } else {
    positionalArgs.push(process.argv[i]);
  }
}
const filePath = positionalArgs[0];
if (!filePath) {
  console.error('Usage: npm run create-insight -- <html-file> [options]');
  console.error('  --publish             Publish immediately');
  console.error('  --category <cat>      Set category');
  console.error('  --author <name>       Set author');
  console.error('  --tags <t1,t2,...>    Comma-separated tags');
  process.exit(1);
}

createInsight(filePath).catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
