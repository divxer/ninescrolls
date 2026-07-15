import { createHash } from 'node:crypto';
import { lstatSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, parse, relative, resolve } from 'node:path';
import { contentHashFor, historicalIdFor, MAX_IMPORT_ROWS, type DataQualityFlag, type HistoricalQuotationInput } from '../../amplify/functions/price-api/lib/historicalQuotation';
export { MAX_IMPORT_ROWS };
import { rmbToFen } from './csv';

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
export type HistoricalSourceRow = Record<string, unknown> & { sourceRow: number };
export interface HistoricalAdjudication {
  sourceRow: number;
  adjudicatedRmb: string;
  supersededRmb: string;
  adjudicatedAt: string;
}
export interface BuildNormalizedHistoricalQuotationsInput {
  sourceRows: HistoricalSourceRow[];
  adjudication: HistoricalAdjudication;
  sourceDocument: string;
  workbookBytes: Buffer;
  supplierId: string;
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

export const compareCodeUnits = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

function sortObject(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortObject);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => compareCodeUnits(left, right))
      .map(([key, child]) => [key, sortObject(child)]));
  }
  return value;
}

function isInside(root: string, candidate: string): boolean {
  const rel = relative(root, candidate);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

export function resolvePhysicalPathOutsideWorktree(
  path: string,
  worktreeRoot: string,
  label: string,
  mustExist: boolean,
): string {
  const physicalRoot = realpathSync(worktreeRoot);
  let physicalPath: string;
  if (mustExist) {
    physicalPath = realpathSync(path);
  } else {
    const absolute = resolve(path);
    const parsed = parse(absolute);
    const components = absolute.slice(parsed.root.length).split('/').filter(Boolean);
    let current = parsed.root;
    for (let index = 0; index < components.length; index += 1) {
      const candidate = join(current, components[index]);
      try {
        const stat = lstatSync(candidate);
        if (stat.isSymbolicLink()) {
          try {
            current = realpathSync(candidate);
          } catch {
            throw new Error(`${label} path contains a dangling symlink`);
          }
        } else {
          current = candidate;
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        current = join(current, ...components.slice(index));
        break;
      }
    }
    physicalPath = current;
  }
  if (isInside(physicalRoot, physicalPath)) {
    throw new Error(`${label} physical path resolves inside the git worktree`);
  }
  return physicalPath;
}

export async function withWorkbookSnapshot<T>(
  workbookPath: string,
  worktreeRoot: string,
  runSnapshot: (snapshotPath: string, snapshotBytes: Buffer) => Promise<T> | T,
): Promise<T> {
  const bytes = readFileSync(workbookPath);
  const snapshotBase = resolvePhysicalPathOutsideWorktree(tmpdir(), worktreeRoot, 'Snapshot directory', true);
  const directory = mkdtempSync(join(snapshotBase, 'historical-workbook-'));
  const snapshotPath = join(directory, 'workbook.xlsx');
  try {
    writeFileSync(snapshotPath, bytes, { flag: 'wx', mode: 0o600 });
    return await runSnapshot(snapshotPath, bytes);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

const nullableString = (value: unknown): string | null => value == null || value === '' ? null : String(value);
const decimalToMinor = (value: unknown, label: string): number | null => {
  if (value == null || value === '') return null;
  const match = String(value).trim().match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) throw new Error(`${label} must be a non-negative amount with at most two decimal places`);
  const minor = BigInt(match[1]) * 100n + BigInt((match[2] ?? '').padEnd(2, '0') || '0');
  if (minor > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error(`${label} exceeds the safe integer limit`);
  return Number(minor);
};
const stringArray = (value: unknown): string[] => value == null || value === ''
  ? [] : Array.isArray(value) ? value.map(String) : JSON.parse(String(value)) as string[];

export const HISTORICAL_WORKBOOK_COLUMNS = [
  'customerName', 'productName', 'configuration', 'supplierQuoteText', 'supplierQuoteBasis',
  'supplierEvidenceType', 'supplierQuotedAt', 'customerQuoteText', 'sourceQuotationNumber',
  'quotedAt', 'legacyStatus', 'supplierAmountRmb', 'customerAmountUsd', 'historicalFxRate',
  'historicalFxSource', 'historicalFxProvenance', 'historicalFxNote', 'dataQualityFlags',
  'dataQualityNotes',
] as const;

export function validateWorkbookColumns(rows: readonly HistoricalSourceRow[]): void {
  const expected = [...HISTORICAL_WORKBOOK_COLUMNS].sort(compareCodeUnits);
  for (const row of rows) {
    const actual = Object.keys(row).filter(key => key !== 'sourceRow').sort(compareCodeUnits);
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      const missing = expected.filter(key => !actual.includes(key));
      const extra = actual.filter(key => !expected.includes(key as typeof expected[number]));
      throw new Error(`Workbook columns do not match contract at sourceRow ${row.sourceRow}; missing: ${missing.join(', ') || 'none'}; extra: ${extra.join(', ') || 'none'}`);
    }
  }
}

function sourceRowToInput(
  row: HistoricalSourceRow,
  lineage: Pick<HistoricalQuotationInput, 'sourceDocument' | 'sourceDocumentHash' | 'importBatchId'>,
  supplierId: string,
): HistoricalQuotationInput {
  return {
    customerName: String(row.customerName ?? ''), productName: String(row.productName ?? ''),
    configuration: String(row.configuration ?? ''), supplierId,
    supplierQuoteText: String(row.supplierQuoteText ?? ''), supplierQuoteBasis: String(row.supplierQuoteBasis ?? ''),
    supplierEvidenceType: String(row.supplierEvidenceType ?? ''), supplierQuotedAt: nullableString(row.supplierQuotedAt),
    customerQuoteText: String(row.customerQuoteText ?? ''), sourceQuotationNumber: nullableString(row.sourceQuotationNumber),
    quotedAt: nullableString(row.quotedAt), legacyStatus: String(row.legacyStatus ?? ''),
    supplierAmountFen: row.supplierAmountRmb == null || row.supplierAmountRmb === '' ? null : rmbToFen(String(row.supplierAmountRmb)),
    customerAmountUsdCents: decimalToMinor(row.customerAmountUsd, 'Customer USD amount'), historicalFxRate: nullableString(row.historicalFxRate),
    historicalFxSource: nullableString(row.historicalFxSource),
    historicalFxProvenance: String(row.historicalFxProvenance ?? 'UNKNOWN') as HistoricalQuotationInput['historicalFxProvenance'],
    historicalFxNote: nullableString(row.historicalFxNote), ...lineage, sourceRow: row.sourceRow,
    dataQualityFlags: stringArray(row.dataQualityFlags) as DataQualityFlag[], dataQualityNotes: stringArray(row.dataQualityNotes),
  };
}

export function buildNormalizedHistoricalQuotations(
  input: BuildNormalizedHistoricalQuotationsInput,
): NormalizedHistoricalQuotations {
  validateWorkbookColumns(input.sourceRows);
  if (input.sourceRows.filter(row => row.sourceRow === input.adjudication.sourceRow).length !== 1) {
    throw new Error('Adjudication sourceRow must match exactly one parsed row');
  }
  const lineage = {
    sourceDocument: input.sourceDocument,
    sourceDocumentHash: sourceDocumentHashFor(input.workbookBytes),
    importBatchId: importBatchIdFor(input.workbookBytes),
  };
  const rows = input.sourceRows.map(source => {
    const row = sourceRowToInput(source, lineage, input.supplierId);
    if (source.sourceRow === input.adjudication.sourceRow) {
      row.supplierAmountFen = rmbToFen(input.adjudication.adjudicatedRmb);
      row.dataQualityFlags = ['CONFLICT_RESOLVED'];
      row.dataQualityNotes = [`Manually adjudicated ${input.adjudication.adjudicatedAt}: RMB ${input.adjudication.adjudicatedRmb} confirmed; Markdown summary value RMB ${input.adjudication.supersededRmb} superseded.`];
    }
    return { ...row, historicalId: historicalIdFor(row.sourceDocument, row.sourceRow), contentHash: contentHashFor(row) };
  });
  return { ...lineage, rows };
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

export type DryRunStatus = 'IMPORTED' | 'SKIPPED' | 'CONFLICT';
export async function classifyHistoricalDryRun(
  normalized: NormalizedHistoricalQuotations,
  get: (historicalId: string) => Promise<{ contentHash?: string } | null>,
): Promise<Array<{ historicalId: string; status: DryRunStatus }>> {
  const outcomes = [];
  for (const row of normalized.rows) {
    const existing = await get(row.historicalId);
    outcomes.push({ historicalId: row.historicalId, status: !existing ? 'IMPORTED' : existing.contentHash === row.contentHash ? 'SKIPPED' : 'CONFLICT' } as const);
  }
  return outcomes;
}

export interface FlaggedHistoricalReviewRow {
  historicalId: string;
  status: DryRunStatus | string;
  sourceRow: number;
  sourceQuotationNumber: string | null;
  customerName: string;
  productName: string;
  dataQualityFlags: DataQualityFlag[];
  dataQualityNotes: string[];
}

export function flaggedHistoricalRows(
  rows: readonly PredictedHistoricalQuotation[],
  outcomes: ReadonlyArray<{ historicalId: string; status: string }>,
): FlaggedHistoricalReviewRow[] {
  const statusById = new Map(outcomes.map(outcome => [outcome.historicalId, outcome.status]));
  return rows.filter(row => row.dataQualityFlags.length > 0).map(row => ({
    historicalId: row.historicalId,
    status: statusById.get(row.historicalId) ?? 'UNKNOWN',
    sourceRow: row.sourceRow,
    sourceQuotationNumber: row.sourceQuotationNumber,
    customerName: row.customerName,
    productName: row.productName,
    dataQualityFlags: row.dataQualityFlags,
    dataQualityNotes: row.dataQualityNotes,
  }));
}

export function scanConfidentialBlob(bytes: Buffer, terms: readonly string[]): string[] {
  const findings = terms.filter(term => term.length > 0 && bytes.includes(Buffer.from(term, 'utf8')))
    .map(term => `term:${term}`);
  const isXlsx = bytes.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))
    && (bytes.includes(Buffer.from('xl/workbook.xml')) || bytes.includes(Buffer.from('xl/workbook.bin')));
  const isOle = bytes.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
  if (isXlsx || isOle) findings.push('spreadsheet-archive');
  return findings;
}

export function validateExpectedRows(expected: number | undefined, actual: number): void {
  if (expected !== undefined && expected !== actual) throw new Error(`Expected ${expected} rows but found ${actual}`);
}

export function assertProbeResult(
  result: { data?: unknown; errors?: Array<{ message: string }> },
  acceptedCodes: readonly string[] = [],
): void {
  if (!result.errors?.length) {
    if (acceptedCodes.length) throw new Error(`Probe expected typed ${acceptedCodes.join('/')} response but operation succeeded`);
    return;
  }
  const messages = result.errors.map(error => error.message);
  if (messages.every(message => acceptedCodes.some(code => message.startsWith(`${code}:`)))) return;
  throw new Error(`Probe failed: ${messages.join(', ')}`);
}

function uniqueFlag(argv: readonly string[], flag: string): number {
  const indices = argv.flatMap((arg, index) => arg === flag ? [index] : []);
  if (indices.length > 1) throw new Error(`Duplicate ${flag}`);
  return indices[0] ?? -1;
}

function requiredFlagValue(argv: readonly string[], flag: string, required: boolean): string | undefined {
  const index = uniqueFlag(argv, flag);
  if (index < 0) {
    if (required) throw new Error(`${flag} value is required`);
    return undefined;
  }
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${flag} value is required`);
  return value;
}

export interface NormalizerArgv {
  workbook: string;
  output: string;
  adjudication: string;
  supplierName: string;
}

export function parseNormalizerArgv(
  argv: readonly string[],
  env: Readonly<Record<string, string | undefined>>,
): NormalizerArgv {
  const flags = ['--workbook', '--output', '--adjudication', '--supplier-name'] as const;
  const allowed = new Set<string>(flags);
  const unknown = argv.find(arg => arg.startsWith('--') && !allowed.has(arg));
  if (unknown) throw new Error(`Unknown flag: ${unknown}`);

  const flagValues = Object.fromEntries(flags.map(flag => [flag, requiredFlagValue(argv, flag, false)])) as
    Record<(typeof flags)[number], string | undefined>;
  const consumed = new Set<number>();
  for (const flag of flags) {
    const index = argv.indexOf(flag);
    if (index >= 0) consumed.add(index + 1);
  }
  const positional = argv.filter((arg, index) => !arg.startsWith('--') && !consumed.has(index));
  if (positional.length > 2) throw new Error(`Unexpected positional argument: ${positional[2]}`);
  if (positional[0] !== undefined && flagValues['--workbook'] !== undefined) {
    throw new Error('Conflicting positional workbook and --workbook');
  }
  if (positional[1] !== undefined && flagValues['--output'] !== undefined) {
    throw new Error('Conflicting positional output and --output');
  }

  const workbook = positional[0] ?? flagValues['--workbook'] ?? env.HISTORICAL_WORKBOOK_PATH;
  const output = positional[1] ?? flagValues['--output'] ?? env.HISTORICAL_NORMALIZED_OUTPUT;
  const adjudication = flagValues['--adjudication'] ?? env.HISTORICAL_ADJUDICATION_PATH;
  const supplierName = flagValues['--supplier-name'] ?? env.HISTORICAL_SUPPLIER_NAME;
  if (!workbook) throw new Error('Workbook is required as the first positional argument, --workbook, or HISTORICAL_WORKBOOK_PATH');
  if (!output) throw new Error('Output is required as the second positional argument, --output, or HISTORICAL_NORMALIZED_OUTPUT');
  if (!adjudication) throw new Error('Adjudication is required via --adjudication or HISTORICAL_ADJUDICATION_PATH');
  if (!supplierName) throw new Error('Supplier name is required via --supplier-name or HISTORICAL_SUPPLIER_NAME');
  return { workbook, output, adjudication, supplierName };
}

export interface ImportArgv { file: string; expectedRows?: number; apply: boolean }
export function parseImportArgv(argv: readonly string[]): ImportArgv {
  const allowed = new Set(['--apply', '--expect-rows']);
  const unknown = argv.find(arg => arg.startsWith('--') && !allowed.has(arg));
  if (unknown) throw new Error(`Unknown flag: ${unknown}`);
  const applyIndex = uniqueFlag(argv, '--apply');
  const expectedRaw = requiredFlagValue(argv, '--expect-rows', false);
  const valueIndices = new Set<number>();
  if (expectedRaw !== undefined) valueIndices.add(argv.indexOf('--expect-rows') + 1);
  const files = argv.filter((arg, index) => !arg.startsWith('--') && !valueIndices.has(index));
  if (files.length !== 1) throw new Error('Exactly one normalized JSON file is required');
  if (expectedRaw !== undefined && !/^\d+$/.test(expectedRaw)) throw new Error('--expect-rows value must be a non-negative integer');
  return { file: files[0], ...(expectedRaw === undefined ? {} : { expectedRows: Number(expectedRaw) }), apply: applyIndex >= 0 };
}

export interface RollbackArgv { importBatchId: string; apply: boolean; reason?: string }
export function parseRollbackArgv(argv: readonly string[]): RollbackArgv {
  const allowed = new Set(['--apply', '--batch', '--reason']);
  const unknown = argv.find(arg => arg.startsWith('--') && !allowed.has(arg));
  if (unknown) throw new Error(`Unknown flag: ${unknown}`);
  const apply = uniqueFlag(argv, '--apply') >= 0;
  const importBatchId = requiredFlagValue(argv, '--batch', true)!;
  if (!importBatchId.trim()) throw new Error('--batch value must be non-empty');
  const reason = requiredFlagValue(argv, '--reason', false);
  const consumed = new Set<number>();
  for (const flag of ['--batch', '--reason']) { const index = argv.indexOf(flag); if (index >= 0) consumed.add(index + 1); }
  const positional = argv.filter((arg, index) => !arg.startsWith('--') && !consumed.has(index));
  if (positional.length) throw new Error(`Unexpected positional argument: ${positional[0]}`);
  if (apply && !reason?.trim()) throw new Error('--apply requires --reason value');
  if (!apply && reason !== undefined) throw new Error('--reason is valid only with --apply');
  return { importBatchId, apply, ...(reason === undefined ? {} : { reason }) };
}

export function assertSandboxTarget(loadedPoolId: string, productionPoolId: string, stackName: string): void {
  if (!productionPoolId.trim()) throw new Error('PRODUCTION_POOL_ID is required as an independent denylist');
  if (loadedPoolId === productionPoolId) throw new Error('Refusing production user pool');
  const lower = stackName.toLowerCase();
  if (!lower.includes('sandbox')) throw new Error('Owning stack name must contain sandbox');
  if (!lower.includes('historical-import-review')) throw new Error('Owning stack name must contain historical-import-review');
}

export function syntheticSandboxRows(supplierId: string): HistoricalQuotationInput[] {
  return Array.from({ length: MAX_IMPORT_ROWS }, (_, index) => ({
    customerName: `Synthetic Customer ${index + 1}`, productName: `Synthetic Product ${index + 1}`,
    configuration: 'Fabricated sandbox review data', supplierId,
    supplierQuoteText: `FABRICATED RMB ${(1000 + index).toFixed(2)}`, supplierQuoteBasis: 'synthetic',
    supplierEvidenceType: 'SYNTHETIC', supplierQuotedAt: '2020-01-01',
    customerQuoteText: `FABRICATED USD ${(200 + index).toFixed(2)}`, sourceQuotationNumber: null,
    quotedAt: '2020-01-02', legacyStatus: 'synthetic', supplierAmountFen: (1000 + index) * 100,
    customerAmountUsdCents: (200 + index) * 100, historicalFxRate: null, historicalFxSource: null,
    historicalFxProvenance: 'UNKNOWN', historicalFxNote: 'Fabricated sandbox data; no real FX evidence',
    sourceDocument: 'synthetic-sandbox.json', sourceDocumentHash: '0'.repeat(64), sourceRow: index + 1,
    importBatchId: 'HB-sandbox-synthetic', dataQualityFlags: ['UNCONFIRMED'], dataQualityNotes: ['Fabricated test record'],
  }));
}
