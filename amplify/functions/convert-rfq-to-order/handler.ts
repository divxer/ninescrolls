import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
    DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { S3Client, CopyObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'node:crypto';

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------
const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);
const s3Client = new S3Client({});

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------
const TABLE_NAME = () => process.env.INTELLIGENCE_TABLE!;
const BUCKET_NAME = () => process.env.DOCUMENTS_BUCKET!;
const SLACK_WEBHOOK_URL = () => process.env.SLACK_WEBHOOK_URL;

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------
const ALLOWED_ORIGINS = [
    'https://admin.ninescrolls.com',
    'https://ninescrolls.com',
    'http://localhost:5173',
];

function getCorsHeaders(origin?: string) {
    const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
    return {
        'Access-Control-Allow-Origin': allowed,
        'Access-Control-Allow-Methods': 'POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Max-Age': '300',
    };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function generateOrderId(): string {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = crypto.randomBytes(2).toString('hex');
    return `ord-${date}-${rand}`;
}

function generateContactId(): string {
    return `ct-${crypto.randomBytes(3).toString('hex')}`;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface ConvertRequest {
    rfqId: string;
    productModel?: string;
    productName?: string;
    configuration?: string;
    quoteAmount?: number;
    notes?: string;
    operator: string;
}

// ---------------------------------------------------------------------------
// Handler — §12.10.6
// ---------------------------------------------------------------------------
export const handler: APIGatewayProxyHandlerV2 = async (event) => {
    console.log('convert-rfq-to-order Lambda invoked');

    const origin = event.headers?.origin || event.headers?.Origin;
    const corsHeaders = getCorsHeaders(origin);

    const method = event.requestContext?.http?.method
        || (event as unknown as { httpMethod?: string }).httpMethod;

    if (method === 'OPTIONS') {
        return { statusCode: 200, headers: corsHeaders, body: '' };
    }

    try {
        if (!event.body) {
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({ success: false, error: 'Request body is required' }),
            };
        }

        let req: ConvertRequest;
        try {
            req = JSON.parse(event.body) as ConvertRequest;
        } catch {
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({ success: false, error: 'Invalid JSON' }),
            };
        }

        if (!req.rfqId) {
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({ success: false, error: 'rfqId is required' }),
            };
        }

        // 1. Fetch the RFQ
        const rfqResult = await docClient.send(new GetCommand({
            TableName: TABLE_NAME(),
            Key: { PK: `RFQ#${req.rfqId}`, SK: 'META' },
        }));

        if (!rfqResult.Item) {
            return {
                statusCode: 404,
                headers: corsHeaders,
                body: JSON.stringify({ success: false, error: 'RFQ not found' }),
            };
        }

        const rfq = rfqResult.Item;

        if (rfq.status !== 'pending') {
            return {
                statusCode: 409,
                headers: corsHeaders,
                body: JSON.stringify({
                    success: false,
                    error: `RFQ is already ${rfq.status}. Only pending RFQs can be converted.`,
                }),
            };
        }

        const now = new Date().toISOString();
        const orderId = generateOrderId();
        const contactId = generateContactId();
        const operator = req.operator || 'admin';

        // 2. Create ORDER entity (status: INQUIRY) — §12.3
        const productModel = req.productModel || rfq.specificModel || rfq.equipmentCategory;
        const orderItem: Record<string, unknown> = {
            PK: `ORDER#${orderId}`,
            SK: 'META',
            GSI1PK: 'ORDER_STATUS#INQUIRY',
            GSI1SK: `${now}#${orderId}`,
            orderId,
            status: 'INQUIRY',
            institution: rfq.institution,
            department: rfq.department,
            productModel,
            productName: req.productName || '',
            configuration: req.configuration || rfq.keySpecifications || '',
            quoteAmount: req.quoteAmount,
            notes: req.notes || '',
            matchedOrgId: rfq.matchedOrgId || '',
            createdAt: now,
            updatedAt: now,
            createdBy: operator,
            source: 'RFQ_WEBSITE',
            rfqId: req.rfqId,
            inquiryDate: rfq.submittedAt,
            feedbackScheduleCreated: false,
            TTL: 0,
        };

        if (rfq.matchedOrgId) {
            orderItem.GSI2PK = `ORG#${rfq.matchedOrgId}`;
            orderItem.GSI2SK = `ORDER#${now}`;
        }

        await docClient.send(new PutCommand({
            TableName: TABLE_NAME(),
            Item: orderItem,
        }));
        console.log(`ORDER created: ${orderId}`);

        // 3. Create ORDER_CONTACT from RFQ contact info — §12.3
        const contactItem: Record<string, unknown> = {
            PK: `ORDER#${orderId}`,
            SK: `CONTACT#${contactId}`,
            contactId,
            contactName: rfq.name,
            contactEmail: rfq.email,
            contactPhone: rfq.phone || '',
            role: rfq.role || 'OTHER',
            department: rfq.department || '',
            isPrimary: true,
            feedbackInvite: true,
            notes: '',
        };

        await docClient.send(new PutCommand({
            TableName: TABLE_NAME(),
            Item: contactItem,
        }));
        console.log(`ORDER_CONTACT created: ${contactId}`);

        // 4. Migrate attachments: S3 copy rfqs/<rfqId>/* → orders/<orderId>/INQUIRY/
        const docIds: string[] = [];
        if (rfq.attachmentKeys && Array.isArray(rfq.attachmentKeys)) {
            const bucket = BUCKET_NAME();
            for (const srcKey of rfq.attachmentKeys as string[]) {
                const fileName = srcKey.split('/').pop() ?? srcKey;
                const docId = `doc-${crypto.randomBytes(3).toString('hex')}`;
                const destKey = `orders/${orderId}/INQUIRY/${docId}_${fileName}`;

                try {
                    await s3Client.send(new CopyObjectCommand({
                        Bucket: bucket,
                        CopySource: `${bucket}/${srcKey}`,
                        Key: destKey,
                    }));

                    // Create ORDER_DOCUMENT record
                    await docClient.send(new PutCommand({
                        TableName: TABLE_NAME(),
                        Item: {
                            PK: `ORDER#${orderId}`,
                            SK: `DOC#INQUIRY#${docId}`,
                            docId,
                            fileName,
                            fileSize: 0, // Unknown from RFQ attachment
                            mimeType: 'application/octet-stream',
                            stage: 'INQUIRY',
                            docType: 'REQUIREMENTS',
                            description: 'Uploaded with RFQ submission',
                            s3Key: destKey,
                            uploadedBy: 'system',
                            uploadedAt: now,
                            tags: ['rfq-attachment'],
                            isLatestVersion: true,
                        },
                    }));

                    docIds.push(docId);
                    console.log(`Attachment migrated: ${srcKey} → ${destKey}`);
                } catch (err) {
                    console.error(`Failed to migrate attachment ${srcKey}:`, err);
                }
            }
        }

        // 5. Update RFQ_SUBMISSION: status → converted, linkedOrderId
        await docClient.send(new UpdateCommand({
            TableName: TABLE_NAME(),
            Key: { PK: `RFQ#${req.rfqId}`, SK: 'META' },
            UpdateExpression: 'SET #s = :converted, linkedOrderId = :oid, GSI1PK = :gsi1, updatedAt = :now',
            ExpressionAttributeNames: { '#s': 'status' },
            ExpressionAttributeValues: {
                ':converted': 'converted',
                ':oid': orderId,
                ':gsi1': 'RFQ_STATUS#converted',
                ':now': now,
            },
        }));
        console.log(`RFQ ${req.rfqId} → converted`);

        // 6. Write ORDER_LOG (action: CREATED_FROM_RFQ)
        await docClient.send(new PutCommand({
            TableName: TABLE_NAME(),
            Item: {
                PK: `ORDER#${orderId}`,
                SK: `LOG#${now}`,
                action: 'CREATED_FROM_RFQ',
                fromStatus: null,
                toStatus: 'INQUIRY',
                operator,
                timestamp: now,
                detail: `Created from RFQ ${rfq.referenceNumber || req.rfqId}`,
            },
        }));

        // 7. Slack notification (best-effort)
        const webhookUrl = SLACK_WEBHOOK_URL();
        if (webhookUrl) {
            try {
                await fetch(webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        text: `:arrows_counterclockwise: RFQ converted to Order: [${productModel}] ${rfq.institution} → ${orderId}`,
                    }),
                });
            } catch (err) {
                console.warn('Slack notification failed:', err);
            }
        }

        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({
                success: true,
                orderId,
                rfqId: req.rfqId,
                message: 'RFQ successfully converted to Order',
            }),
        };

    } catch (error) {
        console.error('Error in convert-rfq-to-order:', error);
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ success: false, error: 'Internal server error' }),
        };
    }
};
