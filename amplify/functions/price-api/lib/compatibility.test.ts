import { describe, it, expect } from 'vitest';
import { validateConfiguration, type ConfigItem, type Selection } from './compatibility.js';

const machine: ConfigItem = {
  sku: 'RIE-300', kind: 'MACHINE', requiredOptionSkus: ['CHILLER'], requiresSkus: [], excludesSkus: [], maxQuantity: 1,
};
const item = (sku: string, over: Partial<ConfigItem> = {}): ConfigItem =>
  ({ sku, kind: 'OPTION', requiredOptionSkus: [], requiresSkus: [], excludesSkus: [], ...over });

const sel = (i: ConfigItem, qty = 1): Selection => ({ item: i, qty });

describe('validateConfiguration', () => {
  it('passes a complete valid configuration', () => {
    expect(validateConfiguration([sel(machine), sel(item('CHILLER'))])).toEqual([]);
  });

  it('flags a missing required option', () => {
    const errs = validateConfiguration([sel(machine)]);
    expect(errs).toEqual([expect.stringContaining('CHILLER')]);
  });

  it('flags mutual exclusion (either side declares it)', () => {
    const a = item('A', { excludesSkus: ['B'] });
    const errs = validateConfiguration([sel(machine), sel(item('CHILLER')), sel(a), sel(item('B'))]);
    expect(errs.some((e) => e.includes('A') && e.includes('B'))).toBe(true);
  });

  it('flags an unmet dependency', () => {
    const a = item('A', { requiresSkus: ['PUMP-XL'] });
    const errs = validateConfiguration([sel(machine), sel(item('CHILLER')), sel(a)]);
    expect(errs.some((e) => e.includes('PUMP-XL'))).toBe(true);
  });

  it('flags quantity over the limit', () => {
    const a = item('A', { maxQuantity: 2 });
    const errs = validateConfiguration([sel(machine), sel(item('CHILLER')), sel(a, 3)]);
    expect(errs.some((e) => e.includes('quantity'))).toBe(true);
  });
});
