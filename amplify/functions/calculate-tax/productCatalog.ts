export interface TaxProductCatalogItem {
  name: string;
  price: number;
  taxCode?: string;
}

export const taxProductCatalog: Record<string, TaxProductCatalogItem> = {
  'pluto-t': {
    name: 'PLUTO-T - 200W RF Plasma Cleaner',
    price: 9999,
    taxCode: 'txcd_99999999',
  },
  'pluto-m': {
    name: 'PLUTO-M - 200W RF Plasma Cleaner with 8L Chamber',
    price: 12999,
    taxCode: 'txcd_99999999',
  },
  'pluto-f': {
    name: 'PLUTO-F - 500W RF Flagship Plasma Cleaner',
    price: 15999,
    taxCode: 'txcd_99999999',
  },
};
