import { ScanCommand, GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../dynamodb';
import { emitTimelineEvent } from '../emitTimelineEvent';
import { getTimelineEvent } from '../timelineStore';
import type { ExpectedEvent } from './sourceToEvents';
import { rfqEvents, leadEvents, orderCreatedEvents, orderStageEvents, quoteEvents, logisticsEvents } from './sourceToEvents';

export interface ExistenceCounters { scanned: number; missingReemitted: number; errors: number; }
interface Deps {
  getTimelineEvent: (id: string) => Promise<unknown | null>;
  emit: (args: unknown) => Promise<void>;
}

// Core, dependency-injected for testability: emit only the missing expected events; isolate errors.
export async function reconcileExpectedEvents(expected: ExpectedEvent[], deps: Deps, counters: ExistenceCounters): Promise<void> {
  for (const ev of expected) {
    counters.scanned += 1;
    try {
      const existing = await deps.getTimelineEvent(ev.id);
      if (!existing) { await deps.emit(ev.args); counters.missingReemitted += 1; }
    } catch (err) {
      counters.errors += 1;
      console.error(JSON.stringify({ event: 'crm.sweep.existence.error', id: ev.id, error: err instanceof Error ? err.message : String(err) }));
    }
  }
}

// Resolve a logistics case's org from its related order's matchedOrgId (mirrors 2A; null on miss).
async function relatedOrderOrg(relatedOrderId: string | null | undefined): Promise<string | null> {
  if (!relatedOrderId) return null;
  try {
    const res = await docClient.send(new GetCommand({ TableName: TABLE_NAME(), Key: { PK: `ORDER#${relatedOrderId}`, SK: 'META' } }));
    return (res.Item?.matchedOrgId as string | undefined) ?? null;
  } catch { return null; }
}

// Load ALL child rows of an order partition, PAGINATED — never silently truncate (this is an audit tool).
async function loadOrderChildren(orderId: string): Promise<{ logs: Array<Record<string, unknown>>; docs: Array<Record<string, unknown>> }> {
  const logs: Array<Record<string, unknown>> = [];
  const docs: Array<Record<string, unknown>> = [];
  let start: Record<string, unknown> | undefined;
  do {
    const res = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME(),
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: { ':pk': `ORDER#${orderId}` },
      ExclusiveStartKey: start,
    }));
    for (const r of (res.Items ?? []) as Array<Record<string, unknown>>) {
      const sk = r.SK as string | undefined;
      if (typeof sk === 'string' && sk.startsWith('LOG#')) logs.push(r);
      else if (typeof sk === 'string' && sk.startsWith('DOC#')) docs.push(r);
    }
    start = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (start);
  return { logs, docs };
}

// Reconstruct the order's primary contact email so a recovered order_created MIRRORS live emit's
// resolveInput (matters when matchedOrgId is absent — CRM then resolves by contact/domain, not
// `unresolved-*`). Manual createOrder stamps GSI4PK = EMAIL#<normalizedEmail> on the order META;
// RFQ conversion writes no GSI4PK, so fall back to the linked RFQ's email. Null when neither exists.
async function orderEmail(m: Record<string, unknown>): Promise<string | null> {
  const gsi4 = m.GSI4PK as string | undefined;
  if (typeof gsi4 === 'string' && gsi4.startsWith('EMAIL#')) return gsi4.slice('EMAIL#'.length) || null;
  const rfqId = m.rfqId as string | undefined;
  if (!rfqId) return null;
  try {
    const res = await docClient.send(new GetCommand({ TableName: TABLE_NAME(), Key: { PK: `RFQ#${rfqId}`, SK: 'META' } }));
    return (res.Item?.email as string | undefined) ?? null;
  } catch { return null; }
}

const idFromPk = (m: Record<string, unknown>, prefix: string) => (m.PK as string).slice(prefix.length);
// createOrder writes matchedOrgId:'' for an unmatched order; normalize '' → null.
const orgOrNull = (v: unknown) => ((v as string) || null);

// Channels in deterministic order, discriminated by PK PREFIX + SK='META' (source rows carry NO
// `entityType`). Each has its own hot-recency field: rfq/lead → submittedAt; order/logistics → updatedAt.
// Field mappings below are baked from the confirmed stored shapes (RFQ/LEAD/ORDER/LOGISTICS writes).
interface Channel { name: string; pkPrefix: string; recencyField: string; expand: (meta: Record<string, unknown>) => Promise<ExpectedEvent[]>; }

