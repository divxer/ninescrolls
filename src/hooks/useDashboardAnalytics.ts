import { useState, useEffect, useMemo } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';

const client = generateClient<Schema>();

type AnalyticsEvent = Schema['AnalyticsEvent']['type'];

function computeTrend(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

function visitorKey(e: AnalyticsEvent): string {
  return e.orgName || e.org || e.ip || 'unknown';
}

export interface DashboardAnalytics {
  monthlyVisitors: number;
  targetCustomers: number;
  visitorTrend: number;
  targetTrend: number;
  dailyCounts: number[];
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
    if (loading || events.length === 0) {
      return { monthlyVisitors: 0, targetCustomers: 0, visitorTrend: 0, targetTrend: 0, dailyCounts: [], loading };
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

    return {
      monthlyVisitors: currentVisitors.size,
      targetCustomers: currentTargets.size,
      visitorTrend: computeTrend(currentVisitors.size, previousVisitors.size),
      targetTrend: computeTrend(currentTargets.size, previousTargets.size),
      dailyCounts,
      loading: false,
    };
  }, [events, loading]);
}

export { computeTrend };
