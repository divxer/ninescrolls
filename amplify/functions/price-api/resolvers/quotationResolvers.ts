import { GetCommand, QueryCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../lib/dynamodb.js';
import { formatQuotationNumber, versionSk, lineSk } from '../lib/ids.js';
import { priceLine, priceQuotation, type PolicyData, type EngineLineInput } from '../lib/pricing.js';
import { allocateTotalOverride } from '../lib/allocation.js';
import { validateConfiguration, type ConfigItem } from '../lib/compatibility.js';
import { selectEffectiveCost } from './costVersionResolvers.js';
import { DEFAULT_POLICY } from './policyResolvers.js';
import { parseInput, getOperator, type PriceApiEvent } from '../lib/types.js';

export const MAX_LINES = 45; // spec invariant 3: full-replacement edit must fit 100 tx actions

export interface QuotationLineInput {
  itemId?: string;               // required for NORMAL lines
  sku?: string;                  // SURCHARGE lines: free-form label (FREIGHT, TARIFF, INSTALL, WARRANTY)
  qty: number;
  lineType: 'NORMAL' | 'SURCHARGE';
  surchargeUsdCents?: number;
  actualUnitUsdCents?: number;
  overrideReason?: string;
}

export interface CreateQuotationInput {
  rfqId?: string;
  schemeLabel: string;
  customerName: string;
  currency?: 'USD';
  validUntil?: string;
  tradeTerms?: string;
  paymentTerms?: string;
  lines: QuotationLineInput[];
  totalOverride?: { totalUsdCents: number; reason: string };
  notes?: string;
}

interface LoadedLine {
  input: QuotationLineInput;
  engine: EngineLineInput;
  snapshot: Record<string, unknown>; // catalog + cost snapshot fields
  configItem?: ConfigItem;
}

/**
 * Pure, synchronous shape/field validation for quotation lines — cap, duplicate
 * itemIds, per-line qty/override/surcharge checks. Deliberately does NO I/O so it
 * can run BEFORE any DynamoDB read (pbCreateQuotationDraft calls it ahead of
 * loadPolicy) and is re-run at the top of loadLines so loadLines stays safe to
 * call standalone (Task 12 reuses it for edits).
 */
export function validateLineInputs(lines: QuotationLineInput[]): void {
  if (lines.length === 0) throw new Error('VALIDATION: at least one line is required');
  if (lines.length > MAX_LINES) throw new Error(`VALIDATION: a quotation is capped at ${MAX_LINES} lines`);
  const normalIds = lines.filter((l) => l.lineType === 'NORMAL').map((l) => l.itemId);
  if (new Set(normalIds).size !== normalIds.length) {
    // Duplicate itemIds would let per-line maxQuantity checks under-count the
    // aggregate quantity (money-math review finding) — merge quantities instead.
    throw new Error('VALIDATION: duplicate catalog items — merge quantities into one line');
  }
  for (const input of lines) {
    if (!Number.isInteger(input.qty) || input.qty < 1) {
      throw new Error('VALIDATION: qty must be a positive integer');
    }
    if (input.actualUnitUsdCents !== undefined) {
      if (!Number.isInteger(input.actualUnitUsdCents) || input.actualUnitUsdCents < 0) {
        throw new Error('VALIDATION: manual price override must be a non-negative integer (USD cents)');
      }
      if (!input.overrideReason?.trim()) {
        throw new Error('VALIDATION: a manual price override requires a reason');
      }
    }
    if (input.lineType === 'SURCHARGE') {
      if (!input.sku?.trim()) throw new Error('VALIDATION: surcharge lines need a sku label');
      if (input.surchargeUsdCents == null || !Number.isInteger(input.surchargeUsdCents) || input.surchargeUsdCents < 0) {
        throw new Error('VALIDATION: surcharge lines need surchargeUsdCents as a non-negative integer');
      }
    } else if (!input.itemId) {
      throw new Error('VALIDATION: NORMAL lines require itemId');
    }
  }
}

export async function loadPolicy(): Promise<PolicyData> {
  const r = await docClient.send(new GetCommand({
    TableName: TABLE_NAME(), Key: { PK: 'PRICING_POLICY', SK: 'META' },
  }));
  if (!r.Item) return { ...DEFAULT_POLICY };
  const { PK, SK, ...rest } = r.Item;
  return { ...DEFAULT_POLICY, ...(rest as Partial<PolicyData>) };
}

/**
 * Loads catalog META + cost versions for every NORMAL line (one strongly
 * consistent, pagination-exhausted base-table Query per item — the item
 * partition holds META + COST# rows together), applies the effective-cost
 * selection rule, and builds engine inputs + audit-complete snapshots.
 */
export async function loadLines(lines: QuotationLineInput[]): Promise<LoadedLine[]> {
  validateLineInputs(lines);
  const today = new Date().toISOString().slice(0, 10);
  const soon = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);

  return Promise.all(lines.map(async (input): Promise<LoadedLine> => {
    if (input.lineType === 'SURCHARGE') {
      return {
        input,
        engine: {
          sku: input.sku!, series: 'SURCHARGE', qty: input.qty, lineType: 'SURCHARGE',
          unitCostFen: null, surchargeUsdCents: input.surchargeUsdCents,
          actualUnitUsdCents: input.actualUnitUsdCents ?? null,
        },
        snapshot: { sku: input.sku, name: input.sku, series: 'SURCHARGE', kind: 'SERVICE' },
      };
    }
    // Money-bearing read: STRONGLY CONSISTENT and pagination-exhausted, or a
    // just-written cost (or one beyond 1 MB) could silently misprice the quote.
    const rows: Record<string, unknown>[] = [];
    let lek: Record<string, unknown> | undefined;
    do {
      const r = await docClient.send(new QueryCommand({
        TableName: TABLE_NAME(),
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: { ':pk': `PCAT#${input.itemId}` },
        ConsistentRead: true,
        ExclusiveStartKey: lek,
      }));
      rows.push(...(r.Items ?? []));
      lek = r.LastEvaluatedKey as Record<string, unknown> | undefined;
    } while (lek);
    const meta = rows.find((it) => it.SK === 'META');
    if (!meta) throw new Error(`NOT_FOUND: catalog item ${input.itemId}`);
    const versions = rows.filter(
      (it) => typeof it.SK === 'string' && (it.SK as string).startsWith('COST#'),
    ) as unknown as Array<{
      supplierId: string; unitCostFen: number; currency: string;
      effectiveFrom: string; effectiveTo: string;
      priceSource: string; reviewStatus: string;
    }>;
    const effective = selectEffectiveCost(versions, today);
    return {
      input,
      engine: {
        sku: meta.sku as string, series: meta.series as string, qty: input.qty, lineType: 'NORMAL',
        unitCostFen: effective?.unitCostFen ?? null,
        actualUnitUsdCents: input.actualUnitUsdCents ?? null,
      },
      snapshot: {
        itemId: meta.itemId, sku: meta.sku, name: meta.name, series: meta.series, kind: meta.kind,
        specs: meta.specs, unitCostFen: effective?.unitCostFen ?? null,
        costStatus: effective ? (effective.effectiveTo <= soon ? 'EXPIRING' : 'ACTIVE') : 'MISSING',
        // Full cost provenance — the snapshot must be audit-complete (spec:
        // "quotation stores the point-in-time snapshot"): who supplied the cost,
        // which CostVersion (its interval IS its identity), currency, source, review state.
        costSnapshot: effective ? {
          supplierId: effective.supplierId,
          unitCostFen: effective.unitCostFen,
          currency: effective.currency,
          effectiveFrom: effective.effectiveFrom,
          effectiveTo: effective.effectiveTo,
          priceSource: effective.priceSource,
          reviewStatus: effective.reviewStatus,
        } : null,
      },
      configItem: {
        sku: meta.sku as string, kind: meta.kind as ConfigItem['kind'],
        requiredOptionSkus: (meta.requiredOptionSkus as string[]) ?? [],
        requiresSkus: (meta.requiresSkus as string[]) ?? [],
        excludesSkus: (meta.excludesSkus as string[]) ?? [],
        maxQuantity: meta.maxQuantity as number | undefined,
      },
    };
  }));
}

