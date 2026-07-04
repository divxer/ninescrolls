import { defineFunction, secret } from '@aws-amplify/backend';

export const orderApi = defineFunction({
    name: 'order-api',
    // Pinned to the data stack because this Lambda is BOTH an AppSync GraphQL
    // data resolver (amplify/data/resource.ts: a.handler.function(orderApi))
    // AND a data-stack table consumer (intelligenceTable grant). Left in the
    // generic `function` stack it forms two edges — data->function (schema
    // wiring the resolver) and function->data (the table grant) — closing a
    // CloudFormation cycle between the api, data, and function stacks. Moving
    // it into the data stack collapses both edges into intra-stack refs. This
    // matches Amplify's own guidance: "if your function is used as data
    // resolver or calls data API, assign this function to data stack."
    // See PR #232 for the earlier optimize-insights-image analogue.
    resourceGroupName: 'data',
    entry: './handler.ts',
    runtime: 22,
    timeoutSeconds: 30,
    memoryMB: 512,
    environment: {
        SLACK_WEBHOOK_URL: secret('SLACK_WEBHOOK_URL'),
    },
});
