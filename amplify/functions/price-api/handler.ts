import { requireAdmin, type PriceApiEvent } from './lib/adminAuth.js';
import { pbListSuppliers, pbCreateSupplier, pbUpdateSupplier } from './resolvers/supplierResolvers.js';
import { pbListCatalogItems, pbCreateCatalogItem, pbUpdateCatalogItem } from './resolvers/catalogResolvers.js';
import { pbAppendCostVersion, pbListCostVersions } from './resolvers/costVersionResolvers.js';
import { pbGetPricingPolicy, pbUpdatePricingPolicy } from './resolvers/policyResolvers.js';
import {
  pbCreateQuotationDraft, pbUpdateQuotationDraft, pbGetQuotation, pbListQuotations,
} from './resolvers/quotationResolvers.js';

interface RawEvent {
  info?: { fieldName?: string; parentTypeName?: string };
  fieldName?: string;
  typeName?: string;
  arguments?: unknown;
  identity?: unknown;
  [key: string]: unknown;
}

const resolvers: Record<string, (event: never) => Promise<unknown>> = {
  pbListSuppliers, pbCreateSupplier, pbUpdateSupplier,
  pbListCatalogItems, pbCreateCatalogItem, pbUpdateCatalogItem,
  pbAppendCostVersion, pbListCostVersions,
  pbGetPricingPolicy, pbUpdatePricingPolicy,
  pbCreateQuotationDraft, pbUpdateQuotationDraft, pbGetQuotation, pbListQuotations,
};

export const handler = async (event: RawEvent) => {
  const fieldName = event.info?.fieldName ?? event.fieldName;
  if (!fieldName) {
    console.error('price-api: full event:', JSON.stringify(event));
    throw new Error(`Cannot determine fieldName. Event keys: ${Object.keys(event).join(', ')}`);
  }
  const resolver = resolvers[fieldName];
  if (!resolver) throw new Error(`No resolver for field: ${fieldName}`);

  const normalized = (event.info
    ? event
    : { ...event, info: { fieldName, parentTypeName: event.typeName }, arguments: event.arguments }
  ) as unknown as PriceApiEvent;

  // Trust boundary: EVERY price-api operation is admin-gated (spec). No
  // per-resolver opt-out — the gate lives here, before any dispatch.
  requireAdmin(normalized);

  return resolver(normalized as never);
};