/**
 * Prices loaded lines, applies the optional total override, returns line rows + summary.
 *
 * Reconciliation invariant (header ≡ lines): `summary.actualTotalUsdCents` is ALWAYS
 * exactly the sum of `lineRows[*].actualLineTotalUsdCents` (or null when unknown).
 * The rounded suggested total is ADVISORY — adopting it means submitting it as a
 * total override, which re-allocates and keeps the invariant. Amounts are stored
 * as line totals; a per-unit "actual" is NOT derived when qty > 1 (it may not
 * divide evenly) — the manual unit override, if any, is preserved verbatim as audit.
 *
 * Margin semantics (locked in the Tasks 3-6 review round): actualMarginBp is
 * computed over MARGIN-BEARING (NORMAL) lines only — same basis the pricing
 * policy uses to price them. Surcharges are pass-through (revenue ≡ cost) and
 * must neither dilute nor inflate the below-min-margin warning.
 */
export function buildSnapshot(
  loaded: LoadedLine[],
  policy: PolicyData,
  operator: string,
  totalOverride?: { totalUsdCents: number; reason: string },
) {
  const configErrors = validateConfiguration(
    loaded.filter((l) => l.configItem).map((l) => ({ item: l.configItem!, qty: l.input.qty })),
  );
  if (configErrors.length) throw new Error(`VALIDATION: ${configErrors.join('; ')}`);
  if (totalOverride && !totalOverride.reason?.trim()) {
    throw new Error('VALIDATION: a total override requires a reason');
  }

  const engines = loaded.map((l) => l.engine);
  const perLine = engines.map((e) => priceLine(e, policy));
  const now = new Date().toISOString();

  let lineTotals: Array<number | null>;
  if (totalOverride) {
    // Spec: allocation weights are the SUGGESTED line totals — never the
    // manually adjusted prices (that would let one override skew everyone's share).
    const allocated = allocateTotalOverride(
      engines.map((e, i) => ({
        sku: e.sku, lineType: e.lineType,
        suggestedLineTotalUsdCents:
          perLine[i].suggestedUnitUsdCents == null ? null : perLine[i].suggestedUnitUsdCents! * e.qty,
      })),
      totalOverride.totalUsdCents,
    );
    lineTotals = allocated.map((a) => a.actualLineTotalUsdCents);
  } else {
    lineTotals = engines.map((e, i) => {
      const unit = e.actualUnitUsdCents ?? perLine[i].suggestedUnitUsdCents;
      return unit == null ? null : unit * e.qty;
    });
  }

  const summary = priceQuotation(engines, policy);
  // Header total = exact line-total sum (reconciliation invariant). With an
  // override, Σ allocated ≡ override total by the largest-remainder construction.
  const actualTotalUsdCents = lineTotals.some((t) => t == null)
    ? null
    : (lineTotals as number[]).reduce((s, t) => s + t, 0);
  // NORMAL-lines-only margin (see docstring).
  let normalRevenue: number | null = 0;
  let normalCost: number | null = 0;
  engines.forEach((e, i) => {
    if (e.lineType !== 'NORMAL') return;
    const lt = lineTotals[i];
    const uc = perLine[i].unitCostUsdCents;
    normalRevenue = normalRevenue == null || lt == null ? null : normalRevenue + lt;
    normalCost = normalCost == null || uc == null ? null : normalCost + uc * e.qty;
  });
  const actualMarginBp = normalRevenue != null && normalCost != null && normalRevenue > 0
    ? Math.round(((normalRevenue - normalCost) * 10_000) / normalRevenue)
    : null;

  const lineRows = loaded.map((l, i) => ({
    lineNo: i + 1,
    ...l.snapshot,
    qty: l.input.qty,
    lineType: l.input.lineType,
    surchargeUsdCents: l.input.surchargeUsdCents,
    fxRmbPerUsdMilli: policy.fxRmbPerUsdMilli,
    marginBpApplied: perLine[i].marginBpApplied,
    unitCostUsdCents: perLine[i].unitCostUsdCents,
    suggestedUnitUsdCents: perLine[i].suggestedUnitUsdCents,
    actualUnitUsdCents: l.input.actualUnitUsdCents ?? null,
    overrideReason: l.input.overrideReason ?? null,
    // Override audit: reason alone is not audit-complete — record who and when.
    overriddenBy: l.input.actualUnitUsdCents != null ? operator : null,
    overriddenAt: l.input.actualUnitUsdCents != null ? now : null,
    actualLineTotalUsdCents: lineTotals[i],
  }));

  return {
    lineRows,
    summary: {
      totalCostUsdCents: summary.totalCostUsdCents,
      suggestedTotalRawUsdCents: summary.suggestedTotalRawUsdCents,
      suggestedTotalUsdCents: summary.suggestedTotalUsdCents,
      actualTotalUsdCents,
      actualMarginBp,
      belowMinMargin: actualMarginBp != null && actualMarginBp < policy.minMarginBp,
      incomplete: summary.incomplete,
      totalOverride: totalOverride
        ? { ...totalOverride, overriddenBy: operator, overriddenAt: now }
        : null,
    },
  };
}

