import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../lib/dynamodb.js';
import { fetchOrder, buildFullOrderResponse } from '../lib/orderHelper.js';
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
    estimatedDelivery?: string;
    notes?: string;
}

const UPDATABLE_FIELDS = [
    'quoteNumber', 'poNumber', 'institution', 'department',
    'productModel', 'productName', 'configuration', 'quoteAmount',
    'estimatedDelivery', 'notes',
];

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

    const updateParts: string[] = ['updatedAt = :now'];
    const exprValues: Record<string, unknown> = { ':now': new Date().toISOString() };

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

    return buildFullOrderResponse(orderId);
}
