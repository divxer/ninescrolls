import { defineFunction, secret } from '@aws-amplify/backend';

export const convertRfqToOrder = defineFunction({
    name: 'convert-rfq-to-order',
    entry: './handler.ts',
    runtime: 22,
    timeoutSeconds: 15,
    memoryMB: 256,
    environment: {
        SLACK_WEBHOOK_URL: secret('SLACK_WEBHOOK_URL'),
    },
});
