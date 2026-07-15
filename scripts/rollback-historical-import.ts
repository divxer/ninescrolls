import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../amplify/data/resource';
import amplifyOutputs from '../amplify_outputs.json';
import { authenticate } from './lib/auth';

Amplify.configure(amplifyOutputs as never);
const client = generateClient<Schema>({ authMode: 'userPool' });
const AUTH = { authMode: 'userPool' as const };
const args = process.argv.slice(2);
const after = (flag: string) => { const at = args.indexOf(flag); return at < 0 ? undefined : args[at + 1]; };
const call = async (input: Record<string, unknown>) => {
  const response = await client.mutations.pbRollbackHistoricalQuotationImport({ input: JSON.stringify(input) }, AUTH);
  if (response.errors?.length) throw new Error(response.errors.map(error => error.message).join(', '));
  return (typeof response.data === 'string' ? JSON.parse(response.data) : response.data) as Record<string, unknown>;
};
async function main() {
  const importBatchId = after('--batch');
  if (!importBatchId) throw new Error('--batch <id> is required');
  await authenticate();
  const preview = await call({ importBatchId, mode: 'PREVIEW' });
  console.log(JSON.stringify(preview, null, 2));
  if (!args.includes('--apply')) return;
  const reason = after('--reason');
  if (!reason?.trim()) throw new Error('--apply requires --reason <text>');
  const rollbackToken = preview.rollbackToken;
  if (typeof rollbackToken !== 'string') throw new Error('Preview did not return a rollback token');
  console.log(JSON.stringify(await call({ importBatchId, mode: 'APPLY', rollbackToken, reason }), null, 2));
}
main().catch(error => { console.error((error as Error).message); process.exitCode = 1; });
