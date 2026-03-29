import { defineFunction, secret } from '@aws-amplify/backend';

export const submitQuestion = defineFunction({
    name: 'submit-question',
    entry: './handler.ts',
    runtime: 22,
    timeoutSeconds: 10,
    memoryMB: 256,
    resourceGroupName: 'data',
    environment: {
        TURNSTILE_SECRET_KEY: secret('TURNSTILE_SECRET_KEY'),
        SENDGRID_API_KEY: secret('SENDGRID_API_KEY'),
    },
});
