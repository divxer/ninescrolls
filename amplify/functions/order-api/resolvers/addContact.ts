import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../lib/dynamodb.js';
import { generateContactId } from '../lib/idGenerators.js';
import { fetchOrder } from '../lib/orderHelper.js';
import { getOperatorInfo } from '../lib/types.js';
import type { AppSyncEvent } from '../lib/types.js';

interface AddContactInput {
    contactName: string;
    contactEmail: string;
    contactPhone?: string;
    role: string;
    department?: string;
    isPrimary?: boolean;
    feedbackInvite?: boolean;
    notes?: string;
}

export async function addContact(event: AppSyncEvent) {
    const { orderId, input: rawInput } = event.arguments as {
        orderId: string;
        input: string | AddContactInput;
    };

    if (!orderId) {
        throw new Error('orderId is required');
    }

    const input: AddContactInput = typeof rawInput === 'string' ? JSON.parse(rawInput) : rawInput;

    if (!input.contactName || !input.contactEmail || !input.role) {
        throw new Error('contactName, contactEmail, and role are required');
    }

    // Verify order exists
    const order = await fetchOrder(orderId);
    if (!order) {
        throw new Error(`Order not found: ${orderId}`);
    }

    const contactId = generateContactId();
    const now = new Date().toISOString();
    const { email: operator } = getOperatorInfo(event);

    await docClient.send(new PutCommand({
        TableName: TABLE_NAME(),
        Item: {
            PK: `ORDER#${orderId}`,
            SK: `CONTACT#${contactId}`,
            contactId,
            contactName: input.contactName,
            contactEmail: input.contactEmail,
            contactPhone: input.contactPhone || '',
            role: input.role,
            department: input.department || '',
            isPrimary: input.isPrimary || false,
            feedbackInvite: input.feedbackInvite !== false,
            notes: input.notes || '',
        },
    }));

    // Write ORDER_LOG
    await docClient.send(new PutCommand({
        TableName: TABLE_NAME(),
        Item: {
            PK: `ORDER#${orderId}`,
            SK: `LOG#${now}`,
            action: 'CONTACT_ADDED',
            operator,
            timestamp: now,
            detail: `Added contact: ${input.contactName} (${input.role})`,
        },
    }));

    return {
        contactId,
        contactName: input.contactName,
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone || null,
        role: input.role,
        department: input.department || null,
        isPrimary: input.isPrimary || false,
        feedbackInvite: input.feedbackInvite !== false,
        notes: input.notes || null,
    };
}
