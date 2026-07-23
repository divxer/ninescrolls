import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { listOrgOverrides, type OrgOverrideSummary } from '../../services/adminClassificationService';
import { resolveTrafficChannel, matchesUtmFilter, type UtmFilter, type UtmGroupBy, type UtmEvent } from '../../services/behaviorAnalytics';
import { UtmTrafficSummary } from './UtmTrafficSummary';
import { AdminTrendsSection } from './AdminTrendsSection';
import * as orderAdminService from '../../services/orderAdminService';
import type { RfqSubmission, LeadSubmission } from '../../types/admin';
import { getAmplifyDataClient } from '../../services/amplifyClient';
import type { AnalyticsEvent, OrganizationRecord, DateRange, SortColumn, KpiFilter, KeywordSourceFilter, PageAnalyticsTab } from './analytics/types';
import { DATE_RANGES } from './analytics/constants';
import { tierRank, formatDuration, engagementLevel, engagementRank, getDateBounds, formatRelativeTime, isPrivateIP } from './analytics/format';
import { VisitorMap } from './analytics/components/VisitorMap';
import { ChannelSummaryChart } from './analytics/components/ChannelSummaryChart';
import { OrgDetail } from './analytics/OrgDetail';
import { aggregateKeywords } from './analytics/keywords';
import { aggregatePageStats, aggregateProductStats, aggregateLandingPages } from './analytics/pageStats';
import { aggregateBots } from './analytics/bots';
import { aggregateByOrg, resolveOrgOverride } from './analytics/orgAggregation';

const client = getAmplifyDataClient;

// The generated client types don't expose the AnalyticsEvent secondary-index
// queries, so narrow the untyped model surface to just the operations we use.
interface AnalyticsEventListResult {
  data: AnalyticsEvent[] | null;
  nextToken?: string | null;
}

interface AnalyticsEventModelOps {
  listAnalyticsEventByEventTypeAndTimestamp(
    input: { eventType: string; timestamp: { between: [string, string] } },
    options: { authMode: 'userPool'; limit: number; nextToken?: string },
  ): Promise<AnalyticsEventListResult>;
  listAnalyticsEventBySessionIdAndTimestamp(
    input: { sessionId: string },
    options: { authMode: 'userPool'; limit: number },
  ): Promise<AnalyticsEventListResult>;
  get(
    input: { id: string },
    options: { authMode: 'userPool' },
  ): Promise<{ data: AnalyticsEvent | null }>;
}

const analyticsEventModel = (): AnalyticsEventModelOps =>
  client().models.AnalyticsEvent as unknown as AnalyticsEventModelOps;

