import { UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from './dynamodb';
import { classifyEmailDomain } from '../../../lib/organization/etld';

// The authoritative Organization metadata row is owned by organization-api: keyed
// PK=ORG#<orgId>, SK='META', where the canonical orgId IS the eTLD+1 domain. CRM rollups target
// that exact row. In P1, CRM RESOLVES against existing orgs but never creates them — auto-create
// is deferred to P2 (via the shared/canonical organization-api upsert path).
const ORG_META_SK = 'META';

const KIND_TO_COUNT: Record<string, string> = { rfq_submitted: 'rfqCount', order_created: 'orderCount', lead_captured: 'leadCount' };
const KIND_TO_LATEST: Record<string, string> = { rfq_submitted: 'latestRFQDate', order_created: 'latestOrderDate', lead_captured: 'latestLeadDate' };

function isRealOrg(orgId: string): boolean {
  return !orgId.startsWith('unresolved-');
}

// Resolve a single domain key to a canonical orgId via the organization-api lookup index.
// GSI2PK=ORG_DOMAIN#<domain> matches BOTH the org META row (GSI2PK=ORG_DOMAIN#<canonical>) and
// any ORG_DOMAIN_LOOKUP alias item; both carry `orgId`.
async function lookupOrgIdByDomainKey(domainKey: string): Promise<string | null> {
  const res = await docClient.send(new QueryCommand({
    TableName: TABLE_NAME(),
    IndexName: 'GSI2',
    KeyConditionExpression: 'GSI2PK = :pk',
    ExpressionAttributeValues: { ':pk': `ORG_DOMAIN#${domainKey}` },
    Limit: 1,
  }));
  const item = (res.Items ?? [])[0] as { orgId?: string } | undefined;
  return item?.orgId ?? null;
}

// Find an EXISTING org for an email's domain using the canonical eTLD+1 identity model owned by
// organization-api. Checks an alias mapping first (a domain manually pointed at another company),
// then the canonical eTLD+1 itself. Returns null for free-mail/invalid domains, or when no org
// exists yet — P1 does not create one (the caller routes that to the Needs-Linking queue).
export async function findExistingOrgIdByEmail(email: string): Promise<string | null> {
  const { orgId: canonical, domain } = classifyEmailDomain(email);
  if (!canonical) return null; // free-mail or unparseable → no corporate org
  if (domain && domain !== canonical) {
    const aliasOrgId = await lookupOrgIdByDomainKey(domain);
    if (aliasOrgId) return aliasOrgId;
  }
  return lookupOrgIdByDomainKey(canonical);
}

export async function bumpOrgRollupOnCreate(args: { orgId: string; kind: string; occurredAt: string; isInternalOnly?: boolean }): Promise<void> {
  if (!isRealOrg(args.orgId)) return;
  const countAttr = KIND_TO_COUNT[args.kind];
  const latestAttr = KIND_TO_LATEST[args.kind];
  // Rule: internalOnly events (internal notes/calls) never advance customer-facing lastActivityAt.
  const advanceActivity = !args.isInternalOnly;

  if (advanceActivity) {
    let expr = 'SET lastActivityAt = :occ';
    if (countAttr) expr += `, ${countAttr} = if_not_exists(${countAttr}, :zero) + :one`;
    if (latestAttr) expr += `, ${latestAttr} = :occ`;
    try {
      await docClient.send(new UpdateCommand({
        TableName: TABLE_NAME(),
        Key: { PK: `ORG#${args.orgId}`, SK: ORG_META_SK },
        UpdateExpression: expr,
        ConditionExpression: 'attribute_not_exists(lastActivityAt) OR lastActivityAt < :occ',
        ExpressionAttributeValues: { ':occ': args.occurredAt, ':zero': 0, ':one': 1 },
      }));
    } catch (err: unknown) {
      // Out-of-order event (older than current lastActivityAt). The single conditional update
      // also gates the count + latest*Date together, so a count-only partial fix would leave
      // latest*Date stale. Recompute from the authoritative event set — correct for every field.
      if ((err as { name?: string }).name === 'ConditionalCheckFailedException') {
        await recomputeRollupsForOrg(args.orgId);
      } else {
        throw err;
      }
    }
    return;
  }

  // internalOnly: do NOT touch lastActivityAt. Apply count/latest only if the kind has them (rare).
  const sets = [
    countAttr ? `${countAttr} = if_not_exists(${countAttr}, :zero) + :one` : null,
    latestAttr ? `${latestAttr} = :occ` : null,
  ].filter(Boolean) as string[];
  if (sets.length === 0) return; // pure internal note → nothing to roll up
  await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME(),
    Key: { PK: `ORG#${args.orgId}`, SK: ORG_META_SK },
    UpdateExpression: 'SET ' + sets.join(', '),
    ExpressionAttributeValues: { ':occ': args.occurredAt, ':zero': 0, ':one': 1 },
  }));
}

export async function recomputeRollupsForOrg(orgId: string): Promise<void> {
  if (!isRealOrg(orgId)) return;
  const events: Array<{ kind: string; occurredAt: string; voided?: boolean; isInternalOnly?: boolean }> = [];
  let start: Record<string, unknown> | undefined;
  do {
    const res = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME(), IndexName: 'GSI2',
      KeyConditionExpression: 'GSI2PK = :pk AND begins_with(GSI2SK, :pfx)',
      ExpressionAttributeValues: { ':pk': `ORG#${orgId}`, ':pfx': 'TLEVENT#' },
      ExclusiveStartKey: start,
    }));
    for (const it of (res.Items ?? []) as typeof events) events.push(it);
    start = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (start);

  const live = events.filter((e) => !e.voided);
  const counts = { rfqCount: 0, orderCount: 0, leadCount: 0 };
  const latest: Record<string, string | null> = { latestRFQDate: null, latestOrderDate: null, latestLeadDate: null };
  let lastActivityAt: string | null = null;
  for (const e of live) {
    // lastActivityAt is customer-facing: internalOnly events never advance it.
    if (!e.isInternalOnly && e.occurredAt && (!lastActivityAt || e.occurredAt > lastActivityAt)) lastActivityAt = e.occurredAt;
    const c = KIND_TO_COUNT[e.kind]; if (c) (counts as Record<string, number>)[c] += 1;
    const l = KIND_TO_LATEST[e.kind]; if (l && (!latest[l] || e.occurredAt > (latest[l] as string))) latest[l] = e.occurredAt;
  }

  const values: Record<string, unknown> = {
    ':r': counts.rfqCount, ':o': counts.orderCount, ':l': counts.leadCount,
    ':lr': latest.latestRFQDate, ':lo': latest.latestOrderDate, ':ll': latest.latestLeadDate,
  };
  // When no customer-facing event remains, REMOVE lastActivityAt rather than writing a NULL —
  // a NULL would make the monotonic guard (attribute_not_exists OR < :occ) fail forever after.
  let updateExpression = 'SET rfqCount = :r, orderCount = :o, leadCount = :l, latestRFQDate = :lr, latestOrderDate = :lo, latestLeadDate = :ll';
  if (lastActivityAt !== null) {
    updateExpression += ', lastActivityAt = :la';
    values[':la'] = lastActivityAt;
  } else {
    updateExpression += ' REMOVE lastActivityAt';
  }

  await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME(), Key: { PK: `ORG#${orgId}`, SK: ORG_META_SK },
    UpdateExpression: updateExpression,
    ExpressionAttributeValues: values,
  }));
}
