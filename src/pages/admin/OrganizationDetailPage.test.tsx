import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
vi.mock('../../hooks/useOrganization', () => ({ useOrganization: vi.fn() }));
vi.mock('../../hooks/useOrganizationTimeline', () => ({ useOrganizationTimeline: vi.fn() }));
import { useOrganization } from '../../hooks/useOrganization';
import { useOrganizationTimeline } from '../../hooks/useOrganizationTimeline';
import { OrganizationDetailPage } from './OrganizationDetailPage';

const renderAt = () => render(
  <MemoryRouter initialEntries={['/admin/organizations/acme.com']}>
    <Routes><Route path="/admin/organizations/:orgId" element={<OrganizationDetailPage />} /></Routes>
  </MemoryRouter>,
);

beforeEach(() => vi.resetAllMocks());

describe('OrganizationDetailPage', () => {
  it('renders the header even when the timeline errors (isolated failure)', () => {
    vi.mocked(useOrganization).mockReturnValue({
      data: {
        organization: {
          orgId: 'acme.com',
          displayName: 'Acme',
          rfqCount: 0,
          orderCount: 0,
          leadCount: 0,
          totalOrderValueUSD: 0,
        },
      },
      loading: false,
      error: null,
      refresh: vi.fn(),
    } as never);
    vi.mocked(useOrganizationTimeline).mockReturnValue({
      items: [],
      loading: false,
      error: new Error('down'),
      hasMore: false,
      loadMore: vi.fn(),
      reload: vi.fn(),
      includeInternal: false,
      setIncludeInternal: vi.fn(),
    } as never);
    renderAt();
    expect(screen.getByText('Acme')).toBeTruthy();
    expect(screen.getByText(/couldn.t load timeline/i)).toBeTruthy();
  });
});
