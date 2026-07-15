import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { RESOLVER_FIELDS } from '../handler.js';

// This list is deliberately tied to the real dispatch map below. Adding a new
// mutation is a test failure until its key construction has been classified.
const MUTATION_PREFIXES = {
  pbCreateQuotationDraft: 'PQUO#',
  pbUpdateQuotationDraft: 'PQUO#',
  pbCreateSupplier: 'PSUP#',
  pbUpdateSupplier: 'PSUP#',
  pbCreateCatalogItem: 'PCAT#',
  pbUpdateCatalogItem: 'PCAT#',
  pbAppendCostVersion: 'PCAT#',
  pbUpdatePricingPolicy: 'PRICING_POLICY',
} as const;

const mutationName = /^pb(?:Create|Update|Append)/;
const adversarialIds = ['PHIST#x', 'HISTIMPORT#x', '../PHIST#x', 'x#PHIST#y'];

describe('price mutation keyspace immutability', () => {
  it('covers every existing mutation in the real dispatch map (future additions fail closed)', () => {
    expect(RESOLVER_FIELDS.filter(field => mutationName.test(field)).sort())
      .toEqual(Object.keys(MUTATION_PREFIXES).sort());
  });

  it.each(Object.entries(MUTATION_PREFIXES))('%s constructs only its owned key prefix', (resolver, prefix) => {
    const moduleName = resolver.includes('Supplier') ? 'supplierResolvers.ts'
      : resolver.includes('Catalog') ? 'catalogResolvers.ts'
        : resolver.includes('CostVersion') ? 'costVersionResolvers.ts'
          : resolver.includes('PricingPolicy') ? 'policyResolvers.ts' : 'quotationResolvers.ts';
    const source = readFileSync(fileURLToPath(new URL(moduleName, import.meta.url)), 'utf8');
    const start = source.indexOf(`function ${resolver}`);
    expect(start).toBeGreaterThan(-1);
    const next = source.indexOf('\nexport async function ', start + 1);
    const body = source.slice(start, next < 0 ? undefined : next);
    expect(body).not.toContain('`PHIST#${');
    expect(body).not.toContain('`HISTIMPORT#${');
    if (prefix === 'PRICING_POLICY') expect(body).toContain('Key: KEY');
    else expect(source).toContain(prefix);
    for (const id of adversarialIds) {
      expect(`${prefix}${id}`).not.toMatch(/^(?:PHIST|HISTIMPORT)#/);
    }
  });
});
