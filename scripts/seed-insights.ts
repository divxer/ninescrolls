/**
 * Seed script for migrating hardcoded insights posts to DynamoDB via Amplify.
 *
 * Usage:
 *   npx tsx scripts/seed-insights.ts
 *
 * Prerequisites:
 *   - Amplify sandbox or production environment running
 *   - amplify_outputs.json exists in project root
 */

import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../amplify/data/resource';

// Load Amplify config
import amplifyOutputs from '../amplify_outputs.json';
Amplify.configure(amplifyOutputs as any);

const client = generateClient<Schema>();

// ─── Related Products Mapping ────────────────────────────────────────────────
// Extracted from InsightsPostPage.tsx slug-based conditionals

interface RelatedProduct {
  href: string;
  label: string;
  subtitle?: string;
}

const RELATED_PRODUCTS_MAP: Record<string, RelatedProduct[]> = {
  'hdp-cvd-in-depth-guide-practical-handbook': [
    { href: '/products/hdp-cvd', label: 'HDP-CVD Systems' },
    { href: '/products/pecvd', label: 'PECVD Systems' },
    { href: '/products/ald', label: 'ALD Systems' },
    { href: '/products/sputter', label: 'Sputter Systems' },
  ],
  'reactive-ion-etching-guide': [
    { href: '/products/icp-etcher', label: 'ICP Etching Systems' },
    { href: '/products/rie-etcher', label: 'RIE Etching Systems' },
    { href: '/products/ibe-ribe', label: 'IBE/RIBE Systems' },
    { href: '/products/striper', label: 'Striper Systems' },
  ],
  'deep-reactive-ion-etching-bosch-process': [
    { href: '/products/icp-etcher', label: 'ICP Etching Systems' },
    { href: '/products/rie-etcher', label: 'RIE Etching Systems' },
    { href: '/products/ibe-ribe', label: 'IBE/RIBE Systems' },
    { href: '/products/striper', label: 'Striper Systems' },
  ],
  'icp-rie-technology-advanced-etching': [
    { href: '/products/icp-etcher', label: 'ICP Etching Systems' },
    { href: '/products/rie-etcher', label: 'RIE Etching Systems' },
    { href: '/products/ibe-ribe', label: 'IBE/RIBE Systems' },
    { href: '/products/striper', label: 'Striper Systems' },
  ],
  'reactive-ion-etching-vs-ion-milling': [
    { href: '/products/ibe-ribe', label: 'IBE/RIBE Systems' },
    { href: '/products/rie-etcher', label: 'RIE Etching Systems' },
    { href: '/products/icp-etcher', label: 'ICP Etching Systems' },
    { href: '/products/sputter', label: 'Sputter Systems' },
  ],
  'semiconductor-etchers-overview': [
    { href: '/products/rie-etcher', label: 'RIE Etching Systems' },
    { href: '/products/icp-etcher', label: 'ICP Etching Systems' },
    { href: '/products/ibe-ribe', label: 'IBE/RIBE Systems' },
    { href: '/products/striper', label: 'Striper Systems' },
  ],
  'plasma-etching-explained-fundamentals-applications': [
    { href: '/products/icp-etcher', label: 'ICP Etching Systems' },
    { href: '/products/rie-etcher', label: 'RIE Etching Systems' },
    { href: '/products/striper', label: 'Striper Systems' },
    { href: '/products/pecvd', label: 'PECVD Systems' },
  ],
  'understanding-differences-pe-rie-icp-rie-plasma-etching': [
    { href: '/products/icp-etcher', label: 'ICP Etching Systems' },
    { href: '/products/rie-etcher', label: 'RIE Etching Systems' },
    { href: '/products/striper', label: 'Striper Systems' },
    { href: '/products/pecvd', label: 'PECVD Systems' },
  ],
  'plasma-non-uniform-etch-chamber-solutions': [
    { href: '/products/icp-etcher', label: 'ICP Etching Systems' },
    { href: '/products/rie-etcher', label: 'RIE Etching Systems' },
    { href: '/products/pecvd', label: 'PECVD Systems' },
    { href: '/products/ald', label: 'ALD Systems' },
  ],
  'plasma-cleaner-comparison-research-labs': [
    { href: '/products/plasma-cleaner', label: 'Plasma Cleaner Systems', subtitle: 'PLUTO Series / RF Plasma' },
    { href: '/products/hy-4l', label: 'HY-4L', subtitle: 'Compact / Teaching / Validation' },
    { href: '/products/hy-20l', label: 'HY-20L', subtitle: 'Core Research / Batch Processing' },
    { href: '/products/hy-20lrf', label: 'HY-20LRF', subtitle: 'Integrated / Batch Processing' },
  ],
  'what-is-plasma-cleaner-principles-types': [
    { href: '/products/plasma-cleaner', label: 'Plasma Cleaner Systems' },
    { href: '/products/hy-4l', label: 'HY-4L' },
    { href: '/products/hy-20l', label: 'HY-20L' },
    { href: '/products/hy-20lrf', label: 'HY-20LRF' },
  ],
  'plasma-cleaner-applications-guide': [
    { href: '/products/plasma-cleaner', label: 'Plasma Cleaner Systems' },
    { href: '/products/hy-4l', label: 'HY-4L' },
    { href: '/products/hy-20l', label: 'HY-20L' },
    { href: '/products/hy-20lrf', label: 'HY-20LRF' },
  ],
  'plasma-cleaner-buying-guide': [
    { href: '/products/plasma-cleaner', label: 'Plasma Cleaner Systems' },
    { href: '/products/hy-4l', label: 'HY-4L' },
    { href: '/products/hy-20l', label: 'HY-20L' },
    { href: '/products/hy-20lrf', label: 'HY-20LRF' },
  ],
};

