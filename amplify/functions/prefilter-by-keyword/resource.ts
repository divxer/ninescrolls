import { defineFunction } from '@aws-amplify/backend';

export const prefilterByKeyword = defineFunction({
    name: 'prefilter-by-keyword',
    entry: './handler.ts',
    runtime: 22,
    resourceGroupName: 'tender-watch-stack',
    timeoutSeconds: 60,
    memoryMB: 512,
    // INTELLIGENCE_TABLE is injected at deploy time by amplify/backend.ts (Task 14)
});
