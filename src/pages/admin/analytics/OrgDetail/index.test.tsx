import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { AnalyticsEvent, OrganizationRecord } from '../types';

// OrgDetail kicks off async work on mount (org-override classification + RFQ
// lookups). Mock those service boundaries so the smoke test exercises rendering,
// not the network. Paths mirror the specifiers used by index.tsx (co-located).
vi.mock('../../../../services/adminClassificationService', () => ({
  // found: true short-circuits the classify + graphql-backfill path
  getOrgOverride: vi.fn().mockResolvedValue({
    found: true,
    orgName: 'Test Org',
    organizationType: 'education',
    confidence: 0.9,
    reason: 'test',
    provider: 'bedrock',
    isTargetCustomer: true,
    source: 'ai',
  }),
  classifyOrg: vi.fn().mockResolvedValue({ found: true, organizationType: 'education', confidence: 0.9 }),
  setOrgOverride: vi.fn().mockResolvedValue(undefined),
  undoOrgOverride: vi.fn().mockResolvedValue(undefined),
  renameOrg: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../../../services/orderAdminService', () => ({
  getRfq: vi.fn().mockResolvedValue(null),
  listRfqs: vi.fn().mockResolvedValue({ items: [] }),
}));
vi.mock('../../../../services/amplifyClient', () => ({
  getAmplifyDataClient: () => ({ graphql: vi.fn().mockResolvedValue({ data: {} }), models: {} }),
}));

import { OrgDetail } from './index';

const ev = (p: Record<string, unknown>): AnalyticsEvent =>
  ({ id: 'e', timestamp: '2026-01-01T00:00:00.000Z', ...p } as unknown as AnalyticsEvent);

function makeOrg(overrides: Partial<OrganizationRecord> = {}): OrganizationRecord {
  return {
    key: 'mit.edu',
    orgName: 'MIT',
    organizationType: 'education',
    country: 'United States',
    region: 'MA',
    city: 'Cambridge',
    latitude: 42.36,
    longitude: -71.09,
    leadTier: 'B',
    isTargetCustomer: true,
    totalEvents: 2,
    uniquePages: 2,
    productsViewed: ['HY-20L'],
    totalTimeOnSite: 120,
    pdfDownloads: 0,
    returnVisits: 1,
    lastVisit: '2026-01-02T00:00:00.000Z',
    firstVisit: '2026-01-01T00:00:00.000Z',
    maxConfidence: 0.9,
    maxBehaviorScore: 0.4,
    isAnonymousHighIntent: false,
    isISPVisitor: false,
    companyType: '',
    lifecycleStage: 'interest',
    rfqInstitution: null,
    contactOrganization: null,
    downloadGateOrganization: null,
    events: [
      ev({ id: 'pv1', eventType: 'page_view', pathname: '/products/hy-20l', visitorId: 'v1', ip: '9.9.9.9', country: 'United States', region: 'MA', city: 'Cambridge', userAgent: 'Mozilla/5.0', timestamp: '2026-01-01T00:00:01Z' }),
      ev({ id: 'pv2', eventType: 'page_view', pathname: '/about', visitorId: 'v1', ip: '9.9.9.9', country: 'United States', timestamp: '2026-01-02T00:00:00Z' }),
    ],
    ...overrides,
  };
}

describe('OrgDetail smoke test', () => {
  it('renders the dossier sections for a representative org without crashing', async () => {
    render(
      <OrgDetail
        org={makeOrg()}
        onBack={vi.fn()}
        allContactLeads={[]}
        allDownloadGateLeads={[]}
        allNewsletterLeads={[]}
      />,
    );

    // org identity + the key panels of the dossier
    expect(await screen.findByText('MIT')).toBeInTheDocument();
    expect(screen.getByText('Detection Details')).toBeInTheDocument();
    expect(screen.getByText('Activity Ledger')).toBeInTheDocument();
    expect(screen.getByText('Traffic Sources')).toBeInTheDocument();
    expect(screen.getByText('Technical Context')).toBeInTheDocument();

    // async org-override classification settles without throwing
    await waitFor(() => {
      expect(screen.getByText(/Back to list/i)).toBeInTheDocument();
    });
  });

  it('calls onBack when the back control is clicked', async () => {
    const onBack = vi.fn();
    render(
      <OrgDetail
        org={makeOrg()}
        onBack={onBack}
        allContactLeads={[]}
        allDownloadGateLeads={[]}
        allNewsletterLeads={[]}
      />,
    );

    fireEvent.click(await screen.findByText(/Back to list/i));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('renders the Activity Ledger timeline entries from org events', async () => {
    render(
      <OrgDetail
        org={makeOrg()}
        onBack={vi.fn()}
        allContactLeads={[]}
        allDownloadGateLeads={[]}
        allNewsletterLeads={[]}
      />,
    );

    // the extracted ActivityLedger child renders visited paths from org.events
    expect(await screen.findByText('Activity Ledger')).toBeInTheDocument();
    expect(screen.getAllByText(/\/products\/hy-20l/).length).toBeGreaterThan(0);
  });
});
