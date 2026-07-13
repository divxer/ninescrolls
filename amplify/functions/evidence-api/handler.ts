import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { EVIDENCE_STATUS } from '../../lib/evidence/status';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

interface EvidenceApiEvent {
  arguments?: { productSlug?: string | null };
}

export const handler = async (event: EvidenceApiEvent): Promise<unknown[]> => {
  const tableName = process.env.EVIDENCE_TABLE;
  if (!tableName) throw new Error('EVIDENCE_TABLE env var is not set');

  const productSlug = event.arguments?.productSlug?.trim();

  const filters = ['#status = :published'];
  const values: Record<string, unknown> = { ':published': EVIDENCE_STATUS.PUBLISHED };
  if (productSlug) {
    filters.push('contains(products, :slug)');
    values[':slug'] = productSlug;
  }

  const items: unknown[] = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const res = await ddb.send(
      new ScanCommand({
        TableName: tableName,
        FilterExpression: filters.join(' AND '),
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: values,
        ExclusiveStartKey,
      })
    );
    if (res.Items) items.push(...res.Items);
    ExclusiveStartKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (ExclusiveStartKey);

  return items;
};
