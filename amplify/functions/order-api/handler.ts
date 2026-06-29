// Queries
import { listOrders } from './resolvers/listOrders.js';
import { getOrder } from './resolvers/getOrder.js';
import { getOrderLogs } from './resolvers/getOrderLogs.js';
import { orderStats } from './resolvers/orderStats.js';
import { listOrderDocuments } from './resolvers/listOrderDocuments.js';
import { getDocumentUploadUrl } from './resolvers/getDocumentUploadUrl.js';
import { listRfqs } from './resolvers/listRfqs.js';
import { getRfq } from './resolvers/getRfq.js';
import { listLeads } from './resolvers/listLeads.js';
import { getLead } from './resolvers/getLead.js';
import { listByEmail } from './resolvers/listByEmail.js';

// Mutations
import { createOrder } from './resolvers/createOrder.js';
import { updateOrderStatus } from './resolvers/updateOrderStatus.js';
import { updateOrder } from './resolvers/updateOrder.js';
import { addContact } from './resolvers/addContact.js';
import { updateContact } from './resolvers/updateContact.js';
import { removeContact } from './resolvers/removeContact.js';
import { declineInquiry } from './resolvers/declineInquiry.js';
import { confirmDocumentUpload } from './resolvers/confirmDocumentUpload.js';
import { updateDocument } from './resolvers/updateDocument.js';
import { deleteDocument } from './resolvers/deleteDocument.js';
import { declineRfq } from './resolvers/declineRfq.js';
import { convertRfqToOrder } from './resolvers/convertRfqToOrder.js';
import { revertRfqToPending } from './resolvers/revertRfqToPending.js';
import type { AppSyncEvent } from './lib/types.js';

const resolvers: Record<string, (event: AppSyncEvent) => Promise<unknown>> = {
    // Queries
    listOrders,
    getOrder,
    getOrderLogs,
    orderStats,
    listOrderDocuments,
    getDocumentUploadUrl,
    listRfqs,
    getRfq,
    listLeads,
    getLead,
    listByEmail,
    // Mutations
    createOrder,
    updateOrderStatus,
    updateOrder,
    addContact,
    updateContact,
    removeContact,
    declineInquiry,
    confirmDocumentUpload,
    updateDocument,
    deleteDocument,
    declineRfq,
    convertRfqToOrder,
    revertRfqToPending,
};

export const handler = async (event: Record<string, unknown>) => {
    console.log('order-api event keys:', Object.keys(event));
    console.log('order-api identity:', JSON.stringify((event as { identity?: unknown }).identity));

    const evt = event as {
        info?: { fieldName?: string };
        fieldName?: string;
        typeName?: string;
        arguments?: unknown;
    };

    // Amplify Gen 2 a.handler.function() sends { typeName, fieldName, arguments, identity, ... }
    // Standard AppSync sends { info: { fieldName, parentTypeName }, arguments, identity, ... }
    const fieldName = evt.info?.fieldName ?? evt.fieldName;

    if (!fieldName) {
        console.error('order-api: full event:', JSON.stringify(event));
        throw new Error(`Cannot determine fieldName. Event keys: ${Object.keys(event).join(', ')}`);
    }

    console.log(`order-api: resolving ${fieldName}`);

    const resolver = resolvers[fieldName];
    if (!resolver) {
        throw new Error(`No resolver for field: ${fieldName}`);
    }

    // Normalize event so resolvers can use event.arguments consistently
    const normalizedEvent = evt.info
        ? event  // Standard AppSync format
        : { ...event, info: { fieldName, parentTypeName: evt.typeName }, arguments: evt.arguments };

    return resolver(normalizedEvent as unknown as AppSyncEvent);
};
