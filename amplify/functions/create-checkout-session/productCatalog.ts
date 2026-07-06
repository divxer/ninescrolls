export interface CheckoutProductCatalogItem {
  name: string;
  price: number;
  imagePath?: string;
  taxCode?: string;
  priceId?: string;
}

export const checkoutProductCatalog: Record<string, CheckoutProductCatalogItem> = {
  'hy-4l-rf': {
    name: 'HY-4L - RF (13.56 MHz) Plasma Cleaner',
    price: 7999,
    imagePath: '/assets/images/redesign/products/hy-4l-standardized.webp',
    taxCode: 'txcd_99999999',
  },
  'hy-4l-mf': {
    name: 'HY-4L - Mid-Frequency (40 kHz) Plasma Cleaner',
    price: 6499,
    imagePath: '/assets/images/redesign/products/hy-4l-standardized.webp',
    taxCode: 'txcd_99999999',
  },
  'hy-20l-rf': {
    name: 'HY-20L - RF (13.56 MHz) Plasma Processing System',
    price: 14999,
    imagePath: '/assets/images/redesign/products/hy-20l-standardized.webp',
    taxCode: 'txcd_99999999',
  },
  'hy-20l-mf': {
    name: 'HY-20L - Mid-Frequency (40 kHz) Plasma Processing System',
    price: 11999,
    imagePath: '/assets/images/redesign/products/hy-20l-standardized.webp',
    taxCode: 'txcd_99999999',
  },
  'hy-20lrf': {
    name: 'HY-20LRF - RF (13.56 MHz) Batch Plasma Cleaner',
    price: 14499,
    imagePath: '/assets/images/redesign/products/hy-20lrf-standardized.webp',
    taxCode: 'txcd_99999999',
  },
  'pluto-t': {
    name: 'PLUTO-T - 200W RF Plasma Cleaner',
    price: 9999,
    imagePath: '/assets/images/redesign/products/pluto-t-standardized.webp',
    taxCode: 'txcd_99999999',
  },
  'pluto-m': {
    name: 'PLUTO-M - 200W RF Plasma Cleaner with 8L Chamber',
    price: 12999,
    imagePath: '/assets/images/redesign/products/pluto-m-standardized.webp',
    taxCode: 'txcd_99999999',
  },
  'pluto-f': {
    name: 'PLUTO-F - 500W RF Flagship Plasma Cleaner',
    price: 15999,
    imagePath: '/assets/images/redesign/products/pluto-f-standardized.webp',
    taxCode: 'txcd_99999999',
  },
};
