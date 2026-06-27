import { describe, it, expect } from 'vitest';
import {
  extractSearchQuery,
  hasCampaignAttribution,
  formatCampaignAttribution,
  normalizeUtmValue,
  isKnownOrganization,
  matchesUtmFilter,
  summarizeUtmTraffic,
  type UtmEvent,
} from './behaviorAnalytics';

describe('extractSearchQuery', () => {
  it('extracts query from Google referrer', () => {
    expect(extractSearchQuery(
      'https://www.google.com/search?q=non+uniform+etch+rate&sca_esv=abc'
    )).toBe('non uniform etch rate');
  });

  it('extracts query from Google with URL-encoded characters', () => {
    expect(extractSearchQuery(
      'https://www.google.com/search?q=%E7%AD%89%E7%A6%BB%E5%AD%90%E4%BD%93%E8%9A%80%E5%88%BB'
    )).toBe('等离子体蚀刻');
  });

  it('extracts query from Bing referrer', () => {
    expect(extractSearchQuery(
      'https://www.bing.com/search?q=plasma+etch+uniformity'
    )).toBe('plasma etch uniformity');
  });

  it('extracts query from Yahoo referrer (uses p= param)', () => {
    expect(extractSearchQuery(
      'https://search.yahoo.com/search?p=semiconductor+etching'
    )).toBe('semiconductor etching');
  });

  it('extracts query from Baidu referrer (uses wd= param)', () => {
    expect(extractSearchQuery(
      'https://www.baidu.com/s?wd=%E5%88%BB%E8%9A%80%E5%9D%87%E5%8C%80%E6%80%A7'
    )).toBe('刻蚀均匀性');
  });

  it('extracts query from Baidu referrer (uses word= param)', () => {
    expect(extractSearchQuery(
      'https://www.baidu.com/s?word=test+query'
    )).toBe('test query');
  });

  it('extracts query from Yandex referrer (uses text= param)', () => {
    expect(extractSearchQuery(
      'https://yandex.ru/search/?text=plasma+etching'
    )).toBe('plasma etching');
  });

  it('extracts query from DuckDuckGo referrer', () => {
    expect(extractSearchQuery(
      'https://duckduckgo.com/?q=gas+flow+temperature'
    )).toBe('gas flow temperature');
  });

  it('extracts query from Naver referrer (uses query= param)', () => {
    expect(extractSearchQuery(
      'https://search.naver.com/search.naver?query=etch+chamber'
    )).toBe('etch chamber');
  });

  it('returns undefined for non-search-engine referrer', () => {
    expect(extractSearchQuery('https://www.example.com/page?q=something')).toBeUndefined();
  });

  it('returns undefined for undefined input', () => {
    expect(extractSearchQuery(undefined)).toBeUndefined();
  });

  it('returns undefined for empty string', () => {
    expect(extractSearchQuery('')).toBeUndefined();
  });

  it('returns undefined for search engine referrer without query param', () => {
    expect(extractSearchQuery('https://www.google.com/')).toBeUndefined();
  });

  it('returns undefined for invalid URL', () => {
    expect(extractSearchQuery('not-a-url')).toBeUndefined();
  });

  it('handles Google subdomain correctly (e.g. news.google.com)', () => {
    expect(extractSearchQuery(
      'https://news.google.com/search?q=semiconductor+news'
    )).toBe('semiconductor news');
  });
});

describe('hasCampaignAttribution', () => {
  it('is true for a direct QR scan with no referrer (utm only)', () => {
    // Regression: direct QR/print traffic has no referrer; the badge must
    // still show. Previously the badge was gated behind referrer presence.
    expect(hasCampaignAttribution({
      utmSource: 'mrs',
      utmMedium: 'webinar_sponsor',
      utmCampaign: 'mxenes_202610',
      utmContent: 'qr_video',
    })).toBe(true);
  });

  it('is true when only one UTM field is present', () => {
    expect(hasCampaignAttribution({ utmSource: 'mrs' })).toBe(true);
    expect(hasCampaignAttribution({ utmCampaign: 'mxenes_202610' })).toBe(true);
    expect(hasCampaignAttribution({ utmContent: 'qr_video' })).toBe(true);
  });

  it('is false when no UTM fields are present', () => {
    expect(hasCampaignAttribution({})).toBe(false);
    expect(hasCampaignAttribution({ utmSource: null, utmMedium: undefined })).toBe(false);
    expect(hasCampaignAttribution({ utmSource: '' })).toBe(false);
  });
});

