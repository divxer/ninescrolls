import type { RelatedProduct } from '../types';

interface BuildRfqUrlOpts {
  products?: { slug: string }[];
  sourceSlug: string;
  sourceArea?: 'insights' | 'news' | 'products';
  extraParams?: Record<string, string>;
}

const MAX_PRODUCTS = 5;

export function buildRfqUrl(opts: BuildRfqUrlOpts): string {
  const params = new URLSearchParams();
  if (opts.products && opts.products.length > 0) {
    const slugs = opts.products.slice(0, MAX_PRODUCTS).map((p) => p.slug);
    params.set('products', slugs.join(','));
  }
  params.set('source', `${opts.sourceArea ?? 'insights'}/${opts.sourceSlug}`);
  if (opts.extraParams) {
    for (const [k, v] of Object.entries(opts.extraParams)) {
      params.set(k, v);
    }
  }
  return `/request-quote?${params.toString()}`;
}

export function relatedProductsToSlugs(products?: RelatedProduct[]): { slug: string }[] {
  if (!products) return [];
  return products
    .map((p) => p.href.replace(/^\/products\//, ''))
    .filter((slug) => slug.length > 0 && !slug.includes('/'))  // sanity: drop non-product hrefs
    .map((slug) => ({ slug }));
}

/**
 * Parse a referrerSource string ("insights/<slug>" or "news/<slug>") into a
 * human-readable label like "Article: Atomic Layer Etching Guide".
 */
export function parseRfqSource(src: string): string {
  const [area, slug] = src.split('/');
  if (!slug) return src;
  const title = slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  const areaLabel = area === 'insights' ? 'Article' : area.charAt(0).toUpperCase() + area.slice(1);
  return `${areaLabel}: ${title}`;
}
