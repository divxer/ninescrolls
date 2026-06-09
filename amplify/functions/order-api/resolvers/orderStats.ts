import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../lib/dynamodb.js';
import { ORDER_STATUSES } from '../lib/types.js';
import type { AppSyncEvent } from '../lib/types.js';

const TERMINAL_STATUSES = ['CLOSED', 'DECLINED'];
// Statuses considered "active" for stalled-order surfacing. INSTALLED is excluded
// because installed orders sit there indefinitely without harm.
const STALLED_CANDIDATE_STATUSES = ['INQUIRY', 'QUOTING', 'QUOTE_SENT', 'PO_RECEIVED', 'IN_PRODUCTION', 'SHIPPED'];
const STALLED_THRESHOLD_DAYS = 14;
// Statuses where poDate→productionStartDate may exist, used for transmission velocity.
const VELOCITY_STATUSES = ['IN_PRODUCTION', 'SHIPPED', 'INSTALLED', 'CLOSED'];

function daysBetween(later: Date, earlier: Date): number {
    return Math.floor((later.getTime() - earlier.getTime()) / (1000 * 60 * 60 * 24));
}

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

    // Count expired quotes (QUOTE_SENT with quoteValidUntil < today)
    let expiredQuotes = 0;
    const quoteSentResult = await docClient.send(new QueryCommand({
        TableName: TABLE_NAME(),
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :pk',
        ExpressionAttributeValues: { ':pk': 'ORDER_STATUS#QUOTE_SENT' },
    }));
    for (const order of quoteSentResult.Items || []) {
        const vu = order.quoteValidUntil as string | undefined;
        if (vu && vu < today) {
            expiredQuotes++;
        }
    }

    // Stalled order: scan candidate active statuses, pick the one with the largest
    // (now - updatedAt) above the threshold.
    let stalledOrderId: string | null = null;
    let stalledInstitution: string | null = null;
    let stalledStatus: string | null = null;
    let stalledQuoteNumber: string | null = null;
    let stalledDaysSinceLastUpdate: number | null = null;
    let maxDays = STALLED_THRESHOLD_DAYS;

    // PO→Production velocity: aggregate across statuses where production has started.
    let veloTotalDays = 0;
    let veloCount = 0;

    const stalledAndVelocityStatuses = Array.from(new Set([...STALLED_CANDIDATE_STATUSES, ...VELOCITY_STATUSES]));

    await Promise.all(
        stalledAndVelocityStatuses.map(async (status) => {
            const result = await docClient.send(new QueryCommand({
                TableName: TABLE_NAME(),
                IndexName: 'GSI1',
                KeyConditionExpression: 'GSI1PK = :pk',
                ExpressionAttributeValues: { ':pk': `ORDER_STATUS#${status}` },
            }));
            for (const order of result.Items || []) {
                if (STALLED_CANDIDATE_STATUSES.includes(status)) {
                    const updatedAt = order.updatedAt as string | undefined;
                    if (updatedAt) {
                        const days = daysBetween(now, new Date(updatedAt));
                        if (days > maxDays) {
                            maxDays = days;
                            stalledOrderId = (order.orderId as string) || null;
                            stalledInstitution = (order.institution as string) || null;
                            stalledStatus = status;
                            stalledQuoteNumber = (order.quoteNumber as string) || null;
                            stalledDaysSinceLastUpdate = days;
                        }
                    }
                }
                if (VELOCITY_STATUSES.includes(status)) {
                    const po = order.poDate as string | undefined;
                    const prod = order.productionStartDate as string | undefined;
                    if (po && prod) {
                        const days = daysBetween(new Date(prod), new Date(po));
                        if (days >= 0) {
                            veloTotalDays += days;
                            veloCount++;
                        }
                    }
                }
            }
        }),
    );

    const avgPoToProductionDays = veloCount > 0
        ? Math.round((veloTotalDays / veloCount) * 10) / 10
        : null;

    return {
        totalActive,
        byStatus,
        avgDaysToInstall,
        upcomingDeliveries,
        overdueOrders,
        expiredQuotes,
        stalledOrderId,
        stalledInstitution,
        stalledStatus,
        stalledQuoteNumber,
        stalledDaysSinceLastUpdate,
        avgPoToProductionDays,
    };
}
