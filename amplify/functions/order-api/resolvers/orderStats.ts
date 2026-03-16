import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../lib/dynamodb.js';
import { ORDER_STATUSES } from '../lib/types.js';
import type { AppSyncEvent } from '../lib/types.js';

const TERMINAL_STATUSES = ['CLOSED', 'DECLINED'];

export async function orderStats(_event: AppSyncEvent) {
    const byStatus: Record<string, number> = {};
    let totalActive = 0;

    // Count orders per status via GSI1
    await Promise.all(
        ORDER_STATUSES.map(async (status) => {
            const result = await docClient.send(new QueryCommand({
                TableName: TABLE_NAME(),
                IndexName: 'GSI1',
                KeyConditionExpression: 'GSI1PK = :pk',
                ExpressionAttributeValues: { ':pk': `ORDER_STATUS#${status}` },
                Select: 'COUNT',
            }));
            const count = result.Count || 0;
            byStatus[status] = count;
            if (!TERMINAL_STATUSES.includes(status)) {
                totalActive += count;
            }
        }),
    );

    // Calculate avgDaysToInstall from INSTALLED orders
    let avgDaysToInstall: number | null = null;
    const installedResult = await docClient.send(new QueryCommand({
        TableName: TABLE_NAME(),
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :pk',
        ExpressionAttributeValues: { ':pk': 'ORDER_STATUS#INSTALLED' },
        Limit: 50,
    }));
    const installedOrders = installedResult.Items || [];
    if (installedOrders.length > 0) {
        let totalDays = 0;
        let validCount = 0;
        for (const order of installedOrders) {
            const start = order.inquiryDate || order.quoteDate || order.createdAt;
            const end = order.installDate;
            if (start && end) {
                const days = Math.floor(
                    (new Date(end as string).getTime() - new Date(start as string).getTime()) / (1000 * 60 * 60 * 24),
                );
                if (days > 0) {
                    totalDays += days;
                    validCount++;
                }
            }
        }
        if (validCount > 0) {
            avgDaysToInstall = Math.round((totalDays / validCount) * 10) / 10;
        }
    }

    // Count upcoming deliveries (estimatedDelivery in next 30 days)
    let upcomingDeliveries = 0;
    let overdueOrders = 0;
    const now = new Date();
    const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const today = now.toISOString().slice(0, 10);
    const futureDate = thirtyDaysLater.toISOString().slice(0, 10);

    // Check active orders for delivery dates
    const activeStatuses = ['PO_RECEIVED', 'IN_PRODUCTION', 'SHIPPED'];
    for (const status of activeStatuses) {
        const result = await docClient.send(new QueryCommand({
            TableName: TABLE_NAME(),
            IndexName: 'GSI1',
            KeyConditionExpression: 'GSI1PK = :pk',
            ExpressionAttributeValues: { ':pk': `ORDER_STATUS#${status}` },
        }));
        for (const order of result.Items || []) {
            const ed = order.estimatedDelivery as string | undefined;
            if (ed) {
                if (ed >= today && ed <= futureDate) {
                    upcomingDeliveries++;
                }
                if (ed < today && status !== 'SHIPPED') {
                    overdueOrders++;
                }
            }
        }
    }

    return {
        totalActive,
        byStatus,
        avgDaysToInstall,
        upcomingDeliveries,
        overdueOrders,
    };
}
