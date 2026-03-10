import { defineFunction, secret } from '@aws-amplify/backend';

export const orderApi = defineFunction({
    name: 'order-api',
    entry: './handler.ts',
    runtime: 22,
    timeoutSeconds: 30,
    memoryMB: 512,
    environment: {
        SLACK_WEBHOOK_URL: secret('SLACK_WEBHOOK_URL'),
    },
});
