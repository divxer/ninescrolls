import { UpdateCommand, QueryCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../lib/dynamodb.js';
import { generateSupplierId } from '../lib/ids.js';
import { parseInput, stripKeys, type PriceApiEvent, type SupplierItem } from '../lib/types.js';

interface CreateSupplierInput {
  name: string;
  contact?: string;
  defaultValidityDays?: number;
  notes?: string;
}

/** The ≤10-supplier product constraint (spec) is enforced ATOMICALLY via a count
 * guard updated in the same transaction as the Put — the non-paginated list UI
 * depends on this bound actually holding. */
export const MAX_SUPPLIERS = 10;

export async function pbCreateSupplier(event: PriceApiEvent) {
  const input = parseInput<CreateSupplierInput>(event);
  if (!input.name?.trim()) throw new Error('VALIDATION: name is required');
  const now = new Date().toISOString();
  const supplierId = generateSupplierId();
  const item: SupplierItem = {
    PK: `PSUP#${supplierId}`, SK: 'META',
    GSI1PK: 'SUPPLIERS', GSI1SK: `${now}#${supplierId}`,
    supplierId,
    name: input.name.trim(),
    contact: input.contact || undefined,
    currency: 'RMB',
    defaultValidityDays: input.defaultValidityDays ?? 180,
    status: 'ACTIVE',
    notes: input.notes || undefined,
    createdAt: now, updatedAt: now,
  };
  try {
    await docClient.send(new TransactWriteCommand({
      TransactItems: [
        {
          Update: {
            TableName: TABLE_NAME(),
            Key: { PK: 'COUNTER#SUPPLIER', SK: 'META' },
            UpdateExpression: 'ADD cnt :one',
            ConditionExpression: 'attribute_not_exists(cnt) OR cnt < :max',
            ExpressionAttributeValues: { ':one': 1, ':max': MAX_SUPPLIERS },
          },
        },
        { Put: { TableName: TABLE_NAME(), Item: item, ConditionExpression: 'attribute_not_exists(PK)' } },
      ],
    }));
  } catch (e) {
    const err = e as Error & { CancellationReasons?: Array<{ Code?: string }> };
    if (err.name === 'TransactionCanceledException') {
      // Distinguish WHICH condition failed: index 0 = count guard (cap), index 1 =
      // supplier Put (key collision). Only a guard failure means the cap was hit;
      // anything else is a retryable conflict, not a misleading "limit reached".
      if (err.CancellationReasons?.[0]?.Code === 'ConditionalCheckFailed') {
        throw new Error(`VALIDATION: supplier limit (${MAX_SUPPLIERS}) reached — scaling past it is a P2+ design task (list pagination + API cursor together, per spec)`);
      }
      throw new Error('CONFLICT: concurrent supplier create — retry');
    }
    throw e;
  }
  return stripKeys(item);
}

interface UpdateSupplierInput {
  supplierId: string;
  name?: string;
  contact?: string;
  defaultValidityDays?: number;
  status?: 'ACTIVE' | 'SUSPENDED';
  notes?: string;
}

const SUPPLIER_MUTABLE = ['name', 'contact', 'defaultValidityDays', 'status', 'notes'] as const;

export async function pbUpdateSupplier(event: PriceApiEvent) {
  const input = parseInput<UpdateSupplierInput>(event);
  if (!input.supplierId) throw new Error('VALIDATION: supplierId is required');
  const sets: string[] = ['updatedAt = :updatedAt'];
  const values: Record<string, unknown> = { ':updatedAt': new Date().toISOString() };
  const names: Record<string, string> = {};
  for (const f of SUPPLIER_MUTABLE) {
    if (input[f] !== undefined) {
      sets.push(`#${f} = :${f}`);
      names[`#${f}`] = f;
      values[`:${f}`] = input[f];
    }
  }
  try {
    const res = await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME(),
      Key: { PK: `PSUP#${input.supplierId}`, SK: 'META' },
      UpdateExpression: `SET ${sets.join(', ')}`,
      ExpressionAttributeValues: values,
      ...(Object.keys(names).length ? { ExpressionAttributeNames: names } : {}),
      ConditionExpression: 'attribute_exists(PK)',
      ReturnValues: 'ALL_NEW',
    }));
    return stripKeys(res.Attributes as SupplierItem);
  } catch (e) {
    if ((e as Error).name === 'ConditionalCheckFailedException') {
      throw new Error(`NOT_FOUND: supplier ${input.supplierId}`);
    }
    throw e;
  }
}

export async function pbListSuppliers(_event: PriceApiEvent) {
  // ≤10 suppliers by product constraint (spec) — a single Query page suffices.
  const r = await docClient.send(new QueryCommand({
    TableName: TABLE_NAME(),
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk',
    ExpressionAttributeValues: { ':pk': 'SUPPLIERS' },
    ScanIndexForward: false,
  }));
  return { items: (r.Items ?? []).map((it) => stripKeys(it as SupplierItem)) };
}
