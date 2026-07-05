import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { createCheckoutSession } from './functions/create-checkout-session/resource';
import { stripeWebhook } from './functions/stripe-webhook/resource';
import { calculateTax } from './functions/calculate-tax/resource';
import { ipLookup } from './functions/ip-lookup/resource';
import { serverTrack } from './functions/server-track/resource';
import { classifyOrg } from './functions/classify-org/resource';
import { generateArticleMeta } from './functions/generate-article-meta/resource';
import { submitRfq } from './functions/submit-rfq/resource';
import { convertRfqToOrder } from './functions/convert-rfq-to-order/resource';
import { updateOrderStatus } from './functions/update-order-status/resource';
import { documentUpload } from './functions/document-upload/resource';
import { orderApi } from './functions/order-api/resource';
import { logisticsApi } from './functions/logistics-api/resource';
import { crmApi } from './functions/crm-api/resource';
import { optimizeInsightsImage } from './functions/optimize-insights-image/resource';
import { generateSitemaps } from './functions/generate-sitemaps/resource';
import { submitLead } from './functions/submit-lead/resource';
import { submitQuestion } from './functions/submit-question/resource';
import { organizationApi } from './functions/organization-api/resource';
import { tenderApi } from './functions/tender-api/resource';
// Tender Watch — Phase 1
import { fetchSam } from './functions/fetch-sam/resource';
import { fetchTed } from './functions/fetch-ted/resource';
import { fetchCalusource } from './functions/fetch-calusource/resource';
import { fetchUofa } from './functions/fetch-uofa/resource';
import { fetchTxesbd } from './functions/fetch-txesbd/resource';
import { fetchNyscr } from './functions/fetch-nyscr/resource';
import { fetchUwisc } from './functions/fetch-uwisc/resource';
import { normalizeDedupe } from './functions/normalize-dedupe/resource';
import { prefilterByKeyword } from './functions/prefilter-by-keyword/resource';
import { matchWithLlm } from './functions/match-with-llm/resource';
import { classifyAndStore } from './functions/classify-and-store/resource';
import { notifyHighPriority } from './functions/notify-high-priority/resource';
import { notifyDailyDigest } from './functions/notify-daily-digest/resource';
import { recordPipelineRun } from './functions/record-pipeline-run/resource';
import { notifyPipelineHealth } from './functions/notify-pipeline-health/resource';
import { expireOldTenders } from './functions/expire-old-tenders/resource';
import { RestApi, AuthorizationType } from 'aws-cdk-lib/aws-apigateway';
import { Alarm, ComparisonOperator, TreatMissingData } from 'aws-cdk-lib/aws-cloudwatch';
import { SnsAction } from 'aws-cdk-lib/aws-cloudwatch-actions';
import { MetricFilter, FilterPattern } from 'aws-cdk-lib/aws-logs';
import { Topic } from 'aws-cdk-lib/aws-sns';
import { LambdaIntegration } from 'aws-cdk-lib/aws-apigateway';
import { Stack } from 'aws-cdk-lib';
import { Table, AttributeType, BillingMode, ProjectionType } from 'aws-cdk-lib/aws-dynamodb';
import { Bucket, BlockPublicAccess, BucketEncryption, HttpMethods } from 'aws-cdk-lib/aws-s3';
import { Duration } from 'aws-cdk-lib';
import { LayerVersion, Code, Runtime } from 'aws-cdk-lib/aws-lambda';
import { PolicyStatement, Effect } from 'aws-cdk-lib/aws-iam';
import type { ILocalBundling } from 'aws-cdk-lib';
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
    Distribution, ViewerProtocolPolicy, CachePolicy, OriginAccessIdentity,
    AllowedMethods, CachedMethods, HttpVersion,
} from 'aws-cdk-lib/aws-cloudfront';
import { S3Origin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { Certificate } from 'aws-cdk-lib/aws-certificatemanager';
import {
    StateMachine, StateMachineType, Pass, Parallel, Map as SfnMap,
    Choice, Condition, JsonPath, LogLevel, TaskInput, Result,
} from 'aws-cdk-lib/aws-stepfunctions';
import { LambdaInvoke } from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Rule, Schedule, RuleTargetInput } from 'aws-cdk-lib/aws-events';
import { LambdaFunction as LambdaFunctionTarget, SfnStateMachine } from 'aws-cdk-lib/aws-events-targets';

/** Single source of truth for the CDN custom domain */
const CDN_DOMAIN = 'cdn.ninescrolls.com';

const backend = defineBackend({
    auth,
    data,
    createCheckoutSession,
    stripeWebhook,
    calculateTax,
    ipLookup,
    serverTrack,
    classifyOrg,
    generateArticleMeta,
    submitRfq,
    convertRfqToOrder,
    updateOrderStatus,
    documentUpload,
    orderApi,
    logisticsApi,
    crmApi,
    optimizeInsightsImage,
    generateSitemaps,
    submitLead,
    submitQuestion,
    organizationApi,
    tenderApi,

    // Tender Watch — Phase 1
    fetchSam,
    fetchTed,
    fetchCalusource,
    fetchUofa,
    fetchTxesbd,
    fetchNyscr,
    fetchUwisc,
    normalizeDedupe,
    prefilterByKeyword,
    matchWithLlm,
    classifyAndStore,
    notifyHighPriority,
    notifyDailyDigest,
    recordPipelineRun,
    notifyPipelineHealth,
    expireOldTenders,
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

// Create DynamoDB table for newsletter subscribers (in submit-lead stack to avoid circular deps)
const submitLeadStack = Stack.of(backend.submitLead.resources.lambda);
const newsletterSubscribersTable = new Table(submitLeadStack, 'NewsletterSubscribers', {
    partitionKey: { name: 'email', type: AttributeType.STRING },
    billingMode: BillingMode.PAY_PER_REQUEST,
});

// Create /geo resource for server-side IP geolocation and target customer analysis
// Moves IP lookups from frontend (CORS issues, rate limits) to Lambda (no restrictions)
const ipLookupResource = restApi.root.addResource('geo');
const ipLookupIntegration = new LambdaIntegration(backend.ipLookup.resources.lambda, {
    proxy: true,
});

// Add GET method for IP lookup
ipLookupResource.addMethod('GET', ipLookupIntegration);

// Add OPTIONS method for CORS preflight
ipLookupResource.addMethod('OPTIONS', ipLookupIntegration);

// Create /d resource for server-side Segment event tracking
// Path deliberately non-obvious to avoid ad blocker filter lists that match
// common analytics paths like /track, /collect, /event, /beacon, /analytics
const dResource = restApi.root.addResource('d');
const serverTrackIntegration = new LambdaIntegration(backend.serverTrack.resources.lambda, {
    proxy: true,
});

// Add POST method for tracking events
dResource.addMethod('POST', serverTrackIntegration);

// Add GET method for noscript bot-tracking pixel
dResource.addMethod('GET', serverTrackIntegration);

// Add OPTIONS method for CORS preflight
dResource.addMethod('OPTIONS', serverTrackIntegration);

// Pass the Segment write key to the server-track Lambda
backend.serverTrack.addEnvironment('SEGMENT_WRITE_KEY', 'WMoEScvR6dgChGx0LQUz0wQhgXK4nAHU');

// Grant server-track Lambda write access to AnalyticsEvent table for pagehide flush.
// During page unload, the frontend sends page_time_flush via sendBeacon to /d;
// the Lambda writes to DynamoDB as the authoritative store alongside Segment.
const analyticsEventTable = backend.data.resources.tables['AnalyticsEvent'];
analyticsEventTable.grantReadWriteData(backend.serverTrack.resources.lambda);
backend.serverTrack.addEnvironment('ANALYTICS_EVENT_TABLE', analyticsEventTable.tableName);
// 2C-analytics: crm-api reads raw analytics (page_time_flush / pv- rows) for the session rollup.
analyticsEventTable.grantReadData(backend.crmApi.resources.lambda);
backend.crmApi.addEnvironment('ANALYTICS_EVENT_TABLE', analyticsEventTable.tableName);
// Feature flag: set to 'false' to disable ALL DDB writes (page_view, page_time_flush, ai_enrichment)
backend.serverTrack.addEnvironment('ENABLE_DDB_WRITE', 'true');

// Pass GraphQL endpoint + API key so server-track can call publishAnalyticsEvent mutation
// (triggers onAnalyticsEvent subscription for real-time admin dashboard)
const cfnGraphqlApi = backend.data.resources.cfnResources.cfnGraphqlApi;
backend.serverTrack.addEnvironment('GRAPHQL_ENDPOINT', cfnGraphqlApi.attrGraphQlUrl);
backend.serverTrack.addEnvironment('GRAPHQL_API_KEY', backend.data.apiKey ?? '');

// Grant server-track Lambda permission to invoke classify-org Lambda
// (server-side IP lookup + AI classification pipeline)
backend.serverTrack.resources.lambda.addToRolePolicy(new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ['lambda:InvokeFunction'],
    resources: [backend.classifyOrg.resources.lambda.functionArn],
}));
backend.serverTrack.addEnvironment(
    'CLASSIFY_ORG_FUNCTION_NAME',
    backend.classifyOrg.resources.lambda.functionName,
);

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

