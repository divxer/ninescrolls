import { PutCommand, UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../lib/dynamodb.js';
import { generateCaseId, formatCaseNumber, generateMilestoneId } from '../lib/idGenerators.js';
import { buildCaseResponse } from '../lib/caseHelper.js';
import { getOperatorInfo } from '../lib/types.js';
import { emitTimelineEventToCrm } from '../../../lib/crm/invoke-crm-api.js';
import { buildLogisticsMilestoneEmitArgs } from '../../../lib/crm/emit-builders.js';
import type { AppSyncEvent, LogisticsCaseItem } from '../lib/types.js';
import {
  CASE_TYPES, ENABLED_STAGES, RELATED_ENTITY_TYPES,
  type CaseType, type RelatedEntityType,
} from '../lib/stages.js';

interface CreateInput {
  caseType: string;
  customerName?: string;
  contactName?: string;
  customsRequired?: boolean;
  relatedOrderId?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  notes?: string;
}

async function nextCaseSeq(year: number): Promise<number> {
  const res = await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME(),
    Key: { PK: 'COUNTER#LOGISTICS_CASE', SK: `YEAR#${year}` },
    UpdateExpression: 'ADD seq :one',
    ExpressionAttributeValues: { ':one': 1 },
    ReturnValues: 'UPDATED_NEW',
  }));
  return (res.Attributes?.seq as number) ?? 1;
}

export async function createLogisticsCase(event: AppSyncEvent) {
  const { input: raw } = event.arguments as { input: string | CreateInput };
  const input: CreateInput = typeof raw === 'string' ? JSON.parse(raw) : raw;

  if (!CASE_TYPES.includes(input.caseType as CaseType)) {
    throw new Error(`caseType must be one of: ${CASE_TYPES.join(', ')}`);
  }
  if (!input.customerName || !input.customerName.trim()) {
    throw new Error('customerName is required');
  }
  if (input.relatedEntityType
    && !RELATED_ENTITY_TYPES.includes(input.relatedEntityType as RelatedEntityType)) {
    throw new Error(`relatedEntityType must be one of: ${RELATED_ENTITY_TYPES.join(', ')}`);
  }

  const caseType = input.caseType as CaseType;
  const now = new Date().toISOString();
  const year = Number(now.slice(0, 4));
  const caseId = generateCaseId();
  const seq = await nextCaseSeq(year);
  const caseNumber = formatCaseNumber(year, seq);
  const { sub: operatorId, email: operator } = getOperatorInfo(event);

  // CASE_CREATED milestone — id/internalOnly captured so they can be reused
  // for the fire-and-forget CRM timeline emit after the case commits.
  const milestoneId = generateMilestoneId();
  const milestoneInternalOnly = false;

  const item: LogisticsCaseItem = {
    PK: `LOGISTICS#${caseId}`,
    SK: 'META',
    GSI1PK: 'LOGISTICS_CASES',
    GSI1SK: `${now}#${caseId}`,
    caseId,
    caseNumber,
    caseType,
    relatedOrderId: input.relatedOrderId || undefined,
    relatedEntityType: input.relatedEntityType as RelatedEntityType | undefined,
    relatedEntityId: input.relatedEntityId || undefined,
    customerName: input.customerName.trim(),
    contactName: input.contactName || undefined,
    customsRequired: input.customsRequired ?? false,
    currentStage: 'DRAFT',
    enabledStages: ENABLED_STAGES[caseType],
    legs: [],
    milestoneLog: [{
      id: milestoneId,
      action: 'CASE_CREATED',
      fromStage: null,
      toStage: 'DRAFT',
      operator,
      timestamp: now,
      detail: `${caseType} case created for ${input.customerName.trim()}`,
      internalOnly: milestoneInternalOnly,
    }],
    isCustomerVisible: false,
    notes: input.notes || undefined,
    createdAt: now,
    updatedAt: now,
    createdBy: operatorId,
  };

  await docClient.send(new PutCommand({
    TableName: TABLE_NAME(),
    Item: item,
    ConditionExpression: 'attribute_not_exists(PK)',
  }));

  const response = await buildCaseResponse(caseId);

  // Fire-and-forget CRM timeline emit (emit site #8). Logistics has no customer email —
  // the org link comes from the related Order's matchedOrgId, if any.
  const relatedOrderId = input.relatedOrderId;
  let relatedOrgId: string | null = null;
  if (relatedOrderId) {
    try {
      const res = await docClient.send(new GetCommand({
        TableName: TABLE_NAME(),
        Key: { PK: `ORDER#${relatedOrderId}`, SK: 'META' },
      }));
      relatedOrgId = (res.Item?.matchedOrgId as string | undefined) ?? null;
    } catch { relatedOrgId = null; }
  }
  await emitTimelineEventToCrm(buildLogisticsMilestoneEmitArgs(
    { caseId, caseType },
    { id: milestoneId, toStage: 'DRAFT', fromStage: null, timestamp: now, internalOnly: milestoneInternalOnly, action: 'CASE_CREATED' },
    relatedOrgId,
  ));

  return response;
}
