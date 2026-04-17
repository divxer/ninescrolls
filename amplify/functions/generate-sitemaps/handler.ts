/**
 * Lambda: Serve sitemap.xml, news-sitemap.xml, feed.xml, and pre-rendered
 * article HTML dynamically from DynamoDB.
 *
 * GET /seo?file=sitemap       → sitemap.xml
 * GET /seo?file=news-sitemap  → news-sitemap.xml
 * GET /seo?file=feed          → feed.xml
 * GET /seo?file=indexnow      → IndexNow verification key
 * GET /seo?file=prerender&slug=xxx&type=insights|news → pre-rendered article HTML
 * GET /seo?file=prerender&path=products/slug → pre-rendered product page HTML
 *
 * Reads directly from DynamoDB InsightsPost table (no GraphQL needed).
 * Amplify rewrites proxy /sitemap.xml → /seo?file=sitemap etc.
 * CloudFront Function routes bot requests for /insights/:slug, /news/:slug,
 * and /products/:slug to /seo?file=prerender&path=<type>/<slug>.
 */

import type { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

const TABLE_NAME = process.env.INSIGHTS_POST_TABLE!;
const BASE_URL = 'https://ninescrolls.com';
const INDEXNOW_KEY = process.env.INDEXNOW_KEY ?? '';

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
  let recent = newsPosts.filter(p => new Date(p.publishDate + 'T00:00:00Z') >= cutoff);
  // If no articles within 2 days, include the most recent one to avoid an empty
  // sitemap (Google flags empty news sitemaps as format errors).
  if (recent.length === 0 && newsPosts.length > 0) {
    const sorted = [...newsPosts].sort((a, b) => b.publishDate.localeCompare(a.publishDate));
    recent = [sorted[0]];
  }
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

// ─── Prerender: dynamic HTML for bots ───────────────────────────────────────

interface FullArticle {
  slug: string;
  title: string;
  content: string | null;
  excerpt: string | null;
  imageUrl: string | null;
  author: string;
  readTime: number;
  category: string;
  publishDate: string;
  contentType: string;
  updatedAt: string;
}

async function fetchPostBySlug(slug: string): Promise<FullArticle | null> {
  // Try GSI query first (fast O(1) lookup), fall back to Scan if GSI fails
  let item: Record<string, any> | undefined;
  try {
    const result = await ddbClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'insightsPostsBySlug',
      KeyConditionExpression: 'slug = :slug',
      ExpressionAttributeValues: { ':slug': slug },
      Limit: 1,
    }));
    item = result.Items?.[0];
  } catch (gsiErr) {
    console.warn('[Prerender] GSI query failed, falling back to Scan:', gsiErr);
    let lastKey: Record<string, any> | undefined;
    do {
      const result = await ddbClient.send(new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: 'slug = :slug',
        ExpressionAttributeValues: { ':slug': slug },
        ...(lastKey ? { ExclusiveStartKey: lastKey } : {}),
      }));
      if (result.Items && result.Items.length > 0) { item = result.Items[0]; break; }
      lastKey = result.LastEvaluatedKey;
    } while (lastKey);
  }
  if (!item || item.isDraft === true) return null;
  return {
    slug: item.slug,
    title: item.title,
    content: item.content ?? null,
    excerpt: item.excerpt ?? null,
    imageUrl: item.imageUrl ?? null,
    author: item.author ?? 'NineScrolls Team',
    readTime: item.readTime ?? 5,
    category: item.category ?? '',
    publishDate: item.publishDate,
    contentType: item.contentType ?? 'insight',
    updatedAt: item.updatedAt ?? item.publishDate,
  };
}

