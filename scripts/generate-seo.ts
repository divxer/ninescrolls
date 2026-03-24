/**
 * Post-build SEO asset generator.
 *
 * Generates:
 *   dist/sitemap.xml        — Main sitemap with static + dynamic URLs
 *   dist/news-sitemap.xml   — Google News sitemap (last 2 days)
 *   dist/feed.xml           — RSS 2.0 feed (last 20 news articles)
 *   dist/<indexnow-key>.txt — IndexNow verification file
 *
 * Usage:
 *   npx tsx scripts/generate-seo.ts    # write to dist/ (build-time fallback)
 *
 * Note: In production, sitemaps are served dynamically via Lambda.
 * This script generates static fallback files during build.
 *
 * Prerequisites:
 *   - amplify_outputs.json in project root
 *   - dist/ directory exists (run after vite build)
 */

import { writeFileSync, existsSync } from 'fs';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';

import amplifyOutputs from '../amplify_outputs.json';
Amplify.configure(amplifyOutputs as any);

const client = generateClient();

const BASE_URL = 'https://ninescrolls.com';
const INDEXNOW_KEY = 'b8f4e2a1c7d94f3e8a6b0c5d7e9f1a2b';

// ─── XML Helpers ────────────────────────────────────────────────────────────

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toIsoDate(dateStr: string): string {
  // publishDate is 'YYYY-MM-DD' — validate and return as-is
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  // Try parsing other formats
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return new Date().toISOString().split('T')[0];
  return d.toISOString().split('T')[0];
}

function toRfc822(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  if (isNaN(d.getTime())) return new Date().toUTCString();
  return d.toUTCString();
}

// ─── Static Pages ───────────────────────────────────────────────────────────

interface StaticPage {
  loc: string;
  lastmod: string;
  changefreq: string;
  priority: string;
}

const STATIC_PAGES: StaticPage[] = [
  { loc: '/', lastmod: '2026-01-14', changefreq: 'weekly', priority: '1.0' },
  { loc: '/products/', lastmod: '2026-01-14', changefreq: 'weekly', priority: '0.9' },
  { loc: '/products/hdp-cvd', lastmod: '2026-01-14', changefreq: 'monthly', priority: '0.8' },
  { loc: '/products/pecvd', lastmod: '2026-01-14', changefreq: 'monthly', priority: '0.8' },
  { loc: '/products/ald', lastmod: '2026-01-14', changefreq: 'monthly', priority: '0.8' },
  { loc: '/products/sputter', lastmod: '2026-01-14', changefreq: 'monthly', priority: '0.8' },
  { loc: '/products/ibe-ribe', lastmod: '2026-01-14', changefreq: 'monthly', priority: '0.8' },
  { loc: '/products/striper', lastmod: '2026-01-14', changefreq: 'monthly', priority: '0.8' },
  { loc: '/products/coater-developer', lastmod: '2026-01-14', changefreq: 'monthly', priority: '0.8' },
  { loc: '/products/rie-etcher', lastmod: '2026-01-14', changefreq: 'monthly', priority: '0.8' },
  { loc: '/products/icp-etcher', lastmod: '2026-01-14', changefreq: 'monthly', priority: '0.8' },
  { loc: '/products/compact-rie', lastmod: '2026-01-14', changefreq: 'monthly', priority: '0.8' },
  { loc: '/products/plasma-cleaner', lastmod: '2026-02-14', changefreq: 'monthly', priority: '0.8' },
  { loc: '/products/plasma-cleaner/compare', lastmod: '2026-02-14', changefreq: 'monthly', priority: '0.8' },
  { loc: '/products/hy-4l', lastmod: '2026-02-14', changefreq: 'monthly', priority: '0.8' },
  { loc: '/products/hy-4l-rf', lastmod: '2026-02-14', changefreq: 'monthly', priority: '0.8' },
  { loc: '/products/hy-4l-mf', lastmod: '2026-02-14', changefreq: 'monthly', priority: '0.8' },
  { loc: '/products/hy-20l', lastmod: '2026-02-14', changefreq: 'monthly', priority: '0.8' },
  { loc: '/products/hy-20lrf', lastmod: '2026-02-14', changefreq: 'monthly', priority: '0.8' },
  { loc: '/products/pluto-t', lastmod: '2026-02-14', changefreq: 'monthly', priority: '0.8' },
  { loc: '/products/pluto-m', lastmod: '2026-02-14', changefreq: 'monthly', priority: '0.8' },
  { loc: '/products/pluto-f', lastmod: '2026-02-14', changefreq: 'monthly', priority: '0.8' },
  { loc: '/about', lastmod: '2024-03-20', changefreq: 'monthly', priority: '0.7' },
  { loc: '/return-policy', lastmod: '2026-01-14', changefreq: 'monthly', priority: '0.7' },
  { loc: '/careers', lastmod: '2026-03-08', changefreq: 'monthly', priority: '0.6' },
  { loc: '/contact', lastmod: '2026-03-10', changefreq: 'monthly', priority: '0.7' },
  { loc: '/service-support', lastmod: '2025-08-27', changefreq: 'monthly', priority: '0.6' },
  { loc: '/startup-package', lastmod: '2025-09-16', changefreq: 'monthly', priority: '0.8' },
  { loc: '/insights', lastmod: '2026-03-19', changefreq: 'weekly', priority: '0.8' },
  { loc: '/news', lastmod: '2026-03-21', changefreq: 'daily', priority: '0.7' },
  { loc: '/NineScrolls-Equipment-Guide.pdf', lastmod: '2025-09-08', changefreq: 'monthly', priority: '0.3' },
];

