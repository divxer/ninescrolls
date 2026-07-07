import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CartItem } from '../contexts/CartContext';
import { CartPage } from './CartPage';

const { cartState, removeItem, updateQuantity } = vi.hoisted(() => ({
  cartState: {
    items: [] as CartItem[],
  },
  removeItem: vi.fn(),
  updateQuantity: vi.fn(),
}));

vi.mock('../contexts/useCart', () => ({
  useCart: () => ({
    items: cartState.items,
    removeItem,
    updateQuantity,
    getTotalPrice: () => cartState.items.reduce((total, item) => total + item.price * item.quantity, 0),
  }),
}));

function renderCart() {
  return render(
    <HelmetProvider>
      <MemoryRouter>
        <CartPage />
      </MemoryRouter>
    </HelmetProvider>
  );
}

describe('CartPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cartState.items = [];
  });

  it('marks the cart page noindex without changing empty-cart behavior', async () => {
    renderCart();

    expect(screen.getByRole('heading', { name: /Review your equipment order/i })).toBeInTheDocument();
    expect(screen.getByText(/Your cart is empty/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Continue Shopping/i })).toHaveAttribute('href', '/products');
    const quoteLinks = screen.getAllByRole('link', { name: /Request Quote/i });
    expect(quoteLinks.length).toBeGreaterThanOrEqual(1);
    quoteLinks.forEach((link) => {
      expect(link).toHaveAttribute('href', '/request-quote');
    });
    await waitFor(() => {
      expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex, follow');
    });
  });

  it('renders filled cart line items, quantity controls, total, and checkout CTA', async () => {
    const user = userEvent.setup();
    cartState.items = [{
      id: 'hy-4l-rf',
      sku: 'hy-4l-rf',
      name: 'HY-4L - RF Plasma Cleaner',
      price: 7999,
      quantity: 2,
      image: '/assets/images/redesign/products/hy-4l-standardized.webp',
    }];

    renderCart();

    expect(screen.getByText('SKU: hy-4l-rf')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'HY-4L - RF Plasma Cleaner' })).toBeInTheDocument();
    expect(screen.getByText('$7,999 USD each')).toBeInTheDocument();
    expect(screen.getAllByText('$15,998 USD').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('button', { name: /Proceed to Checkout/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Increase quantity/i }));
    expect(updateQuantity).toHaveBeenCalledWith('hy-4l-rf', 3);

    await user.click(screen.getByRole('button', { name: /Decrease quantity/i }));
    expect(updateQuantity).toHaveBeenCalledWith('hy-4l-rf', 1);

    await user.click(screen.getByRole('button', { name: /Remove HY-4L - RF Plasma Cleaner/i }));
    expect(removeItem).toHaveBeenCalledWith('hy-4l-rf');
  });
});
