import { createHash } from 'node:crypto';

export type DataQualityFlag = 'INCOMPLETE' | 'UNCONFIRMED' | 'CONFLICT_RESOLVED';
export type HistoricalFxProvenance = 'CONFIRMED' | 'INFERRED' | 'UNKNOWN';
export const MAX_IMPORT_ROWS = 50;

export interface HistoricalQuotationInput {
  customerName: string;
  productName: string;
  configuration: string;
  supplierId: string;
  supplierQuoteText: string;
  supplierQuoteBasis: string;
  supplierEvidenceType: string;
  supplierQuotedAt: string | null;
  customerQuoteText: string;
  sourceQuotationNumber: string | null;
  quotedAt: string | null;
  legacyStatus: string;
  supplierAmountFen?: number | null;
  customerAmountUsdCents?: number | null;
  historicalFxRate: string | null;
  historicalFxSource: string | null;
  historicalFxProvenance: HistoricalFxProvenance;
  historicalFxNote: string | null;
  sourceDocument: string;
  sourceDocumentHash: string;
  sourceRow: number;
  importBatchId: string;
  dataQualityFlags: DataQualityFlag[];
  dataQualityNotes: string[];
}

export interface HistoricalQuotationRecord extends HistoricalQuotationInput {
  PK: string;
  SK: 'META';
  GSI1PK: 'HISTORICAL_QUOTATIONS';
  GSI1SK: string;
  recordType: 'HISTORICAL_QUOTATION';
  status: 'HISTORICAL';
  historicalId: string;
  contentHash: string;
  importedAt: string;
  importedBy: string;
}

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

export function historicalIdFor(sourceDocument: string, sourceRow: number): string {
  return sha256(`${sourceDocument}\x1f${sourceRow}`);
}

export function canonicalizeDataQualityFlags(flags: readonly DataQualityFlag[]): DataQualityFlag[] {
  return [...new Set(flags)].sort();
}

function contentTuple(input: HistoricalQuotationInput): readonly unknown[] {
  return [
    input.customerName,
    input.productName,
    input.configuration,
    input.supplierId,
    input.supplierQuoteText,
    input.supplierQuoteBasis,
    input.supplierEvidenceType,
    input.supplierQuotedAt,
    input.customerQuoteText,
    input.sourceQuotationNumber,
    input.quotedAt,
    input.legacyStatus,
    input.supplierAmountFen ?? null,
    input.customerAmountUsdCents ?? null,
    input.historicalFxRate,
    input.historicalFxSource,
    input.historicalFxProvenance,
    input.historicalFxNote,
    canonicalizeDataQualityFlags(input.dataQualityFlags),
    input.dataQualityNotes,
  ];
}

export function contentHashFor(input: HistoricalQuotationInput): string {
  return sha256(JSON.stringify(contentTuple(input)));
}

export function validateHistoricalQuotationInput(input: HistoricalQuotationInput): string[] {
  const errors: string[] = [];
  for (const field of ['customerName', 'productName', 'supplierQuoteText', 'customerQuoteText'] as const) {
    if (typeof input[field] !== 'string' || input[field].trim() === '') errors.push(`${field} is required`);
  }
  for (const field of ['supplierAmountFen', 'customerAmountUsdCents'] as const) {
    const value = input[field];
    if (value != null && (!Number.isSafeInteger(value) || value < 0)) {
      errors.push(`${field} must be a non-negative integer`);
    }
  }
  const allowedFlags: readonly string[] = ['INCOMPLETE', 'UNCONFIRMED', 'CONFLICT_RESOLVED'];
  if (input.dataQualityFlags.some(flag => !allowedFlags.includes(flag))) {
    errors.push('dataQualityFlags contains an invalid flag');
  }
  const allowedFxProvenance: readonly string[] = ['CONFIRMED', 'INFERRED', 'UNKNOWN'];
  if (!allowedFxProvenance.includes(input.historicalFxProvenance)) {
    errors.push('historicalFxProvenance is invalid');
  }
  if (input.historicalFxProvenance === 'UNKNOWN'
      && (input.historicalFxRate !== null || input.historicalFxSource !== null)) {
    errors.push('UNKNOWN FX requires null rate and source');
  }
  return errors;
}

export function buildHistoricalRecord(
  input: HistoricalQuotationInput,
  importedBy: string,
  importedAt: string,
): HistoricalQuotationRecord {
  const historicalId = historicalIdFor(input.sourceDocument, input.sourceRow);
  return {
    ...input,
    dataQualityFlags: canonicalizeDataQualityFlags(input.dataQualityFlags),
    PK: `PHIST#${historicalId}`,
    SK: 'META',
    GSI1PK: 'HISTORICAL_QUOTATIONS',
    GSI1SK: `${input.quotedAt ?? input.supplierQuotedAt ?? '0000-00-00'}#${historicalId}`,
    recordType: 'HISTORICAL_QUOTATION',
    status: 'HISTORICAL',
    historicalId,
    contentHash: contentHashFor(input),
    importedBy,
    importedAt,
  };
}

export interface RollbackRecordIdentity {
  historicalId: string;
  contentHash: string;
}

export function rollbackTokenFor(importBatchId: string, records: readonly RollbackRecordIdentity[]): string {
  const ids = records.map(record => record.historicalId).sort();
  const hashes = records.map(record => record.contentHash).sort();
  return sha256(`${importBatchId}\x1f${ids.join('\x1f')}\x1f${hashes.join('\x1f')}`);
}
