import { describe, it, expect } from 'vitest';
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { FakeDdb } from './fakeDdb';

describe('fakeDdb REMOVE', () => {
  it('removes attributes named in a REMOVE clause', async () => {
    const ddb = new FakeDdb();
    ddb.seed([{ PK: 'D#1', SK: 'META', keep: 'y', drop: 'x' }]);
    await ddb.send(new UpdateCommand({
      TableName: 't', Key: { PK: 'D#1', SK: 'META' },
      UpdateExpression: 'REMOVE drop',
    }));
    expect([...ddb.store.values()]).toEqual([{ PK: 'D#1', SK: 'META', keep: 'y' }]);
  });

  it('supports SET and REMOVE in one expression', async () => {
    const ddb = new FakeDdb();
    ddb.seed([{ PK: 'D#1', SK: 'META', a: 1, drop: 'x' }]);
    await ddb.send(new UpdateCommand({
      TableName: 't', Key: { PK: 'D#1', SK: 'META' },
      UpdateExpression: 'SET a = :a REMOVE drop',
      ExpressionAttributeValues: { ':a': 2 },
    }));
    expect([...ddb.store.values()]).toEqual([{ PK: 'D#1', SK: 'META', a: 2 }]);
  });

  it('removes multiple comma-separated attributes with name aliases', async () => {
    const ddb = new FakeDdb();
    ddb.seed([{ PK: 'D#1', SK: 'META', a: 1, b: 2, c: 3 }]);
    await ddb.send(new UpdateCommand({
      TableName: 't', Key: { PK: 'D#1', SK: 'META' },
      UpdateExpression: 'REMOVE b, #c',
      ExpressionAttributeNames: { '#c': 'c' },
    }));
    expect([...ddb.store.values()]).toEqual([{ PK: 'D#1', SK: 'META', a: 1 }]);
  });

  it('rejects malformed REMOVE attribute names', async () => {
    const ddb = new FakeDdb();
    ddb.seed([{ PK: 'D#1', SK: 'META', keep: 'y' }]);
    await expect(ddb.send(new UpdateCommand({
      TableName: 't', Key: { PK: 'D#1', SK: 'META' },
      UpdateExpression: 'REMOVE keep;DROP',
    }))).rejects.toThrow('unsupported REMOVE clause');
  });
});

describe('fakeDdb conditions', () => {
  it('supports greater-than comparisons used by draft expiry guards', async () => {
    const ddb = new FakeDdb();
    ddb.seed([{ PK: 'D#1', SK: 'META', expiresAt: '2026-08-01T00:00:00.000Z', value: 1 }]);
    await ddb.send(new UpdateCommand({
      TableName: 't', Key: { PK: 'D#1', SK: 'META' },
      UpdateExpression: 'SET value = :value',
      ConditionExpression: 'expiresAt > :now',
      ExpressionAttributeValues: { ':value': 2, ':now': '2026-07-01T00:00:00.000Z' },
    }));
    expect([...ddb.store.values()][0].value).toBe(2);
  });
});
