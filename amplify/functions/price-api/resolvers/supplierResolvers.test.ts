import { describe, it, expect, vi, beforeEach } from 'vitest';

const send = vi.fn();
vi.mock('../lib/dynamodb.js', () => ({
  docClient: { send: (...a: unknown[]) => send(...a) },
  TABLE_NAME: () => 'TestTable',
}));

import { pbCreateSupplier, pbUpdateSupplier, pbListSuppliers } from './supplierResolvers.js';

const ev = (args: Record<string, unknown>) => ({
  info: { fieldName: 'x', parentTypeName: 'Mutation' },
  arguments: args,
  identity: { sub: 's', groups: ['admin'], claims: { email: 'boss@ninescrolls.com' } },
});

beforeEach(() => send.mockReset());

describe('pbCreateSupplier', () => {
  it('creates atomically with the count guard and returns the supplier without DDB keys', async () => {
    send.mockResolvedValueOnce({});
    const res = await pbCreateSupplier(ev({ input: { name: 'Probe OEM', defaultValidityDays: 180 } })) as Record<string, unknown>;
    expect(res.supplierId).toMatch(/^sup-/);
    expect(res.status).toBe('ACTIVE');
    expect(res.PK).toBeUndefined();
    const tx = send.mock.calls[0][0].input.TransactItems;
    expect(tx[0].Update.ConditionExpression).toBe('attribute_not_exists(cnt) OR cnt < :max');
    expect(tx[0].Update.ExpressionAttributeValues[':max']).toBe(10);
    expect(tx[1].Put.ConditionExpression).toBe('attribute_not_exists(PK)');
  });

  it('maps a guard-condition failure (cap reached) to a VALIDATION error', async () => {
    send.mockRejectedValueOnce(Object.assign(new Error('x'), {
      name: 'TransactionCanceledException',
      CancellationReasons: [{ Code: 'ConditionalCheckFailed' }, { Code: 'None' }],
    }));
    await expect(pbCreateSupplier(ev({ input: { name: 'Eleventh OEM' } }))).rejects.toThrow(/^VALIDATION:.*limit/);
  });

  it('maps a non-guard cancellation (key collision) to CONFLICT, not "limit reached"', async () => {
    send.mockRejectedValueOnce(Object.assign(new Error('x'), {
      name: 'TransactionCanceledException',
      CancellationReasons: [{ Code: 'None' }, { Code: 'ConditionalCheckFailed' }],
    }));
    await expect(pbCreateSupplier(ev({ input: { name: 'Probe OEM' } }))).rejects.toThrow(/^CONFLICT:/);
  });

  it('rejects a missing name', async () => {
    await expect(pbCreateSupplier(ev({ input: { name: ' ' } }))).rejects.toThrow(/^VALIDATION:/);
  });
});

describe('pbUpdateSupplier', () => {
  it('updates mutable fields only', async () => {
    send.mockResolvedValueOnce({ Attributes: { supplierId: 's1', name: 'N', status: 'SUSPENDED' } });
    const res = await pbUpdateSupplier(ev({ input: { supplierId: 's1', status: 'SUSPENDED' } })) as Record<string, unknown>;
    expect(res.status).toBe('SUSPENDED');
    const upd = send.mock.calls[0][0].input;
    expect(upd.ConditionExpression).toContain('attribute_exists');
  });

  it('maps a missing supplier to NOT_FOUND', async () => {
    send.mockRejectedValueOnce(Object.assign(new Error('x'), { name: 'ConditionalCheckFailedException' }));
    await expect(pbUpdateSupplier(ev({ input: { supplierId: 'nope', name: 'X' } })))
      .rejects.toThrow(/^NOT_FOUND:/);
  });
});

describe('pbListSuppliers', () => {
  it('queries the SUPPLIERS GSI partition — never Scan', async () => {
    send.mockResolvedValueOnce({ Items: [{ PK: 'PSUP#s1', SK: 'META', GSI1PK: 'SUPPLIERS', GSI1SK: 'x', supplierId: 's1' }] });
    const res = await pbListSuppliers(ev({})) as { items: Record<string, unknown>[] };
    expect(res.items[0].supplierId).toBe('s1');
    const q = send.mock.calls[0][0];
    expect(q.constructor.name).toBe('QueryCommand');
    expect(q.input.IndexName).toBe('GSI1');
    expect(q.input.ExpressionAttributeValues[':pk']).toBe('SUPPLIERS');
  });
});
