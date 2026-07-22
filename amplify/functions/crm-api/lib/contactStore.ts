import { QueryCommand, PutCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
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

export type ContactUpsertOutcome = 'written' | 'superseded' | 'locked' | 'org_inactive';

export async function upsertContact(args: {
  email: string; orgId: string; source: string; occurredAt: string;
  name?: string; title?: string; role?: string; phone?: string;
  linkGeneration?: string;                       // generational (link/replay) callers only
  // R5 (Task 8's replay): wrap the write in a TransactWriteItems with an org-active ConditionCheck.
  activeOrgFence?: boolean;
}): Promise<{ contactId: string; outcome: ContactUpsertOutcome }> {
  const email = normalizeEmail(args.email);
  const nowIso = new Date().toISOString();
  const occurredAt = args.occurredAt;

  // ONE bounded read→decide→build→CAS loop for BOTH paths (plan-review R2 Critical):
  // every retry starts from a COMPLETELY fresh read, so org/lock/stamp/fields are always coherent.
  for (let attempt = 0; attempt < 3; attempt++) {
    const existing = await getContactByEmail(email);
    const contactId = existing?.contactId ?? contactIdForEmail(email);

    if (args.linkGeneration) {
      if (existing?.linkLocked) return { contactId, outcome: 'locked' };        // R8: never re-org a locked contact
      if (existing?.lastLinkGeneration && existing.lastLinkGeneration >= args.linkGeneration) {
        return { contactId, outcome: 'superseded' };                            // R8: older replay = success no-op
      }
    }

    const orgId = args.linkGeneration ? args.orgId : (existing?.linkLocked ? existing.orgId : args.orgId);
    const firstSeenAt = existing?.firstSeenAt && existing.firstSeenAt < occurredAt ? existing.firstSeenAt : occurredAt;
    const lastSeenAt = existing?.lastSeenAt && existing.lastSeenAt > occurredAt ? existing.lastSeenAt : occurredAt;
    const observed = existing?.lastLinkGeneration ?? null;

    const item = {
      ...contactKeys({ contactId, email, orgId }),
      entityType: 'CONTACT' as const,
      contactId, email, orgId, source: existing?.source ?? args.source,
      name: args.name ?? existing?.name ?? null, title: args.title ?? existing?.title ?? null,
      role: args.role ?? existing?.role ?? null, phone: args.phone ?? existing?.phone ?? null,
      linkLocked: existing?.linkLocked ?? false,
      // R9: generational callers set their own stamp; non-generational carry the OBSERVED one forward.
      lastLinkGeneration: args.linkGeneration ?? observed,
      firstSeenAt, lastSeenAt,
      createdAt: existing?.createdAt ?? nowIso, updatedAt: nowIso,
    };

    const put = args.linkGeneration
      ? new PutCommand({ TableName: TABLE_NAME(), Item: item,
          // store-enforced monotonicity — a racing NEWER generation makes this CCFE
          ConditionExpression: 'attribute_not_exists(PK) OR attribute_not_exists(lastLinkGeneration) OR lastLinkGeneration < :gen',
          ExpressionAttributeValues: { ':gen': args.linkGeneration } })
      : (observed === null
          ? new PutCommand({ TableName: TABLE_NAME(), Item: item,
              ConditionExpression: 'attribute_not_exists(PK) OR attribute_not_exists(lastLinkGeneration) OR lastLinkGeneration = :null',
              ExpressionAttributeValues: { ':null': null } })
          : new PutCommand({ TableName: TABLE_NAME(), Item: item,
              ConditionExpression: 'attribute_not_exists(PK) OR lastLinkGeneration = :obs',
              ExpressionAttributeValues: { ':obs': observed } }));

    try {
      if (args.activeOrgFence) {
        // R5: used by Task 8's replay — refuse to (re)write against an org that is no longer active.
        await docClient.send(new TransactWriteCommand({
          TransactItems: [
            {
              ConditionCheck: {
                TableName: TABLE_NAME(),
                Key: { PK: `ORG#${item.orgId}`, SK: 'META' },
                ConditionExpression: '#s = :active',
                ExpressionAttributeNames: { '#s': 'status' },
                ExpressionAttributeValues: { ':active': 'active' },
              },
            },
            {
              Put: {
                TableName: put.input.TableName,
                Item: put.input.Item,
                ConditionExpression: put.input.ConditionExpression,
                ExpressionAttributeValues: put.input.ExpressionAttributeValues,
              },
            },
          ],
        }));
      } else {
        await docClient.send(put);
      }
      return { contactId, outcome: 'written' };
    } catch (err) {
      if (args.activeOrgFence && (err as { name?: string }).name === 'TransactionCanceledException') {
        // Cancellation mapping is POSITIONAL: index 0 = org ConditionCheck, index 1 = contact Put.
        const reasons = (err as { CancellationReasons?: Array<{ Code?: string }> }).CancellationReasons;
        if (reasons?.[0]?.Code === 'ConditionalCheckFailed') {
          return { contactId, outcome: 'org_inactive' };                        // org went inactive under us — caller re-resolves
        }
        if (reasons?.[1]?.Code === 'ConditionalCheckFailed') {
          continue;                                                             // contact condition raced — feed the existing retry loop
        }
        throw err;
      }
      if ((err as { name?: string }).name !== 'ConditionalCheckFailedException') throw err;
      // Something changed under us. Generational: loop re-reads — a newer stamp now yields
      // 'superseded' from the fresh decide step. Non-generational: loop rebuilds on the fresh state.
    }
  }
  throw new Error('upsertContact: contended repeatedly; giving up after 3 attempts');
}