export const mapTxError = (e: unknown, what: string): never => {
  if ((e as Error).name === 'TransactionCanceledException') {
    throw new Error(`CONFLICT: concurrent ${what} — refresh and retry`);
  }
  throw e;
};

export async function pbCreateQuotationDraft(event: PriceApiEvent) {
  const input = parseInput<CreateQuotationInput>(event);
  if (!input.schemeLabel?.trim()) throw new Error('VALIDATION: schemeLabel is required');
  if (!input.customerName?.trim()) throw new Error('VALIDATION: customerName is required');
  validateLineInputs(input.lines ?? []);

  const policy = await loadPolicy();
  const loaded = await loadLines(input.lines ?? []);
  const operator = getOperator(event);
  const { lineRows, summary } = buildSnapshot(loaded, policy, operator, input.totalOverride);

  // Spec invariant 1 — number allocation is read-then-CAS, with explicit
  // first-creation semantics for a new year's counter.
  const now = new Date().toISOString();
  const year = Number(now.slice(0, 4));
  const counterKey = { PK: 'COUNTER#QUOTATION', SK: `YEAR#${year}` };
  const counterRes = await docClient.send(new GetCommand({
    TableName: TABLE_NAME(), Key: counterKey, ConsistentRead: true,
  }));
  const current = counterRes.Item?.seq as number | undefined;
  const next = (current ?? 0) + 1;
  const quotationNumber = formatQuotationNumber(year, next);
  const pk = `PQUO#${quotationNumber}`;

  const counterOp = current === undefined
    ? {
      Update: {
        TableName: TABLE_NAME(), Key: counterKey,
        UpdateExpression: 'SET seq = :next',
        ConditionExpression: 'attribute_not_exists(PK)',
        ExpressionAttributeValues: { ':next': next },
      },
    }
    : {
      Update: {
        TableName: TABLE_NAME(), Key: counterKey,
        UpdateExpression: 'SET seq = :next',
        ConditionExpression: 'seq = :expected',
        ExpressionAttributeValues: { ':next': next, ':expected': current },
      },
    };

  const header = {
    PK: pk, SK: versionSk(1),
    GSI1PK: 'QUOTATIONS', GSI1SK: `${now}#${quotationNumber}#v1`,
    quotationNumber, version: 1, revision: 1, status: 'DRAFT',
    schemeLabel: input.schemeLabel.trim(), customerName: input.customerName.trim(),
    rfqId: input.rfqId ?? null, currency: input.currency ?? 'USD',
    validUntil: input.validUntil ?? null, tradeTerms: input.tradeTerms ?? null,
    paymentTerms: input.paymentTerms ?? null, notes: input.notes ?? null,
    policySnapshot: {
      fxRmbPerUsdMilli: policy.fxRmbPerUsdMilli, defaultMarginBp: policy.defaultMarginBp,
      minMarginBp: policy.minMarginBp, roundingGranularityUsdCents: policy.roundingGranularityUsdCents,
    },
    ...summary,
    lineCount: lineRows.length,
    createdAt: now, updatedAt: now, createdBy: operator,
  };

  try {
    await docClient.send(new TransactWriteCommand({
      TransactItems: [
        counterOp,
        {
          Put: {
            TableName: TABLE_NAME(),
            Item: {
              PK: pk, SK: 'SCHEME',
              GSI1PK: `RFQ_QUOTES#${input.rfqId ?? 'NONE'}`, GSI1SK: `${now}#${quotationNumber}`,
              quotationNumber, schemeLabel: input.schemeLabel.trim(),
              rfqId: input.rfqId ?? null, customerName: input.customerName.trim(),
              latestVersion: 1, createdAt: now,
              // acceptedVersion is deliberately ABSENT — P2's accept transaction
              // conditions on attribute_not_exists(acceptedVersion) (spec inv. 4).
            },
            ConditionExpression: 'attribute_not_exists(PK)',
          },
        },
        { Put: { TableName: TABLE_NAME(), Item: header, ConditionExpression: 'attribute_not_exists(PK)' } },
        ...lineRows.map((row) => ({
          Put: {
            TableName: TABLE_NAME(),
            Item: { PK: pk, SK: lineSk(1, row.lineNo), quotationNumber, version: 1, ...row },
          },
        })),
      ],
    }));
  } catch (e) {
    mapTxError(e, 'quotation number allocation');
  }

  const { PK, SK, GSI1PK, GSI1SK, ...headerOut } = header;
  return { ...headerOut, lines: lineRows };
}

