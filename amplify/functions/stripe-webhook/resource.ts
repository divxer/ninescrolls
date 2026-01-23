import { defineFunction, secret } from '@aws-amplify/backend';

export const stripeWebhook = defineFunction({
  name: 'stripe-webhook',
  entry: './handler.ts',
  runtime: 20,
  environment: {
    STRIPE_SECRET_KEY: secret('STRIPE_SECRET_KEY'),
    STRIPE_WEBHOOK_SECRET: secret('STRIPE_WEBHOOK_SECRET'),
  },
});
