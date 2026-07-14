import type {
  CatalogItem,
  QuotationLineInput,
  QuotationLineSnapshot,
} from "../../services/priceAdminService";

export type DraftLine = QuotationLineInput & {
  key: string;
  item?: CatalogItem;
  snapshot?: QuotationLineSnapshot;
  customLabel?: string;
};

export const fromSnapshot = (line: QuotationLineSnapshot): DraftLine => ({
  key: line.itemId
    ? `item:${line.itemId}:${line.lineNo}`
    : `surcharge:${line.lineNo}:${line.name}`,
  itemId: line.itemId,
  sku: line.sku,
  qty: line.qty,
  lineType: line.lineType,
  surchargeUsdCents: line.surchargeUsdCents,
  ...(line.overriddenBy || line.overrideReason
    ? {
        actualUnitUsdCents: line.actualUnitUsdCents ?? undefined,
        overrideReason: line.overrideReason ?? undefined,
      }
    : {}),
  customLabel: line.lineType === "SURCHARGE" ? line.name : undefined,
  snapshot: line,
});

export const reconcileServerLines = (lines: QuotationLineSnapshot[]) =>
  lines.map(fromSnapshot);

export const lineActual = (line: DraftLine) =>
  line.actualUnitUsdCents ??
  line.snapshot?.actualUnitUsdCents ??
  line.snapshot?.suggestedUnitUsdCents ??
  line.surchargeUsdCents ??
  null;

export const lineActualTotal = (line: DraftLine) =>
  line.actualUnitUsdCents === undefined
    && line.snapshot?.actualLineTotalUsdCents != null
    && line.qty === line.snapshot.qty
    ? line.snapshot.actualLineTotalUsdCents
    : (() => {
        const unit = lineActual(line);
        return unit == null ? null : unit * line.qty;
      })();

export function preview(lines: DraftLine[]) {
  const actuals = lines.map(lineActualTotal);
  const sumKnown = (values: Array<number | null>) =>
    values.some((value) => value == null)
      ? null
      : (values as number[]).reduce((sum, value) => sum + value, 0);
  const actualTotal = sumKnown(actuals);
  const costs = lines.map((line) => {
    const unit = line.lineType === "SURCHARGE"
      ? line.surchargeUsdCents
      : line.snapshot?.unitCostUsdCents;
    return unit == null ? null : unit * line.qty;
  });
  const costTotal = sumKnown(costs);
  const suggestedTotal = sumKnown(lines.map((line) => {
    const unit = line.snapshot?.suggestedUnitUsdCents ?? line.surchargeUsdCents;
    return unit == null ? null : unit * line.qty;
  }));
  const raw = actuals.map((value) =>
    actualTotal && value != null ? (value * 100) / actualTotal : 0
  );
  const shares: Array<number | null> = actualTotal == null
    ? raw.map(() => null)
    : raw.map(Math.floor);
  let remainder = actualTotal
    ? 100 - shares.reduce<number>((sum, value) => sum + (value ?? 0), 0)
    : 0;
  raw
    .map((value, index) => ({ index, fraction: value - (shares[index] ?? 0) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index)
    .forEach(({ index }) => {
      if (remainder > 0) {
        shares[index] = (shares[index] ?? 0) + 1;
        remainder -= 1;
      }
    });
  let normalRevenue: number | null = 0;
  let normalCost: number | null = 0;
  lines.forEach((line, index) => {
    if (line.lineType !== "NORMAL") return;
    const cost = line.snapshot?.unitCostUsdCents;
    normalRevenue = normalRevenue == null || actuals[index] == null
      ? null
      : normalRevenue + actuals[index];
    normalCost = normalCost == null || cost == null
      ? null
      : normalCost + cost * line.qty;
  });
  const actualMarginBp = normalRevenue != null && normalCost != null && normalRevenue > 0
    ? Math.round(((normalRevenue - normalCost) * 10000) / normalRevenue)
    : null;
  return { actualTotal, costTotal, suggestedTotal, actualMarginBp, shares };
}

export const catalogMatches = (item: CatalogItem, query: string) => {
  const haystack = [
    item.name,
    item.sku,
    item.series,
    ...Object.values(item.specs ?? {}),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query.trim().toLowerCase());
};

export const marginFor = (actualUnit: number | null, costUnit?: number | null) =>
  actualUnit != null && actualUnit > 0 && costUnit != null
    ? Math.round(((actualUnit - costUnit) / actualUnit) * 10000)
    : null;

export const toInput = ({
  key: _key,
  item: _item,
  snapshot: _snapshot,
  customLabel: _customLabel,
  ...line
}: DraftLine): QuotationLineInput => line;
