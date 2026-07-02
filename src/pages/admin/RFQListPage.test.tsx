import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import * as svc from '../../services/orderAdminService';
import { RFQListPage } from './RFQListPage';

vi.mock('../../services/orderAdminService');

const pendingRfq = {
  rfqId: 'rfq-pending',
  referenceNumber: 'RFQ-PENDING',
  status: 'pending',
  submittedAt: '2026-07-01T10:00:00Z',
  name: 'Pending Requester',
  institution: 'Stanford',
  equipmentCategory: 'ICP',
};

const convertedRfq = {
  rfqId: 'rfq-converted',
  referenceNumber: 'RFQ-CONVERTED',
  status: 'converted',
  submittedAt: '2026-06-30T10:00:00Z',
  name: 'Converted Requester',
  institution: 'MIT',
  equipmentCategory: 'ALD',
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(svc.listRfqs).mockImplementation((status?: string) => {
    if (status === 'pending') return Promise.resolve({ items: [pendingRfq], nextToken: null } as never);
    return Promise.resolve({ items: [convertedRfq], nextToken: null } as never);
  });
});

describe('RFQListPage', () => {
  it('uses the server-side status filter when a status tab is selected', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <RFQListPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getAllByText('RFQ-CONVERTED').length).toBeGreaterThan(0));

    await user.click(screen.getByRole('button', { name: 'Pending' }));

    await waitFor(() => expect(svc.listRfqs).toHaveBeenCalledWith('pending', 50));
    await waitFor(() => expect(screen.getAllByText('RFQ-PENDING').length).toBeGreaterThan(0));
  });
});
