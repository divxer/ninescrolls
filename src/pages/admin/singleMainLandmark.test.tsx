import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// AdminLayout owns the sole <main> landmark for every admin route. These tests
// render the real layout + a detail page and assert there is exactly one <main>,
// guarding against a page reintroducing its own nested <main> (WCAG 1.3.1).

vi.mock('@aws-amplify/ui-react', () => ({
  useAuthenticator: () => ({
    user: { signInDetails: { loginId: 'admin@ninescrolls.com' } },
    signOut: vi.fn(),
  }),
}));

vi.mock('../../contexts/useTheme', () => ({
  useTheme: () => ({ effectiveTheme: 'light', toggleTheme: vi.fn(), preference: 'auto' }),
}));

// OrganizationDetailPage deps
vi.mock('../../hooks/useOrganization', () => ({
  useOrganization: () => ({
    data: {
      organization: { rfqCount: 0, orderCount: 0, leadCount: 0, totalOrderValueUSD: 0 },
      recentRfqs: [],
      recentOrders: [],
      recentLeads: [],
    },
    loading: false,
    error: null,
    refresh: vi.fn(),
  }),
}));
vi.mock('../../components/admin/OrganizationHeaderPanel', () => ({ OrganizationHeaderPanel: () => null }));
vi.mock('../../components/admin/OrganizationTimeline', () => ({ OrganizationTimeline: () => null }));

// TenderDetailPage deps
vi.mock('../../hooks/useTender', () => ({
  useTender: () => ({
    data: { tender: { description: '', language: 'en' }, matches: [], log: [] },
    loading: false,
    error: null,
    refresh: vi.fn(),
  }),
}));
vi.mock('../../components/admin/TenderHeaderPanel', () => ({ TenderHeaderPanel: () => null }));
vi.mock('../../components/admin/TenderMatchCard', () => ({ TenderMatchCard: () => null }));
vi.mock('../../components/admin/TenderAuditLog', () => ({ TenderAuditLog: () => null }));

import { AdminLayout } from '../../components/admin/AdminLayout';
import { OrganizationDetailPage } from './OrganizationDetailPage';
import { TenderDetailPage } from './TenderDetailPage';

describe('admin detail pages render a single <main> landmark', () => {
  it('OrganizationDetailPage inside AdminLayout has exactly one <main>', () => {
    render(
      <MemoryRouter initialEntries={['/admin/organizations/org-1']}>
        <Routes>
          <Route path="/admin" element={<AdminLayout />}>
            <Route path="organizations/:orgId" element={<OrganizationDetailPage />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(document.body.querySelectorAll('main').length).toBe(1);
  });

  it('TenderDetailPage inside AdminLayout has exactly one <main>', () => {
    render(
      <MemoryRouter initialEntries={['/admin/tenders/tender-1']}>
        <Routes>
          <Route path="/admin" element={<AdminLayout />}>
            <Route path="tenders/:tenderId" element={<TenderDetailPage />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(document.body.querySelectorAll('main').length).toBe(1);
  });
});
