import { defineFunction } from '@aws-amplify/backend';

export const fetchSam = defineFunction({
    name: 'fetch-sam',
    entry: './handler.ts',
    runtime: 22,
    timeoutSeconds: 300,
    memoryMB: 512,
    environment: {
        SAM_API_KEY_PARAM: '/tender-watch/sam/api-key',
    },
});
