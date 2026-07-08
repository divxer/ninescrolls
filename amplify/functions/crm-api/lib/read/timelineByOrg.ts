import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../dynamodb';
import type { StoredTimelineEvent } from './organizationTimelineItem';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const clampLimit = (n?: number) => Math.min(MAX_LIMIT, Math.max(1, n ?? DEFAULT_LIMIT));

export const encodeToken = (key: Record<string, unknown>): string =>
  Buffer.from(JSON.stringify(key), 'utf8').toString('base64');
export const decodeToken = (token: string): Record<string, unknown> =>
  JSON.parse(Buffer.from(token, 'base64').toString('utf8')) as Record<string, unknown>;

export async function timelineByOrg(args: {
  orgId: string; limit?: number; nextToken?: string; includeInternalOnly?: boolean;
}): Promise<{ items: StoredTimelineEvent[]; nextToken?: string }> {
  const values: Record<string, unknown> = { ':pk': `ORG#${args.orgId}`, ':tl': 'TLEVENT#', ':false': false };
  const filter = args.includeInternalOnly ? 'voided = :false' : 'voided = :false AND isInternalOnly = :false';
  const res = await docClient.send(new QueryCommand({
    TableName: TABLE_NAME(), IndexName: 'GSI2',
    KeyConditionExpression: 'GSI2PK = :pk AND begins_with(GSI2SK, :tl)',
    FilterExpression: filter,
    ExpressionAttributeValues: values,
    ScanIndexForward: false,
    Limit: clampLimit(args.limit),
    ExclusiveStartKey: args.nextToken ? decodeToken(args.nextToken) : undefined,
  }));
  const key = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  return {
    items: (res.Items ?? []) as StoredTimelineEvent[],
    nextToken: key ? encodeToken(key) : undefined,
  };
}
