import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../lib/dynamodb.js';
import type { AppSyncEvent } from '../lib/types.js';

/**
 * Query GSI4 to retrieve all entities (Lead, RFQ, Order) for a given email.
 * GSI4PK = EMAIL#<normalized_email>, GSI4SK = <ENTITY_TYPE>#<timestamp>
 * Results are returned in reverse chronological order.
 */
export async function listByEmail(event: AppSyncEvent) {
    const { email, limit, nextToken } = event.arguments as {
        email: string;
        limit?: number;
        nextToken?: string;
    };

    if (!email) {
        throw new Error('email is required');
    }

    const normalizedEmail = email.trim().toLowerCase();
    const queryLimit = Math.min(limit || 50, 100);

    const result = await docClient.send(new QueryCommand({
        TableName: TABLE_NAME(),
        IndexName: 'GSI4',
        KeyConditionExpression: 'GSI4PK = :pk',
        ExpressionAttributeValues: { ':pk': `EMAIL#${normalizedEmail}` },
        ScanIndexForward: false, // newest first
        Limit: queryLimit,
        ...(nextToken ? { ExclusiveStartKey: JSON.parse(Buffer.from(nextToken, 'base64url').toString()) } : {}),
    }));

    const items = (result.Items || []).map((item: Record<string, unknown>) => {
        const pk = item.PK as string;
        if (pk.startsWith('LEAD#')) {
            return {
                entityType: 'LEAD',
                entityId: item.leadId,
                email: item.email,
                timestamp: item.submittedAt,
                summary: item.type === 'contact'
                    ? `Contact: ${item.productName || 'General'}`
                    : item.type === 'download_gate'
                        ? `Download: ${item.fileName || 'Document'}`
                        : 'Newsletter subscription',
                status: item.type,
                detail: JSON.stringify({
                    leadId: item.leadId,
                    type: item.type,
                    name: item.name,
                    organization: item.organization,
                    productName: item.productName,
                    message: item.message,
                    intent: item.intent,
                }),
            };
        } else if (pk.startsWith('RFQ#')) {
            return {
                entityType: 'RFQ',
                entityId: item.rfqId,
                email: item.email,
                timestamp: item.submittedAt,
                summary: `RFQ: ${item.equipmentCategory || 'Equipment'}${item.specificModel ? ` — ${item.specificModel}` : ''}`,
                status: item.status,
                detail: JSON.stringify({
                    rfqId: item.rfqId,
                    referenceNumber: item.referenceNumber,
                    institution: item.institution,
                    equipmentCategory: item.equipmentCategory,
                    budgetRange: item.budgetRange,
                    timeline: item.timeline,
                    linkedOrderId: item.linkedOrderId,
                }),
            };
        } else if (pk.startsWith('ORDER#')) {
            return {
                entityType: 'ORDER',
                entityId: item.orderId,
                email: item.email || normalizedEmail,
                timestamp: item.createdAt,
                summary: `Order: ${item.productModel || 'Unknown'}${item.institution ? ` — ${item.institution}` : ''}`,
                status: item.status,
                detail: JSON.stringify({
                    orderId: item.orderId,
                    institution: item.institution,
                    productModel: item.productModel,
                    quoteAmount: item.quoteAmount,
                    source: item.source,
                    rfqId: item.rfqId,
                }),
            };
        }
        // Unknown entity type — return minimal info
        return {
            entityType: 'UNKNOWN',
            entityId: pk,
            email: normalizedEmail,
            timestamp: item.createdAt || item.submittedAt || '',
            summary: pk,
            status: '',
            detail: '{}',
        };
    });

    let cursor: string | null = null;
    if (result.LastEvaluatedKey) {
        cursor = Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64url');
    }

    return { items, nextToken: cursor };
}
