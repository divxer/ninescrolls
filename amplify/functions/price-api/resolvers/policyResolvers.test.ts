import { describe, it, expect, vi, beforeEach } from 'vitest';

const send = vi.fn();
vi.mock('../lib/dynamodb.js', () => ({
  docClient: { send: (...a: unknown[]) => send(...a) },
  TABLE_NAME: () => 'TestTable',
}));

import { pbGetPricingPolicy, pbUpdatePricingPolicy, DEFAULT_POLICY } from './policyResolvers.js';

const ev = (args: Record<string, unknown> = {}) => ({
  info: { fieldName: 'x', parentTypeName: 'Query' },
  arguments: args,
  identity: { sub: 's', groups: ['admin'], claims: { email: 'boss@ninescrolls.com' } },
});

beforeEach(() => send.mockReset());

describe('pbGetPricingPolicy', () => {
  it('returns stored policy', async () => {
    send.mockResolvedValueOnce({ Item: { PK: 'PRICING_POLICY', SK: 'META', fxRmbPerUsdMilli: 7000 } });
    const res = await pbGetPricingPolicy(ev()) as Record<string, unknown>;
    expect(res.fxRmbPerUsdMilli).toBe(7000);
  });

  it('returns defaults when no policy exists yet', async () => {
    send.mockResolvedValueOnce({});
    const res = await pbGetPricingPolicy(ev()) as Record<string, unknown>;
    expect(res.fxRmbPerUsdMilli).toBe(DEFAULT_POLICY.fxRmbPerUsdMilli);
  });
});

describe('pbUpdatePricingPolicy', () => {
  it('validates ranges and stamps fxUpdatedAt when the rate changes', async () => {
    send.mockResolvedValueOnce({ Attributes: { fxRmbPerUsdMilli: 7100 } });
    await pbUpdatePricingPolicy(ev({ input: { fxRmbPerUsdMilli: 7100 } }));
    const upd = send.mock.calls[0][0].input;
    expect(upd.UpdateExpression).toContain('fxUpdatedAt');
  });

  it('rejects margin >= 100%', async () => {
    await expect(pbUpdatePricingPolicy(ev({ input: { defaultMarginBp: 10000 } })))
      .rejects.toThrow(/^VALIDATION:/);
  });

  it('rejects out-of-range values inside override maps', async () => {
    await expect(pbUpdatePricingPolicy(ev({ input: { itemOverrides: { 'RIE-300': 10000 } } })))
      .rejects.toThrow(/^VALIDATION:.*itemOverrides/);
    await expect(pbUpdatePricingPolicy(ev({ input: { seriesOverrides: { RIE: -1 } } })))
      .rejects.toThrow(/^VALIDATION:.*seriesOverrides/);
  });
});