interface UpdateQuotationInput {
  quotationNumber: string;
  version: number;
  expectedRevision: number;
  customerName?: string;
  validUntil?: string; tradeTerms?: string; paymentTerms?: string; notes?: string;
  lines: QuotationLineInput[];
  totalOverride?: { totalUsdCents: number; reason: string };
}

export async function pbUpdateQuotationDraft(event: PriceApiEvent) {
  const input = parseInput<UpdateQuotationInput>(event);
  if (!input.quotationNumber || !input.version || !input.expectedRevision) {
    throw new Error('VALIDATION: quotationNumber, version and expectedRevision are required');
  }
  const pk = `PQUO#${input.quotationNumber}`;
  const sk = versionSk(input.version);

  const headerRes = await docClient.send(new GetCommand({
    TableName: TABLE_NAME(), Key: { PK: pk, SK: sk }, ConsistentRead: true,
  }));
  const header = headerRes.Item;
  if (!header) throw new Error(`NOT_FOUND: quotation ${input.quotationNumber} v${input.version}`);
  if (header.status !== 'DRAFT') {
    // Spec mutability boundary: versions freeze at DRAFT -> GENERATED.
    throw new Error('VALIDATION: only DRAFT versions are editable — later changes copy into a new version (P2)');
  }

  const policy = await loadPolicy();
  const loaded = await loadLines(input.lines ?? []);
  const { lineRows, summary } = buildSnapshot(loaded, policy, getOperator(event), input.totalOverride);

  const now = new Date().toISOString();
  const newRevision = input.expectedRevision + 1;
  const oldCount = (header.lineCount as number) ?? 0;
  const scalarPatch: Record<string, unknown> = {
    customerName: input.customerName?.trim() ?? header.customerName,
    validUntil: input.validUntil ?? header.validUntil ?? null,
    tradeTerms: input.tradeTerms ?? header.tradeTerms ?? null,
    paymentTerms: input.paymentTerms ?? header.paymentTerms ?? null,
    notes: input.notes ?? header.notes ?? null,
  };

  const sets: string[] = [
    'revision = :rev', 'updatedAt = :now', 'lineCount = :lc', 'GSI1SK = :gsk',
    ...Object.keys(scalarPatch).map((k) => `#${k} = :${k}`),
    ...Object.keys(summary).map((k) => `#s_${k} = :s_${k}`),
  ];
  const names: Record<string, string> = {
    '#status': 'status',
    ...Object.fromEntries(Object.keys(scalarPatch).map((k) => [`#${k}`, k])),
    ...Object.fromEntries(Object.keys(summary).map((k) => [`#s_${k}`, k])),
  };
  const values: Record<string, unknown> = {
    ':rev': newRevision, ':now': now, ':lc': lineRows.length,
    ':gsk': `${now}#${input.quotationNumber}#v${input.version}`,
    ':expected': input.expectedRevision, ':draft': 'DRAFT',
    ...Object.fromEntries(Object.entries(scalarPatch).map(([k, v]) => [`:${k}`, v])),
    ...Object.fromEntries(Object.entries(summary).map(([k, v]) => [`:s_${k}`, v ?? null])),
  };

  try {
    await docClient.send(new TransactWriteCommand({
      TransactItems: [
        {
          Update: {
            TableName: TABLE_NAME(), Key: { PK: pk, SK: sk },
            UpdateExpression: `SET ${sets.join(', ')}`,
            ConditionExpression: 'revision = :expected AND #status = :draft',
            ExpressionAttributeNames: names,
            ExpressionAttributeValues: values,
          },
        },
        // Overwrite lines 1..N (single Put per key — never Delete+Put of the same key).
        ...lineRows.map((row) => ({
          Put: {
            TableName: TABLE_NAME(),
            Item: { PK: pk, SK: lineSk(input.version, row.lineNo), quotationNumber: input.quotationNumber, version: input.version, ...row },
          },
        })),
        // Delete only the tail beyond the new count.
        ...Array.from({ length: Math.max(0, oldCount - lineRows.length) }, (_, i) => ({
          Delete: {
            TableName: TABLE_NAME(),
            Key: { PK: pk, SK: lineSk(input.version, lineRows.length + i + 1) },
          },
        })),
      ],
    }));
  } catch (e) {
    mapTxError(e, 'draft edit (stale revision or state change)');
  }

  return {
    quotationNumber: input.quotationNumber, version: input.version, revision: newRevision,
    status: 'DRAFT', ...scalarPatch, ...summary, lineCount: lineRows.length,
    updatedAt: now, lines: lineRows,
  };
}

