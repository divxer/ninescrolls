import crypto from 'node:crypto';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../dynamodb';
import { emitTimelineEvent } from '../emitTimelineEvent';
import { loadSessionFlushes, ANALYTICS_TABLE, type FlushRow } from './sessionWindow';
import { readMarker, writeMarker, listMarkers, type SessionMarker } from './sessionMarkers';
import { readVisitorBridge, toSend } from '../../../../lib/crm/visitor-bridge';

export type MaterializeOutcome = 'emitted' | 'below_threshold' | 'skipped' | 'no_flushes';
export type ResolutionSource = 'bridge' | 'prior' | 'unresolved';
type PvRow = Record<string, unknown>;

// Content digest over the SELECTED materialization inputs (spec §2.2): sorted flush ids + the
// per-page fields the threshold/payload read. Same inputs ⇒ same hash ⇒ fast-skip (unless a
// resolution upgrade is available or forceReemit).
export function computeInputHash(flushes: FlushRow[], pages: PvRow[]): string {
  const f = flushes.map((x) => ({
    pageViewId: x.pageViewId ?? '',
    timestamp: x.timestamp ?? '',
    pathname: x.pathname ?? '',
    activeSeconds: x.activeSeconds ?? 0,
    maxScrollDepth: x.maxScrollDepth ?? 0,
  })).sort((a, b) => `${a.pageViewId}#${a.timestamp}`.localeCompare(`${b.pageViewId}#${b.timestamp}`));
  const p = pages.map((x) => ({
    id: x.id ?? '',
    pathname: x.pathname ?? '',
    productId: x.productId ?? '',
    productPagesViewed: x.productPagesViewed ?? 0,
    pdfDownloads: x.pdfDownloads ?? 0,
    returnVisits: x.returnVisits ?? 0,
    orgName: x.orgName ?? '',
    utmSource: x.utmSource ?? '',
    utmMedium: x.utmMedium ?? '',
    utmCampaign: x.utmCampaign ?? '',
    trafficChannel: x.trafficChannel ?? '',
    country: x.country ?? '',
    region: x.region ?? '',
  })).sort((a, b) => String(a.id).localeCompare(String(b.id)));
  return crypto.createHash('sha256').update(JSON.stringify([f, p])).digest('hex').slice(0, 32);
}

// P1 §5.2 signal threshold, computed from joined parent pv rows + flush paths (spec §2.3 signal sources).
function passesThreshold(flushes: FlushRow[], pages: PvRow[]): boolean {
  const paths = new Set<string>();
  for (const f of flushes) if (typeof f.pathname === 'string') paths.add(f.pathname);
  for (const p of pages) if (typeof p.pathname === 'string') paths.add(p.pathname as string);
  const productPage = [...paths].some((p) => p.startsWith('/products/')) || pages.some((p) => !!p.productId) || pages.some((p) => Number(p.productPagesViewed ?? 0) > 0);
  const rfqPage = [...paths].some((p) => p.startsWith('/rfq'));
  const download = pages.some((p) => Number(p.pdfDownloads ?? 0) > 0);
  const returnVisit = pages.some((p) => Number(p.returnVisits ?? 0) > 0);
  const pageCount = new Set(flushes.map((f) => f.pageViewId).filter(Boolean)).size;
  return productPage || rfqPage || download || returnVisit || pageCount >= 3;
}

function sumMaxActiveSecondsByPage(flushes: FlushRow[]): number {
  const byPage = new Map<string, number>();
  let anonymous = 0;
  for (const f of flushes) {
    const active = typeof f.activeSeconds === 'number' ? f.activeSeconds : 0;
    if (typeof f.pageViewId === 'string' && f.pageViewId) {
      byPage.set(f.pageViewId, Math.max(byPage.get(f.pageViewId) ?? 0, active));
    } else {
      anonymous += active;
    }
  }
  return [...byPage.values()].reduce((sum, active) => sum + active, anonymous);
}

function comparePriorMarkersDesc(a: SessionMarker, b: SessionMarker): number {
  return b.occurredAt.localeCompare(a.occurredAt)
    || b.emittedAt.localeCompare(a.emittedAt)
    || b.sessionId.localeCompare(a.sessionId);
}

