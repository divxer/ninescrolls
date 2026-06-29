import { useMemo } from 'react';
import { resolveTrafficChannel, type TrafficChannel } from '../../../../services/behaviorAnalytics';
import { getSearchQuery } from '../keywords';
import type { OrganizationRecord } from '../types';

const channelIcons: Record<string, string> = {
  paid_search: 'paid', organic_search: 'search', ai_referral: 'smart_toy',
  paid_social: 'share', organic_social: 'share', email: 'mail',
  referral: 'link', direct: 'monitor',
};
const channelLabels: Record<string, string> = {
  paid_search: 'Paid Search', organic_search: 'Organic Search', ai_referral: 'AI Referral',
  paid_social: 'Paid Social', organic_social: 'Organic Social', email: 'Email',
  referral: 'Referral', direct: 'Direct',
};

export function TrafficSourcesCard({ org }: { org: OrganizationRecord }) {
  const trafficSources = useMemo(() => {
    const sources = new Map<string, { count: number; channel: TrafficChannel; label: string }>();
    for (const e of org.events) {
      const channel = resolveTrafficChannel(e);
      const hostname = e.referrer
        ? (() => { try { return new URL(e.referrer).hostname; } catch { return e.referrer; } })()
        : '';
      const groupKey = hostname ? `${channel}::${hostname}` : channel;
      const displayLabel = hostname || (channelLabels[channel] || 'Other');
      const existing = sources.get(groupKey);
      if (existing) existing.count += 1;
      else sources.set(groupKey, { count: 1, channel, label: displayLabel });
    }
    return Array.from(sources.entries()).sort((a, b) => b[1].count - a[1].count);
  }, [org.events]);

  // Search keywords from this org's events
  const searchKeywords = useMemo(() => {
    const kws = new Map<string, { count: number; source: 'organic' | 'paid' }>();
    for (const e of org.events) {
      const keyword = getSearchQuery(e) || e.utmTerm;
      if (!keyword) continue;
      const key = keyword.toLowerCase().trim();
      const channel = resolveTrafficChannel(e);
      const source = channel === 'paid_search' ? 'paid' : 'organic';
      const existing = kws.get(key);
      if (existing) existing.count++;
      else kws.set(key, { count: 1, source });
    }
    return Array.from(kws.entries()).sort((a, b) => b[1].count - a[1].count);
  }, [org.events]);

  // Referrer URL for display
  const primaryReferrer = useMemo(() => {
    const ev = org.events.find((e) => {
      if (!e.referrer) return false;
      try {
        const host = new URL(e.referrer).hostname.toLowerCase();
        return !host.includes('ninescrolls') && !host.includes('localhost');
      } catch { return false; }
    });
    return ev?.referrer || null;
  }, [org.events]);

  if (trafficSources.length === 0) return null;

  return (
    <div className="bg-surface-container-lowest rounded-xl p-6 shadow-elevated" style={{ border: '1px solid rgba(196, 198, 207, 0.1)' }}>
      <h3 className="text-sm font-bold uppercase tracking-widest text-primary mb-6">Traffic Sources</h3>
      <div className="space-y-4">
        {trafficSources.map(([groupKey, { count, channel, label: displayLabel }]) => (
          <div key={groupKey} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-on-surface-variant">{channelIcons[channel] || 'language'}</span>
              <span className="font-medium">{channelLabels[channel] || displayLabel}</span>
            </div>
            <span className="font-bold">{count} Visit{count !== 1 ? 's' : ''}</span>
          </div>
        ))}
        {primaryReferrer && (
          <div className="mt-2 p-3 bg-surface rounded text-[10px] font-mono text-on-surface-variant break-all">
            Referrer: {primaryReferrer}
          </div>
        )}
        {searchKeywords.length > 0 && (
          <div className="mt-4 pt-4 border-t border-outline-variant/20">
            <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-3">Search Keywords</p>
            <div className="space-y-2">
              {searchKeywords.map(([keyword, { count, source }]) => (
                <div key={keyword} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="material-symbols-outlined text-sm text-on-surface-variant">{source === 'paid' ? 'paid' : 'search'}</span>
                    <span className="text-sm font-medium truncate" title={keyword}>{keyword}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${source === 'paid' ? 'bg-tertiary/10 text-tertiary' : 'bg-primary/10 text-primary'}`}>
                      {source}
                    </span>
                    <span className="text-[10px] font-bold text-on-surface-variant">{count}x</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