// Create /resolve resource for AI-powered organization classification
const classifyOrgResource = restApi.root.addResource('resolve');
const classifyOrgIntegration = new LambdaIntegration(backend.classifyOrg.resources.lambda, {
    proxy: true,
});

// Add POST method for org classification
classifyOrgResource.addMethod('POST', classifyOrgIntegration);

// Add OPTIONS method for CORS preflight
classifyOrgResource.addMethod('OPTIONS', classifyOrgIntegration);

// Create DynamoDB table for caching AI org classifications
const classifyOrgFunctionStack = Stack.of(backend.classifyOrg.resources.lambda);
const orgClassificationTable = new Table(classifyOrgFunctionStack, 'OrgClassification', {
    partitionKey: { name: 'orgName', type: AttributeType.STRING },
    billingMode: BillingMode.PAY_PER_REQUEST,
    timeToLiveAttribute: 'ttl',
});

orgClassificationTable.grantReadWriteData(backend.classifyOrg.resources.lambda);
backend.classifyOrg.addEnvironment('ORG_CLASSIFICATION_TABLE', orgClassificationTable.tableName);

// Grant classify-org Lambda permission to invoke Bedrock models
backend.classifyOrg.resources.lambda.addToRolePolicy(new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ['bedrock:InvokeModel'],
    resources: [
        'arn:aws:bedrock:*::foundation-model/anthropic.claude-*',
        'arn:aws:bedrock:*:*:inference-profile/us.anthropic.claude-*',
    ],
}));

// Grant AWS Marketplace permissions required for Bedrock model access validation
backend.classifyOrg.resources.lambda.addToRolePolicy(new PolicyStatement({
    effect: Effect.ALLOW,
    actions: [
        'aws-marketplace:ViewSubscriptions',
        'aws-marketplace:Subscribe',
    ],
    resources: ['*'],
}));

// Create /generate-article-meta resource for AI-powered article excerpt & tags generation
const generateArticleMetaResource = restApi.root.addResource('generate-article-meta');
const generateArticleMetaIntegration = new LambdaIntegration(backend.generateArticleMeta.resources.lambda, {
    proxy: true,
});

// Add POST method for article meta generation
generateArticleMetaResource.addMethod('POST', generateArticleMetaIntegration);

// Add OPTIONS method for CORS preflight
generateArticleMetaResource.addMethod('OPTIONS', generateArticleMetaIntegration);

// Create /api/rfq resource for RFQ submissions
const apiResource = restApi.root.addResource('api');
const rfqResource = apiResource.addResource('rfq');
const submitRfqIntegration = new LambdaIntegration(backend.submitRfq.resources.lambda, {
    proxy: true,
});

// Add POST method for RFQ submission
rfqResource.addMethod('POST', submitRfqIntegration);

// Add OPTIONS method for CORS preflight
rfqResource.addMethod('OPTIONS', submitRfqIntegration);

// Create /api/rfq/convert resource for converting RFQ to Order
const rfqConvertResource = rfqResource.addResource('convert');
const convertRfqIntegration = new LambdaIntegration(backend.convertRfqToOrder.resources.lambda, {
    proxy: true,
});
rfqConvertResource.addMethod('POST', convertRfqIntegration);
rfqConvertResource.addMethod('OPTIONS', convertRfqIntegration);

// Create /api/orders/status resource for order status updates
const ordersResource = apiResource.addResource('orders');
const orderStatusResource = ordersResource.addResource('status');
const updateOrderStatusIntegration = new LambdaIntegration(backend.updateOrderStatus.resources.lambda, {
    proxy: true,
});
orderStatusResource.addMethod('POST', updateOrderStatusIntegration);
orderStatusResource.addMethod('OPTIONS', updateOrderStatusIntegration);

// Create /api/documents resource for document upload operations
const documentsResource = apiResource.addResource('documents');
const documentUploadIntegration = new LambdaIntegration(backend.documentUpload.resources.lambda, {
    proxy: true,
});
documentsResource.addMethod('POST', documentUploadIntegration);
documentsResource.addMethod('OPTIONS', documentUploadIntegration);

// Create /api/leads resource for unified lead submissions
const leadsResource = apiResource.addResource('leads');
const submitLeadIntegration = new LambdaIntegration(backend.submitLead.resources.lambda, {
    proxy: true,
});
leadsResource.addMethod('POST', submitLeadIntegration);
leadsResource.addMethod('OPTIONS', submitLeadIntegration);

// Create /api/questions resource for article Q&A submissions
const questionsResource = apiResource.addResource('questions');
const submitQuestionIntegration = new LambdaIntegration(backend.submitQuestion.resources.lambda, {
    proxy: true,
});
questionsResource.addMethod('POST', submitQuestionIntegration);
questionsResource.addMethod('OPTIONS', submitQuestionIntegration);

