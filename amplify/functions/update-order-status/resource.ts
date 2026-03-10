import { defineFunction, secret } from '@aws-amplify/backend';

export const updateOrderStatus = defineFunction({
    name: 'update-order-status',
    entry: './handler.ts',
    runtime: 22,
    timeoutSeconds: 15,
    memoryMB: 256,
    environment: {
        SLACK_WEBHOOK_URL: secret('SLACK_WEBHOOK_URL'),
    },
});
