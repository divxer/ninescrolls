import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../dynamodb';
import { readSourceEmailForUnit, sourceDomain } from '../link/sourceEmail';
import type { TimelineEventItem } from '../types';

export interface NeedsLinkingSignal {
  email?: string | null; domain?: string | null; productModel?: string | null; equipmentCategory?: string | null;
  orgNameDisplay?: string | null; country?: string | null; region?: string | null; topPaths?: string[] | null;
  enrichmentStatus: 'ok' | 'missing_source' | 'error';
}
export interface NeedsLinkingItem {
  unitKey: string; linkUnitType: 'structured' | 'analytics'; source: string; kind: string;
  occurredAt: string; eventCount: number; sourceEntityId?: string; visitorId?: string; signal: NeedsLinkingSignal;
}

export async function needsLinkingQueue(args: { limit?: number; nextToken?: string }): Promise<{ items: NeedsLinkingItem[]; nextToken: string | null }> {
  const res = await docClient.send(new QueryCommand({
    TableName: TABLE_NAME(), IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk',
    FilterExpression: 'voided = :false AND isInternalOnly = :false',
    ExpressionAttributeValues: { ':pk': 'TLEVENT_STATUS#unresolved', ':false': false },
    ScanIndexForward: false, Limit: args.limit ?? 25,
    ExclusiveStartKey: args.nextToken ? JSON.parse(Buffer.from(args.nextToken, 'base64').toString('utf8')) : undefined,
  }));
  const events = (res.Items ?? []) as TimelineEventItem[];

  const groups = new Map<string, TimelineEventItem[]>();
  for (const e of events) {
    const key = e.source === 'analytics' ? String((e.payload as Record<string, unknown> | undefined)?.visitorId ?? e.orgId) : e.orgId;
    const arr = groups.get(key); if (arr) arr.push(e); else groups.set(key, [e]);
  }

  const items: NeedsLinkingItem[] = [];
  for (const [unitKey, evs] of groups) {
    const rep = evs.reduce((a, b) => (b.occurredAt > a.occurredAt ? b : a));
    const isAnalytics = rep.source === 'analytics';
    const p = (rep.payload ?? {}) as Record<string, unknown>;
    let signal: NeedsLinkingSignal;
    if (isAnalytics) {
      signal = { orgNameDisplay: (p.orgNameDisplay as string) ?? null, country: (p.country as string) ?? null,
        region: (p.region as string) ?? null, topPaths: Array.isArray(p.topPaths) ? (p.topPaths as string[]) : null, enrichmentStatus: 'ok' };
    } else {
      try {
        const email = await readSourceEmailForUnit(rep.source, rep.sourceEntityId, evs);
        signal = { email: email ?? null, domain: email ? sourceDomain(email) : null,
          productModel: (p.productModel as string) ?? null, equipmentCategory: (p.equipmentCategory as string) ?? null,
          enrichmentStatus: email ? 'ok' : 'missing_source' };
      } catch { signal = { enrichmentStatus: 'error' }; }
    }
    items.push({ unitKey, linkUnitType: isAnalytics ? 'analytics' : 'structured', source: rep.source, kind: rep.kind,
      occurredAt: rep.occurredAt, eventCount: evs.length,
      ...(isAnalytics ? { visitorId: unitKey } : { sourceEntityId: rep.sourceEntityId }), signal });
  }
  const key = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  return { items, nextToken: key ? Buffer.from(JSON.stringify(key), 'utf8').toString('base64') : null };
}
