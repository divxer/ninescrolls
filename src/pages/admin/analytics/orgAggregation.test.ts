import { describe, it, expect } from 'vitest';
import { aggregateByOrg, computeOrgLifecycleStage, orgOverrideKey, resolveOrgOverride } from './orgAggregation';
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

  it('splits security-proxy visitors by visitorId even when historical events carry an enterprise AI type', () => {
    // Historical shape: pre-fix events were AI-classified 'enterprise' with the
    // vendor's org name — no corporate_proxy type anywhere on the events.
    const records = aggregateByOrg([
      ev({ orgName: 'Menlo Security, Inc.', org: 'AS399629 Menlo Security, Inc.',
           organizationType: 'enterprise', aiOrganizationType: 'enterprise', aiConfidence: 0.95,
           visitorId: 'vis-tw', ip: '57.140.1.2', city: 'Taipei', pathname: '/products/icp-etcher' }),
      ev({ orgName: 'Menlo Security, Inc.', org: 'AS399629 Menlo Security, Inc.',
           organizationType: 'enterprise', aiOrganizationType: 'enterprise', aiConfidence: 0.95,
           visitorId: 'vis-us', ip: '57.140.9.9', city: 'Needham', pathname: '/insights/ald' }),
    ]);
    expect(records).toHaveLength(2);
    for (const r of records) {
      expect(r.isISPVisitor).toBe(true);
      expect(r.organizationType).toBe('corporate_proxy'); // vendor's AI type suppressed
      expect(r.leadTier).toBeNull(); // no tier backfill from the vendor's 'enterprise' type
      expect(r.orgName).toMatch(/^Menlo Security, Inc\. · /); // per-visitor display name
    }
    // Stable override key (PR #341) applies: keyed by visitorId, not display name
    const keys = records.map(r => orgOverrideKey(r)).sort();
    expect(keys).toEqual(['vis-tw', 'vis-us']);
  });

  it('splits proxy visitors tagged corporate_proxy by the new pipeline', () => {
    const records = aggregateByOrg([
      ev({ orgName: 'Zscaler, Inc.', organizationType: 'corporate_proxy',
           visitorId: 'z1', ip: '165.225.1.1', city: 'Frankfurt', pathname: '/a' }),
      ev({ orgName: 'Zscaler, Inc.', organizationType: 'corporate_proxy',
           visitorId: 'z2', ip: '165.225.2.2', city: 'Tokyo', pathname: '/b' }),
    ]);
    expect(records).toHaveLength(2);
    expect(records.every(r => r.isISPVisitor)).toBe(true);
  });

  it('lets behavior-based anonymous-high-intent fire for proxy visitors despite the enterprise AI event', () => {
    const [rec] = aggregateByOrg([
      ev({ orgName: 'Menlo Security, Inc.', organizationType: 'enterprise',
           aiOrganizationType: 'enterprise', aiConfidence: 0.95,
           visitorId: 'vis-tw', ip: '57.140.1.2', city: 'Taipei',
           pathname: '/products/icp-etcher', behaviorScore: 0.4, returnVisits: 1 }),
    ]);
    // Pre-fix: aiIdentifiedRealOrg (enterprise) blocked this flag entirely.
    expect(rec.isAnonymousHighIntent).toBe(true);
  });

  it('does not adopt the proxy vendor AI classification for a record resolved to a real org', () => {
    // Mixed multi-network visitor: a historical proxy event carries the VENDOR's
    // AI verdict (enterprise 0.95); the real-org event has no AI fields. The
    // consolidated record resolves to the real org name — its type must come
    // from the real-org event, never from the proxy event's stored AI.
    const records = aggregateByOrg([
      ev({ orgName: 'National Taiwan University', organizationType: 'education',
           visitorId: 'v1', ip: '140.112.1.1', pathname: '/b' }),
      ev({ orgName: 'Menlo Security, Inc.', org: 'AS399629 Menlo Security, Inc.',
           organizationType: 'enterprise', aiOrganizationType: 'enterprise', aiConfidence: 0.95,
           visitorId: 'v1', ip: '57.140.1.2', city: 'Taipei', country: 'TW', pathname: '/a' }),
    ]);
    expect(records).toHaveLength(1);
    expect(records[0].orgName).toBe('National Taiwan University');
    expect(records[0].organizationType).toBe('education'); // NOT the vendor's 'enterprise'
    expect(records[0].leadTier).toBe('B'); // via IP-reliable education, not the vendor's AI confidence
  });

  it('does not adopt corporate_proxy as the IP org type for a record resolved to a real org', () => {
    // Real-org events without an organizationType + a new-pipeline proxy event:
    // the corporate_proxy type must not leak onto the real-org record.
    const records = aggregateByOrg([
      ev({ orgName: 'National Taiwan University',
           visitorId: 'v1', ip: '140.112.1.1', pathname: '/b' }),
      ev({ orgName: 'Menlo Security, Inc.', organizationType: 'corporate_proxy',
           visitorId: 'v1', ip: '57.140.1.2', pathname: '/a' }),
    ]);
    expect(records).toHaveLength(1);
    expect(records[0].orgName).toBe('National Taiwan University');
    expect(records[0].organizationType).toBe(''); // unknown — NOT 'corporate_proxy'
  });

  it('clears historical target/tier state on proxy-only visitors so behavior scoring applies', () => {
    // Pre-corporate_proxy events could carry isTargetCustomer/leadTier derived
    // from the VENDOR's classification. Those must not survive: proxy vendors
    // are never targets, and retained state would also block anonymous-high-intent.
    const [rec] = aggregateByOrg([
      ev({ orgName: 'Menlo Security, Inc.', organizationType: 'enterprise',
           aiOrganizationType: 'enterprise', aiConfidence: 0.95,
           isTargetCustomer: true, leadTier: 'B',
           visitorId: 'vis-tw', ip: '57.140.1.2', city: 'Taipei',
           pathname: '/products/icp-etcher', behaviorScore: 0.4, returnVisits: 1 }),
    ]);
    expect(rec.organizationType).toBe('corporate_proxy');
    expect(rec.isTargetCustomer).toBe(false);
    expect(rec.leadTier).toBeNull();
    expect(rec.isAnonymousHighIntent).toBe(true);
  });

  it('derives target/tier only from real-org events in mixed proxy/institution groups', () => {
    // The vendor's target flag / tier / AI confidence must not leak onto the
    // real organization's record when the same visitor spans both networks.
    const records = aggregateByOrg([
      ev({ orgName: 'Acme Semiconductor', organizationType: 'business',
           aiOrganizationType: 'enterprise', aiConfidence: 0.3, // low-confidence real-org AI
           visitorId: 'v1', ip: '1.2.3.4', pathname: '/a' }),
      ev({ orgName: 'Menlo Security, Inc.', organizationType: 'enterprise',
           aiOrganizationType: 'enterprise', aiConfidence: 0.95,
           isTargetCustomer: true, leadTier: 'B',
           visitorId: 'v1', ip: '57.140.1.2', pathname: '/b' }),
    ]);
    expect(records).toHaveLength(1);
    expect(records[0].orgName).toBe('Acme Semiconductor');
    expect(records[0].isTargetCustomer).toBe(false); // vendor's target flag must not leak
    expect(records[0].leadTier).toBeNull();          // vendor tier/confidence must not backfill
  });

  it('prefers the real org type when a proxy visitor also has events from their institution network', () => {
    const records = aggregateByOrg([
      ev({ orgName: 'Menlo Security, Inc.', organizationType: 'corporate_proxy',
           visitorId: 'v1', ip: '57.140.1.2', pathname: '/a' }),
      ev({ orgName: 'National Taiwan University', organizationType: 'education',
           visitorId: 'v1', ip: '140.112.1.1', pathname: '/b' }),
    ]);
    expect(records).toHaveLength(1);
    expect(records[0].organizationType).toBe('education');
    expect(records[0].leadTier).toBe('B'); // IP-reliable education backfill still applies
  });
});