// Grant submit-question Lambda access to ArticleQuestion table
const articleQuestionTable = backend.data.resources.tables['ArticleQuestion'];
articleQuestionTable.grantReadWriteData(backend.submitQuestion.resources.lambda);
backend.submitQuestion.addEnvironment('ARTICLE_QUESTION_TABLE', articleQuestionTable.tableName);

// =============================================================================
// NineScrolls-Intelligence: Single-table design for Feedback System
// Entities: FEEDBACK, ORDER, ORDER_CONTACT, ORDER_LOG, ORDER_DOCUMENT, RFQ_SUBMISSION
// See docs/NineScrolls-Feedback-System-Architecture.md §3.1, §12.3, §12.10.4
// =============================================================================

const feedbackStack = backend.createStack('feedback-system-stack');

const intelligenceTable = new Table(feedbackStack, 'NineScrollsIntelligence', {
    partitionKey: { name: 'PK', type: AttributeType.STRING },
    sortKey: { name: 'SK', type: AttributeType.STRING },
    billingMode: BillingMode.PAY_PER_REQUEST,
    pointInTimeRecovery: true,
    timeToLiveAttribute: 'TTL',
});

// GSI1: Type/Status queries
// - FEEDBACK: GSI1PK=FEEDBACK_TYPE#<type>, GSI1SK=<timestamp>#<feedbackId>
// - ORDER:    GSI1PK=ORDER_STATUS#<status>, GSI1SK=<quoteDate>#<orderId>
// - RFQ:      GSI1PK=RFQ_STATUS#<status>, GSI1SK=<submittedAt>#<rfqId>
intelligenceTable.addGlobalSecondaryIndex({
    indexName: 'GSI1',
    partitionKey: { name: 'GSI1PK', type: AttributeType.STRING },
    sortKey: { name: 'GSI1SK', type: AttributeType.STRING },
    projectionType: ProjectionType.ALL,
});

// GSI2: Organization queries
// - FEEDBACK: GSI2PK=ORG#<orgId>, GSI2SK=FEEDBACK#<timestamp>
// - ORDER:    GSI2PK=ORG#<orgId>, GSI2SK=ORDER#<quoteDate>
// - RFQ:      GSI2PK=ORG#<orgId>, GSI2SK=RFQ#<submittedAt>
intelligenceTable.addGlobalSecondaryIndex({
    indexName: 'GSI2',
    partitionKey: { name: 'GSI2PK', type: AttributeType.STRING },
    sortKey: { name: 'GSI2SK', type: AttributeType.STRING },
    projectionType: ProjectionType.ALL,
});

// GSI3: Order → Feedback association
// - FEEDBACK: GSI3PK=ORDER#<orderId>, GSI3SK=FEEDBACK#<timestamp>
intelligenceTable.addGlobalSecondaryIndex({
    indexName: 'GSI3',
    partitionKey: { name: 'GSI3PK', type: AttributeType.STRING },
    sortKey: { name: 'GSI3SK', type: AttributeType.STRING },
    projectionType: ProjectionType.ALL,
});

// GSI4: Email-based customer timeline (cross-entity aggregation)
// - LEAD:  GSI4PK=EMAIL#<normalized_email>, GSI4SK=LEAD#<submittedAt>
// - RFQ:   GSI4PK=EMAIL#<normalized_email>, GSI4SK=RFQ#<submittedAt>
// - ORDER: GSI4PK=EMAIL#<normalized_email>, GSI4SK=ORDER#<createdAt>
intelligenceTable.addGlobalSecondaryIndex({
    indexName: 'GSI4',
    partitionKey: { name: 'GSI4PK', type: AttributeType.STRING },
    sortKey: { name: 'GSI4SK', type: AttributeType.STRING },
    projectionType: ProjectionType.ALL,
});

// GSI5: Pipeline run history for tender-watch operational monitoring.
intelligenceTable.addGlobalSecondaryIndex({
    indexName: 'GSI5',
    partitionKey: { name: 'GSI5PK', type: AttributeType.STRING },
    sortKey: { name: 'GSI5SK', type: AttributeType.STRING },
    projectionType: ProjectionType.ALL,
});

// =============================================================================
// S3 Bucket: Order & RFQ document storage
// Directory structure: orders/<orderId>/<stage>/, rfqs/<rfqId>/, temp/
// See docs/NineScrolls-Feedback-System-Architecture.md §12.9.3
// =============================================================================

const orderDocumentsBucket = new Bucket(feedbackStack, 'OrderDocumentsBucket', {
    blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
    encryption: BucketEncryption.S3_MANAGED,
    versioned: true,
    cors: [
        {
            allowedHeaders: ['*'],
            allowedMethods: [HttpMethods.GET, HttpMethods.PUT, HttpMethods.POST],
            allowedOrigins: [
                'https://ninescrolls.com',
                'https://www.ninescrolls.com',
                'https://admin.ninescrolls.com',
                'http://localhost:5173',
            ],
            exposedHeaders: ['ETag'],
            maxAge: 3600,
        },
    ],
    lifecycleRules: [
        {
            id: 'cleanup-temp-uploads',
            prefix: 'temp/',
            expiration: Duration.days(1),
            enabled: true,
        },
    ],
});

// =============================================================================
// Grant submit-rfq Lambda access to Intelligence table + S3 bucket
// =============================================================================
intelligenceTable.grantReadWriteData(backend.submitRfq.resources.lambda);
backend.submitRfq.addEnvironment('INTELLIGENCE_TABLE', intelligenceTable.tableName);

orderDocumentsBucket.grantReadWrite(backend.submitRfq.resources.lambda);
backend.submitRfq.addEnvironment('DOCUMENTS_BUCKET', orderDocumentsBucket.bucketName);

// Grant convert-rfq-to-order Lambda access
intelligenceTable.grantReadWriteData(backend.convertRfqToOrder.resources.lambda);
backend.convertRfqToOrder.addEnvironment('INTELLIGENCE_TABLE', intelligenceTable.tableName);
orderDocumentsBucket.grantReadWrite(backend.convertRfqToOrder.resources.lambda);
backend.convertRfqToOrder.addEnvironment('DOCUMENTS_BUCKET', orderDocumentsBucket.bucketName);

// Grant update-order-status Lambda access
intelligenceTable.grantReadWriteData(backend.updateOrderStatus.resources.lambda);
backend.updateOrderStatus.addEnvironment('INTELLIGENCE_TABLE', intelligenceTable.tableName);

// Grant document-upload Lambda access
intelligenceTable.grantReadWriteData(backend.documentUpload.resources.lambda);
backend.documentUpload.addEnvironment('INTELLIGENCE_TABLE', intelligenceTable.tableName);
orderDocumentsBucket.grantReadWrite(backend.documentUpload.resources.lambda);
backend.documentUpload.addEnvironment('DOCUMENTS_BUCKET', orderDocumentsBucket.bucketName);

