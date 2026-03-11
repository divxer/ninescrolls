import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { getOrgOverride, setOrgOverride, undoOrgOverride, listOrgOverrides, type OrgOverride, type OrgOverrideSummary } from '../../services/adminClassificationService';
import { classifyTrafficChannel, type TrafficChannel } from '../../services/behaviorAnalytics';
import { generateClient } from 'aws-amplify/data';
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  ZoomableGroup,
} from 'react-simple-maps';
import type { Schema } from '../../../amplify/data/resource';

const client = generateClient<Schema>();

type AnalyticsEvent = Schema['AnalyticsEvent']['type'];

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

// ─── Types ──────────────────────────────────────────────────────────────────

interface OrganizationRecord {
  key: string;
  orgName: string;
  organizationType: string;
  country: string;
  region: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  leadTier: string | null;
  isTargetCustomer: boolean;
  totalEvents: number;
  uniquePages: number;
  productsViewed: string[];
  totalTimeOnSite: number;
  pdfDownloads: number;
  returnVisits: number;
  lastVisit: string;
  firstVisit: string;
  maxConfidence: number;
  maxBehaviorScore: number;
  isAnonymousHighIntent: boolean;
  isISPVisitor: boolean;
  events: AnalyticsEvent[];
}

type DateRange = 'today' | 'yesterday' | 'last7' | 'last30' | 'all' | 'custom';
type SortColumn = 'orgName' | 'organizationType' | 'country' | 'totalEvents' | 'uniquePages' | 'totalTimeOnSite' | 'leadTier' | 'maxConfidence' | 'lastVisit';
type KpiFilter = 'all' | 'target' | 'university' | 'enterprise' | 'hotLead' | 'returning' | 'anonymousIntent';

const DATE_RANGES: { value: DateRange; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last7', label: 'Last 7 Days' },
  { value: 'last30', label: 'Last 30 Days' },
  { value: 'all', label: 'All Time' },
  { value: 'custom', label: 'Custom' },
];

// Known bot / crawler organizations — filtered alongside isBot
const BOT_ORG_PATTERNS = [
  'google', 'googlebot', 'bing', 'microsoft', 'msn',
  'ahrefs', 'semrush', 'moz.com', 'majestic',
  'yandex', 'baidu', 'bytedance', 'bytespider',
  'facebook', 'meta platforms', 'twitter',
  'apple', 'applebot',
  'amazon', 'amazonaws',
  'cloudflare', 'fastly',
  'datadome', 'imperva', 'sucuri',
  'censys', 'shodan', 'netcraft',
  'pingdom', 'uptimerobot', 'statuscake',
  'petalbot', 'sogou', 'duckduckgo',
  'archive.org', 'ia_archiver',
  'zayo bandwidth',
];

function isKnownBotOrg(orgName: string): boolean {
  const lower = orgName.toLowerCase();
  return BOT_ORG_PATTERNS.some((pattern) => lower.includes(pattern));
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getDateBounds(range: DateRange, customStart?: string, customEnd?: string): { start: Date; end: Date } {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 86400000);

  switch (range) {
    case 'today':
      return { start: todayStart, end: todayEnd };
    case 'yesterday': {
      const ydayStart = new Date(todayStart.getTime() - 86400000);
      return { start: ydayStart, end: todayStart };
    }
    case 'last7':
      return { start: new Date(todayStart.getTime() - 7 * 86400000), end: todayEnd };
    case 'last30':
      return { start: new Date(todayStart.getTime() - 30 * 86400000), end: todayEnd };
    case 'custom': {
      const s = customStart ? new Date(customStart) : new Date(todayStart.getTime() - 7 * 86400000);
      const e = customEnd ? new Date(new Date(customEnd).getTime() + 86400000) : todayEnd;
      return { start: s, end: e };
    }
    case 'all':
      return { start: new Date(0), end: todayEnd };
  }
}

function tierRank(tier: string | null): number {
  if (tier === 'A') return 3;
  if (tier === 'B') return 2;
  if (tier === 'C') return 1;
  return 0;
}

function tierColor(tier: string | null): string {
  switch (tier) {
    case 'A': return '#2e7d32';
    case 'B': return '#f57c00';
    case 'C': return '#9e9e9e';
    default: return '#90caf9';
  }
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  }
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (mins > 0) return `${hours}h ${mins}m`;
  return `${hours}h`;
}

// ─── Flush selection helpers ─────────────────────────────────────────────────

interface PageViewFlushInfo {
  activeSeconds: number;
  isFinal: boolean;
}

/**
 * Select the best flush for a pageViewId using "final-preferred, MAX fallback":
 * 1. If any isFinal=true flush exists, take the one with the highest activeSeconds.
 * 2. Otherwise fall back to the flush with the highest activeSeconds (partial).
 *
 * This prevents a late-arriving partial from overriding a proper final flush.
 */
function selectBestFlush(
  existing: PageViewFlushInfo | undefined,
  candidate: { activeSeconds: number; isFinal: boolean },
): PageViewFlushInfo {
  if (!existing) return { activeSeconds: candidate.activeSeconds, isFinal: candidate.isFinal };

  // Final always beats non-final; among same finality, take MAX
  if (candidate.isFinal && !existing.isFinal) return { activeSeconds: candidate.activeSeconds, isFinal: true };
  if (!candidate.isFinal && existing.isFinal) return existing;
  // Same finality — take higher activeSeconds
  if (candidate.activeSeconds > existing.activeSeconds) return { activeSeconds: candidate.activeSeconds, isFinal: candidate.isFinal };
  return existing;
}

/**
 * Compute per-page duration from page_time_flush events (authoritative)
 * with fallback to legacy cumulative timeOnSite deltas.
 *
 * Flush events report cumulative active time per pageViewId.
 * Selection: final-preferred, MAX fallback (see selectBestFlush).
 */
function computePerPageDuration(events: AnalyticsEvent[]): Map<string, number> {
  const result = new Map<string, number>();

  // 1. Authoritative: group flush events by pageViewId, select best
  const flushEvents = events.filter(
    (e) => e.eventType === 'page_time_flush' && e.activeSeconds != null && e.activeSeconds > 0
  );

  if (flushEvents.length > 0) {
    const pvBest = new Map<string, { seconds: number; pathname: string; isFinal: boolean }>();
    for (const flush of flushEvents) {
      const pvId = (flush as Record<string, unknown>).pageViewId as string || flush.id;
      const isFinal = !!((flush as Record<string, unknown>).isFinal);
      const existing = pvBest.get(pvId);
      const existingFlush = existing ? { activeSeconds: existing.seconds, isFinal: existing.isFinal } : undefined;
      const best = selectBestFlush(existingFlush, { activeSeconds: flush.activeSeconds!, isFinal });
      pvBest.set(pvId, { seconds: best.activeSeconds, pathname: flush.pathname || '', isFinal: best.isFinal });
    }

    // Map each pageViewId's best time to a corresponding page_view event
    const pageViews = events
      .filter((e) => e.eventType === 'page_view')
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const usedPageViews = new Set<string>();
    for (const [, { seconds, pathname }] of pvBest) {
      let attached = false;
      for (const pv of pageViews) {
        if (pv.pathname === pathname && !usedPageViews.has(pv.id)) {
          result.set(pv.id, seconds);
          usedPageViews.add(pv.id);
          attached = true;
          break;
        }
      }
      if (!attached) {
        result.set(`flush-${pathname}-${seconds}`, seconds);
      }
    }
  }

  // 2. Legacy fallback: compute deltas from cumulative timeOnSite
  const legacySorted = [...events]
    .filter((e) => e.eventType !== 'page_time_flush' && e.timeOnSite != null && e.timeOnSite > 0)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  let prevCumulative = 0;
  for (const e of legacySorted) {
    if (result.has(e.id)) continue;
    const cumulative = e.timeOnSite!;
    const delta = cumulative >= prevCumulative ? cumulative - prevCumulative : cumulative;
    if (delta > 0) result.set(e.id, delta);
    prevCumulative = cumulative;
  }

  return result;
}


function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

// ─── Aggregation ────────────────────────────────────────────────────────────

