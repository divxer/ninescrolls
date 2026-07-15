import { describe, expect, it } from 'vitest';
import {
  buildHistoricalRecord,
  contentHashFor,
  historicalIdFor,
  rollbackTokenFor,
  validateHistoricalQuotationInput,
  type HistoricalQuotationInput,
} from './historicalQuotation.js';

const row: HistoricalQuotationInput = {
  customerName: 'Customer A',
  productName: 'Product A',
  configuration: 'Standard',
  supplierId: 'SUP-001',
  supplierQuoteText: 'source supplier text',
  supplierQuoteBasis: 'per unit',
  supplierEvidenceType: 'written',
  supplierQuotedAt: '2025-03-01',
  customerQuoteText: 'source customer text',
  sourceQuotationNumber: 'Q-001',
  quotedAt: '2025-03-03',
  legacyStatus: 'completed',
  supplierAmountFen: 12345,
  customerAmountUsdCents: 23456,
  historicalFxRate: '7.1234',
  historicalFxSource: 'source record',
  historicalFxProvenance: 'CONFIRMED',
  historicalFxNote: 'explicitly recorded',
  sourceDocument: 'book.xlsx',
  sourceDocumentHash: 'a'.repeat(64),
  sourceRow: 12,
  importBatchId: 'HB-abc123',
  dataQualityFlags: ['UNCONFIRMED'],
  dataQualityNotes: ['review note'],
};

