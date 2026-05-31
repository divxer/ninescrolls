import { defineFunction } from '@aws-amplify/backend';

export const fetchNyscr = defineFunction({
    name: 'fetch-nyscr',
    entry: './handler.ts',
    runtime: 22,
    resourceGroupName: 'tender-watch-stack',
    timeoutSeconds: 300,
    memoryMB: 512,
    // STAGING_BUCKET is injected at deploy time by amplify/backend.ts
    // because the bucket name is CDK-generated. Do not set it here.
});
