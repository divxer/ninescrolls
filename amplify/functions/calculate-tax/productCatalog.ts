export interface TaxProductCatalogItem {
  name: string;
  price: number;
  taxCode?: string;
}

export const taxProductCatalog: Record<string, TaxProductCatalogItem> = {
  'hy-4l-rf': {
    name: 'HY-4L - RF (13.56 MHz) Plasma Cleaner',
    price: 7999,
    taxCode: 'txcd_99999999',
  },
  'hy-4l-mf': {
    name: 'HY-4L - Mid-Frequency (40 kHz) Plasma Cleaner',
    price: 6499,
    taxCode: 'txcd_99999999',
  },
};
