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

  // Content guard: some articles source their body from scripts/articles/<slug>.html
  // (synced via update-insight-from-html.ts) and intentionally carry no inline content
  // in insightsPostsData.ts. Never overwrite the live DDB content with an empty local copy.
  const hasLocalContent = Boolean(localPost.content && localPost.content.trim());
  if (!hasLocalContent) {
    console.warn(
      `  No inline content in insightsPostsData.ts for "${slug}" — preserving live DDB content.\n` +
      `  (To update the body, edit scripts/articles/${slug}.html and run update-insight-from-html.ts.)\n`
    );
  }

  // Update with local data. Body fields (content/excerpt/readTime) are only touched when
  // local content exists, so this never blanks an HTML-sourced article.
  const { data: updated, errors } = await client.models.InsightsPost.update({
    id: record.id,
    title: localPost.title,
    ...(hasLocalContent
      ? {
          content: localPost.content,
          excerpt: localPost.excerpt || null,
          readTime: localPost.readTime,
        }
      : {}),
    tags: localPost.tags,
    publishDate: localPost.publishDate,
    imageUrl: localPost.imageUrl,
    relatedProducts: localPost.relatedProducts ? JSON.stringify(localPost.relatedProducts) : null,
    articleType: localPost.articleType ?? null,
    faqs: localPost.faqs ? JSON.stringify(localPost.faqs) : null,
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
