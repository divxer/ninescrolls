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

    expect(screen.getByRole('heading', { name: /Payment Cancelled/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Return to Cart/i })).toHaveAttribute('href', '/cart');
    expect(screen.getByRole('link', { name: /Contact Sales/i })).toHaveAttribute('href', '/contact');
    await waitFor(() => {
      expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex, nofollow');
    });
  });
});
