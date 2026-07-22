import { QueryCommand, PutCommand, UpdateCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
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

export type ContactUpsertOutcome = 'written' | 'migrated' | 'superseded' | 'locked' | 'org_inactive';

export async function upsertContact(args: {
  email: string; orgId: string; source: string; occurredAt: string;
  name?: string; title?: string; role?: string; phone?: string;
  linkGeneration?: string;                       // generational (link/replay) callers only
  // R5 (Task 8's replay): wrap the write in a TransactWriteItems with an org-active ConditionCheck.
  activeOrgFence?: boolean;
  // Same-generation successor migration (generational callers only): when the SAME generation is
  // already stamped but the contact sits at one of these orgs (archived merge-chain predecessors
  // of the caller's effective target), move the org to args.orgId with the stamp UNCHANGED —
  // instead of no-oping as 'superseded' and stranding the contact at an archived org. Absent
  // this arg, semantics are byte-identical to before.
  migrateFromOrgs?: string[];
}): Promise<{ contactId: string; outcome: ContactUpsertOutcome }> {
  const email = normalizeEmail(args.email);
  const nowIso = new Date().toISOString();
  const occurredAt = args.occurredAt;

  // ONE bounded read→decide→build→CAS loop for BOTH paths (plan-review R2 Critical):
  // every retry starts from a COMPLETELY fresh read, so org/lock/stamp/fields are always coherent.
  for (let attempt = 0; attempt < 3; attempt++) {
    const existing = await getContactByEmail(email);
    const contactId = existing?.contactId ?? contactIdForEmail(email);

    let migrate = false;
    if (args.linkGeneration) {
      if (existing?.linkLocked) return { contactId, outcome: 'locked' };        // R8: never re-org a locked contact (never migrated either)
      // Same-generation successor migration: THIS generation's own earlier commit at an org that
      // has since merged away — an org move, not a supersession. Only for listed predecessors;
      // any other org with `>=` (including a genuinely NEWER generation) still supersedes.
      migrate = existing?.lastLinkGeneration === args.linkGeneration
        && (args.migrateFromOrgs?.includes(existing.orgId) ?? false);
      if (!migrate && existing?.lastLinkGeneration && existing.lastLinkGeneration >= args.linkGeneration) {
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

    // Round-5 (Issue 2) — the migration is a NARROW UpdateCommand touching ONLY the attributes
    // migration owns: orgId, the key attributes contactKeys() derives from it (mirror the real
    // key builder, never guess), and updatedAt. Metadata (name/title/role/phone/source/
    // firstSeenAt/lastSeenAt) and the stamp are NOT in the expression, so a concurrent metadata
    // write that leaves org+generation+lock unchanged SURVIVES the race instead of being
    // clobbered by a stale full-item Put.
    //
    // Round-4 — the CAS pins EVERY fact that AUTHORIZED the migration: the observed predecessor
    // org, the exact stamp (equality, not `<` — it is unchanged), and unlocked; and it REQUIRES
    // the row to still exist. A racing admin lock, a racing same-generation org move, or a racing
    // deletion between read and write therefore CCFEs into the loop instead of being clobbered/
    // resurrected by this stale write. On CCFE the loop re-reads and re-decides on FRESH state,
    // which naturally yields: freshly locked → 'locked'; moved to a non-predecessor org (same
    // gen) → falls out of the migration guard → 'superseded'; row deleted → the normal
    // generational CREATE branch. That create — at the caller's EFFECTIVE org, built from fresh
    // (empty) state — is ordinary replay semantics; the migration write itself can never
    // resurrect a deleted contact (deliberately NO attribute_not_exists(PK) alternate).
    //
    // Round-5 (Issue 1) — legacy P1-era rows may LACK linkLocked entirely; DynamoDB equality on
    // an absent attribute is FALSE, which would CCFE-loop a legitimate migration into the
    // bounded-contention failure (stuck marker). Absent = unlocked, exactly as the decide step
    // above treats it — hence the parenthesized OR in the lock clause.
    const migration = migrate ? (() => {
      const keys = contactKeys({ contactId, email, orgId: args.orgId });
      return {
        TableName: TABLE_NAME(), Key: { PK: keys.PK, SK: keys.SK },
        UpdateExpression: 'SET orgId = :eff, GSI2PK = :gsi2pk, GSI2SK = :gsi2sk, updatedAt = :now',
        ConditionExpression: 'attribute_exists(PK) AND orgId = :obsOrg AND lastLinkGeneration = :obsGen AND (attribute_not_exists(linkLocked) OR linkLocked = :false)',
        ExpressionAttributeValues: {
          ':eff': args.orgId, ':gsi2pk': keys.GSI2PK, ':gsi2sk': keys.GSI2SK, ':now': nowIso,
          ':obsOrg': existing!.orgId, ':obsGen': observed, ':false': false,
        },
      };
    })() : null;

    const put = args.linkGeneration
      ? new PutCommand({ TableName: TABLE_NAME(), Item: item,
          // store-enforced monotonicity — a racing NEWER generation makes this CCFE.
          // A non-generational write leaves lastLinkGeneration as a typed DynamoDB NULL (attribute
          // EXISTS with type NULL), against which `lastLinkGeneration < :gen` is always false — so
          // attribute_type(...) must also be accepted, or the first generational link ever CCFEs.
          ConditionExpression: 'attribute_not_exists(PK) OR attribute_not_exists(lastLinkGeneration) OR attribute_type(lastLinkGeneration, :nullType) OR lastLinkGeneration < :gen',
          ExpressionAttributeValues: { ':gen': args.linkGeneration, ':nullType': 'NULL' } })
      : (observed === null
          ? new PutCommand({ TableName: TABLE_NAME(), Item: item,
              ConditionExpression: 'attribute_not_exists(PK) OR attribute_not_exists(lastLinkGeneration) OR lastLinkGeneration = :null',
              ExpressionAttributeValues: { ':null': null } })
          : new PutCommand({ TableName: TABLE_NAME(), Item: item,
              ConditionExpression: 'attribute_not_exists(PK) OR lastLinkGeneration = :obs',
              ExpressionAttributeValues: { ':obs': observed } }));

    try {
      if (args.activeOrgFence) {
        // R5: used by Task 8's replay — refuse to (re)write against an org that is no longer
        // active. The ConditionCheck targets the ORG item and the contact write targets the
        // CONTACT item — DIFFERENT items, so combining them in one TransactWriteItems is valid.
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
            migration ? { Update: migration } : {
              Put: {
                TableName: put.input.TableName,
                Item: put.input.Item,
                ConditionExpression: put.input.ConditionExpression,
                ExpressionAttributeValues: put.input.ExpressionAttributeValues,
              },
            },
          ],
        }));
      } else if (migration) {
        await docClient.send(new UpdateCommand(migration));
      } else {
        await docClient.send(put);
      }
      return { contactId, outcome: migrate ? 'migrated' : 'written' };
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
