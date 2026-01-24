import { defineFunction, secret } from '@aws-amplify/backend';

export const calculateTax = defineFunction({
  name: 'calculate-tax',
  entry: './handler.ts',
  runtime: 20,
  environment: {
    STRIPE_SECRET_KEY: secret('STRIPE_SECRET_KEY'),
  },
});
