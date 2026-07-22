import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
vi.mock('../../hooks/useNeedsLinkingQueue', () => ({ useNeedsLinkingQueue: vi.fn() }));
vi.mock('../../services/organizationAdminService');
import { useNeedsLinkingQueue } from '../../hooks/useNeedsLinkingQueue';
import * as svc from '../../services/organizationAdminService';
import { NeedsLinkingPage } from './NeedsLinkingPage';

const structuredUnit = { unitKey: 'unresolved-rfq-r1', linkUnitType: 'structured', source: 'rfq', kind: 'rfq_submitted', occurredAt: '2026-03-01T00:00:00Z', eventCount: 1, sourceEntityId: 'r1', representativeEventId: 'tev-1', signal: { email: 'j@nanofab.com', domain: 'nanofab.com', enrichmentStatus: 'ok' } };
const analyticsUnit = { unitKey: 'v1', linkUnitType: 'analytics', source: 'analytics', kind: 'site_visit_session', occurredAt: '2026-03-02T00:00:00Z', eventCount: 3, visitorId: 'v1', signal: { orgNameDisplay: 'Verizon Business', country: 'US', enrichmentStatus: 'ok' } };

beforeEach(() => vi.resetAllMocks());

describe('NeedsLinkingPage', () => {
  it('groups units under Structured / Site visitors and shows the selected unit detail', () => {
    vi.mocked(useNeedsLinkingQueue).mockReturnValue({ items: [structuredUnit, analyticsUnit], loading: false, error: null, hasMore: false, loadMore: vi.fn(), evictUnit: vi.fn() } as never);
    render(<NeedsLinkingPage />);
    expect(screen.getByText(/structured/i)).toBeTruthy();
    expect(screen.getByText(/site visitors/i)).toBeTruthy();
  });

  it('a successful structured link calls linkStructuredUnit, then evictUnit(unitKey)', async () => {
    const evictUnit = vi.fn();
    vi.mocked(useNeedsLinkingQueue).mockReturnValue({ items: [structuredUnit, analyticsUnit], loading: false, error: null, hasMore: false, loadMore: vi.fn(), evictUnit } as never);
    vi.mocked(svc.listOrganizations).mockResolvedValue({ items: [{ orgId: 'nanofabsolutions.com', displayName: 'NanoFab Solutions Inc' }] } as never);
    vi.mocked(svc.linkStructuredUnit).mockResolvedValue({ moved: 1 } as never);
    render(<NeedsLinkingPage />);
    // select the structured unit in the list
    fireEvent.click(screen.getByText(/RFQ|rfq|nanofab/i));
    // search + pick an org in the detail pane
    fireEvent.change(screen.getByRole('textbox', { name: /search organizations/i }), { target: { value: 'nanofab' } });
    fireEvent.click(await screen.findByText('NanoFab Solutions Inc'));
    fireEvent.click(screen.getByRole('button', { name: /link/i }));
    await waitFor(() => expect(svc.linkStructuredUnit).toHaveBeenCalledWith({ representativeEventId: 'tev-1', targetOrgId: 'nanofabsolutions.com' }));
    await waitFor(() => expect(evictUnit).toHaveBeenCalledWith('unresolved-rfq-r1'));
  });

  it('a post_commit_failed link still evicts the unit but shows a warning', async () => {
    const evictUnit = vi.fn();
    vi.mocked(useNeedsLinkingQueue).mockReturnValue({ items: [structuredUnit, analyticsUnit], loading: false, error: null, hasMore: false, loadMore: vi.fn(), evictUnit } as never);
    vi.mocked(svc.listOrganizations).mockResolvedValue({ items: [{ orgId: 'nanofabsolutions.com', displayName: 'NanoFab Solutions Inc' }] } as never);
    vi.mocked(svc.linkStructuredUnit).mockResolvedValue({ moved: 1, postCommitStatus: 'post_commit_failed' } as never);
    render(<NeedsLinkingPage />);
    fireEvent.click(screen.getByText(/RFQ|rfq|nanofab/i));
    fireEvent.change(screen.getByRole('textbox', { name: /search organizations/i }), { target: { value: 'nanofab' } });
    fireEvent.click(await screen.findByText('NanoFab Solutions Inc'));
    fireEvent.click(screen.getByRole('button', { name: /link/i }));
    await waitFor(() => expect(evictUnit).toHaveBeenCalledWith('unresolved-rfq-r1'));   // still evicted (link succeeded)
    expect(screen.getByText(/did not complete|follow-up|warning/i)).toBeTruthy();        // warning surfaced
  });
});
