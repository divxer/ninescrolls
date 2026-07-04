import { defineFunction, secret } from '@aws-amplify/backend';

export const orderApi = defineFunction({
    name: 'order-api',
    // Pinned to the data stack because this Lambda is an AppSync GraphQL data
    // resolver (amplify/data/resource.ts: a.handler.function(orderApi)). Left
    // in the generic `function` stack it creates a data->function edge (data
    // stack references the resolver's function ARN); combined with the growing
    // set of function->data-adjacent grants (see PR #230's crm-api addition)
    // that closes a CloudFormation cycle involving the api, data, and function
    // stacks. Moving order-api into the data stack collapses the resolver edge
    // into an intra-data reference. The intelligenceTable / OrderDocumentsBucket
    // grants this Lambda holds live in feedback-system-stack, which nothing
    // references back — so those become clean unidirectional data ->
    // feedback-system-stack edges, no new cycle. This matches Amplify's own
    // guidance ("if your function is used as data resolver, assign it to the
    // data stack") and PR #232 for the earlier optimize-insights-image analogue.
    resourceGroupName: 'data',
    entry: './handler.ts',
    runtime: 22,
    timeoutSeconds: 30,
    memoryMB: 512,
    environment: {
        SLACK_WEBHOOK_URL: secret('SLACK_WEBHOOK_URL'),
    },
});
