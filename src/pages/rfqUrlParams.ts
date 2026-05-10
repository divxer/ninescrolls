const MAX_PRODUCTS = 5;

export interface ParsedRfqUrlParams {
  productsList: string[];      // first up to 5 product slugs from ?products= (or empty)
  urlProduct: string;          // primary product to prefill specificModel: products[0] || ?product= || ''
  urlCategory: string;         // ?category= (legacy passthrough)
  referrerSource: string;      // ?source= (e.g. "insights/<slug>") or ''
  via: string;                 // ?via= (e.g. "ask-checkbox") or ''
  productListText: string;     // formatted list block for additionalComments when 2+ products, else ''
}

export function parseRfqUrlParams(search: string): ParsedRfqUrlParams {
  const params = new URLSearchParams(search);
  const productsParam = params.get('products');
  const productsList = productsParam
    ? productsParam.split(',').map((s) => s.trim()).filter(Boolean).slice(0, MAX_PRODUCTS)
    : [];
  const legacyProduct = params.get('product') || '';
  const urlProduct = productsList[0] || legacyProduct;
  const urlCategory = params.get('category') || '';
  const referrerSource = params.get('source') || '';
  const via = params.get('via') || '';
  const productListText =
    productsList.length >= 2
      ? `Products of interest:\n${productsList.map((p) => `- ${p}`).join('\n')}\n\n[Please describe your application requirements below]\n\n`
      : '';
  return { productsList, urlProduct, urlCategory, referrerSource, via, productListText };
}
