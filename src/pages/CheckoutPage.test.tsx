import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CartItem } from '../contexts/CartContext';
import { calculateTax, createCheckoutSession } from '../services/stripeService';
import { CheckoutPage } from './CheckoutPage';

const { cartState } = vi.hoisted(() => ({
  cartState: {
    items: [] as CartItem[],
  },
}));

vi.mock('../contexts/useCart', () => ({
  useCart: () => ({
    items: cartState.items,
    getTotalPrice: () => cartState.items.reduce((total, item) => total + item.price * item.quantity, 0),
  }),
}));

vi.mock('../services/stripeService', () => ({
  calculateTax: vi.fn(),
  createCheckoutSession: vi.fn(),
}));

function renderCheckout() {
  return render(
    <HelmetProvider>
      <MemoryRouter>
        <CheckoutPage />
      </MemoryRouter>
    </HelmetProvider>
  );
}

function fillRequiredCheckoutFields() {
  fireEvent.change(screen.getByLabelText(/First Name/i), { target: { value: 'Ada' } });
  fireEvent.change(screen.getByLabelText(/Last Name/i), { target: { value: 'Lovelace' } });
  fireEvent.change(screen.getByLabelText(/^Email/i), { target: { value: 'ada@example.edu' } });
  fireEvent.change(screen.getByLabelText(/Phone/i), { target: { value: '+1 858 555 0100' } });
  fireEvent.change(screen.getByLabelText(/^Address/i), { target: { value: '12546 Cabezon Pl' } });
  fireEvent.change(screen.getByLabelText(/^City/i), { target: { value: 'San Diego' } });
  fireEvent.change(screen.getByLabelText(/State\/Province/i), { target: { value: 'CA' } });
  fireEvent.change(screen.getByLabelText(/ZIP\/Postal Code/i), { target: { value: '92129' } });
}

describe('CheckoutPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cartState.items = [{
      id: 'hy-4l-rf',
      sku: 'hy-4l-rf',
      name: 'HY-4L - RF Plasma Cleaner',
      price: 7999,
      quantity: 1,
      image: 'https://cdn.ninescrolls.com/products/hy/main.jpg',
    }];
    vi.mocked(calculateTax).mockResolvedValue({
      taxAmount: 0,
      subtotal: 7999,
      total: 7999,
      taxBreakdown: [],
    });
    vi.mocked(createCheckoutSession).mockResolvedValue({
      sessionId: 'cs_test',
      url: '',
    });
  });

  it('blocks submit with an accessible required-field error', async () => {
    renderCheckout();

    fireEvent.click(screen.getByRole('button', { name: /Place Secure Order/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Please fill in all required fields.');
  });

  it('presents checkout as a secure equipment checkout without changing the form contract', () => {
    renderCheckout();

    expect(screen.getByRole('heading', { name: /Secure equipment checkout/i })).toBeInTheDocument();
    expect(screen.getAllByText(/Stripe checkout/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByLabelText(/First Name/i)).toHaveAttribute('name', 'firstName');
    expect(screen.getByLabelText(/^Email/i)).toHaveAttribute('name', 'email');
    expect(screen.getByLabelText(/^Address/i)).toHaveAttribute('name', 'address');
    expect(screen.getByRole('button', { name: /Place Secure Order/i })).toBeInTheDocument();
  });

  it('sends unchanged success and cancel URLs to createCheckoutSession', async () => {
    vi.stubGlobal('gtag', vi.fn());
    renderCheckout();
    fillRequiredCheckoutFields();

    fireEvent.click(screen.getByRole('button', { name: /Place Secure Order/i }));

    await waitFor(() => {
      expect(createCheckoutSession).toHaveBeenCalledWith(expect.objectContaining({
        successUrl: 'http://localhost:3000/checkout/success?session_id={CHECKOUT_SESSION_ID}',
        cancelUrl: 'http://localhost:3000/checkout/cancel',
      }));
    });
    expect(window.gtag).toHaveBeenCalledWith('event', 'begin_checkout', expect.objectContaining({
      currency: 'USD',
      value: 7999,
    }));
  });

  it('uses absolute image URLs for both tax calculation and checkout session without double-prefixing CDN URLs', async () => {
    renderCheckout();
    fillRequiredCheckoutFields();

    await waitFor(() => {
      expect(calculateTax).toHaveBeenCalledWith(
        [expect.objectContaining({ image: 'https://cdn.ninescrolls.com/products/hy/main.jpg' })],
        expect.any(Object)
      );
    });

    fireEvent.click(screen.getByRole('button', { name: /Place Secure Order/i }));

    await waitFor(() => {
      expect(createCheckoutSession).toHaveBeenCalledWith(expect.objectContaining({
        items: [expect.objectContaining({ image: 'https://cdn.ninescrolls.com/products/hy/main.jpg' })],
      }));
    });
  });

  it('uses noindex robots', async () => {
    renderCheckout();

    await waitFor(() => {
      expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex, nofollow');
    });
  });
});
