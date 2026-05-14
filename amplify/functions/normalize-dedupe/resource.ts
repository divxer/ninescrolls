import { defineFunction } from '@aws-amplify/backend';

export const normalizeDedupe = defineFunction({
    name: 'normalize-dedupe',
    entry: './handler.ts',
    runtime: 22,
    resourceGroupName: 'tender-watch-stack',
    timeoutSeconds: 300,
    memoryMB: 512,
    // INTELLIGENCE_TABLE and STAGING_BUCKET are injected at deploy time by amplify/backend.ts (Task 14)
});
