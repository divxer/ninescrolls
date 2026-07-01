import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from './dynamodb';
import type { TimelineEventItem } from './types';

export async function getTimelineEvent(id: string): Promise<TimelineEventItem | null> {
  const res = await docClient.send(new GetCommand({ TableName: TABLE_NAME(), Key: { PK: `TLEVENT#${id}`, SK: 'A' } }));
  return (res.Item as TimelineEventItem | undefined) ?? null;
}

// Mark an event's rollup as fully applied — call ONLY after every needed recompute/bump succeeded.
// Shared by emitTimelineEvent (live) and the reconciliation sweep so the repair path can't drift.
export async function markRollupApplied(id: string): Promise<void> {
  await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME(),
    Key: { PK: `TLEVENT#${id}`, SK: 'A' },
    UpdateExpression: 'SET rollupApplied = :t REMOVE rollupPendingOrgId',
    ExpressionAttributeValues: { ':t': true },
  }));
}
