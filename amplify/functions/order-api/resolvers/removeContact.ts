import { GetCommand, DeleteCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../lib/dynamodb.js';
import type { AppSyncEvent, ContactItem } from '../lib/types.js';

export async function removeContact(event: AppSyncEvent) {
    const { orderId, contactId } = event.arguments as {
        orderId: string;
        contactId: string;
    };

    if (!orderId || !contactId) {
        throw new Error('orderId and contactId are required');
    }

    // Verify contact exists
    const result = await docClient.send(new GetCommand({
        TableName: TABLE_NAME(),
        Key: { PK: `ORDER#${orderId}`, SK: `CONTACT#${contactId}` },
    }));

    if (!result.Item) {
        throw new Error(`Contact not found: ${contactId}`);
    }

    const contact = result.Item as ContactItem;
    const now = new Date().toISOString();
    const operator = event.identity?.claims?.email as string || event.identity?.sub || 'admin';

    await docClient.send(new DeleteCommand({
        TableName: TABLE_NAME(),
        Key: { PK: `ORDER#${orderId}`, SK: `CONTACT#${contactId}` },
    }));

    // Write ORDER_LOG
    await docClient.send(new PutCommand({
        TableName: TABLE_NAME(),
        Item: {
            PK: `ORDER#${orderId}`,
            SK: `LOG#${now}`,
            action: 'CONTACT_REMOVED',
            operator,
            timestamp: now,
            detail: `Removed contact: ${contact.contactName} (${contact.role})`,
        },
    }));

    return true;
}
