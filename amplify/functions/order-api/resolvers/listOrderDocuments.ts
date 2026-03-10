import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../lib/dynamodb.js';
import { buildDocumentResponse } from '../lib/orderHelper.js';
import type { AppSyncEvent, DocumentItem } from '../lib/types.js';

export async function listOrderDocuments(event: AppSyncEvent) {
    const { orderId, stage, docType } = event.arguments as {
        orderId: string;
        stage?: string;
        docType?: string;
    };

    if (!orderId) {
        throw new Error('orderId is required');
    }

    // Build key condition — filter by stage prefix if provided
    const skPrefix = stage ? `DOC#${stage}#` : 'DOC#';

    const result = await docClient.send(new QueryCommand({
        TableName: TABLE_NAME(),
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
            ':pk': `ORDER#${orderId}`,
            ':sk': skPrefix,
        },
    }));

    let docs = (result.Items || []) as DocumentItem[];

    // Post-filter by docType if specified
    if (docType) {
        docs = docs.filter(d => d.docType === docType);
    }

    return Promise.all(docs.map(buildDocumentResponse));
}
