import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { getOrgOverride, classifyOrg, setOrgOverride, undoOrgOverride, listOrgOverrides, type OrgOverride, type OrgOverrideSummary } from '../../services/adminClassificationService';
import { resolveTrafficChannel, extractSearchQuery, type TrafficChannel, type LifecycleStage } from '../../services/behaviorAnalytics';
import { AdminTrendsSection } from './AdminTrendsSection';
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

/** Get search query for an event — uses stored field, falls back to extracting from referrer for old records */
function getSearchQuery(e: AnalyticsEvent): string | undefined {
  return e.searchQuery || extractSearchQuery(e.referrer || undefined) || undefined;
}

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
  companyType: string;
  hasBot: boolean;
  lifecycleStage: LifecycleStage;
  events: AnalyticsEvent[];
}

type DateRange = 'today' | 'yesterday' | 'last7' | 'last30' | 'all' | 'custom';
type SortColumn = 'orgName' | 'organizationType' | 'country' | 'totalEvents' | 'uniquePages' | 'totalTimeOnSite' | 'leadTier' | 'engagement' | 'lastVisit';
type KpiFilter = 'all' | 'target' | 'education' | 'business' | 'hotLead' | 'returning' | 'aiReferral' | 'anonymousIntent';
type KeywordSourceFilter = 'all' | 'external' | 'internal';

interface KeywordEntry {
  keyword: string;
  count: number;
  source: 'organic' | 'paid' | 'internal';
  searchEngine?: string;
  organizations: string[];
  lastSeen: string;
}

type PageAnalyticsTab = 'topPages' | 'products' | 'landingPages';

interface PageStats {
  pathname: string;
  pageTitle: string;
  views: number;
  uniqueVisitors: number;
  avgActiveSeconds: number;
  totalActiveSeconds: number;
  avgScrollDepth: number;
  organizations: string[];
  isProductPage: boolean;
}

interface ProductPageStats extends PageStats {
  productName: string;
  pdfDownloads: number;
  contactFormSubmits: number;
  conversionRate: number;
}

interface LandingPageStats {
  pathname: string;
  pageTitle: string;
  landings: number;
  trafficSources: Record<string, number>;
  topSource: string;
  avgSessionPages: number;
  bounceRate: number;
}

const DATE_RANGES: { value: DateRange; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last7', label: 'Last 7 Days' },
  { value: 'last30', label: 'Last 30 Days' },
  { value: 'all', label: 'All Time' },
  { value: 'custom', label: 'Custom' },
];