// Grant order-api Lambda access (AppSync GraphQL resolvers for admin dashboard)
intelligenceTable.grantReadWriteData(backend.orderApi.resources.lambda);
backend.orderApi.addEnvironment('INTELLIGENCE_TABLE', intelligenceTable.tableName);
orderDocumentsBucket.grantReadWrite(backend.orderApi.resources.lambda);
backend.orderApi.addEnvironment('DOCUMENTS_BUCKET', orderDocumentsBucket.bucketName);

// Grant logistics-api Lambda access (Logistics Cases ledger — shared single table)
intelligenceTable.grantReadWriteData(backend.logisticsApi.resources.lambda);
backend.logisticsApi.addEnvironment('INTELLIGENCE_TABLE', intelligenceTable.tableName);

// Grant crm-api Lambda access (Customer 360 Timeline — shared single table)
intelligenceTable.grantReadWriteData(backend.crmApi.resources.lambda);
backend.crmApi.addEnvironment('INTELLIGENCE_TABLE', intelligenceTable.tableName);

// Grant submit-lead Lambda access to Intelligence table + Newsletter table
intelligenceTable.grantReadWriteData(backend.submitLead.resources.lambda);
backend.submitLead.addEnvironment('INTELLIGENCE_TABLE', intelligenceTable.tableName);
newsletterSubscribersTable.grantReadWriteData(backend.submitLead.resources.lambda);
backend.submitLead.addEnvironment('NEWSLETTER_SUBSCRIBERS_TABLE', newsletterSubscribersTable.tableName);

// =============================================================================
// S3 Bucket: Insights article image assets
// Directory structure: insights/<slug>/<prefix>-<size>.<ext>, temp/<slug>/
// =============================================================================

const insightsAssetsStack = backend.createStack('insights-assets-stack');

const insightsAssetsBucket = new Bucket(insightsAssetsStack, 'InsightsAssetsBucket', {
    blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
    encryption: BucketEncryption.S3_MANAGED,
    versioned: true,
    cors: [
        {
            allowedHeaders: ['*'],
            allowedMethods: [HttpMethods.GET, HttpMethods.PUT, HttpMethods.POST],
            allowedOrigins: [
                'https://admin.ninescrolls.com',
                'https://ninescrolls.com',
                'http://localhost:5173',
            ],
            exposedHeaders: ['ETag'],
            maxAge: 3600,
        },
    ],
    lifecycleRules: [
        {
            id: 'cleanup-temp-uploads',
            prefix: 'temp/',
            expiration: Duration.days(1),
            enabled: true,
        },
    ],
});

// =============================================================================
// CloudFront: CDN for insights image assets
// Serves optimized images publicly via OAI (Origin Access Identity)
// =============================================================================

const oai = new OriginAccessIdentity(insightsAssetsStack, 'InsightsAssetsOAI', {
    comment: 'OAI for NineScrolls insights image assets',
});

insightsAssetsBucket.grantRead(oai);

// Existing wildcard cert *.ninescrolls.com in us-east-1 (required by CloudFront)
const cdnCertificate = Certificate.fromCertificateArn(
    insightsAssetsStack,
    'CdnCertificate',
    'arn:aws:acm:us-east-1:897729106341:certificate/9e1bd92b-c8df-4ad8-aa23-0559db3a82d9',
);

// `cdn.ninescrolls.com` alias is globally unique across CloudFront distributions.
// In Amplify sandbox, the prod distribution already owns the alias, so we skip the
// custom domain here and let sandbox use the default *.cloudfront.net URL. Branch
// deploys (including main = prod) keep the custom domain.
const isSandbox = backend.stack.stackName.includes('-sandbox-');

const insightsAssetsCdn = new Distribution(insightsAssetsStack, 'InsightsAssetsCdn', {
    defaultBehavior: {
        origin: new S3Origin(insightsAssetsBucket, { originAccessIdentity: oai }),
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: AllowedMethods.ALLOW_GET_HEAD,
        cachedMethods: CachedMethods.CACHE_GET_HEAD,
        cachePolicy: CachePolicy.CACHING_OPTIMIZED,
        compress: true,
    },
    ...(isSandbox ? {} : { domainNames: [CDN_DOMAIN], certificate: cdnCertificate }),
    httpVersion: HttpVersion.HTTP2_AND_3,
    comment: 'NineScrolls insights image assets CDN',
});

// =============================================================================
// Grant optimize-insights-image Lambda access to S3 bucket
// =============================================================================

insightsAssetsBucket.grantReadWrite(backend.optimizeInsightsImage.resources.lambda);
backend.optimizeInsightsImage.addEnvironment('INSIGHTS_ASSETS_BUCKET', insightsAssetsBucket.bucketName);
backend.optimizeInsightsImage.addEnvironment(
    'CDN_BASE_URL',
    isSandbox ? `https://${insightsAssetsCdn.distributionDomainName}` : `https://${CDN_DOMAIN}`,
);

// =============================================================================
// Lambda Layer: Sharp image processing library (linux-x64)
// Local bundling installs sharp for Linux even on macOS dev machines.
// Falls back to Docker bundling if local npm fails.
// =============================================================================

class SharpLocalBundling implements ILocalBundling {
    tryBundle(outputDir: string): boolean {
        try {
            const njDir = join(outputDir, 'nodejs');
            mkdirSync(njDir, { recursive: true });
            execSync(
                `cd "${njDir}" && npm init -y --silent && npm install --production --platform=linux --arch=x64 sharp@0.33.5`,
                { stdio: 'pipe' },
            );
            return true;
        } catch (err) {
            console.warn('Local sharp layer bundling failed, falling back to Docker:', err);
            return false;
        }
    }
}

const sharpLayer = new LayerVersion(insightsAssetsStack, 'SharpLayer', {
    code: Code.fromAsset('amplify/layers/sharp', {
        bundling: {
            local: new SharpLocalBundling(),
            image: Runtime.NODEJS_22_X.bundlingImage,
            command: [
                'bash', '-c',
                'mkdir -p /asset-output/nodejs && cd /asset-output/nodejs && npm init -y && npm install --production sharp@0.33.5',
            ],
        },
    }),
    compatibleRuntimes: [Runtime.NODEJS_22_X],
    description: 'Sharp image processing library for Lambda (linux-x64)',
});

// Override the placeholder layer ARN from defineFunction with the real layer
const cfnFunction = backend.optimizeInsightsImage.resources.lambda.node.defaultChild;
if (cfnFunction && 'addPropertyOverride' in cfnFunction) {
    (cfnFunction as { addPropertyOverride(path: string, value: unknown): void })
        .addPropertyOverride('Layers', [sharpLayer.layerVersionArn]);
}

// =============================================================================
// Lambda: Dynamic sitemaps — serves sitemap/RSS/feed in real-time from DynamoDB
// Amplify rewrites proxy /sitemap.xml → /seo?file=sitemap etc.
// =============================================================================

const insightsPostTable = backend.data.resources.tables['InsightsPost'];
insightsPostTable.grantReadData(backend.generateSitemaps.resources.lambda);
backend.generateSitemaps.addEnvironment('INSIGHTS_POST_TABLE', insightsPostTable.tableName);
backend.generateSitemaps.addEnvironment('INDEXNOW_KEY', 'b8f4e2a1c7d94f3e8a6b0c5d7e9f1a2b');

