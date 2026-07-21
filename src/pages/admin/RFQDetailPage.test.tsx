import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { RfqSubmission } from '../../types/admin';

const baseRfq: RfqSubmission = {
  rfqId: 'rfq-1',
  referenceNumber: 'RFQ-0001',
  status: 'quoted',
  submittedAt: '2026-07-21T00:00:00Z',
  name: 'Dr. Test',
  email: 'test@example.edu',
};

let mockRfq: RfqSubmission = baseRfq;

vi.mock('../../hooks/useRfqs', () => ({
  useRfq: () => ({ rfq: mockRfq, loading: false, error: null, refresh: vi.fn() }),
}));

import { RFQDetailPage } from './RFQDetailPage';

function renderWithRfq(overrides: Partial<RfqSubmission>) {
  mockRfq = { ...baseRfq, ...overrides };
  return render(
    <MemoryRouter initialEntries={['/admin/rfqs/rfq-1']}>
      <Routes><Route path="/admin/rfqs/:rfqId" element={<RFQDetailPage />} /></Routes>
    </MemoryRouter>,
  );
}

describe('RFQDetailPage Traffic Source', () => {
  it('shows Paid — Google + gclid when attribution has a gclid', () => {
    renderWithRfq({
      attribution: {
        source: 'google',
        medium: 'cpc',
        gclid: 'g-xyz',
        capturedAt: '2026-07-21T00:00:00Z',
        landingPath: '/products/ald',
      },
    });
    expect(screen.getByText(/Paid — Google/i)).toBeInTheDocument();
    expect(screen.getByText('google')).toBeInTheDocument();
    expect(screen.getByText(/Copy GCLID/i)).toBeInTheDocument();
  });

  it('shows Started from when no attribution but referrerSource present', () => {
    renderWithRfq({ attribution: null, referrerSource: 'insights/types-of-wafer-probe-stations' });
    expect(screen.getByText(/Started from/i)).toBeInTheDocument();
    expect(screen.getByText(/insights\/types-of-wafer-probe-stations/)).toBeInTheDocument();
  });

  it('shows Direct / not captured when neither present', () => {
    renderWithRfq({ attribution: null, referrerSource: null });
    expect(screen.getByText(/Direct \/ not captured/i)).toBeInTheDocument();
  });
});
