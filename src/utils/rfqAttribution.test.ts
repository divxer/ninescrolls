import { describe, it, expect } from 'vitest';
import { buildRfqUrl, relatedProductsToSlugs } from './rfqAttribution';

describe('buildRfqUrl', () => {
  it('builds URL with no products', () => {
    expect(buildRfqUrl({ sourceSlug: 'foo' }))
      .toBe('/rfq?source=insights%2Ffoo');
  });

  it('builds URL with one product', () => {
    expect(buildRfqUrl({
      products: [{ slug: 'icp-rie-200' }],
      sourceSlug: 'rie-guide',
    })).toBe('/rfq?products=icp-rie-200&source=insights%2Frie-guide');
  });

  it('joins multiple products with commas', () => {
    expect(buildRfqUrl({
      products: [{ slug: 'a' }, { slug: 'b' }, { slug: 'c' }],
      sourceSlug: 'foo',
    })).toBe('/rfq?products=a%2Cb%2Cc&source=insights%2Ffoo');
  });

  it('uses sourceArea when provided', () => {
    expect(buildRfqUrl({
      sourceSlug: 'apple-intel',
      sourceArea: 'news',
    })).toBe('/rfq?source=news%2Fapple-intel');
  });

  it('truncates to first 5 products', () => {
    const products = Array.from({ length: 7 }, (_, i) => ({ slug: `p${i}` }));
    expect(buildRfqUrl({ products, sourceSlug: 'foo' }))
      .toBe('/rfq?products=p0%2Cp1%2Cp2%2Cp3%2Cp4&source=insights%2Ffoo');
  });

  it('appends extra query params', () => {
    expect(buildRfqUrl({
      sourceSlug: 'foo',
      extraParams: { via: 'ask-checkbox' },
    })).toBe('/rfq?source=insights%2Ffoo&via=ask-checkbox');
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
