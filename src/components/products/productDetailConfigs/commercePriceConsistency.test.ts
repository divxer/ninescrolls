import { describe, expect, it } from 'vitest';
import { checkoutProductCatalog } from '../../../../amplify/functions/create-checkout-session/productCatalog';
import { taxProductCatalog } from '../../../../amplify/functions/calculate-tax/productCatalog';
import type { ProductDetailConfig } from '../ProductDetailPage.types';
import { hy4lConfig } from './hy4lConfig';

const commerceConfigs: ProductDetailConfig[] = [hy4lConfig];

describe('commerce product prices', () => {
  it('keeps product detail config prices aligned with Stripe checkout and tax catalogs', () => {
    for (const config of commerceConfigs) {
      for (const variant of config.commerce?.variants ?? []) {
        expect(checkoutProductCatalog[variant.sku]?.price).toBe(variant.price);
        expect(taxProductCatalog[variant.sku]?.price).toBe(variant.price);
      }
    }
  });
});
