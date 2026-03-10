import { defineFunction, secret } from '@aws-amplify/backend';

export const submitRfq = defineFunction({
    name: 'submit-rfq',
    entry: './handler.ts',
    runtime: 22,
    timeoutSeconds: 15,
    memoryMB: 256,
    environment: {
        TURNSTILE_SECRET_KEY: secret('TURNSTILE_SECRET_KEY'),
        SENDGRID_API_KEY: secret('SENDGRID_API_KEY'),
    },
});
