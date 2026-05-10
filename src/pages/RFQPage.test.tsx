import { describe, it, expect } from 'vitest';
import { parseRfqUrlParams } from './rfqUrlParams';

describe('parseRfqUrlParams', () => {
  it('parses single product from ?products=', () => {
    const r = parseRfqUrlParams('?products=icp-rie-200&source=insights/foo');
    expect(r.urlProduct).toBe('icp-rie-200');
    expect(r.productsList).toEqual(['icp-rie-200']);
    expect(r.referrerSource).toBe('insights/foo');
    expect(r.productListText).toBe('');
  });

  it('parses multiple products and uses first as primary', () => {
    const r = parseRfqUrlParams('?products=a-100,b-200,c-300&source=insights/foo');
    expect(r.urlProduct).toBe('a-100');
    expect(r.productsList).toEqual(['a-100', 'b-200', 'c-300']);
  });

  it('builds productListText for multi-product (>=2)', () => {
    const r = parseRfqUrlParams('?products=a-100,b-200&source=insights/foo');
    expect(r.productListText).toContain('Products of interest');
    expect(r.productListText).toContain('- a-100');
    expect(r.productListText).toContain('- b-200');
  });

  it('returns empty productListText for single product', () => {
    const r = parseRfqUrlParams('?products=only-one');
    expect(r.productListText).toBe('');
  });

  it('honors legacy ?product= when no ?products=', () => {
    const r = parseRfqUrlParams('?product=legacy-model&category=etching');
    expect(r.urlProduct).toBe('legacy-model');
    expect(r.urlCategory).toBe('etching');
    expect(r.productsList).toEqual([]);
  });

  it('?products= takes precedence over ?product=', () => {
    const r = parseRfqUrlParams('?products=new-model&product=legacy-model');
    expect(r.urlProduct).toBe('new-model');
  });

  it('truncates product list to 5 items', () => {
    const r = parseRfqUrlParams('?products=a,b,c,d,e,f,g');
    expect(r.productsList).toHaveLength(5);
    expect(r.productsList).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('returns empty referrerSource when source absent', () => {
    const r = parseRfqUrlParams('?product=foo');
    expect(r.referrerSource).toBe('');
  });

  it('exposes via param when present', () => {
    const r = parseRfqUrlParams('?source=insights/foo&via=ask-checkbox');
    expect(r.via).toBe('ask-checkbox');
  });

  it('handles empty search string', () => {
    const r = parseRfqUrlParams('');
    expect(r.urlProduct).toBe('');
    expect(r.productsList).toEqual([]);
    expect(r.referrerSource).toBe('');
  });

  it('trims and filters empty product slugs', () => {
    const r = parseRfqUrlParams('?products= a , ,b ,');
    expect(r.productsList).toEqual(['a', 'b']);
  });
});
