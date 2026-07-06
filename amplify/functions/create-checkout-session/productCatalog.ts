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
    imagePath: '/assets/images/products/ns-plasma-4r/main.jpg',
    taxCode: 'txcd_99999999',
  },
  'hy-4l-mf': {
    name: 'HY-4L - Mid-Frequency (40 kHz) Plasma Cleaner',
    price: 6499,
    imagePath: '/assets/images/products/ns-plasma-4r/main.jpg',
    taxCode: 'txcd_99999999',
  },
};
