/**
 * Update a single insights post in DynamoDB by slug.
 *
 * Usage:
 *   npx tsx scripts/update-insight.ts <slug>
 *
 * Example:
 *   npx tsx scripts/update-insight.ts reactive-ion-etching-guide
 *
 * Prerequisites:
 *   - amplify_outputs.json exists in project root
 */

import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../amplify/data/resource';
import { insightsPosts } from './insightsPostsData';
import { authenticate } from './lib/auth';

import amplifyOutputs from '../amplify_outputs.json';
Amplify.configure(amplifyOutputs as any);

const client = generateClient<Schema>({ authMode: 'userPool' });

async function updateInsight(slug: string) {
  await authenticate();
  // Find the post in local seed data
  const localPost = insightsPosts.find((p) => p.slug === slug);
  if (!localPost) {
    console.error(`No local post found with slug: "${slug}"`);
    console.error(`Available slugs:\n${insightsPosts.map((p) => `  ${p.slug}`).join('\n')}`);
    process.exit(1);
  }

  // Look up existing record in DynamoDB by slug
  const { data: existing } = await client.models.InsightsPost.listInsightsPostBySlug({ slug });
  if (!existing || existing.length === 0) {
    console.error(`No DynamoDB record found with slug: "${slug}"`);
    console.error('Run seed-insights.ts first to create the record.');
    process.exit(1);
  }

  const record = existing[0];
  console.log(`Found record: id=${record.id}, slug=${record.slug}`);
  console.log(`Current title: ${record.title}`);
  console.log(`Current readTime: ${record.readTime} min`);
  console.log(`Current content length: ${(record.content || '').length} chars\n`);

  // Update with local data
  const { data: updated, errors } = await client.models.InsightsPost.update({
    id: record.id,
    title: localPost.title,
    content: localPost.content || null,
    excerpt: localPost.excerpt || null,
    readTime: localPost.readTime,
    tags: localPost.tags,
    publishDate: localPost.publishDate,
    imageUrl: localPost.imageUrl,
  });

  if (errors) {
    console.error('Update failed:', errors);
    process.exit(1);
  }

  console.log('Updated successfully!');
  console.log(`  title: ${updated?.title}`);
  console.log(`  readTime: ${updated?.readTime} min`);
  console.log(`  content length: ${(updated?.content || '').length} chars`);
  console.log(`  tags: ${(updated?.tags || []).join(', ')}`);
}

// CLI entry
const slug = process.argv[2];
if (!slug) {
  console.error('Usage: npx tsx scripts/update-insight.ts <slug>');
  console.error(`\nAvailable slugs:\n${insightsPosts.map((p) => `  ${p.slug}`).join('\n')}`);
  process.exit(1);
}

updateInsight(slug).catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
