import { useMemo, useState } from 'react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';
import type { Schema } from '../../../amplify/data/resource';
import { resolveTrafficChannel } from '../../services/behaviorAnalytics';

type AnalyticsEvent = Schema['AnalyticsEvent']['type'];

interface OrganizationRecord {
  maxBehaviorScore: number;
  isTargetCustomer: boolean;
}

interface TrendsSectionProps {
  filteredEvents: AnalyticsEvent[];
  organizations: OrganizationRecord[];
  isOpen: boolean;
  onToggle: () => void;
  onChannelClick?: (channel: string) => void;
  onScoreRangeClick?: (min: number, max: number) => void;
  activeChannelFilter?: string;
}

// Channel colors matching existing traffic source badge colors
const CHANNEL_COLORS: Record<string, string> = {
  paid_search: '#e91e63',
  organic_search: '#4caf50',
  ai_referral: '#4527a0',
  paid_social: '#ff9800',
  organic_social: '#2196f3',
  email: '#9c27b0',
  referral: '#009688',
  direct: '#9e9e9e',
};

const CHANNEL_LABELS: Record<string, string> = {
  paid_search: 'Paid Search',
  organic_search: 'Organic Search',
  ai_referral: 'AI Referral',
  paid_social: 'Paid Social',
  organic_social: 'Organic Social',
  email: 'Email',
  referral: 'Referral',
  direct: 'Direct',
};

// --- Aggregation functions ---

