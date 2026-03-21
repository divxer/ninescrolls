import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { getOrgOverride, setOrgOverride, undoOrgOverride, listOrgOverrides, type OrgOverride, type OrgOverrideSummary } from '../../services/adminClassificationService';
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
    // ── Inherit org metadata for events missing it (e.g. page_time_flush) ──
    const vid = (e as Record<string, unknown>).visitorId as string;
    const needsInheritance = !e.ip && !e.org && !e.orgName;
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
            {org.lifecycleStage && (
              <span className={`lifecycle-badge lifecycle-${org.lifecycleStage}`}>
                {org.lifecycleStage}
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
            {org.companyType && (
              <span className="org-detail-company-type" title="IPinfo company classification">
                📡 {org.companyType}
              </span>
            )}
            {org.isISPVisitor && (
              <span style={{ fontSize: '0.8rem', color: '#888', fontFamily: 'monospace' }}>
                ID: {org.key.substring(0, 8)}
              </span>
            )}
            {uniqueVisitors.filter((v) => !v.includes('.') && !(org.isISPVisitor && v === org.key)).length > 0 && (
              <span style={{ fontSize: '0.8rem', color: '#888', fontFamily: 'monospace' }}>
                {uniqueVisitors.filter((v) => !v.includes('.') && !(org.isISPVisitor && v === org.key)).map((v) => v.slice(0, 8)).join(', ')}
              </span>
            )}
          </div>
        </div>
        {engagementLevel(org.maxBehaviorScore) && (
          <div className="org-detail-score">
            <div className={`org-detail-score-value org-engagement-${engagementLevel(org.maxBehaviorScore)!.toLowerCase()}`}>{engagementLevel(org.maxBehaviorScore)}</div>
            <div className="org-detail-score-label">Engagement</div>
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
            org.isISPVisitor
              ? <div className="org-signal org-signal-isp-intent">📶 ISP visitor with purchase intent — browsing from home/mobile network. Consider monitoring for return visits or PDF downloads to confirm buyer interest.</div>
              : <div className="org-signal org-signal-intent">Unknown company with high purchase intent — consider targeted engagement</div>
          )}
          {downloadedPDF && (
            <div className="org-signal org-signal-hot">Downloaded PDF / Spec Sheet</div>
          )}
          {visitedContactPage && (
            <div className="org-signal org-signal-hot">Visited Contact Page</div>
          )}
          {rfqSubmitted && (
            <div className="org-signal org-signal-hot">Submitted RFQ</div>
          )}
          {contactFormSubmitted && !rfqSubmitted && (
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
        // Find IP-based org type (before AI enrichment)
        const ipEvent = org.events.find((e) => e.organizationType && e.organizationType !== 'unknown') || org.events[0];
        const ipOrgType = ipEvent?.organizationType || 'unknown';

        const hasAI = aiEvent && aiEvent.aiConfidence != null && aiEvent.aiOrganizationType;
        const aiUpgraded = hasAI && aiEvent.aiOrganizationType !== 'unknown'
          && aiEvent.aiOrganizationType !== ipOrgType;
        const aiConfirmed = hasAI && !aiUpgraded && aiEvent.aiOrganizationType !== 'unknown';

        // Determine classification source
        const source = (() => {
          if (override?.found && override?.source === 'manual') return 'manual';
          if (org.hasBot) return 'bot';
          if (hasAI && (aiEvent.aiConfidence ?? 0) >= 0.5 && aiEvent.aiOrganizationType !== 'unknown') return 'ai';
          if (ipOrgType !== 'unknown') return 'ip';
          if (org.isAnonymousHighIntent) return 'behavior';
          return 'none';
        })();

        const sourceBadge: Record<string, { label: string; className: string }> = {
          manual: { label: 'Manual Override', className: 'org-detection-badge-manual' },
          bot: { label: 'Bot Detected', className: 'org-detection-badge-bot' },
          ai: { label: 'AI Classified', className: 'org-detection-badge-ai' },
          ip: { label: 'IP Lookup', className: 'org-detection-badge-ip' },
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
                <div className="org-detail-ai-classification">
                  <div className="org-ai-row">
                    <span className="org-ai-label">Bot Name</span>
                    <span className="org-ai-value">{botName}</span>
                  </div>
                  <div className="org-ai-row">
                    <span className="org-ai-label">Detection</span>
                    <span className="org-ai-value">{detectionMethod}</span>
                  </div>
                </div>
              );
            })()}

            {/* IP vs AI comparison */}
            {!org.hasBot && hasAI ? (
              <div className="org-detection-comparison">
                <div className="org-detection-col">
                  <div className="org-detection-col-header">IP Lookup</div>
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
                      return String(resolveTrafficChannel(ev)).replace(/_/g, ' ');
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
              Final: {org.organizationType || 'unknown'}
              {org.maxConfidence > 0 && ` · ${(org.maxConfidence * 100).toFixed(0)}%`}
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
              {!isManual && override?.provider && (
                <span style={{ fontSize: '0.75rem', color: '#888', marginLeft: '0.4rem' }}>
                  via {override.provider === 'bedrock' ? 'Bedrock' : 'Anthropic API'}
                </span>
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
                  : override?.reason
                    ? <>AI: {override.reason}</>
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
                  <span className="timeline-referrer" style={{ background: style.bg, color: style.color, padding: '1px 6px', borderRadius: '4px', fontSize: '11px', marginLeft: '4px' }}>
                    {label}
                  </span>
                  {(sq || e.utmTerm) && (
                    <span className="timeline-keyword" style={{ background: '#fff8e1', color: '#f57f17', padding: '1px 6px', borderRadius: '4px', fontSize: '11px', marginLeft: '4px' }}>
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
                              <span className="timeline-path">{e.eventType === 'page_view' ? (e.pathname || e.eventName) : (e.eventName || e.pathname)}</span>
                              {e.productName && (
                                <span className="timeline-product">{e.productName}</span>
                              )}
                              {pageDuration != null && pageDuration > 0 && (
                                <span className="timeline-duration">{formatDuration(pageDuration)}</span>
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
  const [keywordSectionOpen, setKeywordSectionOpen] = useState(true);
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

      // Apply manual override data
      org.isTargetCustomer = ov.isTargetCustomer;
      if (ov.organizationType && ov.organizationType !== 'unknown') {
        org.organizationType = ov.organizationType;
      }
      // Compute tier for manually-marked target customers
      // Manual override = admin confirmed → assign B (same as pipeline trust gate)
      if (ov.isTargetCustomer && !org.leadTier) {
        org.leadTier = 'B';
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
        <label className="analytics-toggle">
          <input
            type="checkbox"
            checked={showPrivateIPs}
            onChange={(e) => setShowPrivateIPs(e.target.checked)}
          />
          <span className="analytics-toggle-slider" />
          <span className="analytics-toggle-label">Private IPs ({privateIPCount})</span>
        </label>
        <label className="analytics-toggle">
          <input
            type="checkbox"
            checked={hideSelf}
            onChange={(e) => setHideSelf(e.target.checked)}
          />
          <span className="analytics-toggle-slider" />
          <span className="analytics-toggle-label">Hide Me ({selfCount})</span>
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
          className={`analytics-stat-card analytics-stat-tier-a analytics-stat-clickable ${kpiFilter === 'education' ? 'analytics-stat-active' : ''}`}
          onClick={() => setKpiFilter(kpiFilter === 'education' ? 'all' : 'education')}
        >
          <div className="analytics-stat-value">{kpis.educationOrgs}</div>
          <div className="analytics-stat-label">Education</div>
        </div>
        <div
          className={`analytics-stat-card analytics-stat-clickable ${kpiFilter === 'business' ? 'analytics-stat-active' : ''}`}
          onClick={() => setKpiFilter(kpiFilter === 'business' ? 'all' : 'business')}
        >
          <div className="analytics-stat-value">{kpis.businessOrgs}</div>
          <div className="analytics-stat-label">Business</div>
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
        {kpis.aiReferral > 0 && (
          <div
            className={`analytics-stat-card analytics-stat-clickable ${kpiFilter === 'aiReferral' ? 'analytics-stat-active' : ''}`}
            onClick={() => setKpiFilter(kpiFilter === 'aiReferral' ? 'all' : 'aiReferral')}
            style={kpiFilter === 'aiReferral' ? { borderColor: '#4527a0' } : undefined}
          >
            <div className="analytics-stat-value" style={{ color: '#4527a0' }}>{kpis.aiReferral}</div>
            <div className="analytics-stat-label">AI Referral</div>
          </div>
        )}
        {kpis.anonymousIntent > 0 && (
          <div
            className={`analytics-stat-card analytics-stat-intent analytics-stat-clickable ${kpiFilter === 'anonymousIntent' ? 'analytics-stat-active' : ''}`}
            onClick={() => setKpiFilter(kpiFilter === 'anonymousIntent' ? 'all' : 'anonymousIntent')}
          >
            <div className="analytics-stat-value">{kpis.anonymousIntent}</div>
            <div className="analytics-stat-label">Anonymous Intent</div>
            {kpis.ispHighIntent > 0 && (
              <div
                className="analytics-stat-sublabel"
                title="ISP visitors (home/mobile) showing purchase-intent behavior signals"
              >
                incl. {kpis.ispHighIntent} ISP
              </div>
            )}
          </div>
        )}
      </div>

      {/* World Map — click markers to view org detail */}
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
        <div className="keyword-section">
          <h2
            className="analytics-section-header keyword-section-header"
            onClick={() => setKeywordSectionOpen(!keywordSectionOpen)}
            style={{ cursor: 'pointer', userSelect: 'none' }}
          >
            <span className="keyword-toggle-icon">{keywordSectionOpen ? '▼' : '▶'}</span>
            {' '}Search Keywords
            <span className="keyword-count-badge">{allKeywords.length}</span>
          </h2>

          {keywordSectionOpen && (
            <>
              {/* Source filter tabs */}
              <div className="keyword-filter-tabs">
                {([['all', 'All'], ['external', 'External'], ['internal', 'Internal']] as const).map(([val, label]) => (
                  <button
                    key={val}
                    className={`keyword-filter-tab ${keywordSourceFilter === val ? 'active' : ''}`}
                    onClick={() => setKeywordSourceFilter(val)}
                  >
                    {label}
                    <span className="keyword-filter-count">
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
                  <div className="keyword-bar-chart">
                    {top10.map((kw, i) => (
                      <div key={`${kw.source}-${kw.keyword}-${i}`} className="keyword-bar-row">
                        <span className="keyword-bar-label" title={kw.keyword}>
                          {kw.keyword.length > 30 ? kw.keyword.slice(0, 30) + '...' : kw.keyword}
                        </span>
                        <div className="keyword-bar-track">
                          <div
                            className={`keyword-bar-fill keyword-bar-fill-${kw.source}`}
                            style={{ width: `${Math.max((kw.count / maxCount) * 100, 4)}%` }}
                          />
                        </div>
                        <span className="keyword-bar-count">{kw.count}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* Keywords table */}
              <div className="analytics-table-wrapper" style={{ marginTop: '1rem' }}>
                <table className="admin-table keyword-table">
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
                        <td className="keyword-cell-keyword" title={kw.keyword}>{kw.keyword}</td>
                        <td style={{ textAlign: 'center' }}>{kw.count}</td>
                        <td>
                          <span className={`keyword-source-badge keyword-source-${kw.source}`}>
                            {kw.source === 'organic' ? 'Organic' : kw.source === 'paid' ? 'Paid' : 'Internal'}
                          </span>
                        </td>
                        <td>{kw.searchEngine || (kw.source === 'internal' ? 'Site Search' : '—')}</td>
                        <td>
                          <div className="keyword-org-chips">
                            {(() => {
                              const kwKey = `${kw.source}-${kw.keyword}`;
                              const isExpanded = expandedKeywordOrgs.has(kwKey);
                              return <>
                                {(isExpanded ? kw.organizations : kw.organizations.slice(0, 2)).map(org => (
                                  <button
                                    key={org}
                                    className="keyword-org-chip"
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
                                    className="keyword-org-more"
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
                        <td className="keyword-cell-date">
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
              <div className="mobile-cards kw-cards-mobile" style={{ marginTop: '0.5rem' }}>
                {displayedKeywords.slice(0, 50).map((kw, i) => (
                  <div key={`${kw.source}-${kw.keyword}-${i}`} className="kw-card-mobile">
                    <div className="kw-card-header">
                      <span className="kw-card-keyword" title={kw.keyword}>{kw.keyword}</span>
                      <span className="kw-card-count">{kw.count}</span>
                    </div>
                    <div className="kw-card-meta">
                      <span className={`keyword-source-badge keyword-source-${kw.source}`}>
                        {kw.source === 'organic' ? 'Organic' : kw.source === 'paid' ? 'Paid' : 'Internal'}
                      </span>
                      {kw.searchEngine && (
                        <span style={{ fontSize: '0.75rem', color: '#888' }}>{kw.searchEngine}</span>
                      )}
                    </div>
                    {kw.organizations.length > 0 && (
                      <div className="kw-card-orgs">
                        {kw.organizations.slice(0, 3).map(org => (
                          <button
                            key={org}
                            className="keyword-org-chip"
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
                          <span className="keyword-org-more">+{kw.organizations.length - 3}</span>
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
        <div className="page-analytics-section">
          <h2
            className="analytics-section-header keyword-section-header"
            onClick={() => setPageAnalyticsSectionOpen(!pageAnalyticsSectionOpen)}
            style={{ cursor: 'pointer', userSelect: 'none' }}
          >
            <span className="keyword-toggle-icon">{pageAnalyticsSectionOpen ? '▼' : '▶'}</span>
            {' '}Page Analytics
            <span className="keyword-count-badge">{pageStats.length}</span>
          </h2>

          {pageAnalyticsSectionOpen && (
            <>
              {/* Tab navigation */}
              <div className="keyword-filter-tabs">
                {([['topPages', 'Top Pages'], ['products', 'Products'], ['landingPages', 'Landing Pages']] as const).map(([val, label]) => (
                  <button
                    key={val}
                    className={`keyword-filter-tab ${pageAnalyticsTab === val ? 'active' : ''}`}
                    onClick={() => setPageAnalyticsTab(val)}
                  >
                    {label}
                    <span className="keyword-filter-count">
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
                    <div className="keyword-bar-chart">
                      {top10.map((p) => (
                        <div key={p.pathname} className="keyword-bar-row">
                          <span className="keyword-bar-label" title={p.pathname}>
                            {p.pathname.length > 30 ? p.pathname.slice(0, 30) + '...' : p.pathname}
                          </span>
                          <div className="keyword-bar-track">
                            <div
                              className="keyword-bar-fill keyword-bar-fill-organic"
                              style={{ width: `${Math.max((p.views / maxViews) * 100, 4)}%` }}
                            />
                          </div>
                          <span className="keyword-bar-count">{p.views}</span>
                        </div>
                      ))}
                    </div>
                    <div className="analytics-table-wrapper" style={{ marginTop: '1rem' }}>
                      <table className="admin-table keyword-table">
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
                            <tr key={p.pathname} className={p.isProductPage ? 'row-highlight-blue' : ''}>
                              <td className="keyword-cell-keyword" title={p.pathname}>{p.pathname}</td>
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
                                <div className="keyword-org-chips">
                                  {(expandedPageOrgs.has(p.pathname) ? p.organizations : p.organizations.slice(0, 2)).map(org => (
                                    <button
                                      key={org}
                                      className="keyword-org-chip"
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
                                      className="keyword-org-more"
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
                    <div className="mobile-cards page-cards-mobile" style={{ marginTop: '0.5rem' }}>
                      {pageStats.slice(0, 50).map(p => (
                        <div key={p.pathname} className={`page-card-mobile${p.isProductPage ? ' page-card-product' : ''}`}>
                          <div className="page-card-path" title={p.pathname}>{p.pathname}</div>
                          {p.pageTitle && <div className="page-card-title">{p.pageTitle}</div>}
                          <div className="page-card-stats">
                            <div>
                              <div className="page-card-stat-value">{p.views}</div>
                              <div className="page-card-stat-label">Views</div>
                            </div>
                            <div>
                              <div className="page-card-stat-value">{p.uniqueVisitors}</div>
                              <div className="page-card-stat-label">Visitors</div>
                            </div>
                            <div>
                              <div className="page-card-stat-value">{p.avgActiveSeconds > 0 ? formatDuration(p.avgActiveSeconds) : '—'}</div>
                              <div className="page-card-stat-label">Avg Time</div>
                            </div>
                            <div>
                              <div className="page-card-stat-value" style={{ color: p.avgScrollDepth >= 75 ? '#2e7d32' : p.avgScrollDepth >= 50 ? '#f57f17' : '#888' }}>
                                {p.avgScrollDepth > 0 ? `${p.avgScrollDepth}%` : '—'}
                              </div>
                              <div className="page-card-stat-label">Scroll</div>
                            </div>
                          </div>
                          {p.organizations.length > 0 && (
                            <div className="page-card-orgs">
                              {p.organizations.slice(0, 3).map(org => (
                                <button
                                  key={org}
                                  className="keyword-org-chip"
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
                                <span className="keyword-org-more">+{p.organizations.length - 3}</span>
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
                  <div className="product-card-grid">
                    {productStats.map(p => (
                      <div key={p.pathname} className="product-card">
                        <div className="product-card-name">{p.productName}</div>
                        <div className="product-card-path">{p.pathname}</div>
                        <div className="product-card-metrics">
                          <div className="product-card-metric">
                            <span className="product-metric-value">{p.views}</span>
                            <span className="product-metric-label">Views</span>
                          </div>
                          <div className="product-card-metric">
                            <span className="product-metric-value">{p.uniqueVisitors}</span>
                            <span className="product-metric-label">Visitors</span>
                          </div>
                          <div className="product-card-metric">
                            <span className="product-metric-value">{p.pdfDownloads}</span>
                            <span className="product-metric-label">Downloads</span>
                          </div>
                          <div className="product-card-metric">
                            <span className="product-metric-value">{p.contactFormSubmits}</span>
                            <span className="product-metric-label">RFQs</span>
                          </div>
                        </div>
                        <div className="product-card-conversion">
                          <div className="product-conversion-header">
                            <span>Conversion Rate</span>
                            <span className="product-conversion-value">{Math.round(p.conversionRate * 100)}%</span>
                          </div>
                          <div className="product-conversion-bar-track">
                            <div
                              className="product-conversion-bar-fill"
                              style={{
                                width: `${Math.max(p.conversionRate * 100, 2)}%`,
                                background: p.conversionRate >= 0.1 ? '#43a047' : p.conversionRate >= 0.05 ? '#f9a825' : '#e0e0e0',
                              }}
                            />
                          </div>
                        </div>
                        {p.avgScrollDepth > 0 && (
                          <div className="product-card-conversion">
                            <div className="product-conversion-header">
                              <span>Avg Scroll Depth</span>
                              <span className="product-conversion-value">{p.avgScrollDepth}%</span>
                            </div>
                            <div className="product-conversion-bar-track">
                              <div
                                className="product-conversion-bar-fill"
                                style={{
                                  width: `${p.avgScrollDepth}%`,
                                  background: p.avgScrollDepth >= 75 ? '#43a047' : p.avgScrollDepth >= 50 ? '#f9a825' : '#e0e0e0',
                                }}
                              />
                            </div>
                          </div>
                        )}
                        {p.avgActiveSeconds > 0 && (
                          <div className="product-card-time">
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
                  <div className="analytics-table-wrapper">
                    <table className="admin-table keyword-table">
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
                              <td className="keyword-cell-keyword" title={lp.pathname}>{lp.pathname}</td>
                              <td style={{ textAlign: 'center' }}>{lp.landings}</td>
                              <td>
                                <span className="keyword-source-badge" style={{
                                  background: lp.topSource.includes('paid') ? '#e3f2fd' : lp.topSource.includes('organic') ? '#e8f5e9' : '#f5f5f5',
                                  color: lp.topSource.includes('paid') ? '#1565c0' : lp.topSource.includes('organic') ? '#2e7d32' : '#555',
                                  border: '1px solid ' + (lp.topSource.includes('paid') ? '#bbdefb' : lp.topSource.includes('organic') ? '#c8e6c9' : '#e0e0e0'),
                                }}>
                                  {channelLabels[lp.topSource] || lp.topSource}
                                </span>
                              </td>
                              <td style={{ textAlign: 'center' }}>{lp.avgSessionPages}</td>
                              <td>
                                <div className="bounce-rate-cell">
                                  <span className="bounce-rate-value" style={{ color: bounceColor }}>
                                    {Math.round(lp.bounceRate * 100)}%
                                  </span>
                                  <div className="bounce-rate-bar-track">
                                    <div
                                      className="bounce-rate-bar-fill"
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
                  <div className="mobile-cards landing-cards-mobile" style={{ marginTop: '0.5rem' }}>
                    {landingPageStats.slice(0, 50).map(lp => {
                      const channelLabels: Record<string, string> = {
                        paid_search: 'Paid Search', organic_search: 'Organic',
                        paid_social: 'Paid Social', organic_social: 'Social',
                        email: 'Email', referral: 'Referral', direct: 'Direct',
                      };
                      const bounceColor = lp.bounceRate < 0.4 ? '#2e7d32' : lp.bounceRate < 0.6 ? '#f57f17' : '#c62828';
                      return (
                        <div key={lp.pathname} className="landing-card-mobile">
                          <div className="landing-card-path" title={lp.pathname}>{lp.pathname}</div>
                          <div className="landing-card-stats">
                            <div>
                              <div className="page-card-stat-value">{lp.landings}</div>
                              <div className="page-card-stat-label">Landings</div>
                            </div>
                            <div>
                              <div className="page-card-stat-value">{channelLabels[lp.topSource] || lp.topSource}</div>
                              <div className="page-card-stat-label">Source</div>
                            </div>
                            <div>
                              <div className="page-card-stat-value" style={{ color: bounceColor }}>
                                {Math.round(lp.bounceRate * 100)}%
                              </div>
                              <div className="page-card-stat-label">Bounce</div>
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

      {/* Collapsible Enhanced Filters */}
      <div className="analytics-filter-bar-wrapper">
        <h3
          className="analytics-section-header analytics-filter-header"
          style={{ cursor: 'pointer', userSelect: 'none' }}
          onClick={() => setFiltersOpen(!filtersOpen)}
        >
          <span className="keyword-toggle-icon">{filtersOpen ? '▼' : '▶'}</span>
          {' '}Filters
          {!filtersOpen && activeFilterCount > 0 && (
            <span className="analytics-filter-count-badge">{activeFilterCount}</span>
          )}
          {!filtersOpen && filterSummary && (
            <span className="analytics-filter-summary">{filterSummary}</span>
          )}
          {activeFilterCount > 0 && (
            <button
              className="analytics-filter-clear-all"
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
          <div className="analytics-enhanced-filters">
            <div className="analytics-filter-group">
              <span className="analytics-filter-label">Channel:</span>
              <select className="analytics-filter-select" value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)}>
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
            <div className="analytics-filter-group">
              <span className="analytics-filter-label">Region:</span>
              <select className="analytics-filter-select" value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)}>
                <option value="all">All</option>
                {availableCountries.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="analytics-filter-group">
              <span className="analytics-filter-label">Score:</span>
              <div className="analytics-score-range">
                <input
                  type="number"
                  className="analytics-score-input"
                  placeholder="Min"
                  min="0" max="1" step="0.1"
                  value={scoreMin}
                  onChange={(e) => setScoreMin(e.target.value)}
                />
                <span>–</span>
                <input
                  type="number"
                  className="analytics-score-input"
                  placeholder="Max"
                  min="0" max="1" step="0.1"
                  value={scoreMax}
                  onChange={(e) => setScoreMax(e.target.value)}
                />
              </div>
            </div>
            <div className="analytics-filter-group">
              <span className="analytics-filter-label">Lifecycle:</span>
              <select className="analytics-filter-select" value={lifecycleFilter} onChange={(e) => setLifecycleFilter(e.target.value)}>
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
                      {org.isAnonymousHighIntent && (
                        <span className="isp-intent-badge" title="ISP visitor with purchase intent">
                          📶 ISP Intent
                        </span>
                      )}
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
                  {engagementLevel(org.maxBehaviorScore)
                    ? <span className={`analytics-engagement analytics-engagement-${engagementLevel(org.maxBehaviorScore)!.toLowerCase()}`}>{engagementLevel(org.maxBehaviorScore)}</span>
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

      {/* Mobile org cards — visible only at ≤480px */}
      <div className="mobile-cards org-cards-mobile">
        {sortedOrgs.length === 0 ? (
          <div className="admin-no-results" style={{ textAlign: 'center', padding: '1.5rem' }}>
            No visitor data for this period.
          </div>
        ) : (
          sortedOrgs.map((org) => (
            <div
              key={org.key}
              className={`org-card-mobile${org.isTargetCustomer ? ' org-card-target' : ''}${
                org.leadTier === 'A' ? ' org-card-tier-A' : org.leadTier === 'B' ? ' org-card-tier-B' : ''
              }${org.isAnonymousHighIntent ? ' org-card-intent' : ''}`}
              onClick={() => selectOrg(org)}
            >
              <div className="org-card-header">
                <span className="org-card-name" title={org.orgName}>{org.orgName}</span>
                <div className="org-card-badges">
                  {org.leadTier && (
                    <span className={`org-card-tier analytics-tier-${org.leadTier}`}>{org.leadTier}</span>
                  )}
                  {org.isAnonymousHighIntent && !org.leadTier && (
                    <span className="org-card-tier analytics-tier-intent">Intent</span>
                  )}
                  {org.organizationType && (
                    <span className={`org-card-type analytics-type-${org.organizationType}`}>{org.organizationType}</span>
                  )}
                </div>
              </div>
              <div className="org-card-location">
                {[org.city, org.region, org.country].filter(Boolean).join(', ') || 'Unknown location'}
              </div>
              <div className="org-card-stats">
                <div>
                  <div className="org-card-stat-value">{org.uniquePages}</div>
                  <div className="org-card-stat-label">Pages</div>
                </div>
                <div>
                  <div className="org-card-stat-value">{org.totalEvents}</div>
                  <div className="org-card-stat-label">Events</div>
                </div>
                <div>
                  <div className="org-card-stat-value">{org.totalTimeOnSite > 0 ? formatDuration(org.totalTimeOnSite) : '—'}</div>
                  <div className="org-card-stat-label">Time</div>
                </div>
                <div>
                  <div className="org-card-stat-value">
                    {engagementLevel(org.maxBehaviorScore) || '—'}
                  </div>
                  <div className="org-card-stat-label">Engage</div>
                </div>
              </div>
              <div className="org-card-footer">
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