const seoResource = restApi.root.addResource('seo');
seoResource.addMethod('GET', new LambdaIntegration(backend.generateSitemaps.resources.lambda, { proxy: true }));
seoResource.addMethod('OPTIONS', new LambdaIntegration(backend.generateSitemaps.resources.lambda, { proxy: true }));

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

// =============================================================================
// Tender Watch — Phase 1 infrastructure
// See docs/superpowers/specs/2026-05-14-tender-watch-design.md
// =============================================================================

// `tender-watch-stack` is auto-created by Amplify because the 9 tender Lambdas
// declare `resourceGroupName: 'tender-watch-stack'` in their resource.ts files.
// We attach the S3 bucket, Step Functions state machine, IAM grants, and
// EventBridge rule to that same nested stack.
const tenderWatchStack = Stack.of(backend.fetchSam.resources.lambda);

// --- S3 staging bucket: holds inter-state Step Functions payloads (fetch output, etc.).
//     7-day lifecycle policy keeps debug history without unbounded growth.
const tenderRawBucket = new Bucket(tenderWatchStack, 'TenderWatchRawBucket', {
    blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
    encryption: BucketEncryption.S3_MANAGED,
    lifecycleRules: [{ id: 'expire-7d', expiration: Duration.days(7) }],
    enforceSSL: true,
});

// --- Grant each Lambda the table + staging-bucket env it needs.
const tenderLambdas = [
    backend.fetchSam, backend.fetchTed, backend.fetchCalusource, backend.fetchUofa, backend.fetchTxesbd, backend.fetchNyscr, backend.fetchUwisc, backend.normalizeDedupe,
    backend.prefilterByKeyword, backend.matchWithLlm, backend.classifyAndStore,
    backend.notifyHighPriority, backend.notifyDailyDigest, backend.recordPipelineRun,
    backend.notifyPipelineHealth, backend.expireOldTenders,
];

for (const fn of tenderLambdas) {
    intelligenceTable.grantReadWriteData(fn.resources.lambda);
    fn.addEnvironment('INTELLIGENCE_TABLE', intelligenceTable.tableName);
    fn.addEnvironment('STAGING_BUCKET', tenderRawBucket.bucketName);
}

// fetch-* Lambdas write the staging bucket; normalize-dedupe reads it.
[backend.fetchSam, backend.fetchTed, backend.fetchCalusource, backend.fetchUofa, backend.fetchTxesbd, backend.fetchNyscr, backend.fetchUwisc].forEach((fn) => tenderRawBucket.grantWrite(fn.resources.lambda));
tenderRawBucket.grantRead(backend.normalizeDedupe.resources.lambda);

// match-with-llm invokes Bedrock — same pattern as classify-org.
backend.matchWithLlm.resources.lambda.addToRolePolicy(new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ['bedrock:InvokeModel'],
    resources: [
        'arn:aws:bedrock:*::foundation-model/anthropic.claude-*',
        'arn:aws:bedrock:*:*:inference-profile/us.anthropic.claude-*',
    ],
}));

backend.notifyPipelineHealth.resources.lambda.addToRolePolicy(new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ['ses:SendEmail', 'ses:SendRawEmail'],
    resources: ['*'],
}));
backend.notifyPipelineHealth.addEnvironment('ALERT_EMAIL_TO', 'info@ninescrolls.com');
backend.notifyPipelineHealth.addEnvironment('ALERT_EMAIL_FROM', 'info@ninescrolls.com');
backend.notifyPipelineHealth.addEnvironment('ZERO_FETCH_ALERT_SOURCES', 'sam,ted,calusource,uofa,nyscr,uwisc');

// --- Step Functions state machine.
const passInjectExecutionId = new Pass(tenderWatchStack, 'InjectExecutionId', {
    parameters: {
        'executionId.$': '$$.Execution.Name',
        'startedAt.$': '$$.Execution.StartTime',
    },
    resultPath: '$.exec',
});

const fetchSamTask = new LambdaInvoke(tenderWatchStack, 'FetchSam', {
    lambdaFunction: backend.fetchSam.resources.lambda,
    payload: TaskInput.fromObject({ executionId: JsonPath.stringAt('$.exec.executionId') }),
    payloadResponseOnly: true,
});
const fetchTedTask = new LambdaInvoke(tenderWatchStack, 'FetchTed', {
    lambdaFunction: backend.fetchTed.resources.lambda,
    payload: TaskInput.fromObject({ executionId: JsonPath.stringAt('$.exec.executionId') }),
    payloadResponseOnly: true,
});
const fetchCalusourceTask = new LambdaInvoke(tenderWatchStack, 'FetchCalusource', {
    lambdaFunction: backend.fetchCalusource.resources.lambda,
    payload: TaskInput.fromObject({ executionId: JsonPath.stringAt('$.exec.executionId') }),
    payloadResponseOnly: true,
});
const fetchUofaTask = new LambdaInvoke(tenderWatchStack, 'FetchUofa', {
    lambdaFunction: backend.fetchUofa.resources.lambda,
    payload: TaskInput.fromObject({ executionId: JsonPath.stringAt('$.exec.executionId') }),
    payloadResponseOnly: true,
});
// FetchTxesbd is intentionally NOT wired into the Step Function.
// Diagnosed 2026-05-31 via CloudWatch logs: NetSuite/Akamai blackholes
// AWS Lambda outbound IPs — every POST to ESBD.Service.ss hangs for 30s
// regardless of cookie state or User-Agent. The identical 2-step flow
// works in <2s from a residential IP via curl, confirming an IP-class
// block (Akamai Bot Manager refusing datacenter traffic). The Lambda
// resource, types, and Lambda code are preserved so we can re-enable by
// running from a non-AWS IP (e.g. DigitalOcean droplet pushing to S3,
// or a residential-IP HTTP proxy). To re-enable inside Lambda, restore
// the FetchTxesbd LambdaInvoke, FailedPass, fetchParallel.branch call,
// and add 'txesbd' back to ALL_SOURCES + ZERO_FETCH_ALERT_SOURCES.
const fetchNyscrTask = new LambdaInvoke(tenderWatchStack, 'FetchNyscr', {
    lambdaFunction: backend.fetchNyscr.resources.lambda,
    payload: TaskInput.fromObject({ executionId: JsonPath.stringAt('$.exec.executionId') }),
    payloadResponseOnly: true,
});
const fetchUwiscTask = new LambdaInvoke(tenderWatchStack, 'FetchUwisc', {
    lambdaFunction: backend.fetchUwisc.resources.lambda,
    payload: TaskInput.fromObject({ executionId: JsonPath.stringAt('$.exec.executionId') }),
    payloadResponseOnly: true,
});

const fetchSamFailedPass = new Pass(tenderWatchStack, 'FetchSamFailedPass', {
    parameters: { source: 'sam', fetched: 0, stagedKey: null, 'errorName.$': '$.error.Error', 'errorCause.$': '$.error.Cause' },
});
fetchSamTask.addCatch(fetchSamFailedPass, { errors: ['States.ALL'], resultPath: '$.error' });

