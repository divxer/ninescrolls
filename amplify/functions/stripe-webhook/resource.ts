import { defineFunction, secret } from '@aws-amplify/backend';

export const stripeWebhook = defineFunction({
  name: 'stripe-webhook',
  entry: './handler.ts',
  runtime: 20,
  resourceGroupName: 'api-stack',
  environment: {
    STRIPE_SECRET_KEY: secret('STRIPE_SECRET_KEY'),
    STRIPE_WEBHOOK_SECRET: secret('STRIPE_WEBHOOK_SECRET'),
    SENDGRID_API_KEY: secret('SENDGRID_API_KEY'),
    APP_URL: process.env.APP_URL || 'https://ninescrolls.com',
  },
});
