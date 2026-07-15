import { requireAdmin, type PriceApiEvent } from './lib/adminAuth.js';
import { pbListSuppliers, pbCreateSupplier, pbUpdateSupplier } from './resolvers/supplierResolvers.js';
import { pbListCatalogItems, pbCreateCatalogItem, pbUpdateCatalogItem } from './resolvers/catalogResolvers.js';
import { pbAppendCostVersion, pbListCostVersions } from './resolvers/costVersionResolvers.js';
import { pbGetPricingPolicy, pbUpdatePricingPolicy } from './resolvers/policyResolvers.js';
import {
  pbCreateQuotationDraft, pbUpdateQuotationDraft, pbGetQuotation, pbListQuotations,
} from './resolvers/quotationResolvers.js';
import {
  pbListHistoricalQuotations, pbGetHistoricalQuotation,
  pbImportHistoricalQuotations, pbRollbackHistoricalQuotationImport,
} from './resolvers/historicalQuotationResolvers.js';

// AppSync invocation shape: `info` is present on direct resolver events;
// Amplify Gen 2 a.handler.function() sends fieldName/typeName at the top level.
interface RawEvent {
  info?: { fieldName?: string; parentTypeName?: string };
  fieldName?: string;
  typeName?: string;
  arguments?: unknown;
  identity?: unknown;
  [key: string]: unknown;
}

// Each resolver declares its own concrete event type; `never` keeps the map
// assignable from all of them (function params are contravariant).
const resolvers: Record<string, (event: never) => Promise<unknown>> = {
  pbListSuppliers, pbCreateSupplier, pbUpdateSupplier,
  pbListCatalogItems, pbCreateCatalogItem, pbUpdateCatalogItem,
  pbAppendCostVersion, pbListCostVersions,
  pbGetPricingPolicy, pbUpdatePricingPolicy,
  pbCreateQuotationDraft, pbUpdateQuotationDraft, pbGetQuotation, pbListQuotations,
  pbListHistoricalQuotations, pbGetHistoricalQuotation,
  pbImportHistoricalQuotations, pbRollbackHistoricalQuotationImport,
};

/** Exported for the gate-coverage test: the REAL dispatch surface. */
export const RESOLVER_FIELDS = Object.keys(resolvers);

export const handler = async (event: RawEvent) => {
  const fieldName = event.info?.fieldName ?? event.fieldName;
  if (!fieldName) {
    console.error('price-api: full event:', JSON.stringify(event));
    throw new Error(`Cannot determine fieldName. Event keys: ${Object.keys(event).join(', ')}`);
  }

  const normalized = (event.info
    ? event
    : { ...event, info: { fieldName, parentTypeName: event.typeName }, arguments: event.arguments }
  ) as unknown as PriceApiEvent;

  // Trust boundary: EVERY price-api operation is admin-gated (spec). No
  // per-resolver opt-out — the gate lives here, before the resolver lookup,
  // so a non-admin caller cannot even probe which field names exist.
  requireAdmin(normalized);

  const resolver = resolvers[fieldName];
  if (!resolver) throw new Error(`No resolver for field: ${fieldName}`);

  return resolver(normalized as never);
};
