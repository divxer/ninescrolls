import { GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../lib/dynamodb.js';
import { stripKeys, type PriceApiEvent } from '../lib/types.js';

const MAX_PAGE_SIZE = 200;
const HISTORICAL_ID_PATTERN = /^[a-f0-9]{64}$/;
const stripHistoricalKeys = (item: Record<string, unknown>) => stripKeys(
  item as Record<string, unknown> & { PK: string; SK: string },
);

export async function pbListHistoricalQuotations(event: PriceApiEvent) {
  const { limit = 50, nextToken } = (event.arguments ?? {}) as {
    limit?: number;
    nextToken?: string | null;
  };
  const effectiveLimit = Math.min(Math.max(limit || 50, 1), MAX_PAGE_SIZE);
  let startKey: Record<string, unknown> | undefined;
  if (nextToken) {
    try {
      startKey = JSON.parse(Buffer.from(nextToken, 'base64').toString());
    } catch {
      throw new Error('VALIDATION: invalid nextToken');
    }
  }

  const result = await docClient.send(new QueryCommand({
    TableName: TABLE_NAME(),
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk',
    ExpressionAttributeValues: { ':pk': 'HISTORICAL_QUOTATIONS' },
    ScanIndexForward: false,
    ExclusiveStartKey: startKey,
    Limit: effectiveLimit,
  }));

  return {
    items: (result.Items ?? []).map(stripHistoricalKeys),
    nextToken: result.LastEvaluatedKey
      ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
      : null,
  };
}

export async function pbGetHistoricalQuotation(event: PriceApiEvent) {
  const { historicalId } = (event.arguments ?? {}) as { historicalId?: string };
  if (typeof historicalId !== 'string' || !HISTORICAL_ID_PATTERN.test(historicalId)) {
    throw new Error('VALIDATION: historicalId must be a 64-character lowercase hex string');
  }

  const result = await docClient.send(new GetCommand({
    TableName: TABLE_NAME(),
    Key: { PK: `PHIST#${historicalId}`, SK: 'META' },
    ConsistentRead: true,
  }));
  if (!result.Item) throw new Error(`NOT_FOUND: historical quotation ${historicalId}`);
  return stripHistoricalKeys(result.Item);
}
