import { defineBackend } from '@aws-amplify/backend';
import { sendEmail } from './functions/send-email/resource';
import {Cors, RestApi, RestApiProps} from 'aws-cdk-lib/aws-apigateway';
import { Duration } from 'aws-cdk-lib';
import { PolicyStatement, Effect } from 'aws-cdk-lib/aws-iam';
import { LambdaIntegration } from 'aws-cdk-lib/aws-apigateway';
import { Stack } from 'aws-cdk-lib';

const backend = defineBackend({
    sendEmail,
});

// Create a fixed stage name
const STAGE_NAME = 'prod';

// Create the API stack
const apiStack = backend.createStack('api-stack');

// Create the REST API with a fixed stage
const restApi = new RestApi(apiStack, 'RestApi', {
    restApiName: 'ninescrolls-api',
    deploy: true,
    deployOptions: {
        stageName: STAGE_NAME,
    },
    defaultCorsPreflightOptions: {
        allowOrigins: Cors.ALL_ORIGINS,
        allowMethods: ['POST', 'OPTIONS'],
        allowHeaders: ['Content-Type'],
        maxAge: Duration.seconds(300),
    },
});

// Create the /sendEmail resource
const sendEmailResource = restApi.root.addResource('sendEmail');

// Add POST method to /sendEmail with CORS enabled
sendEmailResource.addMethod('POST', new LambdaIntegration(backend.sendEmail.resources.lambda, {
    proxy: true,
    integrationResponses: [{
        statusCode: '200',
        responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': "'*'",
            'method.response.header.Vary': "'Origin'"
        }
    }]
}), {
    methodResponses: [{
        statusCode: '200',
        responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
            'method.response.header.Vary': true
        }
    }]
});

// Create IAM policy for API Gateway
const apiPolicy = new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ['execute-api:Invoke'],
    resources: [`${restApi.arnForExecuteApi('POST', '/sendEmail', STAGE_NAME)}`],
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
