import { defineFunction, secret } from '@aws-amplify/backend';

export const createCheckoutSession = defineFunction({
  name: 'create-checkout-session',
  entry: './handler.ts',
  runtime: 20,
  environment: {
    STRIPE_SECRET_KEY: secret('STRIPE_SECRET_KEY'),
    APP_URL: process.env.APP_URL || 'https://ninescrolls.com',
  },
});
