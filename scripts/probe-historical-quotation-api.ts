import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../amplify/data/resource';
import amplifyOutputs from '../amplify_outputs.json';
import { authenticate } from './lib/auth';
import { assertProbeResult } from './lib/historicalQuotationImport';

Amplify.configure(amplifyOutputs as never);
const client = generateClient<Schema>({ authMode: 'userPool' });
const AUTH = { authMode: 'userPool' as const };
async function main() {
  await authenticate();
  assertProbeResult(await client.queries.pbListHistoricalQuotations({ limit: 1 }, AUTH));
  const absent = 'f'.repeat(64);
  assertProbeResult(await client.queries.pbGetHistoricalQuotation({ input: JSON.stringify({ historicalId: absent }) }, AUTH), ['NOT_FOUND']);
  // Missing importBatchId is rejected during parsing/validation, before the manifest Put.
  assertProbeResult(await client.mutations.pbImportHistoricalQuotations({ input: JSON.stringify({ rows: [] }) }, AUTH), ['VALIDATION']);
  assertProbeResult(await client.mutations.pbRollbackHistoricalQuotationImport({ input: JSON.stringify({ importBatchId: 'HB-probe-never-created', mode: 'PREVIEW' }) }, AUTH), ['NOT_FOUND']);
  console.log('Historical quotation API probe passed (no writes).');
}
main().catch(error => { console.error((error as Error).message); process.exitCode = 1; });
