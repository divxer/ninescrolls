export interface CheckoutProductCatalogItem {
  name: string;
  price: number;
  imagePath?: string;
  taxCode?: string;
  priceId?: string;
}

export const checkoutProductCatalog: Record<string, CheckoutProductCatalogItem> = {
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