// ─── DynamoDB Query ─────────────────────────────────────────────────────────

interface ArticleData {
  slug: string;
  title: string;
  excerpt: string | null;
  publishDate: string;
  contentType: string | null;
  updatedAt: string;
}

const LIST_QUERY = `
  query ListPosts($filter: ModelInsightsPostFilterInput, $limit: Int, $nextToken: String) {
    listInsightsPosts(filter: $filter, limit: $limit, nextToken: $nextToken) {
      items { slug title excerpt publishDate contentType updatedAt }
      nextToken
    }
  }
`;

async function fetchPublishedPosts(): Promise<ArticleData[]> {
  const all: ArticleData[] = [];
  let cursor: string | null = null;

  try {
    do {
      const result: any = await client.graphql({
        query: LIST_QUERY,
        variables: {
          filter: { isDraft: { ne: true } },
          limit: 100,
          ...(cursor ? { nextToken: cursor } : {}),
        },
      });

      const page = result.data.listInsightsPosts;
      for (const item of page.items) {
        if (!item.slug || !item.publishDate) continue;
        all.push({
          slug: item.slug,
          title: item.title,
          excerpt: item.excerpt ?? null,
          publishDate: item.publishDate,
          contentType: item.contentType ?? 'insight',
          updatedAt: item.updatedAt ?? item.publishDate,
        });
      }
      cursor = page.nextToken ?? null;
    } while (cursor);
  } catch (err) {
    console.warn('WARNING: DynamoDB query failed. Generating with static pages only.');
    console.warn(err);
    return [];
  }

  return all;
}

// ─── Sitemap Generation ─────────────────────────────────────────────────────

function generateMainSitemap(posts: ArticleData[]): string {
  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ];

  // Static pages
  for (const page of STATIC_PAGES) {
    lines.push('  <url>');
    lines.push(`    <loc>${BASE_URL}${page.loc}</loc>`);
    lines.push(`    <lastmod>${page.lastmod}</lastmod>`);
    lines.push(`    <changefreq>${page.changefreq}</changefreq>`);
    lines.push(`    <priority>${page.priority}</priority>`);
    lines.push('  </url>');
  }

  // Dynamic article pages
  for (const post of posts) {
    const urlPath = post.contentType === 'news'
      ? `/news/${post.slug}`
      : `/insights/${post.slug}`;
    const lastmod = toIsoDate(post.updatedAt?.split('T')[0] || post.publishDate);
    const priority = post.contentType === 'news' ? '0.7' : '0.7';
    const changefreq = post.contentType === 'news' ? 'weekly' : 'monthly';

    lines.push('  <url>');
    lines.push(`    <loc>${BASE_URL}${urlPath}</loc>`);
    lines.push(`    <lastmod>${lastmod}</lastmod>`);
    lines.push(`    <changefreq>${changefreq}</changefreq>`);
    lines.push(`    <priority>${priority}</priority>`);
    lines.push('  </url>');
  }

  lines.push('</urlset>');
  return lines.join('\n') + '\n';
}

