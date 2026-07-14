/** Pure pricing engine. Integer minor units only (spec: "Pricing calculation"). */

export interface PolicyData {
  fxRmbPerUsdMilli: number;            // 7250 = 7.25 RMB per USD
  defaultMarginBp: number;             // margin ON SELLING PRICE, basis points
  minMarginBp: number;
  roundingGranularityUsdCents: number; // e.g. 10000 = $100
  seriesOverrides: Record<string, number>;
  itemOverrides: Record<string, number>;
}

export interface EngineLineInput {
  sku: string;
  series: string;
  qty: number;
  lineType: 'NORMAL' | 'SURCHARGE';
  unitCostFen: number | null;          // null = cost missing/expired-with-no-cover
  surchargeUsdCents?: number;          // SURCHARGE lines: pass-through USD amount
  actualUnitUsdCents?: number | null;  // manual override, if any
}

export interface PricedLine {
  unitCostUsdCents: number | null;
  marginBpApplied: number;
  suggestedUnitUsdCents: number | null;
}

export interface QuotationPricing {
  totalCostUsdCents: number | null;
  suggestedTotalRawUsdCents: number | null;
  suggestedTotalUsdCents: number | null; // rounded to granularity
  actualTotalUsdCents: number | null;    // sum of actual (or suggested) unit prices × qty
  actualMarginBp: number | null;
  belowMinMargin: boolean;
  incomplete: boolean;                   // any NORMAL line with unknown cost
}

const fenToUsdCents = (fen: number, fxMilli: number) => Math.round((fen * 1000) / fxMilli);

function resolveMarginBp(line: EngineLineInput, p: PolicyData): number {
  if (line.lineType === 'SURCHARGE') return 0; // cost pass-through by default (spec)
  const bp = line.sku in p.itemOverrides ? p.itemOverrides[line.sku]
    : line.series in p.seriesOverrides ? p.seriesOverrides[line.series]
    : p.defaultMarginBp;
  // Override maps arrive via a.json() with no schema; bp=10000 → Infinity price,
  // bp>10000 → silently negative price. Guard every source.
  if (!Number.isInteger(bp) || bp < 0 || bp >= 10_000) {
    throw new Error(`VALIDATION: margin ${bp}bp for ${line.sku} out of range [0, 10000)`);
  }
  return bp;
}

export function priceLine(line: EngineLineInput, p: PolicyData): PricedLine {
  const marginBpApplied = resolveMarginBp(line, p);
  if (line.lineType === 'SURCHARGE') {
    return {
      unitCostUsdCents: line.unitCostFen == null ? null : fenToUsdCents(line.unitCostFen, p.fxRmbPerUsdMilli),
      marginBpApplied,
      suggestedUnitUsdCents: line.surchargeUsdCents ?? null,
    };
  }
  if (line.unitCostFen == null) {
    // Missing cost is UNKNOWN, never zero (spec).
    return { unitCostUsdCents: null, marginBpApplied, suggestedUnitUsdCents: null };
  }
  const unitCostUsdCents = fenToUsdCents(line.unitCostFen, p.fxRmbPerUsdMilli);
  const suggestedUnitUsdCents = Math.round((unitCostUsdCents * 10_000) / (10_000 - marginBpApplied));
  return { unitCostUsdCents, marginBpApplied, suggestedUnitUsdCents };
}

export function priceQuotation(lines: EngineLineInput[], p: PolicyData): QuotationPricing {
  const priced = lines.map((l) => ({ line: l, r: priceLine(l, p) }));
  const incomplete = priced.some(({ line, r }) => line.lineType === 'NORMAL' && r.unitCostUsdCents == null);

  const sum = (f: (x: { line: EngineLineInput; r: PricedLine }) => number | null): number | null => {
    let total = 0;
    for (const x of priced) {
      const v = f(x);
      if (v == null) return null;
      total += v;
    }
    return total;
  };

  // SURCHARGE lines are cost pass-throughs (spec: "default cost pass-through, no
  // margin"): they contribute their explicit fen cost when present, else their own
  // pass-through amount — never 0, which would overstate margin on freight-heavy quotes.
  const totalCostUsdCents = incomplete ? null
    : sum(({ line, r }) => {
      if (line.lineType === 'SURCHARGE') {
        return (r.unitCostUsdCents ?? r.suggestedUnitUsdCents ?? 0) * line.qty;
      }
      return r.unitCostUsdCents == null ? null : r.unitCostUsdCents * line.qty;
    });
  const suggestedTotalRawUsdCents = incomplete ? null
    : sum(({ line, r }) => (r.suggestedUnitUsdCents == null ? null : r.suggestedUnitUsdCents * line.qty));

  const g = p.roundingGranularityUsdCents;
  const suggestedTotalUsdCents = suggestedTotalRawUsdCents == null ? null
    : Math.round(suggestedTotalRawUsdCents / g) * g;

  const actualTotalUsdCents = incomplete ? null
    : sum(({ line, r }) => {
      const unit = line.actualUnitUsdCents ?? r.suggestedUnitUsdCents;
      return unit == null ? null : unit * line.qty;
    });

  // Margin is measured over margin-bearing (NORMAL) revenue only: a surcharge
  // pass-through adds equal cost and revenue, so it must not dilute the metric
  // (surcharge lines are margin-neutral by construction).
  let actualMarginBp: number | null = null;
  if (!incomplete) {
    let normalRevenue = 0;
    let normalCost = 0;
    let known = true;
    for (const { line, r } of priced) {
      if (line.lineType !== 'NORMAL') continue;
      const unit = line.actualUnitUsdCents ?? r.suggestedUnitUsdCents;
      if (unit == null || r.unitCostUsdCents == null) { known = false; break; }
      normalRevenue += unit * line.qty;
      normalCost += r.unitCostUsdCents * line.qty;
    }
    if (known && normalRevenue > 0) {
      actualMarginBp = Math.round(((normalRevenue - normalCost) * 10_000) / normalRevenue);
    }
  }

  return {
    totalCostUsdCents,
    suggestedTotalRawUsdCents,
    suggestedTotalUsdCents,
    actualTotalUsdCents,
    actualMarginBp,
    belowMinMargin: actualMarginBp != null && actualMarginBp < p.minMarginBp,
    incomplete,
  };
}
