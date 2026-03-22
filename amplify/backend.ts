import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { sendEmail } from './functions/send-email/resource';
import { createCheckoutSession } from './functions/create-checkout-session/resource';
import { stripeWebhook } from './functions/stripe-webhook/resource';
import { calculateTax } from './functions/calculate-tax/resource';
import { subscribeNewsletter } from './functions/subscribe-newsletter/resource';
import { ipLookup } from './functions/ip-lookup/resource';
import { serverTrack } from './functions/server-track/resource';
import { classifyOrg } from './functions/classify-org/resource';
import { generateArticleMeta } from './functions/generate-article-meta/resource';
import { submitRfq } from './functions/submit-rfq/resource';
import { convertRfqToOrder } from './functions/convert-rfq-to-order/resource';
import { updateOrderStatus } from './functions/update-order-status/resource';
import { documentUpload } from './functions/document-upload/resource';
import { orderApi } from './functions/order-api/resource';
import { optimizeInsightsImage } from './functions/optimize-insights-image/resource';
import { generateSitemaps } from './functions/generate-sitemaps/resource';
import { RestApi, AuthorizationType } from 'aws-cdk-lib/aws-apigateway';
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

const backend = defineBackend({
    auth,
    data,
    sendEmail,
    createCheckoutSession,
    stripeWebhook,
    calculateTax,
    subscribeNewsletter,
    ipLookup,
    serverTrack,
    classifyOrg,
    generateArticleMeta,
    submitRfq,
    convertRfqToOrder,
    updateOrderStatus,
    documentUpload,
    orderApi,
    optimizeInsightsImage,
    generateSitemaps,
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
// Feature flag: set to 'false' to disable ALL DDB writes (page_view, page_time_flush, ai_enrichment)
backend.serverTrack.addEnvironment('ENABLE_DDB_WRITE', 'true');

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

const insightsAssetsCdn = new Distribution(insightsAssetsStack, 'InsightsAssetsCdn', {
    defaultBehavior: {
        origin: new S3Origin(insightsAssetsBucket, { originAccessIdentity: oai }),
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: AllowedMethods.ALLOW_GET_HEAD,
        cachedMethods: CachedMethods.CACHE_GET_HEAD,
        cachePolicy: CachePolicy.CACHING_OPTIMIZED,
        compress: true,
    },
    httpVersion: HttpVersion.HTTP2_AND_3,
    comment: 'NineScrolls insights image assets CDN',
});

// =============================================================================
// Grant optimize-insights-image Lambda access to S3 bucket
// =============================================================================

insightsAssetsBucket.grantReadWrite(backend.optimizeInsightsImage.resources.lambda);
backend.optimizeInsightsImage.addEnvironment('INSIGHTS_ASSETS_BUCKET', insightsAssetsBucket.bucketName);
backend.optimizeInsightsImage.addEnvironment('CDN_BASE_URL', `https://${insightsAssetsCdn.distributionDomainName}`);

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
    (cfnFunction as any).addPropertyOverride('Layers', [sharpLayer.layerVersionArn]);
}

// =============================================================================
// Lambda: Dynamic sitemaps — serves sitemap/RSS/feed in real-time from DynamoDB
// Amplify rewrites proxy /sitemap.xml → /seo?file=sitemap etc.
// =============================================================================

const graphqlApi = backend.data.resources.graphqlApi;
const cfnApi = graphqlApi.node.findChild('Resource') as import('aws-cdk-lib/aws-appsync').CfnGraphQLApi;
const cfnApiKey = graphqlApi.node.tryFindChild('DefaultApiKey')?.node.defaultChild as import('aws-cdk-lib/aws-appsync').CfnApiKey | undefined;
backend.generateSitemaps.addEnvironment('GRAPHQL_ENDPOINT', `https://${cfnApi.attrGraphQlUrl}`);
backend.generateSitemaps.addEnvironment('GRAPHQL_API_KEY', cfnApiKey?.attrApiKey || '');

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
