import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  importBatchIdFor,
  buildNormalizedHistoricalQuotations,
  compareCodeUnits,
  parseNormalizedHistoricalQuotations,
  resolvePhysicalPathOutsideWorktree,
  resolveSupplierId,
  serializeHistoricalQuotations,
  sourceDocumentHashFor,
  withWorkbookSnapshot,
  classifyHistoricalDryRun,
  validateExpectedRows,
  assertProbeResult,
  assertSandboxTarget,
  syntheticSandboxRows,
  MAX_IMPORT_ROWS,
  parseImportArgv,
  parseRollbackArgv,
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

  it('orders canonical keys by code units rather than host locale', () => {
    expect(['ä', 'z', 'a'].sort(compareCodeUnits)).toEqual(['a', 'z', 'ä']);
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
    const fixture = JSON.parse(readFileSync(path, 'utf8'));
    const parsed = buildNormalizedHistoricalQuotations({
      ...fixture.input,
      workbookBytes: Buffer.from(fixture.input.workbookProbe),
    });
    expect(parsed.rows).toHaveLength(3);
    expect(parsed.rows.find(row => row.quotedAt === null)?.dataQualityFlags).toEqual(['INCOMPLETE', 'UNCONFIRMED']);
    expect(parsed.rows.some(row => row.historicalFxProvenance === 'INFERRED')).toBe(true);
  });

  it('writes sorted rows and properties byte-identically with one trailing newline', () => {
    const path = resolve(process.cwd(), 'scripts/fixtures/historical-quotations.synthetic.json');
    const fixture = JSON.parse(readFileSync(path, 'utf8'));
    const parsed = buildNormalizedHistoricalQuotations({
      ...fixture.input,
      workbookBytes: Buffer.from(fixture.input.workbookProbe),
    });
    const first = serializeHistoricalQuotations({ ...parsed, rows: [...parsed.rows].reverse() });
    const second = serializeHistoricalQuotations(parseNormalizedHistoricalQuotations(first));
    expect(Buffer.from(first)).toEqual(Buffer.from(second));
    expect(first.endsWith('\n')).toBe(true);
    expect(first.endsWith('\n\n')).toBe(false);
    expect(JSON.parse(first).rows.map((row: { sourceRow: number }) => row.sourceRow)).toEqual([2, 3, 4]);
    expect(first).toBe(`${JSON.stringify(fixture.expected, null, 2)}\n`);
  });

  it('rejects a symlinked confidential input whose physical target is inside the repo', () => {
    const outside = mkdtempSync(join(tmpdir(), 'hist-path-input-'));
    const inside = resolve(process.cwd(), '.gitignore');
    const link = join(outside, 'archive-link');
    symlinkSync(inside, link);
    expect(() => resolvePhysicalPathOutsideWorktree(link, process.cwd(), 'Workbook', true))
      .toThrow(/physical path.*inside/i);
  });

  it('rejects an output beneath a symlinked directory whose physical target is inside the repo', () => {
    const outside = mkdtempSync(join(tmpdir(), 'hist-path-output-'));
    const insideDirectory = resolve(process.cwd(), 'scripts');
    const link = join(outside, 'output-link');
    symlinkSync(insideDirectory, link, 'dir');
    expect(() => resolvePhysicalPathOutsideWorktree(join(link, 'private', 'normalized.json'), process.cwd(), 'Output', false))
      .toThrow(/physical path.*inside/i);
  });

  it('rejects an external dangling output symlink targeting a nonexistent in-repo file', () => {
    const outside = mkdtempSync(join(tmpdir(), 'hist-path-dangling-'));
    const target = resolve(process.cwd(), 'scripts/data/not-created.normalized.json');
    const link = join(outside, 'normalized.json');
    symlinkSync(target, link);
    expect(() => resolvePhysicalPathOutsideWorktree(link, process.cwd(), 'Output', false))
      .toThrow(/dangling symlink|physical path.*inside/i);
  });

  it('parses and hashes the same immutable workbook snapshot when the source changes', async () => {
    const outside = mkdtempSync(join(tmpdir(), 'hist-snapshot-'));
    const workbook = join(outside, 'archive.bin');
    writeFileSync(workbook, 'version-one');
    const observed = await withWorkbookSnapshot(workbook, process.cwd(), async (snapshotPath, snapshotBytes) => {
      writeFileSync(workbook, 'version-two');
      return {
        parsed: readFileSync(snapshotPath, 'utf8'),
        hash: sourceDocumentHashFor(snapshotBytes),
        snapshotHash: sourceDocumentHashFor(readFileSync(snapshotPath)),
      };
    });
    expect(observed.parsed).toBe('version-one');
    expect(observed.hash).toBe(observed.snapshotHash);
    expect(readFileSync(workbook, 'utf8')).toBe('version-two');
  });

  it('refuses to place a workbook snapshot under the worktree', async () => {
    const outside = mkdtempSync(join(tmpdir(), 'hist-snapshot-source-'));
    const workbook = join(outside, 'archive.bin');
    writeFileSync(workbook, 'synthetic archive');
    const insideTemp = mkdtempSync(join(process.cwd(), '.task2-snapshot-'));
    const previous = process.env.TMPDIR;
    process.env.TMPDIR = insideTemp;
    try {
      await expect(withWorkbookSnapshot(workbook, process.cwd(), () => undefined))
        .rejects.toThrow(/snapshot directory.*inside/i);
    } finally {
      if (previous === undefined) delete process.env.TMPDIR;
      else process.env.TMPDIR = previous;
      rmSync(insideTemp, { recursive: true, force: true });
    }
  });
});