const fetchTedFailedPass = new Pass(tenderWatchStack, 'FetchTedFailedPass', {
    parameters: { source: 'ted', fetched: 0, stagedKey: null, 'errorName.$': '$.error.Error', 'errorCause.$': '$.error.Cause' },
});
fetchTedTask.addCatch(fetchTedFailedPass, { errors: ['States.ALL'], resultPath: '$.error' });

const fetchCalusourceFailedPass = new Pass(tenderWatchStack, 'FetchCalusourceFailedPass', {
    parameters: { source: 'calusource', fetched: 0, stagedKey: null, 'errorName.$': '$.error.Error', 'errorCause.$': '$.error.Cause' },
});
fetchCalusourceTask.addCatch(fetchCalusourceFailedPass, { errors: ['States.ALL'], resultPath: '$.error' });

const fetchUofaFailedPass = new Pass(tenderWatchStack, 'FetchUofaFailedPass', {
    parameters: { source: 'uofa', fetched: 0, stagedKey: null, 'errorName.$': '$.error.Error', 'errorCause.$': '$.error.Cause' },
});
fetchUofaTask.addCatch(fetchUofaFailedPass, { errors: ['States.ALL'], resultPath: '$.error' });

// FetchTxesbdFailedPass removed alongside FetchTxesbd — see note above.

const fetchNyscrFailedPass = new Pass(tenderWatchStack, 'FetchNyscrFailedPass', {
    parameters: { source: 'nyscr', fetched: 0, stagedKey: null, 'errorName.$': '$.error.Error', 'errorCause.$': '$.error.Cause' },
});
fetchNyscrTask.addCatch(fetchNyscrFailedPass, { errors: ['States.ALL'], resultPath: '$.error' });

const fetchUwiscFailedPass = new Pass(tenderWatchStack, 'FetchUwiscFailedPass', {
    parameters: { source: 'uwisc', fetched: 0, stagedKey: null, 'errorName.$': '$.error.Error', 'errorCause.$': '$.error.Cause' },
});
fetchUwiscTask.addCatch(fetchUwiscFailedPass, { errors: ['States.ALL'], resultPath: '$.error' });

const fetchParallel = new Parallel(tenderWatchStack, 'FetchAllSources', {
    resultPath: '$.fetchResults',
});
fetchParallel.branch(fetchSamTask);
fetchParallel.branch(fetchTedTask);
fetchParallel.branch(fetchCalusourceTask);
fetchParallel.branch(fetchUofaTask);
// fetchTxesbd branch removed — see note above; re-enable by restoring task + branch.
fetchParallel.branch(fetchNyscrTask);
fetchParallel.branch(fetchUwiscTask);

const normalizeTask = new LambdaInvoke(tenderWatchStack, 'NormalizeDedupe', {
    lambdaFunction: backend.normalizeDedupe.resources.lambda,
    payload: TaskInput.fromObject({
        executionId: JsonPath.stringAt('$.exec.executionId'),
        fetchOutputs: JsonPath.objectAt('$.fetchResults'),
    }),
    payloadResponseOnly: true,
    resultPath: '$.normalized',
});

const prefilterTask = new LambdaInvoke(tenderWatchStack, 'Prefilter', {
    lambdaFunction: backend.prefilterByKeyword.resources.lambda,
    payload: TaskInput.fromObject({ newTenderIds: JsonPath.objectAt('$.normalized.newTenderIds') }),
    payloadResponseOnly: true,
    resultPath: '$.prefilter',
});

const matchMap = new SfnMap(tenderWatchStack, 'LLMScoring', {
    maxConcurrency: 10,
    itemsPath: '$.prefilter.candidates',
    resultPath: '$.matches',
});
matchMap.iterator(
    new LambdaInvoke(tenderWatchStack, 'MatchOne', {
        lambdaFunction: backend.matchWithLlm.resources.lambda,
        payload: TaskInput.fromObject({ tenderId: JsonPath.stringAt('$.tenderId') }),
        payloadResponseOnly: true,
    }),
);

const classifyTask = new LambdaInvoke(tenderWatchStack, 'ClassifyAndStore', {
    lambdaFunction: backend.classifyAndStore.resources.lambda,
    payload: TaskInput.fromObject({ matchResults: JsonPath.objectAt('$.matches') }),
    payloadResponseOnly: true,
    resultPath: '$.classified',
});

const notifyHigh = new LambdaInvoke(tenderWatchStack, 'NotifyHighPriority', {
    lambdaFunction: backend.notifyHighPriority.resources.lambda,
    payload: TaskInput.fromObject({ highPriorityTenderIds: JsonPath.objectAt('$.classified.highPriorityTenderIds') }),
    payloadResponseOnly: true,
    resultPath: '$.notifyHp',
});
const notifyHpFailedPass = new Pass(tenderWatchStack, 'NotifyHpFailedPass', {
    parameters: { status: 'failed', 'error.$': '$.notifyHpError.Cause' },
    resultPath: '$.notifyHp',
});
notifyHigh.addCatch(notifyHpFailedPass, { errors: ['States.ALL'], resultPath: '$.notifyHpError' });

const notifyDigest = new LambdaInvoke(tenderWatchStack, 'NotifyDailyDigest', {
    lambdaFunction: backend.notifyDailyDigest.resources.lambda,
    payload: TaskInput.fromObject({ digestTenderIds: JsonPath.objectAt('$.classified.digestTenderIds') }),
    payloadResponseOnly: true,
    resultPath: '$.notifyDigest',
});
const notifyDigestFailedPass = new Pass(tenderWatchStack, 'NotifyDigestFailedPass', {
    parameters: { status: 'failed', 'error.$': '$.notifyDigestError.Cause' },
    resultPath: '$.notifyDigest',
});
notifyDigest.addCatch(notifyDigestFailedPass, { errors: ['States.ALL'], resultPath: '$.notifyDigestError' });

const recordRunCompleteTask = new LambdaInvoke(tenderWatchStack, 'RecordRunComplete', {
    lambdaFunction: backend.recordPipelineRun.resources.lambda,
    payload: TaskInput.fromObject({
        kind: 'COMPLETE',
        'executionId.$': '$.exec.executionId',
        'startedAt.$': '$.exec.startedAt',
        'endedAt.$': '$$.State.EnteredTime',
        'stepFunctionExecutionArn.$': '$$.Execution.Id',
        'fetchResults.$': '$.fetchResults',
        'normalized.$': '$.normalized',
        'prefilter.$': '$.prefilter',
        'matches.$': '$.matches',
        'classified.$': '$.classified',
        'notifyHp.$': '$.notifyHp',
        'notifyDigest.$': '$.notifyDigest',
    }),
    payloadResponseOnly: true,
});

