import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../lib/dynamodb.js';
import { toCaseResponse } from '../lib/types.js';
import type { AppSyncEvent, LogisticsCaseItem } from '../lib/types.js';

const SEARCH_FIELDS = ['caseNumber', 'customerName', 'contactName', 'relatedOrderId'] as const;
const LISTING_PK = 'LOGISTICS_CASES';
const MAX_PAGES = 20;

function matchesSearch(it: Record<string, unknown>, needle: string): boolean {
  const q = needle.toLowerCase();
  return SEARCH_FIELDS.some((f) => {
    const v = it[f];
    return typeof v === 'string' && v.toLowerCase().includes(q);
  });
}

export async function listLogisticsCases(event: AppSyncEvent) {
  const { stage, caseType, customsRequired, search, limit = 50, nextToken } =
    event.arguments as {
      stage?: string; caseType?: string; customsRequired?: boolean;
      search?: string; limit?: number; nextToken?: string;
    };

  const effectiveLimit = Math.min(Math.max(limit || 50, 1), 200);
  const startKey = nextToken ? JSON.parse(Buffer.from(nextToken, 'base64').toString()) : undefined;
  const term = search?.trim() || undefined;

  const passesFilters = (it: Record<string, unknown>) =>
    (!stage || it.currentStage === stage)
    && (!caseType || it.caseType === caseType)
    && (customsRequired === undefined || it.customsRequired === customsRequired)
    && (!term || matchesSearch(it, term));

  // P0: ALWAYS Query the single listing partition, newest first. Never Scan.
  const collected: Record<string, unknown>[] = [];
  let key = startKey;
  for (let page = 0; page < MAX_PAGES; page++) {
    const r = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME(),
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: { ':pk': LISTING_PK },
      ScanIndexForward: false, // GSI1SK = '<updatedAt>#<caseId>' → recency-sorted
      ExclusiveStartKey: key,
    }));
    collected.push(...(r.Items || []).filter(passesFilters));
    key = r.LastEvaluatedKey;
    if (!key || collected.length >= effectiveLimit) break;
  }

  const items = collected.slice(0, effectiveLimit);

  return {
    items: items.map((it) => toCaseResponse(it as LogisticsCaseItem)),
    nextToken: key ? Buffer.from(JSON.stringify(key)).toString('base64') : null,
  };
}
