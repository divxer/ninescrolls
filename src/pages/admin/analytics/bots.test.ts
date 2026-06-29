import { describe, it, expect } from 'vitest';
import { detectBotName, aggregateBots } from './bots';
import type { AnalyticsEvent } from './types';

const ev = (p: Record<string, unknown>): AnalyticsEvent =>
  ({ id: 'e', timestamp: '2026-01-01T00:00:00.000Z', ...p } as unknown as AnalyticsEvent);

describe('detectBotName', () => {
  it('matches known signatures, longest-first', () => {
    expect(detectBotName('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)')).toBe('Googlebot');
    expect(detectBotName('Sogou web spider/4.0')).toBe('Sogou web spider');
    expect(detectBotName('GPTBot/1.0')).toBe('GPTBot');
  });

  it('falls back to the compatible; pattern, then generic keywords', () => {
    expect(detectBotName('Mozilla/5.0 (compatible; SomeNewCrawler/1.0)')).toBe('SomeNewCrawler');
    expect(detectBotName('my-custom-spider/2')).toBe('my-custom-spider');
  });

  it('returns a stable label for empty UAs', () => {
    expect(detectBotName('')).toBe('Unknown Bot');
  });
});

describe('aggregateBots', () => {
  it('only counts bot events and groups them by detected name', () => {
    const records = aggregateBots([
      ev({ isBot: true, userAgent: 'Googlebot/2.1', visitorId: 'b1', pathname: '/a' }),
      ev({ isBot: true, userAgent: 'Googlebot/2.1', visitorId: 'b1', pathname: '/b' }),
      ev({ isBot: false, userAgent: 'human', visitorId: 'h1', pathname: '/a' }),
    ]);
    expect(records).toHaveLength(1);
    expect(records[0].botName).toBe('Googlebot');
    expect(records[0].events).toBe(2);
    expect(records[0].uniqueVisitors).toBe(1);
    expect(records[0].uniquePages).toBe(2);
  });

  it('sorts bots by descending event count', () => {
    const records = aggregateBots([
      ev({ isBot: true, userAgent: 'GPTBot', visitorId: 'b1' }),
      ev({ isBot: true, userAgent: 'Googlebot', visitorId: 'b2' }),
      ev({ isBot: true, userAgent: 'Googlebot', visitorId: 'b3' }),
    ]);
    expect(records[0].botName).toBe('Googlebot');
    expect(records[0].events).toBe(2);
    expect(records[1].botName).toBe('GPTBot');
  });
});
