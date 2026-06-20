import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../lib/dynamodb.js';
import type { AppSyncEvent } from '../lib/types.js';

const CUSTOMS_STAGES = new Set(['EXPORT_CUSTOMS', 'IMPORT_CUSTOMS', 'CUSTOMS_HOLD']);
const TERMINAL_STAGES = new Set(['CLOSED', 'CANCELLED']);
const STALLED_DAYS = 14;
const MAX_PAGES = 20;

export async function logisticsStats(_event: AppSyncEvent) {
  // Query the single listing partition — never Scan.
  const items: Record<string, unknown>[] = [];
  let key: Record<string, unknown> | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const r = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME(),
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: { ':pk': 'LOGISTICS_CASES' },
      ExclusiveStartKey: key,
    }));
    items.push(...(r.Items || []));
    key = r.LastEvaluatedKey;
    if (!key) break;
  }

  const byType: Record<string, number> = {};
  const byStage: Record<string, number> = {};
  let customsInProgress = 0;
  let stalledCases = 0;
  let totalActive = 0;

  const cutoff = Date.now() - STALLED_DAYS * 86_400_000;

  for (const it of items) {
    const type = it.caseType as string;
    const stage = it.currentStage as string;
    byType[type] = (byType[type] || 0) + 1;
    byStage[stage] = (byStage[stage] || 0) + 1;
    if (CUSTOMS_STAGES.has(stage)) customsInProgress += 1;
    if (!TERMINAL_STAGES.has(stage)) {
      totalActive += 1;
      const updated = Date.parse((it.updatedAt as string) || '');
      if (!Number.isNaN(updated) && updated < cutoff) stalledCases += 1;
    }
  }

  return {
    totalActive,
    byType: JSON.stringify(byType),
    byStage: JSON.stringify(byStage),
    customsInProgress,
    stalledCases,
  };
}
