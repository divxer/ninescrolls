import { defineFunction, secret } from '@aws-amplify/backend';

export const subscribeNewsletter = defineFunction({
    name: 'subscribe-newsletter',
    entry: './handler.ts',
    runtime: 20,
    environment: {
        SENDGRID_API_KEY: secret('SENDGRID_API_KEY'),
    },
});
