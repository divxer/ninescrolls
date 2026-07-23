import { defineFunction } from '@aws-amplify/backend';

// timeoutSeconds MUST stay in sync with handler.ts's LAMBDA_TIMEOUT_SEC (passed to acquireLease).
// gmailSyncState's lease TTL is max(2×timeout,300)=300s, which must remain STRICTLY GREATER than
// this invocation timeout so a live run can never outlast its own lease (see gmailSyncState.ts's
// writeStateFenced comment). If this timeout is ever raised, that arithmetic must be revisited.
export const gmailSync = defineFunction({
  name: 'gmail-sync',
  entry: './handler.ts',
  timeoutSeconds: 120,
  resourceGroupName: 'gmail-sync-stack',
});