// Known bot / crawler organizations — filtered alongside isBot
// Use specific org names to avoid false positives on ISPs (e.g. Google Fiber, Apple iCloud Private Relay)
const BOT_ORG_PATTERNS = [
  'google llc', 'googlebot',
  'microsoft corporation', 'msn',
  'ahrefs', 'semrush', 'moz.com', 'majestic',
  'yandex', 'baidu', 'bytedance', 'bytespider',
  'meta platforms',
  'applebot',
  'amazonaws', 'amazon.com',
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

const SEARCH_ENGINE_NAMES: Record<string, string> = {
  'google.': 'Google',
  'bing.com': 'Bing',
  'yahoo.': 'Yahoo',
  'baidu.com': 'Baidu',
  'yandex.': 'Yandex',
  'duckduckgo.com': 'DuckDuckGo',
  'ecosia.org': 'Ecosia',
  'ask.com': 'Ask',
  'naver.com': 'Naver',
  'sogou.com': 'Sogou',
};

function extractSearchEngineName(referrer: string | undefined | null): string | undefined {
  if (!referrer) return undefined;
  try {
    const host = new URL(referrer).hostname.toLowerCase();
    for (const [pattern, name] of Object.entries(SEARCH_ENGINE_NAMES)) {
      if (pattern.endsWith('.')) {
        const base = pattern.slice(0, -1);
        if (host === base || host.startsWith(base + '.') || host.includes('.' + base + '.')) return name;
      } else {
        if (host === pattern || host.endsWith('.' + pattern)) return name;
      }
    }
  } catch { /* invalid URL */ }
  return undefined;
}

function aggregateKeywords(events: AnalyticsEvent[]): KeywordEntry[] {
  const map = new Map<string, KeywordEntry>();

  for (const e of events) {
    const orgName = e.orgName || e.org || '';

    // 1. External organic: searchQuery field (from referrer)
    const sq = e.searchQuery || extractSearchQuery(e.referrer || undefined);
    if (sq) {
      const key = `organic:${sq.toLowerCase().trim()}`;
      const existing = map.get(key);
      if (existing) {
        existing.count++;
        if (orgName && !existing.organizations.includes(orgName)) existing.organizations.push(orgName);
        if (e.timestamp > existing.lastSeen) existing.lastSeen = e.timestamp;
      } else {
        map.set(key, {
          keyword: sq.trim(),
          count: 1,
          source: 'organic',
          searchEngine: extractSearchEngineName(e.referrer),
          organizations: orgName ? [orgName] : [],
          lastSeen: e.timestamp,
        });
      }
    }

    // 2. Paid: utmTerm field
    if (e.utmTerm) {
      const key = `paid:${e.utmTerm.toLowerCase().trim()}`;
      const existing = map.get(key);
      if (existing) {
        existing.count++;
        if (orgName && !existing.organizations.includes(orgName)) existing.organizations.push(orgName);
        if (e.timestamp > existing.lastSeen) existing.lastSeen = e.timestamp;
      } else {
        map.set(key, {
          keyword: e.utmTerm.trim(),
          count: 1,
          source: 'paid',
          organizations: orgName ? [orgName] : [],
          lastSeen: e.timestamp,
        });
      }
    }

    // 3. Internal site search: eventType=search, searchTerm in properties
    if (e.eventType === 'search' && e.properties) {
      try {
        const props = typeof e.properties === 'string' ? JSON.parse(e.properties) : e.properties;
        const term = props?.searchTerm;
        if (term && typeof term === 'string') {
          const key = `internal:${term.toLowerCase().trim()}`;
          const existing = map.get(key);
          if (existing) {
            existing.count++;
            if (orgName && !existing.organizations.includes(orgName)) existing.organizations.push(orgName);
            if (e.timestamp > existing.lastSeen) existing.lastSeen = e.timestamp;
          } else {
            map.set(key, {
              keyword: term.trim(),
              count: 1,
              source: 'internal',
              organizations: orgName ? [orgName] : [],
              lastSeen: e.timestamp,
            });
          }
        }
      } catch { /* invalid JSON */ }
    }
  }

  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

// ─── Page Analytics aggregation ──────────────────────────────────────────────

function normalizePath(p: string): string {
  return p !== '/' && p.endsWith('/') ? p.slice(0, -1) : p;
}

function aggregatePageStats(events: AnalyticsEvent[]): PageStats[] {
  const pageMap = new Map<string, {
    pageTitle: string; views: number; visitors: Set<string>;
    orgCounts: Map<string, number>; totalActive: number; flushCount: number;
    scrollDepthSum: number; scrollDepthCount: number;
    latestTimestamp: string;
  }>();

  // 1. Count page_view events per pathname
  for (const e of events) {
    if (e.eventType !== 'page_view' || !e.pathname) continue;
    const path = normalizePath(e.pathname);
    if (path.startsWith('/admin')) continue; // exclude admin pages
    const existing = pageMap.get(path);
    const vid = (e as Record<string, unknown>).visitorId as string || '';
    const org = e.orgName || e.org || '';
    if (existing) {
      existing.views++;
      if (vid) existing.visitors.add(vid);
      if (org) existing.orgCounts.set(org, (existing.orgCounts.get(org) || 0) + 1);
      if (!existing.pageTitle && e.pageTitle) existing.pageTitle = e.pageTitle;
      if (e.timestamp > existing.latestTimestamp) {
        existing.latestTimestamp = e.timestamp;
        if (e.pageTitle) existing.pageTitle = e.pageTitle;
      }
    } else {
      const visitors = new Set<string>();
      if (vid) visitors.add(vid);
      const orgCounts = new Map<string, number>();
      if (org) orgCounts.set(org, 1);
      pageMap.set(path, {
        pageTitle: e.pageTitle || '', views: 1, visitors, orgCounts,
        totalActive: 0, flushCount: 0, scrollDepthSum: 0, scrollDepthCount: 0,
        latestTimestamp: e.timestamp,
      });
    }
  }

  // 2. Aggregate page time from page_time_flush events
  // Group by pageViewId, select best flush per pageViewId, then sum per pathname
  const pvBest = new Map<string, { activeSeconds: number; isFinal: boolean; pathname: string; maxScroll: number }>();
  for (const e of events) {
    if (e.eventType !== 'page_time_flush' || !e.activeSeconds || e.activeSeconds <= 0) continue;
    const pvId = (e as Record<string, unknown>).pageViewId as string || e.id;
    const isFinal = !!((e as Record<string, unknown>).isFinal);
    const path = normalizePath(e.pathname || '');
    const scroll = (e as Record<string, unknown>).maxScrollDepth as number || 0;
    const existing = pvBest.get(pvId);
    const best = selectBestFlush(
      existing ? { activeSeconds: existing.activeSeconds, isFinal: existing.isFinal } : undefined,
      { activeSeconds: e.activeSeconds, isFinal }
    );
    pvBest.set(pvId, {
      activeSeconds: best.activeSeconds, isFinal: best.isFinal, pathname: path,
      maxScroll: Math.max(existing?.maxScroll || 0, scroll),
    });
  }

  // Sum best flush times and scroll depth per pathname
  for (const [, { activeSeconds, pathname, maxScroll }] of pvBest) {
    if (!pathname) continue;
    const entry = pageMap.get(pathname);
    if (entry) {
      entry.totalActive += activeSeconds;
      entry.flushCount++;
      if (maxScroll > 0) {
        entry.scrollDepthSum += maxScroll;
        entry.scrollDepthCount++;
      }
    }
  }

  return Array.from(pageMap.entries())
    .map(([path, data]) => ({
      pathname: path,
      pageTitle: data.pageTitle,
      views: data.views,
      uniqueVisitors: data.visitors.size,
      avgActiveSeconds: data.flushCount > 0 ? Math.round(data.totalActive / data.flushCount) : 0,
      totalActiveSeconds: data.totalActive,
      avgScrollDepth: data.scrollDepthCount > 0 ? Math.round(data.scrollDepthSum / data.scrollDepthCount) : 0,
      organizations: Array.from(data.orgCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([name]) => name),
      isProductPage: path.startsWith('/products/'),
    }))
    .sort((a, b) => b.views - a.views);
}

function aggregateProductStats(pageStats: PageStats[], events: AnalyticsEvent[]): ProductPageStats[] {
  const productPages = pageStats.filter(p => p.isProductPage);

  // Count PDF downloads per productName
  const pdfCounts = new Map<string, number>();
  const contactCounts = new Map<string, number>();
  for (const e of events) {
    if (e.eventType === 'pdf_download' && e.productName) {
      pdfCounts.set(e.productName, (pdfCounts.get(e.productName) || 0) + 1);
    }
    if ((e.eventType === 'contact_form' || e.eventType === 'rfq_submission') && (e.productId || e.productName)) {
      const key = e.productName || e.productId || '';
      contactCounts.set(key, (contactCounts.get(key) || 0) + 1);
    }
  }

  return productPages.map(p => {
    // Extract product name from pathname: /products/hy-20l → HY-20L
    const slug = p.pathname.replace('/products/', '').replace(/\/$/, '');
    // Try to match by slug in pdfCounts keys (case-insensitive)
    const matchedPdfKey = Array.from(pdfCounts.keys()).find(k =>
      k.toLowerCase().replace(/[\s-]/g, '') === slug.toLowerCase().replace(/[\s-]/g, '')
    );
    const matchedContactKey = Array.from(contactCounts.keys()).find(k =>
      k.toLowerCase().replace(/[\s-]/g, '') === slug.toLowerCase().replace(/[\s-]/g, '')
    );
    const downloads = matchedPdfKey ? (pdfCounts.get(matchedPdfKey) || 0) : 0;
    const contacts = matchedContactKey ? (contactCounts.get(matchedContactKey) || 0) : 0;
    const conversions = downloads + contacts;
    // Use unique visitors for conversion rate (more accurate)
    const convRate = p.uniqueVisitors > 0 ? conversions / p.uniqueVisitors : 0;
    return {
      ...p,
      productName: matchedPdfKey || slug,
      pdfDownloads: downloads,
      contactFormSubmits: contacts,
      conversionRate: Math.min(convRate, 1), // cap at 100%
    };
  }).sort((a, b) => b.views - a.views);
}

function aggregateLandingPages(events: AnalyticsEvent[]): LandingPageStats[] {
  // Group page_view events by session (visitorId + sessionId)
  const sessions = new Map<string, AnalyticsEvent[]>();
  for (const e of events) {
    if (e.eventType !== 'page_view' || !e.pathname) continue;
    const vid = (e as Record<string, unknown>).visitorId as string || '';
    const sid = (e as Record<string, unknown>).sessionId as string || '';
    const key = `${vid}:${sid}`;
    const group = sessions.get(key);
    if (group) group.push(e);
    else sessions.set(key, [e]);
  }

  // For each session, identify the first page_view (landing page)
  const landingMap = new Map<string, {
    pageTitle: string; landings: number;
    trafficSources: Record<string, number>;
    totalSessionPages: number; bounces: number;
  }>();

  for (const [, sessionEvents] of sessions) {
    const sorted = sessionEvents.sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    const first = sorted[0];
    const path = normalizePath(first.pathname || '');
    if (path.startsWith('/admin')) continue;

    const channel = resolveTrafficChannel(first);
    const isBounce = sorted.length === 1;

    const existing = landingMap.get(path);
    if (existing) {
      existing.landings++;
      existing.trafficSources[channel] = (existing.trafficSources[channel] || 0) + 1;
      existing.totalSessionPages += sorted.length;
      if (isBounce) existing.bounces++;
      if (first.pageTitle && !existing.pageTitle) existing.pageTitle = first.pageTitle;
    } else {
      landingMap.set(path, {
        pageTitle: first.pageTitle || '',
        landings: 1,
        trafficSources: { [channel]: 1 },
        totalSessionPages: sorted.length,
        bounces: isBounce ? 1 : 0,
      });
    }
  }

  return Array.from(landingMap.entries())
    .map(([path, data]) => {
      const topSourceEntry = Object.entries(data.trafficSources)
        .sort(([, a], [, b]) => b - a)[0];
      return {
        pathname: path,
        pageTitle: data.pageTitle,
        landings: data.landings,
        trafficSources: data.trafficSources,
        topSource: topSourceEntry?.[0] || 'direct',
        avgSessionPages: data.landings > 0 ? Math.round((data.totalSessionPages / data.landings) * 10) / 10 : 0,
        bounceRate: data.landings > 0 ? data.bounces / data.landings : 0,
      };
    })
    .sort((a, b) => b.landings - a.landings);
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

function engagementLevel(score: number): 'High' | 'Medium' | 'Low' | null {
  if (score >= 0.4) return 'High';
  if (score >= 0.15) return 'Medium';
  if (score > 0) return 'Low';
  return null;
}

function engagementRank(score: number): number {
  if (score >= 0.4) return 3;
  if (score >= 0.15) return 2;
  if (score > 0) return 1;
  return 0;
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

// ─── Lifecycle Stage (derived from org event history) ─────────────────────

function computeOrgLifecycleStage(group: AnalyticsEvent[], productsViewed: Set<string>, pdfDownloads: number, returnVisits: number): LifecycleStage {
  const hasRFQSubmission = group.some(e => e.eventType === 'rfq_submission');
  if (hasRFQSubmission) return 'intent';

  const hasContactForm = group.some(e => e.eventType === 'contact_form' || e.eventType === 'rfq_step');
  if (pdfDownloads > 0 || hasContactForm) return 'consideration';

  if (productsViewed.size > 0 || returnVisits > 0) return 'interest';

  return 'awareness';
}

// ─── Private IP Detection ───────────────────────────────────────────────────

function isPrivateIP(ip: string): boolean {
  // IPv4 private/reserved ranges
  if (/^10\./.test(ip)) return true;                            // 10.0.0.0/8
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)) return true;    // 172.16.0.0/12 (Docker etc.)
  if (/^192\.168\./.test(ip)) return true;                      // 192.168.0.0/16
  if (/^127\./.test(ip)) return true;                           // 127.0.0.0/8 (loopback)
  if (/^169\.254\./.test(ip)) return true;                      // 169.254.0.0/16 (link-local)
  if (/^100\.(6[4-9]|[7-9]\d|1[0-2]\d)\./.test(ip)) return true; // 100.64.0.0/10 (CGNAT)
  if (ip === '0.0.0.0' || ip === '::1' || ip === '::') return true;
  return false;
}

// ─── Aggregation ────────────────────────────────────────────────────────────

function aggregateByOrg(events: AnalyticsEvent[]): OrganizationRecord[] {
  // ── Pre-pass: build visitorId → org metadata from events that carry org data ──
  // page_time_flush events lack ip/org/orgName/country etc. We inherit those
  // from other events (page_view, product_view, etc.) sharing the same visitorId.
  const visitorOrgMap = new Map<string, {
    ip: string; org: string; orgName: string;
    country: string; region: string; city: string;
    organizationType: string;
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
    // Keep the entry with the most complete org metadata fields.
    // Same visitorId = same visitor; differences are just field coverage.
    const candidateFields = (e.ip ? 1 : 0) + (e.org ? 1 : 0) + (e.orgName ? 1 : 0) +
      (e.country ? 1 : 0) + (e.region ? 1 : 0) + (e.city ? 1 : 0);
    const existingFields = existing
      ? (existing.ip ? 1 : 0) + (existing.org ? 1 : 0) + (existing.orgName ? 1 : 0) +
        (existing.country ? 1 : 0) + (existing.region ? 1 : 0) + (existing.city ? 1 : 0)
      : -1;

    if (candidateFields > existingFields) {
      visitorOrgMap.set(vid, {
        ip: e.ip || existing?.ip || '',
        org: e.org || existing?.org || '',
        orgName: e.orgName || existing?.orgName || '',
        country: e.country || existing?.country || '',
        region: e.region || existing?.region || '',
        city: e.city || existing?.city || '',
        organizationType: e.organizationType || existing?.organizationType || '',
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
    // ── Inherit org metadata for events missing org/orgName (e.g. page_time_flush) ──
    const vid = (e as Record<string, unknown>).visitorId as string;
    const needsInheritance = !e.org && !e.orgName;
    const inherited = (needsInheritance && vid) ? visitorOrgMap.get(vid) : undefined;

    // Effective org fields: event's own data → inherited → default
    const effOrgName = e.orgName || inherited?.orgName || '';
    const effOrg = e.org || inherited?.org || '';
    const rawIp = e.ip || inherited?.ip || '';
    const effIp = (rawIp && !isPrivateIP(rawIp)) ? rawIp : '';
    // Group by org name → IP → visitorId → Unknown.
    // ISP orgs are re-split by visitorId in a post-processing step.
    const key = effOrgName || effOrg || effIp || vid || 'Unknown';
    const group = groups.get(key);
    if (group) {
      group.push(e);
    } else {
      groups.set(key, [e]);
    }
  }

  // ── Collect ISP org names (AI telecom_isp + IP-level isp) ───────────
  // Used to split ISP visitors and prevent merge-back.
  const ISP_ORG_TYPES = new Set(['telecom_isp', 'isp']);
  const ispOrgNames = new Set<string>();
  const addIfISP = (orgName: string, org: string, aiType: string | null | undefined, ipType: string | undefined) => {
    if (ISP_ORG_TYPES.has(aiType || '') || ISP_ORG_TYPES.has(ipType || '')) {
      if (orgName) ispOrgNames.add(orgName);
      if (org) ispOrgNames.add(org);
    }
  };
  for (const meta of visitorOrgMap.values()) {
    addIfISP(meta.orgName, meta.org, meta.aiOrganizationType, meta.organizationType);
  }
  for (const [, grp] of groups) {
    for (const e of grp) {
      addIfISP(e.orgName || '', e.org || '', e.aiOrganizationType ?? undefined, e.organizationType ?? undefined);
    }
  }

  // ── Split ISP org-keyed groups by individual visitor ───────────────
  // Some events lack AI classification and end up keyed by org name even
  // though the org is an ISP.  Re-split those groups by visitorId so each
  // residential user gets their own entry.
  for (const ispName of ispOrgNames) {
    const ispGroup = groups.get(ispName);
    if (!ispGroup) continue;
    groups.delete(ispName);
    for (const e of ispGroup) {
      const vid = (e as Record<string, unknown>).visitorId as string;
      const k = vid || e.ip || ispName;
      const existing = groups.get(k);
      if (existing) existing.push(e);
      else groups.set(k, [e]);
    }
  }

  // ── Merge visitor-keyed groups back into their parent org ────────
  // Different IPs from the same org may land in separate groups when
  // some events lack org metadata and fall back to visitorId/IP keys.
  // Merge them so the same organization doesn't appear as multiple entries.
  // Skip ISP orgs — those should stay split by visitor.
  const mergeKeys: string[] = [];
  for (const [key, group] of groups) {
    const orgEvent = group.find((e) => e.orgName || e.org);
    const baseOrgName = orgEvent?.orgName || orgEvent?.org || '';
    if (baseOrgName && baseOrgName !== 'Unknown' && baseOrgName !== key
        && groups.has(baseOrgName) && !ispOrgNames.has(baseOrgName)) {
      groups.get(baseOrgName)!.push(...group);
      mergeKeys.push(key);
    }
  }
  for (const key of mergeKeys) {
    groups.delete(key);
  }

  // ── Consolidate groups sharing the same visitorId ──────────────────
  // After ISP splitting and org merge-back, the same visitor may still
  // appear in multiple groups (e.g. same visitorId from different IPs
  // where some events have orgName and some don't).  Merge single-visitor
  // groups that share the same visitorId so they appear as one record.
  const vidPrimaryKey = new Map<string, string>(); // visitorId → first group key
  const consolidateKeys: string[] = [];
  for (const [key, group] of groups) {
    const vids = new Set<string>();
    for (const e of group) {
      const vid = (e as Record<string, unknown>).visitorId as string;
      if (vid) vids.add(vid);
    }
    if (vids.size !== 1) continue; // only merge single-visitor groups
    const vid = [...vids][0];
    const existing = vidPrimaryKey.get(vid);
    if (existing && groups.has(existing)) {
      groups.get(existing)!.push(...group);
      consolidateKeys.push(key);
    } else {
      vidPrimaryKey.set(vid, key);
    }
  }
  for (const key of consolidateKeys) {
    groups.delete(key);
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

    for (const e of group) {
      if (e.pathname) {
        // Normalize trailing slash to canonical path (e.g. /products/ → /products)
        const normalizedPath = e.pathname !== '/' && e.pathname.endsWith('/')
          ? e.pathname.slice(0, -1)
          : e.pathname;
        pages.add(normalizedPath);
      }
      if (e.productName) products.add(e.productName);

      const eventConf = e.aiConfidence ?? 0;
      if (eventConf > maxConf) {
        maxConf = eventConf;
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
    }

    // Compute total active time using the same hybrid flush + legacy logic
    // as the timeline (computePerPageDuration). This ensures page_views
    // without flush events still contribute via timeOnSite deltas.
    const perPageDurations = computePerPageDuration(group);
    for (const seconds of perPageDurations.values()) {
      totalTime += seconds;
    }

    // Use the first event with valid lat/lng
    const geoEvent = group.find((e) => e.latitude != null && e.longitude != null) || group[0];
    const sorted = group.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Clear historical tier for non-target customers (pre-fix events may have incorrect tiers)
    if (!isTarget) bestTier = null;

    // Detect bot visitors — by isBot flag OR known bot org name
    const orgKey = geoEvent.orgName || geoEvent.org || '';
    const hasBot = group.some((e) => e.isBot) || (orgKey ? isKnownBotOrg(orgKey) : false);

    // Promote AI classification when IP-based org type is unknown
    const aiEvent = group.find((e) =>
      e.aiOrganizationType && e.aiOrganizationType !== 'unknown' && e.aiConfidence != null && e.aiConfidence >= 0.5
    );
    const ipOrgType = group.find(e => e.organizationType && e.organizationType !== 'unknown')?.organizationType ||
      geoEvent.organizationType || '';
    const effectiveOrgType = hasBot ? 'bot' : (aiEvent?.aiOrganizationType || ipOrgType);

    // Backfill tier for old events that lack leadTier.
    // Two paths mirror the pipeline (segmentAnalytics):
    //   1. IP-reliable org types (education/gov) → B without AI confidence
    //   2. AI-classified identified orgs → B if confidence >= 0.5 (trust gate)
    // Tier A only comes from behavioral boost in the pipeline.
    const IP_RELIABLE_TYPES = new Set(['education', 'university', 'research_institute', 'government']);
    const AI_IDENTIFIED_TYPES = new Set(['business', 'enterprise', 'hospital']);
    if (!bestTier) {
      if (IP_RELIABLE_TYPES.has(effectiveOrgType)) {
        bestTier = 'B';
      } else if (AI_IDENTIFIED_TYPES.has(effectiveOrgType) && maxConf >= 0.5) {
        bestTier = 'B';
      }
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

    // Detect ISP visitors that were split by the ISP split step
    const orgEvent = group.find((e) => e.orgName || e.org) || group[0];
    const ispOrgName = orgEvent.orgName || orgEvent.org || '';
    const isISPVisitor = ispOrgNames.has(ispOrgName) && key !== ispOrgName;
    // Build a human-readable display name for ISP individual visitors
    const displayName = isISPVisitor
      ? `${ispOrgName} · ${[geoEvent.city, geoEvent.region].filter(Boolean).join(', ') || 'Unknown'}`
      : key;

    // Extract IPinfo company type from events (first non-empty value)
    const companyType = group.find(e => (e as Record<string, unknown>).companyType)
      ? String((group.find(e => (e as Record<string, unknown>).companyType) as Record<string, unknown>).companyType)
      : '';

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
      companyType,
      hasBot,
      lifecycleStage: computeOrgLifecycleStage(group, products, maxPdfDownloads, maxReturnVisits),
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
      <div className="bg-surface-container-lowest rounded-xl p-6 shadow-[0_10px_30px_rgba(2,36,72,0.04)] mb-6">
        <h2 className="font-headline text-lg font-bold text-on-surface flex items-center gap-2 mb-4">Visitor Map</h2>
        <div className="text-center py-12 text-on-surface-variant">
          No geo-coordinates available yet. New events will appear on the map.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface-container-lowest rounded-xl p-6 shadow-[0_10px_30px_rgba(2,36,72,0.04)] mb-6">
      <h2 className="font-headline text-lg font-bold text-on-surface flex items-center gap-2 mb-4">Visitor Map</h2>
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
          className="bg-surface-container-lowest rounded-lg shadow-lg p-3 text-xs fixed z-50 pointer-events-none"
          style={{ left: tooltipPos.x + 12, top: tooltipPos.y - 40 }}
        >
          <strong>{tooltip.orgName}</strong>
          <div>
            {[tooltip.city, tooltip.region, tooltip.country].filter(Boolean).join(', ')}
          </div>
          {tooltip.leadTier && <div>Lead Tier: {tooltip.leadTier}</div>}
          <div>{tooltip.totalEvents} events</div>
          {tooltip.isTargetCustomer && <div className="text-secondary font-bold text-[10px] uppercase mt-1">Target Customer</div>}
        </div>
      )}
    </div>
  );
}

// ─── Channel Summary Chart (Bento Grid) ─────────────────────────────────────

function ChannelSummaryChart({ events, onChannelClick }: { events: AnalyticsEvent[]; onChannelClick?: (channel: string) => void }) {
  const channelTotals = useMemo(() => {
    const channelMap = new Map<string, Set<string>>();
    for (const e of events) {
      if (e.eventType !== 'page_view') continue;
      const channel = resolveTrafficChannel(e);
      const vid = (e as Record<string, unknown>).visitorId as string || e.ip || '';
      if (!channelMap.has(channel)) channelMap.set(channel, new Set());
      channelMap.get(channel)!.add(vid);
    }
    const CHANNEL_LABELS: Record<string, string> = {
      direct: 'Direct', organic_search: 'Organic Search', referral: 'Referral',
      paid_search: 'Paid Search', organic_social: 'Social', email: 'Email',
      ai_referral: 'AI Referral', paid_social: 'Paid Social',
    };
    const CHANNEL_COLORS: Record<string, string> = {
      direct: '#9e9e9e', organic_search: '#4caf50', referral: '#009688',
      paid_search: '#e91e63', organic_social: '#2196f3', email: '#9c27b0',
      ai_referral: '#4527a0', paid_social: '#ff9800',
    };
    return Array.from(channelMap.entries())
      .map(([channel, visitors]) => ({
        channel,
        label: CHANNEL_LABELS[channel] || channel,
        count: visitors.size,
        color: CHANNEL_COLORS[channel] || '#9e9e9e',
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [events]);

  const maxCount = channelTotals[0]?.count || 1;

  if (channelTotals.length === 0) {
    return <div className="text-sm text-on-surface-variant text-center py-8">No traffic data</div>;
  }

  const BAR_HEIGHT = 128; // px, matches design h-32

  return (
    <div className="flex items-end justify-between gap-4" style={{ height: BAR_HEIGHT + 32 }}>
      {channelTotals.map((ch) => {
        const barH = Math.max(Math.round((ch.count / maxCount) * BAR_HEIGHT), 4);
        return (
          <div
            key={ch.channel}
            className="flex-1 flex flex-col items-center justify-end gap-3 group cursor-pointer"
            style={{ height: '100%' }}
            onClick={() => onChannelClick?.(ch.channel)}
          >
            <div
              className="w-full bg-secondary-fixed-dim rounded-t-sm group-hover:bg-secondary transition-colors relative"
              style={{ height: barH }}
            >
              <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                {ch.count}
              </span>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant whitespace-nowrap">
              {ch.label}
            </span>
          </div>
        );
      })}
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
    getOrgOverride(org.orgName).then(async (result) => {
      if (cancelled) return;
      // Auto-classify if no cached classification exists (skip bots)
      if (!result.found && !org.hasBot) {
        try {
          const classified = await classifyOrg(org.orgName);
          if (!cancelled) setOverride(classified);
        } catch {
          if (!cancelled) setOverride(result);
        }
      } else {
        setOverride(result);
      }
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
  const rfqSubmitted = org.events.some((e) => e.eventType === 'rfq_submission');
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
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-2">
        <button className="flex items-center gap-2 text-sm text-on-surface-variant hover:text-on-surface font-medium mb-4 border-none bg-transparent cursor-pointer" onClick={onBack}>&larr; Back to list</button>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-headline text-3xl font-bold text-primary">{org.orgName}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {(() => {
              const displayOrgType = org.hasBot ? 'bot'
                : (override?.found && override?.organizationType && override.organizationType !== 'unknown')
                  ? override.organizationType
                  : org.organizationType;
              return displayOrgType ? (
                <span className="px-2.5 py-0.5 rounded-full bg-surface-container text-on-surface-variant text-xs font-semibold">
                  {displayOrgType}
                </span>
              ) : null;
            })()}
            <span className="text-sm text-on-surface-variant">
              {[org.city, org.region, org.country].filter(Boolean).join(', ')}
            </span>
            {org.leadTier && (
              <span
                className="px-2 py-0.5 rounded text-xs font-bold bg-secondary/10 text-secondary"
                style={override?.found && override?.source === 'manual' && !override?.isTargetCustomer
                  ? { textDecoration: 'line-through', opacity: 0.5 } : undefined}
              >
                Tier {org.leadTier}
              </span>
            )}
            {org.lifecycleStage && (
              <span className="px-2 py-0.5 rounded text-xs font-semibold bg-tertiary-fixed text-on-tertiary-fixed-variant">
                {org.lifecycleStage}
              </span>
            )}
            {uniqueIPs.length > 0 && (
              <span
                className="text-xs text-on-surface-variant font-mono cursor-pointer hover:text-on-surface"
                onClick={() => setShowFullIP((v) => !v)}
                title={showFullIP ? 'Click to mask' : 'Click to reveal'}
              >
                {showFullIP
                  ? uniqueIPs.join(', ')
                  : uniqueIPs.map(maskIP).join(', ')}
              </span>
            )}
            {uniqueISPs.length > 0 && (
              <span className="text-xs text-on-surface-variant">{uniqueISPs.join(', ')}</span>
            )}
            {org.companyType && (
              <span className="text-xs text-on-surface-variant" title="IPinfo company classification">
                {org.companyType}
              </span>
            )}
            {org.isISPVisitor && (
              <span className="text-xs text-on-surface-variant font-mono">
                ID: {org.key.substring(0, 8)}
              </span>
            )}
            {uniqueVisitors.filter((v) => !v.includes('.') && !(org.isISPVisitor && v === org.key)).length > 0 && (
              <span className="text-xs text-on-surface-variant font-mono">
                {uniqueVisitors.filter((v) => !v.includes('.') && !(org.isISPVisitor && v === org.key)).map((v) => v.slice(0, 8)).join(', ')}
              </span>
            )}
          </div>
        </div>
        {engagementLevel(org.maxBehaviorScore) && (
          <div className="text-right">
            <div className="font-headline text-lg font-bold text-secondary">{engagementLevel(org.maxBehaviorScore)}</div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Engagement</div>
          </div>
        )}
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-surface-container-lowest rounded-xl p-4 shadow-card">
          <div className="font-headline text-xl font-bold text-on-surface">{new Date(org.firstVisit).toLocaleDateString()}</div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mt-1">First Seen</div>
        </div>
        <div className="bg-surface-container-lowest rounded-xl p-4 shadow-card">
          <div className="font-headline text-xl font-bold text-on-surface">{formatRelativeTime(org.lastVisit)}</div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mt-1">Last Seen</div>
        </div>
        <div className="bg-surface-container-lowest rounded-xl p-4 shadow-card">
          <div className="font-headline text-xl font-bold text-on-surface">{org.totalEvents}</div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mt-1">Total Events</div>
        </div>
        <div className="bg-surface-container-lowest rounded-xl p-4 shadow-card">
          <div className="font-headline text-xl font-bold text-on-surface">{org.uniquePages}</div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mt-1">Pages Viewed</div>
        </div>
        <div className="bg-surface-container-lowest rounded-xl p-4 shadow-card">
          <div className="font-headline text-xl font-bold text-on-surface">{org.totalTimeOnSite > 0 ? formatDuration(org.totalTimeOnSite) : 'Pending'}</div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mt-1">Active Time</div>
        </div>
        <div className="bg-surface-container-lowest rounded-xl p-4 shadow-card">
          <div className="font-headline text-xl font-bold text-on-surface">{org.returnVisits}</div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mt-1">Return Visits</div>
        </div>
      </div>

      {/* Behavior Signals */}
      <div className="bg-surface-container-lowest rounded-xl p-6 shadow-card">
        <h2 className="font-headline text-lg font-bold text-on-surface flex items-center gap-2 mb-4">Behavior Analysis</h2>
        {org.maxBehaviorScore > 0 && (
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Behavior Score</span>
            <span className="flex-1 bg-surface-container-high rounded-full h-2">
              <span
                className="block rounded-full h-2 transition-all"
                style={{
                  width: `${Math.min(org.maxBehaviorScore * 100, 100)}%`,
                  backgroundColor: org.maxBehaviorScore >= 0.3 ? '#7b1fa2' : '#bdbdbd',
                }}
              />
            </span>
            <span className={`text-sm font-bold ${org.maxBehaviorScore >= 0.3 ? 'text-secondary' : 'text-on-surface-variant'}`}>
              {(org.maxBehaviorScore * 100).toFixed(0)}%
            </span>
            {org.maxBehaviorScore < 0.3 && !org.isAnonymousHighIntent && (
              <span className="text-[10px] text-on-surface-variant">below 30% intent threshold</span>
            )}
          </div>
        )}
        <div className="space-y-2">
          {org.isTargetCustomer && (
            <div className="flex items-center gap-2 bg-secondary/10 text-secondary rounded-lg px-3 py-2 text-sm font-medium"><span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>flag</span> Target Customer Identified</div>
          )}
          {org.isAnonymousHighIntent && !(override?.found && override?.isTargetCustomer) && (
            org.isISPVisitor
              ? <div className="bg-tertiary-fixed-dim/20 text-on-surface rounded-lg px-3 py-2 text-sm">ISP visitor with purchase intent -- browsing from home/mobile network. Consider monitoring for return visits or PDF downloads to confirm buyer interest.</div>
              : <div className="bg-tertiary-fixed/30 text-on-surface rounded-lg px-3 py-2 text-sm">Unknown company with high purchase intent -- consider targeted engagement</div>
          )}
          {downloadedPDF && (
            <div className="flex items-center gap-2 bg-secondary/10 text-secondary rounded-lg px-3 py-2 text-sm font-medium"><span className="material-symbols-outlined text-base">download</span> Downloaded PDF / Spec Sheet</div>
          )}
          {visitedContactPage && (
            <div className="flex items-center gap-2 bg-secondary/10 text-secondary rounded-lg px-3 py-2 text-sm font-medium"><span className="material-symbols-outlined text-base">mail</span> Visited Contact Page</div>
          )}
          {rfqSubmitted && (
            <div className="flex items-center gap-2 bg-secondary/10 text-secondary rounded-lg px-3 py-2 text-sm font-medium"><span className="material-symbols-outlined text-base">send</span> Submitted RFQ</div>
          )}
          {contactFormSubmitted && !rfqSubmitted && (
            <div className="flex items-center gap-2 bg-secondary/10 text-secondary rounded-lg px-3 py-2 text-sm font-medium"><span className="material-symbols-outlined text-base">contact_mail</span> Submitted Contact Form</div>
          )}
          {uniqueProductPages.size >= 3 && (
            <div className="bg-tertiary-fixed/20 text-on-surface rounded-lg px-3 py-2 text-sm">Viewed {uniqueProductPages.size} product pages -- comparing solutions</div>
          )}
          {org.returnVisits >= 3 && (
            <div className="bg-tertiary-fixed/20 text-on-surface rounded-lg px-3 py-2 text-sm">Returning visitor ({org.returnVisits} return visits)</div>
          )}
          {org.productsViewed.length > 0 && (
            <div className="bg-surface-container-low rounded-lg px-3 py-2 text-sm text-on-surface-variant">
              Products of interest: {org.productsViewed.join(', ')}
            </div>
          )}
          {org.pdfDownloads > 0 && (
            <div className="bg-surface-container-low rounded-lg px-3 py-2 text-sm text-on-surface-variant">{org.pdfDownloads} PDF download(s)</div>
          )}
        </div>
      </div>

      {/* Detection Details */}
      {(() => {
        const aiEvent = org.events.find((e) => e.aiReason || e.aiOrganizationType);
        // Find IP-based org type (before AI enrichment)
        const ipEvent = org.events.find((e) => e.organizationType && e.organizationType !== 'unknown') || org.events[0];
        const ipOrgType = ipEvent?.organizationType || 'unknown';

        // Use override data as fallback when page_view events lack AI data (pre-fix records)
        const hasEventAI = aiEvent && aiEvent.aiConfidence != null && aiEvent.aiOrganizationType;
        const hasOverrideAI = !hasEventAI && !org.hasBot && override?.found && override?.source !== 'manual'
          && override?.organizationType && override.organizationType !== 'unknown';
        const hasAI = hasEventAI || hasOverrideAI;
        const effectiveAiOrgType = hasEventAI ? aiEvent.aiOrganizationType : override?.organizationType;
        const effectiveAiConf = hasEventAI ? (aiEvent.aiConfidence ?? 0) : (override?.confidence ?? 0);
        const effectiveAiReason = hasEventAI ? aiEvent.aiReason : override?.reason;
        const aiUpgraded = hasAI && effectiveAiOrgType !== 'unknown'
          && effectiveAiOrgType !== ipOrgType;
        const aiConfirmed = hasAI && !aiUpgraded && effectiveAiOrgType !== 'unknown';

        // Determine classification source
        const source = (() => {
          if (override?.found && override?.source === 'manual') return 'manual';
          if (org.hasBot) return 'bot';
          if (hasAI && effectiveAiConf >= 0.5 && effectiveAiOrgType !== 'unknown') return 'ai';
          if (ipOrgType !== 'unknown') return 'ip';
          if (org.isAnonymousHighIntent) return 'behavior';
          return 'none';
        })();

        const sourceBadge: Record<string, { label: string; className: string }> = {
          manual: { label: 'Manual Override', className: 'bg-tertiary-fixed text-on-tertiary-fixed-variant' },
          bot: { label: 'Bot Detected', className: 'bg-error-container text-on-error-container' },
          ai: { label: 'AI Classified', className: 'bg-secondary/10 text-secondary' },
          ip: { label: 'IP Lookup', className: 'bg-surface-container text-on-surface-variant' },
          behavior: { label: 'Behavior-based', className: 'bg-tertiary-fixed-dim/30 text-on-surface' },
          none: { label: 'Unclassified', className: 'bg-surface-container-low text-on-surface-variant' },
        };
        const badge = sourceBadge[source];

        return (
          <div className="bg-surface-container-lowest rounded-xl p-6 shadow-card">
            <h2 className="font-headline text-lg font-bold text-on-surface flex items-center gap-2 mb-4">Detection Details</h2>

            {/* Classification source badge */}
            <div className="mb-4">
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${badge.className}`}>{badge.label}</span>
            </div>

            {/* Bot detection details */}
            {org.hasBot && (() => {
              const botEvent = org.events.find((e) => e.isBot);
              const ua = botEvent?.userAgent || '';
              // Extract bot name from user agent (e.g. "YisouSpider/5.0" → "YisouSpider")
              const botMatch = ua.match(/([A-Za-z]*(?:bot|spider|crawl|slurp|archiver|fetcher|scanner)[A-Za-z]*)\b/i);
              const detectedByUA = !!botEvent;
              const orgKey = org.events[0]?.orgName || org.events[0]?.org || '';
              const botName = botMatch ? botMatch[1] : (detectedByUA ? 'Unknown Bot' : orgKey || 'Unknown Bot');
              const detectionMethod = detectedByUA ? 'User-Agent match' : 'Known bot organization';
              return (
                <div className="bg-surface-container-low rounded-lg p-4 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Bot Name</span>
                    <span className="text-sm font-medium text-on-surface">{botName}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Detection</span>
                    <span className="text-sm font-medium text-on-surface">{detectionMethod}</span>
                  </div>
                </div>
              );
            })()}

            {/* IP vs AI comparison */}
            {!org.hasBot && hasAI ? (
              <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center mt-4">
                <div className="bg-surface-container-low rounded-lg p-4">
                  <div className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2">IP Lookup</div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Type</span>
                    <span className="text-sm font-medium text-on-surface">{ipOrgType}</span>
                  </div>
                </div>
                <div className="text-center">
                  {aiUpgraded ? (
                    <span className="text-secondary font-bold text-xs">↑ Upgraded</span>
                  ) : aiConfirmed ? (
                    <span className="text-secondary font-bold text-xs">✓ Confirmed</span>
                  ) : (
                    <span className="text-on-surface-variant">→</span>
                  )}
                </div>
                <div className="bg-surface-container-low rounded-lg p-4">
                  <div className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2">AI Classification</div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Confidence</span>
                    <span className="text-sm font-medium text-on-surface">{(effectiveAiConf * 100).toFixed(0)}%</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Type</span>
                    <span className="text-sm font-medium text-on-surface">{effectiveAiOrgType}</span>
                  </div>
                </div>
              </div>
            ) : org.maxBehaviorScore > 0 ? (
              <div className="bg-surface-container-low rounded-lg p-4 space-y-2 mt-4">
                <div className="flex justify-between items-center py-1">
                  <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Behavior Score</span>
                  <span className="text-sm font-medium text-on-surface">{(org.maxBehaviorScore * 100).toFixed(0)}%</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Traffic</span>
                  <span className="text-sm font-medium text-on-surface">
                    {(() => {
                      const ev = org.events.find(e => e.trafficChannel || e.referrer);
                      if (!ev) return 'unknown';
                      return String(resolveTrafficChannel(ev)).replace(/_/g, ' ');
                    })()}
                  </span>
                </div>
              </div>
            ) : null}

            {/* AI reason */}
            {effectiveAiReason && (
              <div className="mt-3 flex items-start gap-2">
                <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">AI Reason</span>
                <span className="text-sm text-on-surface-variant">{effectiveAiReason}</span>
              </div>
            )}

            {/* Final result */}
            <div className="mt-4 pt-3 border-t border-outline-variant/10 text-sm font-semibold text-on-surface">
              Final: {(hasOverrideAI ? override?.organizationType : null) || org.organizationType || 'unknown'}
              {org.maxConfidence > 0 && ` · ${(org.maxConfidence * 100).toFixed(0)}%`}
              {org.isTargetCustomer && <span className="text-secondary"> · Target</span>}
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
          <div className="bg-surface-container-lowest rounded-xl p-6 shadow-card">
            <h2 className="font-headline text-lg font-bold text-on-surface flex items-center gap-2 mb-4">Classification Override</h2>

            <div className="flex flex-wrap items-center gap-2 mb-3">
              {isManual ? (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-tertiary-fixed text-on-tertiary-fixed-variant">Manual Override</span>
              ) : override?.found ? (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-secondary/10 text-secondary">AI Classified</span>
              ) : (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-secondary/10 text-secondary">Auto Classified</span>
              )}
              {!isManual && override?.provider && (
                <span style={{ fontSize: '0.75rem', color: '#888', marginLeft: '0.4rem' }}>
                  via {override.provider === 'bedrock' ? 'Bedrock' : 'Anthropic API'}
                </span>
              )}
              <span className="text-sm font-semibold text-on-surface">
                {currentIsTarget ? 'Target Customer' : 'Not Target'}
              </span>
            </div>

            {/* Reason display */}
            {(override?.reason || aiEvent?.aiReason) && (
              <div style={{ fontSize: '0.85rem', color: '#666', margin: '0.4rem 0' }}>
                {isManual && override?.reason
                  ? <>Reason: {override.reason}</>
                  : override?.reason
                    ? <>AI: {override.reason}</>
                    : aiEvent?.aiReason
                      ? <>AI: {aiEvent.aiReason}</>
                      : null}
              </div>
            )}

            {hasConflict && (
              <div className="bg-error-container text-on-error-container p-3 rounded-lg text-sm my-2">
                Manual classification conflicts with AI — AI says{' '}
                {aiEvent!.aiConfidence! >= 0.5 ? 'target' : 'not target'} ({(aiEvent!.aiConfidence! * 100).toFixed(0)}% confidence)
              </div>
            )}

            <div className="flex gap-2 mt-3">
              {currentIsTarget ? (
                <button
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-error-container text-on-error-container hover:opacity-90 disabled:opacity-50"
                  onClick={() => handleOverride(false)}
                  disabled={overrideLoading}
                >
                  Mark as Not Target
                </button>
              ) : (
                <button
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-primary text-on-primary hover:opacity-90 disabled:opacity-50"
                  onClick={() => handleOverride(true)}
                  disabled={overrideLoading}
                >
                  Mark as Target
                </button>
              )}
              {isManual && (
                <button
                  className="px-4 py-2 rounded-lg text-sm font-semibold border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-low disabled:opacity-50"
                  onClick={handleUndoOverride}
                  disabled={overrideLoading}
                >
                  Undo Override
                </button>
              )}
            </div>

            {overrideMsg && (
              <div className={`mt-2 p-2 rounded-lg text-sm ${overrideMsg.type === 'success' ? 'bg-secondary/10 text-secondary' : 'bg-error-container text-on-error-container'}`}>{overrideMsg.text}</div>
            )}
          </div>
        );
      })()}

      {/* User Agent */}
      {uniqueUAs.length > 0 && (
        <div className="bg-surface-container-lowest rounded-xl p-6 shadow-card">
          <h2 className="font-headline text-lg font-bold text-on-surface flex items-center gap-2 mb-4">User Agent</h2>
          <div className="space-y-1">
            {uniqueUAs.map((ua) => (
              <div key={ua} className="text-xs text-on-surface-variant font-mono bg-surface-container-low rounded px-3 py-2 break-all">{ua}</div>
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
          <div className="bg-surface-container-lowest rounded-xl p-6 shadow-card">
            <h2 className="font-headline text-lg font-bold text-on-surface flex items-center gap-2 mb-4">Pages Visited</h2>
            <div className="space-y-1">
              {Array.from(uniquePages.entries()).map(([path, count]) => (
                <div key={path} className="flex justify-between items-center bg-surface-container-low rounded px-3 py-2">
                  <span className="text-sm font-medium text-on-surface">{path}</span>
                  <span className="text-[10px] font-bold bg-surface-container px-2 py-0.5 rounded text-on-surface-variant">{count}x</span>
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
          ai_referral:    { bg: '#ede7f6', color: '#4527a0', label: 'AI Referral' },
          paid_social:    { bg: '#fff3e0', color: '#e65100', label: 'Paid Social' },
          organic_social: { bg: '#e3f2fd', color: '#1565c0', label: 'Organic Social' },
          email:          { bg: '#f3e5f5', color: '#7b1fa2', label: 'Email' },
          referral:       { bg: '#e0f2f1', color: '#00695c', label: 'Referral' },
          direct:         { bg: '#f5f5f5', color: '#616161', label: 'Direct' },
        };
        const fallbackStyle = { bg: '#f5f5f5', color: '#616161', label: 'Other' };
        const sources = new Map<string, { count: number; channel: TrafficChannel; label: string }>();
        for (const e of org.events) {
          const channel = resolveTrafficChannel(e);
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
          <div className="bg-surface-container-lowest rounded-xl p-6 shadow-card">
            <h2 className="font-headline text-lg font-bold text-on-surface flex items-center gap-2 mb-4">Traffic Sources</h2>
            <div className="space-y-2">
              {Array.from(sources.entries())
                .sort((a, b) => b[1].count - a[1].count)
                .map(([groupKey, { count, channel, label: displayLabel }]) => {
                  const style = channelColors[channel] || fallbackStyle;
                  return (
                    <div key={groupKey} className="bg-surface-container-low rounded-lg px-3 py-2 text-sm text-on-surface-variant">
                      <span
                        className="px-2 py-0.5 rounded text-[10px] font-bold"
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
      <div className="bg-surface-container-lowest rounded-xl p-6 shadow-card">
        <h2 className="font-headline text-lg font-bold text-on-surface flex items-center gap-2 mb-4">
          Visit Timeline
          {uniqueVisitors.length > 1 && <span className="bg-surface-container-low px-2 py-0.5 rounded text-[10px] font-medium text-on-surface-variant ml-2">{uniqueVisitors.length} visitors</span>}
        </h2>
        <div className="space-y-3">
          {/* Hint: visit started before the selected date range */}
          {org.events.length > 0 && org.events.every((e) => e.eventType === 'page_time_flush') && (
            <div style={{ background: '#fff8e1', color: '#8d6e00', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', marginBottom: '8px', lineHeight: 1.6 }}>
              Page opened before selected date range — only the unload event is within the current filter.
              {(org.orgName || org.country) && (
                <span style={{ display: 'block', marginTop: '2px', fontWeight: 500 }}>
                  {org.orgName && org.orgName !== org.key && <>{org.orgName}</>}
                  {org.city && <>{org.orgName && org.orgName !== org.key ? ' · ' : ''}{org.city}{org.region ? `, ${org.region}` : ''}</>}
                  {org.country && <>{(org.orgName && org.orgName !== org.key) || org.city ? ' · ' : ''}{org.country}</>}
                </span>
              )}
            </div>
          )}
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
              ai_referral:    { bg: '#ede7f6', color: '#4527a0', label: 'AI Referral' },
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
              const channel = resolveTrafficChannel(e);
              const style = channelColorsTimeline[channel] || fallbackChannelStyle;
              const label = e.referrer
                ? (() => { try { return new URL(e.referrer).hostname; } catch { return e.referrer; } })()
                : style.label;
              const sq = getSearchQuery(e);
              return (
                <>
                  <span className="inline-block rounded px-1.5 py-px text-[11px] ml-1" style={{ background: style.bg, color: style.color, padding: '1px 6px', borderRadius: '4px', fontSize: '11px', marginLeft: '4px' }}>
                    {label}
                  </span>
                  {(sq || e.utmTerm) && (
                    <span className="inline-block rounded px-1.5 py-px text-[11px] ml-1" style={{ background: '#fff8e1', color: '#f57f17', padding: '1px 6px', borderRadius: '4px', fontSize: '11px', marginLeft: '4px' }}>
                      🔍 {sq || e.utmTerm}
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
                <div key={date} className="space-y-1">
                  <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest pt-2 pb-1">{date}</div>
                  {events.map((e) => {
                    const pageDuration = perPageDurations.get(e.id);
                    return (
                    <div key={e.id} className="flex flex-wrap items-center gap-1.5 text-xs py-1 px-2 rounded hover:bg-surface-container-low">
                      <span className="text-on-surface-variant font-mono text-[11px] shrink-0">
                        {new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-surface-container text-on-surface-variant">
                        {e.eventType}
                      </span>
                      {e.eventType === 'page_time_flush' ? (
                        <>
                          <span className="text-on-surface font-medium">{e.pathname || '/'}</span>
                          {e.activeSeconds != null && (
                            <span className="text-on-surface-variant" style={{ fontSize: '11px', color: '#666', marginLeft: '6px' }}>
                              {formatDuration(e.activeSeconds)} active
                              {e.idleSeconds != null && e.idleSeconds > 0 && <> · {formatDuration(e.idleSeconds)} idle</>}
                              {e.hiddenSeconds != null && e.hiddenSeconds > 0 && <> · {formatDuration(e.hiddenSeconds)} hidden</>}
                            </span>
                          )}
                          {(() => { const sd = (e as Record<string, unknown>).maxScrollDepth as number; return sd > 0 ? (
                            <span style={{ background: sd >= 75 ? '#e8f5e9' : sd >= 50 ? '#fff8e1' : '#f5f5f5', color: sd >= 75 ? '#2e7d32' : sd >= 50 ? '#f57f17' : '#888', padding: '1px 5px', borderRadius: '4px', fontSize: '10px', marginLeft: '4px', fontWeight: 500 }}>
                              ↓{sd}%
                            </span>
                          ) : null; })()}
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
                          <span className="text-on-surface font-medium">{e.eventType === 'page_view' ? (e.pathname || e.eventName) : (e.eventName || e.pathname)}</span>
                          {e.productName && (
                            <span className="text-secondary text-[11px] font-medium">{e.productName}</span>
                          )}
                          {pageDuration != null && pageDuration > 0 && (
                            <span className="text-on-surface-variant text-[11px]">{formatDuration(pageDuration)}</span>
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
                <div key={vKey} className="border-l-2 border-outline-variant/20 pl-4 space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
                    <span className="font-bold text-on-surface text-sm">Visitor {idx + 1}</span>
                    {ip && (
                      <span className="font-mono cursor-pointer hover:text-on-surface" onClick={() => setShowFullIP((v) => !v)}>
                        {showFullIP ? ip : maskIP(ip)}
                      </span>
                    )}
                    {shortUA && <span className="text-on-surface-variant">{shortUA}</span>}
                    <span className="text-on-surface-variant">{events.length} events</span>
                    {vKey && !vKey.includes('.') && <span className="font-mono text-on-surface-variant" title={vKey}>{vKey.slice(0, 8)}</span>}
                  </div>
                  {Array.from(visitorDateGroups.entries()).map(([date, devts]) => (
                    <div key={date} className="space-y-1">
                      <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest pt-2 pb-1">{date}</div>
                      {devts.map((e) => {
                        const pageDuration = perPageDurations.get(e.id);
                        return (
                        <div key={e.id} className="flex flex-wrap items-center gap-1.5 text-xs py-1 px-2 rounded hover:bg-surface-container-low">
                          <span className="text-on-surface-variant font-mono text-[11px] shrink-0">
                            {new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-surface-container text-on-surface-variant">
                            {e.eventType}
                          </span>
                          {e.eventType === 'page_time_flush' ? (
                            <>
                              <span className="text-on-surface font-medium">{e.pathname || '/'}</span>
                              {e.activeSeconds != null && (
                                <span className="text-on-surface-variant" style={{ fontSize: '11px', color: '#666', marginLeft: '6px' }}>
                                  {formatDuration(e.activeSeconds)} active
                                  {e.idleSeconds != null && e.idleSeconds > 0 && <> · {formatDuration(e.idleSeconds)} idle</>}
                                  {e.hiddenSeconds != null && e.hiddenSeconds > 0 && <> · {formatDuration(e.hiddenSeconds)} hidden</>}
                                </span>
                              )}
                              {(() => { const sd = (e as Record<string, unknown>).maxScrollDepth as number; return sd > 0 ? (
                                <span style={{ background: sd >= 75 ? '#e8f5e9' : sd >= 50 ? '#fff8e1' : '#f5f5f5', color: sd >= 75 ? '#2e7d32' : sd >= 50 ? '#f57f17' : '#888', padding: '1px 5px', borderRadius: '4px', fontSize: '10px', marginLeft: '4px', fontWeight: 500 }}>
                                  ↓{sd}%
                                </span>
                              ) : null; })()}
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
                              <span className="text-on-surface font-medium">{e.eventType === 'page_view' ? (e.pathname || e.eventName) : (e.eventName || e.pathname)}</span>
                              {e.productName && (
                                <span className="text-secondary text-[11px] font-medium">{e.productName}</span>
                              )}
                              {pageDuration != null && pageDuration > 0 && (
                                <span className="text-on-surface-variant text-[11px]">{formatDuration(pageDuration)}</span>
                              )}
                            </>
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
  const [showPrivateIPs, setShowPrivateIPs] = useState(false);
  const [hideSelf, setHideSelf] = useState(true);
  const [sortCol, setSortCol] = useState<SortColumn>('lastVisit');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [selectedOrg, setSelectedOrg] = useState<OrganizationRecord | null>(null);
  const [kpiFilter, setKpiFilter] = useState<KpiFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshing, setRefreshing] = useState(false); // soft refresh indicator
  const [orgOverrides, setOrgOverrides] = useState<OrgOverrideSummary[]>([]);
  const [keywordSourceFilter, setKeywordSourceFilter] = useState<KeywordSourceFilter>('all');
  const [keywordSectionOpen, setKeywordSectionOpen] = useState(false);
  const [pageAnalyticsTab, setPageAnalyticsTab] = useState<PageAnalyticsTab>('topPages');
  const [pageAnalyticsSectionOpen, setPageAnalyticsSectionOpen] = useState(true);
  const [trendsSectionOpen, setTrendsSectionOpen] = useState(true);
  // Enhanced filter state
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [regionFilter, setRegionFilter] = useState<string>('all');
  const [scoreMin, setScoreMin] = useState<string>('');
  const [scoreMax, setScoreMax] = useState<string>('');
  const [lifecycleFilter, setLifecycleFilter] = useState<string>('all');
  const [filtersOpen, setFiltersOpen] = useState(true);
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
        'purchase', 'rfq_step', 'rfq_submission', 'other', 'anomaly',
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

        // ── Enrich orphaned page_time_flush events ──────────────────────
        // When a visit spans midnight, the page_view falls outside the date
        // filter while the page_time_flush is inside.  Fetch the missing
        // page_view events via the sessionId GSI so aggregation has full
        // org/geo data.
        const existingIds = new Set(collected.map((e) => e.id));
        const hasPageView = new Set<string>();   // visitorId/IP keys that already have a page_view
        const orphanSessionIds = new Set<string>();
        for (const e of collected) {
          if (e.eventType === 'page_view') {
            hasPageView.add(e.visitorId || e.ip || '');
          }
        }
        for (const e of collected) {
          if (
            e.eventType === 'page_time_flush' &&
            e.sessionId &&
            !hasPageView.has(e.visitorId || e.ip || '')
          ) {
            orphanSessionIds.add(e.sessionId);
          }
        }
        if (orphanSessionIds.size > 0 && !cancelled) {
          const lookups = Array.from(orphanSessionIds).map(async (sid) => {
            try {
              const res = await (client.models.AnalyticsEvent as any)
                .listAnalyticsEventBySessionIdAndTimestamp(
                  { sessionId: sid },
                  { authMode: 'userPool', limit: 20 },
                );
              return ((res.data || []) as AnalyticsEvent[]).filter(
                (e: AnalyticsEvent) => e.eventType === 'page_view' && !existingIds.has(e.id),
              );
            } catch { return []; }
          });
          const enriched = (await Promise.all(lookups)).flat();
          if (enriched.length > 0 && !cancelled) {
            collected.push(...enriched);
          }
        }

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

  // Own visitorId for self-exclusion
  const selfVisitorId = useMemo(() => {
    try { return localStorage.getItem('ns_visitor_id') || ''; } catch { return ''; }
  }, []);

  // Collect all visitorIds that share an org with the admin's current visitorId.
  // This catches historical visitorIds (cleared localStorage, different sessions)
  // that were grouped into the same organization by IP/org lookup.
  const selfVisitorIds = useMemo(() => {
    if (!selfVisitorId) return new Set<string>();
    // First, aggregate orgs to find which org contains selfVisitorId
    const orgs = aggregateByOrg(allEvents);
    const selfOrg = orgs.find((o) =>
      o.events.some((e) => (e as Record<string, unknown>).visitorId === selfVisitorId)
    );
    if (!selfOrg) return new Set([selfVisitorId]);
    // Collect all visitorIds from that org
    const ids = new Set<string>();
    for (const e of selfOrg.events) {
      const vid = (e as Record<string, unknown>).visitorId as string;
      if (vid) ids.add(vid);
    }
    return ids;
  }, [allEvents, selfVisitorId]);

  // Filter bots — by isBot flag OR known bot org name
  const filteredEvents = useMemo(() => {
    let events = allEvents;
    if (!showBots) {
      events = events.filter((e) => {
        if (e.isBot) return false;
        const orgKey = e.orgName || e.org || '';
        if (orgKey && isKnownBotOrg(orgKey)) return false;
        return true;
      });
    }
    if (!showPrivateIPs) {
      events = events.filter((e) => !e.ip || !isPrivateIP(e.ip));
    }
    if (hideSelf && selfVisitorIds.size > 0) {
      events = events.filter((e) => !selfVisitorIds.has((e as Record<string, unknown>).visitorId as string));
    }
    return events;
  }, [allEvents, showBots, showPrivateIPs, hideSelf, selfVisitorIds]);

  const botCount = useMemo(() => {
    return allEvents.filter((e) => {
      if (e.isBot) return true;
      const orgKey = e.orgName || e.org || '';
      return orgKey ? isKnownBotOrg(orgKey) : false;
    }).length;
  }, [allEvents]);

  const privateIPCount = useMemo(() => {
    return allEvents.filter((e) => e.ip && isPrivateIP(e.ip)).length;
  }, [allEvents]);

  const selfCount = useMemo(() => {
    if (selfVisitorIds.size === 0) return 0;
    return allEvents.filter((e) => selfVisitorIds.has((e as Record<string, unknown>).visitorId as string)).length;
  }, [allEvents, selfVisitorIds]);

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

      if (ov.source === 'manual') {
        // Apply manual override data
        org.isTargetCustomer = ov.isTargetCustomer;
        if (ov.organizationType && ov.organizationType !== 'unknown') {
          org.organizationType = ov.organizationType;
        }
        // Manual override = admin confirmed → assign B (same as pipeline trust gate)
        if (ov.isTargetCustomer && !org.leadTier) {
          org.leadTier = 'B';
        }
        // Clear anonymous intent — manually classified orgs are not anonymous
        org.isAnonymousHighIntent = false;
      } else {
        // Apply AI classification when event-level data is missing (pre-fix records)
        if ((!org.organizationType || org.organizationType === 'unknown')
          && ov.organizationType && ov.organizationType !== 'unknown') {
          org.organizationType = ov.organizationType;
        }
      }
    }

    return orgs;
  }, [filteredEvents, orgOverrides]);

  // Apply KPI filter
  const filteredOrgs = useMemo(() => {
    switch (kpiFilter) {
      case 'target':
        return organizations.filter((o) => o.isTargetCustomer);
      case 'education':
        return organizations.filter((o) =>
          o.organizationType === 'education' || o.organizationType === 'university' || o.organizationType === 'research_institute'
        );
      case 'business':
        return organizations.filter((o) =>
          o.organizationType === 'business' || o.organizationType === 'enterprise'
        );
      case 'hotLead':
        return organizations.filter((o) => o.leadTier === 'A');
      case 'returning':
        return organizations.filter((o) => o.returnVisits > 0);
      case 'aiReferral':
        return organizations.filter((o) =>
          o.events.some((e) => resolveTrafficChannel(e) === 'ai_referral')
        );
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

  // Enhanced filters: channel, region, score range, lifecycle
  const enhancedFilteredOrgs = useMemo(() => {
    let result = searchedOrgs;

    if (channelFilter !== 'all') {
      result = result.filter((o) =>
        o.events.some((e) => resolveTrafficChannel(e) === channelFilter)
      );
    }

    if (regionFilter !== 'all') {
      result = result.filter((o) => o.country === regionFilter);
    }

    const minVal = scoreMin !== '' ? parseFloat(scoreMin) : NaN;
    const maxVal = scoreMax !== '' ? parseFloat(scoreMax) : NaN;
    if (!isNaN(minVal)) {
      result = result.filter((o) => o.maxBehaviorScore >= minVal);
    }
    if (!isNaN(maxVal)) {
      result = result.filter((o) => o.maxBehaviorScore <= maxVal);
    }

    if (lifecycleFilter !== 'all') {
      result = result.filter((o) => o.lifecycleStage === lifecycleFilter);
    }

    return result;
  }, [searchedOrgs, channelFilter, regionFilter, scoreMin, scoreMax, lifecycleFilter]);

  // Unique countries for region filter dropdown
  const availableCountries = useMemo(() => {
    const countries = new Set<string>();
    for (const o of organizations) {
      if (o.country) countries.add(o.country);
    }
    return Array.from(countries).sort();
  }, [organizations]);

  // Active filter count + summary for collapsible filter bar
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (channelFilter !== 'all') count++;
    if (regionFilter !== 'all') count++;
    if (scoreMin !== '') count++;
    if (scoreMax !== '') count++;
    if (lifecycleFilter !== 'all') count++;
    return count;
  }, [channelFilter, regionFilter, scoreMin, scoreMax, lifecycleFilter]);

  const filterSummary = useMemo(() => {
    const parts: string[] = [];
    if (channelFilter !== 'all') {
      const labels: Record<string, string> = { paid_search: 'Paid Search', organic_search: 'Organic Search', ai_referral: 'AI Referral', paid_social: 'Paid Social', organic_social: 'Organic Social', email: 'Email', referral: 'Referral', direct: 'Direct' };
      parts.push(labels[channelFilter] || channelFilter);
    }
    if (regionFilter !== 'all') parts.push(regionFilter);
    if (scoreMin !== '' || scoreMax !== '') parts.push(`Score ${scoreMin || '0'}–${scoreMax || '1'}`);
    if (lifecycleFilter !== 'all') parts.push(lifecycleFilter);
    return parts.join(' · ');
  }, [channelFilter, regionFilter, scoreMin, scoreMax, lifecycleFilter]);

  // Sort organizations
  const sortedOrgs = useMemo(() => {
    return [...enhancedFilteredOrgs].sort((a, b) => {
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
        case 'engagement':
          cmp = engagementRank(a.maxBehaviorScore) - engagementRank(b.maxBehaviorScore);
          break;
        case 'lastVisit':
          cmp = new Date(a.lastVisit).getTime() - new Date(b.lastVisit).getTime();
          break;
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });
  }, [searchedOrgs, sortCol, sortDir]);

  // ─── Search Keywords aggregation ───────────────────────────────────────────
  const allKeywords = useMemo(() => aggregateKeywords(filteredEvents), [filteredEvents]);
  const displayedKeywords = useMemo(() => {
    if (keywordSourceFilter === 'all') return allKeywords;
    if (keywordSourceFilter === 'external') return allKeywords.filter(k => k.source === 'organic' || k.source === 'paid');
    return allKeywords.filter(k => k.source === 'internal');
  }, [allKeywords, keywordSourceFilter]);

  // ─── Page Analytics aggregation ─────────────────────────────────────────────
  const pageStats = useMemo(() => aggregatePageStats(filteredEvents), [filteredEvents]);
  const productStats = useMemo(() => aggregateProductStats(pageStats, filteredEvents), [pageStats, filteredEvents]);
  const landingPageStats = useMemo(() => aggregateLandingPages(filteredEvents), [filteredEvents]);
  const [expandedPageOrgs, setExpandedPageOrgs] = useState<Set<string>>(new Set());
  const [expandedKeywordOrgs, setExpandedKeywordOrgs] = useState<Set<string>>(new Set());

  // KPI stats with trend (compare first half vs second half of period)
  const kpis = useMemo(() => {
    const uniqueVisitors = organizations.length;
    const targetCustomers = organizations.filter((o) => o.isTargetCustomer).length;
    const educationOrgs = organizations.filter((o) =>
      o.organizationType === 'education' || o.organizationType === 'university' || o.organizationType === 'research_institute'
    ).length;
    const hotLeads = organizations.filter((o) => o.leadTier === 'A').length;
    const returning = organizations.filter((o) => o.returnVisits > 0).length;
    const businessOrgs = organizations.filter((o) =>
      o.organizationType === 'business' || o.organizationType === 'enterprise'
    ).length;
    const aiReferral = organizations.filter((o) =>
      o.events.some((e) => resolveTrafficChannel(e) === 'ai_referral')
    ).length;
    const anonymousIntent = organizations.filter((o) => o.isAnonymousHighIntent).length;
    const ispHighIntent = organizations.filter((o) => o.isAnonymousHighIntent && o.isISPVisitor).length;

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

    return { uniqueVisitors, targetCustomers, educationOrgs, hotLeads, returning, businessOrgs, aiReferral, anonymousIntent, ispHighIntent, visitorTrend };
  }, [organizations, filteredEvents, dateRange, customStart, customEnd]);

  function exportCSV() {
    const headers = ['Organization', 'Type', 'Location', 'Products', 'Pages', 'Active Time (s)', 'Events', 'Tier', 'Engagement', 'Last Visit'];
    const rows = sortedOrgs.map((o) => [
      o.orgName,
      o.organizationType || '',
      [o.city, o.region, o.country].filter(Boolean).join(', '),
      o.productsViewed.join('; '),
      o.uniquePages,
      o.totalTimeOnSite,
      o.totalEvents,
      o.leadTier || '',
      engagementLevel(o.maxBehaviorScore) || '',
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
      <div className="flex items-center justify-center py-20 text-on-surface-variant">
        Loading analytics...{loadProgress > 0 ? ` (${loadProgress} events)` : ''}
      </div>
    );
  }

  // Show detail view if an org is selected
  if (selectedOrg) {
    return (
      <div className="space-y-6">
        <OrgDetail org={selectedOrg} onBack={() => history.back()} />
      </div>
    );
  }

  return (
    <div className="space-y-8">

      {/* ─── Hero Header ──────────────────────────────────────────────────── */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-secondary">Precision Insights</span>
          <h1 className="font-headline text-4xl font-black text-primary tracking-tighter mt-1">Intelligence Ledger</h1>
        </div>
        <div className="flex items-center gap-2">
          {DATE_RANGES.filter(r => r.value !== 'custom').map((r) => (
            <button
              key={r.value}
              className={`px-4 py-2 text-xs font-semibold rounded-lg border transition-colors ${dateRange === r.value
                ? 'border-primary bg-primary text-on-primary'
                : 'border-outline-variant/30 text-on-surface-variant hover:border-outline-variant/60 hover:text-on-surface'}`}
              onClick={() => setDateRange(r.value)}
            >
              {r.label}
            </button>
          ))}
          <button
            className={`p-2 rounded-lg border transition-colors ${dateRange === 'custom'
              ? 'border-primary bg-primary text-on-primary'
              : 'border-outline-variant/30 text-on-surface-variant hover:border-outline-variant/60 hover:text-on-surface'}`}
            onClick={() => setDateRange('custom')}
            title="Custom date range"
          >
            <span className="material-symbols-outlined text-lg">calendar_today</span>
          </button>
        </div>
      </section>

      {dateRange === 'custom' && (
        <div className="flex items-center gap-2 -mt-4 mb-4">
          <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)}
            className="bg-surface-container-lowest border border-outline-variant/20 rounded-lg py-1.5 px-3 text-sm" />
          <span className="text-on-surface-variant text-sm">to</span>
          <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)}
            className="bg-surface-container-lowest border border-outline-variant/20 rounded-lg py-1.5 px-3 text-sm" />
        </div>
      )}

      {error && <div className="bg-error-container text-on-error-container p-3 rounded-lg text-sm">{error}</div>}

      {/* ─── Filter Chips ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 py-2 border-b border-outline-variant/5">
        <span className="text-xs font-bold text-on-surface-variant mr-2">FILTERS:</span>
        {([
          { key: 'all' as KpiFilter, label: 'All' },
          { key: 'target' as KpiFilter, label: 'Target Customers' },
          { key: 'education' as KpiFilter, label: 'Education' },
          { key: 'hotLead' as KpiFilter, label: 'Hot Leads' },
          { key: 'returning' as KpiFilter, label: 'Returning' },
        ]).map(({ key, label }) => (
          <button
            key={key}
            className={`px-4 py-1.5 rounded-full text-xs whitespace-nowrap border transition-colors ${
              kpiFilter === key
                ? 'border-primary bg-primary text-on-primary font-semibold'
                : 'border-outline-variant/30 text-on-surface-variant font-medium hover:border-outline-variant/60 hover:text-on-surface'
            }`}
            onClick={() => setKpiFilter(kpiFilter === key && key !== 'all' ? 'all' : key)}
          >
            {label}
          </button>
        ))}
        {dateRange !== 'all' && kpis.visitorTrend !== 0 && (
          <span className={`text-xs font-semibold ml-auto shrink-0 ${kpis.visitorTrend > 0 ? 'text-green-600' : 'text-red-600'}`}>
            {kpis.visitorTrend > 0 ? '+' : ''}{kpis.visitorTrend}% vs prev
          </span>
        )}
      </div>

      {/* ─── Bento Grid ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Hero KPI Card — col-span-4 */}
        <div className="lg:col-span-4 group relative overflow-hidden bg-primary-container rounded-xl p-8">
          <div className="relative z-10">
            <p className="text-on-primary-container/80 text-sm font-medium mb-1">Unique Visitors</p>
            <h3 className="font-headline text-6xl font-black text-white tracking-tighter mb-4">{kpis.uniqueVisitors}</h3>
            <div className="flex items-center gap-2 text-primary-fixed-dim font-bold text-sm">
              {dateRange !== 'all' && kpis.visitorTrend !== 0 ? (
                <>
                  <span className="material-symbols-outlined text-sm">
                    {kpis.visitorTrend > 0 ? 'trending_up' : 'trending_down'}
                  </span>
                  {kpis.visitorTrend > 0 ? '+' : ''}{kpis.visitorTrend}% vs Previous Period
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-sm">flag</span>
                  {kpis.targetCustomers} target customers
                </>
              )}
            </div>
          </div>
          <div className="absolute -right-8 -bottom-8 opacity-10 group-hover:scale-110 transition-transform duration-700">
            <span className="material-symbols-outlined text-[180px]" style={{ fontVariationSettings: "'FILL' 1" }}>analytics</span>
          </div>
        </div>

        {/* Traffic Channel Attribution — col-span-8 */}
        <div className="lg:col-span-8 bg-surface-container-lowest rounded-xl p-8">
          <div className="flex justify-between items-center mb-10">
            <h4 className="font-headline font-bold text-on-surface">Traffic Channel Attribution</h4>
            <span className="text-xs font-medium text-on-surface-variant">Volume / Sessions</span>
          </div>
          <ChannelSummaryChart events={filteredEvents} onChannelClick={(ch) => { setChannelFilter(ch); setFiltersOpen(true); }} />
        </div>

        {/* Organization Ledger — col-span-9 */}
        <div className="lg:col-span-9 bg-surface-container-lowest rounded-xl overflow-hidden">
          <div className="p-6 border-b border-surface-container flex justify-between items-center">
            <h4 className="font-headline font-bold">Organization Ledger</h4>
            <button
              className="material-symbols-outlined text-on-surface-variant hover:text-primary transition-colors border-none bg-transparent cursor-pointer"
              onClick={exportCSV}
              title="Export CSV"
            >
              download
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="hidden md:table w-full text-left table-fixed">
              <thead>
                <tr className="bg-surface-container-low">
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant cursor-pointer" onClick={() => handleSort('orgName')}>
                    Name{sortIndicator('orgName')}
                  </th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant cursor-pointer" onClick={() => handleSort('organizationType')}>
                    Type{sortIndicator('organizationType')}
                  </th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant text-center cursor-pointer" onClick={() => handleSort('totalEvents')}>
                    Visits{sortIndicator('totalEvents')}
                  </th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant cursor-pointer" onClick={() => handleSort('engagement')}>
                    Engagement{sortIndicator('engagement')}
                  </th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant text-right">Target</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container-low">
                {sortedOrgs.slice(0, 15).map((org) => (
                  <tr
                    key={org.key}
                    className="hover:bg-primary-fixed/30 transition-colors cursor-pointer"
                    onClick={() => selectOrg(org)}
                  >
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-surface-container flex items-center justify-center font-headline font-bold text-primary text-xs shrink-0">
                          {org.orgName.split(/[\s,]+/).slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('')}
                        </div>
                        <span className="text-sm font-semibold">{org.orgName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-xs text-on-surface-variant">{org.organizationType || '--'}</td>
                    <td className="px-6 py-5 text-xs text-center font-medium">{org.totalEvents.toLocaleString()}</td>
                    <td className="px-6 py-5">
                      <div className="w-24 bg-surface-container-high rounded-full h-1.5">
                        <div
                          className="bg-secondary h-full rounded-full"
                          style={{ width: `${Math.min(Math.max(org.maxBehaviorScore * 100, 3), 100)}%` }}
                        />
                      </div>
                    </td>
                    <td className="px-6 py-5 text-right">
                      {org.isTargetCustomer ? (
                        <span className="material-symbols-outlined text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>flag</span>
                      ) : (
                        <span className="material-symbols-outlined text-outline-variant">flag</span>
                      )}
                    </td>
                  </tr>
                ))}
                {sortedOrgs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-on-surface-variant text-sm">
                      No visitor data for this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {/* Mobile org cards in bento area */}
          <div className="md:hidden grid gap-3 p-4">
            {sortedOrgs.slice(0, 10).map((org) => (
              <div key={org.key} className="bg-surface-container-low rounded-xl p-4 cursor-pointer" onClick={() => selectOrg(org)}>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded bg-surface-container flex items-center justify-center font-headline font-bold text-primary text-xs shrink-0">
                    {org.orgName.split(/[\s,]+/).slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-on-surface truncate">{org.orgName}</div>
                    <div className="text-xs text-on-surface-variant">{org.country || 'Unknown'}</div>
                  </div>
                  {org.isTargetCustomer && (
                    <span className="material-symbols-outlined text-secondary text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>flag</span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div><div className="font-headline text-sm font-bold">{org.totalEvents}</div><div className="text-[10px] text-on-surface-variant uppercase tracking-widest">Events</div></div>
                  <div><div className="font-headline text-sm font-bold">{engagementLevel(org.maxBehaviorScore) || '--'}</div><div className="text-[10px] text-on-surface-variant uppercase tracking-widest">Engage</div></div>
                  <div><div className="font-headline text-sm font-bold">{org.maxConfidence > 0 ? `${Math.round(org.maxConfidence * 100)}%` : '--'}</div><div className="text-[10px] text-on-surface-variant uppercase tracking-widest">AI Conf</div></div>
                </div>
              </div>
            ))}
          </div>
          {sortedOrgs.length > 15 && (
            <div className="text-center py-3 border-t border-outline-variant/5">
              <span className="text-xs text-on-surface-variant">
                Showing 15 of {sortedOrgs.length} organizations.{' '}
                <a href="#full-org-table" className="text-secondary font-medium hover:underline">View all</a>
              </span>
            </div>
          )}
        </div>

        {/* Top Keywords Sidebar — col-span-3 */}
        <div className="lg:col-span-3 bg-surface-container-low p-8 rounded-xl">
          <h4 className="font-headline font-bold mb-8 flex items-center gap-2">
            <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>key</span>
            Top Keywords
          </h4>
          <div className="flex flex-col gap-6">
            {displayedKeywords.slice(0, 5).map((kw, i) => (
              <div key={`${kw.source}-${kw.keyword}-${i}`} className="flex justify-between items-center group">
                <span className="text-sm font-medium text-on-surface hover:text-secondary cursor-pointer transition-colors">
                  {kw.keyword}
                </span>
                <span className="text-xs font-semibold text-on-surface-variant">
                  {kw.count >= 1000 ? `${(kw.count / 1000).toFixed(1)}k` : kw.count}
                </span>
              </div>
            ))}
            {displayedKeywords.length === 0 && (
              <div className="text-xs text-on-surface-variant/50 text-center py-4">No keyword data</div>
            )}
          </div>
          {kpis.hotLeads > 0 && (
            <div className="mt-8 p-4 bg-surface-container-lowest rounded-lg border-l-4 border-secondary">
              <p className="text-[10px] font-bold text-secondary uppercase tracking-widest mb-2">Trend Alert</p>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                {kpis.hotLeads} hot lead{kpis.hotLeads !== 1 ? 's' : ''} identified this period.
              </p>
            </div>
          )}
        </div>

      </div>{/* End Bento Grid */}

      {/* ─── Advanced Controls (collapsed) ────────────────────────────────── */}
      <details className="mt-2">
        <summary className="text-xs font-bold uppercase tracking-widest text-on-surface-variant cursor-pointer select-none py-2">
          Advanced Controls
        </summary>
        <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-outline-variant/10">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={showBots} onChange={(e) => setShowBots(e.target.checked)} className="accent-secondary" />
            <span className="text-xs font-medium text-on-surface-variant">Bots ({botCount})</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={showPrivateIPs} onChange={(e) => setShowPrivateIPs(e.target.checked)} className="accent-secondary" />
            <span className="text-xs font-medium text-on-surface-variant">Private IPs ({privateIPCount})</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={hideSelf} onChange={(e) => setHideSelf(e.target.checked)} className="accent-secondary" />
            <span className="text-xs font-medium text-on-surface-variant">Hide Me ({selfCount})</span>
          </label>
          <div className="flex items-center gap-3 ml-auto">
            <button
              className={`p-2 rounded-lg border-none bg-transparent text-on-surface-variant hover:bg-surface-container-low cursor-pointer ${refreshing ? 'animate-spin' : ''}`}
              onClick={() => setRefreshKey((k) => k + 1)}
              title="Refresh data" disabled={refreshing}
            >
              <span className="material-symbols-outlined text-lg">refresh</span>
            </button>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} className="accent-secondary" />
              <span className="text-xs font-medium text-on-surface-variant">Auto 30s</span>
            </label>
          </div>
        </div>
      </details>

      {/* ─── World Map ────────────────────────────────────────────────────── */}
      <VisitorMap organizations={filteredOrgs} onSelectOrg={selectOrg} resetKey={kpiFilter} />

      {/* ─── Trends Section ─────────────────────────────────────────────────── */}
      <AdminTrendsSection
        filteredEvents={filteredEvents}
        organizations={organizations}
        isOpen={trendsSectionOpen}
        onToggle={() => setTrendsSectionOpen(!trendsSectionOpen)}
        onChannelClick={(ch) => { setChannelFilter(ch); setFiltersOpen(true); }}
        onScoreRangeClick={(min, max) => { setScoreMin(min.toFixed(1)); setScoreMax(max.toFixed(1)); setFiltersOpen(true); }}
        activeChannelFilter={channelFilter}
      />

      {/* ─── Search Keywords Section ────────────────────────────────────────── */}
      {allKeywords.length > 0 && (
        <div className="bg-surface-container-lowest rounded-xl p-6 shadow-[0_10px_30px_rgba(2,36,72,0.04)] mb-6">
          <h2
            className="font-headline text-lg font-bold text-on-surface flex items-center gap-2 mb-4 cursor-pointer select-none"
            onClick={() => setKeywordSectionOpen(!keywordSectionOpen)}
            style={{ cursor: 'pointer', userSelect: 'none' }}
          >
            <span className="text-on-surface-variant text-xs">{keywordSectionOpen ? '▼' : '▶'}</span>
            {' '}Search Keywords
            <span className="bg-surface-container px-2 py-0.5 rounded text-[10px] font-bold text-on-surface-variant">{allKeywords.length}</span>
          </h2>

          {keywordSectionOpen && (
            <>
              {/* Source filter tabs */}
              <div className="flex gap-2 mb-4">
                {([['all', 'All'], ['external', 'External'], ['internal', 'Internal']] as const).map(([val, label]) => (
                  <button
                    key={val}
                    className={`px-4 py-2 rounded-lg text-xs font-medium border transition-colors ${keywordSourceFilter === val ? 'border-primary bg-primary text-on-primary font-bold' : 'border-outline-variant/30 text-on-surface-variant hover:border-outline-variant/60 hover:text-on-surface'}`}
                    onClick={() => setKeywordSourceFilter(val)}
                  >
                    {label}
                    <span className="text-[10px] text-on-surface-variant ml-1">
                      {val === 'all'
                        ? allKeywords.length
                        : val === 'external'
                          ? allKeywords.filter(k => k.source === 'organic' || k.source === 'paid').length
                          : allKeywords.filter(k => k.source === 'internal').length}
                    </span>
                  </button>
                ))}
              </div>

              {/* Top 10 bar chart */}
              {displayedKeywords.length > 0 && (() => {
                const top10 = displayedKeywords.slice(0, 10);
                const maxCount = top10[0]?.count || 1;
                return (
                  <div className="space-y-2">
                    {top10.map((kw, i) => (
                      <div key={`${kw.source}-${kw.keyword}-${i}`} className="flex items-center gap-3">
                        <span className="text-sm font-medium text-on-surface w-36 truncate" title={kw.keyword}>
                          {kw.keyword.length > 30 ? kw.keyword.slice(0, 30) + '...' : kw.keyword}
                        </span>
                        <div className="flex-1 bg-surface-container-high rounded-full h-2">
                          <div
                            className="bg-secondary h-full rounded-full transition-all"
                            style={{ width: `${Math.max((kw.count / maxCount) * 100, 4)}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-bold text-on-surface-variant w-8 text-right">{kw.count}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* Keywords table */}
              <div className="bg-surface-container-lowest rounded-xl overflow-hidden" style={{ marginTop: '1rem' }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th>Keyword</th>
                      <th>Count</th>
                      <th>Source</th>
                      <th>Engine / Page</th>
                      <th>Organizations</th>
                      <th>Last Seen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedKeywords.slice(0, 50).map((kw, i) => (
                      <tr key={`${kw.source}-${kw.keyword}-${i}`}>
                        <td className="text-sm font-medium text-on-surface max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap" title={kw.keyword}>{kw.keyword}</td>
                        <td style={{ textAlign: 'center' }}>{kw.count}</td>
                        <td>
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-surface-container text-on-surface-variant">
                            {kw.source === 'organic' ? 'Organic' : kw.source === 'paid' ? 'Paid' : 'Internal'}
                          </span>
                        </td>
                        <td>{kw.searchEngine || (kw.source === 'internal' ? 'Site Search' : '—')}</td>
                        <td>
                          <div className="flex flex-wrap gap-1">
                            {(() => {
                              const kwKey = `${kw.source}-${kw.keyword}`;
                              const isExpanded = expandedKeywordOrgs.has(kwKey);
                              return <>
                                {(isExpanded ? kw.organizations : kw.organizations.slice(0, 2)).map(org => (
                                  <button
                                    key={org}
                                    className="px-2 py-0.5 rounded text-[10px] font-medium bg-surface-container-low text-on-surface-variant hover:bg-surface-container cursor-pointer border-none"
                                    onClick={() => {
                                      const match = organizations.find(o => o.orgName === org);
                                      if (match) selectOrg(match);
                                    }}
                                    title={org}
                                  >
                                    {org.length > 20 ? org.slice(0, 20) + '...' : org}
                                  </button>
                                ))}
                                {kw.organizations.length > 2 && (
                                  <button
                                    className="text-[10px] text-on-surface-variant font-medium border-none bg-transparent cursor-pointer"
                                    onClick={() => setExpandedKeywordOrgs(prev => {
                                      const next = new Set(prev);
                                      if (next.has(kwKey)) next.delete(kwKey);
                                      else next.add(kwKey);
                                      return next;
                                    })}
                                    style={{ cursor: 'pointer' }}
                                  >
                                    {isExpanded ? 'less' : `+${kw.organizations.length - 2}`}
                                  </button>
                                )}
                              </>;
                            })()}
                          </div>
                        </td>
                        <td className="text-xs text-on-surface-variant">
                          {new Date(kw.lastSeen).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {displayedKeywords.length > 50 && (
                  <div style={{ textAlign: 'center', padding: '0.5rem', color: '#666', fontSize: '0.85rem' }}>
                    Showing top 50 of {displayedKeywords.length} keywords
                  </div>
                )}
              </div>

              {/* Mobile keyword cards */}
              <div className="md:hidden grid gap-3 mt-3">
                {displayedKeywords.slice(0, 50).map((kw, i) => (
                  <div key={`${kw.source}-${kw.keyword}-${i}`} className="bg-surface-container-lowest rounded-xl p-4 shadow-card space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-on-surface" title={kw.keyword}>{kw.keyword}</span>
                      <span className="text-xs font-bold bg-surface-container px-2 py-0.5 rounded text-on-surface-variant">{kw.count}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-surface-container text-on-surface-variant">
                        {kw.source === 'organic' ? 'Organic' : kw.source === 'paid' ? 'Paid' : 'Internal'}
                      </span>
                      {kw.searchEngine && (
                        <span style={{ fontSize: '0.75rem', color: '#888' }}>{kw.searchEngine}</span>
                      )}
                    </div>
                    {kw.organizations.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {kw.organizations.slice(0, 3).map(org => (
                          <button
                            key={org}
                            className="px-2 py-0.5 rounded text-[10px] font-medium bg-surface-container-low text-on-surface-variant hover:bg-surface-container cursor-pointer border-none"
                            onClick={() => {
                              const match = organizations.find(o => o.orgName === org);
                              if (match) selectOrg(match);
                            }}
                            title={org}
                          >
                            {org.length > 18 ? org.slice(0, 18) + '...' : org}
                          </button>
                        ))}
                        {kw.organizations.length > 3 && (
                          <span className="text-[10px] text-on-surface-variant font-medium">+{kw.organizations.length - 3}</span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ─── Page Analytics Section ───────────────────────────────────────── */}
      {pageStats.length > 0 && (
        <div className="bg-surface-container-lowest rounded-xl p-6 shadow-[0_10px_30px_rgba(2,36,72,0.04)] mb-6">
          <h2
            className="font-headline text-lg font-bold text-on-surface flex items-center gap-2 mb-4 cursor-pointer select-none"
            onClick={() => setPageAnalyticsSectionOpen(!pageAnalyticsSectionOpen)}
            style={{ cursor: 'pointer', userSelect: 'none' }}
          >
            <span className="text-on-surface-variant text-xs">{pageAnalyticsSectionOpen ? '▼' : '▶'}</span>
            {' '}Page Analytics
            <span className="bg-surface-container px-2 py-0.5 rounded text-[10px] font-bold text-on-surface-variant">{pageStats.length}</span>
          </h2>

          {pageAnalyticsSectionOpen && (
            <>
              {/* Tab navigation */}
              <div className="flex gap-2 mb-4">
                {([['topPages', 'Top Pages'], ['products', 'Products'], ['landingPages', 'Landing Pages']] as const).map(([val, label]) => (
                  <button
                    key={val}
                    className={`px-4 py-2 rounded-lg text-xs font-medium border transition-colors ${pageAnalyticsTab === val ? 'border-primary bg-primary text-on-primary font-bold' : 'border-outline-variant/30 text-on-surface-variant hover:border-outline-variant/60 hover:text-on-surface'}`}
                    onClick={() => setPageAnalyticsTab(val)}
                  >
                    {label}
                    <span className="text-[10px] text-on-surface-variant ml-1">
                      {val === 'topPages' ? pageStats.length : val === 'products' ? productStats.length : landingPageStats.length}
                    </span>
                  </button>
                ))}
              </div>

              {/* ── Top Pages Tab ── */}
              {pageAnalyticsTab === 'topPages' && (() => {
                const top10 = pageStats.slice(0, 10);
                const maxViews = top10[0]?.views || 1;
                return (
                  <>
                    <div className="space-y-2">
                      {top10.map((p) => (
                        <div key={p.pathname} className="flex items-center gap-3">
                          <span className="text-sm font-medium text-on-surface w-36 truncate" title={p.pathname}>
                            {p.pathname.length > 30 ? p.pathname.slice(0, 30) + '...' : p.pathname}
                          </span>
                          <div className="flex-1 bg-surface-container-high rounded-full h-2">
                            <div
                              className="bg-secondary h-full rounded-full"
                              style={{ width: `${Math.max((p.views / maxViews) * 100, 4)}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-bold text-on-surface-variant w-8 text-right">{p.views}</span>
                        </div>
                      ))}
                    </div>
                    <div className="bg-surface-container-lowest rounded-xl overflow-hidden" style={{ marginTop: '1rem' }}>
                      <table className="w-full text-sm">
                        <thead>
                          <tr>
                            <th>Page</th>
                            <th>Title</th>
                            <th>Views</th>
                            <th>Visitors</th>
                            <th>Avg Time</th>
                            <th>Scroll</th>
                            <th>Organizations</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pageStats.slice(0, 50).map(p => (
                            <tr key={p.pathname} className={p.isProductPage ? 'bg-primary-fixed/10' : ''}>
                              <td className="text-sm font-medium text-on-surface max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap" title={p.pathname}>{p.pathname}</td>
                              <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.8rem', color: '#666' }}>
                                {p.pageTitle || '—'}
                              </td>
                              <td style={{ textAlign: 'center' }}>{p.views}</td>
                              <td style={{ textAlign: 'center' }}>{p.uniqueVisitors}</td>
                              <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                                {p.avgActiveSeconds > 0 ? formatDuration(p.avgActiveSeconds) : '—'}
                              </td>
                              <td style={{ textAlign: 'center', whiteSpace: 'nowrap', color: p.avgScrollDepth >= 75 ? '#2e7d32' : p.avgScrollDepth >= 50 ? '#f57f17' : '#888' }}>
                                {p.avgScrollDepth > 0 ? `${p.avgScrollDepth}%` : '—'}
                              </td>
                              <td>
                                <div className="flex flex-wrap gap-1">
                                  {(expandedPageOrgs.has(p.pathname) ? p.organizations : p.organizations.slice(0, 2)).map(org => (
                                    <button
                                      key={org}
                                      className="px-2 py-0.5 rounded text-[10px] font-medium bg-surface-container-low text-on-surface-variant hover:bg-surface-container cursor-pointer border-none"
                                      onClick={() => {
                                        const match = organizations.find(o => o.orgName === org);
                                        if (match) selectOrg(match);
                                      }}
                                      title={org}
                                    >
                                      {org.length > 20 ? org.slice(0, 20) + '...' : org}
                                    </button>
                                  ))}
                                  {p.organizations.length > 2 && (
                                    <button
                                      className="text-[10px] text-on-surface-variant font-medium border-none bg-transparent cursor-pointer"
                                      onClick={() => setExpandedPageOrgs(prev => {
                                        const next = new Set(prev);
                                        if (next.has(p.pathname)) next.delete(p.pathname);
                                        else next.add(p.pathname);
                                        return next;
                                      })}
                                      style={{ cursor: 'pointer' }}
                                    >
                                      {expandedPageOrgs.has(p.pathname) ? 'less' : `+${p.organizations.length - 2}`}
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {pageStats.length > 50 && (
                        <div style={{ textAlign: 'center', padding: '0.5rem', color: '#666', fontSize: '0.85rem' }}>
                          Showing top 50 of {pageStats.length} pages
                        </div>
                      )}
                    </div>

                    {/* Mobile page cards */}
                    <div className="md:hidden grid gap-3 mt-3">
                      {pageStats.slice(0, 50).map(p => (
                        <div key={p.pathname} className={`bg-surface-container-lowest rounded-xl p-4 shadow-card${p.isProductPage ? ' border-l-2 border-secondary' : ''}`}>
                          <div className="text-sm font-medium text-on-surface overflow-hidden text-ellipsis whitespace-nowrap" title={p.pathname}>{p.pathname}</div>
                          {p.pageTitle && <div className="text-xs text-on-surface-variant overflow-hidden text-ellipsis whitespace-nowrap">{p.pageTitle}</div>}
                          <div className="grid grid-cols-4 gap-2 mt-2">
                            <div>
                              <div className="font-headline text-sm font-bold text-on-surface">{p.views}</div>
                              <div className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Views</div>
                            </div>
                            <div>
                              <div className="font-headline text-sm font-bold text-on-surface">{p.uniqueVisitors}</div>
                              <div className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Visitors</div>
                            </div>
                            <div>
                              <div className="font-headline text-sm font-bold text-on-surface">{p.avgActiveSeconds > 0 ? formatDuration(p.avgActiveSeconds) : '—'}</div>
                              <div className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Avg Time</div>
                            </div>
                            <div>
                              <div className="font-headline text-sm font-bold text-on-surface" style={{ color: p.avgScrollDepth >= 75 ? '#2e7d32' : p.avgScrollDepth >= 50 ? '#f57f17' : '#888' }}>
                                {p.avgScrollDepth > 0 ? `${p.avgScrollDepth}%` : '—'}
                              </div>
                              <div className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Scroll</div>
                            </div>
                          </div>
                          {p.organizations.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {p.organizations.slice(0, 3).map(org => (
                                <button
                                  key={org}
                                  className="px-2 py-0.5 rounded text-[10px] font-medium bg-surface-container-low text-on-surface-variant hover:bg-surface-container cursor-pointer border-none"
                                  onClick={() => {
                                    const match = organizations.find(o => o.orgName === org);
                                    if (match) selectOrg(match);
                                  }}
                                  title={org}
                                >
                                  {org.length > 18 ? org.slice(0, 18) + '...' : org}
                                </button>
                              ))}
                              {p.organizations.length > 3 && (
                                <span className="text-[10px] text-on-surface-variant font-medium">+{p.organizations.length - 3}</span>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                );
              })()}

              {/* ── Products Tab ── */}
              {pageAnalyticsTab === 'products' && (
                productStats.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {productStats.map(p => (
                      <div key={p.pathname} className="bg-surface-container-lowest rounded-xl p-5 shadow-card">
                        <div className="font-headline text-lg font-bold text-on-surface">{p.productName}</div>
                        <div className="text-xs text-on-surface-variant mb-3">{p.pathname}</div>
                        <div className="grid grid-cols-4 gap-2 mb-4">
                          <div className="text-center">
                            <span className="font-headline text-xl font-bold text-on-surface">{p.views}</span>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Views</span>
                          </div>
                          <div className="text-center">
                            <span className="font-headline text-xl font-bold text-on-surface">{p.uniqueVisitors}</span>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Visitors</span>
                          </div>
                          <div className="text-center">
                            <span className="font-headline text-xl font-bold text-on-surface">{p.pdfDownloads}</span>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Downloads</span>
                          </div>
                          <div className="text-center">
                            <span className="font-headline text-xl font-bold text-on-surface">{p.contactFormSubmits}</span>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">RFQs</span>
                          </div>
                        </div>
                        <div className="mb-3">
                          <div className="flex justify-between items-center text-xs text-on-surface-variant mb-1">
                            <span>Conversion Rate</span>
                            <span className="font-bold text-on-surface">{Math.round(p.conversionRate * 100)}%</span>
                          </div>
                          <div className="bg-surface-container-high rounded-full h-1.5">
                            <div
                              className="rounded-full h-1.5 transition-all"
                              style={{
                                width: `${Math.max(p.conversionRate * 100, 2)}%`,
                                background: p.conversionRate >= 0.1 ? '#43a047' : p.conversionRate >= 0.05 ? '#f9a825' : '#e0e0e0',
                              }}
                            />
                          </div>
                        </div>
                        {p.avgScrollDepth > 0 && (
                          <div className="mb-3">
                            <div className="flex justify-between items-center text-xs text-on-surface-variant mb-1">
                              <span>Avg Scroll Depth</span>
                              <span className="font-bold text-on-surface">{p.avgScrollDepth}%</span>
                            </div>
                            <div className="bg-surface-container-high rounded-full h-1.5">
                              <div
                                className="rounded-full h-1.5 transition-all"
                                style={{
                                  width: `${p.avgScrollDepth}%`,
                                  background: p.avgScrollDepth >= 75 ? '#43a047' : p.avgScrollDepth >= 50 ? '#f9a825' : '#e0e0e0',
                                }}
                              />
                            </div>
                          </div>
                        )}
                        {p.avgActiveSeconds > 0 && (
                          <div className="text-xs text-on-surface-variant mt-2">
                            Avg time: {formatDuration(p.avgActiveSeconds)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '2rem', color: '#999' }}>
                    No product page visits in this period
                  </div>
                )
              )}

              {/* ── Landing Pages Tab ── */}
              {pageAnalyticsTab === 'landingPages' && (
                landingPageStats.length > 0 ? (
                  <>
                  <div className="bg-surface-container-lowest rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr>
                          <th>Landing Page</th>
                          <th>Landings</th>
                          <th>Top Source</th>
                          <th>Avg Depth</th>
                          <th>Bounce Rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {landingPageStats.slice(0, 50).map(lp => {
                          const bounceColor = lp.bounceRate < 0.4 ? '#2e7d32' : lp.bounceRate < 0.6 ? '#f57f17' : '#c62828';
                          const channelLabels: Record<string, string> = {
                            paid_search: 'Paid Search', organic_search: 'Organic Search',
                            paid_social: 'Paid Social', organic_social: 'Social',
                            email: 'Email', referral: 'Referral', direct: 'Direct',
                          };
                          return (
                            <tr key={lp.pathname}>
                              <td className="text-sm font-medium text-on-surface max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap" title={lp.pathname}>{lp.pathname}</td>
                              <td style={{ textAlign: 'center' }}>{lp.landings}</td>
                              <td>
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold" style={{
                                  background: lp.topSource.includes('paid') ? '#e3f2fd' : lp.topSource.includes('organic') ? '#e8f5e9' : '#f5f5f5',
                                  color: lp.topSource.includes('paid') ? '#1565c0' : lp.topSource.includes('organic') ? '#2e7d32' : '#555',
                                  border: '1px solid ' + (lp.topSource.includes('paid') ? '#bbdefb' : lp.topSource.includes('organic') ? '#c8e6c9' : '#e0e0e0'),
                                }}>
                                  {channelLabels[lp.topSource] || lp.topSource}
                                </span>
                              </td>
                              <td style={{ textAlign: 'center' }}>{lp.avgSessionPages}</td>
                              <td>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-bold w-10" style={{ color: bounceColor }}>
                                    {Math.round(lp.bounceRate * 100)}%
                                  </span>
                                  <div className="flex-1 bg-surface-container-high rounded-full h-1.5">
                                    <div
                                      className="rounded-full h-1.5 transition-all"
                                      style={{ width: `${lp.bounceRate * 100}%`, background: bounceColor }}
                                    />
                                  </div>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile landing page cards */}
                  <div className="md:hidden grid gap-3 mt-3">
                    {landingPageStats.slice(0, 50).map(lp => {
                      const channelLabels: Record<string, string> = {
                        paid_search: 'Paid Search', organic_search: 'Organic',
                        paid_social: 'Paid Social', organic_social: 'Social',
                        email: 'Email', referral: 'Referral', direct: 'Direct',
                      };
                      const bounceColor = lp.bounceRate < 0.4 ? '#2e7d32' : lp.bounceRate < 0.6 ? '#f57f17' : '#c62828';
                      return (
                        <div key={lp.pathname} className="bg-surface-container-lowest rounded-xl p-4 shadow-card">
                          <div className="text-sm font-medium text-on-surface overflow-hidden text-ellipsis whitespace-nowrap" title={lp.pathname}>{lp.pathname}</div>
                          <div className="grid grid-cols-3 gap-2 mt-2">
                            <div>
                              <div className="font-headline text-sm font-bold text-on-surface">{lp.landings}</div>
                              <div className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Landings</div>
                            </div>
                            <div>
                              <div className="font-headline text-sm font-bold text-on-surface">{channelLabels[lp.topSource] || lp.topSource}</div>
                              <div className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Source</div>
                            </div>
                            <div>
                              <div className="font-headline text-sm font-bold text-on-surface" style={{ color: bounceColor }}>
                                {Math.round(lp.bounceRate * 100)}%
                              </div>
                              <div className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Bounce</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '2rem', color: '#999' }}>
                    No landing page data in this period
                  </div>
                )
              )}
            </>
          )}
        </div>
      )}

      {/* Event Count */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs text-on-surface-variant font-medium">
          {filteredEvents.length} events from {organizations.length} visitors
        </span>
      </div>

      {/* Search & Export */}
      <div className="flex items-center gap-3 mb-4">
        <input
          type="text"
          className="bg-surface-container-lowest border border-outline-variant/20 rounded-xl py-2.5 pl-10 pr-4 text-sm flex-1"
          placeholder="Search organizations..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <button className="bg-transparent border border-outline-variant/30 px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 text-on-surface-variant hover:border-outline-variant/60 hover:text-on-surface cursor-pointer" onClick={exportCSV}>
          Export CSV
        </button>
      </div>

      {/* Collapsible Enhanced Filters */}
      <div className="mb-6">
        <h3
          className="font-headline text-lg font-bold text-on-surface flex items-center gap-2 mb-4 cursor-pointer select-none"
          style={{ cursor: 'pointer', userSelect: 'none' }}
          onClick={() => setFiltersOpen(!filtersOpen)}
        >
          <span className="text-on-surface-variant text-xs">{filtersOpen ? '▼' : '▶'}</span>
          {' '}Filters
          {!filtersOpen && activeFilterCount > 0 && (
            <span className="bg-secondary text-white px-1.5 py-0.5 rounded text-[10px] font-bold ml-2">{activeFilterCount}</span>
          )}
          {!filtersOpen && filterSummary && (
            <span className="text-xs text-on-surface-variant ml-2">{filterSummary}</span>
          )}
          {activeFilterCount > 0 && (
            <button
              className="text-xs text-secondary font-medium ml-auto hover:underline cursor-pointer border-none bg-transparent"
              onClick={(e) => {
                e.stopPropagation();
                setChannelFilter('all');
                setRegionFilter('all');
                setScoreMin('');
                setScoreMax('');
                setLifecycleFilter('all');
              }}
            >
              Clear all
            </button>
          )}
        </h3>
        {filtersOpen && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Channel:</span>
              <select className="bg-surface-container-lowest border border-outline-variant/20 rounded-lg py-1.5 px-3 text-sm" value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)}>
                <option value="all">All</option>
                <option value="paid_search">Paid Search</option>
                <option value="organic_search">Organic Search</option>
                <option value="ai_referral">AI Referral</option>
                <option value="paid_social">Paid Social</option>
                <option value="organic_social">Organic Social</option>
                <option value="email">Email</option>
                <option value="referral">Referral</option>
                <option value="direct">Direct</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Region:</span>
              <select className="bg-surface-container-lowest border border-outline-variant/20 rounded-lg py-1.5 px-3 text-sm" value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)}>
                <option value="all">All</option>
                {availableCountries.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Score:</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  className="w-16 bg-surface-container-lowest border border-outline-variant/20 rounded-lg py-1.5 px-2 text-sm text-center"
                  placeholder="Min"
                  min="0" max="1" step="0.1"
                  value={scoreMin}
                  onChange={(e) => setScoreMin(e.target.value)}
                />
                <span>–</span>
                <input
                  type="number"
                  className="w-16 bg-surface-container-lowest border border-outline-variant/20 rounded-lg py-1.5 px-2 text-sm text-center"
                  placeholder="Max"
                  min="0" max="1" step="0.1"
                  value={scoreMax}
                  onChange={(e) => setScoreMax(e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Lifecycle:</span>
              <select className="bg-surface-container-lowest border border-outline-variant/20 rounded-lg py-1.5 px-3 text-sm" value={lifecycleFilter} onChange={(e) => setLifecycleFilter(e.target.value)}>
                <option value="all">All</option>
                <option value="awareness">Awareness</option>
                <option value="interest">Interest</option>
                <option value="consideration">Consideration</option>
                <option value="intent">Intent</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Organization Table */}
      <h2 id="full-org-table" className="font-headline text-lg font-bold text-on-surface flex items-center gap-2 mb-4">
        Visitor Organizations
        {kpiFilter !== 'all' && (
          <span className="bg-surface-container-low px-2 py-0.5 rounded text-[10px] font-medium text-on-surface-variant ml-2">
            Filtered
            <button className="text-xs text-secondary hover:underline cursor-pointer border-none bg-transparent" onClick={() => setKpiFilter('all')}>
              &times;
            </button>
          </span>
        )}
      </h2>
      <div className="bg-surface-container-lowest rounded-xl overflow-hidden">
        <table className="w-full text-sm">
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
              <th onClick={() => handleSort('engagement')}>
                Engagement{sortIndicator('engagement')}
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
                className={`hover:bg-primary-fixed/30 transition-colors cursor-pointer ${org.isTargetCustomer ? 'bg-secondary/5' : ''} ${
                  org.leadTier ? 'border-l-2 border-secondary' : org.isAnonymousHighIntent ? 'border-l-2 border-tertiary-fixed-dim' : ''
                }`}
                onClick={() => selectOrg(org)}
              >
                <td>
                  <div className="font-semibold text-on-surface">{org.orgName}</div>
                  {org.isISPVisitor && (
                    <div className="text-xs text-on-surface-variant mt-0.5" style={{ fontSize: '0.75rem', color: '#999', marginTop: '2px' }}>
                      ISP individual visitor · ID: {org.key.substring(0, 8)}
                      {org.isAnonymousHighIntent && (
                        <span className="ml-1 px-1.5 py-0.5 rounded bg-tertiary-fixed-dim/30 text-on-surface text-[10px] font-semibold" title="ISP visitor with purchase intent">
                          📶 ISP Intent
                        </span>
                      )}
                    </div>
                  )}
                </td>
                <td>
                  {org.organizationType ? (
                    <span className="px-2.5 py-0.5 rounded-full bg-surface-container text-on-surface-variant text-xs font-semibold">
                      {org.organizationType}
                    </span>
                  ) : (
                    <span className="text-on-surface-variant/50 text-xs">N/A</span>
                  )}
                </td>
                <td className="text-xs text-on-surface-variant">
                  {[org.city, org.region, org.country].filter(Boolean).join(', ') || <span className="text-on-surface-variant/50 text-xs">N/A</span>}
                </td>
                <td>
                  {org.productsViewed.length > 0
                    ? org.productsViewed.join(', ')
                    : <span className="text-on-surface-variant/50 text-xs">N/A</span>}
                </td>
                <td>{org.uniquePages}</td>
                <td>{org.totalTimeOnSite > 0 ? formatDuration(org.totalTimeOnSite) : <span className="text-on-surface-variant/50 text-xs" title="No time data yet — visitor may still be on site">Pending</span>}</td>
                <td>{org.totalEvents}</td>
                <td>
                  {org.leadTier ? (
                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-secondary/10 text-secondary">
                      {org.leadTier}
                    </span>
                  ) : org.isAnonymousHighIntent ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800">Intent</span>
                  ) : (
                    <span className="text-on-surface-variant/50 text-xs">N/A</span>
                  )}
                </td>
                <td>
                  {engagementLevel(org.maxBehaviorScore)
                    ? <span className="px-2 py-0.5 rounded text-xs font-bold bg-surface-container text-on-surface-variant">{engagementLevel(org.maxBehaviorScore)}</span>
                    : <span className="text-on-surface-variant/50 text-xs">N/A</span>}
                </td>
                <td className="text-xs text-on-surface-variant whitespace-nowrap">{formatRelativeTime(org.lastVisit)}</td>
              </tr>
            ))}
            {sortedOrgs.length === 0 && (
              <tr>
                <td colSpan={10} className="text-center py-8 text-on-surface-variant text-sm">
                  No visitor data for this period.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile org cards — visible only at ≤480px */}
      <div className="md:hidden grid gap-3">
        {sortedOrgs.length === 0 ? (
          <div className="text-center py-8 text-on-surface-variant text-sm" style={{ textAlign: 'center', padding: '1.5rem' }}>
            No visitor data for this period.
          </div>
        ) : (
          sortedOrgs.map((org) => (
            <div
              key={org.key}
              className={`bg-surface-container-lowest rounded-xl p-4 shadow-card cursor-pointer hover:translate-y-[-2px] transition-all${org.isTargetCustomer ? ' border-l-2 border-secondary' : ''}${
                org.leadTier === 'A' ? ' ring-2 ring-secondary' : org.leadTier === 'B' ? ' ring-1 ring-secondary/50' : ''
              }${org.isAnonymousHighIntent ? ' border-l-2 border-tertiary-fixed-dim' : ''}`}
              onClick={() => selectOrg(org)}
            >
              <div className="flex justify-between items-start mb-1">
                <span className="font-headline font-bold text-sm text-on-surface overflow-hidden text-ellipsis whitespace-nowrap" title={org.orgName}>{org.orgName}</span>
                <div className="flex gap-1 items-center shrink-0">
                  {org.leadTier && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-secondary/10 text-secondary">{org.leadTier}</span>
                  )}
                  {org.isAnonymousHighIntent && !org.leadTier && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-tertiary-fixed-dim/30 text-on-surface">Intent</span>
                  )}
                  {org.organizationType && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-surface-container text-on-surface-variant">{org.organizationType}</span>
                  )}
                </div>
              </div>
              <div className="text-xs text-on-surface-variant mb-2">
                {[org.city, org.region, org.country].filter(Boolean).join(', ') || 'Unknown location'}
              </div>
              <div className="grid grid-cols-4 gap-2 mt-2">
                <div>
                  <div className="font-headline text-sm font-bold text-on-surface">{org.uniquePages}</div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Pages</div>
                </div>
                <div>
                  <div className="font-headline text-sm font-bold text-on-surface">{org.totalEvents}</div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Events</div>
                </div>
                <div>
                  <div className="font-headline text-sm font-bold text-on-surface">{org.totalTimeOnSite > 0 ? formatDuration(org.totalTimeOnSite) : '—'}</div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Time</div>
                </div>
                <div>
                  <div className="font-headline text-sm font-bold text-on-surface">
                    {engagementLevel(org.maxBehaviorScore) || '—'}
                  </div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Engage</div>
                </div>
              </div>
              <div className="flex justify-between items-center text-xs text-on-surface-variant mt-2 pt-2 border-t border-outline-variant/10">
                <span>{formatRelativeTime(org.lastVisit)}</span>
                {org.isISPVisitor && <span>ISP visitor</span>}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