describe('historical identity and record keys', () => {
  it('uses delimited, deterministic, full-length identity hashes', () => {
    expect(historicalIdFor('book.xlsx', 12)).not.toBe(historicalIdFor('book.xlsx1', 2));
    expect(historicalIdFor('book.xlsx', 12)).toBe(historicalIdFor('book.xlsx', 12));
    expect(historicalIdFor('book.xlsx', 12)).toMatch(/^[a-f0-9]{64}$/);
  });

  it('keeps identity independent of content and builds fixed keys', () => {
    const actor = 'operator@example.test';
    const now = '2025-03-04T00:00:00.000Z';
    const record = buildHistoricalRecord(row, actor, now);
    expect(record).toMatchObject({
      PK: `PHIST#${historicalIdFor(row.sourceDocument, row.sourceRow)}`,
      SK: 'META', GSI1PK: 'HISTORICAL_QUOTATIONS',
      GSI1SK: `2025-03-03#${historicalIdFor(row.sourceDocument, row.sourceRow)}`,
      recordType: 'HISTORICAL_QUOTATION', status: 'HISTORICAL',
      importedBy: actor, importedAt: now,
    });
    expect(buildHistoricalRecord({ ...row, customerName: 'Customer B' }, actor, now).historicalId)
      .toBe(record.historicalId);
    expect(record.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('uses supplier date then the null-date sentinel for sort keys', () => {
    const id = historicalIdFor(row.sourceDocument, row.sourceRow);
    expect(buildHistoricalRecord({ ...row, quotedAt: null, supplierQuotedAt: '2025-03-02' }, 'actor', 'now').GSI1SK)
      .toBe(`2025-03-02#${id}`);
    expect(buildHistoricalRecord({ ...row, quotedAt: null, supplierQuotedAt: null }, 'actor', 'now').GSI1SK)
      .toMatch(/^0000-00-00#/);
  });
});

describe('content hashing', () => {
  const contentMutations: Array<[string, Partial<HistoricalQuotationInput>]> = [
    ['customerName', { customerName: 'Customer B' }],
    ['productName', { productName: 'Product B' }],
    ['configuration', { configuration: 'Alternate' }],
    ['supplierId', { supplierId: 'SUP-002' }],
    ['supplierQuoteText', { supplierQuoteText: 'changed supplier text' }],
    ['supplierQuoteBasis', { supplierQuoteBasis: 'lot' }],
    ['supplierEvidenceType', { supplierEvidenceType: 'oral' }],
    ['supplierQuotedAt', { supplierQuotedAt: null }],
    ['customerQuoteText', { customerQuoteText: 'changed customer text' }],
    ['sourceQuotationNumber', { sourceQuotationNumber: null }],
    ['quotedAt', { quotedAt: null }],
    ['legacyStatus', { legacyStatus: 'open' }],
    ['supplierAmountFen', { supplierAmountFen: 12346 }],
    ['customerAmountUsdCents', { customerAmountUsdCents: 23457 }],
    ['historicalFxRate', { historicalFxRate: '7.2345' }],
    ['historicalFxSource', { historicalFxSource: 'other source' }],
    ['historicalFxProvenance', { historicalFxProvenance: 'INFERRED' }],
    ['historicalFxNote', { historicalFxNote: null }],
    ['dataQualityFlags', { dataQualityFlags: ['INCOMPLETE'] }],
    ['dataQualityNotes', { dataQualityNotes: ['changed note'] }],
  ];

  it.each(contentMutations)('changes when %s changes', (_field, mutation) => {
    expect(contentHashFor({ ...row, ...mutation })).not.toBe(contentHashFor(row));
  });

  it.each([
    ['sourceDocument', { sourceDocument: 'other.xlsx' }],
    ['sourceDocumentHash', { sourceDocumentHash: 'b'.repeat(64) }],
    ['sourceRow', { sourceRow: 13 }],
    ['importBatchId', { importBatchId: 'HB-other' }],
  ] as Array<[string, Partial<HistoricalQuotationInput>]>)('excludes lineage field %s', (_field, mutation) => {
    expect(contentHashFor({ ...row, ...mutation })).toBe(contentHashFor(row));
  });

  it('excludes stamped lineage and canonicalizes flags as a set', () => {
    const record = buildHistoricalRecord(row, 'actor-a', 'time-a');
    const other = buildHistoricalRecord(row, 'actor-b', 'time-b');
    expect(other.contentHash).toBe(record.contentHash);
    expect(contentHashFor({ ...row, dataQualityFlags: ['UNCONFIRMED', 'INCOMPLETE'] }))
      .toBe(contentHashFor({ ...row, dataQualityFlags: ['INCOMPLETE', 'UNCONFIRMED', 'INCOMPLETE'] }));
  });
});

describe('validation', () => {
  it('requires source quote text and valid non-negative integer money', () => {
    expect(validateHistoricalQuotationInput({ ...row, supplierQuoteText: '' })).toContain('supplierQuoteText is required');
    expect(validateHistoricalQuotationInput({ ...row, customerQuoteText: '  ' })).toContain('customerQuoteText is required');
    expect(validateHistoricalQuotationInput({ ...row, supplierAmountFen: -1 })).toContain('supplierAmountFen must be a non-negative integer');
    expect(validateHistoricalQuotationInput({ ...row, supplierAmountFen: 1.5 })).toContain('supplierAmountFen must be a non-negative integer');
    expect('supplierCurrency' in buildHistoricalRecord(row, 'actor', 'now')).toBe(false);
  });

  it('allows composable flags', () => {
    expect(validateHistoricalQuotationInput({ ...row, dataQualityFlags: ['INCOMPLETE', 'UNCONFIRMED'] })).toEqual([]);
  });

  it('preserves INFERRED provenance and enforces UNKNOWN nulls', () => {
    expect(buildHistoricalRecord({ ...row, historicalFxProvenance: 'INFERRED' }, 'actor', 'now').historicalFxProvenance)
      .toBe('INFERRED');
    expect(validateHistoricalQuotationInput({ ...row, historicalFxProvenance: 'UNKNOWN', historicalFxRate: '7.0', historicalFxSource: null, historicalFxNote: null }))
      .toContain('UNKNOWN FX requires null rate, source, and note');
    expect(validateHistoricalQuotationInput({ ...row, historicalFxProvenance: 'UNKNOWN', historicalFxRate: null, historicalFxSource: null, historicalFxNote: null }))
      .toEqual([]);
  });
});

describe('rollback tokens', () => {
  it('is stable under input order and changes for any id/hash membership or replacement', () => {
    const pairs = [{ historicalId: 'id-a', contentHash: 'hash-a' }, { historicalId: 'id-b', contentHash: 'hash-b' }];
    const baseline = rollbackTokenFor('batch', pairs);
    expect(rollbackTokenFor('batch', [...pairs].reverse())).toBe(baseline);
    expect(baseline).toMatch(/^[a-f0-9]{64}$/);
    expect(rollbackTokenFor('batch', pairs.slice(0, 1))).not.toBe(baseline);
    expect(rollbackTokenFor('batch', [...pairs, { historicalId: 'id-c', contentHash: 'hash-c' }])).not.toBe(baseline);
    expect(rollbackTokenFor('batch', [{ ...pairs[0], historicalId: 'id-z' }, pairs[1]])).not.toBe(baseline);
    expect(rollbackTokenFor('batch', [{ ...pairs[0], contentHash: 'hash-z' }, pairs[1]])).not.toBe(baseline);
  });
});
