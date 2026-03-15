import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../lib/dynamodb.js';
import type { AppSyncEvent, ContactItem } from '../lib/types.js';

interface UpdateContactInput {
    contactName?: string;
    contactEmail?: string;
    contactPhone?: string;
    role?: string;
    department?: string;
    isPrimary?: boolean;
    feedbackInvite?: boolean;
    notes?: string;
}

const CONTACT_FIELDS = [
    'contactName', 'contactEmail', 'contactPhone', 'role',
    'department', 'isPrimary', 'feedbackInvite', 'notes',
];

export async function updateContact(event: AppSyncEvent) {
    const { orderId, contactId, input: rawInput } = event.arguments as {
        orderId: string;
        contactId: string;
        input: string | UpdateContactInput;
    };

    if (!orderId || !contactId) {
        throw new Error('orderId and contactId are required');
    }

    const input: UpdateContactInput = typeof rawInput === 'string' ? JSON.parse(rawInput) : rawInput;

    // Fetch existing contact
    const result = await docClient.send(new GetCommand({
        TableName: TABLE_NAME(),
        Key: { PK: `ORDER#${orderId}`, SK: `CONTACT#${contactId}` },
    }));

    if (!result.Item) {
        throw new Error(`Contact not found: ${contactId}`);
    }

    const existing = result.Item as ContactItem;
    const updateParts: string[] = [];
    const exprValues: Record<string, unknown> = {};
    const exprNames: Record<string, string> = {};

    // DynamoDB reserved keywords that need aliasing
    const RESERVED = new Set(['role', 'status', 'name', 'notes']);

    for (const field of CONTACT_FIELDS) {
        const value = (input as Record<string, unknown>)[field];
        if (value !== undefined) {
            if (RESERVED.has(field)) {
                exprNames[`#${field}`] = field;
                updateParts.push(`#${field} = :${field}`);
            } else {
                updateParts.push(`${field} = :${field}`);
            }
            exprValues[`:${field}`] = value;
        }
    }

    if (updateParts.length === 0) {
        return {
            contactId: existing.contactId,
            contactName: existing.contactName,
            contactEmail: existing.contactEmail,
            contactPhone: existing.contactPhone || null,
            role: existing.role,
            department: existing.department || null,
            isPrimary: existing.isPrimary,
            feedbackInvite: existing.feedbackInvite,
            notes: existing.notes || null,
        };
    }

    await docClient.send(new UpdateCommand({
        TableName: TABLE_NAME(),
        Key: { PK: `ORDER#${orderId}`, SK: `CONTACT#${contactId}` },
        UpdateExpression: `SET ${updateParts.join(', ')}`,
        ExpressionAttributeValues: exprValues,
        ...(Object.keys(exprNames).length > 0 && { ExpressionAttributeNames: exprNames }),
    }));

    // Build updated response
    const updated = { ...existing };
    for (const field of CONTACT_FIELDS) {
        const value = (input as Record<string, unknown>)[field];
        if (value !== undefined) {
            (updated as Record<string, unknown>)[field] = value;
        }
    }

    return {
        contactId: updated.contactId,
        contactName: updated.contactName,
        contactEmail: updated.contactEmail,
        contactPhone: updated.contactPhone || null,
        role: updated.role,
        department: updated.department || null,
        isPrimary: updated.isPrimary,
        feedbackInvite: updated.feedbackInvite,
        notes: updated.notes || null,
    };
}
