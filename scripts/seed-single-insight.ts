/**
 * Seed a single insights post to DynamoDB by slug.
 *
 * Usage:
 *   ADMIN_EMAIL=$ADMIN_EMAIL ADMIN_PASSWORD=$ADMIN_PASSWORD npx tsx scripts/seed-single-insight.ts <slug>
 */

import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { signIn } from 'aws-amplify/auth';
import type { Schema } from '../amplify/data/resource';
import { insightsPosts } from './insightsPostsData';

import amplifyOutputs from '../amplify_outputs.json';
Amplify.configure(amplifyOutputs as any);

const client = generateClient<Schema>({ authMode: 'userPool' });

// Related products for the new article
const RELATED_PRODUCTS: Record<string, { href: string; label: string; subtitle?: string }[]> = {
  'plasma-cleaner-maintenance-guide': [
    { href: '/products/plasma-cleaner', label: 'Plasma Cleaner Systems', subtitle: 'PLUTO Series Overview' },
    { href: '/products/pluto-t', label: 'PLUTO-T', subtitle: 'Tabletop / Compact Research' },
    { href: '/products/pluto-m', label: 'PLUTO-M', subtitle: 'Mid-Range / Versatile Processing' },
    { href: '/products/pluto-f', label: 'PLUTO-F', subtitle: 'Full-Size / Production Grade' },
  ],
  'atomic-layer-deposition-ald-comprehensive-guide': [
    { href: '/products/ald', label: 'ALD Systems', subtitle: 'Atomic Layer Deposition' },
  ],
  'magnetron-sputtering-guide': [
    { href: '/products/sputter', label: 'Sputter Systems', subtitle: 'Magnetron Sputtering' },
  ],
  'pecvd-complete-guide-plasma-enhanced-cvd': [
    { href: '/products/pecvd', label: 'PECVD Systems', subtitle: 'Plasma-Enhanced CVD' },
  ],
  'spin-coating-development-guide': [
    { href: '/products/coater-developer', label: 'Coater/Developer', subtitle: 'Spin Coating & Development' },
  ],
  'plasma-stripping-ashing-guide': [
    { href: '/products/striper', label: 'Striper Systems', subtitle: 'Plasma Stripping & Ashing' },
  ],
};

const HERO_IMAGES: Record<string, { prefix: string; fallbackExt: string }> = {
  'plasma-cleaner-maintenance-guide': { prefix: 'plasma-maintenance-cover', fallbackExt: 'png' },
  'atomic-layer-deposition-ald-comprehensive-guide': { prefix: 'ald-guide-cover', fallbackExt: 'png' },
  'magnetron-sputtering-guide': { prefix: 'sputter-guide-cover', fallbackExt: 'png' },
  'pecvd-complete-guide-plasma-enhanced-cvd': { prefix: 'pecvd-guide-cover', fallbackExt: 'png' },
  'spin-coating-development-guide': { prefix: 'coater-developer-guide-cover', fallbackExt: 'png' },
  'plasma-stripping-ashing-guide': { prefix: 'striper-guide-cover', fallbackExt: 'png' },
};

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

async function seedSingle(slug: string) {
  await authenticate();

  const post = insightsPosts.find((p) => p.slug === slug);
  if (!post) {
    console.error(`No local post found with slug: "${slug}"`);
    process.exit(1);
  }

  // Check if already exists
  const { data: existing } = await client.models.InsightsPost.listInsightsPostBySlug({ slug });
  if (existing && existing.length > 0) {
    console.error(`Post already exists in DynamoDB: "${slug}" (id: ${existing[0].id})`);
    console.error('Use update-insight.ts instead.');
    process.exit(1);
  }

  const relatedProducts = RELATED_PRODUCTS[slug] || [];
  const heroImages = HERO_IMAGES[slug] || null;

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

const slug = process.argv[2];
if (!slug) {
  console.error('Usage: npx tsx scripts/seed-single-insight.ts <slug>');
  process.exit(1);
}

seedSingle(slug).catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
