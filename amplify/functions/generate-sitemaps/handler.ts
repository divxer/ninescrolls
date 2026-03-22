/**
 * Lambda: Serve sitemap.xml, news-sitemap.xml, feed.xml dynamically.
 *
 * GET /seo?file=sitemap       → sitemap.xml
 * GET /seo?file=news-sitemap  → news-sitemap.xml
 * GET /seo?file=feed          → feed.xml
 * GET /seo?file=indexnow      → IndexNow verification key
 *
 * Reads directly from DynamoDB InsightsPost table (no GraphQL needed).
 * Amplify rewrites proxy /sitemap.xml → /seo?file=sitemap etc.
 */

import type { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';

const TABLE_NAME = process.env.INSIGHTS_POST_TABLE!;
const BASE_URL = 'https://ninescrolls.com';
const INDEXNOW_KEY = 'b8f4e2a1c7d94f3e8a6b0c5d7e9f1a2b';

const ddbClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

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
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? new Date().toISOString().split('T')[0] : d.toISOString().split('T')[0];
}

function toRfc822(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  return isNaN(d.getTime()) ? new Date().toUTCString() : d.toUTCString();
}

// ─── Static Pages ───────────────────────────────────────────────────────────

const STATIC_PAGES = [
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
  contentType: string;
  updatedAt: string;
}

async function fetchPublishedPosts(): Promise<ArticleData[]> {
  const all: ArticleData[] = [];
  let lastKey: Record<string, any> | undefined;

  do {
    const result = await ddbClient.send(new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: 'isDraft <> :true',
      ExpressionAttributeValues: { ':true': true },
      ProjectionExpression: 'slug, title, excerpt, publishDate, contentType, updatedAt',
      ...(lastKey ? { ExclusiveStartKey: lastKey } : {}),
    }));

    for (const item of result.Items || []) {
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
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  return all;
}

// ─── Generators ─────────────────────────────────────────────────────────────

function generateSitemap(posts: ArticleData[]): string {
  const lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'];
  for (const p of STATIC_PAGES) {
    lines.push(`  <url><loc>${BASE_URL}${p.loc}</loc><lastmod>${p.lastmod}</lastmod><changefreq>${p.changefreq}</changefreq><priority>${p.priority}</priority></url>`);
  }
  for (const post of posts) {
    const path = post.contentType === 'news' ? `/news/${post.slug}` : `/insights/${post.slug}`;
    const lastmod = toIsoDate(post.updatedAt?.split('T')[0] || post.publishDate);
    lines.push(`  <url><loc>${BASE_URL}${path}</loc><lastmod>${lastmod}</lastmod><changefreq>${post.contentType === 'news' ? 'weekly' : 'monthly'}</changefreq><priority>0.7</priority></url>`);
  }
  lines.push('</urlset>');
  return lines.join('\n') + '\n';
}

function generateNewsSitemap(newsPosts: ArticleData[]): string {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 2);
  const recent = newsPosts.filter(p => new Date(p.publishDate + 'T00:00:00Z') >= cutoff);
  const lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">'];
  for (const post of recent) {
    lines.push(`  <url><loc>${BASE_URL}/news/${post.slug}</loc><news:news><news:publication><news:name>NineScrolls</news:name><news:language>en</news:language></news:publication><news:publication_date>${toIsoDate(post.publishDate)}</news:publication_date><news:title>${escapeXml(post.title)}</news:title></news:news></url>`);
  }
  lines.push('</urlset>');
  return lines.join('\n') + '\n';
}

function generateFeed(newsPosts: ArticleData[]): string {
  const sorted = [...newsPosts].sort((a, b) => b.publishDate.localeCompare(a.publishDate)).slice(0, 20);
  const lastBuild = sorted.length > 0 ? toRfc822(sorted[0].publishDate) : new Date().toUTCString();
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '  <channel>',
    '    <title>NineScrolls News</title>',
    `    <link>${BASE_URL}/news</link>`,
    '    <description>Latest semiconductor equipment and plasma processing industry news from NineScrolls</description>',
    '    <language>en-us</language>',
    `    <lastBuildDate>${lastBuild}</lastBuildDate>`,
    `    <atom:link href="${BASE_URL}/feed.xml" rel="self" type="application/rss+xml"/>`,
  ];
  for (const post of sorted) {
    const link = `${BASE_URL}/news/${post.slug}`;
    lines.push(`    <item><title>${escapeXml(post.title)}</title><link>${link}</link><description>${escapeXml(post.excerpt || post.title)}</description><pubDate>${toRfc822(post.publishDate)}</pubDate><guid isPermaLink="true">${link}</guid></item>`);
  }
  lines.push('  </channel>', '</rss>');
  return lines.join('\n') + '\n';
}

// ─── Handler ────────────────────────────────────────────────────────────────

function response(statusCode: number, body: string, contentType = 'text/plain', cacheMaxAge = 3600) {
  return {
    statusCode,
    headers: {
      'Content-Type': `${contentType}; charset=utf-8`,
      'Cache-Control': `public, max-age=${cacheMaxAge}`,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,OPTIONS',
    },
    body,
  };
}

export const handler: APIGatewayProxyHandler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return response(200, '');
  }

  const file = event.queryStringParameters?.file;

  if (file === 'indexnow') {
    return response(200, INDEXNOW_KEY, 'text/plain', 86400);
  }

  if (!file || !['sitemap', 'news-sitemap', 'feed'].includes(file)) {
    return response(400, 'file parameter required: sitemap, news-sitemap, feed, or indexnow');
  }

  try {
    const posts = await fetchPublishedPosts();
    const newsPosts = posts.filter(p => p.contentType === 'news');

    let body: string;
    let contentType: string;

    switch (file) {
      case 'sitemap':
        body = generateSitemap(posts);
        contentType = 'application/xml';
        break;
      case 'news-sitemap':
        body = generateNewsSitemap(newsPosts);
        contentType = 'application/xml';
        break;
      case 'feed':
        body = generateFeed(newsPosts);
        contentType = 'application/rss+xml';
        break;
      default:
        return response(400, 'invalid file');
    }

    return response(200, body, contentType);
  } catch (err: any) {
    console.error('Sitemap generation failed:', err);
    return response(500, 'Internal error');
  }
};
