import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { HY4L } from './HY4L';

const addToCart = vi.fn();

vi.mock('../../hooks/useProductPage', () => ({
  useProductPage: () => ({ addToCart }),
}));

vi.mock('../common/DownloadGateModal', () => ({
  DownloadGateModal: () => null,
}));

function renderHy4l(initialEntry = '/products/hy-4l') {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <HY4L />
      </MemoryRouter>
    </HelmetProvider>
  );
}

function getProductJsonLd() {
  return Array.from(document.head.querySelectorAll('script[type="application/ld+json"]'))
    .map(script => JSON.parse(script.textContent ?? '{}'))
    .find(data => data['@type'] === 'Product');
}

describe('HY4L commerce product page', () => {
  it('defaults to RF and can switch to Mid-Frequency before adding to cart', async () => {
    const user = userEvent.setup();
    renderHy4l();

    expect(screen.getByText('$7,999')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Mid-Frequency/i }));
    expect(screen.getByText('$6,499')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add to Cart' }));
    expect(addToCart).toHaveBeenCalledWith(expect.objectContaining({
      id: 'hy-4l-mf',
      sku: 'hy-4l-mf',
      price: 6499,
    }));
  });

  it('preselects variants from dedicated routes and query params', () => {
    renderHy4l('/products/hy-4l-mf');
    expect(screen.getByText('$6,499')).toBeInTheDocument();
  });

  it('keeps budgetary quote and gallery available', () => {
    renderHy4l('/products/hy-4l?config=rf');
    const quoteLinks = screen.getAllByRole('link', { name: 'Request a Budgetary Quote' });
    expect(quoteLinks.some(link => link.getAttribute('href') === '/request-quote?products=hy-4l')).toBe(true);
    expect(screen.getByRole('heading', { level: 2, name: 'System Views' })).toBeInTheDocument();
    expect(screen.queryByText(/supplier-provided/i)).not.toBeInTheDocument();
  });

  it('uses AggregateOffer schema for the two purchasable variants', async () => {
    renderHy4l();

    await waitFor(() => {
      expect(getProductJsonLd().offers).toMatchObject({
        '@type': 'AggregateOffer',
        lowPrice: '6499',
        highPrice: '7999',
        offerCount: 2,
        priceCurrency: 'USD',
      });
    });
  });
});
