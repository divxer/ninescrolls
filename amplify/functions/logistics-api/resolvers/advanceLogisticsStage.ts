import { UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../lib/dynamodb.js';
import { fetchCase, buildCaseResponse } from '../lib/caseHelper.js';
import { getOperatorInfo } from '../lib/types.js';
import { generateMilestoneId } from '../lib/idGenerators.js';
import { emitTimelineEventToCrm } from '../../../lib/crm/invoke-crm-api.js';
import { buildLogisticsMilestoneEmitArgs } from '../../../lib/crm/emit-builders.js';
import type { AppSyncEvent, LogisticsLogEntry } from '../lib/types.js';
import { LOGISTICS_STAGES, UNIVERSAL_STAGES, type LogisticsStage } from '../lib/stages.js';

export async function advanceLogisticsStage(event: AppSyncEvent) {
  const { caseId, targetStage, detail, internalOnly } = event.arguments as {
    caseId?: string; targetStage?: string; detail?: string; internalOnly?: boolean;
  };
  if (!caseId || !targetStage) throw new Error('caseId and targetStage are required');
  if (!LOGISTICS_STAGES.includes(targetStage as LogisticsStage)) {
    throw new Error(`Unknown stage: ${targetStage}`);
  }

  const current = await fetchCase(caseId);
  if (!current) throw new Error(`Logistics case not found: ${caseId}`);

  const stage = targetStage as LogisticsStage;
  if (!UNIVERSAL_STAGES.includes(stage) && !current.enabledStages?.includes(stage)) {
    throw new Error(`Stage ${stage} is not enabled for caseType ${current.caseType}`);
  }

  const now = new Date().toISOString();
  const { email: operator } = getOperatorInfo(event);
  const milestoneId = generateMilestoneId();
  const entryInternalOnly = internalOnly ?? false;
  const entry: LogisticsLogEntry = {
    id: milestoneId,
    action: 'STAGE_ADVANCED',
    fromStage: current.currentStage,
    toStage: stage,
    operator,
    timestamp: now,
    detail: detail || undefined,
    internalOnly: entryInternalOnly,
  };

  try {
    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME(),
      Key: { PK: `LOGISTICS#${caseId}`, SK: 'META' },
      // GSI1PK stays 'LOGISTICS_CASES' (listing partition) — only GSI1SK is refreshed
      // so the case re-sorts to the top of the recency-ordered list.
      UpdateExpression:
        'SET currentStage = :stage, GSI1SK = :gsi1sk, milestoneLog = list_append(if_not_exists(milestoneLog, :emptyLog), :log), updatedAt = :now',
      ConditionExpression: '#currentStage = :expectedStage',
      ExpressionAttributeNames: { '#currentStage': 'currentStage' },
      ExpressionAttributeValues: {
        ':stage': stage,
        ':expectedStage': current.currentStage,
        ':gsi1sk': `${now}#${caseId}`,
        ':emptyLog': [],
        ':log': [entry],
        ':now': now,
      },
    }));
  } catch (err) {
    if ((err as { name?: string }).name === 'ConditionalCheckFailedException') {
      throw new Error('Logistics case was updated by another user. Please refresh.');
    }
    throw err;
  }

  const response = await buildCaseResponse(caseId);

  // Fire-and-forget CRM timeline emit (emit site #7). Logistics has no customer email —
  // the org link comes from the related Order's matchedOrgId, if any.
  const relatedOrderId = current.relatedOrderId;
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
    { caseId, caseType: current.caseType },
    { id: milestoneId, toStage: stage, fromStage: current.currentStage, timestamp: now, internalOnly: entryInternalOnly, action: 'STAGE_ADVANCED' },
    relatedOrgId,
  ));

  return response;
}
