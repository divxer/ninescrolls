import { describe, it, expect } from 'vitest';
import { buildRfqUrl, relatedProductsToSlugs, parseRfqSource } from './rfqAttribution';

describe('buildRfqUrl', () => {
  it('builds URL with no products', () => {
    expect(buildRfqUrl({ sourceSlug: 'foo' }))
      .toBe('/request-quote?source=insights%2Ffoo');
  });

  it('builds URL with one product', () => {
    expect(buildRfqUrl({
      products: [{ slug: 'icp-rie-200' }],
      sourceSlug: 'rie-guide',
    })).toBe('/request-quote?products=icp-rie-200&source=insights%2Frie-guide');
  });

  it('joins multiple products with commas', () => {
    expect(buildRfqUrl({
      products: [{ slug: 'a' }, { slug: 'b' }, { slug: 'c' }],
      sourceSlug: 'foo',
    })).toBe('/request-quote?products=a%2Cb%2Cc&source=insights%2Ffoo');
  });

  it('uses sourceArea when provided', () => {
    expect(buildRfqUrl({
      sourceSlug: 'apple-intel',
      sourceArea: 'news',
    })).toBe('/request-quote?source=news%2Fapple-intel');
  });

  it('truncates to first 5 products', () => {
    const products = Array.from({ length: 7 }, (_, i) => ({ slug: `p${i}` }));
    expect(buildRfqUrl({ products, sourceSlug: 'foo' }))
      .toBe('/request-quote?products=p0%2Cp1%2Cp2%2Cp3%2Cp4&source=insights%2Ffoo');
  });

  it('appends extra query params', () => {
    expect(buildRfqUrl({
      sourceSlug: 'foo',
      extraParams: { via: 'ask-checkbox' },
    })).toBe('/request-quote?source=insights%2Ffoo&via=ask-checkbox');
  });
});

describe('relatedProductsToSlugs', () => {
  it('returns empty array for undefined', () => {
    expect(relatedProductsToSlugs()).toEqual([]);
  });

  it('extracts slug from /products/<slug> hrefs', () => {
    expect(relatedProductsToSlugs([
      { href: '/products/rie-etcher', label: 'RIE' },
      { href: '/products/icp-etcher', label: 'ICP' },
    ])).toEqual([{ slug: 'rie-etcher' }, { slug: 'icp-etcher' }]);
  });

  it('drops hrefs that are not /products/<slug>', () => {
    expect(relatedProductsToSlugs([
      { href: '/products/rie-etcher', label: 'RIE' },
      { href: '/about', label: 'About' },
      { href: '/products/sub/path', label: 'Bad' },
      { href: '/products/', label: 'Empty' },
    ])).toEqual([{ slug: 'rie-etcher' }]);
  });
});

describe('parseRfqSource', () => {
  it('parses insights/<slug> as "Article: ..."', () => {
    expect(parseRfqSource('insights/atomic-layer-etching-guide'))
      .toBe('Article: Atomic Layer Etching Guide');
  });

  it('parses news/<slug> as "News: ..."', () => {
    expect(parseRfqSource('news/apple-intel-deal'))
      .toBe('News: Apple Intel Deal');
  });

  it('returns input unchanged when no slash', () => {
    expect(parseRfqSource('orphan-string')).toBe('orphan-string');
  });

  it('handles unknown area with capitalized fallback', () => {
    expect(parseRfqSource('foo/bar-baz')).toBe('Foo: Bar Baz');
  });
});
