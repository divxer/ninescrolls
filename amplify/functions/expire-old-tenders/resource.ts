import { defineFunction } from '@aws-amplify/backend';

export const expireOldTenders = defineFunction({
    name: 'expire-old-tenders',
    entry: './handler.ts',
    runtime: 22,
    resourceGroupName: 'tender-watch-stack',
    timeoutSeconds: 120,
    memoryMB: 256,
    // INTELLIGENCE_TABLE is injected at deploy time by amplify/backend.ts (Task 14)
});
