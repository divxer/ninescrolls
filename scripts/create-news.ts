/**
 * Create a news article in DynamoDB from an HTML file.
 *
 * Usage:
 *   ADMIN_EMAIL=$ADMIN_EMAIL ADMIN_PASSWORD=$ADMIN_PASSWORD npx tsx scripts/create-news.ts <html-file>
 *
 * Example:
 *   npx tsx scripts/create-news.ts ~/marketing/insight/applied-materials-epic-center-news.html
 *
 * The script extracts title, content, and metadata from the HTML file,
 * then creates an InsightsPost record with contentType='news'.
 */

import { readFileSync } from 'fs';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { signIn } from 'aws-amplify/auth';
import type { Schema } from '../amplify/data/resource';

import amplifyOutputs from '../amplify_outputs.json';
Amplify.configure(amplifyOutputs as any);

const client = generateClient<Schema>({ authMode: 'userPool' });

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
  // Try <h1> first, then <title>
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1Match) return stripHtml(h1Match[1]);
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch) return stripHtml(titleMatch[1]);
  return 'Untitled News';
}

async function createNews(filePath: string) {
  await authenticate();

  const html = readFileSync(filePath, 'utf-8');
  const title = extractTitle(html);
  const bodyContent = extractBodyContent(html);

  // Remove the <h1> from body content (already used as title)
  const contentWithoutH1 = bodyContent.replace(/<h1[^>]*>[\s\S]*?<\/h1>/i, '').trim();
  // Remove the byline paragraph (NineScrolls.com | date)
  const content = contentWithoutH1.replace(/<p><strong>NineScrolls\.com<\/strong>[^<]*<\/p>/i, '').trim();

  const plainText = stripHtml(content);
  const slug = generateSlug(title);
  const readTime = estimateReadTime(plainText);
  const excerpt = plainText.slice(0, 200);
  const today = new Date().toISOString().split('T')[0];

  console.log(`Title: ${title}`);
  console.log(`Slug: ${slug}`);
  console.log(`Read time: ${readTime} min`);
  console.log(`Content length: ${content.length} chars`);
  console.log(`Excerpt: ${excerpt.slice(0, 80)}...`);

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
    author: 'NineScrolls Team',
    publishDate: today,
    category: 'Industry',
    readTime,
    imageUrl: `/assets/images/news/${slug}`,
    tags: [],
    contentType: 'news',
    isDraft: true, // Create as draft for review
  });

  if (errors) {
    console.error('\nCreate failed:', errors);
    process.exit(1);
  }

  console.log('\nCreated successfully (as draft)!');
  console.log(`  id: ${data?.id}`);
  console.log(`  slug: ${slug}`);
  console.log(`  contentType: news`);
  console.log(`  isDraft: true`);
  console.log(`\nNext steps:`);
  console.log(`  1. Upload a cover image via admin`);
  console.log(`  2. Review and publish at /admin/insights/${data?.id}/edit`);
}

// CLI entry
const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: npx tsx scripts/create-news.ts <html-file>');
  process.exit(1);
}

createNews(filePath).catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
