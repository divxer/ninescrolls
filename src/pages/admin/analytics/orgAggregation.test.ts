import { describe, it, expect } from 'vitest';
import { aggregateByOrg, computeOrgLifecycleStage } from './orgAggregation';
import type { AnalyticsEvent } from './types';

const ev = (p: Record<string, unknown>): AnalyticsEvent =>
  ({ id: 'e', timestamp: '2026-01-01T00:00:00.000Z', ...p } as unknown as AnalyticsEvent);

describe('computeOrgLifecycleStage', () => {
  it('returns intent when an RFQ was submitted', () => {
    expect(computeOrgLifecycleStage([ev({ eventType: 'rfq_submission' })], new Set(), 0, 0)).toBe('intent');
  });
  it('returns consideration for pdf downloads or contact forms', () => {
    expect(computeOrgLifecycleStage([ev({ eventType: 'contact_form' })], new Set(), 0, 0)).toBe('consideration');
    expect(computeOrgLifecycleStage([ev({})], new Set(), 2, 0)).toBe('consideration');
  });
  it('returns interest for product views or return visits, else awareness', () => {
    expect(computeOrgLifecycleStage([ev({})], new Set(['X']), 0, 0)).toBe('interest');
    expect(computeOrgLifecycleStage([ev({})], new Set(), 0, 1)).toBe('interest');
    expect(computeOrgLifecycleStage([ev({})], new Set(), 0, 0)).toBe('awareness');
  });
});

describe('aggregateByOrg', () => {
  it('excludes bot events entirely', () => {
    const records = aggregateByOrg([
      ev({ isBot: true, orgName: 'BotCorp', visitorId: 'b1' }),
      ev({ orgName: 'MIT', visitorId: 'v1', pathname: '/a' }),
    ]);
    expect(records).toHaveLength(1);
    expect(records[0].orgName).toBe('MIT');
  });

  it('groups events by org and counts events, pages, and products', () => {
    const records = aggregateByOrg([
      ev({ orgName: 'MIT', visitorId: 'v1', ip: '9.9.9.9', pathname: '/a', timestamp: '2026-01-01T00:00:01Z' }),
      ev({ orgName: 'MIT', visitorId: 'v1', ip: '9.9.9.9', pathname: '/b', productName: 'HY-20L', timestamp: '2026-01-01T00:00:02Z' }),
    ]);
    expect(records).toHaveLength(1);
    const mit = records[0];
    expect(mit.totalEvents).toBe(2);
    expect(mit.uniquePages).toBe(2);
    expect(mit.productsViewed).toEqual(['HY-20L']);
  });

  it('backfills tier B for IP-reliable education orgs', () => {
    const [rec] = aggregateByOrg([
      ev({ orgName: 'MIT', organizationType: 'education', visitorId: 'v1', ip: '9.9.9.9', pathname: '/a' }),
    ]);
    expect(rec.leadTier).toBe('B');
    expect(rec.organizationType).toBe('education');
  });

  it('keys events with no org/ip/visitor under "Unknown"', () => {
    const records = aggregateByOrg([
      ev({ pathname: '/a', visitorId: '' }),
    ]);
    expect(records).toHaveLength(1);
    expect(records[0].key).toBe('Unknown');
  });

  it('splits an ISP org into one record per visitor', () => {
    const records = aggregateByOrg([
      ev({ orgName: 'Comcast', aiOrganizationType: 'telecom_isp', aiConfidence: 0.9, visitorId: 'v1', ip: '1.2.3.4', city: 'Boston', region: 'MA', timestamp: '2026-01-01T00:00:01Z' }),
      ev({ orgName: 'Comcast', aiOrganizationType: 'telecom_isp', aiConfidence: 0.9, visitorId: 'v2', ip: '5.6.7.8', city: 'Austin', region: 'TX', timestamp: '2026-01-01T00:00:02Z' }),
    ]);
    expect(records).toHaveLength(2);
    expect(records.every(r => r.isISPVisitor)).toBe(true);
    // display name carries the ISP name + location instead of the bare key
    expect(records.some(r => r.orgName.includes('Comcast'))).toBe(true);
  });

  it('does not split a non-ISP org with multiple visitors', () => {
    const records = aggregateByOrg([
      ev({ orgName: 'MIT', organizationType: 'education', visitorId: 'v1', ip: '9.9.9.9', pathname: '/a' }),
      ev({ orgName: 'MIT', organizationType: 'education', visitorId: 'v2', ip: '9.9.9.8', pathname: '/b' }),
    ]);
    expect(records).toHaveLength(1);
    expect(records[0].totalEvents).toBe(2);
  });
});
