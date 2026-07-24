import type { CartItem } from './CartContext';

// Model prefixes for products that have been delisted and removed from the
// Stripe checkout catalog. A saved cart from before delisting would otherwise
// restore these items and let a returning visitor reach checkout, only to hit
// a server-side "Unknown product" error. Prune them the moment the cart loads.
const DELISTED_SKU_PREFIXES = ['hy-4l', 'hy-20l'];

function isDelistedItem(item: CartItem): boolean {
  const keys = [item.sku, item.id].filter((v): v is string => typeof v === 'string');
  return keys.some((key) =>
    DELISTED_SKU_PREFIXES.some((prefix) => key.toLowerCase().startsWith(prefix))
  );
}

export function pruneDelistedItems(items: CartItem[]): CartItem[] {
  return items.filter((item) => !isDelistedItem(item));
}
