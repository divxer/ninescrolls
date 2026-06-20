import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const mockOrder = {
  orderId: 'ord-1', status: 'INQUIRY', institution: 'Test University', department: 'Physics',
  productModel: 'ICP-RIE-200', productName: 'Etcher', configuration: 'Standard',
  quoteNumber: null, poNumber: null, quoteAmount: null, notes: null,
  quoteDate: null, quoteValidUntil: null, poDate: null, productionStartDate: null,
  shipDate: null, installDate: null, closeDate: null, rfqId: null,
  createdAt: '2026-01-01T00:00:00Z', createdBy: 'u', createdByEmail: 'u@x.com', contacts: [],
};

vi.mock('../../hooks/useOrders', () => ({
  useOrder: () => ({ order: mockOrder, loading: false, error: null, refresh: vi.fn() }),
  useOrderLogs: () => ({ logs: [], loading: false }),
}));
vi.mock('../../components/admin/ContactsPanel', () => ({ ContactsPanel: () => null }));
vi.mock('../../components/admin/DocumentsPanel', () => ({ DocumentsPanel: () => null }));
vi.mock('../../components/admin/ActivityLog', () => ({ ActivityLog: () => null }));
vi.mock('../../components/admin/LogisticsPanel', () => ({
  LogisticsPanel: ({ orderId }: { orderId: string }) => <div data-testid="logistics-panel">LP:{orderId}</div>,
}));

import { OrderDetailPage } from './OrderDetailPage';

describe('OrderDetailPage wiring', () => {
  it('renders LogisticsPanel with the order id', () => {
    render(
      <MemoryRouter initialEntries={['/admin/orders/ord-1']}>
        <Routes><Route path="/admin/orders/:orderId" element={<OrderDetailPage />} /></Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId('logistics-panel')).toHaveTextContent('LP:ord-1');
  });
});
