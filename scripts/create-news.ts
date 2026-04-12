/**
 * Create a news article in DynamoDB from an HTML file, with automatic cover image upload.
 *
 * Usage:
 *   ADMIN_EMAIL=$ADMIN_EMAIL ADMIN_PASSWORD=$ADMIN_PASSWORD npx tsx scripts/create-news.ts <html-file> [--publish]
 *
 * Options:
 *   --publish           Publish immediately (skip draft) and notify Bing/Yandex via IndexNow
 *   --category <cat>    Set category (Industry|Product|Event|Partnership)
 *   --no-image          Skip cover image upload
 *
 * Example:
 *   npx tsx scripts/create-news.ts ~/marketing/insight/article.html              # as draft
 *   npx tsx scripts/create-news.ts ~/marketing/insight/article.html --publish    # publish + ping
 *   npx tsx scripts/create-news.ts ~/marketing/insight/article.html --category Event
 *   npx tsx scripts/create-news.ts ~/marketing/insight/article.html --no-image   # skip image upload
 *
 * The script extracts title, content, and metadata from the HTML file,
 * creates an InsightsPost record with contentType='news', and uploads
 * the cover image (from the first <img> tag) to S3/CDN.
 */

import { readFileSync, statSync } from 'fs';
import path from 'path';
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

/**
 * Resolve the cover image file path from the <img src> in the HTML.
 * Returns the absolute path if the file exists, or null.
 */
function resolveCoverImage(htmlPath: string, imgSrc: string): string | null {
  if (!imgSrc) return null;
  const resolved = path.resolve(path.dirname(htmlPath), imgSrc);
  try {
    statSync(resolved);
    return resolved;
  } catch {
    return null;
  }
}

async function uploadCoverImage(slug: string, coverPath: string, postId: string) {
  const mimeType = getMimeType(coverPath);
  const ext = path.extname(coverPath);
  const fileName = `cover${ext}`;
  const fileBuffer = readFileSync(coverPath);
  console.log(`\nUploading cover image: ${path.basename(coverPath)} (${(fileBuffer.length / 1024).toFixed(0)} KB)`);

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
  await client.models.InsightsPost.update({ id: postId, imageUrl: cdnImageUrl });
  console.log(`  Cover URL: ${cdnImageUrl}.webp`);
}

async function createNews(filePath: string, options: { publish: boolean; category: string; noImage: boolean }) {
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
  const coverImageSrc = extractFirstImage(bodyContent);
  const coverPath = options.noImage ? null : resolveCoverImage(filePath, coverImageSrc);

  console.log(`Title: ${title}`);
  console.log(`Slug: ${slug}`);
  console.log(`Category: ${options.category}`);
  console.log(`Read time: ${readTime} min`);
  console.log(`Content length: ${content.length} chars`);
  console.log(`Excerpt: ${excerpt.slice(0, 80)}...`);
  console.log(`Cover image: ${coverPath ? path.basename(coverPath) : '(none)'}`);
  console.log(`Mode: ${options.publish ? 'PUBLISH' : 'DRAFT'}`);

  // Check slug uniqueness
  const { data: existing } = await client.models.InsightsPost.listInsightsPostBySlug({ slug });
  if (existing && existing.length > 0) {
    console.error(`\nSlug "${slug}" already exists! Aborting.`);
    process.exit(1);
  }

  // Create article
  console.log('\nCreating article...');
  const { data, errors } = await client.models.InsightsPost.create({
    slug,
    title,
    content,
    excerpt,
    author: 'NineScrolls Team',
    publishDate: today,
    category: options.category,
    readTime,
    imageUrl: coverImageSrc || `/assets/images/news/${slug}`,
    tags: [],
    contentType: 'news',
    isDraft: !options.publish,
  });

  if (errors) {
    console.error('\nCreate failed:', errors);
    process.exit(1);
  }

  console.log(`  Created: ${data?.id} (${options.publish ? 'published' : 'draft'})`);

  // Upload cover image
  if (coverPath) {
    await uploadCoverImage(slug, coverPath, data!.id);
  } else if (!options.noImage && coverImageSrc) {
    console.log(`\nWarning: Cover image "${coverImageSrc}" referenced in HTML but file not found.`);
  }

  // Notify search engines
  if (options.publish) {
    const articleUrl = `https://ninescrolls.com/news/${slug}`;
    console.log(`\nNotifying search engines: ${articleUrl}`);
    await pingIndexNow(articleUrl);
    console.log('\nSitemap/RSS will update automatically (served dynamically via Lambda).');
  }

  console.log(`\nDone! URL: https://ninescrolls.com/news/${slug}`);
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
const publish = process.argv.includes('--publish');
const noImage = process.argv.includes('--no-image');
const categoryIdx = process.argv.indexOf('--category');
const category = categoryIdx !== -1 && process.argv[categoryIdx + 1]
  ? process.argv[categoryIdx + 1]
  : 'Industry';

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
  console.error('Usage: npx tsx scripts/create-news.ts <html-file> [--publish] [--category <cat>] [--no-image]');
  console.error('  --publish           Publish immediately and notify search engines');
  console.error('  --category <cat>    Set category (Industry|Product|Event|Partnership)');
  console.error('  --no-image          Skip cover image upload');
  process.exit(1);
}

createNews(filePath, { publish, category, noImage }).catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