function aggregateByOrg(events: AnalyticsEvent[]): OrganizationRecord[] {
  // ── Pre-pass: build visitorId → org metadata from events that carry org data ──
  // page_time_flush events lack ip/org/orgName/country etc. We inherit those
  // from other events (page_view, product_view, etc.) sharing the same visitorId.
  const visitorOrgMap = new Map<string, {
    ip: string; org: string; orgName: string;
    country: string; region: string; city: string;
    organizationType: string; confidence: number | null; finalConfidence: number | null;
    isTargetCustomer: boolean; leadTier: string | null;
    aiOrganizationType: string | null; aiConfidence: number | null;
    latitude: number | null; longitude: number | null; isp: string;
  }>();

  for (const e of events) {
    // Only learn from events that actually carry org-identifying fields
    if (!e.ip && !e.org && !e.orgName) continue;
    const vid = (e as Record<string, unknown>).visitorId as string;
    if (!vid) continue;

    const existing = visitorOrgMap.get(vid);
    // Keep the entry with the highest finalConfidence (most enriched analysis)
    const candidateConf = e.finalConfidence ?? e.confidence ?? 0;
    const existingConf = existing ? (existing.finalConfidence ?? existing.confidence ?? 0) : -1;

    if (candidateConf > existingConf) {
      visitorOrgMap.set(vid, {
        ip: e.ip || existing?.ip || '',
        org: e.org || existing?.org || '',
        orgName: e.orgName || existing?.orgName || '',
        country: e.country || existing?.country || '',
        region: e.region || existing?.region || '',
        city: e.city || existing?.city || '',
        organizationType: e.organizationType || existing?.organizationType || '',
        confidence: e.confidence ?? existing?.confidence ?? null,
        finalConfidence: e.finalConfidence ?? existing?.finalConfidence ?? null,
        isTargetCustomer: e.isTargetCustomer || existing?.isTargetCustomer || false,
        leadTier: e.leadTier || existing?.leadTier || null,
        aiOrganizationType: e.aiOrganizationType || existing?.aiOrganizationType || null,
        aiConfidence: e.aiConfidence ?? existing?.aiConfidence ?? null,
        latitude: e.latitude ?? existing?.latitude ?? null,
        longitude: e.longitude ?? existing?.longitude ?? null,
        isp: e.isp || existing?.isp || '',
      });
    }
  }

  const groups = new Map<string, AnalyticsEvent[]>();

  for (const e of events) {
    // ── Inherit org metadata for events missing it (e.g. page_time_flush) ──
    const vid = (e as Record<string, unknown>).visitorId as string;
    const needsInheritance = !e.ip && !e.org && !e.orgName;
    const inherited = (needsInheritance && vid) ? visitorOrgMap.get(vid) : undefined;

    // Effective org fields: event's own data → inherited → default
    const effOrgName = e.orgName || inherited?.orgName || '';
    const effOrg = e.org || inherited?.org || '';
    const effIp = e.ip || inherited?.ip || '';
    const effOrgType = e.organizationType || inherited?.organizationType || '';
    const effConfidence = e.confidence ?? inherited?.confidence ?? null;
    const effIsTarget = e.isTargetCustomer || inherited?.isTargetCustomer || false;
    const effAiOrgType = e.aiOrganizationType || inherited?.aiOrganizationType || null;
    const effAiConf = e.aiConfidence ?? inherited?.aiConfidence ?? null;

    // ISP/VPN/hosting visitors: group by individual visitor to prevent
    // unrelated residential users from being lumped under one ISP name.
    // Two detection paths:
    //   1. L0_REJECT: confidence=0, unknown type, real org name
    //   2. AI-classified telecom_isp: AI identified it as ISP even if IP lookup missed it
    const orgNameVal = effOrgName || effOrg || '';
    const hasRealOrgName = !!orgNameVal && orgNameVal !== 'Unknown';
    const isAIClassifiedISP = effAiOrgType === 'telecom_isp';
    const isL0Reject = hasRealOrgName && (
      // Path 1: IP lookup rejected as ISP/unknown
      (!effIsTarget &&
        (effConfidence == null || effConfidence === 0) &&
        (!effOrgType || effOrgType === 'unknown') &&
        !(effAiConf != null && effAiConf >= 0.5 && !isAIClassifiedISP)) ||
      // Path 2: AI says telecom_isp regardless of IP confidence
      isAIClassifiedISP
    );
    const key = isL0Reject
      ? (vid || effIp || orgNameVal || 'Unknown')
      : (effOrgName || effOrg || effIp || vid || 'Unknown');
    //   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    //   Key change: when org fields are all empty and no inheritance was possible,
    //   fall back to visitorId instead of 'Unknown' — ensures per-visitor separation.
    const group = groups.get(key);
    if (group) {
      group.push(e);
    } else {
      groups.set(key, [e]);
    }
  }

  const records: OrganizationRecord[] = [];

  for (const [key, group] of groups) {
    const pages = new Set<string>();
    const products = new Set<string>();
    let totalTime = 0;
    let maxConf = 0;
    let bestTier: string | null = null;
    let isTarget = false;
    let maxPdfDownloads = 0;
    let maxReturnVisits = 0;
    let maxBehaviorScore = 0;

    // Aggregate authoritative time from page_time_flush events.
    // Selection: final-preferred, MAX fallback per pageViewId.
    // Org total = simple sum of per-pageView best active seconds.
    // Falls back to legacy timeOnSite snapshot if no flush events exist.
    const pageViewFlushMap = new Map<string, PageViewFlushInfo>(); // pageViewId → best flush
    let hasFlushEvents = false;

    for (const e of group) {
      if (e.pathname) pages.add(e.pathname);
      if (e.productName) products.add(e.productName);

      if (e.eventType === 'page_time_flush' && e.activeSeconds != null && e.activeSeconds > 0) {
        hasFlushEvents = true;
        const pvId = (e as Record<string, unknown>).pageViewId as string || e.id;
        const isFinal = !!((e as Record<string, unknown>).isFinal);
        const existing = pageViewFlushMap.get(pvId);
        pageViewFlushMap.set(pvId, selectBestFlush(existing, { activeSeconds: e.activeSeconds, isFinal }));
      }

      if (e.finalConfidence != null && e.finalConfidence > maxConf) {
        maxConf = e.finalConfidence;
      }
      if (e.leadTier && tierRank(e.leadTier) > tierRank(bestTier)) {
        bestTier = e.leadTier;
      }
      if (e.isTargetCustomer) isTarget = true;
      if (e.pdfDownloads != null && e.pdfDownloads > maxPdfDownloads) {
        maxPdfDownloads = e.pdfDownloads;
      }
      if (e.returnVisits != null && e.returnVisits > maxReturnVisits) {
        maxReturnVisits = e.returnVisits;
      }
      if (e.behaviorScore != null && e.behaviorScore > maxBehaviorScore) {
        maxBehaviorScore = e.behaviorScore;
      }

      // Legacy fallback: use timeOnSite snapshot from page_view / track events
      if (!hasFlushEvents && e.timeOnSite) {
        totalTime = Math.max(totalTime, e.timeOnSite);
      }
    }

    // Prefer authoritative page_time_flush aggregation over legacy snapshot.
    // Simple sum of per-pageView best active seconds.
    if (hasFlushEvents) {
      totalTime = 0;
      for (const pv of pageViewFlushMap.values()) {
        totalTime += pv.activeSeconds;
      }
    }

    // Use the first event with valid lat/lng
    const geoEvent = group.find((e) => e.latitude != null && e.longitude != null) || group[0];
    const sorted = group.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Clear historical tier for non-target customers (pre-fix events may have incorrect tiers)
    if (!isTarget) bestTier = null;

    // Promote AI classification when IP-based org type is unknown
    const aiEvent = group.find((e) =>
      e.aiOrganizationType && e.aiOrganizationType !== 'unknown' && e.aiConfidence != null && e.aiConfidence >= 0.5
    );
    const ipOrgType = geoEvent.organizationType || '';
    const effectiveOrgType = (ipOrgType && ipOrgType !== 'unknown') ? ipOrgType : (aiEvent?.aiOrganizationType || ipOrgType);

    // Promote AI confidence when it's higher than IP-based confidence
    if (aiEvent?.aiConfidence != null && aiEvent.aiConfidence > maxConf) {
      maxConf = aiEvent.aiConfidence;
    }

    // Compute tier from AI data when events have no tier
    const isTargetAIType = effectiveOrgType === 'university' || effectiveOrgType === 'research_institute' || effectiveOrgType === 'enterprise';
    if (!bestTier && isTargetAIType && maxConf > 0) {
      const isResearch = effectiveOrgType === 'university' || effectiveOrgType === 'research_institute';
      if (maxConf >= 0.7 && isResearch) bestTier = 'A';
      else if (maxConf >= 0.9) bestTier = 'A';
      else if (maxConf >= 0.5) bestTier = 'B';
      else if (maxConf >= 0.3) bestTier = 'C';
    }

    // Anonymous high-intent: unidentified org but strong behavioral signals
    // Exclude orgs identified by AI as a real organization (not ISP/unknown)
    const aiIdentifiedRealOrg = aiEvent && aiEvent.aiOrganizationType !== 'telecom_isp';
    const hasProductPageVisit = group.some(e => e.pathname?.startsWith('/products/'));
    const isAnonymousHighIntent = !isTarget && !bestTier && !aiIdentifiedRealOrg &&
      (
        (maxBehaviorScore >= 0.3 && (maxReturnVisits > 0 || pages.size >= 2)) ||
        (maxBehaviorScore >= 0.1 && hasProductPageVisit)
      );

    // Detect ISP visitors grouped by individual visitorId/IP
    const firstEvent = group[0];
    const ispOrgName = firstEvent.orgName || firstEvent.org || '';
    const hasRealName = !!ispOrgName && ispOrgName !== 'Unknown';
    const isAIISP = firstEvent.aiOrganizationType === 'telecom_isp';
    const isISPVisitor = hasRealName && key !== ispOrgName && (
      // Path 1: L0_REJECT ISP
      (!firstEvent.isTargetCustomer &&
        (firstEvent.confidence == null || firstEvent.confidence === 0) &&
        (!firstEvent.organizationType || firstEvent.organizationType === 'unknown') &&
        !(firstEvent.aiConfidence != null && firstEvent.aiConfidence >= 0.5 && !isAIISP)) ||
      // Path 2: AI-classified telecom_isp
      isAIISP
    );
    // Build a human-readable display name for ISP individual visitors
    const displayName = isISPVisitor
      ? `${ispOrgName} · ${[geoEvent.city, geoEvent.region].filter(Boolean).join(', ') || 'Unknown'}`
      : key;

    records.push({
      key,
      orgName: displayName,
      organizationType: effectiveOrgType,
      country: geoEvent.country || '',
      region: geoEvent.region || '',
      city: geoEvent.city || '',
      latitude: geoEvent.latitude ?? null,
      longitude: geoEvent.longitude ?? null,
      leadTier: bestTier,
      isTargetCustomer: isTarget,
      totalEvents: group.length,
      uniquePages: pages.size,
      productsViewed: Array.from(products),
      totalTimeOnSite: totalTime,
      pdfDownloads: maxPdfDownloads,
      returnVisits: maxReturnVisits,
      lastVisit: sorted[0].timestamp,
      firstVisit: sorted[sorted.length - 1].timestamp,
      maxConfidence: maxConf,
      maxBehaviorScore,
      isAnonymousHighIntent,
      isISPVisitor,
      events: sorted,
    });
  }

  // Disambiguate ISP visitors with identical display names (same ISP + same city)
  const nameCounts = new Map<string, number>();
  for (const r of records) {
    if (r.isISPVisitor) {
      nameCounts.set(r.orgName, (nameCounts.get(r.orgName) || 0) + 1);
    }
  }
  const nameIdx = new Map<string, number>();
  for (const r of records) {
    if (r.isISPVisitor && (nameCounts.get(r.orgName) || 0) > 1) {
      const idx = (nameIdx.get(r.orgName) || 0) + 1;
      nameIdx.set(r.orgName, idx);
      r.orgName = `${r.orgName} #${idx}`;
    }
  }

  return records;
}

