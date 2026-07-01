import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../dynamodb';
import { recomputeRollupsForOrg } from '../orgStore';
import { markRollupApplied } from '../timelineStore';

export interface DirtyCounters { dirtyFound: number; repaired: number; errors: number; }
const isSentinel = (orgId: string) => orgId.startsWith('unresolved-');

export async function runDirtyRollupPage(opts: { limit: number; cursor?: Record<string, unknown> }): Promise<{ counters: DirtyCounters; cursor?: Record<string, unknown>; hasMore: boolean }> {
  const counters: DirtyCounters = { dirtyFound: 0, repaired: 0, errors: 0 };
  const res = await docClient.send(new ScanCommand({
    TableName: TABLE_NAME(),
    FilterExpression: 'entityType = :te AND rollupApplied = :f',
    ExpressionAttributeValues: { ':te': 'TIMELINE_EVENT', ':f': false },
    ExclusiveStartKey: opts.cursor,
    Limit: opts.limit,
  }));
  for (const row of (res.Items ?? []) as Array<{ id: string; orgId: string; rollupPendingOrgId?: string | null }>) {
    counters.dirtyFound += 1;
    try {
      if (row.rollupPendingOrgId && !isSentinel(row.rollupPendingOrgId)) await recomputeRollupsForOrg(row.rollupPendingOrgId);
      if (!isSentinel(row.orgId)) await recomputeRollupsForOrg(row.orgId);
      await markRollupApplied(row.id);
      counters.repaired += 1;
    } catch (err) {
      counters.errors += 1;
      console.error(JSON.stringify({ event: 'crm.sweep.dirty.error', id: row.id, error: err instanceof Error ? err.message : String(err) }));
    }
  }
  return { counters, cursor: res.LastEvaluatedKey as Record<string, unknown> | undefined, hasMore: !!res.LastEvaluatedKey };
}
