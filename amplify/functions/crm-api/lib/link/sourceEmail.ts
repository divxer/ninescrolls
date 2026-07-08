import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../dynamodb';
import type { TimelineEventItem } from '../types';

export const SOURCE_PK: Record<string, (id: string) => string> = { rfq: (id) => `RFQ#${id}`, lead: (id) => `LEAD#${id}`, order: (id) => `ORDER#${id}` };

export function sourceDomain(email: string): string | null {
  return email.split('@')[1] ?? null;
}

export async function backfillTargetPk(sourceType: string, sourceEntityId: string, events: TimelineEventItem[]): Promise<string | null> {
  if (SOURCE_PK[sourceType]) return SOURCE_PK[sourceType](sourceEntityId);
  if (sourceType === 'quote') {
    const orderId = (events[0]?.payload as Record<string, unknown> | undefined)?.orderId as string | undefined;
    return orderId ? `ORDER#${orderId}` : null;
  }
  if (sourceType === 'logistics') {
    const res = await docClient.send(new GetCommand({ TableName: TABLE_NAME(), Key: { PK: `LOGISTICS#${sourceEntityId}`, SK: 'META' } }));
    const rel = (res.Item as Record<string, unknown> | undefined)?.relatedOrderId as string | undefined;
    return rel ? `ORDER#${rel}` : null;
  }
  return null;
}

export async function readSourceEmailForUnit(sourceType: string, sourceEntityId: string, events: TimelineEventItem[]): Promise<string | null> {
  if (sourceType === 'rfq' || sourceType === 'lead') {
    const res = await docClient.send(new GetCommand({ TableName: TABLE_NAME(), Key: { PK: `${sourceType.toUpperCase()}#${sourceEntityId}`, SK: 'META' } }));
    return ((res.Item as Record<string, unknown> | undefined)?.email as string | undefined) ?? null;
  }
  const orderPk = await backfillTargetPk(sourceType, sourceEntityId, events);
  if (!orderPk) return null;
  const res = await docClient.send(new GetCommand({ TableName: TABLE_NAME(), Key: { PK: orderPk, SK: 'META' } }));
  const m = res.Item as Record<string, unknown> | undefined;
  if (!m) return null;
  const gsi4 = m.GSI4PK as string | undefined;
  if (typeof gsi4 === 'string' && gsi4.startsWith('EMAIL#')) return gsi4.slice('EMAIL#'.length) || null;
  const rfqId = m.rfqId as string | undefined;
  if (!rfqId) return null;
  const rfq = await docClient.send(new GetCommand({ TableName: TABLE_NAME(), Key: { PK: `RFQ#${rfqId}`, SK: 'META' } }));
  return ((rfq.Item as Record<string, unknown> | undefined)?.email as string | undefined) ?? null;
}
