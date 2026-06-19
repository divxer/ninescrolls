import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../lib/dynamodb.js';
import { buildCaseResponse } from '../lib/caseHelper.js';
import type { AppSyncEvent } from '../lib/types.js';
import { RELATED_ENTITY_TYPES, type RelatedEntityType } from '../lib/stages.js';

// Phase 1: caseType, currentStage, enabledStages, legs, milestoneLog, isCustomerVisible,
// and publicToken are NOT editable here (dedicated resolvers or frozen to Phase 2).
const EDITABLE = [
  'customerName', 'contactName', 'customsRequired',
  'relatedOrderId', 'relatedEntityType', 'relatedEntityId',
  'notes',
] as const;

export async function updateLogisticsCase(event: AppSyncEvent) {
  const { caseId, input: raw } = event.arguments as { caseId?: string; input: string | Record<string, unknown> };
  if (!caseId) throw new Error('caseId is required');
  const input: Record<string, unknown> = typeof raw === 'string' ? JSON.parse(raw) : raw;

  if (input.relatedEntityType !== undefined
    && !RELATED_ENTITY_TYPES.includes(input.relatedEntityType as RelatedEntityType)) {
    throw new Error(`relatedEntityType must be one of: ${RELATED_ENTITY_TYPES.join(', ')}`);
  }

  const now = new Date().toISOString();
  // Baseline always refreshes updatedAt + the recency sort key.
  const setParts: string[] = ['updatedAt = :now', 'GSI1SK = :gsi1sk'];
  const values: Record<string, unknown> = { ':now': now, ':gsi1sk': `${now}#${caseId}` };

  for (const field of EDITABLE) {
    if (input[field] !== undefined) {
      setParts.push(`${field} = :${field}`);
      values[`:${field}`] = input[field];
    }
  }

  if (setParts.length === 2) throw new Error('No editable fields supplied');

  await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME(),
    Key: { PK: `LOGISTICS#${caseId}`, SK: 'META' },
    UpdateExpression: `SET ${setParts.join(', ')}`,
    ExpressionAttributeValues: values,
  }));

  return buildCaseResponse(caseId);
}
