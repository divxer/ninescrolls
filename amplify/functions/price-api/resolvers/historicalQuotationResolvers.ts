import { GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../lib/dynamodb.js';
import { getOperator, parseInput, stripKeys, type PriceApiEvent } from '../lib/types.js';
import {
  buildHistoricalRecord,
  contentHashFor,
  historicalIdFor,
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
    const existing = error as Error & { Item?: typeof manifest };
    if (existing.name !== 'ConditionalCheckFailedException') throw error;
    if (!existing.Item || canonicalManifest(existing.Item) !== canonicalManifest(manifest)) {
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
      const existing = error as Error & { Item?: { contentHash?: string } };
      if (existing.name === 'ConditionalCheckFailedException') {
        outcomes.push({ historicalId: item.historicalId,
          status: existing.Item?.contentHash === item.contentHash ? 'SKIPPED' : 'CONFLICT' });
      } else {
        outcomes.push({ historicalId: item.historicalId, status: 'FAILED', message: existing.message });
      }
    }
  }
  return outcomes;
}
