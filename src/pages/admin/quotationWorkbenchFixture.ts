import type {
  CatalogItem,
  QuotationLineSnapshot,
  QuotationSummary,
} from "../../services/priceAdminService";

const timestamp = "2026-07-14T12:00:00.000Z";

const item = (
  itemId: string,
  sku: string,
  name: string,
  series: string,
  kind: CatalogItem["kind"],
  specs: Record<string, string> = {}
): CatalogItem => ({
  itemId,
  sku,
  name,
  series,
  kind,
  specs,
  requiredOptionSkus: [],
  requiresSkus: [],
  excludesSkus: [],
  createdAt: timestamp,
  updatedAt: timestamp,
});

export const quotationFixtureCatalog: CatalogItem[] = [
  item("fixture-machine", "ICP-RIE-300", "ICP-RIE 300 Advanced Platform", "ICP-RIE", "MACHINE", { chamber: "300 mm", supplierCode: "NS-RIE300" }),
  item("fixture-bias", "OPT-RF-BIAS", "Independent RF Bias Generator", "ICP-RIE", "OPTION", { supplierCode: "RF-13M56" }),
  item("fixture-loadlock", "OPT-LL-AUTO", "Automated Load Lock", "ICP-RIE", "OPTION", { supplierCode: "LL-200" }),
  item("fixture-endpoint", "OPT-OES", "Optical Emission Endpoint", "ICP-RIE", "OPTION", { supplierCode: "OES-6CH" }),
  item("fixture-install", "SVC-INSTALL", "On-site Installation & Qualification", "FIELD", "SERVICE"),
  item("fixture-training", "SVC-TRAIN", "Process Training — 3 Days", "FIELD", "SERVICE"),
];

const snapshotLine = (
  catalogIndex: number,
  lineNo: number,
  values: Partial<QuotationLineSnapshot>
): QuotationLineSnapshot => {
  const catalogItem = quotationFixtureCatalog[catalogIndex];
  return {
    lineNo,
    itemId: catalogItem.itemId,
    sku: catalogItem.sku,
    name: catalogItem.name,
    series: catalogItem.series,
    kind: catalogItem.kind,
    specs: catalogItem.specs,
    qty: 1,
    lineType: "NORMAL",
    unitCostFen: 1,
    previousUnitCostFen: 1,
    costDeltaFen: 0,
    costStatus: "ACTIVE",
    costSnapshot: {
      supplierId: "FIXTURE-SUPPLIER",
      unitCostFen: 1,
      currency: "RMB",
      effectiveFrom: "2026-06-01",
      effectiveTo: "2027-05-31",
      priceSource: "SUPPLIER_EXCEL",
      reviewStatus: "APPROVED",
    },
    fxRmbPerUsdMilli: 7240,
    marginBpApplied: 3800,
    unitCostUsdCents: 1,
    suggestedUnitUsdCents: 1,
    actualUnitUsdCents: 1,
    overrideReason: null,
    overriddenBy: null,
    overriddenAt: null,
    actualLineTotalUsdCents: 1,
    ...values,
  };
};

export const quotationFixtureSnapshot: QuotationSummary = {
  quotationNumber: "Q-FIXTURE-2026-0017",
  version: 2,
  revision: 4,
  status: "DRAFT",
  schemeLabel: "Research Institution — FY2026",
  customerName: "Caltech Kavli Nanoscience Institute",
  rfqId: "RFQ-FIXTURE-1042",
  policySnapshot: {
    fxRmbPerUsdMilli: 7240,
    defaultMarginBp: 3800,
    minMarginBp: 2500,
    roundingGranularityUsdCents: 100,
    seriesOverrides: {},
    itemOverrides: {},
  },
  validUntil: "2026-08-14",
  totalCostUsdCents: 51972300,
  suggestedTotalUsdCents: 83826200,
  actualTotalUsdCents: 85250000,
  actualMarginBp: 3681,
  belowMinMargin: false,
  incomplete: true,
  lineCount: 5,
  createdAt: timestamp,
  updatedAt: timestamp,
  lines: [
    snapshotLine(0, 1, { unitCostFen: 286480000, previousUnitCostFen: 279000000, costDeltaFen: 7480000, unitCostUsdCents: 39569000, suggestedUnitUsdCents: 63821000, actualUnitUsdCents: 62500000, actualLineTotalUsdCents: 62500000 }),
    snapshotLine(1, 2, { unitCostFen: 42800000, previousUnitCostFen: 40500000, costDeltaFen: 2300000, costStatus: "EXPIRING", unitCostUsdCents: 5911600, suggestedUnitUsdCents: 9534800, actualUnitUsdCents: 9400000, actualLineTotalUsdCents: 9400000, costSnapshot: { supplierId: "FIXTURE-RF", unitCostFen: 42800000, currency: "RMB", effectiveFrom: "2025-08-01", effectiveTo: "2026-07-31", priceSource: "SUPPLIER_LINK", reviewStatus: "APPROVED" } }),
    snapshotLine(2, 3, { unitCostFen: 32300000, previousUnitCostFen: 31000000, costDeltaFen: 1300000, unitCostUsdCents: 4461300, suggestedUnitUsdCents: 7195600, actualUnitUsdCents: 7100000, actualLineTotalUsdCents: 7100000 }),
    snapshotLine(3, 4, { unitCostFen: 14700000, previousUnitCostFen: 15100000, costDeltaFen: -400000, unitCostUsdCents: 2030400, suggestedUnitUsdCents: 3274800, actualUnitUsdCents: 3250000, actualLineTotalUsdCents: 3250000 }),
    snapshotLine(4, 5, { unitCostFen: null, previousUnitCostFen: null, costDeltaFen: null, costStatus: "MISSING", costSnapshot: null, unitCostUsdCents: null, suggestedUnitUsdCents: null, actualUnitUsdCents: 3000000, actualLineTotalUsdCents: 3000000, marginBpApplied: null }),
  ],
};
