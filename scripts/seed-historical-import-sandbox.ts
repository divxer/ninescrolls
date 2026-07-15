import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../amplify/data/resource';
import { contentHashFor, historicalIdFor } from '../amplify/functions/price-api/lib/historicalQuotation';
import amplifyOutputs from '../amplify_outputs.json';
import { authenticate } from './lib/auth';
import { assertSandboxTarget, importBatchIdFor, serializeHistoricalQuotations, sourceDocumentHashFor, syntheticSandboxRows } from './lib/historicalQuotationImport';

const OUTPUT = '/tmp/historical-import-sandbox-50.json';
const SUPPLIER_NAME = 'FABRICATED Historical Import Review Supplier';
const loadedPoolId = amplifyOutputs.auth.user_pool_id;
const region = amplifyOutputs.auth.aws_region;
const awsJson = (args: string[]) => JSON.parse(execFileSync('aws', args, { encoding: 'utf8' })) as Record<string, unknown>;

function owningStackName(): string {
  const resources = awsJson(['cloudformation', 'describe-stack-resources', '--physical-resource-id', loadedPoolId, '--region', region]);
  const first = (resources.StackResources as Array<{ StackName?: string }> | undefined)?.[0]?.StackName;
  if (!first) throw new Error('Could not resolve user pool owning stack');
  const stacks = awsJson(['cloudformation', 'describe-stacks', '--stack-name', first, '--region', region]);
  const actual = (stacks.Stacks as Array<{ StackName?: string }> | undefined)?.[0]?.StackName;
  if (!actual) throw new Error('Could not verify user pool owning stack');
  return actual;
}

async function main() {
  if (process.env.ALLOW_SANDBOX_SEED !== '1') throw new Error('ALLOW_SANDBOX_SEED=1 is required');
  const productionPoolId = process.env.PRODUCTION_POOL_ID;
  if (!productionPoolId) throw new Error('PRODUCTION_POOL_ID is required');
  assertSandboxTarget(loadedPoolId, productionPoolId, owningStackName());
  Amplify.configure(amplifyOutputs as never);
  const client = generateClient<Schema>({ authMode: 'userPool' });
  const AUTH = { authMode: 'userPool' as const };
  const unwrap = <T>(data: unknown): T => (typeof data === 'string' ? JSON.parse(data) : data) as T;
  await authenticate();
  const listed = await client.queries.pbListSuppliers(AUTH);
  if (listed.errors?.length) throw new Error(listed.errors.map(error => error.message).join(', '));
  const matches = unwrap<{ items: Array<{ supplierId: string; name: string }> }>(listed.data).items.filter(supplier => supplier.name === SUPPLIER_NAME);
  if (matches.length > 1) throw new Error('Fabricated supplier is not unique');
  let supplierId = matches[0]?.supplierId;
  if (!supplierId) {
    const created = await client.mutations.pbCreateSupplier({ input: JSON.stringify({ name: SUPPLIER_NAME, notes: 'FABRICATED sandbox-only test supplier' }) }, AUTH);
    if (created.errors?.length) throw new Error(created.errors.map(error => error.message).join(', '));
    supplierId = unwrap<{ supplierId: string }>(created.data).supplierId;
  }
  const bytes = Buffer.from('ninescrolls synthetic historical import sandbox v1');
  const sourceDocument = 'synthetic-sandbox.json';
  const sourceDocumentHash = sourceDocumentHashFor(bytes);
  const importBatchId = importBatchIdFor(bytes);
  const rows = syntheticSandboxRows(supplierId).map(row => {
    const input = { ...row, sourceDocument, sourceDocumentHash, importBatchId };
    return { ...input, historicalId: historicalIdFor(sourceDocument, input.sourceRow), contentHash: contentHashFor(input) };
  });
  writeFileSync(OUTPUT, serializeHistoricalQuotations({ importBatchId, sourceDocument, sourceDocumentHash, rows }), { encoding: 'utf8', mode: 0o600 });
  console.log(importBatchId);
  console.log(OUTPUT);
}
main().catch(error => { console.error((error as Error).message); process.exitCode = 1; });
