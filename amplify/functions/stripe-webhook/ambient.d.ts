declare module '@aws-sdk/client-dynamodb';
declare module '@aws-sdk/lib-dynamodb';

declare module '$amplify/env/stripe-webhook' {
  export const env: {
    STRIPE_SECRET_KEY: string;
    STRIPE_WEBHOOK_SECRET: string;
    SENDGRID_API_KEY: string;
    APP_URL: string;
  };
}
