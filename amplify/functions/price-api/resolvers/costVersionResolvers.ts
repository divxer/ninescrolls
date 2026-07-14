import { GetCommand, QueryCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../lib/dynamodb.js';
import { parseInput, stripKeys, getOperator, type PriceApiEvent, type CostVersionItem } from '../lib/types.js';

const SOURCES = ['MANUAL_ENTRY', 'SUPPLIER_EXCEL', 'SUPPLIER_LINK'] as const;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** DATE_RE alone accepts 2026-13-45; round-trip through Date catches those. */
const isCalendarDate = (s: string): boolean => {
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

interface AppendInput {
  itemId: string; supplierId: string;
  unitCostFen: number;
  effectiveFrom: string; effectiveTo: string;
  priceSource: (typeof SOURCES)[number];
}

/**
 * Spec-normative order (third review): guard revision FIRST, then versions,
 * then overlap check, then one transaction. Reading versions before the guard
 * would let a concurrent insert slip between the two reads.
 */
export async function pbAppendCostVersion(event: PriceApiEvent) {
  const input = parseInput<AppendInput>(event);
  if (!input.itemId || !input.supplierId) throw new Error('VALIDATION: itemId and supplierId are required');
  if (!Number.isInteger(input.unitCostFen) || input.unitCostFen <= 0) {
    throw new Error('VALIDATION: unitCostFen must be a positive integer (RMB fen)');
  }
  if (!DATE_RE.test(input.effectiveFrom) || !DATE_RE.test(input.effectiveTo)) {
    throw new Error('VALIDATION: effectiveFrom/effectiveTo must be YYYY-MM-DD');
  }
  if (!isCalendarDate(input.effectiveFrom) || !isCalendarDate(input.effectiveTo)) {
    throw new Error('VALIDATION: effectiveFrom/effectiveTo must be real calendar dates');
  }
  if (input.effectiveTo <= input.effectiveFrom) {
    throw new Error('VALIDATION: effectiveTo must be after effectiveFrom');
  }
  if (!SOURCES.includes(input.priceSource)) {
    throw new Error(`VALIDATION: priceSource must be one of ${SOURCES.join(', ')}`);
  }

  const pk = `PCAT#${input.itemId}`;
  const guardSk = `COSTGUARD#${input.supplierId}`;

  // ① Strongly consistent guard read FIRST.
  const guardRes = await docClient.send(new GetCommand({
    TableName: TABLE_NAME(), Key: { PK: pk, SK: guardSk }, ConsistentRead: true,
  }));
  const revision = guardRes.Item?.revision as number | undefined;

  // ② Strongly consistent, exhaustive version Query for this (item, supplier).
  const versions: Record<string, unknown>[] = [];
  let key: Record<string, unknown> | undefined;
  do {
    const r = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME(),
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: { ':pk': pk, ':sk': `COST#${input.supplierId}#` },
      ConsistentRead: true,
      ExclusiveStartKey: key,
    }));
    versions.push(...(r.Items ?? []));
    key = r.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (key);

  // ③ Overlap check: [from, to) intervals for the same (item, supplier).
  for (const v of versions) {
    const from = v.effectiveFrom as string;
    const to = v.effectiveTo as string;
    if (input.effectiveFrom < to && from < input.effectiveTo) {
      throw new Error(`VALIDATION: interval overlaps existing cost version ${from}..${to}`);
    }
  }

  const now = new Date().toISOString();
  const item: CostVersionItem = {
    PK: pk, SK: `COST#${input.supplierId}#${input.effectiveFrom}`,
    itemId: input.itemId, supplierId: input.supplierId,
    unitCostFen: input.unitCostFen, currency: 'RMB',
    effectiveFrom: input.effectiveFrom, effectiveTo: input.effectiveTo,
    priceSource: input.priceSource,
    reviewStatus: 'APPROVED', // P1 unconditional (spec); semantics activate at evolution stage 2
    createdAt: now, createdBy: getOperator(event),
  };

  // ④ One transaction: guard CAS (or attribute_not_exists bootstrap) + conditional Put.
  const guardUpdate = revision === undefined
    ? {
      Update: {
        TableName: TABLE_NAME(), Key: { PK: pk, SK: guardSk },
        UpdateExpression: 'SET revision = :one',
        ConditionExpression: 'attribute_not_exists(PK)',
        ExpressionAttributeValues: { ':one': 1 },
      },
    }
    : {
      Update: {
        TableName: TABLE_NAME(), Key: { PK: pk, SK: guardSk },
        UpdateExpression: 'SET revision = revision + :one',
        ConditionExpression: 'revision = :expected',
        ExpressionAttributeValues: { ':one': 1, ':expected': revision },
      },
    };

  try {
    await docClient.send(new TransactWriteCommand({
      TransactItems: [
        guardUpdate,
        { Put: { TableName: TABLE_NAME(), Item: item, ConditionExpression: 'attribute_not_exists(PK)' } },
        // Referential existence: costs must not be appended to phantom items or
        // suppliers. Appended AFTER the guard/put so indexes 0/1 stay stable.
        {
          ConditionCheck: {
            TableName: TABLE_NAME(),
            Key: { PK: pk, SK: 'META' },
            ConditionExpression: 'attribute_exists(PK)',
          },
        },
        {
          ConditionCheck: {
            TableName: TABLE_NAME(),
            Key: { PK: `PSUP#${input.supplierId}`, SK: 'META' },
            ConditionExpression: 'attribute_exists(PK)',
          },
        },
      ],
    }));
  } catch (e) {
    const err = e as Error & { CancellationReasons?: Array<{ Code?: string }> };
    if (err.name === 'TransactionCanceledException') {
      const reasons = err.CancellationReasons;
      if (reasons?.[2]?.Code === 'ConditionalCheckFailed') {
        throw new Error(`NOT_FOUND: catalog item ${input.itemId}`);
      }
      if (reasons?.[3]?.Code === 'ConditionalCheckFailed') {
        throw new Error(`NOT_FOUND: supplier ${input.supplierId}`);
      }
      throw new Error('CONFLICT: concurrent cost update for this item/supplier — refresh and retry');
    }
    throw e;
  }
  return stripKeys(item);
}

export async function pbListCostVersions(event: PriceApiEvent) {
  const { itemId, supplierId } = parseInput<{ itemId: string; supplierId?: string }>(event);
  if (!itemId) throw new Error('VALIDATION: itemId is required');
  const prefix = supplierId ? `COST#${supplierId}#` : 'COST#';
  const items: Record<string, unknown>[] = [];
  let key: Record<string, unknown> | undefined;
  do {
    const r = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME(),
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: { ':pk': `PCAT#${itemId}`, ':sk': prefix },
      ExclusiveStartKey: key,
    }));
    items.push(...(r.Items ?? []));
    key = r.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (key);
  return { items: items.map((it) => stripKeys(it as unknown as CostVersionItem)) };
}

/**
 * Effective cost selection (spec): the version where effectiveFrom <= today < effectiveTo.
 * Returns the FULL version object — quotation snapshots need complete provenance
 * (supplierId, interval, priceSource, reviewStatus), not just the amount.
 * Exported for reuse by quotation pricing (Task 11) and the Price Book badges.
 */
export function selectEffectiveCost<T extends { effectiveFrom: string; effectiveTo: string }>(
  versions: T[],
  todayIso: string, // 'YYYY-MM-DD'
): T | null {
  return versions.find((v) => v.effectiveFrom <= todayIso && todayIso < v.effectiveTo) ?? null;
}
