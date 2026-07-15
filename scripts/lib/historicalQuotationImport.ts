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
  useSnapshot: (snapshotPath: string, snapshotBytes: Buffer) => Promise<T> | T,
): Promise<T> {
  const bytes = readFileSync(workbookPath);
  const snapshotBase = resolvePhysicalPathOutsideWorktree(tmpdir(), worktreeRoot, 'Snapshot directory', true);
  const directory = mkdtempSync(join(snapshotBase, 'historical-workbook-'));
  const snapshotPath = join(directory, 'workbook.xlsx');
  try {
    writeFileSync(snapshotPath, bytes, { flag: 'wx', mode: 0o600 });
    return await useSnapshot(snapshotPath, bytes);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

const nullableString = (value: unknown): string | null => value == null || value === '' ? null : String(value);
const optionalInteger = (value: unknown): number | null => {
  if (value == null || value === '') return null;
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw new Error('Amount cents must be a non-negative integer');
  return value as number;
};
const stringArray = (value: unknown): string[] => value == null || value === ''
  ? [] : Array.isArray(value) ? value.map(String) : JSON.parse(String(value)) as string[];

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
    customerAmountUsdCents: optionalInteger(row.customerAmountUsdCents), historicalFxRate: nullableString(row.historicalFxRate),
    historicalFxSource: nullableString(row.historicalFxSource),
    historicalFxProvenance: String(row.historicalFxProvenance ?? 'UNKNOWN') as HistoricalQuotationInput['historicalFxProvenance'],
    historicalFxNote: nullableString(row.historicalFxNote), ...lineage, sourceRow: row.sourceRow,
    dataQualityFlags: stringArray(row.dataQualityFlags) as DataQualityFlag[], dataQualityNotes: stringArray(row.dataQualityNotes),
  };
}

export function buildNormalizedHistoricalQuotations(
  input: BuildNormalizedHistoricalQuotationsInput,
): NormalizedHistoricalQuotations {
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

export function validateExpectedRows(expected: number | undefined, actual: number): void {
  if (expected !== undefined && expected !== actual) throw new Error(`Expected ${expected} rows but found ${actual}`);
}

export function assertProbeResult(
  result: { data?: unknown; errors?: Array<{ message: string }> },
  acceptedCodes: readonly string[] = [],
): void {
  if (!result.errors?.length) return;
  const messages = result.errors.map(error => error.message);
  if (messages.every(message => acceptedCodes.some(code => message.startsWith(`${code}:`)))) return;
  throw new Error(`Probe failed: ${messages.join(', ')}`);
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
