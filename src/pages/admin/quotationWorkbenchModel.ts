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
    ? `item:${line.itemId}`
    : `surcharge:${line.lineNo}:${line.name}`,
  itemId: line.itemId,
  sku: line.sku,
  qty: line.qty,
  lineType: line.lineType,
  surchargeUsdCents: line.surchargeUsdCents,
  actualUnitUsdCents: line.actualUnitUsdCents ?? undefined,
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
  0;

export function preview(lines: DraftLine[]) {
  const actuals = lines.map((line) => lineActual(line) * line.qty);
  const actualTotal = actuals.reduce((sum, value) => sum + value, 0);
  const costTotal = lines.reduce(
    (sum, line) => sum + (line.snapshot?.unitCostUsdCents ?? 0) * line.qty,
    0
  );
  const suggestedTotal = lines.reduce(
    (sum, line) =>
      sum +
      (line.snapshot?.suggestedUnitUsdCents ?? line.surchargeUsdCents ?? 0) *
        line.qty,
    0
  );
  const raw = actuals.map((value) =>
    actualTotal ? (value * 100) / actualTotal : 0
  );
  const shares = raw.map(Math.floor);
  let remainder = actualTotal
    ? 100 - shares.reduce((sum, value) => sum + value, 0)
    : 0;
  raw
    .map((value, index) => ({ index, fraction: value - shares[index] }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index)
    .forEach(({ index }) => {
      if (remainder > 0) {
        shares[index] += 1;
        remainder -= 1;
      }
    });
  return { actualTotal, costTotal, suggestedTotal, shares };
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

export const marginFor = (actualUnit: number, costUnit?: number | null) =>
  actualUnit > 0 && costUnit != null
    ? Math.round(((actualUnit - costUnit) / actualUnit) * 10000)
    : null;

export const toInput = ({
  key: _key,
  item: _item,
  snapshot: _snapshot,
  customLabel: _customLabel,
  ...line
}: DraftLine): QuotationLineInput => line;