export async function pbGetQuotation(event: PriceApiEvent) {
  const { quotationNumber } = parseInput<{ quotationNumber: string }>(event);
  if (!quotationNumber) throw new Error('VALIDATION: quotationNumber is required');
  const rows: Record<string, unknown>[] = [];
  let key: Record<string, unknown> | undefined;
  do {
    const r = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME(),
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: { ':pk': `PQUO#${quotationNumber}` },
      ExclusiveStartKey: key,
    }));
    rows.push(...(r.Items ?? []));
    key = r.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (key);
  if (!rows.length) throw new Error(`NOT_FOUND: quotation ${quotationNumber}`);

  const strip = (it: Record<string, unknown>) => {
    const { PK, SK, GSI1PK, GSI1SK, ...rest } = it;
    return rest;
  };
  const scheme = rows.find((it) => it.SK === 'SCHEME');
  const headers = rows.filter((it) => /^V#\d{3}$/.test(it.SK as string));
  const lines = rows.filter((it) => /^V#\d{3}#LINE#/.test(it.SK as string));
  return {
    scheme: scheme ? strip(scheme) : null,
    versions: headers
      .sort((a, b) => (a.SK as string).localeCompare(b.SK as string))
      .map((h) => ({
        ...strip(h),
        lines: lines
          .filter((l) => (l.SK as string).startsWith(`${h.SK}#LINE#`))
          .sort((a, b) => (a.SK as string).localeCompare(b.SK as string))
          .map(strip),
      })),
  };
}

export async function pbListQuotations(event: PriceApiEvent) {
  const { limit = 50, nextToken } = (event.arguments ?? {}) as { limit?: number; nextToken?: string | null };
  const effectiveLimit = Math.min(Math.max(limit || 50, 1), 200);
  const startKey = nextToken ? JSON.parse(Buffer.from(nextToken, 'base64').toString()) : undefined;
  const r = await docClient.send(new QueryCommand({
    TableName: TABLE_NAME(),
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk',
    ExpressionAttributeValues: { ':pk': 'QUOTATIONS' },
    ScanIndexForward: false,
    ExclusiveStartKey: startKey,
    Limit: effectiveLimit,
  }));
  const strip = (it: Record<string, unknown>) => {
    const { PK, SK, GSI1PK, GSI1SK, ...rest } = it;
    return rest;
  };
  return {
    items: (r.Items ?? []).map(strip),
    nextToken: r.LastEvaluatedKey ? Buffer.from(JSON.stringify(r.LastEvaluatedKey)).toString('base64') : null,
  };
}
