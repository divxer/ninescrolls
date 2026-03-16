import { QueryCommand, DeleteCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { docClient, s3Client, TABLE_NAME, BUCKET_NAME } from '../lib/dynamodb.js';
import { getOperatorInfo } from '../lib/types.js';
import type { AppSyncEvent, DocumentItem } from '../lib/types.js';

export async function deleteDocument(event: AppSyncEvent) {
    const { orderId, docId } = event.arguments as {
        orderId: string;
        docId: string;
    };

    if (!orderId || !docId) {
        throw new Error('orderId and docId are required');
    }

    // Find the document
    const result = await docClient.send(new QueryCommand({
        TableName: TABLE_NAME(),
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        FilterExpression: 'docId = :docId',
        ExpressionAttributeValues: {
            ':pk': `ORDER#${orderId}`,
            ':sk': 'DOC#',
            ':docId': docId,
        },
    }));

    if (!result.Items || result.Items.length === 0) {
        throw new Error(`Document not found: ${docId}`);
    }

    const doc = result.Items[0] as DocumentItem;
    const now = new Date().toISOString();
    const { email: operator } = getOperatorInfo(event);

    // Delete from S3
    if (doc.s3Key) {
        try {
            await s3Client.send(new DeleteObjectCommand({
                Bucket: BUCKET_NAME(),
                Key: doc.s3Key,
            }));
        } catch (err) {
            console.warn(`Failed to delete S3 object ${doc.s3Key}:`, err);
        }
    }

    // Delete DynamoDB record
    await docClient.send(new DeleteCommand({
        TableName: TABLE_NAME(),
        Key: { PK: doc.PK, SK: doc.SK },
    }));

    // Write ORDER_LOG
    await docClient.send(new PutCommand({
        TableName: TABLE_NAME(),
        Item: {
            PK: `ORDER#${orderId}`,
            SK: `LOG#${now}`,
            action: 'DOCUMENT_DELETED',
            operator,
            timestamp: now,
            detail: `Deleted: ${doc.fileName} (${doc.stage}/${doc.docType})`,
        },
    }));

    return true;
}
