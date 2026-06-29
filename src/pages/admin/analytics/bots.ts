import { KNOWN_BOT_SIGNATURES } from './constants';
import type { AnalyticsEvent, BotRecord } from './types';

export function detectBotName(ua: string): string {
  if (!ua) return 'Unknown Bot';
  const lower = ua.toLowerCase();
  // 1. Known signatures (longest-match-first via list order)
  for (const sig of KNOWN_BOT_SIGNATURES) {
    if (lower.includes(sig.toLowerCase())) return sig;
  }
  // 2. "compatible; <Name>" pattern — covers most well-formed crawler UAs
  const compat = ua.match(/compatible;\s*([A-Za-z][A-Za-z0-9_.-]*)/);
  if (compat && compat[1].length >= 3) return compat[1];
  // 3. Generic keyword glued or standalone (bot/spider/crawl/...)
  const glued = ua.match(/\b([A-Za-z][A-Za-z0-9_-]*(?:bot|spider|crawl|slurp|archiver|fetcher|scanner)[A-Za-z0-9_-]*)\b/i);
  if (glued) return glued[1];
  const standalone = ua.match(/\b(bot|spider|crawler|fetcher|scanner)\b/i);
  if (standalone) return standalone[1];
  // 4. Last resort: truncated UA so distinct unknowns don't collide
  return ua.slice(0, 40);
}

export function aggregateBots(events: AnalyticsEvent[]): BotRecord[] {
  const groups = new Map<string, { ua: string; eventCount: number; visitors: Set<string>; pages: Set<string>; lastSeen: number }>();
  for (const e of events) {
    if (!e.isBot) continue;
    const ua = e.userAgent || '';
    const name = detectBotName(ua);
    let g = groups.get(name);
    if (!g) {
      g = { ua, eventCount: 0, visitors: new Set(), pages: new Set(), lastSeen: 0 };
      groups.set(name, g);
    }
    g.eventCount++;
    const vid = (e as Record<string, unknown>).visitorId as string;
    if (vid) g.visitors.add(vid);
    if (e.pathname) g.pages.add(e.pathname);
    const t = new Date(e.timestamp).getTime();
    if (t > g.lastSeen) g.lastSeen = t;
  }
  const records: BotRecord[] = [];
  for (const [botName, g] of groups) {
    records.push({
      botName,
      userAgentSample: g.ua,
      events: g.eventCount,
      uniqueVisitors: g.visitors.size,
      uniquePages: g.pages.size,
      lastSeen: g.lastSeen ? new Date(g.lastSeen).toISOString() : '',
    });
  }
  records.sort((a, b) => b.events - a.events);
  return records;
}