const recordRunFailedTask = new LambdaInvoke(tenderWatchStack, 'RecordRunFailed', {
    lambdaFunction: backend.recordPipelineRun.resources.lambda,
    payload: TaskInput.fromObject({
        kind: 'FAILED',
        'executionId.$': '$.exec.executionId',
        'startedAt.$': '$.exec.startedAt',
        'endedAt.$': '$$.State.EnteredTime',
        'stepFunctionExecutionArn.$': '$$.Execution.Id',
        'errorName.$': '$.error.Error',
        'errorCause.$': '$.error.Cause',
    }),
    payloadResponseOnly: true,
});

const noMatchesPass = new Pass(tenderWatchStack, 'NoMatchesYet', {
    result: Result.fromArray([]),
    resultPath: '$.matches',
});

const noCandidatesClassifiedPass = new Pass(tenderWatchStack, 'NoCandidatesClassified', {
    parameters: { tendersUpdated: 0, highPriorityTenderIds: [], digestTenderIds: [] },
    resultPath: '$.classified',
});

notifyHigh.next(notifyDigest);
notifyHpFailedPass.next(notifyDigest);
notifyDigest.next(recordRunCompleteTask);
notifyDigestFailedPass.next(recordRunCompleteTask);
[normalizeTask, prefilterTask, matchMap, classifyTask].forEach((t) => {
    t.addCatch(recordRunFailedTask, { errors: ['States.ALL'], resultPath: '$.error' });
});

const choice = new Choice(tenderWatchStack, 'HasCandidates')
    .when(
        Condition.numberGreaterThan('$.prefilter.candidatesCount', 0),
        matchMap.next(classifyTask).next(notifyHigh),
    )
    .otherwise(noMatchesPass.next(noCandidatesClassifiedPass).next(notifyHigh));

const definition = passInjectExecutionId
    .next(fetchParallel)
    .next(normalizeTask)
    .next(prefilterTask)
    .next(choice);

const stateMachineLogGroup = new LogGroup(tenderWatchStack, 'TenderWatchLogs', {
    retention: RetentionDays.ONE_MONTH,
});

const tenderWatchStateMachine = new StateMachine(tenderWatchStack, 'TenderWatchDaily', {
    // Suffix with stack name in sandbox to avoid colliding with the prod state machine
    // (the global name `tender-watch-daily` is owned by the prod main-branch deploy).
    stateMachineName: isSandbox ? `tender-watch-daily-${backend.stack.stackName.slice(-12)}` : 'tender-watch-daily',
    stateMachineType: StateMachineType.STANDARD,
    definition,
    logs: { destination: stateMachineLogGroup, level: LogLevel.ALL, includeExecutionData: true },
    tracingEnabled: true,
});

// --- EventBridge daily crons (02:00–02:45 UTC).
// Only schedule these in the prod (main-branch) deploy. A sandbox shares the
// same external integrations (tender APIs, notification channels, Bedrock), so
// scheduling them there would fire duplicate daily runs — duplicate tender
// notifications / pipeline-health alerts and extra cost — against prod's. The
// state machine / lambdas are still created in sandbox (harmless without a
// trigger) so the backend can be exercised manually.
if (!isSandbox) {
    new Rule(tenderWatchStack, 'TenderWatchDailyRule', {
        schedule: Schedule.cron({ minute: '0', hour: '2', day: '*', month: '*', year: '*' }),
        targets: [new SfnStateMachine(tenderWatchStateMachine)],
    });

    new Rule(tenderWatchStack, 'PipelineHealthCheckRule', {
        schedule: Schedule.cron({ minute: '30', hour: '2', day: '*', month: '*', year: '*' }),
        targets: [new LambdaFunctionTarget(backend.notifyPipelineHealth.resources.lambda)],
    });

    new Rule(tenderWatchStack, 'ExpireOldTendersRule', {
        schedule: Schedule.cron({ minute: '45', hour: '2', day: '*', month: '*', year: '*' }),
        targets: [new LambdaFunctionTarget(backend.expireOldTenders.resources.lambda)],
    });
}

if (!isSandbox) {
    // CRM timeline reconciliation sweep (durability backstop for the async emit projection).
    // The Rules MUST live in the SAME nested stack as the target Lambda (mirroring the
    // Tender-Watch crons, whose target functions share the rules' stack via resourceGroupName):
    // crm-api's function stack already depends on feedbackStack (intelligence-table grant + env),
    // so scoping these rules to feedbackStack added a reverse feedback→function edge and closed a
    // CloudFormation circular dependency between the nested stacks (deploy failure 2026-07-01).
    // Intra-stack rule + target + Lambda permission = no cross-stack edge at all.
    const crmApiStack = Stack.of(backend.crmApi.resources.lambda);
    new Rule(crmApiStack, 'CrmSweepHotRule', {
        schedule: Schedule.cron({ minute: '*/30', hour: '*', day: '*', month: '*', year: '*' }),
        targets: [new LambdaFunctionTarget(backend.crmApi.resources.lambda, {
            event: RuleTargetInput.fromObject({ action: 'reconcileSweep', mode: 'hot' }),
        })],
    });
    new Rule(crmApiStack, 'CrmSweepColdRule', {
        schedule: Schedule.cron({ minute: '0', hour: '3', day: '*', month: '*', year: '*' }),
        targets: [new LambdaFunctionTarget(backend.crmApi.resources.lambda, {
            event: RuleTargetInput.fromObject({ action: 'reconcileSweep', mode: 'cold' }),
        })],
    });
    // 2C-analytics: session rollup every 30 min (offset from the sweep's */30 by :15 to avoid
    // co-scheduling two 120s-capped invocations of the same Lambda).
    new Rule(crmApiStack, 'CrmAnalyticsRollupRule', {
        schedule: Schedule.cron({ minute: '15/30', hour: '*', day: '*', month: '*', year: '*' }),
        targets: [new LambdaFunctionTarget(backend.crmApi.resources.lambda, {
            event: RuleTargetInput.fromObject({ action: 'rollupAnalyticsSessions' }),
        })],
    });
}

// =============================================================================
// Customer Organization (Phase C)
// See docs/superpowers/specs/2026-05-15-organization-db-design.md
// =============================================================================

const orgFunctionStack = Stack.of(backend.organizationApi.resources.lambda);

intelligenceTable.grantReadWriteData(backend.organizationApi.resources.lambda);
backend.organizationApi.addEnvironment('INTELLIGENCE_TABLE', intelligenceTable.tableName);

// Bedrock invoke (mirrors match-with-llm / classify-org)
backend.organizationApi.resources.lambda.addToRolePolicy(new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ['bedrock:InvokeModel'],
    resources: [
        'arn:aws:bedrock:*::foundation-model/anthropic.claude-*',
        'arn:aws:bedrock:*:*:inference-profile/us.anthropic.claude-*',
    ],
}));

// Self-invoke for fire-and-forget classifyOrg (called by upsertFromSubmission).
// Use a name-pattern ARN (not lambda.functionArn) to avoid a circular ref:
// Lambda → Role → Policy → Lambda.functionArn → Lambda. The role's policy must
// be createable before the Lambda exists.
backend.organizationApi.resources.lambda.addToRolePolicy(new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ['lambda:InvokeFunction'],
    resources: [`arn:aws:lambda:${orgFunctionStack.region}:${orgFunctionStack.account}:function:*organizationapi*`],
}));

