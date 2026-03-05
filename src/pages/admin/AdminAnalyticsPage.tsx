import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { getOrgOverride, setOrgOverride, undoOrgOverride, type OrgOverride } from '../../services/adminClassificationService';
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
  events: AnalyticsEvent[];
}

type DateRange = 'today' | 'yesterday' | 'last7' | 'last30' | 'all' | 'custom';
type SortColumn = 'orgName' | 'organizationType' | 'country' | 'totalEvents' | 'uniquePages' | 'totalTimeOnSite' | 'leadTier' | 'maxConfidence' | 'lastVisit';
type KpiFilter = 'all' | 'target' | 'university' | 'enterprise' | 'hotLead' | 'returning';

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

/**
 * Compute per-page duration from cumulative timeOnSite values.
 * Events with timeOnSite store a running total; this returns the delta
 * (time spent on that specific page) for each event.
 */
function computePerPageDuration(events: AnalyticsEvent[]): Map<string, number> {
  const result = new Map<string, number>();
  // Sort chronologically (oldest first) to compute deltas
  const sorted = [...events]
    .filter((e) => e.timeOnSite != null && e.timeOnSite > 0)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  let prevCumulative = 0;
  for (const e of sorted) {
    const cumulative = e.timeOnSite!;
    // If cumulative < prev, the counter was reset (e.g. cleared localStorage)
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
  const groups = new Map<string, AnalyticsEvent[]>();

  for (const e of events) {
    const key = e.orgName || e.org || e.ip || 'Unknown';
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

    for (const e of group) {
      if (e.pathname) pages.add(e.pathname);
      if (e.productName) products.add(e.productName);
      if (e.timeOnSite) totalTime = Math.max(totalTime, e.timeOnSite);
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
    }

    // Use the first event with valid lat/lng
    const geoEvent = group.find((e) => e.latitude != null && e.longitude != null) || group[0];
    const sorted = group.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    records.push({
      key,
      orgName: key,
      organizationType: geoEvent.organizationType || '',
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
      events: sorted,
    });
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
              <span className={`analytics-tier analytics-tier-${org.leadTier}`}>
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
          <div className="org-detail-card-value">{org.totalTimeOnSite > 0 ? formatDuration(org.totalTimeOnSite) : '-'}</div>
          <div className="org-detail-card-label">Time on Site</div>
        </div>
        <div className="org-detail-card">
          <div className="org-detail-card-value">{org.returnVisits}</div>
          <div className="org-detail-card-label">Return Visits</div>
        </div>
      </div>

      {/* Behavior Signals */}
      <div className="org-detail-section">
        <h2 className="analytics-section-header">Behavior Analysis</h2>
        <div className="org-detail-signals">
          {org.isTargetCustomer && (
            <div className="org-signal org-signal-hot">Target Customer Identified</div>
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

      {/* AI Classification */}
      {(() => {
        const aiEvent = org.events.find((e) => e.aiReason || e.aiOrganizationType);
        return aiEvent ? (
          <div className="org-detail-section">
            <h2 className="analytics-section-header">AI Classification</h2>
            <div className="org-detail-ai-classification">
              {aiEvent.aiOrganizationType && (
                <div className="org-ai-row">
                  <span className="org-ai-label">Type</span>
                  <span className="org-ai-value">{aiEvent.aiOrganizationType}</span>
                </div>
              )}
              {aiEvent.aiConfidence != null && (
                <div className="org-ai-row">
                  <span className="org-ai-label">Confidence</span>
                  <span className="org-ai-value">{(aiEvent.aiConfidence * 100).toFixed(0)}%</span>
                </div>
              )}
              {aiEvent.aiReason && (
                <div className="org-ai-row">
                  <span className="org-ai-label">Reason</span>
                  <span className="org-ai-value org-ai-reason">{aiEvent.aiReason}</span>
                </div>
              )}
            </div>
          </div>
        ) : null;
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
        const channelColors: Record<TrafficChannel, { bg: string; color: string; label: string }> = {
          paid_search:    { bg: '#fce4ec', color: '#c62828', label: 'Paid Search' },
          organic_search: { bg: '#e8f5e9', color: '#2e7d32', label: 'Organic Search' },
          paid_social:    { bg: '#fff3e0', color: '#e65100', label: 'Paid Social' },
          organic_social: { bg: '#e3f2fd', color: '#1565c0', label: 'Organic Social' },
          email:          { bg: '#f3e5f5', color: '#7b1fa2', label: 'Email' },
          referral:       { bg: '#e0f2f1', color: '#00695c', label: 'Referral' },
          direct:         { bg: '#f5f5f5', color: '#616161', label: 'Direct' },
        };
        const sources = new Map<string, { count: number; channel: TrafficChannel }>();
        for (const e of org.events) {
          const channel: TrafficChannel = (e.trafficChannel as TrafficChannel) ||
            classifyTrafficChannel({ referrer: e.referrer || undefined });
          const label = e.referrer
            ? (() => { try { return new URL(e.referrer).hostname; } catch { return e.referrer; } })()
            : channelColors[channel].label;
          const existing = sources.get(label);
          if (existing) {
            existing.count += 1;
          } else {
            sources.set(label, { count: 1, channel });
          }
        }
        return sources.size > 0 ? (
          <div className="org-detail-section">
            <h2 className="analytics-section-header">Traffic Sources</h2>
            <div className="org-detail-signals">
              {Array.from(sources.entries())
                .sort((a, b) => b[1].count - a[1].count)
                .map(([label, { count, channel }]) => {
                  const style = channelColors[channel];
                  return (
                    <div key={label} className="org-signal org-signal-info">
                      <span
                        className="analytics-badge"
                        style={{ background: style.bg, color: style.color, marginRight: '0.5rem', fontSize: '0.7rem', padding: '2px 6px', borderRadius: '3px' }}
                      >
                        {style.label}
                      </span>
                      {label} ({count} visit{count > 1 ? 's' : ''})
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
                      <span className="timeline-path">{e.pathname || e.eventName}</span>
                      {e.productName && (
                        <span className="timeline-product">{e.productName}</span>
                      )}
                      {pageDuration != null && pageDuration > 0 && (
                        <span className="timeline-duration">{formatDuration(pageDuration)}</span>
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
                          <span className="timeline-path">{e.pathname || e.eventName}</span>
                          {e.productName && (
                            <span className="timeline-product">{e.productName}</span>
                          )}
                          {pageDuration != null && pageDuration > 0 && (
                            <span className="timeline-duration">{formatDuration(pageDuration)}</span>
                          )}
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

      try {
        const collected: AnalyticsEvent[] = [];
        let nextToken: string | undefined;
        const MAX_EVENTS = 2000;

        do {
          const result = await client.models.AnalyticsEvent.list({
            authMode: 'userPool',
            limit: 200,
            nextToken,
          });

          if (cancelled) return;

          const events = (result.data || []) as AnalyticsEvent[];

          for (const e of events) {
            const ts = new Date(e.timestamp).getTime();
            if (ts >= start.getTime() && ts <= end.getTime()) {
              collected.push(e);
            }
          }

          if (!isSoftRefresh) setLoadProgress(collected.length);
          nextToken = result.nextToken || undefined;
        } while (nextToken && collected.length < MAX_EVENTS);

        if (!cancelled) {
          setAllEvents(collected);
        }
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

  // Aggregate by organization
  const organizations = useMemo(() => aggregateByOrg(filteredEvents), [filteredEvents]);

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

    return { uniqueVisitors, targetCustomers, universities, hotLeads, returning, companies, visitorTrend };
  }, [organizations, filteredEvents, dateRange, customStart, customEnd]);

  function exportCSV() {
    const headers = ['Organization', 'Type', 'Location', 'Products', 'Pages', 'Time (s)', 'Events', 'Tier', 'Confidence', 'Last Visit'];
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
                Time{sortIndicator('totalTimeOnSite')}
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
                  org.leadTier ? `tier-border-${org.leadTier}` : ''
                }`}
                onClick={() => selectOrg(org)}
              >
                <td>
                  <div className="analytics-org-primary">{org.orgName}</div>
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
                <td>{org.totalTimeOnSite > 0 ? formatDuration(org.totalTimeOnSite) : <span className="analytics-na">N/A</span>}</td>
                <td>{org.totalEvents}</td>
                <td>
                  {org.leadTier ? (
                    <span className={`analytics-tier analytics-tier-${org.leadTier}`}>
                      {org.leadTier}
                    </span>
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
