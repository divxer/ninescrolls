import { defineFunction, secret } from '@aws-amplify/backend';

export const sendEmail = defineFunction({
    entry: './handler.ts',
    runtime: 22,
    environment: {
        SENDGRID_API_KEY: secret('SENDGRID_API_KEY'),
    },
});