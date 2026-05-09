import { UpdateCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../lib/dynamodb.js';
import { fetchOrder, buildFullOrderResponse } from '../lib/orderHelper.js';
import { getOperatorInfo } from '../lib/types.js';
import type { AppSyncEvent } from '../lib/types.js';

interface UpdateOrderInput {
    quoteNumber?: string;
    poNumber?: string;
    institution?: string;
    department?: string;
    productModel?: string;
    productName?: string;
    configuration?: string;
    quoteAmount?: number;
    quoteDate?: string;
    quoteValidUntil?: string;
    estimatedDelivery?: string;
    notes?: string;
}

const UPDATABLE_FIELDS = [
    'quoteNumber', 'poNumber', 'institution', 'department',
    'productModel', 'productName', 'configuration', 'quoteAmount',
    'quoteDate', 'quoteValidUntil',
    'estimatedDelivery', 'notes',
];

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function updateOrder(event: AppSyncEvent) {
    const { orderId, input: rawInput } = event.arguments as {
        orderId: string;
        input: string | UpdateOrderInput;
    };

    if (!orderId) {
        throw new Error('orderId is required');
    }

    const input: UpdateOrderInput = typeof rawInput === 'string' ? JSON.parse(rawInput) : rawInput;

    // Verify order exists
    const existing = await fetchOrder(orderId);
    if (!existing) {
        throw new Error(`Order not found: ${orderId}`);
    }

    if (input.quoteValidUntil !== undefined && input.quoteValidUntil !== '' && !ISO_DATE_RE.test(input.quoteValidUntil)) {
        throw new Error('quoteValidUntil must be a YYYY-MM-DD date');
    }
    if (input.quoteDate !== undefined && input.quoteDate !== '' && !ISO_DATE_RE.test(input.quoteDate)) {
        throw new Error('quoteDate must be a YYYY-MM-DD date');
    }
    const effectiveQuoteDate = input.quoteDate ?? existing.quoteDate;
    if (input.quoteValidUntil && effectiveQuoteDate && input.quoteValidUntil < effectiveQuoteDate) {
        throw new Error('quoteValidUntil cannot be before quoteDate');
    }

    if (input.quoteValidUntil === '') input.quoteValidUntil = undefined;
    if (input.quoteDate === '') input.quoteDate = undefined;

    const now = new Date().toISOString();
    const updateParts: string[] = ['updatedAt = :now'];
    const exprValues: Record<string, unknown> = { ':now': now };

    for (const field of UPDATABLE_FIELDS) {
        const value = (input as Record<string, unknown>)[field];
        if (value !== undefined) {
            updateParts.push(`${field} = :${field}`);
            exprValues[`:${field}`] = value;
        }
    }

    await docClient.send(new UpdateCommand({
        TableName: TABLE_NAME(),
        Key: { PK: `ORDER#${orderId}`, SK: 'META' },
        UpdateExpression: `SET ${updateParts.join(', ')}`,
        ExpressionAttributeValues: exprValues,
    }));

    if (input.quoteValidUntil !== undefined && input.quoteValidUntil !== existing.quoteValidUntil) {
        const { email: operator } = getOperatorInfo(event);
        try {
            await docClient.send(new PutCommand({
                TableName: TABLE_NAME(),
                Item: {
                    PK: `ORDER#${orderId}`,
                    SK: `LOG#${now}`,
                    action: 'QUOTE_VALIDITY_UPDATED',
                    operator,
                    timestamp: now,
                    detail: `Quote valid until: ${existing.quoteValidUntil ?? '(none)'} → ${input.quoteValidUntil ?? '(none)'}`,
                },
            }));
        } catch (err) {
            console.error('Failed to write QUOTE_VALIDITY_UPDATED audit log:', err);
        }
    }

    return buildFullOrderResponse(orderId);
}
