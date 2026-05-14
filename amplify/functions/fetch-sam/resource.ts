import { defineFunction, secret } from '@aws-amplify/backend';

export const fetchSam = defineFunction({
    name: 'fetch-sam',
    entry: './handler.ts',
    runtime: 22,
    timeoutSeconds: 300,
    memoryMB: 512,
    environment: {
        SAM_API_KEY: secret('SAM_API_KEY'),
        // STAGING_BUCKET is injected at deploy time by amplify/backend.ts (Task 14)
        // because the bucket name is CDK-generated. Do not set it here.
    },
});