// ─── Google News Sitemap ────────────────────────────────────────────────────

function generateNewsSitemap(newsPosts: ArticleData[]): string {
  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

  const recent = newsPosts.filter(post => {
    const pubDate = new Date(post.publishDate + 'T00:00:00Z');
    return pubDate >= twoDaysAgo;
  });

  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    '        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">',
  ];

  for (const post of recent) {
    lines.push('  <url>');
    lines.push(`    <loc>${BASE_URL}/news/${post.slug}</loc>`);
    lines.push('    <news:news>');
    lines.push('      <news:publication>');
    lines.push('        <news:name>NineScrolls</news:name>');
    lines.push('        <news:language>en</news:language>');
    lines.push('      </news:publication>');
    lines.push(`      <news:publication_date>${toIsoDate(post.publishDate)}</news:publication_date>`);
    lines.push(`      <news:title>${escapeXml(post.title)}</news:title>`);
    lines.push('    </news:news>');
    lines.push('  </url>');
  }

  lines.push('</urlset>');
  return lines.join('\n') + '\n';
}

// ─── RSS Feed ───────────────────────────────────────────────────────────────

function generateRssFeed(newsPosts: ArticleData[]): string {
  const sorted = [...newsPosts]
    .sort((a, b) => b.publishDate.localeCompare(a.publishDate))
    .slice(0, 20);

  const lastBuildDate = sorted.length > 0
    ? toRfc822(sorted[0].publishDate)
    : new Date().toUTCString();

  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '  <channel>',
    '    <title>NineScrolls News</title>',
    `    <link>${BASE_URL}/news</link>`,
    '    <description>Latest semiconductor equipment and plasma processing industry news from NineScrolls</description>',
    '    <language>en-us</language>',
    `    <lastBuildDate>${lastBuildDate}</lastBuildDate>`,
    `    <atom:link href="${BASE_URL}/feed.xml" rel="self" type="application/rss+xml"/>`,
  ];

  for (const post of sorted) {
    const link = `${BASE_URL}/news/${post.slug}`;
    const description = post.excerpt
      ? escapeXml(post.excerpt)
      : escapeXml(post.title);

    lines.push('    <item>');
    lines.push(`      <title>${escapeXml(post.title)}</title>`);
    lines.push(`      <link>${link}</link>`);
    lines.push(`      <description>${description}</description>`);
    lines.push(`      <pubDate>${toRfc822(post.publishDate)}</pubDate>`);
    lines.push(`      <guid isPermaLink="true">${link}</guid>`);
    lines.push('    </item>');
  }

  lines.push('  </channel>');
  lines.push('</rss>');
  return lines.join('\n') + '\n';
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  if (!existsSync('dist')) {
    console.error('ERROR: dist/ not found. Run "vite build" first.');
    process.exit(1);
  }

  console.log('Fetching published articles from DynamoDB...');
  const posts = await fetchPublishedPosts();
  const newsPosts = posts.filter(p => p.contentType === 'news');
  const insightPosts = posts.filter(p => p.contentType !== 'news');

  console.log(`  Found ${posts.length} articles (${insightPosts.length} insights, ${newsPosts.length} news)`);

  // Generate and write all files to dist/
  writeFileSync('dist/sitemap.xml', generateMainSitemap(posts));
  console.log(`Generated sitemap.xml (${STATIC_PAGES.length + posts.length} URLs)`);

  const newsSitemap = generateNewsSitemap(newsPosts);
  writeFileSync('dist/news-sitemap.xml', newsSitemap);
  console.log(`Generated news-sitemap.xml (${(newsSitemap.match(/<url>/g) || []).length} recent news URLs)`);

  const feed = generateRssFeed(newsPosts);
  writeFileSync('dist/feed.xml', feed);
  console.log(`Generated feed.xml (${(feed.match(/<item>/g) || []).length} items)`);

  writeFileSync(`dist/${INDEXNOW_KEY}.txt`, INDEXNOW_KEY);

  console.log('\nSEO assets written to dist/ (static fallback).');
  console.log('Note: In production, /sitemap.xml etc. are served dynamically via Lambda.');
}

main().catch(err => {
  console.error('SEO generation failed:', err);
  process.exit(1);
});
