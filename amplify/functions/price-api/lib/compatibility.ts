/** The four compatibility rule kinds (spec). Deliberately NOT a rule engine. */

export interface ConfigItem {
  sku: string;
  kind: 'MACHINE' | 'OPTION' | 'CONSUMABLE' | 'SERVICE';
  requiredOptionSkus: string[]; // meaningful on MACHINE items
  requiresSkus: string[];
  excludesSkus: string[];
  maxQuantity?: number;
}

export interface Selection {
  item: ConfigItem;
  qty: number;
}

/** Returns human-readable error strings; empty array = valid. */
export function validateConfiguration(selections: Selection[]): string[] {
  const errors: string[] = [];
  const skus = new Set(selections.map((s) => s.item.sku));

  for (const { item, qty } of selections) {
    if (item.kind === 'MACHINE') {
      for (const req of item.requiredOptionSkus) {
        if (!skus.has(req)) errors.push(`${item.sku} requires option ${req} (required option)`);
      }
    }
    for (const req of item.requiresSkus) {
      if (!skus.has(req)) errors.push(`${item.sku} depends on ${req}, which is not selected`);
    }
    for (const ex of item.excludesSkus) {
      if (skus.has(ex)) errors.push(`${item.sku} is mutually exclusive with ${ex}`);
    }
    if (item.maxQuantity != null && qty > item.maxQuantity) {
      errors.push(`${item.sku} quantity ${qty} exceeds limit ${item.maxQuantity}`);
    }
  }
  return errors;
}
