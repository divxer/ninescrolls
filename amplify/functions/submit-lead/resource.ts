import { defineFunction, secret } from '@aws-amplify/backend';

export const submitLead = defineFunction({
    name: 'submit-lead',
    entry: './handler.ts',
    runtime: 22,
    timeoutSeconds: 15,
    memoryMB: 256,
    environment: {
        SENDGRID_API_KEY: secret('SENDGRID_API_KEY'),
        TURNSTILE_SECRET_KEY: secret('TURNSTILE_SECRET_KEY'),
        HUBSPOT_ACCESS_TOKEN: secret('HUBSPOT_ACCESS_TOKEN'),
    },
});
