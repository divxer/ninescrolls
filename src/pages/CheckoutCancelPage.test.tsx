import { render, screen, waitFor } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { CheckoutCancelPage } from './CheckoutCancelPage';

function renderCancel() {
  return render(
    <HelmetProvider>
      <MemoryRouter>
        <CheckoutCancelPage />
      </MemoryRouter>
    </HelmetProvider>
  );
}

describe('CheckoutCancelPage', () => {
  it('shows recovery actions and noindex robots meta', async () => {
    renderCancel();

    expect(screen.getByRole('heading', { name: /Checkout cancelled/i })).toBeInTheDocument();
    screen.getAllByRole('link', { name: /Return to Cart/i }).forEach((link) => {
      expect(link).toHaveAttribute('href', '/cart');
    });
    screen.getAllByRole('link', { name: /Request Quote/i }).forEach((link) => {
      expect(link).toHaveAttribute('href', '/request-quote');
    });
    // Cancelling buyers often need a PO/procurement path — keep a direct sales contact route.
    expect(screen.getByRole('link', { name: /Talk to Sales/i })).toHaveAttribute('href', '/contact?topic=support');
    await waitFor(() => {
      expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex, nofollow');
    });
  });
});
