import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../dynamodb';

export const ANALYTICS_TABLE = () => process.env.ANALYTICS_EVENT_TABLE!;
// Physical GSI names — Amplify Gen2 convention (verified against the shipped `insightsPostsBySlug`
// index in generate-sitemaps): <pluralCamelModel>By<Pk>[And<Sk>]. Task 12 verifies via describe-table
// pre-merge; a mismatch also surfaces instantly as `errors` in the first cron's summary log.
const GSI_BY_EVENT_TYPE = 'analyticsEventsByEventTypeAndTimestamp';
const GSI_BY_SESSION = 'analyticsEventsBySessionIdAndTimestamp';

const SESSION_IDLE_MS = 30 * 60 * 1000;   // P1 §4.3 close window
const OVERLAP_MS = 10 * 60 * 1000;        // spec §3 clock-skew/late-beacon overlap

export type FlushRow = Record<string, unknown> & { sessionId?: string; timestamp?: string; isBot?: boolean; pageViewId?: string; visitorId?: string };

export const computeCutoff = (nowIso: string): string => new Date(Date.parse(nowIso) - SESSION_IDLE_MS).toISOString();

// One discovery page over the eventType GSI: page_time_flush rows with ts ∈ [watermark − overlap, cutoff].
// The lower bound is intentionally inclusive because deterministic session ids make boundary duplicates harmless.
// Dedupe is PER PAGE only — the same session recurs across pages and overlap windows; callers must
// tolerate repeats (the driver's seen-set + deterministic ids make them harmless).
export async function discoverFlushPage(opts: { watermark: string; cutoff: string; startKey?: Record<string, unknown>; limit?: number }): Promise<{ sessionIds: string[]; skippedBots: number; lastKey?: Record<string, unknown> }> {
  const from = new Date(Date.parse(opts.watermark) - OVERLAP_MS).toISOString();
  const res = await docClient.send(new QueryCommand({
    TableName: ANALYTICS_TABLE(), IndexName: GSI_BY_EVENT_TYPE,
    KeyConditionExpression: 'eventType = :et AND #ts BETWEEN :from AND :to',
    ExpressionAttributeNames: { '#ts': 'timestamp' },
    ExpressionAttributeValues: { ':et': 'page_time_flush', ':from': from, ':to': opts.cutoff },
    ExclusiveStartKey: opts.startKey, Limit: opts.limit,
  }));
  const ids = new Set<string>();
  let skippedBots = 0;
  for (const r of (res.Items ?? []) as FlushRow[]) {
    if (r.isBot === true) { skippedBots += 1; continue; }
    if (typeof r.sessionId === 'string' && r.sessionId) ids.add(r.sessionId);
  }
  return { sessionIds: [...ids], skippedBots, lastKey: res.LastEvaluatedKey as Record<string, unknown> | undefined };
}

// ALL of one session's flushes (paginated to completion — full session content never depends on the
// discovery window). Audit-tool rule: never silently truncate.
export async function loadSessionFlushes(sessionId: string): Promise<FlushRow[]> {
  const out: FlushRow[] = [];
  let start: Record<string, unknown> | undefined;
  do {
    const res = await docClient.send(new QueryCommand({
      TableName: ANALYTICS_TABLE(), IndexName: GSI_BY_SESSION,
      KeyConditionExpression: 'sessionId = :sid',
      ExpressionAttributeValues: { ':sid': sessionId },
      ExclusiveStartKey: start,
    }));
    out.push(...((res.Items ?? []) as FlushRow[]));
    start = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (start);
  return out;
}

export function isSessionClosed(flushes: FlushRow[], nowIso: string): boolean {
  const last = flushes.reduce<string>((m, f) => (typeof f.timestamp === 'string' && f.timestamp > m ? f.timestamp : m), '');
  return !!last && Date.parse(last) <= Date.parse(nowIso) - SESSION_IDLE_MS;
}
