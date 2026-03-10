import type { AppSyncEvent } from '../lib/types.js';
import { buildFullOrderResponse } from '../lib/orderHelper.js';

export async function getOrder(event: AppSyncEvent) {
    const { orderId } = event.arguments as { orderId: string };

    if (!orderId) {
        throw new Error('orderId is required');
    }

    const order = await buildFullOrderResponse(orderId);
    if (!order) {
        throw new Error(`Order not found: ${orderId}`);
    }

    return order;
}
