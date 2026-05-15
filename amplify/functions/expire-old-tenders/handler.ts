import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { tenderItemKey } from '../../lib/tender-watch/keys';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = () => process.env.INTELLIGENCE_TABLE!;

export interface ExpireEvent {}
export interface ExpireResult { expired: number; scanned: number; }

export async function handler(_: ExpireEvent): Promise<ExpireResult> {
    const today = new Date().toISOString().slice(0, 10);
    let expired = 0;
    let scanned = 0;
    let cursor: Record<string, unknown> | undefined;

    do {
        const res = await ddb.send(new ScanCommand({
            TableName: TABLE(),
            FilterExpression: 'entityType = :et AND isExpired = :no AND attribute_exists(deadline) AND deadline < :today',
            ExpressionAttributeValues: { ':et': 'TENDER', ':no': false, ':today': today },
            ExclusiveStartKey: cursor,
        }));
        for (const item of (res.Items ?? [])) {
            scanned += 1;
            // Defensive client-side filter (DDB FilterExpression already does this in prod, but be explicit)
            if (!item.deadline || item.deadline >= today) continue;
            await ddb.send(new UpdateCommand({
                TableName: TABLE(),
                Key: tenderItemKey(item.tenderId),
                UpdateExpression: 'SET isExpired = :yes, updatedAt = :now',
                ExpressionAttributeValues: { ':yes': true, ':now': new Date().toISOString() },
            }));
            expired += 1;
        }
        cursor = res.LastEvaluatedKey;
    } while (cursor);

    console.log(JSON.stringify({ event: 'expire.done', expired, scanned }));
    return { expired, scanned };
}