// ─── Map Component ──────────────────────────────────────────────────────────

function VisitorMap({
  organizations,
  onSelectOrg,
  resetKey,
}: {
  organizations: OrganizationRecord[];
  onSelectOrg: (org: OrganizationRecord) => void;
  resetKey: string;
}) {
  const [tooltip, setTooltip] = useState<OrganizationRecord | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const markers = useMemo(
    () => organizations.filter((o) => o.latitude != null && o.longitude != null),
    [organizations]
  );

  const handleMouseEnter = useCallback((org: OrganizationRecord, e: React.MouseEvent) => {
    setTooltip(org);
    setTooltipPos({ x: e.clientX, y: e.clientY });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  if (markers.length === 0) {
    return (
      <div className="analytics-map-container">
        <h2 className="analytics-section-header">Visitor Map</h2>
        <div className="analytics-map-empty">
          No geo-coordinates available yet. New events will appear on the map.
        </div>
      </div>
    );
  }

  return (
    <div className="analytics-map-container">
      <h2 className="analytics-section-header">Visitor Map</h2>
      <ComposableMap
        projectionConfig={{ rotate: [-10, 0, 0], scale: 147 }}
        style={{ width: '100%', height: 'auto' }}
      >
        <ZoomableGroup key={resetKey}>
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map((geo) => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill="#e8eaed"
                  stroke="#fff"
                  strokeWidth={0.5}
                  style={{
                    default: { outline: 'none' },
                    hover: { fill: '#d5d8dc', outline: 'none' },
                    pressed: { outline: 'none' },
                  }}
                />
              ))
            }
          </Geographies>
          {markers.map((org) => (
            <Marker
              key={org.key}
              coordinates={[org.longitude!, org.latitude!]}
              onMouseEnter={(e) => handleMouseEnter(org, e as unknown as React.MouseEvent)}
              onMouseLeave={handleMouseLeave}
              onClick={() => onSelectOrg(org)}
            >
              <circle
                r={Math.max(4, Math.min(12, org.totalEvents * 1.5))}
                fill={tierColor(org.leadTier)}
                fillOpacity={0.7}
                stroke="#fff"
                strokeWidth={1}
                style={{ cursor: 'pointer' }}
              />
            </Marker>
          ))}
        </ZoomableGroup>
      </ComposableMap>
      {tooltip && (
        <div
          className="analytics-map-tooltip"
          style={{ left: tooltipPos.x + 12, top: tooltipPos.y - 40 }}
        >
          <strong>{tooltip.orgName}</strong>
          <div>
            {[tooltip.city, tooltip.region, tooltip.country].filter(Boolean).join(', ')}
          </div>
          {tooltip.leadTier && <div>Lead Tier: {tooltip.leadTier}</div>}
          <div>{tooltip.totalEvents} events</div>
          {tooltip.isTargetCustomer && <div className="analytics-tooltip-target">Target Customer</div>}
        </div>
      )}
    </div>
  );
}

// ─── Organization Detail (Intelligence Dossier) ─────────────────────────────

