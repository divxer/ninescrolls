import { describe, it, expect } from 'vitest';
import { aggregateKeywords, extractSearchEngineName, getSearchQuery } from './keywords';
import type { AnalyticsEvent } from './types';

const ev = (p: Record<string, unknown>): AnalyticsEvent =>
  ({ id: 'e', timestamp: '2026-01-01T00:00:00.000Z', ...p } as unknown as AnalyticsEvent);

describe('extractSearchEngineName', () => {
  it('recognizes engines by hostname pattern', () => {
    expect(extractSearchEngineName('https://www.google.com/search?q=x')).toBe('Google');
    expect(extractSearchEngineName('https://bing.com/?q=x')).toBe('Bing');
    expect(extractSearchEngineName('https://example.com')).toBeUndefined();
    expect(extractSearchEngineName(undefined)).toBeUndefined();
    expect(extractSearchEngineName('not a url')).toBeUndefined();
  });
});

describe('getSearchQuery', () => {
  it('prefers the stored searchQuery field', () => {
    expect(getSearchQuery(ev({ searchQuery: 'plasma cleaner' }))).toBe('plasma cleaner');
  });
  it('falls back to extracting from the referrer', () => {
    expect(getSearchQuery(ev({ referrer: 'https://www.google.com/search?q=rie+etcher' })))
      .toBe('rie etcher');
  });
});

describe('aggregateKeywords', () => {
  it('splits organic, paid, and internal sources into distinct entries', () => {
    const result = aggregateKeywords([
      ev({ searchQuery: 'etcher', orgName: 'MIT' }),
      ev({ utmTerm: 'etcher' }),
      ev({ eventType: 'search', properties: JSON.stringify({ searchTerm: 'etcher' }) }),
    ]);
    const sources = result.map(r => r.source).sort();
    expect(sources).toEqual(['internal', 'organic', 'paid']);
    expect(result.every(r => r.keyword === 'etcher')).toBe(true);
  });

  it('counts repeats case-insensitively and dedupes organizations', () => {
    const result = aggregateKeywords([
      ev({ searchQuery: 'Plasma', orgName: 'MIT' }),
      ev({ searchQuery: 'plasma', orgName: 'MIT' }),
      ev({ searchQuery: 'PLASMA', orgName: 'Stanford' }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].count).toBe(3);
    expect(result[0].organizations.sort()).toEqual(['MIT', 'Stanford']);
  });

  it('sorts by descending count', () => {
    const result = aggregateKeywords([
      ev({ searchQuery: 'rare' }),
      ev({ searchQuery: 'common' }),
      ev({ searchQuery: 'common' }),
    ]);
    expect(result[0].keyword).toBe('common');
    expect(result[0].count).toBe(2);
  });

  it('tags organic entries with the search engine', () => {
    const [entry] = aggregateKeywords([
      ev({ searchQuery: 'etcher', referrer: 'https://www.google.com/search?q=etcher' }),
    ]);
    expect(entry.searchEngine).toBe('Google');
  });
});
