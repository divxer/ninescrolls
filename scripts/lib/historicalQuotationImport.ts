import { createHash } from 'node:crypto';
import type { HistoricalQuotationInput } from '../../amplify/functions/price-api/lib/historicalQuotation';

export interface SupplierIdentity { supplierId: string; name: string }
export interface PredictedHistoricalQuotation extends HistoricalQuotationInput {
  historicalId: string;
  contentHash: string;
}
export interface NormalizedHistoricalQuotations {
  importBatchId: string;
  sourceDocument: string;
  sourceDocumentHash: string;
  rows: PredictedHistoricalQuotation[];
}

const sha256 = (value: Buffer | string): string => createHash('sha256').update(value).digest('hex');

export const sourceDocumentHashFor = (bytes: Buffer): string => sha256(bytes);

export function importBatchIdFor(bytes: Buffer): string {
  return `HB-${sha256(sourceDocumentHashFor(bytes)).slice(0, 16)}`;
}

export function resolveSupplierId(suppliers: readonly SupplierIdentity[], exactName: string): string {
  const matches = suppliers.filter(supplier => supplier.name === exactName);
  if (matches.length !== 1) {
    throw new Error(`Supplier resolution found ${matches.length} exact matches; expected exactly 1`);
  }
  return matches[0].supplierId;
}

function sortObject(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortObject);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, sortObject(child)]));
  }
  return value;
}

export function serializeHistoricalQuotations(value: NormalizedHistoricalQuotations): string {
  const stable = { ...value, rows: [...value.rows].sort((a, b) => a.sourceRow - b.sourceRow) };
  return `${JSON.stringify(sortObject(stable), null, 2)}\n`;
}

function requireString(object: Record<string, unknown>, key: string): string {
  if (typeof object[key] !== 'string' || object[key] === '') throw new Error(`${key} must be a non-empty string`);
  return object[key];
}

export function parseNormalizedHistoricalQuotations(json: string): NormalizedHistoricalQuotations {
  const value: unknown = JSON.parse(json);
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('Normalized file must be an object');
  const object = value as Record<string, unknown>;
  const allowed = ['importBatchId', 'rows', 'sourceDocument', 'sourceDocumentHash'];
  const extra = Object.keys(object).filter(key => !allowed.includes(key));
  if (extra.length) throw new Error(`Unexpected normalized fields: ${extra.join(', ')}`);
  if (!Array.isArray(object.rows)) throw new Error('rows must be an array');
  const rows = object.rows as PredictedHistoricalQuotation[];
  for (const [index, row] of rows.entries()) {
    if (!row || typeof row !== 'object' || !Number.isSafeInteger(row.sourceRow) || row.sourceRow < 1) {
      throw new Error(`rows[${index}].sourceRow must be a positive integer`);
    }
    if (!Array.isArray(row.dataQualityFlags) || !Array.isArray(row.dataQualityNotes)) {
      throw new Error(`rows[${index}] requires data-quality arrays`);
    }
  }
  return {
    importBatchId: requireString(object, 'importBatchId'),
    sourceDocument: requireString(object, 'sourceDocument'),
    sourceDocumentHash: requireString(object, 'sourceDocumentHash'),
    rows,
  };
}
