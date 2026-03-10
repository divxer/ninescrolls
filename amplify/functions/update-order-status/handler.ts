import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { DynamoDBClient, ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import {
    DynamoDBDocumentClient, UpdateCommand, PutCommand, QueryCommand, GetCommand,
} from '@aws-sdk/lib-dynamodb';

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------
const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------
const TABLE_NAME = () => process.env.INTELLIGENCE_TABLE!;
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
// State Machine — §12.5
// ---------------------------------------------------------------------------
export const ORDER_STATUSES = [
    'INQUIRY', 'QUOTING', 'QUOTE_SENT', 'PO_RECEIVED',
    'IN_PRODUCTION', 'SHIPPED', 'INSTALLED', 'CLOSED', 'DECLINED',
] as const;

export type OrderStatus = typeof ORDER_STATUSES[number];

// Forward-only transitions (index-based)
const FORWARD_PATH: OrderStatus[] = [
    'INQUIRY', 'QUOTING', 'QUOTE_SENT', 'PO_RECEIVED',
    'IN_PRODUCTION', 'SHIPPED', 'INSTALLED', 'CLOSED',
];

/** Status date field mapping — §12.5 step 2 */
const STATUS_DATE_FIELD: Record<string, string> = {
    INQUIRY: 'inquiryDate',
    QUOTING: 'quoteDate',
    QUOTE_SENT: 'quoteSentDate',
    PO_RECEIVED: 'poDate',
    IN_PRODUCTION: 'productionStartDate',
    SHIPPED: 'shipDate',
    INSTALLED: 'installDate',
    CLOSED: 'closeDate',
    DECLINED: 'declinedDate',
};

/**
 * Validate a status transition.
 * Returns true if newStatus is the next step from currentStatus,
 * or if it's the special INQUIRY → DECLINED path.
 */
export function isValidTransition(current: OrderStatus, next: OrderStatus): boolean {
    // Special: INQUIRY → DECLINED
    if (current === 'INQUIRY' && next === 'DECLINED') return true;

    const curIdx = FORWARD_PATH.indexOf(current);
    const nextIdx = FORWARD_PATH.indexOf(next);

    // Both must be on the forward path, and next must be exactly one step forward
    if (curIdx === -1 || nextIdx === -1) return false;
    return nextIdx === curIdx + 1;
}

// ---------------------------------------------------------------------------
// Feedback Schedule — §12.5 step 4
// ---------------------------------------------------------------------------

/** Roles eligible for each feedback stage */
const FEEDBACK_STAGE_ROLES: Record<string, string[]> = {
    '3-day':   ['PI', 'RESEARCHER', 'PROCUREMENT', 'FACILITIES', 'FINANCE', 'LAB_MANAGER', 'OTHER'],
    '30-day':  ['PI', 'RESEARCHER', 'LAB_MANAGER'],
    '90-day':  ['PI', 'RESEARCHER', 'LAB_MANAGER'],
    '180-day': ['PI', 'LAB_MANAGER'],
    '365-day': ['PI', 'LAB_MANAGER', 'PROCUREMENT'],
};

const FEEDBACK_STAGE_DAYS: Record<string, number> = {
    '3-day': 3,
    '30-day': 30,
    '90-day': 90,
    '180-day': 180,
    '365-day': 365,
};

interface Contact {
    contactId: string;
    contactName: string;
    contactEmail: string;
    role: string;
    feedbackInvite: boolean;
}

function addDays(date: Date, days: number): Date {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}

async function createFeedbackSchedules(
    orderId: string,
    installDate: string,
    contacts: Contact[],
    orderMeta: Record<string, unknown>,
): Promise<number> {
    const baseDate = new Date(installDate);
    let created = 0;

    for (const contact of contacts) {
        if (!contact.feedbackInvite) continue;

        for (const [stage, roles] of Object.entries(FEEDBACK_STAGE_ROLES)) {
            if (!roles.includes(contact.role)) continue;

            const days = FEEDBACK_STAGE_DAYS[stage];
            const triggerDate = addDays(baseDate, days);
            const triggerDateStr = triggerDate.toISOString().slice(0, 10);
            // TTL = triggerDate + 7 days (give a week buffer for processing)
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
                    institution: orderMeta.institution,
                    productModel: orderMeta.productModel,
                    quoteNumber: orderMeta.quoteNumber || '',
                    installationDate: installDate,
                    createdAt: new Date().toISOString(),
                    TTL: ttl,
                },
            }));
            created++;
        }
    }

    console.log(`Created ${created} FEEDBACK_SCHEDULE items for order ${orderId}`);
    return created;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface StatusUpdateRequest {
    orderId: string;
    currentStatus: OrderStatus;  // For optimistic concurrency
    newStatus: OrderStatus;
    statusDate?: string;         // ISO date for the status
    note?: string;
    declineReason?: string;      // Required when INQUIRY → DECLINED
    operator: string;
}