// Cross-Lambda invoke from submission Lambdas → organization-api
[backend.submitRfq, backend.submitLead, backend.convertRfqToOrder].forEach((fn) => {
    fn.resources.lambda.addToRolePolicy(new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['lambda:InvokeFunction'],
        resources: [backend.organizationApi.resources.lambda.functionArn],
    }));
    fn.addEnvironment('ORGANIZATION_API_FUNCTION_NAME', backend.organizationApi.resources.lambda.functionName);
});

// Cross-Lambda invoke from the 5 source Lambdas → crm-api (8 Plan-2A emit sites).
// Match the existing organization-api grant style rather than grantInvoke(), to keep
// dependencies explicit and avoid surprising synthesized circular references.
[backend.submitRfq, backend.submitLead, backend.convertRfqToOrder, backend.orderApi, backend.logisticsApi].forEach((fn) => {
  fn.resources.lambda.addToRolePolicy(new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ['lambda:InvokeFunction'],
    resources: [backend.crmApi.resources.lambda.functionArn],
  }));
  fn.addEnvironment('CRM_API_FUNCTION_NAME', backend.crmApi.resources.lambda.functionName);
});

// Manual createOrder (order-api) needs to upsert/get the canonical Organization → matchedOrgId.
backend.orderApi.resources.lambda.addToRolePolicy(new PolicyStatement({
  effect: Effect.ALLOW,
  actions: ['lambda:InvokeFunction'],
  resources: [backend.organizationApi.resources.lambda.functionArn],
}));
backend.orderApi.addEnvironment('ORGANIZATION_API_FUNCTION_NAME', backend.organizationApi.resources.lambda.functionName);

// ---------------------------------------------------------------------------
// CloudWatch alarms — only in prod / main branch deploys. Sandbox skips to
// avoid spurious subscription-confirmation emails on every developer's spin-up.
// ---------------------------------------------------------------------------
if (!isSandbox) {
    // Reference an out-of-band-managed SNS topic. Earlier we created the topic
    // via `new Topic(...)` but Amplify Gen 2 was destroying + recreating it on
    // every main-branch deploy (root cause TBD, possibly stack-rebuild quirk).
    // The recreation took the email subscription with it, so every alarm-stack
    // deploy required a fresh "Confirm subscription" click — broken pattern.
    //
    // Workaround: the topic + email subscription live entirely outside CDK.
    // Created once in the SNS Console; CDK only references the ARN.
    const orgAlarmTopic = Topic.fromTopicArn(
        orgFunctionStack,
        'OrgApiAlarmTopic',
        `arn:aws:sns:${orgFunctionStack.region}:${orgFunctionStack.account}:ninescrolls-org-api-alarms`,
    );

    const alarmAction = new SnsAction(orgAlarmTopic);
    const orgLambda = backend.organizationApi.resources.lambda;

    // Amplify's IFunction doesn't expose `logGroup`; resolve by Lambda's
    // standard convention: /aws/lambda/<functionName>.
    const orgLambdaLogs = LogGroup.fromLogGroupName(
        orgFunctionStack,
        'OrgApiLogGroup',
        `/aws/lambda/${orgLambda.functionName}`,
    );

    // 1. Hard errors: any Lambda invocation returning an error.
    new Alarm(orgFunctionStack, 'OrgApiErrorsAlarm', {
        alarmDescription: 'organization-api Lambda errored (sum) over 5 min',
        metric: orgLambda.metricErrors({
            period: Duration.minutes(5),
            statistic: 'Sum',
        }),
        threshold: 3,
        evaluationPeriods: 1,
        comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        treatMissingData: TreatMissingData.NOT_BREACHING,
    }).addAlarmAction(alarmAction);

    // 2. Latency: p99 duration > 5s (Bedrock 8s timeout + DDB overhead).
    new Alarm(orgFunctionStack, 'OrgApiDurationAlarm', {
        alarmDescription: 'organization-api p99 duration exceeded 5s',
        metric: orgLambda.metricDuration({
            period: Duration.minutes(5),
            statistic: 'p99',
        }),
        threshold: 5000,
        evaluationPeriods: 2,
        comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        treatMissingData: TreatMissingData.NOT_BREACHING,
    }).addAlarmAction(alarmAction);

    // 3. Critical: both Bedrock AND Anthropic failed — Org stays type='unknown'.
    const bothFailedFilter = new MetricFilter(orgFunctionStack, 'BothProvidersFailedFilter', {
        logGroup: orgLambdaLogs,
        metricNamespace: 'NineScrolls/OrgApi',
        metricName: 'BothProvidersFailed',
        filterPattern: FilterPattern.literal('"org.classify.both-providers-failed"'),
        metricValue: '1',
        defaultValue: 0,
    });
    new Alarm(orgFunctionStack, 'OrgApiBothProvidersFailedAlarm', {
        alarmDescription: 'Bedrock + Anthropic both failed on classifyOrg (Org left unclassified)',
        metric: bothFailedFilter.metric({
            period: Duration.minutes(5),
            statistic: 'Sum',
        }),
        threshold: 1,
        evaluationPeriods: 1,
        comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        treatMissingData: TreatMissingData.NOT_BREACHING,
    }).addAlarmAction(alarmAction);

    // 4. Warning: Bedrock fallback rate. Anthropic catches these but high
    //    counts indicate a Bedrock outage worth investigating before Anthropic
    //    quota becomes a problem.
    const bedrockFailedFilter = new MetricFilter(orgFunctionStack, 'BedrockFailedFilter', {
        logGroup: orgLambdaLogs,
        metricNamespace: 'NineScrolls/OrgApi',
        metricName: 'BedrockFailed',
        filterPattern: FilterPattern.literal('"org.classify.bedrock-failed"'),
        metricValue: '1',
        defaultValue: 0,
    });
    new Alarm(orgFunctionStack, 'OrgApiBedrockFallbackAlarm', {
        alarmDescription: 'Bedrock classifyOrg failed > 5 times in an hour (warning)',
        metric: bedrockFailedFilter.metric({
            period: Duration.hours(1),
            statistic: 'Sum',
        }),
        threshold: 5,
        evaluationPeriods: 1,
        comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        treatMissingData: TreatMissingData.NOT_BREACHING,
    }).addAlarmAction(alarmAction);
}

// =============================================================================
// Tender Admin (Phase 2)
// See docs/superpowers/specs/2026-05-15-tender-watch-phase-2-design.md
// =============================================================================

intelligenceTable.grantReadWriteData(backend.tenderApi.resources.lambda);
backend.tenderApi.addEnvironment('INTELLIGENCE_TABLE', intelligenceTable.tableName);

// Bedrock invoke (mirrors match-with-llm / organization-api).
backend.tenderApi.resources.lambda.addToRolePolicy(new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ['bedrock:InvokeModel'],
    resources: [
        'arn:aws:bedrock:*::foundation-model/anthropic.claude-*',
        'arn:aws:bedrock:*:*:inference-profile/us.anthropic.claude-*',
    ],
}));
