import type { PriceApiEvent } from './adminAuth.js';
import type { ConfigItem } from './compatibility.js';

export type { PriceApiEvent };

/** Parses input that AppSync may deliver as a JSON string or an object. */
export function parseInput<T>(event: PriceApiEvent): T {
  const raw = (event.arguments as { input?: unknown }).input;
  if (raw == null) throw new Error('VALIDATION: input is required');
  return (typeof raw === 'string' ? JSON.parse(raw) : raw) as T;
}

export function getOperator(event: PriceApiEvent): string {
  const id = event.identity;
  return (id?.claims?.email as string) || id?.username || id?.sub || 'admin';
}

export interface SupplierItem {
  PK: string; SK: 'META';
  GSI1PK: 'SUPPLIERS'; GSI1SK: string;
  supplierId: string;
  name: string;
  contact?: string;
  currency: 'RMB';
  defaultValidityDays: number;
  status: 'ACTIVE' | 'SUSPENDED';
  notes?: string;
  createdAt: string; updatedAt: string;
}

export interface CatalogItemItem extends ConfigItem {
  PK: string; SK: 'META';
  GSI1PK: 'CATALOG_ITEMS'; GSI1SK: string;
  itemId: string;
  name: string;
  series: string;
  specs?: Record<string, string>;
  createdAt: string; updatedAt: string;
}

export interface CostVersionItem {
  PK: string; SK: string;              // COST#{supplierId}#{effectiveFrom}
  itemId: string;
  supplierId: string;
  unitCostFen: number;
  currency: 'RMB';
  effectiveFrom: string;               // ISO date (inclusive)
  effectiveTo: string;                 // ISO date (exclusive)
  priceSource: 'MANUAL_ENTRY' | 'SUPPLIER_EXCEL' | 'SUPPLIER_LINK';
  reviewStatus: 'APPROVED';            // P1 writes APPROVED unconditionally (spec)
  createdAt: string; createdBy: string;
}

/** Strip DDB key attributes for GraphQL responses. */
export function stripKeys<T extends { PK: string; SK: string }>(item: T) {
  const { PK, SK, ...rest } = item as T & { GSI1PK?: string; GSI1SK?: string };
  delete (rest as Record<string, unknown>).GSI1PK;
  delete (rest as Record<string, unknown>).GSI1SK;
  return rest;
}
