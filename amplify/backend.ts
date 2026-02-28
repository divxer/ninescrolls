import { defineBackend } from '@aws-amplify/backend';
import { data } from './data/resource';
import { sendEmail } from './functions/send-email/resource';
import { createCheckoutSession } from './functions/create-checkout-session/resource';
import { stripeWebhook } from './functions/stripe-webhook/resource';
import { calculateTax } from './functions/calculate-tax/resource';
import { subscribeNewsletter } from './functions/subscribe-newsletter/resource';
import { segmentProxy } from './functions/segment-proxy/resource';
import { ipLookup } from './functions/ip-lookup/resource';
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
    subscribeNewsletter,
    segmentProxy,
    ipLookup,
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

// Create /subscribe resource for newsletter subscription
const subscribeResource = restApi.root.addResource('subscribe');

// Add POST method for newsletter subscription
subscribeResource.addMethod('POST', new LambdaIntegration(backend.subscribeNewsletter.resources.lambda, {
    proxy: true,
}));

// Add OPTIONS method for CORS preflight
subscribeResource.addMethod('OPTIONS', new LambdaIntegration(backend.subscribeNewsletter.resources.lambda, {
    proxy: true,
}));

// Create DynamoDB table for newsletter subscribers
const subscribeFunctionStack = Stack.of(backend.subscribeNewsletter.resources.lambda);
const newsletterSubscribersTable = new Table(subscribeFunctionStack, 'NewsletterSubscribers', {
    partitionKey: { name: 'email', type: AttributeType.STRING },
    billingMode: BillingMode.PAY_PER_REQUEST,
});

newsletterSubscribersTable.grantReadWriteData(backend.subscribeNewsletter.resources.lambda);
backend.subscribeNewsletter.addEnvironment('NEWSLETTER_SUBSCRIBERS_TABLE', newsletterSubscribersTable.tableName);

// Create /ip-lookup resource for server-side IP geolocation and target customer analysis
// Moves IP lookups from frontend (CORS issues, rate limits) to Lambda (no restrictions)
const ipLookupResource = restApi.root.addResource('ip-lookup');
const ipLookupIntegration = new LambdaIntegration(backend.ipLookup.resources.lambda, {
    proxy: true,
});

// Add GET method for IP lookup
ipLookupResource.addMethod('GET', ipLookupIntegration);

// Add OPTIONS method for CORS preflight
ipLookupResource.addMethod('OPTIONS', ipLookupIntegration);

// Create /seg resource for Segment analytics proxy
// Proxies requests to cdn.segment.com and api.segment.io through first-party domain
// to avoid network-level blocking by government/enterprise firewalls
const segResource = restApi.root.addResource('seg');
const segmentProxyIntegration = new LambdaIntegration(backend.segmentProxy.resources.lambda, {
    proxy: true,
});

// CDN proxy: /seg/cdn/{proxy+} -> cdn.segment.com/{proxy}
const segCdnResource = segResource.addResource('cdn');
segCdnResource.addProxy({
    defaultIntegration: segmentProxyIntegration,
    anyMethod: true,
});

// API proxy: /seg/v1/{proxy+} -> api.segment.io/v1/{proxy}
const segV1Resource = segResource.addResource('v1');
segV1Resource.addProxy({
    defaultIntegration: segmentProxyIntegration,
    anyMethod: true,
});

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

// Create DynamoDB table for Stripe webhook idempotency in the same stack as the function
const stripeWebhookFunctionStack = Stack.of(backend.stripeWebhook.resources.lambda);
const stripeWebhookEventsTable = new Table(stripeWebhookFunctionStack, 'StripeWebhookEvents', {
    partitionKey: { name: 'eventId', type: AttributeType.STRING },
    billingMode: BillingMode.PAY_PER_REQUEST,
    timeToLiveAttribute: 'ttl',
});

stripeWebhookEventsTable.grantReadWriteData(backend.stripeWebhook.resources.lambda);
backend.stripeWebhook.addEnvironment('STRIPE_WEBHOOK_EVENTS_TABLE', stripeWebhookEventsTable.tableName);

// Create DynamoDB table for persisted orders (same stack as webhook to avoid circular deps)
const stripeOrdersTable = new Table(stripeWebhookFunctionStack, 'StripeOrders', {
    partitionKey: { name: 'orderId', type: AttributeType.STRING },
    billingMode: BillingMode.PAY_PER_REQUEST,
});

stripeOrdersTable.grantReadWriteData(backend.stripeWebhook.resources.lambda);
backend.stripeWebhook.addEnvironment('STRIPE_ORDERS_TABLE', stripeOrdersTable.tableName);

// Create DynamoDB tables for simple rate limiting (per function stack to avoid circular deps)
const checkoutFunctionStack = Stack.of(backend.createCheckoutSession.resources.lambda);
const checkoutRateLimitTable = new Table(checkoutFunctionStack, 'CheckoutRateLimit', {
    partitionKey: { name: 'key', type: AttributeType.STRING },
    billingMode: BillingMode.PAY_PER_REQUEST,
    timeToLiveAttribute: 'ttl',
});
checkoutRateLimitTable.grantReadWriteData(backend.createCheckoutSession.resources.lambda);
backend.createCheckoutSession.addEnvironment('CHECKOUT_RATE_LIMIT_TABLE', checkoutRateLimitTable.tableName);

const taxFunctionStack = Stack.of(backend.calculateTax.resources.lambda);
const taxRateLimitTable = new Table(taxFunctionStack, 'TaxRateLimit', {
    partitionKey: { name: 'key', type: AttributeType.STRING },
    billingMode: BillingMode.PAY_PER_REQUEST,
    timeToLiveAttribute: 'ttl',
});
taxRateLimitTable.grantReadWriteData(backend.calculateTax.resources.lambda);
backend.calculateTax.addEnvironment('TAX_RATE_LIMIT_TABLE', taxRateLimitTable.tableName);

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
