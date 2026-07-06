import { describe, expect, it } from 'vitest';
import { checkoutProductCatalog } from '../../../../amplify/functions/create-checkout-session/productCatalog';
import { taxProductCatalog } from '../../../../amplify/functions/calculate-tax/productCatalog';
import type { ProductDetailConfig } from '../ProductDetailPage.types';
import { hy4lConfig } from './hy4lConfig';
import { hy20lConfig } from './hy20lConfig';
import { hy20lrfConfig } from './hy20lrfConfig';
import { plutoTConfig } from './plutoTConfig';
import { plutoMConfig } from './plutoMConfig';
import { plutoFConfig } from './plutoFConfig';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const commerceConfigs: ProductDetailConfig[] = [hy4lConfig, hy20lConfig, hy20lrfConfig, plutoTConfig, plutoMConfig, plutoFConfig];

describe('commerce product prices', () => {
  it('keeps product detail config prices aligned with Stripe checkout and tax catalogs', () => {
    for (const config of commerceConfigs) {
      for (const variant of config.commerce?.variants ?? []) {
        expect(checkoutProductCatalog[variant.sku]?.price).toBe(variant.price);
        expect(checkoutProductCatalog[variant.sku]?.name).toBe(variant.cartName);
        expect(taxProductCatalog[variant.sku]?.price).toBe(variant.price);
        expect(taxProductCatalog[variant.sku]?.name).toBe(variant.cartName);
      }
    }
  });

  it('keeps checkout catalog image paths pointed at tracked public assets', () => {
    for (const item of Object.values(checkoutProductCatalog)) {
      if (!item.imagePath) {
        continue;
      }

      expect(item.imagePath).toMatch(/^\/assets\/images\/redesign\/products\//);
      expect(existsSync(join(process.cwd(), 'public', item.imagePath))).toBe(true);
    }
  });
});