function escapeHtmlAttr(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function generatePrerenderHTML(post: FullArticle): string {
  const isNews = post.contentType === 'news';
  const urlPath = isNews ? `/news/${post.slug}` : `/insights/${post.slug}`;
  const fullUrl = `${BASE_URL}${urlPath}`;
  const fullTitle = `${post.title} | NineScrolls LLC`;
  const description = post.excerpt || post.title;
  const imageUrl = post.imageUrl?.startsWith('http') ? post.imageUrl : (post.imageUrl ? `${BASE_URL}${post.imageUrl}` : `${BASE_URL}/assets/images/og-image.jpg`);

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': isNews ? 'NewsArticle' : 'Article',
    headline: post.title,
    description,
    image: imageUrl,
    author: { '@type': 'Organization', name: post.author },
    publisher: { '@type': 'Organization', name: 'NineScrolls LLC', url: BASE_URL },
    datePublished: post.publishDate,
    dateModified: post.updatedAt?.split('T')[0] || post.publishDate,
    mainEntityOfPage: fullUrl,
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtmlAttr(fullTitle)}</title>
  <meta name="description" content="${escapeHtmlAttr(description)}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${fullUrl}">
  <meta property="og:title" content="${escapeHtmlAttr(fullTitle)}">
  <meta property="og:description" content="${escapeHtmlAttr(description)}">
  <meta property="og:image" content="${escapeHtmlAttr(imageUrl)}">
  <meta property="og:url" content="${fullUrl}">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="NineScrolls LLC">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtmlAttr(fullTitle)}">
  <meta name="twitter:description" content="${escapeHtmlAttr(description)}">
  <meta name="twitter:image" content="${escapeHtmlAttr(imageUrl)}">
  <script type="application/ld+json">${jsonLd}</script>
</head>
<body>
  <article>
    <h1>${escapeHtmlAttr(post.title)}</h1>
    <p>By ${escapeHtmlAttr(post.author)} &middot; ${post.publishDate} &middot; ${post.readTime} min read &middot; ${escapeHtmlAttr(post.category)}</p>
    ${post.content || ''}
  </article>
  <nav><a href="${BASE_URL}">NineScrolls Home</a> &middot; <a href="${BASE_URL}/${isNews ? 'news' : 'insights'}">All ${isNews ? 'News' : 'Insights'}</a></nav>
  <img src="/d?t=pixel" width="1" height="1" alt="" style="position:absolute">
  <script>
    // JS-enabled browsers (regular users): load the SPA over this page.
    // Bots don't execute JS, so they see the pre-rendered content above.
    // Fetch index.html, extract its <script>/<link> tags, and inject them
    // to bootstrap the React app without a full page reload.
    (function(){
      var d=document;
      fetch('/index.html').then(function(r){return r.text()}).then(function(h){
        var p=new DOMParser().parseFromString(h,'text/html');
        // Add SPA root container
        var root=d.createElement('div');root.id='root';d.body.prepend(root);
        // Remove pre-rendered content
        var a=d.querySelector('article');if(a)a.remove();
        var n=d.querySelector('nav');if(n)n.remove();
        // Remove prerender meta/link tags so React Helmet owns them (avoids duplicate canonicals)
        d.querySelectorAll('link[rel="canonical"],meta[name="description"],meta[name="robots"],meta[property^="og:"],meta[name^="twitter:"]').forEach(function(el){el.remove()});
        var ld=d.querySelector('script[type="application/ld+json"]');if(ld)ld.remove();
        // Inject SPA stylesheets
        p.querySelectorAll('link[rel="stylesheet"]').forEach(function(l){
          var c=l.cloneNode();d.head.appendChild(c);
        });
        // Inject SPA scripts (module type preserves execution order)
        p.querySelectorAll('script[type="module"]').forEach(function(s){
          var c=d.createElement('script');c.type='module';c.src=s.src;c.crossOrigin=s.crossOrigin||'';d.body.appendChild(c);
        });
      });
    })();
  </script>