function maskIP(ip: string): string {
  if (ip.includes(':')) {
    // IPv6: show first 2 groups
    const parts = ip.split(':');
    return parts.slice(0, 2).join(':') + ':***';
  }
  // IPv4: mask 3rd octet
  const parts = ip.split('.');
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.***.${parts[3]}`;
  return ip;
}

function OrgDetail({ org, onBack }: { org: OrganizationRecord; onBack: () => void }) {
  const [showFullIP, setShowFullIP] = useState(false);
  const [override, setOverride] = useState<OrgOverride | null>(null);
  const [overrideLoading, setOverrideLoading] = useState(true);
  const [overrideMsg, setOverrideMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setOverrideLoading(true);
    getOrgOverride(org.orgName).then((result) => {
      if (!cancelled) setOverride(result);
    }).catch(() => {
      if (!cancelled) setOverride(null);
    }).finally(() => {
      if (!cancelled) setOverrideLoading(false);
    });
    return () => { cancelled = true; };
  }, [org.orgName]);

  async function handleOverride(isTarget: boolean) {
    setOverrideLoading(true);
    setOverrideMsg(null);
    try {
      const result = await setOrgOverride(org.orgName, isTarget);
      setOverride(result);
      setOverrideMsg({ type: 'success', text: `Marked as ${isTarget ? 'target' : 'non-target'} customer` });
    } catch {
      setOverrideMsg({ type: 'error', text: 'Failed to save override' });
    } finally {
      setOverrideLoading(false);
    }
  }

  async function handleUndoOverride() {
    setOverrideLoading(true);
    setOverrideMsg(null);
    try {
      await undoOrgOverride(org.orgName);
      // Re-fetch to get restored state
      const fresh = await getOrgOverride(org.orgName);
      setOverride(fresh);
      setOverrideMsg({ type: 'success', text: 'Override removed' });
    } catch {
      setOverrideMsg({ type: 'error', text: 'Failed to undo override' });
    } finally {
      setOverrideLoading(false);
    }
  }

  // Collect unique IPs, ISPs, User Agents, and visitor IDs
  const uniqueIPs = Array.from(new Set(org.events.map((e) => e.ip).filter(Boolean))) as string[];
  const uniqueISPs = Array.from(new Set(org.events.map((e) => e.isp).filter(Boolean))) as string[];
  const uniqueUAs = Array.from(new Set(org.events.map((e) => e.userAgent).filter(Boolean))) as string[];
  // visitorId is the preferred grouping key; fall back to IP for legacy events
  const visitorKey = (e: AnalyticsEvent) => (e as Record<string, unknown>).visitorId as string || e.ip || 'unknown';
  const uniqueVisitors = Array.from(new Set(org.events.map(visitorKey).filter((v) => v !== 'unknown')));

  const visitedContactPage = org.events.some((e) =>
    e.pathname?.includes('/contact') || e.eventName === 'Contact Form Submitted'
  );
  const downloadedPDF = org.events.some((e) =>
    e.eventType === 'pdf_download' || e.eventName === 'Product Downloaded' || e.eventName === 'Datasheet Downloaded'
  );
  const contactFormSubmitted = org.events.some((e) => e.eventType === 'contact_form');
  const uniqueProductPages = new Set(
    org.events.filter((e) => e.eventType === 'product_view' || e.pathname?.includes('/products/')).map((e) => e.pathname)
  );

  // Group events by date
  const eventsByDate = new Map<string, AnalyticsEvent[]>();
  for (const e of org.events) {
    const dateKey = new Date(e.timestamp).toLocaleDateString();
    const existing = eventsByDate.get(dateKey);
    if (existing) {
      existing.push(e);
    } else {
      eventsByDate.set(dateKey, [e]);
    }
  }

  return (
    <div className="org-detail">
      {/* Header */}
      <div className="org-detail-header">
        <button className="org-detail-back" onClick={onBack}>&larr; Back to list</button>
      </div>

      <div className="org-detail-title-row">
        <div>
          <h1 className="org-detail-name">{org.orgName}</h1>
          <div className="org-detail-subtitle">
            {org.organizationType && (
              <span className={`analytics-type-badge analytics-type-${org.organizationType}`}>
                {org.organizationType}
              </span>
            )}
            <span className="org-detail-location">
              {[org.city, org.region, org.country].filter(Boolean).join(', ')}
            </span>
            {org.leadTier && (
              <span
                className={`analytics-tier analytics-tier-${org.leadTier}`}
                style={override?.found && override?.source === 'manual' && !override?.isTargetCustomer
                  ? { textDecoration: 'line-through', opacity: 0.5 } : undefined}
              >
                Tier {org.leadTier}
              </span>
            )}
            {uniqueIPs.length > 0 && (
              <span
                className="org-detail-ip"
                onClick={() => setShowFullIP((v) => !v)}
                title={showFullIP ? 'Click to mask' : 'Click to reveal'}
              >
                {showFullIP
                  ? uniqueIPs.join(', ')
                  : uniqueIPs.map(maskIP).join(', ')}
              </span>
            )}
            {uniqueISPs.length > 0 && (
              <span className="org-detail-isp">{uniqueISPs.join(', ')}</span>
            )}
            {org.isISPVisitor && (
              <span style={{ fontSize: '0.8rem', color: '#888', fontFamily: 'monospace' }}>
                ID: {org.key.substring(0, 8)}
              </span>
            )}
          </div>
        </div>
        {org.maxConfidence > 0 && (
          <div className="org-detail-score">
            <div className="org-detail-score-value">{(org.maxConfidence * 100).toFixed(0)}%</div>
            <div className="org-detail-score-label">Confidence</div>
          </div>
        )}
      </div>

      {/* Overview Cards */}
      <div className="org-detail-overview">
        <div className="org-detail-card">
          <div className="org-detail-card-value">{new Date(org.firstVisit).toLocaleDateString()}</div>
          <div className="org-detail-card-label">First Seen</div>
        </div>
        <div className="org-detail-card">
          <div className="org-detail-card-value">{formatRelativeTime(org.lastVisit)}</div>
          <div className="org-detail-card-label">Last Seen</div>
        </div>
        <div className="org-detail-card">
          <div className="org-detail-card-value">{org.totalEvents}</div>
          <div className="org-detail-card-label">Total Events</div>
        </div>
        <div className="org-detail-card">
          <div className="org-detail-card-value">{org.uniquePages}</div>
          <div className="org-detail-card-label">Pages Viewed</div>
        </div>
        <div className="org-detail-card">
          <div className="org-detail-card-value">{org.totalTimeOnSite > 0 ? formatDuration(org.totalTimeOnSite) : 'Pending'}</div>
          <div className="org-detail-card-label">Active Time</div>
        </div>
        <div className="org-detail-card">
          <div className="org-detail-card-value">{org.returnVisits}</div>
          <div className="org-detail-card-label">Return Visits</div>
        </div>
      </div>

      {/* Behavior Signals */}
      <div className="org-detail-section">
        <h2 className="analytics-section-header">Behavior Analysis</h2>
        {org.maxBehaviorScore > 0 && (
          <div className="org-behavior-score">
            <span className="org-behavior-score-label">Behavior Score</span>
            <span className="org-behavior-score-bar">
              <span
                className="org-behavior-score-fill"
                style={{
                  width: `${Math.min(org.maxBehaviorScore * 100, 100)}%`,
                  backgroundColor: org.maxBehaviorScore >= 0.3 ? '#7b1fa2' : '#bdbdbd',
                }}
              />
            </span>
            <span className={`org-behavior-score-value${org.maxBehaviorScore >= 0.3 ? ' org-behavior-score-high' : ''}`}>
              {(org.maxBehaviorScore * 100).toFixed(0)}%
            </span>
            {org.maxBehaviorScore < 0.3 && !org.isAnonymousHighIntent && (
              <span className="org-behavior-score-hint">below 30% intent threshold</span>
            )}
          </div>
        )}
        <div className="org-detail-signals">
          {org.isTargetCustomer && (
            <div className="org-signal org-signal-hot">Target Customer Identified</div>
          )}
          {org.isAnonymousHighIntent && !(override?.found && override?.isTargetCustomer) && (
            <div className="org-signal org-signal-intent">Unknown company with high purchase intent — consider targeted engagement</div>
          )}
          {downloadedPDF && (
            <div className="org-signal org-signal-hot">Downloaded PDF / Spec Sheet</div>
          )}
          {visitedContactPage && (
            <div className="org-signal org-signal-hot">Visited Contact Page</div>
          )}
          {contactFormSubmitted && (
            <div className="org-signal org-signal-hot">Submitted Contact Form</div>
          )}
          {uniqueProductPages.size >= 3 && (
            <div className="org-signal org-signal-warm">Viewed {uniqueProductPages.size} product pages — comparing solutions</div>
          )}
          {org.returnVisits >= 3 && (
            <div className="org-signal org-signal-warm">Returning visitor ({org.returnVisits} return visits)</div>
          )}
          {org.productsViewed.length > 0 && (
            <div className="org-signal org-signal-info">
              Products of interest: {org.productsViewed.join(', ')}
            </div>
          )}
          {org.pdfDownloads > 0 && (
            <div className="org-signal org-signal-info">{org.pdfDownloads} PDF download(s)</div>
          )}
        </div>
      </div>

      {/* Detection Details */}
      {(() => {
        const aiEvent = org.events.find((e) => e.aiReason || e.aiOrganizationType);
        // Find best IP-based confidence event (before AI enrichment)
        const ipEvent = org.events.reduce<typeof org.events[0] | null>((best, e) => {
          if (e.confidence != null && (best == null || (e.confidence ?? 0) > (best.confidence ?? 0))) return e;
          return best;
        }, null);
        const ipConfidence = ipEvent?.confidence ?? 0;
        const ipOrgType = ipEvent?.organizationType || 'unknown';

        const hasAI = aiEvent && aiEvent.aiConfidence != null && aiEvent.aiOrganizationType;
        const aiUpgraded = hasAI && (aiEvent.aiConfidence ?? 0) > ipConfidence;
        const aiConfirmed = hasAI && !aiUpgraded && aiEvent.aiOrganizationType !== 'unknown';

        // Determine classification source
        const source = (() => {
          if (override?.found && override?.source === 'manual') return 'manual';
          if (hasAI && (aiEvent.aiConfidence ?? 0) >= 0.5 && aiEvent.aiOrganizationType !== 'unknown') return 'ai';
          if (ipConfidence > 0 && ipOrgType !== 'unknown') return 'keyword';
          if (org.isAnonymousHighIntent) return 'behavior';
          return 'none';
        })();

        const sourceBadge: Record<string, { label: string; className: string }> = {
          manual: { label: 'Manual Override', className: 'org-detection-badge-manual' },
          ai: { label: 'AI Classified', className: 'org-detection-badge-ai' },
          keyword: { label: 'Keyword Match', className: 'org-detection-badge-keyword' },
          behavior: { label: 'Behavior-based', className: 'org-detection-badge-behavior' },
          none: { label: 'Unclassified', className: 'org-detection-badge-none' },
        };
        const badge = sourceBadge[source];

        return (
          <div className="org-detail-section">
            <h2 className="analytics-section-header">Detection Details</h2>

            {/* Classification source badge */}
            <div className="org-detection-source">
              <span className={`org-detection-badge ${badge.className}`}>{badge.label}</span>
            </div>

            {/* IP vs AI comparison */}
            {hasAI ? (
              <div className="org-detection-comparison">
                <div className="org-detection-col">
                  <div className="org-detection-col-header">IP Lookup</div>
                  <div className="org-ai-row">
                    <span className="org-ai-label">Confidence</span>
                    <span className="org-ai-value">{(ipConfidence * 100).toFixed(0)}%</span>
                  </div>
                  <div className="org-ai-row">
                    <span className="org-ai-label">Type</span>
                    <span className="org-ai-value">{ipOrgType}</span>
                  </div>
                </div>
                <div className="org-detection-arrow">
                  {aiUpgraded ? (
                    <span className="org-detection-upgrade">↑ Upgraded</span>
                  ) : aiConfirmed ? (
                    <span className="org-detection-confirmed">✓ Confirmed</span>
                  ) : (
                    <span className="org-detection-arrow-icon">→</span>
                  )}
                </div>
                <div className="org-detection-col">
                  <div className="org-detection-col-header">AI Classification</div>
                  <div className="org-ai-row">
                    <span className="org-ai-label">Confidence</span>
                    <span className="org-ai-value">{((aiEvent.aiConfidence ?? 0) * 100).toFixed(0)}%</span>
                  </div>
                  <div className="org-ai-row">
                    <span className="org-ai-label">Type</span>
                    <span className="org-ai-value">{aiEvent.aiOrganizationType}</span>
                  </div>
                </div>
              </div>
            ) : ipConfidence > 0 ? (
              <div className="org-detail-ai-classification">
                <div className="org-ai-row">
                  <span className="org-ai-label">IP Confidence</span>
                  <span className="org-ai-value">{(ipConfidence * 100).toFixed(0)}%</span>
                </div>
                <div className="org-ai-row">
                  <span className="org-ai-label">Type</span>
                  <span className="org-ai-value">{ipOrgType}</span>
                </div>
              </div>
            ) : org.maxBehaviorScore > 0 ? (
              <div className="org-detail-ai-classification">
                <div className="org-ai-row">
                  <span className="org-ai-label">Behavior Score</span>
                  <span className="org-ai-value">{(org.maxBehaviorScore * 100).toFixed(0)}%</span>
                </div>
                <div className="org-ai-row">
                  <span className="org-ai-label">Traffic</span>
                  <span className="org-ai-value">
                    {(() => {
                      const ev = org.events.find(e => e.trafficChannel || e.referrer);
                      if (!ev) return 'unknown';
                      const ch = ev.referrer
                        ? classifyTrafficChannel({ referrer: ev.referrer })
                        : (ev.trafficChannel || 'unknown');
                      return String(ch).replace(/_/g, ' ');
                    })()}
                  </span>
                </div>
              </div>
            ) : null}

            {/* AI reason */}
            {aiEvent?.aiReason && (
              <div className="org-detection-reason">
                <span className="org-ai-label">AI Reason</span>
                <span className="org-ai-reason">{aiEvent.aiReason}</span>
              </div>
            )}

            {/* Final result */}
            <div className="org-detection-final">
              Final: {(org.maxConfidence * 100).toFixed(0)}% · {org.organizationType || 'unknown'}
              {org.isTargetCustomer && <span className="org-detection-target"> · Target</span>}
            </div>
          </div>
        );
      })()}

      {/* Classification Override */}
      {(() => {
        const isManual = override?.found && override?.source === 'manual';
        const currentIsTarget = isManual ? override?.isTargetCustomer : org.isTargetCustomer;
        const aiEvent = org.events.find((e) => e.aiReason || e.aiOrganizationType);
        const hasConflict = isManual && aiEvent?.aiConfidence != null &&
          override?.isTargetCustomer !== (aiEvent.aiConfidence >= 0.5);

        return (
          <div className="org-detail-section">
            <h2 className="analytics-section-header">Classification Override</h2>

            <div className="org-override-status">
              {isManual ? (
                <span className="org-override-badge org-override-manual">Manual Override</span>
              ) : override?.found ? (
                <span className="org-override-badge org-override-ai">AI Classified</span>
              ) : (
                <span className="org-override-badge org-override-ai">Auto Classified</span>
              )}
              <span className="org-override-target">
                {currentIsTarget ? 'Target Customer' : 'Not Target'}
              </span>
            </div>

            {/* Reason display */}
            {(override?.reason || aiEvent?.aiReason) && (
              <div style={{ fontSize: '0.85rem', color: '#666', margin: '0.4rem 0' }}>
                {isManual && override?.reason
                  ? <>Reason: {override.reason}</>
                  : aiEvent?.aiReason
                    ? <>AI: {aiEvent.aiReason}</>
                    : null}
              </div>
            )}

            {hasConflict && (
              <div className="org-override-warning">
                Manual classification conflicts with AI — AI says{' '}
                {aiEvent!.aiConfidence! >= 0.5 ? 'target' : 'not target'} ({(aiEvent!.aiConfidence! * 100).toFixed(0)}% confidence)
              </div>
            )}

            <div className="org-override-actions">
              {currentIsTarget ? (
                <button
                  className="org-override-btn org-override-btn-reject"
                  onClick={() => handleOverride(false)}
                  disabled={overrideLoading}
                >
                  Mark as Not Target
                </button>
              ) : (
                <button
                  className="org-override-btn org-override-btn-approve"
                  onClick={() => handleOverride(true)}
                  disabled={overrideLoading}
                >
                  Mark as Target
                </button>
              )}
              {isManual && (
                <button
                  className="org-override-btn org-override-btn-undo"
                  onClick={handleUndoOverride}
                  disabled={overrideLoading}
                >
                  Undo Override
                </button>
              )}
            </div>

            {overrideMsg && (
              <div className={`org-override-${overrideMsg.type}`}>{overrideMsg.text}</div>
            )}
          </div>
        );
      })()}

      {/* User Agent */}
      {uniqueUAs.length > 0 && (
        <div className="org-detail-section">
          <h2 className="analytics-section-header">User Agent</h2>
          <div className="org-detail-ua-list">
            {uniqueUAs.map((ua) => (
              <div key={ua} className="org-detail-ua-item">{ua}</div>
            ))}
          </div>
        </div>
      )}

      {/* Pages Visited */}
      {(() => {
        const pageEvents = org.events.filter((e) => e.pathname);
        const uniquePages = new Map<string, number>();
        for (const e of pageEvents) {
          uniquePages.set(e.pathname!, (uniquePages.get(e.pathname!) || 0) + 1);
        }
        return uniquePages.size > 0 ? (
          <div className="org-detail-section">
            <h2 className="analytics-section-header">Pages Visited</h2>
            <div className="org-detail-pages-list">
              {Array.from(uniquePages.entries()).map(([path, count]) => (
                <div key={path} className="org-detail-page-item">
                  <span className="org-detail-page-title">{path}</span>
                  <span className="org-detail-page-count">{count}x</span>
                </div>
              ))}
            </div>
          </div>
        ) : null;
      })()}

      {/* Traffic Sources with Channel Classification */}
      {(() => {
        const channelColors: Record<string, { bg: string; color: string; label: string }> = {
          paid_search:    { bg: '#fce4ec', color: '#c62828', label: 'Paid Search' },
          organic_search: { bg: '#e8f5e9', color: '#2e7d32', label: 'Organic Search' },
          paid_social:    { bg: '#fff3e0', color: '#e65100', label: 'Paid Social' },
          organic_social: { bg: '#e3f2fd', color: '#1565c0', label: 'Organic Social' },
          email:          { bg: '#f3e5f5', color: '#7b1fa2', label: 'Email' },
          referral:       { bg: '#e0f2f1', color: '#00695c', label: 'Referral' },
          direct:         { bg: '#f5f5f5', color: '#616161', label: 'Direct' },
        };
        const fallbackStyle = { bg: '#f5f5f5', color: '#616161', label: 'Other' };
        const sources = new Map<string, { count: number; channel: TrafficChannel; label: string }>();
        for (const e of org.events) {
          const storedCh = e.trafficChannel as TrafficChannel | undefined;
          const derivedCh = classifyTrafficChannel({ referrer: e.referrer || undefined });
          // Always prefer re-derived channel when referrer is available (fixes historical misclassification from substring matching bug)
          const channel: TrafficChannel = e.referrer ? derivedCh : (storedCh || derivedCh);
          const hostname = e.referrer
            ? (() => { try { return new URL(e.referrer).hostname; } catch { return e.referrer; } })()
            : '';
          // Group by channel + hostname so paid vs organic from the same domain are separate
          const groupKey = hostname ? `${channel}::${hostname}` : channel;
          const displayLabel = hostname || (channelColors[channel] || fallbackStyle).label;
          const existing = sources.get(groupKey);
          if (existing) {
            existing.count += 1;
          } else {
            sources.set(groupKey, { count: 1, channel, label: displayLabel });
          }
        }
        return sources.size > 0 ? (
          <div className="org-detail-section">
            <h2 className="analytics-section-header">Traffic Sources</h2>
            <div className="org-detail-signals">
              {Array.from(sources.entries())
                .sort((a, b) => b[1].count - a[1].count)
                .map(([groupKey, { count, channel, label: displayLabel }]) => {
                  const style = channelColors[channel] || fallbackStyle;
                  return (
                    <div key={groupKey} className="org-signal org-signal-info">
                      <span
                        className="analytics-badge"
                        style={{ background: style.bg, color: style.color, marginRight: '0.5rem', fontSize: '0.7rem', padding: '2px 6px', borderRadius: '3px' }}
                      >
                        {style.label}
                      </span>
                      {displayLabel} ({count} visit{count > 1 ? 's' : ''})
                    </div>
                  );
                })}
            </div>
          </div>
        ) : null;
      })()}

      {/* Visit Timeline — grouped by visitor (visitorId → IP fallback) */}
      <div className="org-detail-section">
        <h2 className="analytics-section-header">
          Visit Timeline
          {uniqueVisitors.length > 1 && <span className="analytics-filter-badge">{uniqueVisitors.length} visitors</span>}
        </h2>
        <div className="org-detail-timeline">
          {(() => {
            // Pre-compute per-page durations (delta from cumulative timeOnSite)
            const perPageDurations = computePerPageDuration(org.events);

            // Group events by visitorId (preferred) → IP (fallback for legacy events)
            const byVisitor = new Map<string, AnalyticsEvent[]>();
            for (const e of org.events) {
              const key = visitorKey(e);
              const group = byVisitor.get(key);
              if (group) group.push(e);
              else byVisitor.set(key, [e]);
            }
            // If only 1 visitor, no need for visitor headers — just show by date
            // Helper: build referrer badge for the first event of a visitor
            const channelColorsTimeline: Record<string, { bg: string; color: string; label: string }> = {
              paid_search:    { bg: '#fce4ec', color: '#c62828', label: 'Paid Search' },
              organic_search: { bg: '#e8f5e9', color: '#2e7d32', label: 'Organic Search' },
              paid_social:    { bg: '#fff3e0', color: '#e65100', label: 'Paid Social' },
              organic_social: { bg: '#e3f2fd', color: '#1565c0', label: 'Organic Social' },
              email:          { bg: '#f3e5f5', color: '#7b1fa2', label: 'Email' },
              referral:       { bg: '#e0f2f1', color: '#00695c', label: 'Referral' },
              direct:         { bg: '#f5f5f5', color: '#616161', label: 'Direct' },
            };
            const fallbackChannelStyle = { bg: '#f5f5f5', color: '#616161', label: 'Other' };
            // Check if an event has an external referrer (not self-referrer)
            const hasExternalReferrer = (e: AnalyticsEvent): boolean => {
              if (!e.referrer) return false;
              try {
                const host = new URL(e.referrer).hostname.toLowerCase();
                // Filter out self-referrers (own site)
                return !host.includes('ninescrolls') && !host.includes('localhost') && !host.includes('127.0.0.1');
              } catch { return false; }
            };
            const referrerBadge = (e: AnalyticsEvent) => {
              const derivedCh = classifyTrafficChannel({ referrer: e.referrer || undefined });
              const channel: TrafficChannel = e.referrer ? derivedCh : ((e.trafficChannel as TrafficChannel) || derivedCh);
              const style = channelColorsTimeline[channel] || fallbackChannelStyle;
              const label = e.referrer
                ? (() => { try { return new URL(e.referrer).hostname; } catch { return e.referrer; } })()
                : style.label;
              return (
                <>
                  <span className="timeline-referrer" style={{ background: style.bg, color: style.color, padding: '1px 6px', borderRadius: '4px', fontSize: '11px', marginLeft: '4px' }}>
                    {label}
                  </span>
                  {e.utmTerm && (
                    <span className="timeline-keyword" style={{ background: '#fff8e1', color: '#f57f17', padding: '1px 6px', borderRadius: '4px', fontSize: '11px', marginLeft: '4px' }}>
                      🔍 {e.utmTerm}
                    </span>
                  )}
                </>
              );
            };

            // Only show referrer badge on the entry event (earliest per visitor) — in a SPA,
            // document.referrer persists across client-side navigations so all events carry the same external referrer.
            const entryEventIds = new Set<string>();
            for (const [, vEvents] of byVisitor) {
              const externalEvents = vEvents.filter(hasExternalReferrer);
              if (externalEvents.length > 0) {
                const earliest = externalEvents.reduce((a, b) =>
                  new Date(a.timestamp).getTime() < new Date(b.timestamp).getTime() ? a : b
                );
                entryEventIds.add(earliest.id);
              }
            }

            if (byVisitor.size <= 1) {
              return Array.from(eventsByDate.entries()).map(([date, events]) => (
                <div key={date} className="timeline-day">
                  <div className="timeline-date">{date}</div>
                  {events.map((e) => {
                    const pageDuration = perPageDurations.get(e.id);
                    return (
                    <div key={e.id} className="timeline-event">
                      <span className="timeline-time">
                        {new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                      <span className={`analytics-badge analytics-badge-${e.eventType}`}>
                        {e.eventType}
                      </span>
                      {e.eventType === 'page_time_flush' ? (
                        <>
                          <span className="timeline-path">{e.pathname || '/'}</span>
                          {e.activeSeconds != null && (
                            <span className="timeline-flush-detail" style={{ fontSize: '11px', color: '#666', marginLeft: '6px' }}>
                              {formatDuration(e.activeSeconds)} active
                              {e.idleSeconds != null && e.idleSeconds > 0 && <> · {formatDuration(e.idleSeconds)} idle</>}
                              {e.hiddenSeconds != null && e.hiddenSeconds > 0 && <> · {formatDuration(e.hiddenSeconds)} hidden</>}
                            </span>
                          )}
                          {(e as Record<string, unknown>).isFinal && (
                            <span style={{ background: '#e8f5e9', color: '#2e7d32', padding: '1px 5px', borderRadius: '4px', fontSize: '10px', marginLeft: '4px', fontWeight: 500 }}>final</span>
                          )}
                          {(e as Record<string, unknown>).isFinal === false && (
                            <span style={{ background: '#fff3e0', color: '#e65100', padding: '1px 5px', borderRadius: '4px', fontSize: '10px', marginLeft: '4px', fontWeight: 500 }}>partial</span>
                          )}
                          {e.flushReason && (
                            <span style={{ fontSize: '10px', color: '#999', marginLeft: '4px' }}>{e.flushReason}</span>
                          )}
                        </>
                      ) : (
                        <>
                          <span className="timeline-path">{e.eventType === 'page_view' ? (e.pathname || e.eventName) : (e.eventName || e.pathname)}</span>
                          {e.productName && (
                            <span className="timeline-product">{e.productName}</span>
                          )}
                          {pageDuration != null && pageDuration > 0 && (
                            <span className="timeline-duration">{formatDuration(pageDuration)}</span>
                          )}
                          {entryEventIds.has(e.id) && referrerBadge(e)}
                        </>
                      )}
                    </div>
                    );
                  })}
                </div>
              ));
            }
            // Multiple visitors — group by visitor
            return Array.from(byVisitor.entries()).map(([vKey, events], idx) => {
              const ip = events.find((e) => e.ip)?.ip || '';
              const ua = events.find((e) => e.userAgent)?.userAgent || '';
              const shortUA = ua.includes('Chrome') ? 'Chrome' : ua.includes('Firefox') ? 'Firefox' : ua.includes('Safari') ? 'Safari' : ua.includes('Edge') ? 'Edge' : ua.split('/')[0] || '';
              const visitorDateGroups = new Map<string, AnalyticsEvent[]>();
              for (const e of events) {
                const dk = new Date(e.timestamp).toLocaleDateString();
                const g = visitorDateGroups.get(dk);
                if (g) g.push(e);
                else visitorDateGroups.set(dk, [e]);
              }
              return (
                <div key={vKey} className="timeline-visitor">
                  <div className="timeline-visitor-header">
                    <span className="timeline-visitor-label">Visitor {idx + 1}</span>
                    {ip && (
                      <span className="timeline-visitor-ip" onClick={() => setShowFullIP((v) => !v)}>
                        {showFullIP ? ip : maskIP(ip)}
                      </span>
                    )}
                    {shortUA && <span className="timeline-visitor-ua">{shortUA}</span>}
                    <span className="timeline-visitor-count">{events.length} events</span>
                    {vKey && !vKey.includes('.') && <span className="timeline-visitor-vid" title={vKey}>{vKey.slice(0, 8)}</span>}
                  </div>
                  {Array.from(visitorDateGroups.entries()).map(([date, devts]) => (
                    <div key={date} className="timeline-day">
                      <div className="timeline-date">{date}</div>
                      {devts.map((e) => {
                        const pageDuration = perPageDurations.get(e.id);
                        return (
                        <div key={e.id} className="timeline-event">
                          <span className="timeline-time">
                            {new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                          <span className={`analytics-badge analytics-badge-${e.eventType}`}>
                            {e.eventType}
                          </span>
                          <span className="timeline-path">{e.eventType === 'page_view' ? (e.pathname || e.eventName) : (e.eventName || e.pathname)}</span>
                          {e.productName && (
                            <span className="timeline-product">{e.productName}</span>
                          )}
                          {pageDuration != null && pageDuration > 0 && (
                            <span className="timeline-duration">{formatDuration(pageDuration)}</span>
                          )}
                          {entryEventIds.has(e.id) && referrerBadge(e)}
                        </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              );
            });
          })()}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export function AdminAnalyticsPage() {
  const [allEvents, setAllEvents] = useState<AnalyticsEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);
  const [error, setError] = useState('');
  const [dateRange, setDateRange] = useState<DateRange>('last7');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [showBots, setShowBots] = useState(false);
  const [sortCol, setSortCol] = useState<SortColumn>('lastVisit');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [selectedOrg, setSelectedOrg] = useState<OrganizationRecord | null>(null);
  const [kpiFilter, setKpiFilter] = useState<KpiFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshing, setRefreshing] = useState(false); // soft refresh indicator
  const [orgOverrides, setOrgOverrides] = useState<OrgOverrideSummary[]>([]);
  const prevDateRange = useRef(dateRange);
  const prevCustomStart = useRef(customStart);
  const prevCustomEnd = useRef(customEnd);

  // Select org with browser history support
  const selectOrg = useCallback((org: OrganizationRecord | null) => {
    if (org) {
      window.history.pushState({ orgDetail: true }, '');
    }
    setSelectedOrg(org);
  }, []);

  // Browser back button → close dossier
  useEffect(() => {
    function handlePopState() {
      setSelectedOrg(null);
    }
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Load all events within date range.
  // Date range change → full loading spinner. Refresh key bump → soft background update.
  useEffect(() => {
    let cancelled = false;
    const dateChanged = dateRange !== prevDateRange.current
      || customStart !== prevCustomStart.current
      || customEnd !== prevCustomEnd.current;
    prevDateRange.current = dateRange;
    prevCustomStart.current = customStart;
    prevCustomEnd.current = customEnd;

    // Soft refresh: keep existing data visible when only refreshKey changed
    const isSoftRefresh = !dateChanged && allEvents.length > 0;

    async function loadAllEvents() {
      if (isSoftRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
        setAllEvents([]);
        setLoadProgress(0);
      }
      setError('');

      const { start, end } = getDateBounds(dateRange, customStart, customEnd);
      const startISO = start.toISOString();
      const endISO = end.toISOString();

      // All known event types — one GSI query per type, run in parallel.
      // Uses the eventType+timestamp GSI instead of a full table scan.
      const EVENT_TYPES = [
        'page_view', 'page_time_flush', 'product_view', 'pdf_download',
        'contact_form', 'target_customer', 'search', 'add_to_cart',
        'purchase', 'rfq_step', 'other', 'anomaly',
      ];

      async function queryByType(eventType: string): Promise<AnalyticsEvent[]> {
        const results: AnalyticsEvent[] = [];
        let nextToken: string | undefined;

        do {
          if (cancelled) return results;

          const result = await (client.models.AnalyticsEvent as any)
            .listAnalyticsEventByEventTypeAndTimestamp(
              { eventType, timestamp: { between: [startISO, endISO] } },
              { authMode: 'userPool', limit: 500, nextToken },
            );

          const events = (result.data || []) as AnalyticsEvent[];
          results.push(...events);
          nextToken = result.nextToken || undefined;
        } while (nextToken);

        return results;
      }

      try {
        const perType = await Promise.all(EVENT_TYPES.map(queryByType));

        if (cancelled) return;

        const collected = perType.flat();
        if (!isSoftRefresh) setLoadProgress(collected.length);
        setAllEvents(collected);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load events');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    }

    loadAllEvents();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange, customStart, customEnd, refreshKey]);

  // Load manual overrides from classify-org Lambda
  useEffect(() => {
    let cancelled = false;
    listOrgOverrides()
      .then((overrides) => { if (!cancelled) setOrgOverrides(overrides); })
      .catch((err) => console.warn('Failed to load overrides:', err));
    return () => { cancelled = true; };
  }, [refreshKey]);

  // Auto-refresh every 30s
  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => setRefreshKey((k) => k + 1), 30000);
    return () => clearInterval(timer);
  }, [autoRefresh]);

  // Filter bots — by isBot flag OR known bot org name
  const filteredEvents = useMemo(() => {
    if (showBots) return allEvents;
    return allEvents.filter((e) => {
      if (e.isBot) return false;
      const orgKey = e.orgName || e.org || '';
      if (orgKey && isKnownBotOrg(orgKey)) return false;
      return true;
    });
  }, [allEvents, showBots]);

  const botCount = useMemo(() => {
    return allEvents.filter((e) => {
      if (e.isBot) return true;
      const orgKey = e.orgName || e.org || '';
      return orgKey ? isKnownBotOrg(orgKey) : false;
    }).length;
  }, [allEvents]);

  // Aggregate by organization, then apply manual overrides
  const organizations = useMemo(() => {
    const orgs = aggregateByOrg(filteredEvents);
    if (orgOverrides.length === 0) return orgs;

    // Build lookup map for O(1) override matching
    const overrideMap = new Map<string, OrgOverrideSummary>();
    for (const ov of orgOverrides) {
      overrideMap.set(ov.orgName, ov);
    }

    for (const org of orgs) {
      const ov = overrideMap.get(org.orgName);
      if (!ov) continue;

      // Apply manual override data
      org.isTargetCustomer = ov.isTargetCustomer;
      if (ov.organizationType && ov.organizationType !== 'unknown') {
        org.organizationType = ov.organizationType;
      }
      if (ov.confidence > org.maxConfidence) {
        org.maxConfidence = ov.confidence;
      }

      // Compute tier for manually-marked target customers
      if (ov.isTargetCustomer && !org.leadTier) {
        const conf = Math.max(org.maxConfidence, ov.confidence);
        const isResearch = org.organizationType === 'university' || org.organizationType === 'research_institute';
        if (conf >= 0.7 && isResearch) org.leadTier = 'A';
        else if (conf >= 0.9) org.leadTier = 'A';
        else if (conf >= 0.5) org.leadTier = 'B';
        else if (conf >= 0.3) org.leadTier = 'C';
        else org.leadTier = 'B'; // Manual override defaults to at least B
      }

      // Clear anonymous intent — manually classified orgs are not anonymous
      org.isAnonymousHighIntent = false;
    }

    return orgs;
  }, [filteredEvents, orgOverrides]);

  // Apply KPI filter
  const filteredOrgs = useMemo(() => {
    switch (kpiFilter) {
      case 'target':
        return organizations.filter((o) => o.isTargetCustomer);
      case 'university':
        return organizations.filter((o) =>
          o.organizationType === 'university' || o.organizationType === 'research_institute'
        );
      case 'enterprise':
        return organizations.filter((o) => o.organizationType === 'enterprise');
      case 'hotLead':
        return organizations.filter((o) => o.leadTier === 'A');
      case 'returning':
        return organizations.filter((o) => o.returnVisits > 0);
      case 'anonymousIntent':
        return organizations.filter((o) => o.isAnonymousHighIntent);
      default:
        return organizations;
    }
  }, [organizations, kpiFilter]);

  // Apply search filter
  const searchedOrgs = useMemo(() => {
    if (!searchQuery.trim()) return filteredOrgs;
    const q = searchQuery.toLowerCase();
    return filteredOrgs.filter((o) =>
      o.orgName.toLowerCase().includes(q) ||
      o.organizationType.toLowerCase().includes(q) ||
      o.city.toLowerCase().includes(q) ||
      o.country.toLowerCase().includes(q) ||
      o.productsViewed.some((p) => p.toLowerCase().includes(q))
    );
  }, [filteredOrgs, searchQuery]);

  // Sort organizations
  const sortedOrgs = useMemo(() => {
    return [...searchedOrgs].sort((a, b) => {
      let cmp = 0;
      switch (sortCol) {
        case 'orgName':
          cmp = a.orgName.localeCompare(b.orgName);
          break;
        case 'organizationType':
          cmp = a.organizationType.localeCompare(b.organizationType);
          break;
        case 'country':
          cmp = (a.city + a.country).localeCompare(b.city + b.country);
          break;
        case 'totalEvents':
          cmp = a.totalEvents - b.totalEvents;
          break;
        case 'uniquePages':
          cmp = a.uniquePages - b.uniquePages;
          break;
        case 'totalTimeOnSite':
          cmp = a.totalTimeOnSite - b.totalTimeOnSite;
          break;
        case 'leadTier':
          cmp = tierRank(a.leadTier) - tierRank(b.leadTier);
          break;
        case 'maxConfidence':
          cmp = a.maxConfidence - b.maxConfidence;
          break;
        case 'lastVisit':
          cmp = new Date(a.lastVisit).getTime() - new Date(b.lastVisit).getTime();
          break;
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });
  }, [searchedOrgs, sortCol, sortDir]);

  // KPI stats with trend (compare first half vs second half of period)
  const kpis = useMemo(() => {
    const uniqueVisitors = organizations.length;
    const targetCustomers = organizations.filter((o) => o.isTargetCustomer).length;
    const universities = organizations.filter((o) =>
      o.organizationType === 'university' || o.organizationType === 'research_institute'
    ).length;
    const hotLeads = organizations.filter((o) => o.leadTier === 'A').length;
    const returning = organizations.filter((o) => o.returnVisits > 0).length;
    const companies = organizations.filter((o) => o.organizationType === 'enterprise').length;
    const anonymousIntent = organizations.filter((o) => o.isAnonymousHighIntent).length;

    // Compute trend: split filtered events by midpoint of date range
    const { start, end } = getDateBounds(dateRange, customStart, customEnd);
    const mid = new Date((start.getTime() + end.getTime()) / 2);
    const firstHalf = filteredEvents.filter((e) => new Date(e.timestamp).getTime() < mid.getTime());
    const secondHalf = filteredEvents.filter((e) => new Date(e.timestamp).getTime() >= mid.getTime());
    const firstOrgs = new Set(firstHalf.map((e) => e.orgName || e.org || e.ip));
    const secondOrgs = new Set(secondHalf.map((e) => e.orgName || e.org || e.ip));
    const prevVisitors = firstOrgs.size;
    const currVisitors = secondOrgs.size;
    const visitorTrend = prevVisitors > 0
      ? Math.round(((currVisitors - prevVisitors) / prevVisitors) * 100)
      : currVisitors > 0 ? 100 : 0;

    return { uniqueVisitors, targetCustomers, universities, hotLeads, returning, companies, anonymousIntent, visitorTrend };
  }, [organizations, filteredEvents, dateRange, customStart, customEnd]);

  function exportCSV() {
    const headers = ['Organization', 'Type', 'Location', 'Products', 'Pages', 'Active Time (s)', 'Events', 'Tier', 'Confidence', 'Last Visit'];
    const rows = sortedOrgs.map((o) => [
      o.orgName,
      o.organizationType || '',
      [o.city, o.region, o.country].filter(Boolean).join(', '),
      o.productsViewed.join('; '),
      o.uniquePages,
      o.totalTimeOnSite,
      o.totalEvents,
      o.leadTier || '',
      o.maxConfidence > 0 ? `${(o.maxConfidence * 100).toFixed(0)}%` : '',
      o.lastVisit,
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-${dateRange}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleSort(col: SortColumn) {
    if (sortCol === col) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortCol(col);
      setSortDir('desc');
    }
  }

  function sortIndicator(col: SortColumn) {
    if (sortCol !== col) return '';
    return sortDir === 'desc' ? ' \u25BC' : ' \u25B2';
  }

  if (loading) {
    return (
      <div className="admin-loading">
        Loading analytics...{loadProgress > 0 ? ` (${loadProgress} events)` : ''}
      </div>
    );
  }

  // Show detail view if an org is selected
  if (selectedOrg) {
    return (
      <div className="admin-analytics">
        <OrgDetail org={selectedOrg} onBack={() => history.back()} />
      </div>
    );
  }

  return (
    <div className="admin-analytics">
      <div className="admin-list-header">
        <h1>Market Intelligence</h1>
      </div>

      {/* Date Range Selector + Bot Toggle */}
      <div className="analytics-date-range">
        {DATE_RANGES.map((r) => (
          <button
            key={r.value}
            className={`analytics-date-btn ${dateRange === r.value ? 'active' : ''}`}
            onClick={() => setDateRange(r.value)}
          >
            {r.label}
          </button>
        ))}
        {dateRange === 'custom' && (
          <div className="analytics-custom-dates">
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="analytics-date-input"
            />
            <span className="analytics-date-separator">to</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="analytics-date-input"
            />
          </div>
        )}
        <label className="analytics-toggle">
          <input
            type="checkbox"
            checked={showBots}
            onChange={(e) => setShowBots(e.target.checked)}
          />
          <span className="analytics-toggle-slider" />
          <span className="analytics-toggle-label">Bots ({botCount})</span>
        </label>
        <div className="analytics-refresh-group">
          <button
            className={`analytics-refresh-btn ${refreshing ? 'refreshing' : ''}`}
            onClick={() => setRefreshKey((k) => k + 1)}
            title="Refresh data"
            disabled={refreshing}
          >
            ↻
          </button>
          <label className="analytics-toggle">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            <span className="analytics-toggle-slider" />
            <span className="analytics-toggle-label">Auto 30s</span>
          </label>
        </div>
      </div>

      {error && <div className="admin-error">{error}</div>}

      {/* KPI Cards — click to filter table */}
      <div className="analytics-stats-grid">
        <div
          className={`analytics-stat-card analytics-stat-clickable ${kpiFilter === 'all' ? 'analytics-stat-active' : ''}`}
          onClick={() => setKpiFilter('all')}
        >
          <div className="analytics-stat-value">{kpis.uniqueVisitors}</div>
          <div className="analytics-stat-label">Unique Visitors</div>
          {dateRange !== 'all' && kpis.visitorTrend !== 0 && (
            <div className={`analytics-stat-trend ${kpis.visitorTrend > 0 ? 'trend-up' : 'trend-down'}`}>
              {kpis.visitorTrend > 0 ? '+' : ''}{kpis.visitorTrend}% vs prev
            </div>
          )}
        </div>
        <div
          className={`analytics-stat-card analytics-stat-highlight analytics-stat-clickable ${kpiFilter === 'target' ? 'analytics-stat-active' : ''}`}
          onClick={() => setKpiFilter(kpiFilter === 'target' ? 'all' : 'target')}
        >
          <div className="analytics-stat-value">{kpis.targetCustomers}</div>
          <div className="analytics-stat-label">Target Customers</div>
        </div>
        <div
          className={`analytics-stat-card analytics-stat-tier-a analytics-stat-clickable ${kpiFilter === 'university' ? 'analytics-stat-active' : ''}`}
          onClick={() => setKpiFilter(kpiFilter === 'university' ? 'all' : 'university')}
        >
          <div className="analytics-stat-value">{kpis.universities}</div>
          <div className="analytics-stat-label">Universities / Labs</div>
        </div>
        <div
          className={`analytics-stat-card analytics-stat-clickable ${kpiFilter === 'enterprise' ? 'analytics-stat-active' : ''}`}
          onClick={() => setKpiFilter(kpiFilter === 'enterprise' ? 'all' : 'enterprise')}
        >
          <div className="analytics-stat-value">{kpis.companies}</div>
          <div className="analytics-stat-label">Companies</div>
        </div>
        <div
          className={`analytics-stat-card analytics-stat-tier-b analytics-stat-clickable ${kpiFilter === 'hotLead' ? 'analytics-stat-active' : ''}`}
          onClick={() => setKpiFilter(kpiFilter === 'hotLead' ? 'all' : 'hotLead')}
        >
          <div className="analytics-stat-value">{kpis.hotLeads}</div>
          <div className="analytics-stat-label">Hot Leads (A)</div>
        </div>
        <div
          className={`analytics-stat-card analytics-stat-clickable ${kpiFilter === 'returning' ? 'analytics-stat-active' : ''}`}
          onClick={() => setKpiFilter(kpiFilter === 'returning' ? 'all' : 'returning')}
        >
          <div className="analytics-stat-value">{kpis.returning}</div>
          <div className="analytics-stat-label">Returning Visitors</div>
        </div>
        {kpis.anonymousIntent > 0 && (
          <div
            className={`analytics-stat-card analytics-stat-intent analytics-stat-clickable ${kpiFilter === 'anonymousIntent' ? 'analytics-stat-active' : ''}`}
            onClick={() => setKpiFilter(kpiFilter === 'anonymousIntent' ? 'all' : 'anonymousIntent')}
          >
            <div className="analytics-stat-value">{kpis.anonymousIntent}</div>
            <div className="analytics-stat-label">Anonymous Intent</div>
          </div>
        )}
      </div>

      {/* World Map — click markers to view org detail */}
      <VisitorMap organizations={filteredOrgs} onSelectOrg={selectOrg} resetKey={kpiFilter} />

      {/* Event Count */}
      <div className="analytics-controls-row">
        <span className="analytics-event-count">
          {filteredEvents.length} events from {organizations.length} visitors
        </span>
      </div>

      {/* Search & Export */}
      <div className="analytics-toolbar">
        <input
          type="text"
          className="analytics-search"
          placeholder="Search organizations..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <button className="analytics-export-btn" onClick={exportCSV}>
          Export CSV
        </button>
      </div>

      {/* Organization Table */}
      <h2 className="analytics-section-header">
        Visitor Organizations
        {kpiFilter !== 'all' && (
          <span className="analytics-filter-badge">
            Filtered
            <button className="analytics-filter-clear" onClick={() => setKpiFilter('all')}>
              &times;
            </button>
          </span>
        )}
      </h2>
      <div className="analytics-table-wrapper">
        <table className="admin-table analytics-org-table">
          <thead>
            <tr>
              <th onClick={() => handleSort('orgName')}>
                Organization{sortIndicator('orgName')}
              </th>
              <th onClick={() => handleSort('organizationType')}>
                Type{sortIndicator('organizationType')}
              </th>
              <th onClick={() => handleSort('country')}>
                Location{sortIndicator('country')}
              </th>
              <th>Products</th>
              <th onClick={() => handleSort('uniquePages')}>
                Pages{sortIndicator('uniquePages')}
              </th>
              <th onClick={() => handleSort('totalTimeOnSite')}>
                Active Time{sortIndicator('totalTimeOnSite')}
              </th>
              <th onClick={() => handleSort('totalEvents')}>
                Events{sortIndicator('totalEvents')}
              </th>
              <th onClick={() => handleSort('leadTier')}>
                Tier{sortIndicator('leadTier')}
              </th>
              <th onClick={() => handleSort('maxConfidence')}>
                Confidence{sortIndicator('maxConfidence')}
              </th>
              <th onClick={() => handleSort('lastVisit')}>
                Last Visit{sortIndicator('lastVisit')}
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedOrgs.map((org) => (
              <tr
                key={org.key}
                className={`analytics-org-row ${org.isTargetCustomer ? 'analytics-target-row' : ''} ${
                  org.leadTier ? `tier-border-${org.leadTier}` : org.isAnonymousHighIntent ? 'tier-border-intent' : ''
                }`}
                onClick={() => selectOrg(org)}
              >
                <td>
                  <div className="analytics-org-primary">{org.orgName}</div>
                  {org.isISPVisitor && (
                    <div className="analytics-org-secondary" style={{ fontSize: '0.75rem', color: '#999', marginTop: '2px' }}>
                      ISP individual visitor · ID: {org.key.substring(0, 8)}
                    </div>
                  )}
                </td>
                <td>
                  {org.organizationType ? (
                    <span className={`analytics-type-badge analytics-type-${org.organizationType}`}>
                      {org.organizationType}
                    </span>
                  ) : (
                    <span className="analytics-na">N/A</span>
                  )}
                </td>
                <td className="analytics-geo">
                  {[org.city, org.region, org.country].filter(Boolean).join(', ') || <span className="analytics-na">N/A</span>}
                </td>
                <td>
                  {org.productsViewed.length > 0
                    ? org.productsViewed.join(', ')
                    : <span className="analytics-na">N/A</span>}
                </td>
                <td>{org.uniquePages}</td>
                <td>{org.totalTimeOnSite > 0 ? formatDuration(org.totalTimeOnSite) : <span className="analytics-na" title="No time data yet — visitor may still be on site">Pending</span>}</td>
                <td>{org.totalEvents}</td>
                <td>
                  {org.leadTier ? (
                    <span className={`analytics-tier analytics-tier-${org.leadTier}`}>
                      {org.leadTier}
                    </span>
                  ) : org.isAnonymousHighIntent ? (
                    <span className="analytics-tier analytics-tier-intent">Intent</span>
                  ) : (
                    <span className="analytics-na">N/A</span>
                  )}
                </td>
                <td>
                  {org.maxConfidence > 0
                    ? `${(org.maxConfidence * 100).toFixed(0)}%`
                    : <span className="analytics-na">N/A</span>}
                </td>
                <td className="analytics-timestamp">{formatRelativeTime(org.lastVisit)}</td>
              </tr>
            ))}
            {sortedOrgs.length === 0 && (
              <tr>
                <td colSpan={10} className="admin-no-results">
                  No visitor data for this period.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
