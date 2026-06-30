import { QueryCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from './dynamodb';
import type { ContactItem } from './types';
import { normalizeEmail } from './normalize';
import { contactKeys, contactIdForEmail } from './keys';

export async function getContactByEmail(email: string): Promise<ContactItem | null> {
  const res = await docClient.send(new QueryCommand({
    TableName: TABLE_NAME(), IndexName: 'GSI4',
    KeyConditionExpression: 'GSI4PK = :pk AND GSI4SK = :sk',
    ExpressionAttributeValues: { ':pk': `EMAIL#${email}`, ':sk': 'CONTACT#A' },
    Limit: 1,
  }));
  return (res.Items?.[0] as ContactItem | undefined) ?? null;
}

export async function upsertContact(args: {
  email: string; orgId: string; source: string; occurredAt: string;
  name?: string; title?: string; role?: string; phone?: string;
}): Promise<string> {
  const email = normalizeEmail(args.email);
  const existing = await getContactByEmail(email);
  const contactId = existing?.contactId ?? contactIdForEmail(email);
  const occurredAt = args.occurredAt;
  const nowIso = new Date().toISOString();

  const orgId = existing?.linkLocked ? existing.orgId : args.orgId;
  const firstSeenAt = existing?.firstSeenAt && existing.firstSeenAt < occurredAt ? existing.firstSeenAt : occurredAt;
  const lastSeenAt = existing?.lastSeenAt && existing.lastSeenAt > occurredAt ? existing.lastSeenAt : occurredAt;

  const item = {
    ...contactKeys({ contactId, email, orgId }),
    entityType: 'CONTACT' as const,
    contactId, email, orgId, source: existing?.source ?? args.source,
    name: args.name ?? existing?.name ?? null,
    title: args.title ?? existing?.title ?? null,
    role: args.role ?? existing?.role ?? null,
    phone: args.phone ?? existing?.phone ?? null,
    linkLocked: existing?.linkLocked ?? false,
    firstSeenAt, lastSeenAt,
    createdAt: existing?.createdAt ?? nowIso,
    updatedAt: nowIso,
  };
  await docClient.send(new PutCommand({ TableName: TABLE_NAME(), Item: item }));
  return contactId;
}
