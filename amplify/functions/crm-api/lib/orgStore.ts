import { GetCommand, UpdateCommand, QueryCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from './dynamodb';
import { generateOrgId } from './idGenerators';
import { normalizeOrgName } from './normalize';

// Authoritative Organization metadata row shares the ORG#<id> partition with organization-api,
// which keys it as SK='META'. CRM rollups/auto-create MUST target the same row, never a shadow.
const ORG_META_SK = 'META';

export async function getOrgIdByDomain(domain: string): Promise<string | null> {
  const res = await docClient.send(new GetCommand({ TableName: TABLE_NAME(), Key: { PK: `ORGDOMAIN#${domain}`, SK: 'A' } }));
  return (res.Item?.orgId as string | undefined) ?? null;
}

export async function getOrgIdByName(normName: string): Promise<string | null> {
  const res = await docClient.send(new GetCommand({ TableName: TABLE_NAME(), Key: { PK: `ORGNAME#${normName}`, SK: 'A' } }));
  return (res.Item?.orgId as string | undefined) ?? null;
}

const KIND_TO_COUNT: Record<string, string> = { rfq_submitted: 'rfqCount', order_created: 'orderCount', lead_captured: 'leadCount' };
const KIND_TO_LATEST: Record<string, string> = { rfq_submitted: 'latestRFQDate', order_created: 'latestOrderDate', lead_captured: 'latestLeadDate' };

function isRealOrg(orgId: string): boolean {
  return !orgId.startsWith('unresolved-') && !orgId.startsWith('new-org:');
}

export async function createReviewOrgFromDomain(domain: string, occurredAt: string, isInternalOnly = false): Promise<string> {
  const orgId = generateOrgId();
  const nowIso = new Date().toISOString();
  const displayName = domain.split('.')[0];
  const normName = normalizeOrgName(displayName);

  const orgItem: Record<string, unknown> = {
    PK: `ORG#${orgId}`, SK: ORG_META_SK,
    GSI1PK: 'ORG_STATUS#review', GSI1SK: `${nowIso}#${orgId}`,
    entityType: 'ORGANIZATION',
    orgId, primaryDomain: domain, displayName,
    status: 'review', createdByResolution: true, linkLocked: false,
    rfqCount: 0, orderCount: 0, leadCount: 0,
    firstSeenAt: occurredAt,
    createdAt: nowIso, updatedAt: nowIso,
  };
  // The triggering event only advances customer-facing lastActivityAt when it is NOT internal-only.
  if (!isInternalOnly) orgItem.lastActivityAt = occurredAt;

  // Atomic claim+create: the domain index is the idempotency anchor. Writing it in the same
  // transaction as the org META row + name index means a race or mid-sequence failure can never
  // orphan the claim (pointing at a non-existent org) or leave a ghost review-org in the queue.
  try {
    await docClient.send(new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: TABLE_NAME(),
            Item: { PK: `ORGDOMAIN#${domain}`, SK: 'A', entityType: 'ORG_DOMAIN_INDEX', domain, orgId },
            ConditionExpression: 'attribute_not_exists(PK)',
          },
        },
        { Put: { TableName: TABLE_NAME(), Item: orgItem } },
        {
          Put: {
            TableName: TABLE_NAME(),
            Item: { PK: `ORGNAME#${normName}`, SK: 'A', entityType: 'ORG_NAME_INDEX', normName, orgId },
          },
        },
      ],
    }));
  } catch (err: unknown) {
    // The domain was already claimed (concurrent or prior call) → the transaction cancels and
    // nothing is written. Return the existing winner.
    if ((err as { name?: string }).name === 'TransactionCanceledException') {
      const existing = await getOrgIdByDomain(domain);
      if (existing) return existing;
    }
    throw err;
  }
  return orgId;
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
