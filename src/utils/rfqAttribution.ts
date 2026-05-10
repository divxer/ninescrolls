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
  return `/rfq?${params.toString()}`;
}
