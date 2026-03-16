import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { UpdateCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../lib/dynamodb.js';
import { fetchOrder, buildFullOrderResponse, sendSlackNotification } from '../lib/orderHelper.js';
import { getOperatorInfo } from '../lib/types.js';
import type { AppSyncEvent } from '../lib/types.js';

export async function declineInquiry(event: AppSyncEvent) {
    const { orderId, reason, note } = event.arguments as {
        orderId: string;
        reason: string;
        note?: string;
    };

    if (!orderId || !reason) {
        throw new Error('orderId and reason are required');
    }

    const currentOrder = await fetchOrder(orderId);
    if (!currentOrder) {
        throw new Error(`Order not found: ${orderId}`);
    }

    if (currentOrder.status !== 'INQUIRY') {
        throw new Error(`Only INQUIRY orders can be declined. Current status: ${currentOrder.status}`);
    }

    const now = new Date().toISOString();
    const { email: operator } = getOperatorInfo(event);

    try {
        await docClient.send(new UpdateCommand({
            TableName: TABLE_NAME(),
            Key: { PK: `ORDER#${orderId}`, SK: 'META' },
            UpdateExpression: 'SET #s = :newStatus, GSI1PK = :gsi1pk, updatedAt = :now, declineReason = :reason, declinedDate = :date',
            ConditionExpression: '#s = :expectedStatus',
            ExpressionAttributeNames: { '#s': 'status' },
            ExpressionAttributeValues: {
                ':newStatus': 'DECLINED',
                ':expectedStatus': 'INQUIRY',
                ':gsi1pk': 'ORDER_STATUS#DECLINED',
                ':now': now,
                ':reason': reason,
                ':date': now.slice(0, 10),
            },
        }));
    } catch (err) {
        if (err instanceof ConditionalCheckFailedException) {
            throw new Error('Order status has been updated by another user. Please refresh.');
        }
        throw err;
    }

    // Write ORDER_LOG
    await docClient.send(new PutCommand({
        TableName: TABLE_NAME(),
        Item: {
            PK: `ORDER#${orderId}`,
            SK: `LOG#${now}`,
            action: 'STATUS_CHANGE',
            fromStatus: 'INQUIRY',
            toStatus: 'DECLINED',
            operator,
            timestamp: now,
            detail: note || `Declined: ${reason}`,
        },
    }));

    // Slack notification
    await sendSlackNotification(
        `:no_entry_sign: [${currentOrder.productModel}] ${currentOrder.institution} → DECLINED (${reason})`,
    );

    return buildFullOrderResponse(orderId);
}
