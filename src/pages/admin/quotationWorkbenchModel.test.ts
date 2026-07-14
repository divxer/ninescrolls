import { describe, expect, it } from "vitest";
import { preview, reconcileServerLines, toInput } from "./quotationWorkbenchModel";
import type { QuotationLineSnapshot } from "../../services/priceAdminService";

const line = (lineNo: number, overrides: Partial<QuotationLineSnapshot> = {}): QuotationLineSnapshot => ({
  lineNo, itemId: "same", sku: "SKU", name: "Item", series: "RIE", kind: "OPTION",
  qty: 1, lineType: "NORMAL", fxRmbPerUsdMilli: 7250, marginBpApplied: 3000,
  unitCostUsdCents: 100, suggestedUnitUsdCents: 200, actualUnitUsdCents: 200,
  overrideReason: null, overriddenBy: null, overriddenAt: null, actualLineTotalUsdCents: 200,
  ...overrides,
});

describe("quotationWorkbenchModel", () => {
  it("keeps required unknown values unknown in preview totals and margin", () => {
    const lines = reconcileServerLines([line(1), line(2, { unitCostUsdCents: null, suggestedUnitUsdCents: null, actualUnitUsdCents: null, actualLineTotalUsdCents: null })]);
    expect(preview(lines)).toMatchObject({ costTotal: null, suggestedTotal: null, actualTotal: null, actualMarginBp: null, shares: [null, null] });
  });

  it("creates unique reconciliation keys for historical duplicate item rows", () => {
    const lines = reconcileServerLines([line(1), line(2)]);
    expect(new Set(lines.map(({ key }) => key)).size).toBe(2);
  });

  it("keeps authoritative actual pricing for display without inventing an override", () => {
    const [draft] = reconcileServerLines([line(1)]);
    expect(draft.actualUnitUsdCents).toBeUndefined();
    expect(preview([draft]).actualTotal).toBe(200);
    expect(toInput(draft)).not.toHaveProperty("actualUnitUsdCents");
    expect(toInput(draft)).not.toHaveProperty("overrideReason");
  });

  it("round-trips a proven line-specific override", () => {
    const [draft] = reconcileServerLines([
      line(1, { actualUnitUsdCents: 175, overrideReason: "Negotiated", overriddenBy: "seller@example.com" }),
    ]);
    expect(toInput(draft)).toMatchObject({
      actualUnitUsdCents: 175,
      overrideReason: "Negotiated",
    });
  });
});
