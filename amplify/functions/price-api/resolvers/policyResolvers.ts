import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../lib/dynamodb.js';
import { parseInput, getOperator, type PriceApiEvent } from '../lib/types.js';
import type { PolicyData } from '../lib/pricing.js';
import { validateMarginMap } from '../lib/validation.js';

const KEY = { PK: 'PRICING_POLICY', SK: 'META' };

export const DEFAULT_POLICY: PolicyData = {
  fxRmbPerUsdMilli: 7250,
  defaultMarginBp: 3500,
  minMarginBp: 2000,
  roundingGranularityUsdCents: 10000,
  seriesOverrides: {},
  itemOverrides: {},
};

export async function pbGetPricingPolicy(_event: PriceApiEvent) {
  const r = await docClient.send(new GetCommand({ TableName: TABLE_NAME(), Key: KEY }));
  if (!r.Item) return { ...DEFAULT_POLICY };
  const { PK, SK, ...rest } = r.Item;
  return { ...DEFAULT_POLICY, ...rest };
}

type UpdatePolicyInput = Partial<PolicyData>;
const POLICY_FIELDS = [
  'fxRmbPerUsdMilli', 'defaultMarginBp', 'minMarginBp',
  'roundingGranularityUsdCents', 'seriesOverrides', 'itemOverrides',
] as const;

export async function pbUpdatePricingPolicy(event: PriceApiEvent) {
  const input = parseInput<UpdatePolicyInput>(event);
  for (const bpField of ['defaultMarginBp', 'minMarginBp'] as const) {
    const v = input[bpField];
    if (v !== undefined && (!Number.isInteger(v) || v < 0 || v >= 10000)) {
      throw new Error(`VALIDATION: ${bpField} must be an integer in [0, 10000)`);
    }
  }
  // Override MAPS get the same bp validation as the scalars — values arrive via
  // a.json() with no schema, and an out-of-range bp reaching the engine means
  // Infinity or negative prices (money-math review finding).
  for (const mapField of ['seriesOverrides', 'itemOverrides'] as const) {
    const m = input[mapField];
    validateMarginMap(m, mapField);
  }
  if (input.fxRmbPerUsdMilli !== undefined
    && (!Number.isInteger(input.fxRmbPerUsdMilli) || input.fxRmbPerUsdMilli <= 0)) {
    throw new Error('VALIDATION: fxRmbPerUsdMilli must be a positive integer');
  }
  if (input.roundingGranularityUsdCents !== undefined
    && (!Number.isInteger(input.roundingGranularityUsdCents) || input.roundingGranularityUsdCents < 1)) {
    throw new Error('VALIDATION: roundingGranularityUsdCents must be a positive integer');
  }

  const sets: string[] = ['updatedAt = :updatedAt', 'updatedBy = :updatedBy'];
  const values: Record<string, unknown> = {
    ':updatedAt': new Date().toISOString(), ':updatedBy': getOperator(event),
  };
  const names: Record<string, string> = {};
  for (const f of POLICY_FIELDS) {
    if (input[f] !== undefined) {
      sets.push(`#${f} = :${f}`);
      names[`#${f}`] = f;
      values[`:${f}`] = input[f];
    }
  }
  if (input.fxRmbPerUsdMilli !== undefined) {
    // Manually maintained rate is timestamped (spec: reproducible, auditable).
    sets.push('fxUpdatedAt = :fxUpdatedAt');
    values[':fxUpdatedAt'] = values[':updatedAt'];
  }
  const res = await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME(), Key: KEY,
    UpdateExpression: `SET ${sets.join(', ')}`,
    ExpressionAttributeValues: values,
    ...(Object.keys(names).length ? { ExpressionAttributeNames: names } : {}),
    ReturnValues: 'ALL_NEW',
  }));
  const { PK, SK, ...rest } = res.Attributes ?? {};
  return { ...DEFAULT_POLICY, ...rest };
}
