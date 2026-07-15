import { DeleteCommand, GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { docClient, TABLE_NAME } from '../lib/dynamodb.js';
import { getOperator, parseInput, stripKeys, type PriceApiEvent } from '../lib/types.js';
import {
  buildHistoricalRecord,
  contentHashFor,
  historicalIdFor,
  rollbackTokenFor,
  validateHistoricalQuotationInput,
  type HistoricalQuotationInput,
  type HistoricalQuotationRecord,
} from '../lib/historicalQuotation.js';

const MAX_PAGE_SIZE = 200;
const HISTORICAL_ID_PATTERN = /^[a-f0-9]{64}$/;
const DOCUMENT_HASH_PATTERN = /^[a-f0-9]{64}$/;
export const MAX_IMPORT_ROWS = 50;
const stripHistoricalKeys = (item: Record<string, unknown>) => stripKeys(
  item as Record<string, unknown> & { PK: string; SK: string },
);

export async function pbListHistoricalQuotations(event: PriceApiEvent) {
  const { limit = 50, nextToken } = (event.arguments ?? {}) as {
    limit?: number;
    nextToken?: string | null;
  };
  const effectiveLimit = Math.min(Math.max(limit || 50, 1), MAX_PAGE_SIZE);
  let startKey: Record<string, unknown> | undefined;
  if (nextToken) {
    try {
      startKey = JSON.parse(Buffer.from(nextToken, 'base64').toString());
    } catch {
      throw new Error('VALIDATION: invalid nextToken');
    }
  }

  const result = await docClient.send(new QueryCommand({
    TableName: TABLE_NAME(),
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk',
    ExpressionAttributeValues: { ':pk': 'HISTORICAL_QUOTATIONS' },
    ScanIndexForward: false,
    ExclusiveStartKey: startKey,
    Limit: effectiveLimit,
  }));

  return {
    items: (result.Items ?? []).map(stripHistoricalKeys),
    nextToken: result.LastEvaluatedKey
      ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
      : null,
  };
}

export async function pbGetHistoricalQuotation(event: PriceApiEvent) {
  const { historicalId } = (event.arguments ?? {}) as { historicalId?: string };
  if (typeof historicalId !== 'string' || !HISTORICAL_ID_PATTERN.test(historicalId)) {
    throw new Error('VALIDATION: historicalId must be a 64-character lowercase hex string');
  }

  const result = await docClient.send(new GetCommand({
    TableName: TABLE_NAME(),
    Key: { PK: `PHIST#${historicalId}`, SK: 'META' },
    ConsistentRead: true,
  }));
  if (!result.Item) throw new Error(`NOT_FOUND: historical quotation ${historicalId}`);
  return stripHistoricalKeys(result.Item);
}

interface ImportInput {
  importBatchId: string;
  sourceDocument: string;
  sourceDocumentHash: string;
  rows: Array<HistoricalQuotationInput & { historicalId?: string; contentHash?: string }>;
}

type ImportStatus = 'IMPORTED' | 'SKIPPED' | 'CONFLICT' | 'FAILED';
interface ImportOutcome { historicalId: string; status: ImportStatus; message?: string }

type ConditionalFailure = Error & { Item?: Parameters<typeof unmarshall>[0] };
const existingItemFrom = (error: ConditionalFailure): Record<string, unknown> | undefined => (
  error.Item ? unmarshall(error.Item) : undefined
);

const canonicalManifest = (value: {
  importBatchId: unknown; sourceDocument: unknown; sourceDocumentHash: unknown;
  historicalIds: unknown; rowCount: unknown;
}) => JSON.stringify({
  importBatchId: value.importBatchId,
  sourceDocument: value.sourceDocument,
  sourceDocumentHash: value.sourceDocumentHash,
  historicalIds: Array.isArray(value.historicalIds) ? [...value.historicalIds].sort() : value.historicalIds,
  rowCount: value.rowCount,
});

function validateBatch(input: ImportInput): void {
  if (!input || typeof input !== 'object') throw new Error('VALIDATION: malformed import batch');
  if (typeof input.importBatchId !== 'string' || input.importBatchId.trim() === '') {
    throw new Error('VALIDATION: importBatchId is required');
  }
  if (typeof input.sourceDocument !== 'string' || input.sourceDocument.trim() === '') {
    throw new Error('VALIDATION: sourceDocument is required');
  }
  if (typeof input.sourceDocumentHash !== 'string' || !DOCUMENT_HASH_PATTERN.test(input.sourceDocumentHash)) {
    throw new Error('VALIDATION: sourceDocumentHash must be a 64-character lowercase hex string');
  }
  if (!Array.isArray(input.rows) || input.rows.length === 0) throw new Error('VALIDATION: rows must be a non-empty array');
  if (input.rows.length > MAX_IMPORT_ROWS) throw new Error(`VALIDATION: import batch exceeds ${MAX_IMPORT_ROWS} rows`);
}

function acceptedRow(raw: ImportInput['rows'][number], batch: ImportInput): HistoricalQuotationInput {
  if (!raw || typeof raw !== 'object') throw new Error('VALIDATION: malformed import row');
  const {
    customerName, productName, configuration, supplierId, supplierQuoteText, supplierQuoteBasis,
    supplierEvidenceType, supplierQuotedAt, customerQuoteText, sourceQuotationNumber, quotedAt,
    legacyStatus, supplierAmountFen, customerAmountUsdCents, historicalFxRate, historicalFxSource,
    historicalFxProvenance, historicalFxNote, sourceDocument, sourceDocumentHash, sourceRow,
    importBatchId, dataQualityFlags, dataQualityNotes,
  } = raw;
  if (sourceDocument !== batch.sourceDocument || sourceDocumentHash !== batch.sourceDocumentHash
      || importBatchId !== batch.importBatchId) throw new Error('VALIDATION: row lineage does not match batch');
  if (!Number.isSafeInteger(sourceRow) || sourceRow < 1 || typeof supplierId !== 'string' || supplierId === ''
      || !Array.isArray(dataQualityFlags) || !Array.isArray(dataQualityNotes)) {
    throw new Error('VALIDATION: malformed import row');
  }
  return {
    customerName, productName, configuration, supplierId, supplierQuoteText, supplierQuoteBasis,
    supplierEvidenceType, supplierQuotedAt, customerQuoteText, sourceQuotationNumber, quotedAt,
    legacyStatus, supplierAmountFen, customerAmountUsdCents, historicalFxRate, historicalFxSource,
    historicalFxProvenance, historicalFxNote, sourceDocument, sourceDocumentHash, sourceRow,
    importBatchId, dataQualityFlags, dataQualityNotes,
  } as HistoricalQuotationInput;
}

/** Manifest-first, replay-safe import. Every operation before the manifest Put is
 * read-only preflight; every operation after it is an independent conditional Put. */
export async function pbImportHistoricalQuotations(event: PriceApiEvent): Promise<ImportOutcome[]> {
  let input: ImportInput;
  try { input = parseInput<ImportInput>(event); } catch { throw new Error('VALIDATION: malformed import batch'); }
  validateBatch(input);

  // Rebuild the accepted domain shape, IDs and hashes before any database call.
  const prepared = input.rows.map((raw) => {
    const value = acceptedRow(raw, input);
    const historicalId = historicalIdFor(value.sourceDocument, value.sourceRow);
    const contentHash = contentHashFor(value);
    if ((raw.historicalId !== undefined && raw.historicalId !== historicalId)
        || (raw.contentHash !== undefined && raw.contentHash !== contentHash)) {
      throw new Error('VALIDATION: caller prediction does not match server recomputation');
    }
    return { raw, value, historicalId, contentHash, errors: validateHistoricalQuotationInput(value) };
  });

  // Supplier existence is a strongly-consistent point lookup, never a Scan.
  for (const supplierId of new Set(prepared.map(row => row.value.supplierId))) {
    const result = await docClient.send(new GetCommand({
      TableName: TABLE_NAME(), Key: { PK: `PSUP#${supplierId}`, SK: 'META' }, ConsistentRead: true,
    }));
    if (!result.Item) throw new Error(`VALIDATION: supplier ${supplierId} does not exist`);
  }

  const now = new Date().toISOString();
  const actor = getOperator(event);
  const manifest = {
    PK: `HISTIMPORT#${input.importBatchId}`, SK: 'MANIFEST', recordType: 'HISTORICAL_IMPORT_MANIFEST',
    importBatchId: input.importBatchId, sourceDocument: input.sourceDocument,
    sourceDocumentHash: input.sourceDocumentHash,
    historicalIds: prepared.map(row => row.historicalId).sort(), rowCount: prepared.length,
    createdAt: now, createdBy: actor,
  };
  try {
    await docClient.send(new PutCommand({ TableName: TABLE_NAME(), Item: manifest,
      ConditionExpression: 'attribute_not_exists(PK)', ReturnValuesOnConditionCheckFailure: 'ALL_OLD' }));
  } catch (error) {
    const existing = error as ConditionalFailure;
    if (existing.name !== 'ConditionalCheckFailedException') throw error;
    const existingManifest = existingItemFrom(existing);
    if (!existingManifest || canonicalManifest(existingManifest as Parameters<typeof canonicalManifest>[0]) !== canonicalManifest(manifest)) {
      throw new Error(`CONFLICT: import batch ${input.importBatchId} manifest differs from existing batch`);
    }
  }

  const outcomes: ImportOutcome[] = [];
  for (const item of prepared) {
    if (item.errors.length) {
      outcomes.push({ historicalId: item.historicalId, status: 'FAILED', message: item.errors.join('; ') });
      continue;
    }
    const record: HistoricalQuotationRecord = buildHistoricalRecord(item.value, actor, now);
    try {
      await docClient.send(new PutCommand({ TableName: TABLE_NAME(), Item: record,
        ConditionExpression: 'attribute_not_exists(PK)', ReturnValuesOnConditionCheckFailure: 'ALL_OLD' }));
      outcomes.push({ historicalId: item.historicalId, status: 'IMPORTED' });
    } catch (error) {
      const existing = error as ConditionalFailure;
      if (existing.name === 'ConditionalCheckFailedException') {
        const existingItem = existingItemFrom(existing);
        outcomes.push({ historicalId: item.historicalId,
          status: existingItem?.contentHash === item.contentHash ? 'SKIPPED' : 'CONFLICT' });
      } else {
        outcomes.push({ historicalId: item.historicalId, status: 'FAILED', message: existing.message });
      }
    }
  }
  return outcomes;
}

type RollbackStatus = 'DELETED' | 'ALREADY_ABSENT' | 'BLOCKED' | 'FAILED';
interface RollbackOutcome { historicalId: string; status: RollbackStatus; message?: string }
interface RollbackInput {
  importBatchId: string;
  mode: 'PREVIEW' | 'APPLY';
  rollbackToken?: string;
  reason?: string;
  requestedAt?: string;
}

const isDeletable = (item: Record<string, unknown>, importBatchId: string): boolean => (
  item.recordType === 'HISTORICAL_QUOTATION'
  && item.importBatchId === importBatchId
  && typeof item.PK === 'string' && item.PK.startsWith('PHIST#')
  && item.SK === 'META'
  && typeof item.historicalId === 'string'
  && typeof item.contentHash === 'string'
);

const failureItemFrom = (error: ConditionalFailure & {
  CancellationReasons?: Array<{ Item?: Parameters<typeof unmarshall>[0] }>;
}): Record<string, unknown> | undefined => {
  const raw = error.Item ?? error.CancellationReasons?.[0]?.Item;
  return raw ? unmarshall(raw) : undefined;
};

/** Preview/apply compensation for one immutable import manifest. */
export async function pbRollbackHistoricalQuotationImport(event: PriceApiEvent) {
  let input: RollbackInput;
  try { input = parseInput<RollbackInput>(event); } catch { throw new Error('VALIDATION: malformed rollback request'); }
  if (!input || typeof input.importBatchId !== 'string' || !input.importBatchId.trim()) {
    throw new Error('VALIDATION: importBatchId is required');
  }
  if (!['PREVIEW', 'APPLY'].includes(input.mode)) throw new Error('VALIDATION: mode must be PREVIEW or APPLY');
  if (input.mode === 'APPLY' && (!input.rollbackToken || typeof input.rollbackToken !== 'string')) {
    throw new Error('VALIDATION: rollbackToken is required for APPLY');
  }
  if (input.mode === 'APPLY' && (typeof input.reason !== 'string' || !input.reason.trim())) {
    throw new Error('VALIDATION: reason is required for APPLY');
  }

  const manifestResult = await docClient.send(new GetCommand({
    TableName: TABLE_NAME(), Key: { PK: `HISTIMPORT#${input.importBatchId}`, SK: 'MANIFEST' }, ConsistentRead: true,
  }));
  const manifest = manifestResult.Item as Record<string, unknown> | undefined;
  if (!manifest) throw new Error(`NOT_FOUND: import batch ${input.importBatchId}`);
  if (!Array.isArray(manifest.historicalIds)) throw new Error(`CONFLICT: import batch ${input.importBatchId} has an invalid manifest`);
  const intendedIds = manifest.historicalIds.filter((id): id is string => typeof id === 'string');
  if (intendedIds.length !== manifest.historicalIds.length) throw new Error(`CONFLICT: import batch ${input.importBatchId} has an invalid manifest`);

  const live = new Map<string, Record<string, unknown>>();
  for (const historicalId of intendedIds) {
    const result = await docClient.send(new GetCommand({
      TableName: TABLE_NAME(), Key: { PK: `PHIST#${historicalId}`, SK: 'META' }, ConsistentRead: true,
    }));
    if (result.Item) live.set(historicalId, result.Item);
  }
  const deletable = intendedIds.flatMap((historicalId) => {
    const item = live.get(historicalId);
    return item && isDeletable(item, input.importBatchId)
      ? [{ historicalId, contentHash: item.contentHash as string }] : [];
  });
  const token = rollbackTokenFor(input.importBatchId, deletable);
  const blocked = [...live.values()].filter(item => !isDeletable(item, input.importBatchId));
  const sourceDocuments = [...new Set([...live.values()].map(item => item.sourceDocument)
    .filter((value): value is string => typeof value === 'string'))].sort();
  const warnings = [
    ...(intendedIds.length - live.size ? [`${intendedIds.length - live.size} intended records are already absent`] : []),
    ...(blocked.length ? [`${blocked.length} records failed deletion invariants`] : []),
  ];
  if (input.mode === 'PREVIEW') return {
    matchedCount: live.size, deletableCount: deletable.length, blockedCount: blocked.length,
    historicalIds: [...live.keys()], sourceDocuments, warnings, rollbackToken: token,
  };
  if (input.rollbackToken !== token) throw new Error('CONFLICT: rollback preview is stale; run PREVIEW again');

  const results: RollbackOutcome[] = [];
  for (const historicalId of intendedIds) {
    try {
      await docClient.send(new DeleteCommand({
        TableName: TABLE_NAME(), Key: { PK: `PHIST#${historicalId}`, SK: 'META' },
        ConditionExpression: 'recordType = :recordType AND importBatchId = :batch AND begins_with(PK, :prefix) AND SK = :meta',
        ExpressionAttributeValues: { ':recordType': 'HISTORICAL_QUOTATION', ':batch': input.importBatchId,
          ':prefix': 'PHIST#', ':meta': 'META' },
        ReturnValuesOnConditionCheckFailure: 'ALL_OLD',
      }));
      results.push({ historicalId, status: 'DELETED' });
    } catch (error) {
      const failure = error as ConditionalFailure & { CancellationReasons?: Array<{ Item?: Parameters<typeof unmarshall>[0] }> };
      if (failure.name === 'ConditionalCheckFailedException') {
        results.push({ historicalId, status: failureItemFrom(failure) ? 'BLOCKED' : 'ALREADY_ABSENT' });
      } else {
        results.push({ historicalId, status: 'FAILED', message: failure.message });
      }
    }
  }
  const completedAt = new Date().toISOString();
  const actor = getOperator(event);
  const deletedHistoricalIds = results.filter(result => result.status === 'DELETED').map(result => result.historicalId);
  const failedCount = results.filter(result => result.status === 'FAILED').length;
  await docClient.send(new PutCommand({
    TableName: TABLE_NAME(),
    Item: { PK: `HISTIMPORT#${input.importBatchId}`, SK: `ROLLBACK#${completedAt}`,
      importBatchId: input.importBatchId, requestedBy: actor, confirmedBy: actor,
      requestedAt: input.requestedAt ?? completedAt, completedAt, reason: input.reason!.trim(),
      matchedCount: live.size, deletedCount: deletedHistoricalIds.length, failedCount,
      deletedHistoricalIds, sourceDocumentHash: manifest.sourceDocumentHash },
    ConditionExpression: 'attribute_not_exists(PK)',
  }));
  return { results };
}
