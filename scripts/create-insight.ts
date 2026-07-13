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
 *   --slug <slug>       Set slug (overrides <meta name="article:slug">)
 *   --category <cat>    Set category (overrides <meta name="article:category">)
 *   --author <name>     Set author (overrides <meta name="article:author">)
 *   --tags <t1,t2,...>  Comma-separated tags (overrides <meta name="article:tags">)
 *
 * Example:
 *   npm run create-insight -- ~/articles/new-etching-guide.html
 *   npm run create-insight -- ~/articles/new-etching-guide.html --publish --tags "RIE,Etching"
 *
 * HTML file format (see scripts/articles/*.html for full examples):
 *   - <title> or <h1>                              → article title
 *   - <body> content                               → article body (first h1 + TOC stripped)
 *   - <meta name="article:slug" content>           → slug (else derived from title)
 *   - <meta name="article:excerpt" content>        → excerpt (else first 200 chars)
 *   - <meta name="article:category" content>       → category
 *   - <meta name="article:tags" content>           → tags (comma-separated)
 *   - <meta name="article:article-type" content>   → articleType (Article | TechArticle)
 *   - <meta name="article:image-url" content>      → cover image URL
 *   - <meta name="article:publish-date" content>   → publish date (YYYY-MM-DD, else today)
 *   - <meta name="article:author" content>         → author
 *   - <script type="application/json" data-related-products> → related products
 *
 * Precedence for each field: CLI flag > <meta> tag > built-in default.
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
import { parseArticleHtml } from './lib/parseArticleHtml';

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

async function createInsight(filePath: string) {
  await authenticate();

  const html = readFileSync(filePath, 'utf-8');
  const parsed = parseArticleHtml(html);

  const title = parsed.title;
  const content = parsed.content;
  const plainText = stripHtml(content);
  const readTime = estimateReadTime(plainText);
  const today = new Date().toISOString().split('T')[0];

  // Precedence: CLI flag > <meta> tag > built-in default.
  const publish = process.argv.includes('--publish');

  // Slug: explicit override preserves canonical URLs when the title would
  // otherwise derive a different (longer) slug; falls back to title-derived.
  const slugIdx = process.argv.indexOf('--slug');
  const slug = slugIdx !== -1 && process.argv[slugIdx + 1]
    ? generateSlug(process.argv[slugIdx + 1])
    : parsed.slug ?? generateSlug(title);

  const categoryIdx = process.argv.indexOf('--category');
  const category = categoryIdx !== -1 && process.argv[categoryIdx + 1]
    ? process.argv[categoryIdx + 1]
    : parsed.category ?? 'Plasma Processing';

  const authorIdx = process.argv.indexOf('--author');
  const author = authorIdx !== -1 && process.argv[authorIdx + 1]
    ? process.argv[authorIdx + 1]
    : parsed.author ?? 'NineScrolls Engineering';

  const tagsIdx = process.argv.indexOf('--tags');
  const tags = tagsIdx !== -1 && process.argv[tagsIdx + 1]
    ? process.argv[tagsIdx + 1].split(',').map(t => t.trim()).filter(Boolean)
    : parsed.tags ?? [];

  // Metadata with meta-tag override, else built-in default.
  const excerpt = parsed.excerpt ?? plainText.replace(/^\s+/, '').slice(0, 200);
  const publishDate = parsed.publishDate ?? today;
  const imageUrl = parsed.imageUrl ?? `/assets/images/insights/${slug}`;
  const articleType = parsed.articleType ?? null;
  const relatedProducts = parsed.relatedProducts ?? null;

  console.log(`Title: ${title}`);
  console.log(`Slug: ${slug}`);
  console.log(`Category: ${category}`);
  console.log(`Author: ${author}`);
  console.log(`Read time: ${readTime} min`);
  console.log(`Content length: ${content.length} chars`);
  console.log(`Excerpt: ${excerpt.slice(0, 80)}...`);
  console.log(`Tags: ${tags.length > 0 ? tags.join(', ') : '(none)'}`);
  console.log(`Article type: ${articleType ?? '(none)'}`);
  console.log(`Publish date: ${publishDate}`);
  console.log(`Related products: ${relatedProducts ? relatedProducts.length : 0}`);
  console.log(`Cover image: ${imageUrl}`);

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
    publishDate,
    category,
    readTime,
    imageUrl,
    tags,
    relatedProducts: relatedProducts ? JSON.stringify(relatedProducts) : null,
    articleType,
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
const flagsWithValues = new Set(['--slug', '--category', '--author', '--tags']);
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
  console.error('  --slug <slug>         Set slug (overrides meta tag)');
  console.error('  --category <cat>      Set category (overrides meta tag)');
  console.error('  --author <name>       Set author (overrides meta tag)');
  console.error('  --tags <t1,t2,...>    Comma-separated tags (overrides meta tag)');
  process.exit(1);
}

createInsight(filePath).catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
