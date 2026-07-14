import { PutCommand, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
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
  await docClient.send(new PutCommand({
    TableName: TABLE_NAME(), Item: item, ConditionExpression: 'attribute_not_exists(PK)',
  }));
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
