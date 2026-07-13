import { describe, it, expect } from 'vitest';
import { productConfigs, productOptions } from './index';

describe('product config registry', () => {
  it('derives one option per config, preserving order', () => {
    expect(productOptions).toHaveLength(productConfigs.length);
    expect(productOptions.map((o) => o.slug)).toEqual(productConfigs.map((c) => c.slug));
  });
  it('covers the full canonical product set, including previously-omitted products', () => {
    const slugs = new Set(productOptions.map((o) => o.slug));
    for (const s of ['ald', 'rie-etcher', 'hy-4l', 'hy-20l', 'hy-20lrf', 'pluto-t', 'pluto-f', 'pluto-m', 'pluto-30']) {
      expect(slugs.has(s)).toBe(true);
    }
    expect(productOptions.length).toBeGreaterThanOrEqual(18);
  });
  it('every option has a non-empty label', () => {
    for (const o of productOptions) expect(o.label.trim().length).toBeGreaterThan(0);
  });
});
