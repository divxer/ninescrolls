import { GetCommand, PutCommand, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { CopyObjectCommand } from '@aws-sdk/client-s3';
import { docClient, s3Client, TABLE_NAME, BUCKET_NAME } from '../lib/dynamodb.js';
import { generateOrderId, generateContactId, generateDocId } from '../lib/idGenerators.js';
import { buildFullOrderResponse, sendSlackNotification } from '../lib/orderHelper.js';
import type { AppSyncEvent } from '../lib/types.js';
import crypto from 'node:crypto';

export async function convertRfqToOrder(event: AppSyncEvent) {
    const args = event.arguments as {
        rfqId: string;
        productModel?: string;
        productName?: string;
        configuration?: string;
        quoteAmount?: number;
        notes?: string;
    };

    if (!args.rfqId) {
        throw new Error('rfqId is required');
    }

    // 1. Fetch the RFQ
    const rfqResult = await docClient.send(new GetCommand({
        TableName: TABLE_NAME(),
        Key: { PK: `RFQ#${args.rfqId}`, SK: 'META' },
    }));

    if (!rfqResult.Item) {
        throw new Error(`RFQ not found: ${args.rfqId}`);
    }

    const rfq = rfqResult.Item;

    if (rfq.status !== 'pending') {
        throw new Error(`RFQ is already ${rfq.status}. Only pending RFQs can be converted.`);
    }

    const now = new Date().toISOString();
    const orderId = generateOrderId();
    const contactId = generateContactId();
    const operator = event.identity?.claims?.email as string || event.identity?.sub || 'admin';

    // 2. Create ORDER entity (status: INQUIRY)
    const productModel = args.productModel || rfq.specificModel || rfq.equipmentCategory;
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
        productName: args.productName || '',
        configuration: args.configuration || rfq.keySpecifications || '',
        quoteAmount: args.quoteAmount,
        notes: args.notes || '',
        matchedOrgId: rfq.matchedOrgId || '',
        createdAt: now,
        updatedAt: now,
        createdBy: operator,
        source: 'RFQ_WEBSITE',
        rfqId: args.rfqId,
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

    // 3. Create ORDER_CONTACT from RFQ contact info
    await docClient.send(new PutCommand({
        TableName: TABLE_NAME(),
        Item: {
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
        },
    }));

    // 4. Migrate attachments: S3 copy rfqs/<rfqId>/* -> orders/<orderId>/INQUIRY/
    if (rfq.attachmentKeys && Array.isArray(rfq.attachmentKeys)) {
        const bucket = BUCKET_NAME();
        for (const srcKey of rfq.attachmentKeys as string[]) {
            const fileName = srcKey.split('/').pop() ?? srcKey;
            const docId = generateDocId();
            const destKey = `orders/${orderId}/INQUIRY/${docId}_${fileName}`;

            try {
                await s3Client.send(new CopyObjectCommand({
                    Bucket: bucket,
                    CopySource: `${bucket}/${srcKey}`,
                    Key: destKey,
                }));

                await docClient.send(new PutCommand({
                    TableName: TABLE_NAME(),
                    Item: {
                        PK: `ORDER#${orderId}`,
                        SK: `DOC#INQUIRY#${docId}`,
                        docId,
                        fileName,
                        fileSize: 0,
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
            } catch (err) {
                console.error(`Failed to migrate attachment ${srcKey}:`, err);
            }
        }
    }

    // 5. Update RFQ_SUBMISSION: status -> converted
    await docClient.send(new UpdateCommand({
        TableName: TABLE_NAME(),
        Key: { PK: `RFQ#${args.rfqId}`, SK: 'META' },
        UpdateExpression: 'SET #s = :converted, linkedOrderId = :oid, GSI1PK = :gsi1, updatedAt = :now',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: {
            ':converted': 'converted',
            ':oid': orderId,
            ':gsi1': 'RFQ_STATUS#converted',
            ':now': now,
        },
    }));

    // 6. Write ORDER_LOG
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
            detail: `Created from RFQ ${rfq.referenceNumber || args.rfqId}`,
        },
    }));

    // 7. Slack notification
    await sendSlackNotification(
        `:arrows_counterclockwise: RFQ converted to Order: [${productModel}] ${rfq.institution} → ${orderId}`,
    );

    return buildFullOrderResponse(orderId);
}
