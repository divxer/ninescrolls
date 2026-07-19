import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { EVIDENCE_STATUS } from '../../lib/evidence/status';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

interface EvidenceApiEvent {
  arguments?: { productSlug?: string | null };
  info?: { fieldName?: string };
}

// Aggregate stats — a COUNT only. Reads draft records internally to count them
// but returns no record data (no title/journal/OEM), so it's no-leak-safe.
export interface EvidenceStats {
  verifiedPublications: number;
}

// Public read boundary: anonymous callers must never receive the OEM name,
// the internal instrument/model string, or the OEM-identifying slug. We build
// an explicit whitelist per record and hoist ONLY the safe meta sub-fields.
export interface PublicEvidence {
  id?: unknown;
  type?: unknown;
  status?: unknown;
  title?: unknown;
  sourceUrl?: unknown;
  publishDate?: unknown;
  products?: unknown;
  journal?: unknown;
  year?: unknown;
  doi?: unknown;
  publicSummary?: unknown;
}

function safeMeta(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object') return raw as Record<string, unknown>;
  if (typeof raw === 'string' && raw.trim()) {
    try { return JSON.parse(raw) as Record<string, unknown>; } catch { return {}; }
  }
  return {};
}

export function projectPublicEvidence(item: Record<string, unknown>): PublicEvidence {
  const meta = safeMeta(item.meta);
  const out: PublicEvidence = {
    id: item.id,
    type: item.type,
    status: item.status,
    title: item.title,
    sourceUrl: item.sourceUrl,
    publishDate: item.publishDate,
    products: item.products,
    journal: meta.journal,
    year: meta.year,
    doi: meta.doi,
  };
  if (meta.publicSummary != null) out.publicSummary = meta.publicSummary;
  return out;
}

// Count of verbatim-verified (tier-A) publications, active (non-archived),
// regardless of published/draft. This is the homepage "scale" number — larger
// than the published-only count, but still every one is a real verified paper.
// Pure so it can be unit-tested.
export function countVerifiedPublications(items: Record<string, unknown>[]): number {
  return items.filter((item) => {
    if (item.type !== 'publication') return false;
    if (item.status === EVIDENCE_STATUS.ARCHIVED) return false;
    return safeMeta(item.meta).verificationTier === 'A';
  }).length;
}

async function scanAll(
  tableName: string,
  FilterExpression: string,
  ExpressionAttributeNames: Record<string, string>,
  ExpressionAttributeValues: Record<string, unknown>,
): Promise<Record<string, unknown>[]> {
  const items: Record<string, unknown>[] = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const res = await ddb.send(
      new ScanCommand({
        TableName: tableName,
        FilterExpression,
        ExpressionAttributeNames,
        ExpressionAttributeValues,
        ExclusiveStartKey,
      })
    );
    if (res.Items) items.push(...(res.Items as Record<string, unknown>[]));
    ExclusiveStartKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (ExclusiveStartKey);
  return items;
}

export const handler = async (
  event: EvidenceApiEvent,
): Promise<PublicEvidence[] | EvidenceStats> => {
  const tableName = process.env.EVIDENCE_TABLE;
  if (!tableName) throw new Error('EVIDENCE_TABLE env var is not set');

  // getEvidenceStats: return ONLY the verified-publication count (no records).
  if (event.info?.fieldName === 'getEvidenceStats') {
    const items = await scanAll(
      tableName,
      '#type = :publication AND #status <> :archived',
      { '#status': 'status', '#type': 'type' },
      { ':publication': 'publication', ':archived': EVIDENCE_STATUS.ARCHIVED },
    );
    return { verifiedPublications: countVerifiedPublications(items) };
  }

  // listPublishedEvidence: published records only, optionally scoped by product.
  const productSlug = event.arguments?.productSlug?.trim();
  const filters = ['#status = :published'];
  const values: Record<string, unknown> = { ':published': EVIDENCE_STATUS.PUBLISHED };
  if (productSlug) {
    filters.push('contains(products, :slug)');
    values[':slug'] = productSlug;
  }
  const items = await scanAll(
    tableName,
    filters.join(' AND '),
    { '#status': 'status' },
    values,
  );
  return items.map(projectPublicEvidence);
};
