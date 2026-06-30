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
  } as LinkAuditLogItem;
  await docClient.send(new PutCommand({ TableName: TABLE_NAME(), Item: item }));
  return id;
}
