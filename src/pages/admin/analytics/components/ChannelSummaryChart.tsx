import { useMemo } from 'react';
import { resolveTrafficChannel } from '../../../../services/behaviorAnalytics';
import type { AnalyticsEvent } from '../types';

export function ChannelSummaryChart({ events, activeChannel, onChannelClick }: { events: AnalyticsEvent[]; activeChannel?: string; onChannelClick?: (channel: string) => void }) {
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
        const isActive = activeChannel === ch.channel;
        const isDimmed = activeChannel && activeChannel !== 'all' && !isActive;
        return (
          <div
            key={ch.channel}
            className="flex-1 flex flex-col items-center justify-end gap-3 group cursor-pointer"
            style={{ height: '100%', opacity: isDimmed ? 0.35 : 1, transition: 'opacity 0.2s' }}
            onClick={() => onChannelClick?.(ch.channel)}
          >
            <div
              className={`w-full rounded-t-sm transition-colors relative ${isActive ? 'bg-secondary' : 'bg-secondary/20 group-hover:bg-secondary'}`}
              style={{ height: barH }}
            >
              <span className={`absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-bold transition-opacity whitespace-nowrap ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                {ch.count}
              </span>
            </div>
            <span className="text-[9px] font-bold uppercase tracking-tight text-on-surface-variant text-center whitespace-nowrap">
              {ch.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