async function latestPriorResolvedOrgId(visitorId: string, sessionId: string, occurredAt: string): Promise<string | undefined> {
  let startKey: Record<string, unknown> | undefined;
  let best: SessionMarker | undefined;
  do {
    const { markers, lastKey } = await listMarkers(visitorId, { startKey });
    const pageBest = markers
      .filter((m) => m.resolutionStatus === 'resolved' && m.resolvedOrgId && m.sessionId !== sessionId && m.occurredAt < occurredAt)
      .sort(comparePriorMarkersDesc)[0];
    if (pageBest && (!best || comparePriorMarkersDesc(pageBest, best) < 0)) best = pageBest;
    startKey = lastKey;
  } while (startKey);
  return best?.resolvedOrgId ?? undefined;
}

export async function materializeSession(opts: { sessionId: string; nowIso: string; forceReemit?: boolean }): Promise<{ outcome: MaterializeOutcome; resolvedOrgId?: string | null; resolutionSource?: ResolutionSource }> {
  const flushes = (await loadSessionFlushes(opts.sessionId)).filter((f) => f.isBot !== true);
  if (flushes.length === 0) return { outcome: 'no_flushes' };

  // Join parent pv rows (deterministic ids) for enrichment: paths, product ids, UTM, IP-org display, counters.
  const pageViewIds = [...new Set(flushes.map((f) => f.pageViewId).filter((x): x is string => typeof x === 'string' && !!x))];
  const pages: PvRow[] = [];
  for (const pvId of pageViewIds) {
    try {
      const res = await docClient.send(new GetCommand({ TableName: ANALYTICS_TABLE(), Key: { id: `pv-${pvId}` } }));
      if (res.Item && (res.Item as PvRow).isBot !== true) pages.push(res.Item as PvRow);
    } catch (err) {
      throw new Error(`pv_join_failed:${pvId}:${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const visitorId = (flushes.find((f) => typeof f.visitorId === 'string' && f.visitorId)?.visitorId
    ?? pages.find((p) => typeof p.visitorId === 'string' && p.visitorId)?.visitorId ?? '') as string;
  const inputHash = computeInputHash(flushes, pages);
  const existingMarker = visitorId ? await readMarker(visitorId, opts.sessionId) : null;
  const bridge = visitorId ? await readVisitorBridge(toSend(docClient), TABLE_NAME(), visitorId) : null;
  const sorted = flushes.map((f) => f.timestamp as string).filter(Boolean).sort();
  const occurredAt = sorted[0] ?? opts.nowIso;
  const lastFlushTs = sorted[sorted.length - 1] ?? occurredAt;

  // Tier-2 lookup: latest prior RESOLVED marker for this visitor (markers are the prior-event index).
  let priorVisitorOrgId: string | undefined;
  if (visitorId && !(bridge?.matchedOrgId)) {
    priorVisitorOrgId = await latestPriorResolvedOrgId(visitorId, opts.sessionId, occurredAt);
  }

  // Fast-skip (normal mode only): same input AND no resolution upgrade available.
  const upgradeAvailable = existingMarker?.resolutionStatus === 'unresolved' && (!!bridge?.matchedOrgId || !!priorVisitorOrgId);
  if (!opts.forceReemit && existingMarker && existingMarker.inputHash === inputHash && !upgradeAvailable) {
    return { outcome: 'skipped', resolvedOrgId: existingMarker.resolvedOrgId };
  }

  if (!passesThreshold(flushes, pages)) {
    if (visitorId) await writeMarker(visitorId, {
      sessionId: opts.sessionId, timelineEventId: `tev-analytics-session-${opts.sessionId}`, occurredAt,
      resolutionStatus: 'below_threshold', resolvedOrgId: null,
      lastFlushTs, flushCount: flushes.length, inputHash, emittedAt: opts.nowIso,
    });
    return { outcome: 'below_threshold' };
  }

  // Payload (spec §2.3) — IP-org is DISPLAY ONLY; it never enters resolveInput.
  const pathCounts = new Map<string, number>();
  for (const f of flushes) if (typeof f.pathname === 'string') pathCounts.set(f.pathname, (pathCounts.get(f.pathname) ?? 0) + 1);
  for (const p of pages) if (typeof p.pathname === 'string') pathCounts.set(p.pathname as string, (pathCounts.get(p.pathname as string) ?? 0) + 1);
  const topPaths = [...pathCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([p]) => p);
  const bestPv = pages.find((p) => p.orgName || p.utmSource || p.country) ?? pages[0] ?? {};
  const num = (v: unknown) => (typeof v === 'number' ? v : 0);
  const payload = {
    visitorId: visitorId || null, pageCount: new Set(flushes.map((f) => f.pageViewId).filter(Boolean)).size,
    topPaths, productPagesViewed: Math.max(0, ...pages.map((p) => num(p.productPagesViewed))),
    downloads: Math.max(0, ...pages.map((p) => num(p.pdfDownloads))),
    returnVisit: pages.some((p) => num(p.returnVisits) > 0),
    activeSeconds: sumMaxActiveSecondsByPage(flushes),
    maxScrollDepth: Math.max(0, ...flushes.map((f) => num(f.maxScrollDepth))),
    orgNameDisplay: (bestPv.orgName as string) ?? null,
    utmSource: (bestPv.utmSource as string) ?? null, utmMedium: (bestPv.utmMedium as string) ?? null,
    utmCampaign: (bestPv.utmCampaign as string) ?? null, trafficChannel: (bestPv.trafficChannel as string) ?? null,
    country: (bestPv.country as string) ?? null, region: (bestPv.region as string) ?? null,
  };

  // Three-tier resolveInput (spec §2.3): bridge → priorVisitorOrgId → bare (unresolved sentinel).
  const resolveInput = {
    sourceEntityType: 'analytics', sourceEntityId: opts.sessionId, channel: 'analytics' as const,
    ...(bridge?.matchedOrgId ? { matchedOrgId: bridge.matchedOrgId } : {}),
    ...(bridge?.email ? { email: bridge.email } : {}),
    ...(!bridge?.matchedOrgId && priorVisitorOrgId ? { priorVisitorOrgId } : {}),
  };

  await emitTimelineEvent({
    source: 'analytics', kind: 'site_visit_session',
    sourceEntityType: 'analytics', sourceEntityId: opts.sessionId,
    occurredAt, summary: `Site visit — ${payload.pageCount} page${payload.pageCount === 1 ? '' : 's'}${payload.orgNameDisplay ? ` (${payload.orgNameDisplay})` : ''}`,
    idInput: { kind: 'site_visit_session', sessionId: opts.sessionId },
    resolveInput, isInternalOnly: false, payload,
  });

  const resolvedOrgId = bridge?.matchedOrgId ?? priorVisitorOrgId ?? null;
  const resolutionSource: ResolutionSource = bridge?.matchedOrgId ? 'bridge' : priorVisitorOrgId ? 'prior' : 'unresolved';
  const marker: SessionMarker = {
    sessionId: opts.sessionId, timelineEventId: `tev-analytics-session-${opts.sessionId}`, occurredAt,
    // Marker state is local and conservative: email-only bridge input may or may not resolve inside
    // resolveLinks, whose result emitTimelineEvent does not return. Keep such markers unresolved so a
    // later real matchedOrgId or prior marker can still retro-resolve them.
    resolutionStatus: resolvedOrgId ? 'resolved' : 'unresolved', resolvedOrgId,
    lastFlushTs, flushCount: flushes.length, inputHash, emittedAt: opts.nowIso,
  };
  if (visitorId) await writeMarker(visitorId, marker);
  if (visitorId && resolutionSource !== 'bridge') {
    const freshBridge = await readVisitorBridge(toSend(docClient), TABLE_NAME(), visitorId);
    if (freshBridge?.matchedOrgId) {
      const resolvedResolveInput = {
        sourceEntityType: 'analytics', sourceEntityId: opts.sessionId, channel: 'analytics' as const,
        matchedOrgId: freshBridge.matchedOrgId,
        ...(freshBridge.email ? { email: freshBridge.email } : {}),
      };
      await emitTimelineEvent({
        source: 'analytics', kind: 'site_visit_session',
        sourceEntityType: 'analytics', sourceEntityId: opts.sessionId,
        occurredAt, summary: `Site visit — ${payload.pageCount} page${payload.pageCount === 1 ? '' : 's'}${payload.orgNameDisplay ? ` (${payload.orgNameDisplay})` : ''}`,
        idInput: { kind: 'site_visit_session', sessionId: opts.sessionId },
        resolveInput: resolvedResolveInput, isInternalOnly: false, payload,
      });
      await writeMarker(visitorId, { ...marker, resolutionStatus: 'resolved', resolvedOrgId: freshBridge.matchedOrgId, emittedAt: opts.nowIso });
      return { outcome: 'emitted', resolvedOrgId: freshBridge.matchedOrgId, resolutionSource: 'bridge' };
    }
  }
  return { outcome: 'emitted', resolvedOrgId, resolutionSource };
}
