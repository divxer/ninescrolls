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
  'rie150a-metasurface-color-router': [
    { href: '/products/rie-etcher', label: 'RIE Etching Systems' },
    { href: '/products/icp-etcher', label: 'ICP Etching Systems' },
    { href: '/products/pecvd', label: 'PECVD Systems' },
    { href: '/products/sputter', label: 'Sputter Systems' },
  ],
  'icp200-metasurface-flow-visualization': [
    { href: '/products/icp-etcher', label: 'ICP Etching Systems' },
    { href: '/products/rie-etcher', label: 'RIE Etching Systems' },
    { href: '/products/pecvd', label: 'PECVD Systems' },
    { href: '/products/sputter', label: 'Sputter Systems' },
  ],
  'machine-learning-plasma-etch-optimization': [
    { href: '/products/icp-etcher', label: 'ICP Etching Systems' },
    { href: '/products/rie-etcher', label: 'RIE Etching Systems' },
    { href: '/products/pecvd', label: 'PECVD Systems' },
    { href: '/products/ald', label: 'ALD Systems' },
  ],
  'etching-beyond-silicon-new-materials': [
    { href: '/products/icp-etcher', label: 'ICP Etching Systems' },
    { href: '/products/rie-etcher', label: 'RIE Etching Systems' },
    { href: '/products/ibe-ribe', label: 'IBE/RIBE Systems' },
    { href: '/products/ald', label: 'ALD Systems' },
  ],
  'ultra-high-etch-selectivity': [
    { href: '/products/icp-etcher', label: 'ICP Etching Systems' },
    { href: '/products/rie-etcher', label: 'RIE Etching Systems' },
    { href: '/products/drie', label: 'DRIE Systems' },
    { href: '/products/ald', label: 'ALD Systems' },
  ],
  'cryogenic-etching-vs-bosch-process': [
    { href: '/products/icp-etcher', label: 'ICP Etching Systems' },
    { href: '/products/rie-etcher', label: 'RIE Etching Systems' },
    { href: '/products/ibe-ribe', label: 'IBE/RIBE Systems' },
    { href: '/products/striper', label: 'Striper Systems' },
  ],
  'plasma-cleaner-maintenance-guide': [
    { href: '/products/plasma-cleaner', label: 'Plasma Cleaner Systems', subtitle: 'PLUTO Series Overview' },
    { href: '/products/pluto-t', label: 'PLUTO-T', subtitle: 'Tabletop / Compact Research' },
    { href: '/products/pluto-m', label: 'PLUTO-M', subtitle: 'Mid-Range / Versatile Processing' },
    { href: '/products/pluto-f', label: 'PLUTO-F', subtitle: 'Full-Size / Production Grade' },
  ],
  'atomic-layer-etching-practical-guide': [
    { href: '/products/icp-etcher', label: 'ICP Etching Systems' },
    { href: '/products/rie-etcher', label: 'RIE Etching Systems' },
    { href: '/products/ibe-ribe', label: 'IBE/RIBE Systems' },
    { href: '/products/striper', label: 'Striper Systems' },
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
  'rie150-nanoforest-soft-actuator': { prefix: 'rie150-soft-actuator-cover', fallbackExt: 'png' },
  'pecvd-icp-ptse2-photodetector': { prefix: 'pecvd-icp-photodetector-cover', fallbackExt: 'png' },
  'rie150a-metasurface-color-router': { prefix: 'rie150a-color-router-cover', fallbackExt: 'png' },
  'icp200-metasurface-flow-visualization': { prefix: 'icp200-flow-visualization-cover', fallbackExt: 'png' },
  'atomic-layer-etching-practical-guide': { prefix: 'ale-guide-cover', fallbackExt: 'png' },
  'cryogenic-etching-vs-bosch-process': { prefix: 'cryo-vs-bosch-cover', fallbackExt: 'png' },
  'machine-learning-plasma-etch-optimization': { prefix: 'ml-plasma-etch-cover', fallbackExt: 'png' },
  'etching-beyond-silicon-new-materials': { prefix: 'etching-new-materials-cover', fallbackExt: 'png' },
  'ultra-high-etch-selectivity': { prefix: 'etch-selectivity-cover', fallbackExt: 'png' },
  'plasma-cleaner-maintenance-guide': { prefix: 'plasma-maintenance-cover', fallbackExt: 'png' },
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