const CHANNELS: Channel[] = [
  { name: 'rfq', pkPrefix: 'RFQ#', recencyField: 'submittedAt', expand: async (m) => rfqEvents({
      rfqId: idFromPk(m, 'RFQ#'), submittedAt: m.submittedAt as string, email: m.email as string | undefined,
      equipmentCategory: m.equipmentCategory as string | undefined, specificModel: m.specificModel as string | undefined,
      matchedOrgId: orgOrNull(m.matchedOrgId),
    }) },
  { name: 'lead', pkPrefix: 'LEAD#', recencyField: 'submittedAt', expand: async (m) => leadEvents({
      leadId: idFromPk(m, 'LEAD#'), submittedAt: m.submittedAt as string, type: m.type as string,
      email: m.email as string | undefined, productName: m.productName as string | undefined,
      inquiryType: m.inquiryType as string | undefined, matchedOrgId: orgOrNull(m.matchedOrgId),
    }) },
  { name: 'order', pkPrefix: 'ORDER#', recencyField: 'updatedAt', expand: async (m) => {
      const orderId = idFromPk(m, 'ORDER#');
      const order = { orderId, matchedOrgId: orgOrNull(m.matchedOrgId) };
      const { logs, docs } = await loadOrderChildren(orderId);
      const email = await orderEmail(m); // order_created mirrors live emit's email; stage/quote don't pass one
      return [
        ...orderCreatedEvents({ orderId, createdAt: m.createdAt as string, productModel: m.productModel as string | undefined, matchedOrgId: order.matchedOrgId, rfqId: (m.rfqId as string) ?? null, email }),
        ...orderStageEvents(order, logs as never),
        ...quoteEvents(order, docs as never),
      ];
    } },
  { name: 'logistics', pkPrefix: 'LOGISTICS#', recencyField: 'updatedAt', expand: async (m) => {
      const org = await relatedOrderOrg(m.relatedOrderId as string | undefined);
      return logisticsEvents({ caseId: idFromPk(m, 'LOGISTICS#'), caseType: m.caseType as string | undefined, milestoneLog: m.milestoneLog as never }, org);
    } },
];

const channelIndexByName = (name?: string) => { const i = CHANNELS.findIndex((c) => c.name === name); return i < 0 ? 0 : i; };

function buildChannelScan(channel: Channel, mode: 'hot' | 'cold', cutoffIso: string | undefined, limit: number, key?: Record<string, unknown>) {
  const values: Record<string, unknown> = { ':pre': channel.pkPrefix, ':meta': 'META' };
  let filter = 'begins_with(PK, :pre) AND SK = :meta';
  let names: Record<string, string> | undefined;
  if (mode === 'hot' && cutoffIso) { names = { '#r': channel.recencyField }; values[':cut'] = cutoffIso; filter += ' AND #r > :cut'; }
  return new ScanCommand({ TableName: TABLE_NAME(), FilterExpression: filter, ExpressionAttributeNames: names, ExpressionAttributeValues: values, ExclusiveStartKey: key, Limit: limit });
}

export interface ChannelCursor { channel: string; key?: Record<string, unknown>; }

// One scan page of the CURRENT channel (per cursor). Advances to the next channel when one is exhausted;
// hasMore=false only after the LAST channel is exhausted. Per-record expand errors are isolated.
export async function runExistencePage(opts: { mode: 'hot' | 'cold'; limit: number; cursor?: ChannelCursor; cutoffIso?: string }): Promise<{ counters: ExistenceCounters; cursor?: ChannelCursor; hasMore: boolean }> {
  const counters: ExistenceCounters = { scanned: 0, missingReemitted: 0, errors: 0 };
  const idx = channelIndexByName(opts.cursor?.channel);
  const channel = CHANNELS[idx];
  const res = await docClient.send(buildChannelScan(channel, opts.mode, opts.cutoffIso, opts.limit, opts.cursor?.key));
  const deps: Deps = { getTimelineEvent, emit: (a) => emitTimelineEvent(a as never) };
  for (const item of (res.Items ?? []) as Array<Record<string, unknown>>) {
    try {
      await reconcileExpectedEvents(await channel.expand(item), deps, counters);
    } catch (err) {
      counters.errors += 1;
      console.error(JSON.stringify({ event: 'crm.sweep.existence.expand_error', pk: item.PK, error: err instanceof Error ? err.message : String(err) }));
    }
  }
  const key = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  if (key) return { counters, cursor: { channel: channel.name, key }, hasMore: true };
  const next = CHANNELS[idx + 1];
  return next ? { counters, cursor: { channel: next.name }, hasMore: true } : { counters, cursor: undefined, hasMore: false };
}
