import { useState, useEffect, useMemo } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import { resolveTrafficChannel, extractSearchQuery } from '../services/behaviorAnalytics';

const client = generateClient<Schema>();

type AnalyticsEvent = Schema['AnalyticsEvent']['type'];

function computeTrend(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

function visitorKey(e: AnalyticsEvent): string {
  return e.orgName || e.org || e.ip || 'unknown';
}

const CHANNEL_LABELS: Record<string, string> = {
  paid_search: 'Paid Search', organic_search: 'Organic Search', ai_referral: 'AI Referral',
  paid_social: 'Paid Social', organic_social: 'Organic Social', email: 'Email',
  referral: 'Referral', direct: 'Direct',
};

function classifySection(pathname: string | null | undefined): string {
  if (!pathname) return 'Other';
  const p = pathname.replace(/\/$/, '') || '/';
  if (p === '/') return 'Home';
  if (p.startsWith('/products')) return 'Products';
  if (p.startsWith('/insights')) return 'Insights';
  if (p.startsWith('/news')) return 'News';
  if (p === '/contact' || p === '/request-quote') return 'Contact';
  if (p === '/about' || p === '/careers') return 'About';
  return 'Other';
}

export interface TrafficInsightData {
  channel: { name: string; trend: number; count: number } | null;
  section: { name: string; trend: number; count: number } | null;
  topKeyword: { keyword: string; count: number } | null;
}

export interface DashboardAnalytics {
  monthlyVisitors: number;
  targetCustomers: number;
  visitorTrend: number;
  targetTrend: number;
  dailyCounts: number[];
  trafficInsight: TrafficInsightData;
  loading: boolean;
}

export function useDashboardAnalytics(): DashboardAnalytics {
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const now = new Date();
      const sixtyDaysAgo = new Date(now.getTime() - 60 * 86_400_000);
      const startISO = sixtyDaysAgo.toISOString();
      const endISO = now.toISOString();

      const results: AnalyticsEvent[] = [];
      let nextToken: string | undefined;

      do {
        if (cancelled) return;

        const result = await (client.models.AnalyticsEvent as any)
          .listAnalyticsEventByEventTypeAndTimestamp(
            { eventType: 'page_view', timestamp: { between: [startISO, endISO] } },
            { authMode: 'userPool', limit: 500, nextToken },
          );

        const batch = (result.data || []) as AnalyticsEvent[];
        results.push(...batch);
        nextToken = result.nextToken || undefined;
      } while (nextToken);

      if (!cancelled) {
        setEvents(results);
        setLoading(false);
      }
    }

    load().catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return useMemo(() => {
    const emptyInsight: TrafficInsightData = { channel: null, section: null, topKeyword: null };
    if (loading || events.length === 0) {
      return { monthlyVisitors: 0, targetCustomers: 0, visitorTrend: 0, targetTrend: 0, dailyCounts: [], trafficInsight: emptyInsight, loading };
    }

    const now = Date.now();
    const thirtyDaysMs = 30 * 86_400_000;
    const currentStart = now - thirtyDaysMs;
    const previousStart = now - 2 * thirtyDaysMs;

    const currentEvents = events.filter(e => new Date(e.timestamp).getTime() >= currentStart);
    const previousEvents = events.filter(e => {
      const t = new Date(e.timestamp).getTime();
      return t >= previousStart && t < currentStart;
    });

    const currentVisitors = new Set(currentEvents.map(visitorKey));
    const previousVisitors = new Set(previousEvents.map(visitorKey));

    const currentTargets = new Set(currentEvents.filter(e => e.isTargetCustomer).map(visitorKey));
    const previousTargets = new Set(previousEvents.filter(e => e.isTargetCustomer).map(visitorKey));

    // Daily unique visitor counts for bar chart (last 30 days)
    const dailyCounts: number[] = [];
    for (let i = 29; i >= 0; i--) {
      const dayStart = now - (i + 1) * 86_400_000;
      const dayEnd = now - i * 86_400_000;
      const dayVisitors = new Set(
        currentEvents
          .filter(e => { const t = new Date(e.timestamp).getTime(); return t >= dayStart && t < dayEnd; })
          .map(visitorKey),
      );
      dailyCounts.push(dayVisitors.size);
    }

    // ── Traffic Insight: Channel ──
    const MIN_EVENTS_FOR_INSIGHT = 3;
    let channelInsight: TrafficInsightData['channel'] = null;
    {
      const curChannels = new Map<string, number>();
      const prevChannels = new Map<string, number>();
      for (const e of currentEvents) {
        const ch = resolveTrafficChannel(e);
        curChannels.set(ch, (curChannels.get(ch) || 0) + 1);
      }
      for (const e of previousEvents) {
        const ch = resolveTrafficChannel(e);
        prevChannels.set(ch, (prevChannels.get(ch) || 0) + 1);
      }
      // Find channel with biggest absolute growth (require minimum events to avoid noise)
      let bestChannel = '';
      let bestDelta = 0;
      for (const [ch, cur] of curChannels) {
        const prev = prevChannels.get(ch) || 0;
        const delta = cur - prev;
        if (cur >= MIN_EVENTS_FOR_INSIGHT && Math.abs(delta) > Math.abs(bestDelta)) {
          bestChannel = ch;
          bestDelta = delta;
        }
      }
      if (bestChannel) {
        const cur = curChannels.get(bestChannel) || 0;
        const prev = prevChannels.get(bestChannel) || 0;
        channelInsight = {
          name: CHANNEL_LABELS[bestChannel] || bestChannel,
          trend: computeTrend(cur, prev),
          count: cur,
        };
      }
    }

    // ── Traffic Insight: Section ──
    let sectionInsight: TrafficInsightData['section'] = null;
    {
      const curSections = new Map<string, number>();
      const prevSections = new Map<string, number>();
      for (const e of currentEvents) {
        const sec = classifySection(e.pathname);
        curSections.set(sec, (curSections.get(sec) || 0) + 1);
      }
      for (const e of previousEvents) {
        const sec = classifySection(e.pathname);
        prevSections.set(sec, (prevSections.get(sec) || 0) + 1);
      }
      let bestSection = '';
      let bestDelta = 0;
      for (const [sec, cur] of curSections) {
        if (sec === 'Other') continue; // skip uncategorized
        const prev = prevSections.get(sec) || 0;
        const delta = cur - prev;
        if (cur >= MIN_EVENTS_FOR_INSIGHT && delta > bestDelta) {
          bestSection = sec;
          bestDelta = delta;
        }
      }
      if (bestSection) {
        const cur = curSections.get(bestSection) || 0;
        const prev = prevSections.get(bestSection) || 0;
        sectionInsight = {
          name: bestSection,
          trend: computeTrend(cur, prev),
          count: cur,
        };
      }
    }

    // ── Traffic Insight: Top Keyword ──
    let topKeyword: TrafficInsightData['topKeyword'] = null;
    {
      const kwMap = new Map<string, number>();
      for (const e of currentEvents) {
        const sq = e.searchQuery || extractSearchQuery(e.referrer || undefined) || e.utmTerm;
        if (sq) {
          const key = sq.toLowerCase().trim();
          if (key) kwMap.set(key, (kwMap.get(key) || 0) + 1);
        }
      }
      let bestKw = '';
      let bestCount = 0;
      for (const [kw, count] of kwMap) {
        if (count > bestCount) { bestKw = kw; bestCount = count; }
      }
      if (bestKw) {
        topKeyword = { keyword: bestKw, count: bestCount };
      }
    }

    return {
      monthlyVisitors: currentVisitors.size,
      targetCustomers: currentTargets.size,
      visitorTrend: computeTrend(currentVisitors.size, previousVisitors.size),
      targetTrend: computeTrend(currentTargets.size, previousTargets.size),
      dailyCounts,
      trafficInsight: { channel: channelInsight, section: sectionInsight, topKeyword },
      loading: false,
    };
  }, [events, loading]);
}

export { computeTrend };
