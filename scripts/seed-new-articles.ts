/**
 * Seed ONLY the two new publication spotlight articles to DynamoDB.
 * Safe to run without duplicating existing articles.
 *
 * Usage:
 *   npx tsx scripts/seed-new-articles.ts
 */

import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../amplify/data/resource';
import { insightsPosts } from './insightsPostsData';

import amplifyOutputs from '../amplify_outputs.json';
Amplify.configure(amplifyOutputs as any);

const client = generateClient<Schema>();

const NEW_SLUGS = [
  'rie150-nanoforest-soft-actuator',
  'pecvd-icp-ptse2-photodetector',
];

const RELATED_PRODUCTS: Record<string, { href: string; label: string }[]> = {
  'rie150-nanoforest-soft-actuator': [
    { href: '/products/rie-etcher', label: 'RIE Etching Systems' },
    { href: '/products/icp-etcher', label: 'ICP Etching Systems' },
    { href: '/products/sputter', label: 'Sputter Systems' },
    { href: '/products/pecvd', label: 'PECVD Systems' },
  ],
  'pecvd-icp-ptse2-photodetector': [
    { href: '/products/icp-etcher', label: 'ICP Etching Systems' },
    { href: '/products/pecvd', label: 'PECVD Systems' },
    { href: '/products/rie-etcher', label: 'RIE Etching Systems' },
    { href: '/products/sputter', label: 'Sputter Systems' },
  ],
};

const HERO_IMAGES: Record<string, { prefix: string; fallbackExt: string }> = {
  'rie150-nanoforest-soft-actuator': { prefix: 'rie150-soft-actuator-cover', fallbackExt: 'png' },
  'pecvd-icp-ptse2-photodetector': { prefix: 'pecvd-icp-photodetector-cover', fallbackExt: 'png' },
};

async function seedNewArticles() {
  const newPosts = insightsPosts.filter((p) => NEW_SLUGS.includes(p.slug));

  if (newPosts.length === 0) {
    console.log('No new articles found in insightsPostsData.ts');
    return;
  }

  console.log(`\nSeeding ${newPosts.length} new articles...\n`);

  for (const post of newPosts) {
    // Check if already exists
    const { data: existing } = await client.models.InsightsPost.listInsightsPostBySlug({ slug: post.slug });
    if (existing && existing.length > 0) {
      console.log(`  SKIP: ${post.slug} (already exists, id: ${existing[0].id})`);
      continue;
    }

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
      relatedProducts: JSON.stringify(RELATED_PRODUCTS[post.slug] || []),
      heroImages: JSON.stringify(HERO_IMAGES[post.slug] || null),
      isStandaloneComponent: false,
    });

    if (errors) {
      console.error(`  FAIL: ${post.slug}`, errors);
    } else {
      console.log(`  OK: ${post.slug} (id: ${data?.id})`);
    }
  }

  console.log('\nDone.\n');
}

seedNewArticles().catch(console.error);
