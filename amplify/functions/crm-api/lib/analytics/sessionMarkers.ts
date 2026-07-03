import { GetCommand, PutCommand, QueryCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../dynamodb';

// Session markers (spec §2.2): one per materialized session per visitor. Written ONLY for sessions
// that have a visitorId (spec §6 — no VISITOR#undefined keys); the no-marker rule is about lacking a
// retro-resolve handle, never about event materialization.
export interface SessionMarker {
  sessionId: string; timelineEventId: string; occurredAt: string;
  resolutionStatus: 'resolved' | 'unresolved' | 'below_threshold';
  resolvedOrgId: string | null;
  lastFlushTs: string; flushCount: number; inputHash: string;
  emittedAt: string;
}

export async function readMarker(visitorId: string, sessionId: string): Promise<SessionMarker | null> {
  if (!visitorId) return null;
  const res = await docClient.send(new GetCommand({ TableName: TABLE_NAME(), Key: { PK: `VISITOR#${visitorId}`, SK: `SESSION#${sessionId}` } }));
  return (res.Item as SessionMarker | undefined) ?? null;
}

export async function writeMarker(visitorId: string, marker: SessionMarker): Promise<void> {
  if (!visitorId) return;
  await docClient.send(new PutCommand({ TableName: TABLE_NAME(), Item: { PK: `VISITOR#${visitorId}`, SK: `SESSION#${marker.sessionId}`, ...marker } }));
}

export async function listMarkers(visitorId: string, opts: { limit?: number; startKey?: Record<string, unknown> }): Promise<{ markers: SessionMarker[]; lastKey?: Record<string, unknown> }> {
  if (!visitorId) return { markers: [] };
  const res = await docClient.send(new QueryCommand({
    TableName: TABLE_NAME(),
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :pre)',
    ExpressionAttributeValues: { ':pk': `VISITOR#${visitorId}`, ':pre': 'SESSION#' },
    Limit: opts.limit, ExclusiveStartKey: opts.startKey,
  }));
  return { markers: (res.Items ?? []) as SessionMarker[], lastKey: res.LastEvaluatedKey as Record<string, unknown> | undefined };
}

// RETRO#STATE (spec §4): resume cursor for an interrupted retro-resolve of one visitor.
export type RetroState = { cursor?: Record<string, unknown>; retrySessionIds?: string[] };

export async function readRetroState(visitorId: string): Promise<RetroState | null> {
  const res = await docClient.send(new GetCommand({ TableName: TABLE_NAME(), Key: { PK: `VISITOR#${visitorId}`, SK: 'RETRO#STATE' } }));
  return (res.Item as RetroState | undefined) ?? null;
}
export async function writeRetroState(visitorId: string, state: RetroState): Promise<void> {
  await docClient.send(new PutCommand({ TableName: TABLE_NAME(), Item: { PK: `VISITOR#${visitorId}`, SK: 'RETRO#STATE', ...state } }));
}
export async function clearRetroState(visitorId: string): Promise<void> {
  await docClient.send(new DeleteCommand({ TableName: TABLE_NAME(), Key: { PK: `VISITOR#${visitorId}`, SK: 'RETRO#STATE' } }));
}
