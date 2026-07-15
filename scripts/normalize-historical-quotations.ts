import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { contentHashFor, historicalIdFor, type DataQualityFlag, type HistoricalQuotationInput } from '../amplify/functions/price-api/lib/historicalQuotation';
import { rmbToFen } from './lib/csv';
import { importBatchIdFor, resolveSupplierId, serializeHistoricalQuotations, sourceDocumentHashFor } from './lib/historicalQuotationImport';

type SourceRow = Record<string, unknown> & { sourceRow: number };
interface Adjudication { sourceRow: number; adjudicatedRmb: string; supersededRmb: string; adjudicatedAt: string }

function option(name: string, envName: string): string {
  const index = process.argv.indexOf(`--${name}`);
  const value = index >= 0 ? process.argv[index + 1] : process.env[envName];
  if (!value) throw new Error(`Missing --${name} or ${envName}`);
  return resolve(value);
}

function assertOutsideWorktree(path: string, root: string, label: string): void {
  const rel = relative(root, path);
  if (rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))) throw new Error(`${label} path must be outside the git worktree`);
}

function parseAdjudication(json: string): Adjudication {
  const value = JSON.parse(json) as Record<string, unknown>;
  const keys = Object.keys(value).sort();
  const expected = ['adjudicatedAt', 'adjudicatedRmb', 'sourceRow', 'supersededRmb'];
  if (JSON.stringify(keys) !== JSON.stringify(expected)) throw new Error('Adjudication record has missing or extra fields');
  if (!Number.isSafeInteger(value.sourceRow) || (value.sourceRow as number) < 1
      || typeof value.adjudicatedRmb !== 'string' || typeof value.supersededRmb !== 'string'
      || typeof value.adjudicatedAt !== 'string') throw new Error('Adjudication record has invalid field types');
  return value as unknown as Adjudication;
}

const nullableString = (value: unknown): string | null => value == null || value === '' ? null : String(value);
const optionalInteger = (value: unknown): number | null => {
  if (value == null || value === '') return null;
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw new Error('Amount cents must be a non-negative integer');
  return value as number;
};
const stringArray = (value: unknown): string[] => value == null || value === ''
  ? [] : Array.isArray(value) ? value.map(String) : JSON.parse(String(value)) as string[];

function toInput(row: SourceRow, lineage: Pick<HistoricalQuotationInput, 'sourceDocument' | 'sourceDocumentHash' | 'importBatchId'>, supplierId: string): HistoricalQuotationInput {
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

async function main(): Promise<void> {
  const workbook = option('workbook', 'HISTORICAL_WORKBOOK_PATH');
  const output = option('output', 'HISTORICAL_NORMALIZED_OUTPUT');
  const adjudicationPath = option('adjudication', 'HISTORICAL_ADJUDICATION_PATH');
  const supplierNameIndex = process.argv.indexOf('--supplier-name');
  const supplierName = supplierNameIndex >= 0 ? process.argv[supplierNameIndex + 1] : process.env.HISTORICAL_SUPPLIER_NAME;
  if (!supplierName) throw new Error('Missing --supplier-name or HISTORICAL_SUPPLIER_NAME');
  const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  assertOutsideWorktree(workbook, root, 'Workbook'); assertOutsideWorktree(output, root, 'Output');
  assertOutsideWorktree(adjudicationPath, root, 'Adjudication');

  const extractor = resolve(dirname(fileURLToPath(import.meta.url)), 'extract-historical-workbook.ts');
  const tsx = resolve(root, 'node_modules/.bin/tsx');
  const cleanEnv = Object.fromEntries(['PATH', 'TMPDIR', 'LANG', 'LC_ALL']
    .flatMap(key => process.env[key] === undefined ? [] : [[key, process.env[key] as string]]));
  const sourceRows = JSON.parse(execFileSync(tsx, [extractor, workbook], { encoding: 'utf8', env: cleanEnv })) as SourceRow[];
  const adjudication = parseAdjudication(readFileSync(adjudicationPath, 'utf8'));
  if (sourceRows.filter(row => row.sourceRow === adjudication.sourceRow).length !== 1) {
    throw new Error('Adjudication sourceRow must match exactly one parsed row');
  }

  // Authentication modules load only after the untrusted workbook parser exits successfully.
  const [{ Amplify }, { generateClient }, { authenticate }, { default: outputs }] = await Promise.all([
    import('aws-amplify'), import('aws-amplify/data'), import('./lib/auth'), import('../amplify_outputs.json'),
  ]);
  Amplify.configure(outputs as never);
  await authenticate();
  const client = generateClient<any>({ authMode: 'userPool' });
  const response = await client.queries.pbListSuppliers({ authMode: 'userPool' }) as {
    data: unknown; errors?: Array<{ message: string }>;
  };
  if (response.errors?.length) throw new Error(response.errors.map((error: { message: string }) => error.message).join(', '));
  const payload = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
  const supplierId = resolveSupplierId(payload.items, supplierName);

  const bytes = readFileSync(workbook);
  const lineage = { sourceDocument: basename(workbook), sourceDocumentHash: sourceDocumentHashFor(bytes), importBatchId: importBatchIdFor(bytes) };
  const rows = sourceRows.map(source => {
    const input = toInput(source, lineage, supplierId);
    if (source.sourceRow === adjudication.sourceRow) {
      input.supplierAmountFen = rmbToFen(adjudication.adjudicatedRmb);
      input.dataQualityFlags = ['CONFLICT_RESOLVED'];
      input.dataQualityNotes = [`Manually adjudicated ${adjudication.adjudicatedAt}: RMB ${adjudication.adjudicatedRmb} confirmed; Markdown summary value RMB ${adjudication.supersededRmb} superseded.`];
    }
    return { ...input, historicalId: historicalIdFor(input.sourceDocument, input.sourceRow), contentHash: contentHashFor(input) };
  });
  writeFileSync(output, serializeHistoricalQuotations({ ...lineage, rows }), 'utf8');
}

await main();
