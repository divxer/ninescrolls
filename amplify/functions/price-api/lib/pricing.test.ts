import { describe, it, expect } from 'vitest';
import { priceLine, priceQuotation, type PolicyData, type EngineLineInput } from './pricing.js';

const policy: PolicyData = {
  fxRmbPerUsdMilli: 7250,          // 7.25 RMB/USD
  defaultMarginBp: 3500,           // 35%
  minMarginBp: 2000,               // 20%
  roundingGranularityUsdCents: 10000, // $100
  seriesOverrides: { RIE: 4000 },
  itemOverrides: { 'RIE-CHUCK-6': 4500 },
};

const normal = (over: Partial<EngineLineInput>): EngineLineInput => ({
  sku: 'X', series: 'GEN', qty: 1, lineType: 'NORMAL', unitCostFen: 725_000, ...over,
});

describe('priceLine', () => {
  it('converts fen→cents and applies the default margin on selling price', () => {
    // 725000 fen = 7250 RMB = $1000 = 100000 cents; /(1-0.35) = 153846 cents
    const r = priceLine(normal({}), policy);
    expect(r.unitCostUsdCents).toBe(100_000);
    expect(r.marginBpApplied).toBe(3500);
    expect(r.suggestedUnitUsdCents).toBe(153_846);
  });

  it('override precedence: item beats series beats global', () => {
    expect(priceLine(normal({ series: 'RIE' }), policy).marginBpApplied).toBe(4000);
    expect(priceLine(normal({ series: 'RIE', sku: 'RIE-CHUCK-6' }), policy).marginBpApplied).toBe(4500);
  });

  it('missing cost yields unknown (null), never zero', () => {
    const r = priceLine(normal({ unitCostFen: null }), policy);
    expect(r.unitCostUsdCents).toBeNull();
    expect(r.suggestedUnitUsdCents).toBeNull();
  });

  it('rejects out-of-range margin bp from any override source', () => {
    const badPolicy: PolicyData = { ...policy, itemOverrides: { BAD: 10000 } };
    expect(() => priceLine(normal({ sku: 'BAD' }), badPolicy)).toThrow(/^VALIDATION:.*out of range/);
    const badPolicy2: PolicyData = { ...policy, itemOverrides: { BAD2: 12000 } };
    expect(() => priceLine(normal({ sku: 'BAD2' }), badPolicy2)).toThrow(/^VALIDATION:.*out of range/);
  });

  it('surcharge lines pass through their USD amount with no margin', () => {
    const r = priceLine(
      { sku: 'FREIGHT', series: 'SVC', qty: 1, lineType: 'SURCHARGE', unitCostFen: null, surchargeUsdCents: 250_000 },
      policy,
    );
    expect(r.suggestedUnitUsdCents).toBe(250_000);
    expect(r.marginBpApplied).toBe(0);
  });
});

describe('priceQuotation', () => {
  it('totals lines by qty and rounds the suggested total to granularity, keeping both values', () => {
    const r = priceQuotation([normal({ qty: 2 })], policy);
    // per unit 153846 × 2 = 307692 → rounds to 310000 ($3100)
    expect(r.suggestedTotalRawUsdCents).toBe(307_692);
    expect(r.suggestedTotalUsdCents).toBe(310_000);
    expect(r.totalCostUsdCents).toBe(200_000);
  });

  it('any unknown-cost NORMAL line makes cost and margin unknown for the whole quote', () => {
    const r = priceQuotation([normal({}), normal({ sku: 'Y', unitCostFen: null })], policy);
    expect(r.totalCostUsdCents).toBeNull();
    expect(r.suggestedTotalUsdCents).toBeNull();
    expect(r.actualMarginBp).toBeNull();
    expect(r.incomplete).toBe(true);
  });

  it('computes actual margin from actual prices when provided', () => {
    const line = { ...normal({}), actualUnitUsdCents: 125_000 };
    const r = priceQuotation([line], policy);
    // margin = (125000-100000)/125000 = 20% = 2000bp
    expect(r.actualMarginBp).toBe(2000);
    expect(r.belowMinMargin).toBe(false);
  });

  it('surcharge lines are margin-neutral: adding one leaves actualMarginBp unchanged', () => {
    const surcharge: EngineLineInput = {
      sku: 'FREIGHT', series: 'SVC', qty: 1, lineType: 'SURCHARGE', unitCostFen: null, surchargeUsdCents: 250_000,
    };
    const without = priceQuotation([normal({})], policy);
    const withSurcharge = priceQuotation([normal({}), surcharge], policy);
    expect(withSurcharge.actualMarginBp).toBe(without.actualMarginBp);
    // and the surcharge cost is carried in totalCost (pass-through, not free)
    expect(withSurcharge.totalCostUsdCents).toBe(100_000 + 250_000);
  });

  it('honors an explicit zero actual price (free line): total 0, margin unknown, no flag', () => {
    const line = { ...normal({}), actualUnitUsdCents: 0 };
    const r = priceQuotation([line], policy);
    expect(r.actualTotalUsdCents).toBe(0);
    expect(r.actualMarginBp).toBeNull();
    expect(r.belowMinMargin).toBe(false);
  });

  it('flags below-minimum margin but never blocks', () => {
    const line = { ...normal({}), actualUnitUsdCents: 110_000 }; // ≈9.1%
    const r = priceQuotation([line], policy);
    expect(r.belowMinMargin).toBe(true);
  });
});
