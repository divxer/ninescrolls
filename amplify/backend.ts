import { defineBackend } from '@aws-amplify/backend';
import { data } from './data/resource';
import { sendEmail } from './functions/send-email/resource';
import { createCheckoutSession } from './functions/create-checkout-session/resource';
import { stripeWebhook } from './functions/stripe-webhook/resource';
import { calculateTax } from './functions/calculate-tax/resource';
import { RestApi, AuthorizationType } from 'aws-cdk-lib/aws-apigateway';
import { LambdaIntegration } from 'aws-cdk-lib/aws-apigateway';
import { Stack } from 'aws-cdk-lib';
import { Table, AttributeType, BillingMode } from 'aws-cdk-lib/aws-dynamodb';

const backend = defineBackend({
    data,
    sendEmail,
    createCheckoutSession,
    stripeWebhook,
    calculateTax,
});

// Create a fixed stage name
const STAGE_NAME = 'prod';

// Create the API stack
const apiStack = backend.createStack('api-stack');

// Create the REST API with a fixed stage
// Note: We don't use defaultCorsPreflightOptions because we're using Lambda Proxy Integration
// CORS headers are handled directly in the Lambda functions
const restApi = new RestApi(apiStack, 'RestApi', {
    restApiName: 'ninescrolls-api',
    deploy: true,
    deployOptions: {
        stageName: STAGE_NAME,
    },
});

// Create the /sendEmail resource
const sendEmailResource = restApi.root.addResource('sendEmail');

// Add POST method to /sendEmail - Use Lambda Proxy Integration (proxy: true)
// This ensures CORS headers from Lambda are properly returned
sendEmailResource.addMethod('POST', new LambdaIntegration(backend.sendEmail.resources.lambda, {
    proxy: true,
}));

// Add OPTIONS method for CORS preflight - handled by Lambda function
sendEmailResource.addMethod('OPTIONS', new LambdaIntegration(backend.sendEmail.resources.lambda, {
    proxy: true,
}));

// Create /checkout/session resource for Stripe Checkout
const checkoutResource = restApi.root.addResource('checkout');
const checkoutSessionResource = checkoutResource.addResource('session');

// Add POST method - Use Lambda Proxy Integration (proxy: true)
// This ensures event.requestContext.http is available in the handler
checkoutSessionResource.addMethod('POST', new LambdaIntegration(backend.createCheckoutSession.resources.lambda, {
    proxy: true,
}));

// Add OPTIONS method for CORS preflight - handled by Lambda function
checkoutSessionResource.addMethod('OPTIONS', new LambdaIntegration(backend.createCheckoutSession.resources.lambda, {
    proxy: true,
}));

// Create /calculate-tax resource for tax calculation
const calculateTaxResource = restApi.root.addResource('calculate-tax');

// Add POST method for tax calculation
calculateTaxResource.addMethod('POST', new LambdaIntegration(backend.calculateTax.resources.lambda, {
    proxy: true,
}));

// Add OPTIONS method for CORS preflight
calculateTaxResource.addMethod('OPTIONS', new LambdaIntegration(backend.calculateTax.resources.lambda, {
    proxy: true,
}));

// Create /stripe/webhook resource for Stripe Webhook
// Note: Webhook endpoint should NOT have wide CORS - security is handled by signature verification
const stripeResource = restApi.root.addResource('stripe');
const stripeWebhookResource = stripeResource.addResource('webhook');

// Use Lambda Proxy Integration for webhook handler
// Note: API Gateway methods are public by default unless IAM authorization is enabled
// For webhook endpoint, we rely on Stripe signature verification for security
stripeWebhookResource.addMethod('POST', new LambdaIntegration(backend.stripeWebhook.resources.lambda, {
    proxy: true,
}), {
    authorizationType: AuthorizationType.NONE, // Explicitly make it public
});

// Create DynamoDB table for Stripe webhook idempotency
const stripeWebhookEventsTable = new Table(apiStack, 'StripeWebhookEvents', {
    partitionKey: { name: 'eventId', type: AttributeType.STRING },
    billingMode: BillingMode.PAY_PER_REQUEST,
    timeToLiveAttribute: 'ttl',
});

stripeWebhookEventsTable.grantReadWriteData(backend.stripeWebhook.resources.lambda);
backend.stripeWebhook.resources.lambda.addEnvironment('STRIPE_WEBHOOK_EVENTS_TABLE', stripeWebhookEventsTable.tableName);

// Add outputs
backend.addOutput({
    custom: {
        API: {
            [restApi.restApiName]: {
                endpoint: restApi.url,
                region: Stack.of(restApi).region,
                apiName: restApi.restApiName,
            },
        },
    },
});