// Shape of the AppSync subscription surface if/when the client exposes it
// (accessed defensively — may be absent, in which case polling covers us).
interface AnalyticsSubscriptions {
  onAnalyticsEvent?: (opts: { authMode: string }) => {
    subscribe: (handlers: {
      next: (event: { data: { id: string; eventType: string; timestamp: string } }) => void;
      error: (err: unknown) => void;
    }) => { unsubscribe: () => void };
  };
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
  const [exclusionsOpen, setExclusionsOpen] = useState(false);
  const [sortCol, setSortCol] = useState<SortColumn>('lastVisit');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [selectedOrg, setSelectedOrg] = useState<OrganizationRecord | null>(null);
  const [kpiFilter, setKpiFilter] = useState<KpiFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false); // soft refresh indicator
  const [liveMode, setLiveMode] = useState(true);
  const [liveNewCount, setLiveNewCount] = useState(0); // new events since live mode started
  const [orgOverrides, setOrgOverrides] = useState<OrgOverrideSummary[]>([]);
  const [keywordSourceFilter, setKeywordSourceFilter] = useState<KeywordSourceFilter>('all');
  const [keywordSectionOpen, setKeywordSectionOpen] = useState(false);
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);
  const keywordSectionRef = useRef<HTMLElement>(null);
  const [pageAnalyticsTab, setPageAnalyticsTab] = useState<PageAnalyticsTab>('topPages');
  const [pageAnalyticsSectionOpen, setPageAnalyticsSectionOpen] = useState(true);
  const [trendsSectionOpen, setTrendsSectionOpen] = useState(true);
  // Enhanced filter state
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [utmFilter, setUtmFilter] = useState<UtmFilter>({});
  const [utmGroupBy, setUtmGroupBy] = useState<UtmGroupBy>('source');
  const [regionFilter, setRegionFilter] = useState<string>('all');
  const [scoreMin, setScoreMin] = useState<string>('');
  const [scoreMax, setScoreMax] = useState<string>('');
  const [lifecycleFilter, setLifecycleFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set());
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
  const typeDropdownRef = useRef<HTMLDivElement>(null);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [showAllOrgs, setShowAllOrgs] = useState(false);
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

  // Close type dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (typeDropdownRef.current && !typeDropdownRef.current.contains(e.target as Node)) {
        setTypeDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
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
    // Don't fetch when custom is selected but dates aren't set yet
    if (dateRange === 'custom' && (!customStart || !customEnd)) return;

    let cancelled = false;
    prevDateRange.current = dateRange;
    prevCustomStart.current = customStart;
    prevCustomEnd.current = customEnd;

    // Soft refresh: keep existing data visible while loading new data
    const isSoftRefresh = allEvents.length > 0;

    async function loadAllEvents() {
      if (isSoftRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
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
        'purchase', 'rfq_step', 'rfq_submission', 'lead_capture',
        'newsletter_signup', 'other', 'anomaly',
      ];

      async function queryByType(eventType: string): Promise<AnalyticsEvent[]> {
        const results: AnalyticsEvent[] = [];
        let nextToken: string | undefined;

        do {
          if (cancelled) return results;

          const result = await analyticsEventModel()
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
              const res = await analyticsEventModel()
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

  // Refetch overrides when a detail dossier closes. OrgDetail can write new
  // classifications (auto-classify, Mark as Target, Undo, Rename) while open;
  // without this, the table keeps using a stale snapshot until full refresh,
  // which breaks ISP grouping for orgs that were just classified.
  const prevSelectedOrgRef = useRef<OrganizationRecord | null>(null);
  useEffect(() => {
    if (prevSelectedOrgRef.current && !selectedOrg) {
      listOrgOverrides()
        .then(setOrgOverrides)
        .catch((err) => console.warn('Failed to refresh overrides:', err));
    }
    prevSelectedOrgRef.current = selectedOrg;
  }, [selectedOrg]);

  // Load all RFQs for institution name backfill
  const [allRfqs, setAllRfqs] = useState<RfqSubmission[]>([]);
  useEffect(() => {
    let cancelled = false;
    orderAdminService.listRfqs()
      .then(data => {
        if (cancelled) return;
        setAllRfqs((data?.items as RfqSubmission[]) || []);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [refreshKey]);

  // Load ALL leads (no type filter) for organization name backfill +
  // LINKED INQUIRIES / DOWNLOADS / NEWSLETTER cards. Mirrors allRfqs — single
  // fetch on mount + refreshKey changes, errors are swallowed (a failed fetch
  // simply means lead cards don't surface; not a hard error).
  const [allLeads, setAllLeads] = useState<LeadSubmission[]>([]);
  useEffect(() => {
    let cancelled = false;
    orderAdminService.listLeads(undefined, 200)
      .then(data => {
        if (cancelled) return;
        setAllLeads((data?.items as LeadSubmission[]) || []);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [refreshKey]);

  // Derive per-type slices (cheap — runs only when allLeads changes).
  const allContactLeads = useMemo(
    () => allLeads.filter(l => l.type === 'contact'),
    [allLeads],
  );
  const allDownloadGateLeads = useMemo(
    () => allLeads.filter(l => l.type === 'download_gate'),
    [allLeads],
  );
  const allNewsletterLeads = useMemo(
    () => allLeads.filter(l => l.type === 'newsletter'),
    [allLeads],
  );

  // ── Live Mode: AppSync Subscription (no polling) ────
  // Subscribes to onAnalyticsEvent (fires when server-track Lambda calls
  // publishAnalyticsEvent mutation after DDB write).
  // Reconnects on sleep/wake via visibilitychange. Manual Refresh button
  // covers any edge cases where subscription silently drops.
  useEffect(() => {
    if (!liveMode) {
      setLiveNewCount(0);
      return;
    }

    let cancelled = false;
    let subscription: { unsubscribe: () => void } | null = null;
    let hiddenSince: string | null = null; // ISO timestamp when tab went hidden
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectAttempt = 0;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    // Track newest event timestamp seen so polling fallback can fetch only the gap.
    // Initialise to mount time so we don't refetch the entire date range.
    let lastSeenISO: string = new Date().toISOString();

    // Handler for incoming subscription events
    const handleSubscriptionEvent = (event: { data: { id: string; eventType: string; timestamp: string } }) => {
      if (cancelled) return;
      const notification = event.data;
      if (!notification?.id) return;

      if (notification.timestamp && notification.timestamp > lastSeenISO) {
        lastSeenISO = notification.timestamp;
      }

      analyticsEventModel().get(
        { id: notification.id },
        { authMode: 'userPool' },
      ).then((result: { data: AnalyticsEvent | null }) => {
        if (cancelled || !result.data) return;
        const fullEvent = result.data;

        setAllEvents((prev) => {
          const existingIdx = prev.findIndex((e) => e.id === fullEvent.id);
          if (existingIdx >= 0) {
            const updated = [...prev];
            updated[existingIdx] = fullEvent;
            return updated;
          }
          setLiveNewCount((c) => c + 1);
          return [...prev, fullEvent];
        });
      }).catch((err: unknown) => {
        console.warn('[Live] failed to fetch full event:', err);
      });
    };

    // Fetch events since a given timestamp and merge into state (incremental catch-up)
    async function fetchEventsSince(sinceISO: string): Promise<void> {
      const EVENT_TYPES = [
        'page_view', 'page_time_flush', 'product_view', 'pdf_download',
        'contact_form', 'target_customer', 'search', 'add_to_cart',
        'purchase', 'rfq_step', 'rfq_submission', 'lead_capture',
        'newsletter_signup', 'other', 'anomaly',
      ];
      const nowISO = new Date().toISOString();

      const perType = await Promise.all(EVENT_TYPES.map(async (eventType) => {
        const results: AnalyticsEvent[] = [];
        let nextToken: string | undefined;
        do {
          if (cancelled) return results;
          const result = await analyticsEventModel()
            .listAnalyticsEventByEventTypeAndTimestamp(
              { eventType, timestamp: { between: [sinceISO, nowISO] } },
              { authMode: 'userPool', limit: 500, nextToken },
            );
          results.push(...((result.data || []) as AnalyticsEvent[]));
          nextToken = result.nextToken || undefined;
        } while (nextToken);
        return results;
      }));

      if (cancelled) return;
      const fetched = perType.flat();
      if (fetched.length === 0) return;

      // Advance lastSeenISO past the newest fetched event so the next poll
      // doesn't refetch the same window.
      for (const e of fetched) {
        const ts = (e as { timestamp?: string }).timestamp;
        if (ts && ts > lastSeenISO) lastSeenISO = ts;
      }

      setAllEvents((prev) => {
        const existingIds = new Set(prev.map((e) => e.id));
        const newEvents = fetched.filter((e) => !existingIds.has(e.id));
        if (newEvents.length === 0) return prev;
        setLiveNewCount((c) => c + newEvents.length);
        return [...prev, ...newEvents];
      });
    }

    // Schedule a reconnect with exponential backoff (capped at 30s).
    function scheduleReconnect(): void {
      if (cancelled || reconnectTimer) return;
      const delay = Math.min(30_000, 1000 * Math.pow(2, reconnectAttempt));
      reconnectAttempt += 1;
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        if (cancelled) return;
        connectSubscription();
      }, delay);
    }

    // Connect (or reconnect) AppSync subscription
    function connectSubscription(): void {
      subscription?.unsubscribe();
      subscription = null;
      try {
        const subscriptions = (client as unknown as { subscriptions?: AnalyticsSubscriptions }).subscriptions;
        if (!subscriptions?.onAnalyticsEvent) {
          console.info('[Live] Subscription not available yet — polling fallback will catch events');
          scheduleReconnect();
          return;
        }
        subscription = subscriptions.onAnalyticsEvent({
          authMode: 'userPool',
        }).subscribe({
          next: (event: { data: { id: string; eventType: string; timestamp: string } }) => {
            reconnectAttempt = 0; // reset backoff on healthy traffic
            handleSubscriptionEvent(event);
          },
          error: (err: unknown) => {
            console.warn('[Live] subscription error, will reconnect:', err);
            subscription = null;
            scheduleReconnect();
          },
        });
        console.info('[Live] AppSync subscription connected');
      } catch (err) {
        console.warn('[Live] Failed to set up subscription:', err);
        scheduleReconnect();
      }
    }

    connectSubscription();

    // ── Polling fallback ─────────────────────────────────────────────
    // Subscriptions silently drop on network blips and not every event type
    // publishes. Poll every 30s for events newer than lastSeenISO so nothing
    // can be lost — at worst it shows up 30s late.
    pollTimer = setInterval(() => {
      if (cancelled || document.hidden) return;
      const since = lastSeenISO;
      fetchEventsSince(since).catch((err) => {
        console.warn('[Live] polling fallback failed:', err);
      });
    }, 30_000);

    // Reconnect subscription + incremental catch-up when returning from sleep/hidden
    const onVisibilityChange = () => {
      if (cancelled) return;
      if (document.hidden) {
        hiddenSince = new Date().toISOString();
        return;
      }
      console.info('[Live] tab visible — reconnecting subscription');
      connectSubscription();
      // Incremental fetch: only query events since tab went hidden
      if (hiddenSince) {
        const since = hiddenSince;
        hiddenSince = null;
        fetchEventsSince(since);
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelled = true;
      subscription?.unsubscribe();
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (pollTimer) clearInterval(pollTimer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [liveMode]);

  // Reset live new-event counter when date range changes or full refresh happens
  useEffect(() => {
    setLiveNewCount(0);
  }, [dateRange, customStart, customEnd, refreshKey]);

  // Own visitorId for self-exclusion
  const selfVisitorId = useMemo(() => {
    try { return localStorage.getItem('ns_visitor_id') || ''; } catch { return ''; }
  }, []);

  // Build override AI map so aggregateByOrg can detect ISPs even when
  // event-level aiOrganizationType is missing (older un-backfilled events).
  // Manual overrides bypass the confidence threshold (admin = trusted);
  // AI overrides require >= 0.5 to match the event-level threshold.
  const overrideAiByOrg = useMemo(() => {
    const map = new Map<string, { organizationType: string; confidence: number }>();
    for (const ov of orgOverrides) {
      if (!ov.organizationType || ov.organizationType === 'unknown') continue;
      const trusted = ov.source === 'manual' || (ov.confidence ?? 0) >= 0.5;
      if (!trusted) continue;
      map.set(ov.orgName, { organizationType: ov.organizationType, confidence: ov.confidence ?? 0 });
    }
    return map;
  }, [orgOverrides]);

  // Collect all visitorIds that share an org with the admin's current visitorId.
  // This catches historical visitorIds (cleared localStorage, different sessions)
  // that were grouped into the same organization by IP/org lookup.
  const selfVisitorIds = useMemo(() => {
    if (!selfVisitorId) return new Set<string>();
    // First, aggregate orgs to find which org contains selfVisitorId.
    // Pass override map so ISP grouping splits residential visitors apart —
    // otherwise an admin on an ISP would pull every residential visitor into selfOrg.
    const orgs = aggregateByOrg(allEvents, overrideAiByOrg);
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
  }, [allEvents, selfVisitorId, overrideAiByOrg]);

  const botRecords = useMemo(() => aggregateBots(allEvents), [allEvents]);

  // Bots are always excluded from human analytics (orgs / keywords / pages / landings).
  // They surface only in the dedicated Bot Traffic panel below, gated by `showBots`.
  const filteredEvents = useMemo(() => {
    let events = allEvents.filter((e) => !e.isBot);
    if (!showPrivateIPs) {
      events = events.filter((e) => !e.ip || !isPrivateIP(e.ip));
    }
    if (hideSelf && selfVisitorIds.size > 0) {
      events = events.filter((e) => !selfVisitorIds.has((e as Record<string, unknown>).visitorId as string));
    }
    return events;
  }, [allEvents, showPrivateIPs, hideSelf, selfVisitorIds]);

  // Aggregate by organization, then apply manual overrides
  const organizations = useMemo(() => {
    const orgs = aggregateByOrg(filteredEvents, overrideAiByOrg);

    // Backfill rfqInstitution from RFQ table for orgs missing it in event properties
    if (allRfqs.length > 0) {
      const rfqById = new Map<string, string>();
      for (const r of allRfqs) {
        if (r.rfqId && r.institution) rfqById.set(r.rfqId, r.institution);
      }

      for (const org of orgs) {
        if (org.rfqInstitution) continue;
        const rfqEvent = org.events.find(e => e.eventType === 'rfq_submission');
        if (!rfqEvent) continue;

        // Try matching by rfqId in event properties
        const props = typeof rfqEvent.properties === 'string'
          ? (() => { try { return JSON.parse(rfqEvent.properties); } catch { return null; } })()
          : rfqEvent.properties;
        const rfqId = props?.rfqId as string;
        if (rfqId && rfqById.has(rfqId)) {
          org.rfqInstitution = rfqById.get(rfqId)!;
          continue;
        }

        // Fallback: match by timestamp proximity (±60s) for legacy events without rfqId
        const evtTime = new Date(rfqEvent.timestamp).getTime();
        const matched = allRfqs.find(r =>
          r.institution && Math.abs(new Date(r.submittedAt).getTime() - evtTime) < 60_000
        );
        if (matched?.institution) {
          org.rfqInstitution = matched.institution;
        }
      }
    }

    // Backfill contactOrganization from contact leads: most recent lead with a
    // non-empty organization, matched by visitorId set per org. Pure client-side
    // join — the org aggregator does not see leads.
    if (allContactLeads.length > 0) {
      for (const org of orgs) {
        const hasContactForm = org.events.some(e => e.eventType === 'contact_form');
        if (!hasContactForm) continue;

        const visitorIds = new Set<string>();
        for (const e of org.events) {
          const vid = (e as Record<string, unknown>).visitorId as string | undefined;
          if (vid) visitorIds.add(vid);
        }
        if (visitorIds.size === 0) continue;

        // Find most-recent matching lead with a non-empty organization string.
        let bestLead: LeadSubmission | null = null;
        for (const lead of allContactLeads) {
          if (!lead.visitorId || !visitorIds.has(lead.visitorId)) continue;
          if (!lead.organization || !lead.organization.trim()) continue;
          if (!bestLead || +new Date(lead.submittedAt) > +new Date(bestLead.submittedAt)) {
            bestLead = lead;
          }
        }
        if (bestLead?.organization) {
          org.contactOrganization = bestLead.organization.trim();
        }
      }
    }

    // Backfill downloadGateOrganization from download_gate leads: same
    // most-recent-non-empty-organization rule as contactOrganization.
    if (allDownloadGateLeads.length > 0) {
      for (const org of orgs) {
        const hasDownload = org.events.some(e =>
          e.eventType === 'lead_capture' || e.eventType === 'pdf_download'
        );
        if (!hasDownload) continue;

        const visitorIds = new Set<string>();
        for (const e of org.events) {
          const vid = (e as Record<string, unknown>).visitorId as string | undefined;
          if (vid) visitorIds.add(vid);
        }
        if (visitorIds.size === 0) continue;

        let bestLead: LeadSubmission | null = null;
        for (const lead of allDownloadGateLeads) {
          if (!lead.visitorId || !visitorIds.has(lead.visitorId)) continue;
          if (!lead.organization || !lead.organization.trim()) continue;
          if (!bestLead || +new Date(lead.submittedAt) > +new Date(bestLead.submittedAt)) {
            bestLead = lead;
          }
        }
        if (bestLead?.organization) {
          org.downloadGateOrganization = bestLead.organization.trim();
        }
      }
    }

    if (orgOverrides.length === 0) return orgs;

    // Build lookup map for O(1) override matching
    const overrideMap = new Map<string, OrgOverrideSummary>();
    for (const ov of orgOverrides) {
      overrideMap.set(ov.orgName, ov);
    }

    for (const org of orgs) {
      // Same precedence as the detail view (stable key → legacy fallbacks) —
      // list and detail must never resolve to different overrides.
      const ov = resolveOrgOverride(overrideMap, org);
      if (!ov) continue;

      if (ov.displayName) {
        org.displayName = ov.displayName;
      }

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
  }, [filteredEvents, orgOverrides, allRfqs, allContactLeads, allDownloadGateLeads, overrideAiByOrg]);

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

    if (typeFilter.size > 0) {
      result = result.filter((o) => typeFilter.has(o.organizationType || 'unknown'));
    }

    if (Object.values(utmFilter).some((v) => v !== undefined)) {
      result = result.filter((o) => o.events.some((e) => matchesUtmFilter(e, utmFilter)));
    }

    return result;
  }, [searchedOrgs, channelFilter, regionFilter, scoreMin, scoreMax, lifecycleFilter, typeFilter, utmFilter]);

  // Unique countries for region filter dropdown
  const availableCountries = useMemo(() => {
    const countries = new Set<string>();
    for (const o of organizations) {
      if (o.country) countries.add(o.country);
    }
    return Array.from(countries).sort();
  }, [organizations]);

  const availableTypes = useMemo(() => {
    const types = new Set<string>();
    for (const o of organizations) {
      types.add(o.organizationType || 'unknown');
    }
    return Array.from(types).sort();
  }, [organizations]);

  const typeFilterLabel = useMemo(() => {
    if (typeFilter.size === 0) return 'All Types';
    if (typeFilter.size === 1) return Array.from(typeFilter)[0].replace(/_/g, ' ');
    return `${typeFilter.size} types`;
  }, [typeFilter]);

  const toggleType = useCallback((t: string) => {
    setTypeFilter((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  }, []);

  // Active filter count + summary for collapsible filter bar
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (channelFilter !== 'all') count++;
    if (regionFilter !== 'all') count++;
    if (scoreMin !== '') count++;
    if (scoreMax !== '') count++;
    if (lifecycleFilter !== 'all') count++;
    if (typeFilter.size > 0) count++;
    return count;
  }, [channelFilter, regionFilter, scoreMin, scoreMax, lifecycleFilter, typeFilter]);


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
  }, [enhancedFilteredOrgs, sortCol, sortDir]);

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

  // Daily unique visitor counts for sparkline
  const visitorSparkline = useMemo(() => {
    const dayMap = new Map<string, Set<string>>();
    for (const e of filteredEvents) {
      if (e.eventType !== 'page_view') continue;
      const day = new Date(e.timestamp).toISOString().slice(0, 10);
      const org = e.orgName || e.org || e.ip || 'unknown';
      if (!dayMap.has(day)) dayMap.set(day, new Set());
      dayMap.get(day)!.add(org);
    }
    const sorted = Array.from(dayMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    return sorted.map(([, orgs]) => orgs.size);
  }, [filteredEvents]);

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
        <OrgDetail org={selectedOrg} onBack={() => history.back()} allContactLeads={allContactLeads} allDownloadGateLeads={allDownloadGateLeads} allNewsletterLeads={allNewsletterLeads} />
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-8">

      {/* ─── Hero Header ──────────────────────────────────────────────────── */}
      <section className="sticky top-16 -mx-4 px-4 py-4 md:-mx-8 md:px-8 md:py-6 z-30 bg-surface/90 backdrop-blur-md border-b border-outline-variant/5 flex flex-col md:flex-row justify-between items-end gap-4 md:gap-6 transition-all mb-2">
        <div className="space-y-2">
          <span className="text-secondary font-bold text-xs tracking-widest uppercase">Precision Insights</span>
          <h2 className="text-2xl md:text-4xl font-black text-primary tracking-tight font-headline">Intelligence Ledger</h2>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex overflow-x-auto scrollbar-hide bg-surface-container-low p-0.5 md:p-1 rounded-xl max-w-full">
            {DATE_RANGES.filter(r => r.value !== 'custom').map((r) => (
              <button
                key={r.value}
                className={`px-1.5 md:px-4 py-2 text-[10px] md:text-xs font-medium rounded-lg border-none transition-all whitespace-nowrap cursor-pointer ${dateRange === r.value
                  ? 'bg-primary text-on-primary font-bold shadow-sm'
                  : 'text-on-surface-variant hover:bg-primary/10 hover:text-primary'}`}
                onClick={() => setDateRange(r.value)}
              >
                {r.label}
              </button>
            ))}
            <button
              className={`material-symbols-outlined px-2 md:px-3 border-none rounded-lg transition-all cursor-pointer ${dateRange === 'custom'
                ? 'bg-primary text-on-primary'
                : 'text-on-surface-variant hover:bg-primary/10 hover:text-primary'}`}
              onClick={() => setDateRange('custom')}
              title="Custom date range"
            >calendar_today</button>
          </div>
          {/* Live mode toggle */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            {liveMode && <span className="live-dot" />}
            <span className={`text-[10px] font-bold uppercase tracking-wider ${liveMode ? 'text-error' : 'text-on-surface-variant'}`}>
              Live
            </span>
            <input type="checkbox" checked={liveMode} onChange={(e) => setLiveMode(e.target.checked)} className="toggle-switch" />
          </label>
          {liveMode && liveNewCount > 0 && (
            <span className="text-[10px] font-bold text-error tabular-nums animate-pulse">
              +{liveNewCount} new
            </span>
          )}
          <button
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold border border-outline-variant/30 rounded-lg text-on-surface-variant hover:bg-surface-container-low transition-colors uppercase tracking-wider bg-transparent cursor-pointer"
            onClick={() => setRefreshKey((k) => k + 1)}
            disabled={refreshing}
          >
            <span className={`material-symbols-outlined text-sm ${refreshing ? 'animate-spin' : ''}`}>sync</span>Refresh
          </button>
          {dateRange === 'custom' && (
            <div className="flex items-center gap-2">
              <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)}
                className="bg-surface-container-lowest border border-outline-variant/20 rounded-lg py-1.5 px-3 text-xs" />
              <span className="text-on-surface-variant text-xs">to</span>
              <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)}
                className="bg-surface-container-lowest border border-outline-variant/20 rounded-lg py-1.5 px-3 text-xs" />
            </div>
          )}
        </div>
      </section>

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
            className={`px-4 py-1.5 rounded-full text-xs whitespace-nowrap border-none transition-colors ${
              kpiFilter === key
                ? 'bg-primary text-on-primary font-semibold'
                : 'bg-surface-container-low text-on-surface-variant font-medium hover:bg-surface-container'
            }`}
            onClick={() => setKpiFilter(kpiFilter === key && key !== 'all' ? 'all' : key)}
          >
            {label}
          </button>
        ))}
        {/* Data Exclusions dropdown */}
        <div className="relative">
          <button
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium border-none bg-surface-container-low text-on-surface-variant hover:bg-surface-container transition-colors whitespace-nowrap cursor-pointer"
            onClick={() => setExclusionsOpen(!exclusionsOpen)}
          >
            <span className="material-symbols-outlined text-sm">tune</span>
            Data Exclusions
            <span className="material-symbols-outlined text-sm">{exclusionsOpen ? 'expand_less' : 'expand_more'}</span>
          </button>
          {exclusionsOpen && (
            <div className="absolute top-full left-0 mt-2 bg-surface-container-lowest rounded-xl shadow-float p-5 z-20 min-w-[250px] space-y-4">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm font-medium text-on-surface">Hide Internal Traffic</span>
                <input type="checkbox" checked={hideSelf} onChange={(e) => setHideSelf(e.target.checked)} className="toggle-switch" />
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm font-medium text-on-surface">Hide Search Engines</span>
                <input type="checkbox" checked={!showBots} onChange={(e) => setShowBots(!e.target.checked)} className="toggle-switch" />
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm font-medium text-on-surface">Hide Private IPs</span>
                <input type="checkbox" checked={!showPrivateIPs} onChange={(e) => setShowPrivateIPs(!e.target.checked)} className="toggle-switch" />
              </label>
            </div>
          )}
        </div>
        {dateRange !== 'all' && kpis.visitorTrend !== 0 && (
          <div className={`ml-auto text-xs font-bold ${kpis.visitorTrend > 0 ? 'text-green-600' : 'text-red-600'}`}>
            {kpis.visitorTrend > 0 ? '+' : ''}{kpis.visitorTrend}% vs prev
          </div>
        )}
      </div>
      {/* ─── Active Exclusions Tags ────────────────────────────────────────── */}
      {(!showBots || !showPrivateIPs || hideSelf) && (
        <div className="flex flex-wrap items-center gap-2 py-1.5">
          <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mr-1">Active Exclusions:</span>
          {!showBots && (
            <button
              className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider border-none cursor-pointer hover:bg-primary/15 transition-colors"
              onClick={() => setShowBots(true)}
            >
              Search Engines
              <span className="material-symbols-outlined text-[12px]">close</span>
            </button>
          )}
          {!showPrivateIPs && (
            <button
              className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider border-none cursor-pointer hover:bg-primary/15 transition-colors"
              onClick={() => setShowPrivateIPs(true)}
            >
              Private IPs
              <span className="material-symbols-outlined text-[12px]">close</span>
            </button>
          )}
          {hideSelf && (
            <button
              className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider border-none cursor-pointer hover:bg-primary/15 transition-colors"
              onClick={() => setHideSelf(false)}
            >
              Internal Traffic
              <span className="material-symbols-outlined text-[12px]">close</span>
            </button>
          )}
        </div>
      )}

      {/* ─── Bot Traffic Panel ─────────────────────────────────────────────── */}
      {showBots && botRecords.length > 0 && (
        <div className="bg-surface-container-lowest rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-on-surface-variant">smart_toy</span>
              <h4 className="font-headline font-bold text-on-surface">Bot Traffic</h4>
              <span className="text-xs text-on-surface-variant">
                {botRecords.reduce((sum, b) => sum + b.events, 0)} events across {botRecords.length} bot{botRecords.length === 1 ? '' : 's'}
              </span>
            </div>
            <button
              className="text-xs text-on-surface-variant hover:text-on-surface bg-transparent border-none cursor-pointer underline"
              onClick={() => setShowBots(false)}
            >
              Hide
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest border-b border-outline-variant">
                  <th className="text-left py-2 pr-4">Bot</th>
                  <th className="text-right py-2 pr-4">Events</th>
                  <th className="text-right py-2 pr-4">Visitors</th>
                  <th className="text-right py-2 pr-4">Pages</th>
                  <th className="text-right py-2">Last Seen</th>
                </tr>
              </thead>
              <tbody>
                {botRecords.map((b) => (
                  <tr key={b.botName} className="border-b border-outline-variant/30 last:border-0">
                    <td className="py-2 pr-4 font-medium text-on-surface" title={b.userAgentSample}>{b.botName}</td>
                    <td className="py-2 pr-4 text-right tabular-nums text-on-surface-variant">{b.events}</td>
                    <td className="py-2 pr-4 text-right tabular-nums text-on-surface-variant">{b.uniqueVisitors}</td>
                    <td className="py-2 pr-4 text-right tabular-nums text-on-surface-variant">{b.uniquePages}</td>
                    <td className="py-2 text-right text-xs text-on-surface-variant">
                      {b.lastSeen ? new Date(b.lastSeen).toLocaleString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── Bento Grid ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Hero KPI Card — col-span-4 */}
        <div className="lg:col-span-4 bg-primary p-5 md:p-8 rounded-xl relative overflow-hidden text-white">
          <p className="text-white/80 text-sm font-medium mb-1">Unique Visitors</p>
          <h3 className="text-4xl md:text-7xl font-black font-headline tracking-tighter mb-4">{kpis.uniqueVisitors}</h3>
          <div className="flex items-center gap-2 text-white/90 font-bold text-sm">
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
          {visitorSparkline.length >= 2 && (
            <div className="absolute right-4 bottom-4 w-32 h-12 opacity-50">
              <svg className="w-full h-full" viewBox="0 0 100 40" preserveAspectRatio="none">
                {(() => {
                  const pts = visitorSparkline;
                  const max = Math.max(...pts, 1);
                  const coords = pts.map((v, i) => [
                    (i / (pts.length - 1)) * 100,
                    40 - (v / max) * 36 - 2,
                  ]);
                  const d = coords.map(([x, y], i) => (i === 0 ? `M${x} ${y}` : `L${x} ${y}`)).join(' ');
                  return <path d={d} fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />;
                })()}
              </svg>
            </div>
          )}
        </div>

        {/* Traffic Channel Attribution — col-span-8 */}
        <div className="lg:col-span-8 bg-surface-container-lowest rounded-xl p-4 md:p-8 border border-outline-variant/10">
          <div className="flex justify-between items-center mb-6 md:mb-10">
            <h4 className="font-headline font-bold text-on-surface">Traffic Channel Attribution</h4>
            <span className="text-xs font-medium text-on-surface-variant">Volume / Sessions</span>
          </div>
          <ChannelSummaryChart events={filteredEvents} activeChannel={channelFilter} onChannelClick={(ch) => { setChannelFilter(channelFilter === ch ? 'all' : ch); setFiltersOpen(true); }} />
        </div>

        {/* UTM Traffic Summary — col-span-12 */}
        <div className="lg:col-span-12">
          <UtmTrafficSummary
            events={filteredEvents as UtmEvent[]}
            groupBy={utmGroupBy}
            onGroupByChange={setUtmGroupBy}
            filter={utmFilter}
            onFilterChange={setUtmFilter}
          />
        </div>

        {/* Organization Ledger — col-span-9 */}
        <div className="lg:col-span-9 bg-surface-container-lowest rounded-xl overflow-hidden border border-outline-variant/10">
          {/* Header: title + search + export */}
          <div className="p-4 md:p-6 border-b border-surface-container">
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-headline font-bold">Organization Ledger</h4>
              <div className="flex items-center gap-2">
                <span className="text-xs text-on-surface-variant">{sortedOrgs.length} organizations</span>
                <button
                  className="material-symbols-outlined text-on-surface-variant hover:text-primary transition-colors border-none bg-transparent cursor-pointer"
                  onClick={exportCSV}
                  title="Export CSV"
                >
                  download
                </button>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">search</span>
                <input
                  type="text"
                  className="w-full bg-surface-container-low border-none rounded-lg py-2 pl-9 pr-4 text-sm placeholder:text-on-surface-variant/50"
                  placeholder="Search organizations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <button
                className="text-xs text-on-surface-variant border-none bg-transparent cursor-pointer flex items-center gap-1"
                onClick={() => setFiltersOpen(!filtersOpen)}
              >
                <span className="material-symbols-outlined text-sm">tune</span>
                Filters
                {activeFilterCount > 0 && (
                  <span className="bg-secondary text-white px-1.5 py-0.5 rounded text-[10px] font-bold">{activeFilterCount}</span>
                )}
              </button>
            </div>
            {/* Collapsible Filters */}
            {filtersOpen && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4 pt-4 border-t border-outline-variant/10">
                <select className="bg-surface-container-low border-none rounded-lg py-1.5 px-3 text-xs" value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)}>
                  <option value="all">All Channels</option>
                  <option value="paid_search">Paid Search</option>
                  <option value="organic_search">Organic Search</option>
                  <option value="ai_referral">AI Referral</option>
                  <option value="paid_social">Paid Social</option>
                  <option value="organic_social">Organic Social</option>
                  <option value="email">Email</option>
                  <option value="referral">Referral</option>
                  <option value="direct">Direct</option>
                </select>
                <select className="bg-surface-container-low border-none rounded-lg py-1.5 px-3 text-xs" value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)}>
                  <option value="all">All Regions</option>
                  {availableCountries.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <select className="bg-surface-container-low border-none rounded-lg py-1.5 px-3 text-xs" value={lifecycleFilter} onChange={(e) => setLifecycleFilter(e.target.value)}>
                  <option value="all">All Lifecycle</option>
                  <option value="awareness">Awareness</option>
                  <option value="interest">Interest</option>
                  <option value="consideration">Consideration</option>
                  <option value="intent">Intent</option>
                </select>
                <div className="relative" ref={typeDropdownRef}>
                  <button
                    className="w-full bg-surface-container-low border-none rounded-lg py-1.5 px-3 text-xs text-left cursor-pointer flex items-center justify-between"
                    onClick={() => setTypeDropdownOpen((v) => !v)}
                  >
                    <span className={typeFilter.size === 0 ? 'text-on-surface-variant' : 'text-on-surface font-medium'}>{typeFilterLabel}</span>
                    <span className="material-symbols-outlined text-sm">{typeDropdownOpen ? 'expand_less' : 'expand_more'}</span>
                  </button>
                  {typeDropdownOpen && (
                    <div className="absolute z-50 top-full left-0 mt-1 w-full bg-surface-container rounded-lg shadow-lg border border-outline-variant/20 py-1 max-h-60 overflow-y-auto">
                      {availableTypes.map((t) => (
                        <label key={t} className="flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer hover:bg-surface-container-low">
                          <input
                            type="checkbox"
                            checked={typeFilter.has(t)}
                            onChange={() => toggleType(t)}
                            className="accent-secondary"
                          />
                          <span>{t.replace(/_/g, ' ')}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                {activeFilterCount > 0 && (
                  <button
                    className="text-xs text-secondary font-medium border-none bg-transparent cursor-pointer hover:underline"
                    onClick={() => { setChannelFilter('all'); setRegionFilter('all'); setScoreMin(''); setScoreMax(''); setLifecycleFilter('all'); setTypeFilter(new Set()); }}
                  >
                    Clear all
                  </button>
                )}
              </div>
            )}
          </div>
          {/* Desktop table */}
          <div className="overflow-x-auto">
            <table className="hidden md:table w-full text-left">
              <thead className="bg-surface-container-low border-b border-surface-container">
                <tr className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                  <th className="pl-5 pr-2 py-4 cursor-pointer" onClick={() => handleSort('orgName')}>
                    Name{sortIndicator('orgName')}
                  </th>
                  <th className="px-3 py-4 cursor-pointer" onClick={() => handleSort('organizationType')}>
                    Type{sortIndicator('organizationType')}
                  </th>
                  <th className="px-3 py-4 text-center cursor-pointer" onClick={() => handleSort('totalEvents')}>
                    Visits{sortIndicator('totalEvents')}
                  </th>
                  <th className="px-3 py-4 cursor-pointer" onClick={() => handleSort('engagement')}>
                    Engagement{sortIndicator('engagement')}
                  </th>
                  <th className="px-3 py-4 cursor-pointer whitespace-nowrap" onClick={() => handleSort('totalTimeOnSite')}>
                    Active Time{sortIndicator('totalTimeOnSite')}
                  </th>
                  <th className="px-3 py-4 text-center cursor-pointer" onClick={() => handleSort('totalEvents')}>
                    Events{sortIndicator('totalEvents')}
                  </th>
                  <th className="px-3 py-4 cursor-pointer whitespace-nowrap" onClick={() => handleSort('lastVisit')}>
                    Last Visit{sortIndicator('lastVisit')}
                  </th>
                  <th className="pl-3 pr-5 py-4 text-right">Target</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container-low">
                {(showAllOrgs ? sortedOrgs : sortedOrgs.slice(0, 15)).map((org) => (
                  <tr
                    key={org.key}
                    className="hover:bg-surface-container-low/50 transition-colors cursor-pointer"
                    onClick={() => selectOrg(org)}
                  >
                    <td className="pl-5 pr-2 py-4">
                      {(() => {
                        const upgradedName = org.rfqInstitution || org.contactOrganization || org.downloadGateOrganization;
                        const displayMain = upgradedName || org.displayName || org.orgName;
                        const showSubLine = !!upgradedName && upgradedName.toLowerCase() !== org.orgName.toLowerCase();
                        return (
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center font-bold text-primary text-xs shrink-0">
                              {displayMain.split(/[\s,]+/).slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('')}
                            </div>
                            <div className="min-w-0">
                              <span className="font-semibold truncate max-w-[150px] block" title={displayMain}>{displayMain}</span>
                              {showSubLine && (
                                <span className="text-[10px] text-on-surface-variant truncate block max-w-[150px]" title={org.orgName}>
                                  <span className="material-symbols-outlined text-[10px] align-middle mr-0.5">dns</span>{org.orgName}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-3 py-4 text-on-surface-variant text-xs">{org.organizationType || '--'}</td>
                    <td className="px-3 py-4 text-center">{org.totalEvents.toLocaleString()}</td>
                    <td className="px-3 py-4">
                      <div className="w-20 bg-surface-container-high rounded-full h-1 relative">
                        <div
                          className="absolute left-0 w-1 h-1 bg-secondary rounded-full -top-[1.5px]"
                          style={{ left: `${Math.min(Math.max(org.maxBehaviorScore * 100, 0), 100)}%` }}
                        />
                      </div>
                    </td>
                    <td className="px-3 py-4 text-xs">{formatDuration(org.totalTimeOnSite)}</td>
                    <td className="px-3 py-4 text-center">{org.totalEvents}</td>
                    <td className="px-3 py-4 text-xs text-on-surface-variant whitespace-nowrap">{formatRelativeTime(org.lastVisit)}</td>
                    <td className="pl-3 pr-5 py-4 text-right">
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
                    <td colSpan={8} className="text-center py-8 text-on-surface-variant text-sm">
                      No visitor data for this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {/* Mobile org cards */}
          <div className="md:hidden grid gap-3 p-4">
            {(showAllOrgs ? sortedOrgs : sortedOrgs.slice(0, 10)).map((org) => {
              const upgradedName = org.rfqInstitution || org.contactOrganization || org.downloadGateOrganization;
              const displayMain = upgradedName || org.displayName || org.orgName;
              const showSubLine = !!upgradedName && upgradedName.toLowerCase() !== org.orgName.toLowerCase();
              return (
              <div key={org.key} className="bg-surface-container-low rounded-xl p-4 cursor-pointer" onClick={() => selectOrg(org)}>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded bg-surface-container flex items-center justify-center font-headline font-bold text-primary text-xs shrink-0">
                    {displayMain.split(/[\s,]+/).slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-on-surface truncate" title={displayMain}>{displayMain}</div>
                    {showSubLine ? (
                      <div className="text-xs text-on-surface-variant truncate"><span className="material-symbols-outlined text-[10px] align-middle mr-0.5">dns</span>{org.orgName}</div>
                    ) : (
                      <div className="text-xs text-on-surface-variant">{org.country || 'Unknown'}</div>
                    )}
                  </div>
                  {org.isTargetCustomer && (
                    <span className="material-symbols-outlined text-secondary text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>flag</span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div><div className="font-headline text-sm font-bold">{org.totalEvents}</div><div className="text-[10px] text-on-surface-variant uppercase tracking-widest">Events</div></div>
                  <div><div className="font-headline text-sm font-bold">{engagementLevel(org.maxBehaviorScore) || '--'}</div><div className="text-[10px] text-on-surface-variant uppercase tracking-widest">Engage</div></div>
                  <div><div className="font-headline text-sm font-bold">{formatDuration(org.totalTimeOnSite)}</div><div className="text-[10px] text-on-surface-variant uppercase tracking-widest">Time</div></div>
                </div>
              </div>
              );
            })}
          </div>
          {/* Show all / collapse toggle */}
          {sortedOrgs.length > 15 && (
            <div className="p-4 text-center border-t border-surface-container">
              <button
                className="text-xs font-bold text-secondary hover:underline border-none bg-transparent cursor-pointer"
                onClick={() => setShowAllOrgs(!showAllOrgs)}
              >
                {showAllOrgs ? 'Show less' : `Show all ${sortedOrgs.length} organizations`}
              </button>
            </div>
          )}
        </div>

        {/* Top Keywords Sidebar — col-span-3 */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/10">
            <div className="flex items-center justify-between mb-6">
              <h4 className="font-headline font-bold">Top Keywords</h4>
              <span className="material-symbols-outlined text-on-surface-variant text-sm">key</span>
            </div>
            <div className="space-y-4">
              {displayedKeywords.slice(0, 5).map((kw, i) => {
                const maxCount = displayedKeywords[0]?.count || 1;
                return (
                  <div key={`${kw.source}-${kw.keyword}-${i}`} className="flex flex-col gap-1.5 group cursor-pointer">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-primary">{kw.keyword}</span>
                      <span className="text-[10px] font-bold text-on-surface-variant">
                        {kw.count >= 1000 ? `${(kw.count / 1000).toFixed(1)}k` : kw.count}
                      </span>
                    </div>
                    <div className="w-full bg-surface-container-low h-1.5 rounded-full overflow-hidden">
                      <div className="bg-secondary h-full group-hover:bg-primary transition-all" style={{ width: `${Math.max((kw.count / maxCount) * 100, 5)}%` }} />
                    </div>
                  </div>
                );
              })}
              {displayedKeywords.length === 0 && (
                <div className="text-xs text-on-surface-variant/50 text-center py-4">No keyword data</div>
              )}
            </div>
            <button
              className="w-full mt-6 py-2 border border-outline-variant/30 rounded-lg text-[10px] font-bold text-on-surface-variant hover:bg-surface-container-low transition-colors uppercase tracking-widest bg-transparent cursor-pointer"
              onClick={() => {
                setKeywordSectionOpen(true);
                setTimeout(() => keywordSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
              }}
            >
              View Search Queries
            </button>
          </div>
          {kpis.hotLeads > 0 && (
            <div className="bg-primary/5 p-6 rounded-xl border border-primary/10">
              <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-2">Insight AI</p>
              <p className="text-xs text-primary/80 leading-relaxed font-medium italic">
                "{kpis.hotLeads} hot lead{kpis.hotLeads !== 1 ? 's' : ''} identified this period with high conversion potential."
              </p>
            </div>
          )}
        </div>

      </div>{/* End Bento Grid */}

      {/* Click-away handler for exclusions dropdown */}
      {exclusionsOpen && (
        <div className="fixed inset-0 z-10" onClick={() => setExclusionsOpen(false)} />
      )}

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
        <section ref={keywordSectionRef} className="bg-surface-container-lowest p-4 md:p-8 rounded-xl border border-outline-variant/10">
          <div
            className="flex items-center gap-2 mb-8 cursor-pointer select-none"
            onClick={() => setKeywordSectionOpen(!keywordSectionOpen)}
          >
            <span className="material-symbols-outlined text-on-surface-variant">search</span>
            <h4 className="font-headline font-bold">Search Keywords <span className="ml-2 text-xs font-normal text-on-surface-variant">{allKeywords.length}</span></h4>
            <span className="material-symbols-outlined text-on-surface-variant text-sm ml-1">{keywordSectionOpen ? 'expand_more' : 'chevron_right'}</span>
          </div>

          {keywordSectionOpen && (
            <>
              {/* Source filter tabs */}
              <div className="flex gap-2 mb-4">
                {([['all', 'All'], ['external', 'External'], ['internal', 'Internal']] as const).map(([val, label]) => (
                  <button
                    key={val}
                    className={`px-4 py-1.5 text-[10px] font-medium rounded border-none transition-colors ${keywordSourceFilter === val ? 'bg-primary text-on-primary font-bold' : 'bg-surface-container-low text-on-surface-variant'}`}
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

              {/* Keywords table (desktop only) */}
              <div className="hidden md:block bg-surface-container-lowest rounded-xl overflow-hidden" style={{ marginTop: '1rem' }}>
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
        </section>
      )}

      {/* ─── Page Analytics Section ───────────────────────────────────────── */}
      {pageStats.length > 0 && (
        <section className="bg-surface-container-lowest p-4 md:p-8 rounded-xl border border-outline-variant/10">
          <div className="flex items-center gap-2 mb-8 cursor-pointer select-none" onClick={() => setPageAnalyticsSectionOpen(!pageAnalyticsSectionOpen)}>
            <span className="material-symbols-outlined text-on-surface-variant">description</span>
            <h4 className="font-headline font-bold">Page Analytics <span className="ml-2 text-xs font-normal text-on-surface-variant">{pageStats.length}</span></h4>
            <span className="material-symbols-outlined text-on-surface-variant text-sm ml-1">{pageAnalyticsSectionOpen ? 'expand_more' : 'chevron_right'}</span>
          </div>

          {pageAnalyticsSectionOpen && (
            <>
              {/* Tab navigation */}
              <div className="flex gap-2 mb-6">
                {([['topPages', 'Top Pages'], ['products', 'Products'], ['landingPages', 'Landing Pages']] as const).map(([val, label]) => (
                  <button
                    key={val}
                    className={`px-4 py-1.5 text-[10px] font-medium rounded border-none transition-colors ${pageAnalyticsTab === val ? 'bg-primary text-on-primary font-bold' : 'bg-surface-container-low text-on-surface-variant'}`}
                    onClick={() => setPageAnalyticsTab(val)}
                  >
                    {label} <span className="ml-1 opacity-50">
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
                    <div className="space-y-4 mb-8">
                      {top10.slice(0, 5).map((p) => (
                        <div key={p.pathname} className="flex items-center gap-4 group">
                          <span className="text-[10px] font-medium text-on-surface-variant w-24 truncate" title={p.pathname}>
                            {p.pathname}
                          </span>
                          <div className="flex-1 h-3 bg-surface-container-low rounded-sm overflow-hidden">
                            <div
                              className="h-full bg-secondary"
                              style={{ width: `${Math.max((p.views / maxViews) * 100, 4)}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-bold text-on-surface-variant">{p.views}</span>
                        </div>
                      ))}
                    </div>
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-[11px]">
                        <thead>
                          <tr className="text-on-surface-variant border-b border-surface-container">
                            <th className="px-2 py-3 text-left font-bold uppercase tracking-tighter">Page</th>
                            <th className="px-2 py-3 text-left font-bold uppercase tracking-tighter">Title</th>
                            <th className="px-2 py-3 text-center font-bold uppercase tracking-tighter">Views</th>
                            <th className="px-2 py-3 text-center font-bold uppercase tracking-tighter">Visitors</th>
                            <th className="px-2 py-3 text-center font-bold uppercase tracking-tighter">Avg Time</th>
                            <th className="px-2 py-3 text-center font-bold uppercase tracking-tighter">Scroll</th>
                            <th className="px-2 py-3 text-left font-bold uppercase tracking-tighter">Organizations</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-container-low">
                          {pageStats.slice(0, 50).map(p => (
                            <tr key={p.pathname} className="hover:bg-surface-container-low/30">
                              <td className="px-2 py-3 text-on-surface-variant">{p.pathname}</td>
                              <td className="px-2 py-3 font-medium max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap">
                                {p.pageTitle || '—'}
                              </td>
                              <td className="px-2 py-3 text-center font-bold">{p.views}</td>
                              <td className="px-2 py-3 text-center">{p.uniqueVisitors}</td>
                              <td className="px-2 py-3 text-center whitespace-nowrap">
                                {p.avgActiveSeconds > 0 ? formatDuration(p.avgActiveSeconds) : '—'}
                              </td>
                              <td className="px-2 py-3 text-center font-bold" style={{ color: p.avgScrollDepth >= 75 ? '#2e7d32' : p.avgScrollDepth >= 50 ? '#f57f17' : '#888' }}>
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
                  <div className="hidden md:block bg-surface-container-lowest rounded-xl overflow-hidden">
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
        </section>
      )}

    </div>
  );
}
