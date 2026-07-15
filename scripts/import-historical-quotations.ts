import { readFileSync } from 'node:fs';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../amplify/data/resource';
import amplifyOutputs from '../amplify_outputs.json';
import { authenticate } from './lib/auth';
import { classifyHistoricalDryRun, parseNormalizedHistoricalQuotations, validateExpectedRows } from './lib/historicalQuotationImport';

Amplify.configure(amplifyOutputs as never);
const client = generateClient<Schema>({ authMode: 'userPool' });
const AUTH = { authMode: 'userPool' as const };
const args = process.argv.slice(2);
const valueAfter = (flag: string) => { const at = args.indexOf(flag); return at < 0 ? undefined : args[at + 1]; };
const consumed = new Set([valueAfter('--expect-rows')]);
const file = args.find(arg => !arg.startsWith('--') && !consumed.has(arg));
const unwrap = <T>(data: unknown): T => (typeof data === 'string' ? JSON.parse(data) : data) as T;

async function main() {
  if (!file) throw new Error('Usage: import-historical-quotations.ts <normalized.json> [--expect-rows N] [--apply]');
  const normalized = parseNormalizedHistoricalQuotations(readFileSync(file, 'utf8'));
  console.log(normalized.importBatchId);
  const expectedRaw = valueAfter('--expect-rows');
  if (expectedRaw !== undefined && (!/^\d+$/.test(expectedRaw))) throw new Error('--expect-rows must be a non-negative integer');
  validateExpectedRows(expectedRaw === undefined ? undefined : Number(expectedRaw), normalized.rows.length);
  await authenticate();
  if (args.includes('--apply')) {
    const response = await client.mutations.pbImportHistoricalQuotations({ input: JSON.stringify(normalized) }, AUTH);
    if (response.errors?.length) throw new Error(response.errors.map(error => error.message).join(', '));
    print(unwrap<Array<{ historicalId: string; status: string; message?: string }>>(response.data));
    return;
  }
  const outcomes = await classifyHistoricalDryRun(normalized, async historicalId => {
    const response = await client.queries.pbGetHistoricalQuotation({ input: JSON.stringify({ historicalId }) }, AUTH);
    if (response.errors?.length) {
      if (response.errors.every(error => error.message.startsWith('NOT_FOUND:'))) return null;
      throw new Error(response.errors.map(error => error.message).join(', '));
    }
    return unwrap<{ contentHash: string }>(response.data);
  });
  print(outcomes);
}

function print(outcomes: Array<{ historicalId: string; status: string; message?: string }>) {
  const counts = Object.fromEntries([...new Set(outcomes.map(row => row.status))].sort().map(status => [status, outcomes.filter(row => row.status === status).length]));
  console.log(JSON.stringify(counts));
  for (const row of outcomes.filter(row => ['CONFLICT', 'FAILED'].includes(row.status))) console.log(JSON.stringify(row));
}
main().catch(error => { console.error((error as Error).message); process.exitCode = 1; });