describe('formatCampaignAttribution', () => {
  it('joins source · campaign · content, skipping empties', () => {
    expect(formatCampaignAttribution({
      utmSource: 'mrs',
      utmCampaign: 'mxenes_202610',
      utmContent: 'qr_video',
    })).toBe('mrs · mxenes_202610 · qr_video');
  });

  it('omits missing parts', () => {
    expect(formatCampaignAttribution({ utmSource: 'mrs' })).toBe('mrs');
    expect(formatCampaignAttribution({ utmSource: 'mrs', utmContent: 'qr_brochure' }))
      .toBe('mrs · qr_brochure');
  });
});

describe('normalizeUtmValue', () => {
  it('trims surrounding whitespace', () => {
    expect(normalizeUtmValue('  mrs  ')).toBe('mrs');
  });
  it('treats null/undefined/empty/whitespace as absent (undefined)', () => {
    expect(normalizeUtmValue(null)).toBeUndefined();
    expect(normalizeUtmValue(undefined)).toBeUndefined();
    expect(normalizeUtmValue('')).toBeUndefined();
    expect(normalizeUtmValue('   ')).toBeUndefined();
  });
});

describe('isKnownOrganization', () => {
  it('is true for a real org with a name', () => {
    expect(isKnownOrganization({ orgName: 'MIT', organizationType: 'education' })).toBe(true);
  });
  it('is false for ISP/telecom/unknown org types', () => {
    expect(isKnownOrganization({ orgName: 'Comcast', organizationType: 'telecom_isp' })).toBe(false);
    expect(isKnownOrganization({ orgName: 'Verizon', organizationType: 'isp' })).toBe(false);
    expect(isKnownOrganization({ orgName: 'Some ISP', organizationType: 'unknown' })).toBe(false);
  });
  it('is false when orgName is missing/blank', () => {
    expect(isKnownOrganization({ orgName: '', organizationType: 'education' })).toBe(false);
    expect(isKnownOrganization({ organizationType: 'education' })).toBe(false);
  });
});

describe('matchesUtmFilter', () => {
  const mrs = { utmSource: 'mrs', utmCampaign: 'mxenes_202610', utmContent: 'qr_video' };

  it('matches when normalized field equals normalized filter value', () => {
    expect(matchesUtmFilter({ utmSource: ' mrs ' }, { source: 'mrs' })).toBe(true);
    expect(matchesUtmFilter({ utmSource: 'mrs' }, { source: ' mrs ' })).toBe(true); // filter value also normalized
    expect(matchesUtmFilter(mrs, { source: 'mrs', content: 'qr_video' })).toBe(true);
  });

  it('does not match a different value', () => {
    expect(matchesUtmFilter(mrs, { source: 'linkedin' })).toBe(false);
  });

  it('null filter matches an absent field, not a present one', () => {
    expect(matchesUtmFilter({ utmSource: 'mrs' }, { content: null })).toBe(true);
    expect(matchesUtmFilter({ utmSource: 'mrs', utmContent: '   ' }, { content: null })).toBe(true);
    expect(matchesUtmFilter(mrs, { content: null })).toBe(false);
  });

  it('ignores omitted keys; multiple keys AND together', () => {
    expect(matchesUtmFilter(mrs, {})).toBe(true);
    expect(matchesUtmFilter(mrs, { source: 'mrs', campaign: 'other' })).toBe(false);
  });
});

const pv = (o: Partial<UtmEvent>): UtmEvent => ({ eventType: 'page_view', ...o });

