/**
 * One-command news publishing: create article + upload cover image + publish.
 *
 * Usage:
 *   npx tsx scripts/publish-news.ts <html-file>
 *   npx tsx scripts/publish-news.ts <html-file> --draft
 *   npx tsx scripts/publish-news.ts <html-file> --category Event
 *   npx tsx scripts/publish-news.ts latest                          # auto-detect newest HTML
 *
 * The script:
 *   1. Finds the matching cover image (*-cover.{jpg,png,webp}) in the same directory
 *   2. Creates the article in DynamoDB (published by default)
 *   3. Uploads and processes the cover image to S3/CDN
 *   4. Updates the article's imageUrl
 *   5. Notifies search engines via IndexNow
 *
 * "latest" mode: picks the most recently modified .html file in the default articles directory.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import path from 'path';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../amplify/data/resource';
import { authenticate } from './lib/auth';

import amplifyOutputs from '../amplify_outputs.json';
Amplify.configure(amplifyOutputs as any);

const client = generateClient<Schema>({ authMode: 'userPool' });

const DEFAULT_ARTICLES_DIR =
  '/Users/harvey/MyDocuments/Company_Registration/NineScrolls LLC/marketing/insight/ninescrolls-news/articles';

// ── Helpers ──────────────────────────────────────────────────────────

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
  return 'Untitled News';
}

function extractFirstImage(html: string): string {
  const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return imgMatch ? imgMatch[1] : '';
}

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    default:
      throw new Error(`Unsupported image format: ${ext}`);
  }
}

function findCoverImage(htmlPath: string): string | null {
  const dir = path.dirname(htmlPath);
  const base = path.basename(htmlPath, '.html');
  // Try exact match: same-name-cover.{jpg,png,webp}
  for (const ext of ['.jpg', '.png', '.webp']) {
    const candidate = path.join(dir, `${base}-cover${ext}`);
    try {
      statSync(candidate);
      return candidate;
    } catch {}
  }
  // Try prefix match: files starting with the HTML basename + "-cover"
  const files = readdirSync(dir);
  const coverFile = files.find(
    (f) => f.startsWith(base) && /\-cover\.(jpg|png|webp)$/i.test(f),
  );
  if (coverFile) return path.join(dir, coverFile);
  // Try any cover image with a shared prefix (first 20 chars)
  const prefix = base.slice(0, 20);
  const fuzzy = files.find(
    (f) => f.startsWith(prefix) && /\-cover\.(jpg|png|webp)$/i.test(f),
  );
  if (fuzzy) return path.join(dir, fuzzy);
  return null;
}

function findLatestHtml(dir: string): string {
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.html'))
    .map((f) => ({ name: f, mtime: statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  if (files.length === 0) {
    console.error(`No .html files found in ${dir}`);
    process.exit(1);
  }
  return path.join(dir, files[0].name);
}

// ── IndexNow ─────────────────────────────────────────────────────────

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

// ── Main ─────────────────────────────────────────────────────────────

async function publishNews(htmlPath: string, options: { draft: boolean; category: string }) {
  await authenticate();

  // ── Step 1: Parse HTML ──
  const html = readFileSync(htmlPath, 'utf-8');
  const title = extractTitle(html);
  const bodyContent = extractBodyContent(html);

  let cleaned = bodyContent;
  cleaned = cleaned.replace(/<h1[^>]*>[\s\S]*?<\/h1>/i, '');
  cleaned = cleaned.replace(/<p><strong>NineScrolls\.com<\/strong>[^<]*<\/p>/i, '');
  cleaned = cleaned.replace(/<img[^>]*>/i, '');
  cleaned = cleaned.replace(/<h2[^>]*>\s*Table of Contents\s*<\/h2>\s*<ul>[\s\S]*?<\/ul>/i, '');
  const content = cleaned.trim();

  const withoutToc = content
    .replace(/<h2[^>]*>Table of Contents<\/h2>/i, '')
    .replace(/<ul>[\s\S]*?<\/ul>/i, '');
  const plainText = stripHtml(withoutToc);
  const slug = generateSlug(title);
  const readTime = estimateReadTime(stripHtml(content));
  const excerpt = plainText.replace(/^\s+/, '').slice(0, 200);
  const today = new Date().toISOString().split('T')[0];
  const coverImage = extractFirstImage(bodyContent);

  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Title:    ${title}`);
  console.log(`  Slug:     ${slug}`);
  console.log(`  Category: ${options.category}`);
  console.log(`  Read:     ${readTime} min`);
  console.log(`  Mode:     ${options.draft ? 'DRAFT' : 'PUBLISH'}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  // ── Step 2: Check slug uniqueness ──
  const { data: existing } = await client.models.InsightsPost.listInsightsPostBySlug({ slug });
  if (existing && existing.length > 0) {
    console.error(`Slug "${slug}" already exists! Aborting.`);
    process.exit(1);
  }

  // ── Step 3: Create article ──
  console.log('Creating article...');
  const { data, errors } = await client.models.InsightsPost.create({
    slug,
    title,
    content,
    excerpt,
    author: 'NineScrolls Team',
    publishDate: today,
    category: options.category,
    readTime,
    imageUrl: coverImage || `/assets/images/news/${slug}`,
    tags: [],
    contentType: 'news',
    isDraft: options.draft,
  });

  if (errors) {
    console.error('Create failed:', errors);
    process.exit(1);
  }
  console.log(`  Created: ${data?.id}\n`);

  // ── Step 4: Find and upload cover image ──
  const coverPath = findCoverImage(htmlPath);
  if (coverPath) {
    const mimeType = getMimeType(coverPath);
    const ext = path.extname(coverPath);
    const fileName = `cover${ext}`;
    const fileBuffer = readFileSync(coverPath);
    console.log(`Uploading cover image: ${path.basename(coverPath)} (${(fileBuffer.length / 1024).toFixed(0)} KB)`);

    // Get presigned URL
    const { data: uploadData, errors: uploadErrors } = await client.queries.getInsightsImageUploadUrl(
      { slug, fileName, mimeType } as any,
    );
    if (uploadErrors?.length) {
      console.error('Failed to get upload URL:', uploadErrors);
      process.exit(1);
    }
    const { uploadUrl, s3Key } = uploadData as any;

    // Upload to S3
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': mimeType },
      body: fileBuffer,
    });
    if (!uploadResponse.ok) {
      console.error(`Upload failed: HTTP ${uploadResponse.status}`);
      process.exit(1);
    }
    console.log('  Uploaded to S3.');

    // Process (resize + WebP)
    console.log('  Processing (resize + WebP)...');
    const { data: result, errors: processErrors } = await client.mutations.processInsightsImage(
      { s3Key, slug } as any,
    );
    if (processErrors?.length) {
      console.error('Image processing failed:', processErrors);
      process.exit(1);
    }

    const { cdnBaseUrl, heroPrefix, files } = result as any;
    console.log(`  Generated ${files.length} variants.`);

    // Update imageUrl
    const cdnImageUrl = `${cdnBaseUrl}/insights/${slug}/${heroPrefix}-lg`;
    await client.models.InsightsPost.update({ id: data!.id, imageUrl: cdnImageUrl });
    console.log(`  Cover URL: ${cdnImageUrl}.webp\n`);
  } else {
    console.log('No cover image found (looked for *-cover.{jpg,png,webp}).\n');
  }

  // ── Step 5: Notify search engines ──
  if (!options.draft) {
    const articleUrl = `https://ninescrolls.com/news/${slug}`;
    console.log(`Notifying search engines: ${articleUrl}`);
    await pingIndexNow(articleUrl);
  }

  console.log('\n✓ Done!');
  console.log(`  URL: https://ninescrolls.com/news/${slug}`);
}

// ── CLI ──────────────────────────────────────────────────────────────

const draft = process.argv.includes('--draft');
const categoryIdx = process.argv.indexOf('--category');
const category =
  categoryIdx !== -1 && process.argv[categoryIdx + 1]
    ? process.argv[categoryIdx + 1]
    : 'Industry';

const positionalArgs: string[] = [];
const flagsWithValues = new Set(['--category']);
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i].startsWith('--')) {
    if (flagsWithValues.has(process.argv[i])) i++;
  } else {
    positionalArgs.push(process.argv[i]);
  }
}

let htmlPath = positionalArgs[0];
if (!htmlPath) {
  console.error('Usage: npx tsx scripts/publish-news.ts <html-file|latest> [--draft] [--category <cat>]');
  console.error('\n  latest    Auto-detect newest HTML in the default articles directory');
  console.error('  --draft   Create as draft (default: publish immediately)');
  process.exit(1);
}

if (htmlPath === 'latest') {
  htmlPath = findLatestHtml(DEFAULT_ARTICLES_DIR);
  console.log(`Auto-detected: ${path.basename(htmlPath)}\n`);
}

publishNews(htmlPath, { draft, category }).catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
