import { defineFunction } from '@aws-amplify/backend';

export const classifyAndStore = defineFunction({
    name: 'classify-and-store',
    entry: './handler.ts',
    runtime: 22,
    resourceGroupName: 'tender-watch-stack',
    timeoutSeconds: 60,
    memoryMB: 512,
    // INTELLIGENCE_TABLE is injected at deploy time by amplify/backend.ts (Task 14)
});
