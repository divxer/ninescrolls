import { defineFunction, secret } from '@aws-amplify/backend';

export const sendEmail = defineFunction({
    entry: './handler.ts',
    environment: {
        SENDGRID_API_KEY: secret('SENDGRID_API_KEY'),
        FROM_EMAIL: 'noreply@ninescrolls.com',
        TO_EMAIL: 'info@ninescrolls.com',
        REPLY_TO_EMAIL: 'info@ninescrolls.com'
    },
});