</body>
</html>`;
}

// ─── Product prerender (static data, no DynamoDB needed) ────────────────────

const PRODUCT_SEO: Record<string, { title: string; description: string; image: string }> = {
  'rie-etcher': {
    title: 'RIE Etcher - Reactive Ion Etching System for Plasma Etching',
    description: 'Reactive ion etching (RIE) systems for precise plasma etching of semiconductors, dielectrics, and polymers. Up to 12" wafers, 600–1000W RF, automated recipe control.',
    image: '/assets/images/products/rie-etcher/main.jpg',
  },
  'icp-etcher': {
    title: 'ICP Etcher - Inductively Coupled Plasma Etching System',
    description: 'ICP-RIE etching systems with independent ion energy and density control. 2000W ICP + 600W bias for high-aspect-ratio deep etching on 12" wafers.',
    image: '/assets/images/products/icp-etcher/main.jpg',
  },
  'compact-rie': {
    title: 'Compact RIE Etcher (SV-RIE) - Small Footprint Reactive Ion Etching',
    description: 'Ultra-compact RIE system with 630×600mm footprint. Touchscreen control, 300–1000W RF, 4"–12" wafers. Ideal for research labs and failure analysis.',
    image: '/assets/images/products/compact-rie/main.jpg',
  },
  'ald': {
    title: 'ALD System - Atomic Layer Deposition Equipment',
    description: 'ALD systems with sub-nanometer thickness control and <1% uniformity. Thermal and plasma-enhanced modes for Al₂O₃, HfO₂, TiN. 4"–12" wafers.',
    image: '/assets/images/products/ald/main.jpg',
  },
  'hdp-cvd': {
    title: 'HDP-CVD System - High-Density Plasma Chemical Vapor Deposition',
    description: 'HDP-CVD systems with compact uni-body design for superior gap-fill and film quality. SiO₂, SiNx, SiC deposition on 4"–12" wafers.',
    image: '/assets/images/products/hdp-cvd/main.jpg',
  },
  'pecvd': {
    title: 'PECVD System - Plasma-Enhanced Chemical Vapor Deposition Equipment',
    description: 'PECVD systems with dual RF (13.56 MHz / 400 KHz) for SiO₂, SiNx, and a-Si thin films. Compact design, 4"–12" wafer capability, <5% uniformity.',
    image: '/assets/images/products/pecvd/main.jpg',
  },
  'sputter': {
    title: 'Sputter Deposition System - PVD Magnetron Sputtering Equipment',
    description: 'PVD magnetron sputtering systems with 2–6 configurable targets. <1% film uniformity, substrate temperature up to 1200°C. Metals, oxides, and nitrides.',
    image: '/assets/images/products/sputter/main.jpg',
  },
  'ibe-ribe': {
    title: 'IBE/RIBE System - Ion Beam Etching Equipment',
    description: 'Ion beam etching systems with IBE and RIBE dual-mode operation. Variable angle 0–90°, Kaufman/RF ion sources. Precision etching for magnetic and optical materials.',
    image: '/assets/images/products/ibe-ribe/main.jpg',
  },
  'striper': {
    title: 'Plasma Striper - Photoresist Stripping & Ashing System',
    description: 'Plasma photoresist stripping systems for complete organic removal. 300–1000W RF power, 4"–12" wafers. Fast, clean resist ashing with real-time monitoring.',
    image: '/assets/images/products/striper/main.jpg',
  },
  'coater-developer': {
    title: 'Spin Coater & Developer System - Photoresist Coating Equipment',
    description: 'Precision spin coater and developer systems with <0.5% coating uniformity. Modular hotplate, EBR options. 2"–12" wafers and square substrates.',
    image: '/assets/images/products/coater-developer/main.jpg',
  },
};

function generateProductPrerenderHTML(slug: string): string | null {
  const product = PRODUCT_SEO[slug];
  if (!product) return null;

  const fullUrl = `${BASE_URL}/products/${slug}`;
  const fullTitle = `${product.title} | NineScrolls LLC`;
  const imageUrl = `https://cdn.ninescrolls.com${product.image}`;

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    description: product.description,
    image: imageUrl,
    brand: { '@type': 'Brand', name: 'NineScrolls LLC' },
    manufacturer: { '@type': 'Organization', name: 'NineScrolls LLC', url: BASE_URL },
    category: 'Semiconductor Manufacturing Equipment',
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtmlAttr(fullTitle)}</title>
  <meta name="description" content="${escapeHtmlAttr(product.description)}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${fullUrl}">
  <meta property="og:title" content="${escapeHtmlAttr(fullTitle)}">
  <meta property="og:description" content="${escapeHtmlAttr(product.description)}">
  <meta property="og:image" content="${escapeHtmlAttr(imageUrl)}">
  <meta property="og:url" content="${fullUrl}">
  <meta property="og:type" content="product">
  <meta property="og:site_name" content="NineScrolls LLC">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtmlAttr(fullTitle)}">
  <meta name="twitter:description" content="${escapeHtmlAttr(product.description)}">
  <meta name="twitter:image" content="${escapeHtmlAttr(imageUrl)}">
  <script type="application/ld+json">${jsonLd}</script>
