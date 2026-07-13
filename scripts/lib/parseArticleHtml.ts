/**
 * Pure parser for standalone insights-article HTML files.
 *
 * Extracts the article title, body content, and optional authoring metadata
 * (excerpt, category, tags, article type, cover image, publish date, author,
 * related products) from a standalone HTML document. Intentionally has NO
 * dependency on Amplify, AWS, or any runtime — so it can be unit-tested and
 * reused in both `create-insight.ts` and the article regression tests.
 *
 * Metadata sources:
 *   - <h1> (else <title>)                        → title
 *   - <body> inner (else whole file)             → content (first h1 + TOC stripped)
 *   - <meta name="article:slug" content>         → slug (else derived from title)
 *   - <meta name="article:excerpt" content>      → excerpt
 *   - <meta name="article:category" content>     → category
 *   - <meta name="article:tags" content>         → tags (comma-split)
 *   - <meta name="article:article-type" content> → articleType
 *   - <meta name="article:image-url" content>    → imageUrl
 *   - <meta name="article:publish-date" content> → publishDate (validated YYYY-MM-DD)
 *   - <meta name="article:author" content>       → author
 *   - <script type="application/json" data-related-products> → relatedProducts
 */

export interface ParsedRelatedProduct {
  href: string;
  label: string;
  subtitle?: string;
}

export interface ParsedArticle {
  title: string;
  content: string;
  slug?: string;
  excerpt?: string;
  category?: string;
  tags?: string[];
  articleType?: string;
  imageUrl?: string;
  publishDate?: string;
  author?: string;
  relatedProducts?: ParsedRelatedProduct[];
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

/** Decode the small set of named/numeric HTML entities that appear in
 *  meta-tag attribute values (e.g. "Metrology &amp; Testing"). */
function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&apos;/g, "'");
}

function extractTitle(html: string): string {
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1Match) return stripHtml(h1Match[1]);
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch) return stripHtml(titleMatch[1]);
  return 'Untitled Article';
}

function extractBodyContent(html: string): string {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return bodyMatch ? bodyMatch[1].trim() : html;
}

function extractContent(html: string): string {
  let cleaned = extractBodyContent(html);
  // Remove the first <h1> (it becomes the title) and a hand-written
  // "Table of Contents" block — the site auto-generates the TOC.
  cleaned = cleaned.replace(/<h1[^>]*>[\s\S]*?<\/h1>/i, '');
  cleaned = cleaned.replace(
    /<h2[^>]*>\s*Table of Contents\s*<\/h2>\s*<ul>[\s\S]*?<\/ul>/i,
    '',
  );
  return cleaned.trim();
}

/** Read a `<meta name="article:<key>" content="...">` value, entity-decoded.
 *  Attribute order (name before content) matches the authoring convention. */
function readMeta(html: string, key: string): string | undefined {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const tagMatch = html.match(
    new RegExp(`<meta[^>]*\\bname=["']article:${escaped}["'][^>]*>`, 'i'),
  );
  if (!tagMatch) return undefined;
  const contentMatch = tagMatch[0].match(/\bcontent=["']([\s\S]*?)["']/i);
  if (!contentMatch) return undefined;
  const value = decodeEntities(contentMatch[1]).trim();
  return value.length > 0 ? value : undefined;
}

function extractRelatedProducts(html: string): ParsedRelatedProduct[] | undefined {
  const scriptMatch = html.match(
    /<script[^>]*\btype=["']application\/json["'][^>]*\bdata-related-products[^>]*>([\s\S]*?)<\/script>/i,
  );
  if (!scriptMatch) return undefined;

  let parsed: unknown;
  try {
    parsed = JSON.parse(scriptMatch[1].trim());
  } catch {
    return undefined;
  }
  if (!Array.isArray(parsed)) return undefined;

  const items: ParsedRelatedProduct[] = [];
  for (const raw of parsed) {
    if (
      raw &&
      typeof raw === 'object' &&
      typeof (raw as any).href === 'string' &&
      typeof (raw as any).label === 'string'
    ) {
      const item: ParsedRelatedProduct = {
        href: (raw as any).href,
        label: (raw as any).label,
      };
      if (typeof (raw as any).subtitle === 'string') {
        item.subtitle = (raw as any).subtitle;
      }
      items.push(item);
    }
  }
  return items.length > 0 ? items : undefined;
}

export function parseArticleHtml(html: string): ParsedArticle {
  const result: ParsedArticle = {
    title: extractTitle(html),
    content: extractContent(html),
  };

  const slug = readMeta(html, 'slug');
  if (slug) result.slug = slug;

  const excerpt = readMeta(html, 'excerpt');
  if (excerpt) result.excerpt = excerpt;

  const category = readMeta(html, 'category');
  if (category) result.category = category;

  const tagsRaw = readMeta(html, 'tags');
  if (tagsRaw) {
    const tags = tagsRaw.split(',').map((t) => t.trim()).filter(Boolean);
    if (tags.length > 0) result.tags = tags;
  }

  const articleType = readMeta(html, 'article-type');
  if (articleType) result.articleType = articleType;

  const imageUrl = readMeta(html, 'image-url');
  if (imageUrl) result.imageUrl = imageUrl;

  const publishDate = readMeta(html, 'publish-date');
  // Only accept a strict YYYY-MM-DD calendar date; reject anything else.
  if (publishDate && /^\d{4}-\d{2}-\d{2}$/.test(publishDate)) {
    result.publishDate = publishDate;
  }

  const author = readMeta(html, 'author');
  if (author) result.author = author;

  const relatedProducts = extractRelatedProducts(html);
  if (relatedProducts) result.relatedProducts = relatedProducts;

  return result;
}