describe('operator safety helpers', () => {
  it('consults the server for every row and honestly classifies hashes', async () => {
    const rows = [1, 2, 3].map(sourceRow => ({ ...contentFixture, sourceRow, historicalId: historicalIdFor('book.xlsx', sourceRow), contentHash: contentHashFor({ ...contentFixture, sourceRow }) }));
    const normalized = { importBatchId: 'HB-fixture', sourceDocument: 'book.xlsx', sourceDocumentHash: 'a'.repeat(64), rows };
    const get = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ contentHash: rows[1].contentHash }).mockResolvedValueOnce({ contentHash: 'different' });
    expect(await classifyHistoricalDryRun(normalized, get)).toEqual(rows.map((row, i) => ({ historicalId: row.historicalId, status: ['IMPORTED', 'SKIPPED', 'CONFLICT'][i] })));
    expect(get).toHaveBeenCalledTimes(3);
  });

  it('checks expected rows against actual file length', () => {
    expect(() => validateExpectedRows(2, 3)).toThrow(/expected 2.*found 3/i);
    expect(() => validateExpectedRows(undefined, 37)).not.toThrow();
  });

  it('accepts typed reachability and rejects transport/schema failures', () => {
    expect(() => assertProbeResult({ errors: [{ message: 'NOT_FOUND: absent' }] }, ['NOT_FOUND'])).not.toThrow();
    expect(() => assertProbeResult({ errors: [{ message: 'Cannot query field pbGetHistoricalQuotation' }] }, ['NOT_FOUND'])).toThrow(/probe failed/i);
    expect(() => assertProbeResult({ data: { unexpectedly: 'succeeded' } }, ['VALIDATION'])).toThrow(/expected.*VALIDATION/i);
  });

  it.each([
    [['file.json', '--expect-rows'], /value/i],
    [['file.json', '--expect-rows', '--apply'], /value/i],
    [['file.json', '--wat'], /unknown/i],
    [['file.json', 'other.json'], /exactly one/i],
    [['file.json', '--apply', '--apply'], /duplicate/i],
  ] as Array<[string[], RegExp]>)('rejects unsafe import argv %j', (argv, error) => {
    expect(() => parseImportArgv(argv)).toThrow(error);
  });

  it('parses explicit import guards without dropping them', () => {
    expect(parseImportArgv(['file.json', '--expect-rows', '37', '--apply']))
      .toEqual({ file: 'file.json', expectedRows: 37, apply: true });
  });

  it.each([
    [['--batch'], /value/i],
    [['--batch', '--apply'], /value/i],
    [['--batch', 'HB-x', '--apply'], /reason/i],
    [['--batch', 'HB-x', '--reason', '--apply'], /value/i],
    [['--batch', 'HB-x', '--wat'], /unknown/i],
    [['--batch', 'HB-x', '--batch', 'HB-y'], /duplicate/i],
    [['--batch', '   '], /non-empty/i],
  ] as Array<[string[], RegExp]>)('rejects unsafe rollback argv %j', (argv, error) => {
    expect(() => parseRollbackArgv(argv)).toThrow(error);
  });

  it('parses preview and apply rollback argv', () => {
    expect(parseRollbackArgv(['--batch', 'HB-x'])).toEqual({ importBatchId: 'HB-x', apply: false });
    expect(parseRollbackArgv(['--apply', '--reason', 'operator correction', '--batch', 'HB-x']))
      .toEqual({ importBatchId: 'HB-x', apply: true, reason: 'operator correction' });
  });

  it('requires an independent denylist and both sandbox stack identifiers', () => {
    expect(() => assertSandboxTarget('pool-a', 'pool-a', 'sandbox-historical-import-review')).toThrow(/production/i);
    expect(() => assertSandboxTarget('pool-a', 'pool-prod', 'sandbox-only')).toThrow(/historical-import-review/i);
    expect(() => assertSandboxTarget('pool-a', 'pool-prod', 'prod-historical-import-review')).toThrow(/sandbox/i);
  });

  it('creates exactly MAX_IMPORT_ROWS fabricated rows', () => {
    const rows = syntheticSandboxRows('supplier-fabricated');
    expect(rows).toHaveLength(MAX_IMPORT_ROWS);
    expect(rows.every(row => row.supplierId === 'supplier-fabricated' && row.customerName.includes('Synthetic'))).toBe(true);
  });
});
