import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (orig) => ({
  ...(await orig() as object),
  useNavigate: () => mockNavigate,
}));
vi.mock('../../services/logisticsAdminService');

import { createLogisticsCase } from '../../services/logisticsAdminService';
import { CreateLogisticsCasePage } from './CreateLogisticsCasePage';

beforeEach(() => {
  vi.mocked(createLogisticsCase).mockReset();
  mockNavigate.mockReset();
});

describe('CreateLogisticsCasePage', () => {
  it('submits and redirects to the new case', async () => {
    vi.mocked(createLogisticsCase).mockResolvedValueOnce({ caseId: 'lc-9' } as never);
    render(<MemoryRouter><CreateLogisticsCasePage /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText(/Customer/i), { target: { value: 'BAE' } });
    fireEvent.click(screen.getByText('Create Case'));
    await waitFor(() => expect(createLogisticsCase).toHaveBeenCalled());
    const input = vi.mocked(createLogisticsCase).mock.calls[0][0] as Record<string, unknown>;
    expect(input.customerName).toBe('BAE');
    expect(input.caseType).toBe('SAMPLE'); // default first option
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/admin/logistics/lc-9'));
  });

  it('blocks submit without a customer name', async () => {
    render(<MemoryRouter><CreateLogisticsCasePage /></MemoryRouter>);
    fireEvent.click(screen.getByText('Create Case'));
    expect(createLogisticsCase).not.toHaveBeenCalled();
  });

  it('blocks submit when related entity type is set without an ID', async () => {
    render(<MemoryRouter><CreateLogisticsCasePage /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText(/Customer/i), { target: { value: 'BAE' } });
    fireEvent.change(screen.getByLabelText(/Related entity type/i), { target: { value: 'LEAD' } });
    fireEvent.click(screen.getByText('Create Case'));
    expect(createLogisticsCase).not.toHaveBeenCalled();
    expect(screen.getByText(/both/i)).toBeInTheDocument();
  });
});
