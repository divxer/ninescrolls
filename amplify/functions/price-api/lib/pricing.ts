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
  if (line.sku in p.itemOverrides) return p.itemOverrides[line.sku];
  if (line.series in p.seriesOverrides) return p.seriesOverrides[line.series];
  return p.defaultMarginBp;
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

  const totalCostUsdCents = incomplete ? null
    : sum(({ line, r }) => (r.unitCostUsdCents == null ? (line.lineType === 'SURCHARGE' ? 0 : null) : r.unitCostUsdCents * line.qty));
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

  let actualMarginBp: number | null = null;
  if (actualTotalUsdCents != null && totalCostUsdCents != null && actualTotalUsdCents > 0) {
    actualMarginBp = Math.round(((actualTotalUsdCents - totalCostUsdCents) * 10_000) / actualTotalUsdCents);
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
