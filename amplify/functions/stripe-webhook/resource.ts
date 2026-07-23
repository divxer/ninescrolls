import { defineFunction, secret } from '@aws-amplify/backend';

export const stripeWebhook = defineFunction({
  name: 'stripe-webhook',
  entry: './handler.ts',
  runtime: 22,
  // Default (3s) cannot cover the paid-order chain: Stripe session retrieve +
  // 2 SendGrid emails + RequestResponse invoke of order-api (transaction, org
  // upsert, Slack, CRM emit, visitor bridge + bounded sync reResolve). 25s
  // stays under API Gateway's 29s integration cap so Stripe sees our response.
  timeoutSeconds: 25,
  environment: {
    STRIPE_SECRET_KEY: secret('STRIPE_SECRET_KEY'),
    STRIPE_WEBHOOK_SECRET: secret('STRIPE_WEBHOOK_SECRET'),
    SENDGRID_API_KEY: secret('SENDGRID_API_KEY'),
    APP_URL: process.env.APP_URL || 'https://ninescrolls.com',
  },
});
