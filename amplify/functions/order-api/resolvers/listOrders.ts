import { QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../lib/dynamodb.js';
import { buildOrderResponse } from '../lib/orderHelper.js';
import type { AppSyncEvent, OrderItem, ContactItem } from '../lib/types.js';

export async function listOrders(event: AppSyncEvent) {
    const { status, limit = 20, nextToken } = event.arguments as {
        status?: string;
        limit?: number;
        nextToken?: string;
    };

    const effectiveLimit = Math.min(limit, 100);
    const exclusiveStartKey = nextToken ? JSON.parse(Buffer.from(nextToken, 'base64').toString()) : undefined;

    let items: Record<string, unknown>[];
    let lastEvaluatedKey: Record<string, unknown> | undefined;

    if (status) {
        // Query GSI1 for specific status
        const result = await docClient.send(new QueryCommand({
            TableName: TABLE_NAME(),
            IndexName: 'GSI1',
            KeyConditionExpression: 'GSI1PK = :pk',
            ExpressionAttributeValues: { ':pk': `ORDER_STATUS#${status}` },
            ScanIndexForward: false,
            Limit: effectiveLimit,
            ExclusiveStartKey: exclusiveStartKey,
        }));
        items = result.Items || [];
        lastEvaluatedKey = result.LastEvaluatedKey;
    } else {
        // Scan for all orders (SK=META and PK starts with ORDER#)
        const result = await docClient.send(new ScanCommand({
            TableName: TABLE_NAME(),
            FilterExpression: 'begins_with(PK, :pk) AND SK = :sk',
            ExpressionAttributeValues: {
                ':pk': 'ORDER#',
                ':sk': 'META',
            },
            Limit: effectiveLimit * 3, // overscan since filter reduces results
            ExclusiveStartKey: exclusiveStartKey,
        }));
        items = result.Items || [];
        lastEvaluatedKey = result.LastEvaluatedKey;
        // Sort by updatedAt descending
        items.sort((a, b) => ((b.updatedAt as string) || '').localeCompare((a.updatedAt as string) || ''));
        items = items.slice(0, effectiveLimit);
    }

    // Fetch contacts for each order
    const orders = await Promise.all(
        items.map(async (item) => {
            const orderId = item.orderId as string;
            const contactResult = await docClient.send(new QueryCommand({
                TableName: TABLE_NAME(),
                KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
                ExpressionAttributeValues: {
                    ':pk': `ORDER#${orderId}`,
                    ':sk': 'CONTACT#',
                },
            }));
            return buildOrderResponse(item as OrderItem, (contactResult.Items || []) as ContactItem[]);
        }),
    );

    return {
        items: orders,
        nextToken: lastEvaluatedKey
            ? Buffer.from(JSON.stringify(lastEvaluatedKey)).toString('base64')
            : null,
    };
}
