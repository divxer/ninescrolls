import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../dynamodb';
import { upsertVisitorBridge, readVisitorBridge, toSend } from '../../../../lib/crm/visitor-bridge';

// One-time bridge backfill (spec §5): paginated scan of RFQ/LEAD METAs that already carry a
// visitorId → upgrade-only bridge writes. NO retro fire by default — markers only exist for
// post-go-live sessions (forward-only), so there is nothing to re-resolve yet.
export async function backfillVisitorBridge(args: { cursor?: Record<string, unknown>; limit?: number }): Promise<{ processed: number; upgraded: number; hasMore: boolean; nextCursor?: Record<string, unknown> }> {
  const res = await docClient.send(new ScanCommand({
    TableName: TABLE_NAME(),
    FilterExpression: '(begins_with(PK, :rfq) OR begins_with(PK, :lead)) AND SK = :meta AND attribute_exists(visitorId)',
    ExpressionAttributeValues: { ':rfq': 'RFQ#', ':lead': 'LEAD#', ':meta': 'META' },
    ExclusiveStartKey: args.cursor, Limit: args.limit ?? 200,
  }));
  let processed = 0, upgraded = 0;
  const send = toSend(docClient);
  for (const row of (res.Items ?? []) as Array<Record<string, unknown>>) {
    const pk = row.PK as string;
    const isRfq = pk.startsWith('RFQ#');
    // Historical rows must never regress a LIVE bridge: upsert is last-writer-real-wins, so an old
    // row's org could overwrite a newer live match. Skip rows whose bridge already has a real org
    // (email-fill on an already-resolved bridge is not worth the regression risk).
    const existing = await readVisitorBridge(send, TABLE_NAME(), (row.visitorId as string) ?? '');
    if (existing?.matchedOrgId) { processed += 1; continue; }
    const r = await upsertVisitorBridge(send, TABLE_NAME(), {
      visitorId: (row.visitorId as string) ?? '',
      matchedOrgId: ((row.matchedOrgId as string) || null),
      email: (row.email as string) ?? null,
      sourceEntityType: isRfq ? 'rfq' : 'lead',
      sourceEntityId: pk.slice(isRfq ? 4 : 5),
      now: (row.submittedAt as string) ?? new Date().toISOString(),
    });
    processed += 1;
    if (r.created || r.orgUpgraded) upgraded += 1;
  }
  return { processed, upgraded, hasMore: !!res.LastEvaluatedKey, nextCursor: res.LastEvaluatedKey as Record<string, unknown> | undefined };
}
