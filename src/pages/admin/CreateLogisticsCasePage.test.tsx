import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (orig) => ({
  ...(await orig() as object),
  useNavigate: () => mockNavigate,
}));
vi.mock('../../services/logisticsAdminService');
vi.mock('../../components/admin/OrderSearchSelector', () => ({
  OrderSearchSelector: ({ value, onSelect }: { value: string; onSelect: (o: { orderId: string; institution: string } | null) => void }) => (
    <div data-testid="order-selector">
      <span>val:{value}</span>
      <button type="button" onClick={() => onSelect({ orderId: 'ord-5', institution: 'HORIBA' })}>pick-order</button>
      <button type="button" onClick={() => onSelect(null)}>clear-order</button>
    </div>
  ),
}));

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

  it('selecting an order sets relatedOrderId and fills customerName when empty', async () => {
    vi.mocked(createLogisticsCase).mockResolvedValueOnce({ caseId: 'lc-1' } as never);
    render(<MemoryRouter><CreateLogisticsCasePage /></MemoryRouter>);
    fireEvent.click(screen.getByText('pick-order'));            // customerName starts empty → filled from order
    fireEvent.click(screen.getByText('Create Case'));
    await waitFor(() => expect(createLogisticsCase).toHaveBeenCalled());
    const input = vi.mocked(createLogisticsCase).mock.calls[0][0] as Record<string, unknown>;
    expect(input.relatedOrderId).toBe('ord-5');
    expect(input.customerName).toBe('HORIBA');
    expect(input.relatedEntityType).toBeUndefined();           // order pick must NOT set relatedEntityType
  });

  it('selecting an order does NOT overwrite a customer name the user already typed', async () => {
    vi.mocked(createLogisticsCase).mockResolvedValueOnce({ caseId: 'lc-1' } as never);
    render(<MemoryRouter><CreateLogisticsCasePage /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText(/Customer/i), { target: { value: 'BAE Systems' } });
    fireEvent.click(screen.getByText('pick-order'));
    fireEvent.click(screen.getByText('Create Case'));
    await waitFor(() => expect(createLogisticsCase).toHaveBeenCalled());
    const input = vi.mocked(createLogisticsCase).mock.calls[0][0] as Record<string, unknown>;
    expect(input.customerName).toBe('BAE Systems');
    expect(input.relatedOrderId).toBe('ord-5');
  });

  it('clearing the order resets relatedOrderId', async () => {
    vi.mocked(createLogisticsCase).mockResolvedValueOnce({ caseId: 'lc-1' } as never);
    render(<MemoryRouter><CreateLogisticsCasePage /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText(/Customer/i), { target: { value: 'BAE' } });
    fireEvent.click(screen.getByText('pick-order'));
    fireEvent.click(screen.getByText('clear-order'));
    fireEvent.click(screen.getByText('Create Case'));
    await waitFor(() => expect(createLogisticsCase).toHaveBeenCalled());
    const input = vi.mocked(createLogisticsCase).mock.calls[0][0] as Record<string, unknown>;
    expect(input.relatedOrderId).toBeUndefined();
  });
});
