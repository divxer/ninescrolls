import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../lib/dynamodb.js';
import { fetchCase, buildCaseResponse } from '../lib/caseHelper.js';
import { getOperatorInfo } from '../lib/types.js';
import type { AppSyncEvent, LogisticsLogEntry } from '../lib/types.js';
import { isValidStageTransition, LOGISTICS_STAGES, type LogisticsStage } from '../lib/stages.js';

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
  if (!isValidStageTransition(current.caseType, stage)) {
    throw new Error(`Stage ${stage} is not enabled for caseType ${current.caseType}`);
  }

  const now = new Date().toISOString();
  const { email: operator } = getOperatorInfo(event);
  const entry: LogisticsLogEntry = {
    action: 'STAGE_ADVANCED',
    fromStage: current.currentStage,
    toStage: stage,
    operator,
    timestamp: now,
    detail: detail || undefined,
    internalOnly: internalOnly ?? false,
  };
  const milestoneLog = [...(current.milestoneLog || []), entry];

  await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME(),
    Key: { PK: `LOGISTICS#${caseId}`, SK: 'META' },
    // GSI1PK stays 'LOGISTICS_CASES' (listing partition) — only GSI1SK is refreshed
    // so the case re-sorts to the top of the recency-ordered list.
    UpdateExpression:
      'SET currentStage = :stage, GSI1SK = :gsi1sk, milestoneLog = :log, updatedAt = :now',
    ExpressionAttributeValues: {
      ':stage': stage,
      ':gsi1sk': `${now}#${caseId}`,
      ':log': milestoneLog,
      ':now': now,
    },
  }));

  return buildCaseResponse(caseId);
}
