import { describe, it, expect, vi, beforeEach } from 'vitest';

const send = vi.fn();
vi.mock('../lib/dynamodb.js', () => ({
  docClient: { send: (...a: unknown[]) => send(...a) },
  TABLE_NAME: () => 'TestTable',
}));

import { pbCreateCatalogItem, pbUpdateCatalogItem, pbListCatalogItems } from './catalogResolvers.js';

const ev = (args: Record<string, unknown>) => ({
  info: { fieldName: 'x', parentTypeName: 'Mutation' },
  arguments: args,
  identity: { sub: 's', groups: ['admin'] },
});

beforeEach(() => send.mockReset());

describe('pbCreateCatalogItem', () => {
  it('persists a validated preferred supplier reference', async () => {
    send.mockResolvedValueOnce({});
    const res = await pbCreateCatalogItem(ev({ input: { sku: 'X', name: 'x', series: 'S', kind: 'OPTION', preferredSupplierId: 's1' } })) as Record<string, unknown>;
    expect(res.preferredSupplierId).toBe('s1');
    const tx = send.mock.calls[0][0].input.TransactItems;
    expect(tx[2].ConditionCheck.Key).toEqual({ PK: 'PSUP#s1', SK: 'META' });
  });
  it('creates an item with rule defaults and a series-sorted GSI key', async () => {
    send.mockResolvedValueOnce({});
    const res = await pbCreateCatalogItem(ev({
      input: { sku: 'RIE-300', name: 'RIE Etcher 300', series: 'RIE', kind: 'MACHINE' },
    })) as Record<string, unknown>;
    expect(res.itemId).toMatch(/^cat-/);
    expect(res.requiredOptionSkus).toEqual([]);
    const tx = send.mock.calls[0][0].input.TransactItems;
    expect(tx).toHaveLength(2);
    expect(tx[0].Put.Item.PK).toBe('PCATSKU#RIE-300');
    expect(tx[0].Put.Item.SK).toBe('META');
    expect(tx[0].Put.ConditionExpression).toBe('attribute_not_exists(PK)');
    expect(tx[1].Put.Item.GSI1PK).toBe('CATALOG_ITEMS');
    expect(tx[1].Put.Item.GSI1SK).toBe('RIE#RIE-300');
    expect(tx[1].Put.ConditionExpression).toBe('attribute_not_exists(PK)');
  });

  it('maps a sku-marker condition failure to VALIDATION already-exists', async () => {
    send.mockRejectedValueOnce(Object.assign(new Error('x'), {
      name: 'TransactionCanceledException',
      CancellationReasons: [{ Code: 'ConditionalCheckFailed' }, { Code: 'None' }],
    }));
    await expect(pbCreateCatalogItem(ev({
      input: { sku: 'RIE-300', name: 'Dup', series: 'RIE', kind: 'MACHINE' },
    }))).rejects.toThrow(/^VALIDATION:.*already exists/);
  });

  it('maps a non-marker cancellation to CONFLICT', async () => {
    send.mockRejectedValueOnce(Object.assign(new Error('x'), {
      name: 'TransactionCanceledException',
      CancellationReasons: [{ Code: 'None' }, { Code: 'ConditionalCheckFailed' }],
    }));
    await expect(pbCreateCatalogItem(ev({
      input: { sku: 'RIE-300', name: 'Dup', series: 'RIE', kind: 'MACHINE' },
    }))).rejects.toThrow(/^CONFLICT:/);
  });

  it('rejects an invalid kind', async () => {
    await expect(pbCreateCatalogItem(ev({ input: { sku: 'X', name: 'x', series: 'S', kind: 'WIDGET' } })))
      .rejects.toThrow(/^VALIDATION:/);
  });
  it.each([{ requiredOptionSkus: [''] }, { requiresSkus: ['OK', 3] }, { excludesSkus: 'NOPE' }, { maxQuantity: 0 }, { maxQuantity: 1.5 }])('rejects malformed JSON catalog rules without writing: %j', async (bad) => {
    await expect(pbCreateCatalogItem(ev({ input: { sku: 'X', name: 'x', series: 'S', kind: 'OPTION', ...bad } }))).rejects.toThrow(/^VALIDATION:/);
    expect(send).not.toHaveBeenCalled();
  });
});

describe('pbUpdateCatalogItem', () => {
  it('validates and updates preferred supplier', async () => {
    send.mockResolvedValueOnce({ Item: { supplierId: 's2' } }).mockResolvedValueOnce({ Attributes: { itemId: 'c1', preferredSupplierId: 's2' } });
    const res = await pbUpdateCatalogItem(ev({ input: { itemId: 'c1', preferredSupplierId: 's2' } })) as Record<string, unknown>;
    expect(res.preferredSupplierId).toBe('s2');
    expect(send.mock.calls[0][0].input.Key).toEqual({ PK: 'PSUP#s2', SK: 'META' });
  });
  it('clears the optional preferred supplier instead of storing DynamoDB NULL', async () => {
    send.mockResolvedValueOnce({ Attributes: { itemId: 'c1' } });
    await pbUpdateCatalogItem(ev({ input: { itemId: 'c1', preferredSupplierId: null } }));
    expect(send.mock.calls[0][0].input.UpdateExpression).toContain('REMOVE #preferredSupplierId');
    expect(send.mock.calls[0][0].input.ExpressionAttributeValues).not.toHaveProperty(':preferredSupplierId');
  });
  it('updates rule fields', async () => {
    send.mockResolvedValueOnce({ Attributes: { itemId: 'c1', excludesSkus: ['B'] } });
    const res = await pbUpdateCatalogItem(ev({ input: { itemId: 'c1', excludesSkus: ['B'] } })) as Record<string, unknown>;
    expect(res.excludesSkus).toEqual(['B']);
  });

  it('maps a missing item to NOT_FOUND', async () => {
    send.mockRejectedValueOnce(Object.assign(new Error('x'), { name: 'ConditionalCheckFailedException' }));
    await expect(pbUpdateCatalogItem(ev({ input: { itemId: 'nope', name: 'X' } })))
      .rejects.toThrow(/^NOT_FOUND:/);
  });
  it('rejects malformed rule updates without writing', async () => {
    await expect(pbUpdateCatalogItem(ev({ input: { itemId: 'c1', maxQuantity: -1 } }))).rejects.toThrow(/^VALIDATION:/);
    expect(send).not.toHaveBeenCalled();
  });
});

describe('pbListCatalogItems', () => {
  it('queries the CATALOG_ITEMS GSI partition and paginates internally', async () => {
    send.mockResolvedValueOnce({
      Items: [{ PK: 'PCAT#c1', SK: 'META', GSI1PK: 'CATALOG_ITEMS', GSI1SK: 'RIE#R1', itemId: 'c1', series: 'RIE' }],
    });
    const res = await pbListCatalogItems(ev({})) as { items: Record<string, unknown>[] };
    expect(res.items).toHaveLength(1);
    expect(send.mock.calls[0][0].input.IndexName).toBe('GSI1');
  });
});