describe('summarizeUtmTraffic', () => {
  it('counts only page_view events for Visits', () => {
    const events: UtmEvent[] = [
      pv({ utmSource: 'mrs', visitorId: 'v1' }),
      { eventType: 'pdf_download', utmSource: 'mrs', visitorId: 'v1' }, // excluded
    ];
    expect(summarizeUtmTraffic(events, 'source', {})).toEqual([
      { value: 'mrs', isNotSet: false, visits: 1, visitors: 1, knownOrganizations: 0 },
    ]);
  });

  it('excludes page_views with no UTM at all (organic is not in the table)', () => {
    const events = [
      pv({ visitorId: 'v1' }),                                // organic -> excluded
      pv({ utmCampaign: 'mxenes_202610', visitorId: 'v2' }),  // has UTM, no source -> (not set)
    ];
    expect(summarizeUtmTraffic(events, 'source', {})).toEqual([
      { value: '(not set)', isNotSet: true, visits: 1, visitors: 1, knownOrganizations: 0 },
    ]);
  });

  it('groups by dimension and collapses whitespace variants', () => {
    const events = [
      pv({ utmSource: 'mrs', visitorId: 'v1' }),
      pv({ utmSource: ' mrs ', visitorId: 'v2' }),
      pv({ utmSource: 'linkedin', visitorId: 'v3' }),
    ];
    const rows = summarizeUtmTraffic(events, 'source', {});
    expect(rows[0]).toEqual({ value: 'mrs', isNotSet: false, visits: 2, visitors: 2, knownOrganizations: 0 });
    expect(rows.find(r => r.value === 'linkedin')!.visits).toBe(1);
  });

  it('counts distinct visitors and known organizations (ISP excluded from org count)', () => {
    const events = [
      pv({ utmSource: 'mrs', visitorId: 'v1', orgName: 'MIT', organizationType: 'education' }),
      pv({ utmSource: 'mrs', visitorId: 'v1', orgName: 'MIT', organizationType: 'education' }),
      pv({ utmSource: 'mrs', visitorId: 'v2', orgName: 'Comcast', organizationType: 'telecom_isp' }),
    ];
    expect(summarizeUtmTraffic(events, 'source', {})).toEqual([
      { value: 'mrs', isNotSet: false, visits: 3, visitors: 2, knownOrganizations: 1 },
    ]);
  });

  it('buckets missing dimension as (not set)', () => {
    const events = [
      pv({ utmSource: 'mrs', visitorId: 'v1' }),                          // no content
      pv({ utmSource: 'mrs', visitorId: 'v2', utmContent: 'qr_video' }),
    ];
    const notSet = summarizeUtmTraffic(events, 'content', {}).find(r => r.isNotSet)!;
    expect(notSet.value).toBe('(not set)');
    expect(notSet.visits).toBe(1);
  });

  it('applies filter before grouping (mrs -> content split shows only MRS)', () => {
    const events = [
      pv({ utmSource: 'mrs', visitorId: 'v1', utmContent: 'qr_video' }),
      pv({ utmSource: 'mrs', visitorId: 'v2', utmContent: 'qr_brochure' }),
      pv({ utmSource: 'linkedin', visitorId: 'v3', utmContent: 'qr_video' }),
    ];
    const rows = summarizeUtmTraffic(events, 'content', { source: 'mrs' });
    expect(rows.map(r => r.value).sort()).toEqual(['qr_brochure', 'qr_video']);
    expect(rows.every(r => r.visits === 1)).toBe(true);
  });

  it('counts an event with no visitorId toward visits but not visitors', () => {
    const events = [pv({ utmSource: 'mrs' })]; // no visitorId
    expect(summarizeUtmTraffic(events, 'source', {})).toEqual([
      { value: 'mrs', isNotSet: false, visits: 1, visitors: 0, knownOrganizations: 0 },
    ]);
  });

  it('dedupes known organizations by name across different visitors', () => {
    const events = [
      pv({ utmSource: 'mrs', visitorId: 'v1', orgName: 'MIT', organizationType: 'education' }),
      pv({ utmSource: 'mrs', visitorId: 'v2', orgName: 'MIT', organizationType: 'education' }),
    ];
    expect(summarizeUtmTraffic(events, 'source', {})).toEqual([
      { value: 'mrs', isNotSet: false, visits: 2, visitors: 2, knownOrganizations: 1 },
    ]);
  });

  it('sorts by visits desc and returns [] for empty input', () => {
    expect(summarizeUtmTraffic([], 'source', {})).toEqual([]);
    const events = [
      pv({ utmSource: 'a', visitorId: 'v1' }),
      pv({ utmSource: 'b', visitorId: 'v2' }),
      pv({ utmSource: 'b', visitorId: 'v3' }),
    ];
    expect(summarizeUtmTraffic(events, 'source', {}).map(r => r.value)).toEqual(['b', 'a']);
  });
});
