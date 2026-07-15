import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  importBatchIdFor,
  parseNormalizedHistoricalQuotations,
  resolveSupplierId,
  serializeHistoricalQuotations,
  sourceDocumentHashFor,
} from './historicalQuotationImport';
import {
  contentHashFor,
  historicalIdFor,
  type HistoricalQuotationInput,
} from '../../amplify/functions/price-api/lib/historicalQuotation';

const contentFixture: HistoricalQuotationInput = {
  customerName: 'Acme Lab', productName: 'Fixture Tool', configuration: 'Base',
  supplierId: 'sup-fixture', supplierQuoteText: 'RMB quote', supplierQuoteBasis: 'written',
  supplierEvidenceType: 'WRITTEN', supplierQuotedAt: '2025-01-01', customerQuoteText: 'USD quote',
  sourceQuotationNumber: 'Q-1', quotedAt: '2025-01-02', legacyStatus: 'sent',
  supplierAmountFen: 12345, customerAmountUsdCents: 67890, historicalFxRate: '7.0000',
  historicalFxSource: 'Fixture FX', historicalFxProvenance: 'INFERRED',
  historicalFxNote: 'Derived from source amounts', sourceDocument: 'book.xlsx',
  sourceDocumentHash: 'a'.repeat(64), sourceRow: 12, importBatchId: 'HB-fixture',
  dataQualityFlags: ['UNCONFIRMED'], dataQualityNotes: ['Fixture note'],
};

describe('historical quotation normalization helpers', () => {
  it('freezes persistence-format known-answer vectors', () => {
    expect(historicalIdFor('book.xlsx', 12)).toBe(
      'fa45627efad19b4d61f2ca11a83df3915c2c6f9a1d369ce3bc9d97ae3eefd8e7',
    );
    expect(importBatchIdFor(Buffer.from('probe'))).toBe('HB-f3978f5542584999');
    expect(contentHashFor(contentFixture)).toBe(
      '7c069195a5019edb14290df6b77c9520d3baf223f7d99f9e429963e2794141a3',
    );
  });

  it('derives a stable batch id from a hash of the source hash', () => {
    const bytes = Buffer.from('synthetic workbook bytes');
    expect(importBatchIdFor(bytes)).toMatch(/^HB-[a-f0-9]{16}$/);
    expect(importBatchIdFor(bytes)).toBe(importBatchIdFor(Buffer.from(bytes)));
    expect(importBatchIdFor(Buffer.concat([bytes, Buffer.from('x')]))).not.toBe(importBatchIdFor(bytes));
    expect(sourceDocumentHashFor(bytes)).toMatch(/^[a-f0-9]{64}$/);
  });

  it('requires exactly one exact supplier-name match', () => {
    const supplier = { supplierId: 's1', name: 'Fixture Supplier Co' };
    expect(resolveSupplierId([supplier], supplier.name)).toBe('s1');
    expect(() => resolveSupplierId([], supplier.name)).toThrow(/0 exact matches/);
    expect(() => resolveSupplierId([supplier, { ...supplier, supplierId: 's2' }], supplier.name))
      .toThrow(/2 exact matches/);
    expect(() => resolveSupplierId([supplier], 'fixture supplier co')).toThrow(/0 exact matches/);
  });

  it('parses the synthetic three-row fixture and preserves composed flags', () => {
    const path = resolve(process.cwd(), 'scripts/fixtures/historical-quotations.synthetic.json');
    const parsed = parseNormalizedHistoricalQuotations(readFileSync(path, 'utf8'));
    expect(parsed.rows).toHaveLength(3);
    expect(parsed.rows.find(row => row.quotedAt === null)?.dataQualityFlags).toEqual(['INCOMPLETE', 'UNCONFIRMED']);
    expect(parsed.rows.some(row => row.historicalFxProvenance === 'INFERRED')).toBe(true);
  });

  it('writes sorted rows and properties byte-identically with one trailing newline', () => {
    const path = resolve(process.cwd(), 'scripts/fixtures/historical-quotations.synthetic.json');
    const parsed = parseNormalizedHistoricalQuotations(readFileSync(path, 'utf8'));
    const first = serializeHistoricalQuotations({ ...parsed, rows: [...parsed.rows].reverse() });
    const second = serializeHistoricalQuotations(parseNormalizedHistoricalQuotations(first));
    expect(Buffer.from(first)).toEqual(Buffer.from(second));
    expect(first.endsWith('\n')).toBe(true);
    expect(first.endsWith('\n\n')).toBe(false);
    expect(JSON.parse(first).rows.map((row: { sourceRow: number }) => row.sourceRow)).toEqual([2, 3, 4]);
  });
});
