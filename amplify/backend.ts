import { defineBackend } from '@aws-amplify/backend';
import { data } from './data/resource';
import { sendEmail } from './functions/send-email/resource';
import { createCheckoutSession } from './functions/create-checkout-session/resource';
import { stripeWebhook } from './functions/stripe-webhook/resource';
import {Cors, RestApi, RestApiProps} from 'aws-cdk-lib/aws-apigateway';
import { Duration } from 'aws-cdk-lib';
import { LambdaIntegration } from 'aws-cdk-lib/aws-apigateway';
import { Stack } from 'aws-cdk-lib';

const backend = defineBackend({
    data,
    sendEmail,
    createCheckoutSession,
    stripeWebhook,
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

// Add POST method to /sendEmail with CORS enabled
sendEmailResource.addMethod('POST', new LambdaIntegration(backend.sendEmail.resources.lambda, {
    proxy: false,
    integrationResponses: [{
        statusCode: '200',
        responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': "'*'",  // Correct way to allow all origins
            'method.response.header.Access-Control-Allow-Methods': "'POST'",
            'method.response.header.Access-Control-Allow-Headers': "'Content-Type'",
            'method.response.header.Access-Control-Max-Age': "'300'"
        }
    }]
}), {
    methodResponses: [{
        statusCode: '200',
        responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
            'method.response.header.Access-Control-Allow-Methods': true,
            'method.response.header.Access-Control-Allow-Headers': true,
            'method.response.header.Access-Control-Max-Age': true
        }
    }]
});

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
    // Explicitly set authorization type to NONE to ensure public access
    authorizationType: undefined, // This makes it public
});

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
