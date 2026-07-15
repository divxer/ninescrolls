import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildNormalizedHistoricalQuotations,
  parseNormalizerArgv,
  resolvePhysicalPathOutsideWorktree,
  resolveSupplierId,
  serializeHistoricalQuotations,
  withWorkbookSnapshot,
  type HistoricalAdjudication,
  type HistoricalSourceRow,
} from './lib/historicalQuotationImport';

function parseAdjudication(json: string): HistoricalAdjudication {
  const value = JSON.parse(json) as Record<string, unknown>;
  const keys = Object.keys(value).sort();
  const expected = ['adjudicatedAt', 'adjudicatedRmb', 'sourceRow', 'supersededRmb'];
  if (JSON.stringify(keys) !== JSON.stringify(expected)) throw new Error('Adjudication record has missing or extra fields');
  if (!Number.isSafeInteger(value.sourceRow) || (value.sourceRow as number) < 1
      || typeof value.adjudicatedRmb !== 'string' || typeof value.supersededRmb !== 'string'
      || typeof value.adjudicatedAt !== 'string') throw new Error('Adjudication record has invalid field types');
  return value as unknown as HistoricalAdjudication;
}

async function main(): Promise<void> {
  const options = parseNormalizerArgv(process.argv.slice(2), process.env);
  const workbookArgument = resolve(options.workbook);
  const outputArgument = resolve(options.output);
  const adjudicationArgument = resolve(options.adjudication);
  const supplierName = options.supplierName;
  const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  const workbook = resolvePhysicalPathOutsideWorktree(workbookArgument, root, 'Workbook', true);
  const output = resolvePhysicalPathOutsideWorktree(outputArgument, root, 'Output', false);
  const adjudicationPath = resolvePhysicalPathOutsideWorktree(adjudicationArgument, root, 'Adjudication', true);

  const extractor = resolve(dirname(fileURLToPath(import.meta.url)), 'extract-historical-workbook.ts');
  const tsx = resolve(root, 'node_modules/.bin/tsx');
  const cleanEnv = Object.fromEntries(['PATH', 'TMPDIR', 'LANG', 'LC_ALL']
    .flatMap(key => process.env[key] === undefined ? [] : [[key, process.env[key] as string]]));
  const snapshot = await withWorkbookSnapshot(workbook, root, (snapshotPath, workbookBytes) => ({
    sourceRows: JSON.parse(execFileSync(tsx, [extractor, snapshotPath], {
      encoding: 'utf8', env: cleanEnv,
    })) as HistoricalSourceRow[],
    workbookBytes,
  }));
  const adjudication = parseAdjudication(readFileSync(adjudicationPath, 'utf8'));

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

  const normalized = buildNormalizedHistoricalQuotations({
    sourceRows: snapshot.sourceRows,
    adjudication,
    sourceDocument: basename(workbook),
    workbookBytes: snapshot.workbookBytes,
    supplierId,
  });
  writeFileSync(output, serializeHistoricalQuotations(normalized), 'utf8');
}

await main();
