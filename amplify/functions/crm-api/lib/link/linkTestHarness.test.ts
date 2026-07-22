/* ------------------------------------------------------------------------------------------------
 * Direct unit tests on the in-memory harness's evaluator (linkTestHarness.ts) — NOT the adversarial
 * suite. These pin two DynamoDB semantics the adversarial suite's tamper-test audit found are
 * otherwise unexercised (every production ConditionExpression that uses attribute_type('NULL')
 * ORs it with attribute_not_exists, and no FilterExpression+Limit path in production partially
 * filters a page), plus one cross-type comparison pin. Exercises the harness's own send() against
 * the REAL '@aws-sdk/lib-dynamodb' command classes — no vi.mock needed, no production code involved.
 * ---------------------------------------------------------------------------------------------- */
import { describe, it, expect } from 'vitest';
import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { seedStore } from './linkTestHarness';

describe('linkTestHarness — evaluator semantics (isolated from production OR-guards)', () => {

  describe('NULL-vs-absent isolation', () => {
    it('attribute_type(field, :nullType) ALONE: passes for a present JS null, CCFEs for absent', async () => {
      const store = seedStore([
        { PK: 'ITEM#null', SK: 'A', field: null },
        { PK: 'ITEM#absent', SK: 'A' },          // field genuinely never set
      ]);
      const putFor = (pk: string) => store.send(new PutCommand({
        TableName: 'T',
        Item: { PK: pk, SK: 'A', touched: true },
        ConditionExpression: 'attribute_type(field, :nullType)',
        ExpressionAttributeValues: { ':nullType': 'NULL' },
      }));

      await expect(putFor('ITEM#null')).resolves.toEqual({});
      expect(store.get({ PK: 'ITEM#null', SK: 'A' }).touched).toBe(true);

      await expect(putFor('ITEM#absent')).rejects.toMatchObject({ name: 'ConditionalCheckFailedException' });
      expect(store.get({ PK: 'ITEM#absent', SK: 'A' }).touched).toBeUndefined();
    });

    it('attribute_not_exists(field) ALONE: passes for absent, CCFEs for a present JS null', async () => {
      const store = seedStore([
        { PK: 'ITEM#null', SK: 'A', field: null },
        { PK: 'ITEM#absent', SK: 'A' },
      ]);
      const putFor = (pk: string) => store.send(new PutCommand({
        TableName: 'T',
        Item: { PK: pk, SK: 'A', touched: true },
        ConditionExpression: 'attribute_not_exists(field)',
      }));

      await expect(putFor('ITEM#absent')).resolves.toEqual({});
      expect(store.get({ PK: 'ITEM#absent', SK: 'A' }).touched).toBe(true);

      await expect(putFor('ITEM#null')).rejects.toMatchObject({ name: 'ConditionalCheckFailedException' });
      expect(store.get({ PK: 'ITEM#null', SK: 'A' }).touched).toBeUndefined();
    });
  });

  describe('Limit applied BEFORE FilterExpression', () => {
    it('first page examines Limit items pre-filter (0 matches, but LastEvaluatedKey present); the match surfaces on a later page', async () => {
      // 5 items in one partition, sort key '1'..'5'; only the 4th (SK '4') matches the filter.
      const store = seedStore([
        { PK: 'LIST#p1', SK: '1', flag: false },
        { PK: 'LIST#p1', SK: '2', flag: false },
        { PK: 'LIST#p1', SK: '3', flag: false },
        { PK: 'LIST#p1', SK: '4', flag: true },   // the only match
        { PK: 'LIST#p1', SK: '5', flag: false },
      ]);
      const page1 = await store.send(new QueryCommand({
        TableName: 'T',
        KeyConditionExpression: 'PK = :pk',
        FilterExpression: 'flag = :t',
        ExpressionAttributeValues: { ':pk': 'LIST#p1', ':t': true },
        Limit: 2,
      })) as { Items: unknown[]; LastEvaluatedKey?: Record<string, unknown> };

      // Limit(2) examines items '1' and '2' — neither matches — so Items is empty even though a
      // match exists later in the partition. Filter-before-Limit would have kept paging internally
      // and found it on "page 1"; this proves Limit truly gates BEFORE the filter runs.
      expect(page1.Items).toHaveLength(0);
      expect(page1.LastEvaluatedKey).toBeDefined();

      // Keep paging with ExclusiveStartKey until the match surfaces (or pages run out).
      let found: unknown[] = [];
      let startKey = page1.LastEvaluatedKey;
      let guard = 0;
      while (startKey && found.length === 0 && guard < 10) {
        guard += 1;
        const page = await store.send(new QueryCommand({
          TableName: 'T',
          KeyConditionExpression: 'PK = :pk',
          FilterExpression: 'flag = :t',
          ExpressionAttributeValues: { ':pk': 'LIST#p1', ':t': true },
          Limit: 2,
          ExclusiveStartKey: startKey,
        })) as { Items: Array<Record<string, unknown>>; LastEvaluatedKey?: Record<string, unknown> };
        found = page.Items;
        startKey = page.LastEvaluatedKey;
      }
      expect(found).toHaveLength(1);
      expect(found[0]).toMatchObject({ SK: '4', flag: true });
    });
  });

  describe('cross-type comparison', () => {
    it("null < 'A' is FALSE (typed comparison, not JS coercion) — condition fails, Put CCFEs", async () => {
      const store = seedStore([{ PK: 'ITEM#x', SK: 'A', field: null }]);
      await expect(store.send(new PutCommand({
        TableName: 'T',
        Item: { PK: 'ITEM#x', SK: 'A', touched: true },
        ConditionExpression: 'field < :val',
        ExpressionAttributeValues: { ':val': 'A' },
      }))).rejects.toMatchObject({ name: 'ConditionalCheckFailedException' });
      expect(store.get({ PK: 'ITEM#x', SK: 'A' }).touched).toBeUndefined();
    });
  });
});
