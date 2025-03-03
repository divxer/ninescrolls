import { defineFunction } from '@aws-amplify/backend';

export const sendEmail = defineFunction({
  entry: './handler.ts',
  environment: {
    SENDGRID_API_KEY: process.env.SENDGRID_API_KEY || ''
  }
}); 