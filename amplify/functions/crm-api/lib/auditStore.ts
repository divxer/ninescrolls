import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from './dynamodb';
import { auditKeys } from './keys';
import { generateAuditId } from './idGenerators';
import type { LinkAuditLogItem } from './types';

export async function writeLinkAuditLog(args: {
  timelineEventId?: string | null; contactId?: string | null;
  oldOrgId?: string | null; newOrgId?: string | null;
  oldContactId?: string | null; newContactId?: string | null;
  operator: string; reason: string; timestamp: string;
  details?: Record<string, unknown> | null;
}): Promise<string> {
  const id = generateAuditId();
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
  // Audit rows are immutable: never overwrite an existing one (ids are unique per write).
  await docClient.send(new PutCommand({ TableName: TABLE_NAME(), Item: item, ConditionExpression: 'attribute_not_exists(PK)' }));
  return id;
}
