import { buildCaseResponse } from '../lib/caseHelper.js';
import type { AppSyncEvent } from '../lib/types.js';

export async function getLogisticsCase(event: AppSyncEvent) {
  const { caseId } = event.arguments as { caseId?: string };
  if (!caseId) throw new Error('caseId is required');
  return buildCaseResponse(caseId);
}
