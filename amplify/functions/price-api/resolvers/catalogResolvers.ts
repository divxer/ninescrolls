import { UpdateCommand, QueryCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../lib/dynamodb.js';
import { generateCatalogItemId } from '../lib/ids.js';
import { parseInput, stripKeys, type PriceApiEvent, type CatalogItemItem } from '../lib/types.js';

const KINDS = ['MACHINE', 'OPTION', 'CONSUMABLE', 'SERVICE'] as const;
type Kind = (typeof KINDS)[number];

interface CreateCatalogInput {
  sku: string; name: string; series: string; kind: Kind;
  specs?: Record<string, string>;
  requiredOptionSkus?: string[]; requiresSkus?: string[]; excludesSkus?: string[];
  maxQuantity?: number;
}

export async function pbCreateCatalogItem(event: PriceApiEvent) {
  const input = parseInput<CreateCatalogInput>(event);
  if (!input.sku?.trim() || !input.name?.trim() || !input.series?.trim()) {
    throw new Error('VALIDATION: sku, name and series are required');
  }
  if (!KINDS.includes(input.kind)) {
    throw new Error(`VALIDATION: kind must be one of ${KINDS.join(', ')}`);
  }
  const now = new Date().toISOString();
  const itemId = generateCatalogItemId();
  const item: CatalogItemItem = {
    PK: `PCAT#${itemId}`, SK: 'META',
    GSI1PK: 'CATALOG_ITEMS', GSI1SK: `${input.series.trim()}#${input.sku.trim()}`,
    itemId,
    sku: input.sku.trim(), name: input.name.trim(), series: input.series.trim(), kind: input.kind,
    specs: input.specs || undefined,
    requiredOptionSkus: input.requiredOptionSkus ?? [],
    requiresSkus: input.requiresSkus ?? [],
    excludesSkus: input.excludesSkus ?? [],
    maxQuantity: input.maxQuantity,
    createdAt: now, updatedAt: now,
  };
  try {
    // sku is the business join key (pricing itemOverrides, compatibility rules,
    // quotation lines) — uniqueness is enforced atomically via a marker item in
    // the same transaction as the catalog Put (same pattern as the supplier cap).
    // The update whitelist excludes sku, so the marker never goes stale.
    await docClient.send(new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: TABLE_NAME(),
            Item: { PK: `PCATSKU#${item.sku}`, SK: 'META', itemId },
            ConditionExpression: 'attribute_not_exists(PK)',
          },
        },
        { Put: { TableName: TABLE_NAME(), Item: item, ConditionExpression: 'attribute_not_exists(PK)' } },
      ],
    }));
  } catch (e) {
    const err = e as Error & { CancellationReasons?: Array<{ Code?: string }> };
    if (err.name === 'TransactionCanceledException') {
      // Index 0 = sku marker (duplicate), index 1 = item Put (id collision).
      if (err.CancellationReasons?.[0]?.Code === 'ConditionalCheckFailed') {
        throw new Error(`VALIDATION: sku "${item.sku}" already exists`);
      }
      throw new Error('CONFLICT: concurrent catalog create — retry');
    }
    throw e;
  }
  return stripKeys(item);
}

interface UpdateCatalogInput {
  itemId: string;
  name?: string; specs?: Record<string, string>;
  requiredOptionSkus?: string[]; requiresSkus?: string[]; excludesSkus?: string[];
  maxQuantity?: number | null;
}

const CATALOG_MUTABLE = ['name', 'specs', 'requiredOptionSkus', 'requiresSkus', 'excludesSkus', 'maxQuantity'] as const;

export async function pbUpdateCatalogItem(event: PriceApiEvent) {
  const input = parseInput<UpdateCatalogInput>(event);
  if (!input.itemId) throw new Error('VALIDATION: itemId is required');
  const sets: string[] = ['updatedAt = :updatedAt'];
  const values: Record<string, unknown> = { ':updatedAt': new Date().toISOString() };
  const names: Record<string, string> = {};
  for (const f of CATALOG_MUTABLE) {
    if (input[f] !== undefined) {
      sets.push(`#${f} = :${f}`);
      names[`#${f}`] = f;
      values[`:${f}`] = input[f];
    }
  }
  try {
    const res = await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME(),
      Key: { PK: `PCAT#${input.itemId}`, SK: 'META' },
      UpdateExpression: `SET ${sets.join(', ')}`,
      ExpressionAttributeValues: values,
      ...(Object.keys(names).length ? { ExpressionAttributeNames: names } : {}),
      ConditionExpression: 'attribute_exists(PK)',
      ReturnValues: 'ALL_NEW',
    }));
    return stripKeys(res.Attributes as CatalogItemItem);
  } catch (e) {
    if ((e as Error).name === 'ConditionalCheckFailedException') {
      throw new Error(`NOT_FOUND: catalog item ${input.itemId}`);
    }
    throw e;
  }
}

const MAX_PAGES = 20;

export async function pbListCatalogItems(_event: PriceApiEvent) {
  // Constant listing partition, series-sorted; paginate internally (never Scan).
  const items: Record<string, unknown>[] = [];
  let key: Record<string, unknown> | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const r = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME(),
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: { ':pk': 'CATALOG_ITEMS' },
      ExclusiveStartKey: key,
    }));
    items.push(...(r.Items ?? []));
    key = r.LastEvaluatedKey as Record<string, unknown> | undefined;
    if (!key) break;
  }
  return { items: items.map((it) => stripKeys(it as unknown as CatalogItemItem)) };
}
