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

// Mutable reference so individual tests can swap in a different order fixture
let currentOrder: Record<string, unknown> = mockOrder;

vi.mock('../../hooks/useOrders', () => ({
  useOrder: () => ({ order: currentOrder, loading: false, error: null, refresh: vi.fn() }),
  useOrderLogs: () => ({ logs: [], loading: false }),
}));
vi.mock('../../components/admin/ContactsPanel', () => ({ ContactsPanel: () => null }));
vi.mock('../../components/admin/DocumentsPanel', () => ({ DocumentsPanel: () => null }));
vi.mock('../../components/admin/ActivityLog', () => ({ ActivityLog: () => null }));
vi.mock('../../components/admin/LogisticsPanel', () => ({
  LogisticsPanel: ({ orderId }: { orderId: string }) => <div data-testid="logistics-panel">LP:{orderId}</div>,
}));

import { OrderDetailPage } from './OrderDetailPage';

function renderPage(orderId = 'ord-1') {
  return render(
    <MemoryRouter initialEntries={[`/admin/orders/${orderId}`]}>
      <Routes><Route path="/admin/orders/:orderId" element={<OrderDetailPage />} /></Routes>
    </MemoryRouter>,
  );
}

describe('OrderDetailPage wiring', () => {
  it('renders LogisticsPanel with the order id', () => {
    currentOrder = mockOrder;
    renderPage();
    expect(screen.getByTestId('logistics-panel')).toHaveTextContent('LP:ord-1');
  });
});

describe('OrderDetailPage — Stripe checkout orders', () => {
  const stripeOrder = {
    ...mockOrder,
    orderId: 'ord-2',
    status: 'PO_RECEIVED',
    source: 'STRIPE',
    quoteAmount: 7999,
    poDate: '2026-07-22',
    stripeSessionId: 'cs_live_a1h4Hp4oyR1daUZ9S7eZZbc88Js66TvNHy03zpVJOijXYXpGGjjyPfHUeI',
    stripePaymentIntentId: 'pi_3Tw5yVEGHtZUuqNu1Ega7igS',
  };

  it('shows the payment banner with a Stripe dashboard link', () => {
    currentOrder = stripeOrder;
    renderPage('ord-2');
    expect(screen.getByText(/Paid online via Stripe/)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /View payment in Stripe/ });
    expect(link).toHaveAttribute('href', 'https://dashboard.stripe.com/payments/pi_3Tw5yVEGHtZUuqNu1Ega7igS');
  });

  it('relabels PO_RECEIVED as "Paid" and hides quote fields', () => {
    currentOrder = stripeOrder;
    renderPage('ord-2');
    // Stepper stage + status badge both say "Paid", never "PO Received"
    expect(screen.getAllByText('Paid').length).toBeGreaterThan(0);
    expect(screen.queryByText('PO Received')).not.toBeInTheDocument();
    // Quote-workflow fields are hidden; payment ref shown instead of PO #
    expect(screen.queryByText('Quote #')).not.toBeInTheDocument();
    expect(screen.queryByText('Quote Valid Until')).not.toBeInTheDocument();
    expect(screen.queryByText('PO #')).not.toBeInTheDocument();
    expect(screen.getByText('Payment Ref')).toBeInTheDocument();
  });

  it('keeps quote fields for non-Stripe orders', () => {
    currentOrder = mockOrder;
    renderPage();
    expect(screen.getByText('Quote #')).toBeInTheDocument();
    expect(screen.getByText('PO #')).toBeInTheDocument();
    expect(screen.queryByText(/Paid online via Stripe/)).not.toBeInTheDocument();
  });
});
