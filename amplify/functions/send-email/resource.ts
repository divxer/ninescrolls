import { defineFunction, secret } from '@aws-amplify/backend';

export const sendEmail = defineFunction({
    entry: './handler.ts',
    environment: {
        SENDGRID_API_KEY: secret('SENDGRID_API_KEY'),
    },
});