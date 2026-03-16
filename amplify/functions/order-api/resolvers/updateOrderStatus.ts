import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { UpdateCommand, PutCommand, GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../lib/dynamodb.js';
import { isValidTransition, STATUS_DATE_FIELD, FEEDBACK_STAGE_ROLES, FEEDBACK_STAGE_DAYS, addDays } from '../lib/statusMachine.js';
import { fetchOrder, buildFullOrderResponse, sendSlackNotification } from '../lib/orderHelper.js';
import { getOperatorInfo } from '../lib/types.js';
import type { AppSyncEvent, OrderStatus, ContactItem } from '../lib/types.js';

export async function updateOrderStatus(event: AppSyncEvent) {
    const { orderId, newStatus, statusDate, note } = event.arguments as {
        orderId: string;
        newStatus: OrderStatus;
        statusDate?: string;
        note?: string;
    };

    if (!orderId || !newStatus) {
        throw new Error('orderId and newStatus are required');
    }

    // Fetch current order to get currentStatus
    const currentOrder = await fetchOrder(orderId);
    if (!currentOrder) {
        throw new Error(`Order not found: ${orderId}`);
    }

    const currentStatus = currentOrder.status;
    const { email: operator } = getOperatorInfo(event);

    // 1. Validate state transition
    if (!isValidTransition(currentStatus, newStatus)) {
        throw new Error(`Invalid status transition: ${currentStatus} -> ${newStatus}`);
    }

    const now = new Date().toISOString();
    const effectiveStatusDate = statusDate || now.slice(0, 10);
    const dateField = STATUS_DATE_FIELD[newStatus];

    // 2. Update ORDER entity with ConditionExpression
    const updateExprParts = [
        '#s = :newStatus',
        'GSI1PK = :gsi1pk',
        'updatedAt = :now',
    ];
    const exprAttrValues: Record<string, unknown> = {
        ':newStatus': newStatus,
        ':expectedStatus': currentStatus,
        ':gsi1pk': `ORDER_STATUS#${newStatus}`,
        ':now': now,
    };
    const exprAttrNames: Record<string, string> = { '#s': 'status' };

    if (dateField) {
        updateExprParts.push(`${dateField} = :statusDate`);
        exprAttrValues[':statusDate'] = effectiveStatusDate;
    }

    if (newStatus === 'DECLINED') {
        throw new Error('Use declineInquiry mutation for declining orders');
    }

    if (newStatus === 'INSTALLED') {
        const installDateObj = new Date(effectiveStatusDate);
        const warrantyEnd = addDays(installDateObj, 365);
        updateExprParts.push('warrantyEndDate = :warrantyEnd');
        exprAttrValues[':warrantyEnd'] = warrantyEnd.toISOString().slice(0, 10);
    }

    try {
        await docClient.send(new UpdateCommand({
            TableName: TABLE_NAME(),
            Key: { PK: `ORDER#${orderId}`, SK: 'META' },
            UpdateExpression: `SET ${updateExprParts.join(', ')}`,
            ConditionExpression: '#s = :expectedStatus',
            ExpressionAttributeNames: exprAttrNames,
            ExpressionAttributeValues: exprAttrValues,
        }));
    } catch (err) {
        if (err instanceof ConditionalCheckFailedException) {
            throw new Error('Order status has been updated by another user. Please refresh.');
        }
        throw err;
    }

    // 3. Write ORDER_LOG
    await docClient.send(new PutCommand({
        TableName: TABLE_NAME(),
        Item: {
            PK: `ORDER#${orderId}`,
            SK: `LOG#${now}`,
            action: 'STATUS_CHANGE',
            fromStatus: currentStatus,
            toStatus: newStatus,
            operator,
            timestamp: now,
            detail: note || `Status changed to ${newStatus}`,
        },
    }));

    // 4. If INSTALLED -> create FEEDBACK_SCHEDULE
    if (newStatus === 'INSTALLED') {
        const orderResult = await docClient.send(new GetCommand({
            TableName: TABLE_NAME(),
            Key: { PK: `ORDER#${orderId}`, SK: 'META' },
        }));
        const order = orderResult.Item;

        if (order && !order.feedbackScheduleCreated) {
            const contactsResult = await docClient.send(new QueryCommand({
                TableName: TABLE_NAME(),
                KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
                ExpressionAttributeValues: {
                    ':pk': `ORDER#${orderId}`,
                    ':sk': 'CONTACT#',
                },
            }));

            const contacts = (contactsResult.Items || []) as ContactItem[];
            const baseDate = new Date(effectiveStatusDate);

            for (const contact of contacts) {
                if (!contact.feedbackInvite) continue;

                for (const [stage, roles] of Object.entries(FEEDBACK_STAGE_ROLES)) {
                    if (!roles.includes(contact.role)) continue;

                    const days = FEEDBACK_STAGE_DAYS[stage];
                    const triggerDate = addDays(baseDate, days);
                    const triggerDateStr = triggerDate.toISOString().slice(0, 10);
                    const ttl = Math.floor(addDays(triggerDate, 7).getTime() / 1000);

                    await docClient.send(new PutCommand({
                        TableName: TABLE_NAME(),
                        Item: {
                            PK: `SCHEDULE#${orderId}`,
                            SK: `FEEDBACK_INVITE#${stage}#${contact.contactId}`,
                            orderId,
                            contactId: contact.contactId,
                            contactName: contact.contactName,
                            contactEmail: contact.contactEmail,
                            contactRole: contact.role,
                            stage,
                            triggerDate: triggerDateStr,
                            status: 'pending',
                            institution: order.institution,
                            productModel: order.productModel,
                            quoteNumber: order.quoteNumber || '',
                            installationDate: effectiveStatusDate,
                            createdAt: now,
                            TTL: ttl,
                        },
                    }));
                }
            }

            // Set idempotency flag
            await docClient.send(new UpdateCommand({
                TableName: TABLE_NAME(),
                Key: { PK: `ORDER#${orderId}`, SK: 'META' },
                UpdateExpression: 'SET feedbackScheduleCreated = :t',
                ExpressionAttributeValues: { ':t': true },
            }));
        }
    }

    // 5. Slack notification
    let emoji = ':arrow_right:';
    if (newStatus === 'INSTALLED') emoji = ':white_check_mark:';
    if (newStatus === 'SHIPPED') emoji = ':package:';

    await sendSlackNotification(
        `${emoji} [${currentOrder.productModel}] ${currentOrder.institution} → ${newStatus}`,
    );

    // 6. Return full Order
    return buildFullOrderResponse(orderId);
}
