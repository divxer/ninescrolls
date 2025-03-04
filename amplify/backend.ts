import { defineBackend } from '@aws-amplify/backend';
import { Stack, Duration } from 'aws-cdk-lib';
import {
  Cors,
  LambdaIntegration,
  RestApi,
} from 'aws-cdk-lib/aws-apigateway';
import { Policy, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { sendEmail } from './functions/send-email/resource';

const backend = defineBackend({
  sendEmail,
});

// create a new API stack
const apiStack = backend.createStack('api-stack');

// create a new REST API
const restApi = new RestApi(apiStack, 'RestApi', {
  restApiName: 'ninescrolls-api',
  deploy: true,
  deployOptions: {
    stageName: 'dev',
  },
  defaultCorsPreflightOptions: {
    allowOrigins: ['http://localhost:5173', 'https://ninescrolls.com'],
    allowMethods: ['POST'],
    allowHeaders: ['Content-Type'],
    maxAge: Duration.seconds(300),
  },
});

// create a new Lambda integration
const lambdaIntegration = new LambdaIntegration(
  backend.sendEmail.resources.lambda
);

// create a new resource path for sending emails
const emailPath = restApi.root.addResource('sendEmail');
emailPath.addMethod('POST', lambdaIntegration);

// create a new IAM policy to allow Invoke access to the API
const apiRestPolicy = new Policy(apiStack, 'RestApiPolicy', {
  statements: [
    new PolicyStatement({
      actions: ['execute-api:Invoke'],
      resources: [
        `${restApi.arnForExecuteApi('POST', '/sendEmail', 'dev')}`,
      ],
    }),
  ],
});

// add outputs to the configuration file
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