</head>
<body>
  <h1>${escapeHtmlAttr(product.title)}</h1>
  <p>${escapeHtmlAttr(product.description)}</p>
  <nav><a href="${BASE_URL}">NineScrolls Home</a> &middot; <a href="${BASE_URL}/products">All Products</a></nav>
  <script>
    (function(){
      var d=document;
      fetch('/index.html').then(function(r){return r.text()}).then(function(h){
        var p=new DOMParser().parseFromString(h,'text/html');
        var root=d.createElement('div');root.id='root';d.body.prepend(root);
        d.querySelector('h1')?.remove();
        d.querySelectorAll('p,nav').forEach(function(el){el.remove()});
        d.querySelectorAll('link[rel="canonical"],meta[name="description"],meta[name="robots"],meta[property^="og:"],meta[name^="twitter:"]').forEach(function(el){el.remove()});
        var ld=d.querySelector('script[type="application/ld+json"]');if(ld)ld.remove();
        p.querySelectorAll('link[rel="stylesheet"]').forEach(function(l){
          var c=l.cloneNode();d.head.appendChild(c);
        });
        p.querySelectorAll('script[type="module"]').forEach(function(s){
          var c=d.createElement('script');c.type='module';c.src=s.src;c.crossOrigin=s.crossOrigin||'';d.body.appendChild(c);
        });
      });
    })();
  </script>
</body>
</html>`;
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

  // Pre-rendered article HTML served to all requests.
  // Amplify rewrites /insights/<slug> and /news/<slug> to this endpoint.
  // The HTML includes a <script> that instantly loads the SPA for JS-enabled
  // browsers (regular users), while bots (no JS) see the pre-rendered content
  // with full meta tags, OG cards, JSON-LD, and article body.
  if (file === 'prerender') {
    const pathParam = event.queryStringParameters?.path || '';
    const pathMatch = pathParam.match(/^(insights|news|products)\/([a-z0-9][a-z0-9-]*)(?:\.html)?$/);
    const matchType = pathMatch ? pathMatch[1] : null;
    const slug = event.queryStringParameters?.slug || (pathMatch ? pathMatch[2] : null);

    // Product pages: static data, no DynamoDB lookup
    if (matchType === 'products' && slug) {
      const html = generateProductPrerenderHTML(slug);
      if (!html) return response(404, 'Product not found', 'text/plain', 60);
      return response(200, html, 'text/html', 86400);
    }

    // No slug = listing page (/insights/ or /news/) — serve SPA directly
    if (!slug) {
      try {
        const spaRes = await fetch(`${BASE_URL}/index.html`);
        return response(200, await spaRes.text(), 'text/html', 0);
      } catch {
        return response(200, '<html><body><script>location.href=location.pathname</script></body></html>', 'text/html', 0);
      }
    }

    try {
      const post = await fetchPostBySlug(slug);
      if (!post) return response(404, 'Article not found', 'text/plain', 60);
      return response(200, generatePrerenderHTML(post), 'text/html', 3600);
    } catch (err: any) {
      console.error('Prerender failed:', err);
      return response(500, 'Internal error');
    }
  }

  if (!file || !['sitemap', 'news-sitemap', 'feed'].includes(file)) {
    return response(400, 'file parameter required: sitemap, news-sitemap, feed, indexnow, or prerender');
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
