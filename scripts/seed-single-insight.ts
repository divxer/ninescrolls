/**
 * Create a single insights post in DynamoDB from insightsPostsData.ts by slug.
 *
 * Usage:
 *   npx tsx scripts/seed-single-insight.ts <slug>
 *
 * Example:
 *   npx tsx scripts/seed-single-insight.ts mems-fabrication-process-guide
 */

import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../amplify/data/resource';
import { insightsPosts } from './insightsPostsData';
import { authenticate } from './lib/auth';

import amplifyOutputs from '../amplify_outputs.json';
Amplify.configure(amplifyOutputs as any);

const client = generateClient<Schema>({ authMode: 'userPool' });

async function seedSingleInsight(slug: string) {
  await authenticate();

  // Find the post in local data
  const post = insightsPosts.find((p) => p.slug === slug);
  if (!post) {
    console.error(`No local post found with slug: "${slug}"`);
    console.error(`Available slugs:\n${insightsPosts.map((p) => `  ${p.slug}`).join('\n')}`);
    process.exit(1);
  }

  // Check if it already exists in DynamoDB
  const { data: existing } = await client.models.InsightsPost.listInsightsPostBySlug({ slug });
  if (existing && existing.length > 0) {
    console.error(`Record already exists with slug: "${slug}" (id: ${existing[0].id})`);
    console.error('Use update-insight.ts instead to update it.');
    process.exit(1);
  }

  console.log(`Creating: ${post.title}`);
  console.log(`  slug: ${post.slug}`);
  console.log(`  category: ${post.category}`);
  console.log(`  readTime: ${post.readTime} min`);
  console.log(`  tags: ${post.tags?.join(', ')}`);
  console.log(`  relatedProducts: ${post.relatedProducts?.length || 0}`);
  console.log(`  content length: ${(post.content || '').length} chars\n`);

  const { data, errors } = await client.models.InsightsPost.create({
    slug: post.slug,
    title: post.title,
    content: post.content || null,
    excerpt: post.excerpt || null,
    author: post.author,
    publishDate: post.publishDate,
    category: post.category,
    readTime: post.readTime,
    imageUrl: post.imageUrl,
    tags: post.tags,
    relatedProducts: post.relatedProducts ? JSON.stringify(post.relatedProducts) : null,
    heroImages: null,
    isStandaloneComponent: false,
  });

  if (errors) {
    console.error('Create failed:', errors);
    process.exit(1);
  }

  console.log('Created successfully!');
  console.log(`  id: ${data?.id}`);
  console.log(`  slug: ${data?.slug}`);
  console.log(`  title: ${data?.title}`);
  console.log(`  content length: ${(data?.content || '').length} chars`);
}

// CLI entry
const slug = process.argv[2];
if (!slug) {
  console.error('Usage: npx tsx scripts/seed-single-insight.ts <slug>');
  process.exit(1);
}

seedSingleInsight(slug).catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