// Default related products for articles not in the map
const DEFAULT_RELATED_PRODUCTS: RelatedProduct[] = [
  { href: '/products/striper', label: 'Striper Systems' },
  { href: '/products/pecvd', label: 'PECVD Systems' },
  { href: '/products/ald', label: 'ALD Systems' },
  { href: '/products/icp-etcher', label: 'ICP Etching Systems' },
];

// ─── Hero Images Mapping ─────────────────────────────────────────────────────
// Articles with responsive <picture> WebP sources

interface HeroImageConfig {
  prefix: string;
  fallbackExt: string;
}

const HERO_IMAGES_MAP: Record<string, HeroImageConfig> = {
  'deep-reactive-ion-etching-bosch-process': { prefix: 'drie-cover', fallbackExt: 'png' },
  'icp-rie-technology-advanced-etching': { prefix: 'icp-rie-cover', fallbackExt: 'png' },
  'reactive-ion-etching-vs-ion-milling': { prefix: 'rie-vs-milling-cover', fallbackExt: 'png' },
  'semiconductor-etchers-overview': { prefix: 'etchers-overview-cover', fallbackExt: 'png' },
  'plasma-cleaner-comparison-research-labs': { prefix: 'plasma-cleaner-comparison-cover', fallbackExt: 'png' },
};

// ─── Standalone Component Articles ───────────────────────────────────────────
const STANDALONE_COMPONENT_SLUGS = new Set([
  'plasma-cleaner-comparison-research-labs',
]);

// ─── Import existing hardcoded posts ─────────────────────────────────────────
// Legacy data extracted from src/types/index.ts before migration
import { insightsPosts } from './insightsPostsData';

async function seedInsights() {
  console.log(`\nSeeding ${insightsPosts.length} insights posts to DynamoDB...\n`);

  let success = 0;
  let failed = 0;

  for (const post of insightsPosts) {
    const relatedProducts = RELATED_PRODUCTS_MAP[post.slug] || DEFAULT_RELATED_PRODUCTS;
    const heroImages = HERO_IMAGES_MAP[post.slug] || null;
    const isStandaloneComponent = STANDALONE_COMPONENT_SLUGS.has(post.slug);

    try {
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
        relatedProducts: JSON.stringify(relatedProducts),
        heroImages: heroImages ? JSON.stringify(heroImages) : null,
        isStandaloneComponent,
      });

      if (errors) {
        console.error(`  FAIL: ${post.slug}`, errors);
        failed++;
      } else {
        console.log(`  OK: ${post.slug} (id: ${data?.id})`);
        success++;
      }
    } catch (err) {
      console.error(`  FAIL: ${post.slug}`, err);
      failed++;
    }
  }

  console.log(`\nDone. Success: ${success}, Failed: ${failed}\n`);
}

seedInsights().catch(console.error);
