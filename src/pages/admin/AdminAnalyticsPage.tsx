import { useState, useEffect, useMemo } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';

const client = generateClient<Schema>();

type AnalyticsEvent = Schema['AnalyticsEvent']['type'];

const EVENT_TYPES = [
  { value: 'all', label: 'All Events' },
  { value: 'page_view', label: 'Page Views' },
  { value: 'product_view', label: 'Product Views' },
  { value: 'contact_form', label: 'Contact Forms' },
  { value: 'pdf_download', label: 'PDF Downloads' },
  { value: 'purchase', label: 'Purchases' },
  { value: 'target_customer', label: 'Target Customers' },
  { value: 'add_to_cart', label: 'Add to Cart' },
  { value: 'search', label: 'Searches' },
  { value: 'other', label: 'Other' },
];

const LEAD_TIERS = [
  { value: 'all', label: 'All Tiers' },
  { value: 'A', label: 'Tier A' },
  { value: 'B', label: 'Tier B' },
  { value: 'C', label: 'Tier C' },
];

export function AdminAnalyticsPage() {
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [eventTypeFilter, setEventTypeFilter] = useState('all');
  const [leadTierFilter, setLeadTierFilter] = useState('all');
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    loadEvents();
  }, [eventTypeFilter, leadTierFilter]);

  async function loadEvents(token?: string) {
    if (token) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setEvents([]);
    }
    setError('');

    try {
      let result;

      if (leadTierFilter !== 'all') {
        result = await client.models.AnalyticsEvent
          .listAnalyticsEventByLeadTierAndTimestamp(
            { leadTier: leadTierFilter },
            {
              authMode: 'userPool',
              sortDirection: 'DESC',
              limit: 50,
              nextToken: token || undefined,
            }
          );
      } else if (eventTypeFilter !== 'all') {
        result = await client.models.AnalyticsEvent
          .listAnalyticsEventByEventTypeAndTimestamp(
            { eventType: eventTypeFilter },
            {
              authMode: 'userPool',
              sortDirection: 'DESC',
              limit: 50,
              nextToken: token || undefined,
            }
          );
      } else {
        result = await client.models.AnalyticsEvent.list({
          authMode: 'userPool',
          limit: 50,
          nextToken: token || undefined,
        });
      }

      const newEvents = (result.data || []) as AnalyticsEvent[];
      if (token) {
        setEvents((prev) => [...prev, ...newEvents]);
      } else {
        setEvents(newEvents);
      }
      setNextToken(result.nextToken || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load events');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  // Sort events by timestamp descending (client-side for non-index queries)
  const sortedEvents = useMemo(() => {
    return [...events].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [events]);

  // Basic stats
  const stats = useMemo(() => {
    const total = events.length;
    const targetCustomers = events.filter((e) => e.isTargetCustomer).length;
    const tierA = events.filter((e) => e.leadTier === 'A').length;
    const tierB = events.filter((e) => e.leadTier === 'B').length;
    const tierC = events.filter((e) => e.leadTier === 'C').length;
    const uniqueOrgs = new Set(events.filter((e) => e.orgName).map((e) => e.orgName)).size;
    return { total, targetCustomers, tierA, tierB, tierC, uniqueOrgs };
  }, [events]);

  function formatTimestamp(ts: string) {
    return new Date(ts).toLocaleString();
  }

  if (loading) {
    return <div className="admin-loading">Loading analytics...</div>;
  }

  return (
    <div className="admin-analytics">
      <div className="admin-list-header">
        <h1>Analytics Events ({stats.total})</h1>
      </div>

      {/* Stats cards */}
      <div className="analytics-stats-grid">
        <div className="analytics-stat-card">
          <div className="analytics-stat-value">{stats.total}</div>
          <div className="analytics-stat-label">Total Events</div>
        </div>
        <div className="analytics-stat-card analytics-stat-highlight">
          <div className="analytics-stat-value">{stats.targetCustomers}</div>
          <div className="analytics-stat-label">Target Customers</div>
        </div>
        <div className="analytics-stat-card">
          <div className="analytics-stat-value">{stats.uniqueOrgs}</div>
          <div className="analytics-stat-label">Unique Orgs</div>
        </div>
        <div className="analytics-stat-card analytics-stat-tier-a">
          <div className="analytics-stat-value">{stats.tierA}</div>
          <div className="analytics-stat-label">Tier A</div>
        </div>
        <div className="analytics-stat-card analytics-stat-tier-b">
          <div className="analytics-stat-value">{stats.tierB}</div>
          <div className="analytics-stat-label">Tier B</div>
        </div>
        <div className="analytics-stat-card analytics-stat-tier-c">
          <div className="analytics-stat-value">{stats.tierC}</div>
          <div className="analytics-stat-label">Tier C</div>
        </div>
      </div>

      {/* Filters */}
      <div className="admin-list-filters">
        <select
          value={eventTypeFilter}
          onChange={(e) => { setEventTypeFilter(e.target.value); setLeadTierFilter('all'); }}
          className="admin-filter-select"
        >
          {EVENT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <select
          value={leadTierFilter}
          onChange={(e) => { setLeadTierFilter(e.target.value); setEventTypeFilter('all'); }}
          className="admin-filter-select"
        >
          {LEAD_TIERS.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      {error && <div className="admin-error">{error}</div>}

      {/* Events table */}
      <table className="admin-table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Event</th>
            <th>Type</th>
            <th>Path</th>
            <th>IP / Org</th>
            <th>Lead Tier</th>
            <th>Confidence</th>
          </tr>
        </thead>
        <tbody>
          {sortedEvents.map((event) => (
            <tr key={event.id} className={event.isTargetCustomer ? 'analytics-target-row' : ''}>
              <td className="analytics-timestamp">{formatTimestamp(event.timestamp)}</td>
              <td>{event.eventName}</td>
              <td>
                <span className={`analytics-badge analytics-badge-${event.eventType}`}>
                  {event.eventType}
                </span>
              </td>
              <td className="analytics-path">{event.pathname || '-'}</td>
              <td>
                <div>{event.org || event.isp || '-'}</div>
                {event.orgName && event.orgName !== event.org && (
                  <div className="analytics-org-name">{event.orgName}</div>
                )}
                {event.country && (
                  <div className="analytics-geo">{event.city}{event.city && event.country ? ', ' : ''}{event.country}</div>
                )}
              </td>
              <td>
                {event.leadTier ? (
                  <span className={`analytics-tier analytics-tier-${event.leadTier}`}>
                    {event.leadTier}
                  </span>
                ) : '-'}
              </td>
              <td>
                {event.finalConfidence != null ? (
                  <span>{(event.finalConfidence * 100).toFixed(0)}%</span>
                ) : '-'}
              </td>
            </tr>
          ))}
          {sortedEvents.length === 0 && (
            <tr>
              <td colSpan={7} className="admin-no-results">
                No events found.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {nextToken && (
        <div className="analytics-load-more">
          <button
            onClick={() => loadEvents(nextToken)}
            disabled={loadingMore}
            className="admin-btn-primary"
          >
            {loadingMore ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}
    </div>
  );
}
