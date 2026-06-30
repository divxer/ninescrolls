import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from './dynamodb';
import type { TimelineEventItem } from './types';

export async function getTimelineEvent(id: string): Promise<TimelineEventItem | null> {
  const res = await docClient.send(new GetCommand({ TableName: TABLE_NAME(), Key: { PK: `TLEVENT#${id}`, SK: 'A' } }));
  return (res.Item as TimelineEventItem | undefined) ?? null;
}
