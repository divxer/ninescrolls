/**
 * Update an existing insights post's content from an HTML file.
 * Companion to create-insight.ts for post-create revisions.
 *
 * Usage:
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... npx tsx scripts/update-insight-from-html.ts <slug> <html-file>
 */

import { readFileSync } from 'fs';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../amplify/data/resource';
import { authenticate } from './lib/auth';

import amplifyOutputs from '../amplify_outputs.json';
Amplify.configure(amplifyOutputs as any);

const client = generateClient<Schema>({ authMode: 'userPool' });

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}
function estimateReadTime(text: string): number {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
function extractBodyContent(html: string): string {
  const m = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return m ? m[1].trim() : html;
}

async function main(slug: string, filePath: string) {
  await authenticate();

  const html = readFileSync(filePath, 'utf-8');
  const body = extractBodyContent(html);
  let cleaned = body.replace(/<h1[^>]*>[\s\S]*?<\/h1>/i, '');
  cleaned = cleaned.replace(/<h2[^>]*>\s*Table of Contents\s*<\/h2>\s*<ul>[\s\S]*?<\/ul>/i, '');
  const content = cleaned.trim();

  const { data: existing } = await client.models.InsightsPost.listInsightsPostBySlug({ slug });
  if (!existing || existing.length === 0) {
    console.error(`No record for slug "${slug}".`);
    process.exit(1);
  }
  const record = existing[0];
  console.log(`Found: id=${record.id}  title="${record.title}"`);
  console.log(`  current content: ${(record.content || '').length} chars`);

  const plain = stripHtml(content);
  const readTime = estimateReadTime(plain);
  const excerpt = plain.replace(/^\s+/, '').slice(0, 200);

  const { errors } = await client.models.InsightsPost.update({
    id: record.id,
    content,
    excerpt,
    readTime,
  });

  if (errors) {
    console.error('Update failed:', errors);
    process.exit(1);
  }

  console.log(`Updated!  new content: ${content.length} chars  readTime: ${readTime} min`);
}

const slug = process.argv[2];
const filePath = process.argv[3];
if (!slug || !filePath) {
  console.error('Usage: npx tsx scripts/update-insight-from-html.ts <slug> <html-file>');
  process.exit(1);
}
main(slug, filePath).catch((e) => { console.error(e); process.exit(1); });