// ---------------------------------------------------------------------------
// Handler — §12.5
// ---------------------------------------------------------------------------
export const handler: APIGatewayProxyHandlerV2 = async (event) => {
    console.log('update-order-status Lambda invoked');

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

        let req: StatusUpdateRequest;
        try {
            req = JSON.parse(event.body) as StatusUpdateRequest;
        } catch {
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({ success: false, error: 'Invalid JSON' }),
            };
        }

        // Validate required fields
        if (!req.orderId || !req.currentStatus || !req.newStatus || !req.operator) {
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({
                    success: false,
                    error: 'orderId, currentStatus, newStatus, and operator are required',
                }),
            };
        }

        // 1. Validate state transition — §12.5 step 1
        if (!isValidTransition(req.currentStatus, req.newStatus)) {
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({
                    success: false,
                    error: `Invalid status transition: ${req.currentStatus} → ${req.newStatus}`,
                }),
            };
        }

        // DECLINED requires reason
        if (req.newStatus === 'DECLINED' && !req.declineReason) {
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({
                    success: false,
                    error: 'declineReason is required when declining an inquiry',
                }),
            };
        }

        const now = new Date().toISOString();
        const statusDate = req.statusDate || now.slice(0, 10);
        const dateField = STATUS_DATE_FIELD[req.newStatus];

        // 2. Update ORDER entity with ConditionExpression — §20.3
        const updateExprParts = [
            '#s = :newStatus',
            'GSI1PK = :gsi1pk',
            'updatedAt = :now',
        ];
        const exprAttrValues: Record<string, unknown> = {
            ':newStatus': req.newStatus,
            ':expectedStatus': req.currentStatus,
            ':gsi1pk': `ORDER_STATUS#${req.newStatus}`,
            ':now': now,
        };
        const exprAttrNames: Record<string, string> = {
            '#s': 'status',
        };

        // Set the date field for this status
        if (dateField) {
            updateExprParts.push(`${dateField} = :statusDate`);
            exprAttrValues[':statusDate'] = statusDate;
        }

        // DECLINED-specific fields
        if (req.newStatus === 'DECLINED') {
            updateExprParts.push('declineReason = :reason');
            exprAttrValues[':reason'] = req.declineReason;
        }

        // INSTALLED: calculate warrantyEndDate (12 months)
        if (req.newStatus === 'INSTALLED') {
            const installDateObj = new Date(statusDate);
            const warrantyEnd = addDays(installDateObj, 365);
            updateExprParts.push('warrantyEndDate = :warrantyEnd');
            exprAttrValues[':warrantyEnd'] = warrantyEnd.toISOString().slice(0, 10);
        }

        try {
            await docClient.send(new UpdateCommand({
                TableName: TABLE_NAME(),
                Key: { PK: `ORDER#${req.orderId}`, SK: 'META' },
                UpdateExpression: `SET ${updateExprParts.join(', ')}`,
                ConditionExpression: '#s = :expectedStatus',
                ExpressionAttributeNames: exprAttrNames,
                ExpressionAttributeValues: exprAttrValues,
            }));
        } catch (err) {
            if (err instanceof ConditionalCheckFailedException) {
                return {
                    statusCode: 409,
                    headers: corsHeaders,
                    body: JSON.stringify({
                        success: false,
                        error: 'Order status has been updated by another user. Please refresh.',
                    }),
                };
            }
            throw err;
        }

        console.log(`ORDER ${req.orderId}: ${req.currentStatus} → ${req.newStatus}`);

        // 3. Write ORDER_LOG — §12.5 step 3
        await docClient.send(new PutCommand({
            TableName: TABLE_NAME(),
            Item: {
                PK: `ORDER#${req.orderId}`,
                SK: `LOG#${now}`,
                action: 'STATUS_CHANGE',
                fromStatus: req.currentStatus,
                toStatus: req.newStatus,
                operator: req.operator,
                timestamp: now,
                detail: req.note || `Status changed to ${req.newStatus}`,
            },
        }));

        // 4. If INSTALLED → create FEEDBACK_SCHEDULE — §12.5 step 4
        let feedbackSchedulesCreated = 0;
        if (req.newStatus === 'INSTALLED') {
            // Check idempotency flag first — §20.3
            const orderResult = await docClient.send(new GetCommand({
                TableName: TABLE_NAME(),
                Key: { PK: `ORDER#${req.orderId}`, SK: 'META' },
            }));
            const order = orderResult.Item;

            if (order && !order.feedbackScheduleCreated) {
                // Read all contacts with feedbackInvite=true
                const contactsResult = await docClient.send(new QueryCommand({
                    TableName: TABLE_NAME(),
                    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
                    ExpressionAttributeValues: {
                        ':pk': `ORDER#${req.orderId}`,
                        ':sk': 'CONTACT#',
                    },
                }));

                const contacts = (contactsResult.Items || []) as unknown as Contact[];

                feedbackSchedulesCreated = await createFeedbackSchedules(
                    req.orderId,
                    statusDate,
                    contacts,
                    order,
                );

                // Set idempotency flag
                await docClient.send(new UpdateCommand({
                    TableName: TABLE_NAME(),
                    Key: { PK: `ORDER#${req.orderId}`, SK: 'META' },
                    UpdateExpression: 'SET feedbackScheduleCreated = :t',
                    ExpressionAttributeValues: { ':t': true },
                }));
            } else {
                console.log('FEEDBACK_SCHEDULE already created, skipping');
            }
        }

        // 5. Slack notification — §12.5 step 5
        const webhookUrl = SLACK_WEBHOOK_URL();
        if (webhookUrl) {
            try {
                // Fetch order meta for notification context
                const orderResult = await docClient.send(new GetCommand({
                    TableName: TABLE_NAME(),
                    Key: { PK: `ORDER#${req.orderId}`, SK: 'META' },
                }));
                const order = orderResult.Item;
                const productModel = order?.productModel || 'Unknown';
                const institution = order?.institution || 'Unknown';

                let emoji = ':arrow_right:';
                if (req.newStatus === 'INSTALLED') emoji = ':white_check_mark:';
                if (req.newStatus === 'DECLINED') emoji = ':no_entry_sign:';
                if (req.newStatus === 'SHIPPED') emoji = ':package:';

                const text = `${emoji} [${productModel}] ${institution} → ${req.newStatus}`;
                await fetch(webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text }),
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
                orderId: req.orderId,
                previousStatus: req.currentStatus,
                newStatus: req.newStatus,
                feedbackSchedulesCreated,
            }),
        };

    } catch (error) {
        console.error('Error in update-order-status:', error);
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ success: false, error: 'Internal server error' }),
        };
    }
};
