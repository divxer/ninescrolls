import { describe, expect, it } from 'vitest';
import { toCheckoutImageUrl } from './checkoutImageUrl';

describe('toCheckoutImageUrl', () => {
  const origin = 'https://ninescrolls.com';

  it('returns undefined when no image is provided', () => {
    expect(toCheckoutImageUrl(undefined, origin)).toBeUndefined();
    expect(toCheckoutImageUrl('', origin)).toBeUndefined();
  });

  it('prefixes relative site paths with the current origin', () => {
    expect(toCheckoutImageUrl('/assets/images/redesign/products/hy-4l-standardized.webp', origin))
      .toBe('https://ninescrolls.com/assets/images/redesign/products/hy-4l-standardized.webp');
  });

  it('preserves absolute CDN URLs unchanged', () => {
    expect(toCheckoutImageUrl('https://cdn.ninescrolls.com/products/hy-4l/main.jpg', origin))
      .toBe('https://cdn.ninescrolls.com/products/hy-4l/main.jpg');
  });

  it('preserves protocol-relative URLs unchanged', () => {
    expect(toCheckoutImageUrl('//cdn.ninescrolls.com/products/hy-4l/main.jpg', origin))
      .toBe('//cdn.ninescrolls.com/products/hy-4l/main.jpg');
  });
});
