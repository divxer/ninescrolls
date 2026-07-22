import { PutCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from './dynamodb';
import { auditKeys } from './keys';
import { generateAuditId } from './idGenerators';
import { orgActiveCheck, classifyLinkCancellation } from './link/orgFence';
import type { LinkAuditLogItem } from './types';

export async function writeLinkAuditLog(args: {
  id?: string;
  timelineEventId?: string | null; contactId?: string | null;
  oldOrgId?: string | null; newOrgId?: string | null;
  oldContactId?: string | null; newContactId?: string | null;
  operator: string; reason: string; timestamp: string;
  details?: Record<string, unknown> | null;
  // R5 (Task 8's generational replay): ride the put on a TransactWriteItems whose element 0 is an
  // org-active ConditionCheck on newOrgId. Fence cancellation throws an error named
  // 'OrgInactiveError' so the caller can re-resolve the successor; a duplicate-row cancellation on
  // a deterministic id stays an idempotent success exactly like the unfenced path.
  activeOrgFence?: boolean;
}): Promise<string> {
  const id = args.id ?? generateAuditId();
  const orgForIndex = args.newOrgId ?? args.oldOrgId ?? null;
  const item: LinkAuditLogItem = {
    ...auditKeys({ id, orgId: orgForIndex, timestamp: args.timestamp }),
    entityType: 'LINK_AUDIT',
    id,
    timelineEventId: args.timelineEventId ?? null,
    contactId: args.contactId ?? null,
    orgId: orgForIndex,
    oldOrgId: args.oldOrgId ?? null, newOrgId: args.newOrgId ?? null,
    oldContactId: args.oldContactId ?? null, newContactId: args.newContactId ?? null,
    operator: args.operator, reason: args.reason, timestamp: args.timestamp,
    details: args.details ?? null,
  } as LinkAuditLogItem;
  if (args.activeOrgFence) {
    if (!orgForIndex) throw new Error('writeLinkAuditLog: activeOrgFence requires newOrgId/oldOrgId');
    try {
      await docClient.send(new TransactWriteCommand({ TransactItems: [
        orgActiveCheck(orgForIndex),
        { Put: { TableName: TABLE_NAME(), Item: item, ConditionExpression: 'attribute_not_exists(PK)' } },
      ] }));
      return id;
    } catch (err) {
      const cls = classifyLinkCancellation(err, 1);
      if (cls === 'org_fence') {
        throw Object.assign(new Error(`org ${orgForIndex} is not active`), { name: 'OrgInactiveError' });
      }
      if (cls === 'move_condition' && args.id) return id;   // duplicate deterministic row = idempotent success
      throw err;
    }
  }

  // Audit rows are immutable: never overwrite an existing one (ids are unique per write).
  try {
    await docClient.send(new PutCommand({ TableName: TABLE_NAME(), Item: item, ConditionExpression: 'attribute_not_exists(PK)' }));
  } catch (err) {
    if (args.id && (err as { name?: string }).name === 'ConditionalCheckFailedException') return id;
    throw err;
  }
  return id;
}
