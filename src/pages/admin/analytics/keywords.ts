import { extractSearchQuery } from '../../../services/behaviorAnalytics';
import { SEARCH_ENGINE_NAMES } from './constants';
import type { AnalyticsEvent, KeywordEntry } from './types';

/** Get search query for an event — uses stored field, falls back to extracting from referrer for old records */
export function getSearchQuery(e: AnalyticsEvent): string | undefined {
  return e.searchQuery || extractSearchQuery(e.referrer || undefined) || undefined;
}

export function extractSearchEngineName(referrer: string | undefined | null): string | undefined {
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

export function aggregateKeywords(events: AnalyticsEvent[]): KeywordEntry[] {
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
