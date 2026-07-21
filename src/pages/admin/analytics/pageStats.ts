import { resolveTrafficChannel } from '../../../services/behaviorAnalytics';
import type { AnalyticsEvent, PageStats, ProductPageStats, LandingPageStats } from './types';
import { normalizePath } from './format';
import { selectBestFlush } from './flush';

export function aggregatePageStats(events: AnalyticsEvent[]): PageStats[] {
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

export function aggregateProductStats(pageStats: PageStats[], events: AnalyticsEvent[]): ProductPageStats[] {
  const productPages = pageStats.filter(p => p.isProductPage);
  const productPaths = new Set(productPages.map(p => p.pathname));

  // Downloads/contacts are attributed to a product page in two ways, in order:
  //   1. by pathname — the public DownloadGateModal flow stores pdf_download
  //      events with the product path (e.g. /products/rie-etcher) but NO
  //      productName, so pathname is the only reliable key for real traffic.
  //   2. by productName slug-match — legacy fallback for events that carry a
  //      productName but land on a non-product path (e.g. RFQs submitted from
  //      /request-quote, or contact forms with an empty pathname).
  // An event that already matched by pathname is never also counted by name,
  // so a download with both keys is counted exactly once.
  const pathPdf = new Map<string, number>();
  const pathContact = new Map<string, number>();
  const namePdf = new Map<string, number>();
  const nameContact = new Map<string, number>();

  for (const e of events) {
    const isPdf = e.eventType === 'pdf_download' || e.eventName === 'Document Downloaded';
    const isContact = e.eventType === 'contact_form' || e.eventType === 'rfq_submission';
    if (!isPdf && !isContact) continue;

    const path = e.pathname ? normalizePath(e.pathname) : '';
    const pathMap = isPdf ? pathPdf : pathContact;
    const nameMap = isPdf ? namePdf : nameContact;

    if (path && productPaths.has(path)) {
      pathMap.set(path, (pathMap.get(path) || 0) + 1);
    } else {
      const key = e.productName || (isContact ? e.productId : undefined) || '';
      if (key) nameMap.set(key, (nameMap.get(key) || 0) + 1);
    }
  }

  const normalize = (s: string) => s.toLowerCase().replace(/[\s-]/g, '');

  return productPages.map(p => {
    // Extract product name from pathname: /products/hy-20l → hy-20l
    const slug = p.pathname.replace('/products/', '').replace(/\/$/, '');
    // Slug-match the legacy name-keyed counts (case-insensitive, ignore spaces/dashes)
    const matchedPdfKey = Array.from(namePdf.keys()).find(k => normalize(k) === normalize(slug));
    const matchedContactKey = Array.from(nameContact.keys()).find(k => normalize(k) === normalize(slug));

    const downloads = (pathPdf.get(p.pathname) || 0) + (matchedPdfKey ? (namePdf.get(matchedPdfKey) || 0) : 0);
    const contacts = (pathContact.get(p.pathname) || 0) + (matchedContactKey ? (nameContact.get(matchedContactKey) || 0) : 0);
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

export function aggregateLandingPages(events: AnalyticsEvent[]): LandingPageStats[] {
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
