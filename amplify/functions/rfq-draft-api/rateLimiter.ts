import crypto from 'node:crypto';
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';

type RateClass = 'create' | 'access';
interface Deps { send: (command: unknown) => Promise<unknown>; tableName: string; nowMs?: () => number }

const WINDOW_MS = 5 * 60_000;
const LIMITS: Record<RateClass, number> = { create: 10, access: 120 };

export function createRateLimiter({ send, tableName, nowMs = Date.now }: Deps) {
  return async (sourceIp: string, rateClass: RateClass): Promise<boolean> => {
    const now = nowMs();
    const bucket = Math.floor(now / WINDOW_MS);
    const ipHash = crypto.createHash('sha256').update(`rfq-draft-rate\0${sourceIp}`).digest('hex');
    try {
      await send(new UpdateCommand({
        TableName: tableName,
        Key: { PK: `RFQ_DRAFT_RATE#${ipHash}`, SK: `${rateClass}#${bucket}` },
        UpdateExpression: 'SET #ttl = :ttl ADD requestCount :one',
        ConditionExpression: 'attribute_not_exists(requestCount) OR requestCount < :limit',
        ExpressionAttributeNames: { '#ttl': 'ttl' },
        ExpressionAttributeValues: {
          ':ttl': Math.floor((bucket * WINDOW_MS + 10 * 60_000) / 1000), ':one': 1, ':limit': LIMITS[rateClass],
        },
      }));
      return true;
    } catch (error) {
      if ((error as { name?: string }).name === 'ConditionalCheckFailedException') return false;
      throw error;
    }
  };
}
