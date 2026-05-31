import { defineFunction } from '@aws-amplify/backend';

export const fetchUofa = defineFunction({
    name: 'fetch-uofa',
    entry: './handler.ts',
    runtime: 22,
    resourceGroupName: 'tender-watch-stack',
    timeoutSeconds: 120,
    memoryMB: 512,
    // STAGING_BUCKET is injected at deploy time by amplify/backend.ts
    // because the bucket name is CDK-generated. Do not set it here.
});