describe('orgOverrideKey', () => {
  it('keys ISP visitors by their stable group key (visitorId), not the display name', () => {
    expect(orgOverrideKey({ key: 'v-abc123', orgName: 'Cloudflare, Inc. · Needham, Massachusetts', isISPVisitor: true }))
      .toBe('v-abc123');
  });

  it('keys real organizations by org name', () => {
    expect(orgOverrideKey({ key: 'MIT', orgName: 'MIT', isISPVisitor: false })).toBe('MIT');
  });

  it('is stable for ISP visitors even when the display name shifts (#N suffix / city change)', () => {
    const before = orgOverrideKey({ key: 'v-abc123', orgName: 'Cloudflare, Inc. · Needham, Massachusetts', isISPVisitor: true });
    const after = orgOverrideKey({ key: 'v-abc123', orgName: 'Cloudflare, Inc. · Needham, Massachusetts #2', isISPVisitor: true });
    expect(before).toBe(after);
  });

  it('override written by key is found by the shared resolver', () => {
    const records = aggregateByOrg([
      ev({ orgName: 'Comcast', aiOrganizationType: 'telecom_isp', aiConfidence: 0.9, visitorId: 'v1', ip: '1.2.3.4', city: 'Boston', region: 'MA', timestamp: '2026-01-01T00:00:01Z' }),
    ]);
    const rec = records[0];
    const overrideMap = new Map([[orgOverrideKey(rec), { isTargetCustomer: true }]]);
    expect(resolveOrgOverride(overrideMap, rec)).toEqual({ isTargetCustomer: true });
  });
});

describe('resolveOrgOverride', () => {
  const ispOrg = { key: 'v-abc123', orgName: 'Cloudflare, Inc. · Needham, Massachusetts', isISPVisitor: true };

  it('prefers the stable key when both stable and legacy records exist (list/detail parity)', () => {
    const map = new Map([
      ['Cloudflare, Inc. · Needham, Massachusetts', { isTargetCustomer: false, from: 'legacy' }],
      ['v-abc123', { isTargetCustomer: true, from: 'stable' }],
    ]);
    expect(resolveOrgOverride(map, ispOrg)).toMatchObject({ from: 'stable' });
  });

  it('falls back to a legacy display-name record when no stable record exists', () => {
    const map = new Map([
      ['Cloudflare, Inc. · Needham, Massachusetts', { isTargetCustomer: true, from: 'legacy' }],
    ]);
    expect(resolveOrgOverride(map, ispOrg)).toMatchObject({ from: 'legacy' });
  });

  it('keeps org-name precedence for real organizations', () => {
    const map = new Map([['MIT', { isTargetCustomer: true }]]);
    expect(resolveOrgOverride(map, { key: 'v-x', orgName: 'MIT', isISPVisitor: false })).toBeTruthy();
  });

  it('returns undefined when nothing matches', () => {
    expect(resolveOrgOverride(new Map(), ispOrg)).toBeUndefined();
  });
});
