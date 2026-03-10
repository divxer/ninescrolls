import type { AppSyncResolverHandler } from 'aws-lambda';

// Queries
import { listOrders } from './resolvers/listOrders.js';
import { getOrder } from './resolvers/getOrder.js';
import { getOrderLogs } from './resolvers/getOrderLogs.js';
import { orderStats } from './resolvers/orderStats.js';
import { listOrderDocuments } from './resolvers/listOrderDocuments.js';
import { getDocumentUploadUrl } from './resolvers/getDocumentUploadUrl.js';
import { listRfqs } from './resolvers/listRfqs.js';
import { getRfq } from './resolvers/getRfq.js';

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

const resolvers: Record<string, (event: any) => Promise<any>> = {
    // Queries
    listOrders,
    getOrder,
    getOrderLogs,
    orderStats,
    listOrderDocuments,
    getDocumentUploadUrl,
    listRfqs,
    getRfq,
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
};

export const handler: AppSyncResolverHandler<any, any> = async (event) => {
    console.log(`order-api: ${event.info.parentTypeName}.${event.info.fieldName}`);

    const resolver = resolvers[event.info.fieldName];
    if (!resolver) {
        throw new Error(`No resolver for field: ${event.info.fieldName}`);
    }

    return resolver(event);
};