function aggregateDailyVisitors(events: AnalyticsEvent[]) {
  const dayMap = new Map<string, Set<string>>();
  for (const e of events) {
    if (e.eventType !== 'page_view') continue;
    const day = (e.timestamp ?? '').split('T')[0];
    if (!day) continue;
    const vid = (e as Record<string, unknown>).visitorId as string || e.ip || '';
    if (!dayMap.has(day)) dayMap.set(day, new Set());
    dayMap.get(day)!.add(vid);
  }
  return Array.from(dayMap.entries())
    .map(([date, visitors]) => ({ date, visitors: visitors.size }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function aggregateDailyTargets(events: AnalyticsEvent[]) {
  const dayMap = new Map<string, { all: Set<string>; target: Set<string> }>();
  for (const e of events) {
    if (e.eventType !== 'page_view') continue;
    const day = (e.timestamp ?? '').split('T')[0];
    if (!day) continue;
    const vid = (e as Record<string, unknown>).visitorId as string || e.ip || '';
    if (!dayMap.has(day)) dayMap.set(day, { all: new Set(), target: new Set() });
    const entry = dayMap.get(day)!;
    entry.all.add(vid);
    if (e.isTargetCustomer) entry.target.add(vid);
  }
  return Array.from(dayMap.entries())
    .map(([date, sets]) => ({ date, all: sets.all.size, target: sets.target.size }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function aggregateScoreDistribution(orgs: OrganizationRecord[]) {
  const buckets = Array.from({ length: 10 }, (_, i) => ({
    range: `${(i * 0.1).toFixed(1)}`,
    count: 0,
  }));
  for (const org of orgs) {
    const idx = Math.min(9, Math.floor((org.maxBehaviorScore || 0) * 10));
    buckets[idx].count++;
  }
  return buckets;
}

function aggregateDailyChannels(events: AnalyticsEvent[]) {
  const channels = ['paid_search', 'organic_search', 'ai_referral', 'paid_social', 'organic_social', 'email', 'referral', 'direct'];
  const dayMap = new Map<string, Record<string, Set<string>>>();

  for (const e of events) {
    if (e.eventType !== 'page_view') continue;
    const day = (e.timestamp ?? '').split('T')[0];
    if (!day) continue;
    const channel = resolveTrafficChannel(e);
    const vid = (e as Record<string, unknown>).visitorId as string || e.ip || '';
    if (!dayMap.has(day)) {
      const init: Record<string, Set<string>> = {};
      channels.forEach(c => init[c] = new Set());
      dayMap.set(day, init);
    }
    const entry = dayMap.get(day)!;
    if (entry[channel]) entry[channel].add(vid);
    else entry['direct'].add(vid);
  }

  return Array.from(dayMap.entries())
    .map(([date, channelSets]) => {
      const row: Record<string, unknown> = { date };
      channels.forEach(c => row[c] = channelSets[c]?.size || 0);
      return row;
    })
    .sort((a, b) => (a.date as string).localeCompare(b.date as string));
}

// Format date for axis labels (MM/DD)
function formatDate(dateStr: string) {
  const parts = dateStr.split('-');
  if (parts.length === 3) return `${parts[1]}/${parts[2]}`;
  return dateStr;
}

export function AdminTrendsSection({ filteredEvents, organizations, isOpen, onToggle, onChannelClick, onScoreRangeClick, activeChannelFilter }: TrendsSectionProps) {
  const [activeChart, setActiveChart] = useState<'visitors' | 'targets' | 'scores' | 'channels'>('visitors');

  const dailyVisitors = useMemo(() => aggregateDailyVisitors(filteredEvents), [filteredEvents]);
  const dailyTargets = useMemo(() => aggregateDailyTargets(filteredEvents), [filteredEvents]);
  const scoreDistribution = useMemo(() => aggregateScoreDistribution(organizations), [organizations]);
  const dailyChannels = useMemo(() => aggregateDailyChannels(filteredEvents), [filteredEvents]);

  return (
    <section className="bg-surface-container-lowest p-8 rounded-xl border border-outline-variant/10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div className="flex items-center gap-2 cursor-pointer select-none" onClick={onToggle}>
          <span className="material-symbols-outlined text-on-surface-variant">trending_up</span>
          <h4 className="font-headline font-bold">Trends</h4>
          <span className="material-symbols-outlined text-on-surface-variant text-sm ml-1">{isOpen ? 'expand_more' : 'chevron_right'}</span>
        </div>
        {isOpen && (
          <div className="flex bg-surface-container-low p-1 rounded-lg">
            {([
              ['visitors', 'Daily Visitors'],
              ['targets', 'Target Customers'],
              ['scores', 'Score Distribution'],
              ['channels', 'Traffic Channels'],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                className={`px-4 py-1.5 text-[10px] font-medium rounded border-none transition-colors ${activeChart === key ? 'bg-primary text-on-primary font-bold' : 'text-on-surface-variant'}`}
                onClick={() => setActiveChart(key)}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {isOpen && (
        <>
          <div>
            {activeChart === 'visitors' && (
              <>
                <div className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-4">Daily Unique Visitors</div>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={dailyVisitors}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e2e2" />
                    <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip labelFormatter={(v) => `Date: ${v}`} contentStyle={{ background: '#fff', border: 'none', boxShadow: '0px 10px 30px rgba(2,36,72,0.08)', borderRadius: '8px' }} />
                    <Line type="monotone" dataKey="visitors" stroke="#0058be" strokeWidth={2} dot={false} name="Visitors" />
                  </LineChart>
                </ResponsiveContainer>
              </>
            )}

            {activeChart === 'targets' && (
              <>
                <div className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-4">Daily Target Customers vs All Visitors</div>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={dailyTargets}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e2e2" />
                    <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip labelFormatter={(v) => `Date: ${v}`} contentStyle={{ background: '#fff', border: 'none', boxShadow: '0px 10px 30px rgba(2,36,72,0.08)', borderRadius: '8px' }} />
                    <Legend />
                    <Area type="monotone" dataKey="all" stroke="#0058be" fill="#d5e3ff" name="All Visitors" />
                    <Area type="monotone" dataKey="target" stroke="#2e7d32" fill="#c8e6c9" name="Target Customers" />
                  </AreaChart>
                </ResponsiveContainer>
              </>
            )}

            {activeChart === 'scores' && (
              <>
                <div className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-4">Behavior Score Distribution</div>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={scoreDistribution}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e2e2" />
                    <XAxis dataKey="range" tick={{ fontSize: 11 }} label={{ value: 'Score', position: 'insideBottom', offset: -5, fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: '#fff', border: 'none', boxShadow: '0px 10px 30px rgba(2,36,72,0.08)', borderRadius: '8px' }} />
                    <Bar
                      dataKey="count"
                      fill="#0058be"
                      radius={[4, 4, 0, 0]}
                      name="Organizations"
                      cursor={onScoreRangeClick ? 'pointer' : undefined}
                      onClick={(data) => {
                        const d = data as unknown as Record<string, unknown>;
                        if (onScoreRangeClick && d?.range != null) {
                          const min = parseFloat(String(d.range));
                          onScoreRangeClick(min, Math.min(1.0, min + 0.1));
                        }
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </>
            )}

            {activeChart === 'channels' && (
              <>
                <div className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-4">Traffic Channels Over Time</div>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={dailyChannels}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e2e2" />
                    <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip labelFormatter={(v) => `Date: ${v}`} contentStyle={{ background: '#fff', border: 'none', boxShadow: '0px 10px 30px rgba(2,36,72,0.08)', borderRadius: '8px' }} />
                    <Legend />
                    {Object.entries(CHANNEL_COLORS).map(([channel, color]) => (
                      <Area
                        key={channel}
                        type="monotone"
                        dataKey={channel}
                        stackId="1"
                        stroke={color}
                        fill={color}
                        fillOpacity={
                          activeChannelFilter && activeChannelFilter !== 'all'
                            ? (activeChannelFilter === channel ? 0.9 : 0.15)
                            : 0.6
                        }
                        name={CHANNEL_LABELS[channel] || channel}
                        cursor={onChannelClick ? 'pointer' : undefined}
                        onClick={() => onChannelClick?.(channel)}
                      />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              </>
            )}
          </div>
        </>
      )}
    </section>
  );
}
