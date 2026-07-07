import { render, screen, waitFor } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CartItem } from '../contexts/CartContext';
import { CheckoutSuccessPage } from './CheckoutSuccessPage';

const { cartState, clearCart } = vi.hoisted(() => ({
  cartState: {
    items: [] as CartItem[],
  },
  clearCart: vi.fn(),
}));

vi.mock('../contexts/useCart', () => ({
  useCart: () => ({
    items: cartState.items,
    clearCart,
    getTotalPrice: () => cartState.items.reduce((total, item) => total + item.price * item.quantity, 0),
  }),
}));

function renderSuccess(initialEntry = '/checkout/success?session_id=cs_test_123') {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/checkout/success" element={<CheckoutSuccessPage />} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>
  );
}

describe('CheckoutSuccessPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cartState.items = [{
      id: 'hy-4l-rf',
      sku: 'hy-4l-rf',
      name: 'HY-4L - RF Plasma Cleaner',
      price: 7999,
      quantity: 1,
    }];
    vi.stubGlobal('gtag', vi.fn());
  });

  it('tracks purchase and clears cart for a valid session id', async () => {
    renderSuccess();

    expect(screen.getByText('cs_test_123')).toBeInTheDocument();
    await waitFor(() => {
      expect(window.gtag).toHaveBeenCalledWith('event', 'purchase', expect.objectContaining({
        transaction_id: 'cs_test_123',
        value: 7999,
        currency: 'USD',
      }));
      expect(clearCart).toHaveBeenCalledTimes(1);
    });
  });

  it.each([
    ['/checkout/success?sessionId=cs_camel_456', 'cs_camel_456'],
    ['/checkout/success?session%20id=cs_space_789', 'cs_space_789'],
  ])('accepts alternate Stripe session id query parameter shape %s', async (entry, expectedSessionId) => {
    renderSuccess(entry);

    expect(screen.getByText(expectedSessionId)).toBeInTheDocument();
    await waitFor(() => {
      expect(window.gtag).toHaveBeenCalledWith('event', 'purchase', expect.objectContaining({
        transaction_id: expectedSessionId,
      }));
      expect(clearCart).toHaveBeenCalledTimes(1);
    });
  });

  it('uses noindex robots without changing success behavior', async () => {
    renderSuccess();

    expect(screen.getByRole('heading', { name: /Order confirmed/i })).toBeInTheDocument();
    expect(screen.getByText(/follow up with confirmation, documentation, and shipping coordination/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Contact Support/i })).toHaveAttribute('href', '/contact?topic=support');
    expect(document.body).not.toHaveTextContent(/Transmission Received/i);
    expect(document.body).not.toHaveTextContent(/3-4 weeks/i);
    await waitFor(() => {
      expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex, nofollow');
    });
  });
});
