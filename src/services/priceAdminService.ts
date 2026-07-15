import { getAmplifyDataClient } from './amplifyClient';

const client = getAmplifyDataClient;
const AUTH = { authMode: 'userPool' as const };

function unwrapPayload<T>(data: unknown): T {
  if (typeof data !== 'string') return data as T;
  return JSON.parse(data) as T;
}

type GqlResult = { data?: unknown; errors?: Array<{ message: string }> };

function unwrap<T>({ data, errors }: GqlResult): T {
  if (errors?.length) throw new Error(errors.map((error) => error.message).join(', '));
  return unwrapPayload<T>(data);
}

const asInput = (input: unknown) => ({ input: JSON.stringify(input) });

export interface Supplier {
  supplierId: string;
  name: string;
  contact?: string;
  currency: 'RMB';
  defaultValidityDays: number;
  status: 'ACTIVE' | 'SUSPENDED';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export const listSuppliers = async () =>
  unwrap<{ items: Supplier[] }>(await client().queries.pbListSuppliers(AUTH));

export const createSupplier = async (input: {
  name: string;
  contact?: string;
  defaultValidityDays?: number;
  notes?: string;
}) => unwrap<Supplier>(await client().mutations.pbCreateSupplier(asInput(input), AUTH));

export const updateSupplier = async (input: Partial<Supplier> & { supplierId: string }) =>
  unwrap<Supplier>(await client().mutations.pbUpdateSupplier(asInput(input), AUTH));

export interface CatalogItem {
  itemId: string;
  sku: string;
  name: string;
  series: string;
  kind: 'MACHINE' | 'OPTION' | 'CONSUMABLE' | 'SERVICE';
  specs?: Record<string, string>;
  requiredOptionSkus: string[];
  requiresSkus: string[];
  excludesSkus: string[];
  maxQuantity?: number;
  preferredSupplierId?: string;
  createdAt: string;
  updatedAt: string;
}

export const listCatalogItems = async () =>
  unwrap<{ items: CatalogItem[] }>(await client().queries.pbListCatalogItems(AUTH));

export const createCatalogItem = async (
  input: Omit<
    CatalogItem,
    'itemId' | 'createdAt' | 'updatedAt' | 'requiredOptionSkus' | 'requiresSkus' | 'excludesSkus'
  > & Partial<CatalogItem>,
) => unwrap<CatalogItem>(await client().mutations.pbCreateCatalogItem(asInput(input), AUTH));

export const updateCatalogItem = async (input: Omit<Partial<CatalogItem>, 'preferredSupplierId'> & { itemId: string; preferredSupplierId?: string | null }) =>
  unwrap<CatalogItem>(await client().mutations.pbUpdateCatalogItem(asInput(input), AUTH));

export interface CostVersion {
  itemId: string;
  supplierId: string;
  unitCostFen: number;
  currency: 'RMB';
  effectiveFrom: string;
  effectiveTo: string;
  priceSource: 'MANUAL_ENTRY' | 'SUPPLIER_EXCEL' | 'SUPPLIER_LINK';
  reviewStatus: 'APPROVED';
  createdAt: string;
  createdBy: string;
}

export const listCostVersions = async (itemId: string, supplierId?: string) =>
  unwrap<{ items: CostVersion[] }>(
    await client().queries.pbListCostVersions(asInput({ itemId, supplierId }), AUTH),
  );

export const appendCostVersion = async (
  input: Omit<CostVersion, 'currency' | 'reviewStatus' | 'createdAt' | 'createdBy'>,
) => unwrap<CostVersion>(await client().mutations.pbAppendCostVersion(asInput(input), AUTH));

export interface PricingPolicy {
  fxRmbPerUsdMilli: number;
  defaultMarginBp: number;
  minMarginBp: number;
  roundingGranularityUsdCents: number;
  seriesOverrides: Record<string, number>;
  itemOverrides: Record<string, number>;
  fxUpdatedAt?: string;
  updatedAt?: string;
}

export const getPricingPolicy = async () =>
  unwrap<PricingPolicy>(await client().queries.pbGetPricingPolicy(AUTH));

export const updatePricingPolicy = async (input: Partial<PricingPolicy>) =>
  unwrap<PricingPolicy>(await client().mutations.pbUpdatePricingPolicy(asInput(input), AUTH));

export interface QuotationLineInput {
  itemId?: string;
  sku?: string;
  qty: number;
  lineType: 'NORMAL' | 'SURCHARGE';
  surchargeUsdCents?: number;
  actualUnitUsdCents?: number;
  overrideReason?: string;
}

export interface QuotationCostSnapshot {
  supplierId: string;
  unitCostFen: number;
  currency: string;
  effectiveFrom: string;
  effectiveTo: string;
  priceSource: string;
  reviewStatus: string;
  [field: string]: unknown;
}

export interface QuotationLineSnapshot {
  lineNo: number;
  itemId?: string;
  sku: string;
  name: string;
  series: string;
  kind: CatalogItem['kind'];
  specs?: Record<string, string>;
  qty: number;
  lineType: QuotationLineInput['lineType'];
  surchargeUsdCents?: number;
  unitCostFen?: number | null;
  previousUnitCostFen?: number | null;
  costDeltaFen?: number | null;
  costStatus?: 'ACTIVE' | 'EXPIRING' | 'MISSING';
  costSnapshot?: QuotationCostSnapshot | null;
  fxRmbPerUsdMilli: number;
  marginBpApplied: number | null;
  unitCostUsdCents: number | null;
  suggestedUnitUsdCents: number | null;
  actualUnitUsdCents: number | null;
  overrideReason: string | null;
  overriddenBy: string | null;
  overriddenAt: string | null;
  actualLineTotalUsdCents: number | null;
  [field: string]: unknown;
}

export interface QuotationSummary {
  quotationNumber: string;
  version: number;
  revision: number;
  status: 'DRAFT';
  schemeLabel: string;
  customerName: string;
  rfqId?: string | null;
  policySnapshot?: Pick<
    PricingPolicy,
    'fxRmbPerUsdMilli' | 'defaultMarginBp' | 'minMarginBp' | 'roundingGranularityUsdCents' | 'seriesOverrides' | 'itemOverrides'
  > | null;
  totalOverride?: { totalUsdCents: number; reason: string; overriddenBy?: string; overriddenAt?: string } | null;
  totalCostUsdCents: number | null;
  suggestedTotalUsdCents: number | null;
  actualTotalUsdCents: number | null;
  actualMarginBp: number | null;
  belowMinMargin: boolean;
  incomplete: boolean;
  lineCount: number;
  createdAt: string;
  updatedAt: string;
  lines?: QuotationLineSnapshot[];
  [field: string]: unknown;
}

interface CreateQuotationDraftInput {
  rfqId?: string;
  schemeLabel: string;
  customerName: string;
  validUntil?: string;
  tradeTerms?: string;
  paymentTerms?: string;
  notes?: string;
  lines: QuotationLineInput[];
  totalOverride?: { totalUsdCents: number; reason: string };
}

export const createQuotationDraft = async (input: CreateQuotationDraftInput) =>
  unwrap<QuotationSummary>(
    await client().mutations.pbCreateQuotationDraft(asInput(input), AUTH),
  );

interface UpdateQuotationDraftInput {
  quotationNumber: string;
  version: number;
  expectedRevision: number;
  customerName?: string;
  validUntil?: string;
  tradeTerms?: string;
  paymentTerms?: string;
  notes?: string;
  lines: QuotationLineInput[];
  totalOverride?: { totalUsdCents: number; reason: string };
}

export const updateQuotationDraft = async (input: UpdateQuotationDraftInput) =>
  unwrap<QuotationSummary>(
    await client().mutations.pbUpdateQuotationDraft(asInput(input), AUTH),
  );

export interface QuotationScheme {
  quotationNumber: string;
  schemeLabel: string;
  customerName: string;
  rfqId?: string | null;
  latestVersion: number;
  createdAt: string;
  [field: string]: unknown;
}

export const getQuotation = async (quotationNumber: string) =>
  unwrap<{
    scheme: QuotationScheme | null;
    versions: Array<QuotationSummary & { lines: QuotationLineSnapshot[] }>;
  }>(await client().queries.pbGetQuotation(asInput({ quotationNumber }), AUTH));

export const listQuotations = async (opts: { limit?: number; nextToken?: string } = {}) =>
  unwrap<{ items: QuotationSummary[]; nextToken: string | null }>(
    await client().queries.pbListQuotations(opts, AUTH),
  );

export interface HistoricalQuotationSummary {
  historicalId: string;
  status: 'HISTORICAL';
  customerName: string;
  productName: string;
  configuration: string;
  supplierId: string;
  supplierQuoteText: string;
  customerQuoteText: string;
  sourceDocument: string;
  sourceDocumentHash: string;
  sourceRow: number;
  importBatchId: string;
  historicalFxProvenance: 'CONFIRMED' | 'INFERRED' | 'UNKNOWN';
  dataQualityFlags: Array<'INCOMPLETE' | 'UNCONFIRMED' | 'CONFLICT_RESOLVED'>;
  contentHash: string;
  importedAt: string;
}

export interface HistoricalQuotationDetail extends HistoricalQuotationSummary {
  supplierQuoteBasis: string;
  supplierEvidenceType: string;
  supplierQuotedAt: string | null;
  sourceQuotationNumber: string | null;
  quotedAt: string | null;
  legacyStatus: string;
  supplierAmountFen?: number | null;
  customerAmountUsdCents?: number | null;
  historicalFxRate: string | null;
  historicalFxSource: string | null;
  historicalFxNote: string | null;
  dataQualityNotes: string[];
  importedBy: string;
}

export interface HistoricalImportInput {
  importBatchId: string;
  sourceDocument: string;
  sourceDocumentHash: string;
  rows: Array<Record<string, unknown>>;
}
export interface HistoricalImportOutcome { historicalId: string; status: 'IMPORTED' | 'SKIPPED' | 'CONFLICT' | 'FAILED'; message?: string }
export interface HistoricalRollbackInput { importBatchId: string; mode: 'PREVIEW' | 'APPLY'; rollbackToken?: string; reason?: string }
export interface HistoricalRollbackPreview {
  matchedCount: number; deletableCount: number; blockedCount: number;
  historicalIds: string[]; sourceDocuments: string[]; warnings: string[]; rollbackToken: string;
}
export interface HistoricalRollbackOutcome { historicalId: string; status: 'DELETED' | 'ALREADY_ABSENT' | 'BLOCKED' | 'FAILED'; message?: string }
export interface HistoricalRollbackApply { results: HistoricalRollbackOutcome[] }
export type HistoricalRollbackResult = HistoricalRollbackPreview | HistoricalRollbackApply;

export const listHistoricalQuotations = async (opts: { limit?: number; nextToken?: string } = {}) =>
  unwrap<{ items: HistoricalQuotationSummary[]; nextToken: string | null }>(
    await client().queries.pbListHistoricalQuotations(opts, AUTH),
  );
export const getHistoricalQuotation = async (historicalId: string) =>
  unwrap<HistoricalQuotationDetail>(await client().queries.pbGetHistoricalQuotation(asInput({ historicalId }), AUTH));
export const importHistoricalQuotations = async (input: HistoricalImportInput) =>
  unwrap<HistoricalImportOutcome[]>(await client().mutations.pbImportHistoricalQuotations(asInput(input), AUTH));
export const rollbackHistoricalQuotationImport = async (input: HistoricalRollbackInput) =>
  unwrap<HistoricalRollbackResult>(await client().mutations.pbRollbackHistoricalQuotationImport(asInput(input), AUTH));

export const usd = (cents: number | null | undefined) =>
  cents == null
    ? '—'
    : `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

export const rmbFen = (fen: number | null | undefined) =>
  fen == null
    ? '—'
    : `¥${(fen / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;

export const marginPct = (bp: number | null | undefined) =>
  bp == null ? '—' : `${(bp / 100).toFixed(1)}%`;

/** Exact yuan-string to fen conversion; rejects imprecise/unsafe JS numbers. */
export function rmbToFen(value: string): number {
  const match = value.trim().match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) throw new Error('Invalid RMB amount: use up to two decimal places');
  const fen = BigInt(match[1]) * 100n + BigInt((match[2] ?? '').padEnd(2, '0') || '0');
  if (fen > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Invalid RMB amount: fen exceeds the safe integer limit');
  return Number(fen);
}
