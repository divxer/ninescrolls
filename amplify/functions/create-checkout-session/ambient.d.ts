declare module '@aws-sdk/client-dynamodb';
declare module '@aws-sdk/lib-dynamodb';

declare module '$amplify/env/create-checkout-session' {
  export const env: {
    STRIPE_SECRET_KEY: string;
    APP_URL: string;
  };
}
