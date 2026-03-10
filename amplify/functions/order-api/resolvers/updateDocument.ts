import { QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../lib/dynamodb.js';
import { buildDocumentResponse } from '../lib/orderHelper.js';
import type { AppSyncEvent, DocumentItem } from '../lib/types.js';

export async function updateDocument(event: AppSyncEvent) {
    const { orderId, docId, description, docType, tags } = event.arguments as {
        orderId: string;
        docId: string;
        description?: string;
        docType?: string;
        tags?: string; // JSON string
    };

    if (!orderId || !docId) {
        throw new Error('orderId and docId are required');
    }

    // Find the document SK by querying for the docId
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
    const updateParts: string[] = [];
    const exprValues: Record<string, unknown> = {};

    if (description !== undefined) {
        updateParts.push('description = :desc');
        exprValues[':desc'] = description;
    }

    if (docType !== undefined) {
        updateParts.push('docType = :docType');
        exprValues[':docType'] = docType;
    }

    if (tags !== undefined) {
        let parsedTags: string[];
        try {
            parsedTags = typeof tags === 'string' ? JSON.parse(tags) : tags;
        } catch {
            parsedTags = [];
        }
        updateParts.push('tags = :tags');
        exprValues[':tags'] = parsedTags;
    }

    if (updateParts.length === 0) {
        return buildDocumentResponse(doc);
    }

    await docClient.send(new UpdateCommand({
        TableName: TABLE_NAME(),
        Key: { PK: doc.PK, SK: doc.SK },
        UpdateExpression: `SET ${updateParts.join(', ')}`,
        ExpressionAttributeValues: exprValues,
    }));

    // Return updated doc
    const updated = { ...doc };
    if (description !== undefined) updated.description = description;
    if (docType !== undefined) updated.docType = docType;
    if (tags !== undefined) {
        try {
            updated.tags = typeof tags === 'string' ? JSON.parse(tags) : tags;
        } catch {
            updated.tags = [];
        }
    }

    return buildDocumentResponse(updated);
}
