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
  it('creates an item with rule defaults and a series-sorted GSI key', async () => {
    send.mockResolvedValueOnce({});
    const res = await pbCreateCatalogItem(ev({
      input: { sku: 'RIE-300', name: 'RIE Etcher 300', series: 'RIE', kind: 'MACHINE' },
    })) as Record<string, unknown>;
    expect(res.itemId).toMatch(/^cat-/);
    expect(res.requiredOptionSkus).toEqual([]);
    const put = send.mock.calls[0][0].input;
    expect(put.Item.GSI1PK).toBe('CATALOG_ITEMS');
    expect(put.Item.GSI1SK).toBe('RIE#RIE-300');
  });

  it('rejects an invalid kind', async () => {
    await expect(pbCreateCatalogItem(ev({ input: { sku: 'X', name: 'x', series: 'S', kind: 'WIDGET' } })))
      .rejects.toThrow(/^VALIDATION:/);
  });
});

describe('pbUpdateCatalogItem', () => {
  it('updates rule fields', async () => {
    send.mockResolvedValueOnce({ Attributes: { itemId: 'c1', excludesSkus: ['B'] } });
    const res = await pbUpdateCatalogItem(ev({ input: { itemId: 'c1', excludesSkus: ['B'] } })) as Record<string, unknown>;
    expect(res.excludesSkus).toEqual(['B']);
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
