import { describe, it, expect, vi, beforeEach } from 'vitest';

// PROD REGRESSION PIN — `crm.repair.recovery_pass_error: "Cannot convert undefined or null to object"`
// (fired every 15-min cron cycle; every crm.repair.summary carried errors:1).
//
// Unlike reconcileRepair.test.ts (which mocks sweepState + repairMarker), this suite exercises the
// REAL readState → queryStuckByReason → persistPage chain against a stateful fake table, so the
// cursor ROUND TRIP is under test — that round trip is where the bug lived:
//   cycle 1: state item has no cursor → query with ExclusiveStartKey undefined (fine) →
//            persistPage writes `cursor: null` (`p.cursor ?? null`) and releaseLeaseKeepCursor
//            deliberately preserves it.
//   cycle 2: readState returns cursor === null → ExclusiveStartKey: null → the lib-dynamodb
//            marshaller walks that node with Object.entries(null) and throws the TypeError.
// Verified against the real SDK (@aws-sdk/lib-dynamodb 3.988.0): `undefined` short-circuits,
// `null` throws "Cannot convert undefined or null to object". Sticky forever = every cycle errors.
const send = vi.fn();
vi.mock('../dynamodb', () => ({ docClient: { send: (...a: unknown[]) => send(...a) }, TABLE_NAME: () => 'T' }));
const resolveEffectiveTarget = vi.fn();
vi.mock('./replaySideEffects', () => ({
  replayStructuredSideEffects: vi.fn(), replayAnalyticsSideEffects: vi.fn(),
  resolveEffectiveTarget: (...a: unknown[]) => resolveEffectiveTarget(...a),
}));
import { reconcileRepair } from './reconcileRepair';

const DRAIN_PK = 'CRM_SWEEP#repair#drain';
type Cmd = { input: Record<string, any>; constructor: { name: string } };

// The prod 3C `repair/drain` state item: predates the recovery pass, so it has NO cursor attribute.
let stateItem: Record<string, unknown>;

// Stateful fake DynamoDB: real enough for the cursor round trip (Get → SET cursor → Get again).
function install() {
  send.mockImplementation((cmd: Cmd) => {
    const name = cmd.constructor.name;
    const input = cmd.input ?? {};
    if (name === 'GetCommand') {
      return Promise.resolve(input.Key?.PK === DRAIN_PK ? { Item: { ...stateItem } } : {});
    }
    if (name === 'QueryCommand') {
      // Faithful to @aws-sdk/lib-dynamodb: ExclusiveStartKey is an ALL_VALUES marshal node, walked
      // with Object.entries(). `undefined` is short-circuited; `null` throws this exact TypeError.
      if (input.ExclusiveStartKey === null) return Promise.reject(new TypeError('Cannot convert undefined or null to object'));
      return Promise.resolve({ Items: [] });
    }
    if (name === 'UpdateCommand' && input.Key?.PK === DRAIN_PK) {
      const vals = input.ExpressionAttributeValues ?? {};
      const expr = String(input.UpdateExpression ?? '');
      if (/SET[^]*#c = :c/.test(expr)) stateItem = { ...stateItem, cursor: vals[':c'] };   // persistPage
      if (/REMOVE[^]*#c/.test(expr)) { const s = { ...stateItem }; delete s.cursor; stateItem = s; }
      if (/lease = :tok/.test(expr)) stateItem = { ...stateItem, lease: vals[':tok'] };    // acquireLease
      return Promise.resolve({});
    }
    return Promise.resolve({});
  });
}

beforeEach(() => {
  send.mockReset(); resolveEffectiveTarget.mockReset();
  stateItem = { PK: DRAIN_PK, SK: 'STATE', hasMore: false, lastSummary: { repaired: 0 } };
  install();
});

describe('reconcileRepair recovery pass — rotation-cursor round trip (prod recovery_pass_error)', () => {
  it('completes clean on a fresh prod state item that has never had a cursor', async () => {
    const s = await reconcileRepair({}) as Record<string, number>;
    expect(s.errors).toBe(0);
    expect(s.recovered).toBe(0);
  });

  it('completes clean on the NEXT cycle, after the pass persisted an end-of-partition cursor', async () => {
    await reconcileRepair({});
    expect(stateItem.cursor).toBeNull();          // persistPage stores "wrap to head" as NULL
    const s2 = await reconcileRepair({}) as Record<string, number>;
    expect(s2.errors).toBe(0);                    // was 1: ExclusiveStartKey: null → TypeError
    expect(s2.recovered).toBe(0);
  });

  it('never hands a null ExclusiveStartKey to DynamoDB once a null cursor is persisted', async () => {
    stateItem = { ...stateItem, cursor: null };
    await reconcileRepair({});
    const startKeys = send.mock.calls
      .map(([c]: [Cmd]) => c.input)
      .filter((i: Record<string, any>) => 'ExclusiveStartKey' in i)
      .map((i: Record<string, any>) => i.ExclusiveStartKey);
    expect(startKeys.every((k: unknown) => k !== null)).toBe(true);
  });

  it('still resumes from a REAL persisted cursor (rotation is not disabled by the null guard)', async () => {
    stateItem = { ...stateItem, cursor: { PK: 'CRM_REPAIR#u1#01A', SK: 'MARKER' } };
    await reconcileRepair({});
    const stuckQuery = send.mock.calls
      .map(([c]: [Cmd]) => c.input)
      .find((i: Record<string, any>) => i.ExpressionAttributeValues?.[':pk'] === 'CRM_REPAIR#stuck#target_unavailable');
    expect(stuckQuery?.ExclusiveStartKey).toEqual({ PK: 'CRM_REPAIR#u1#01A', SK: 'MARKER' });
  });
});
