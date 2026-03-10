import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../lib/dynamodb.js';
import type { AppSyncEvent, LogItem } from '../lib/types.js';

export async function getOrderLogs(event: AppSyncEvent) {
    const { orderId } = event.arguments as { orderId: string };

    if (!orderId) {
        throw new Error('orderId is required');
    }

    const result = await docClient.send(new QueryCommand({
        TableName: TABLE_NAME(),
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
            ':pk': `ORDER#${orderId}`,
            ':sk': 'LOG#',
        },
        ScanIndexForward: false, // newest first
    }));

    return (result.Items || []).map((item) => {
        const log = item as LogItem;
        return {
            action: log.action,
            fromStatus: log.fromStatus || null,
            toStatus: log.toStatus || null,
            operator: log.operator,
            timestamp: log.timestamp,
            detail: log.detail || null,
        };
    });
}
