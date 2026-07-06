import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { HY20L } from './HY20L';

const addToCart = vi.fn();

vi.mock('../../hooks/useProductPage', () => ({
  useProductPage: () => ({ addToCart }),
}));

vi.mock('../common/DownloadGateModal', () => ({
  DownloadGateModal: () => null,
}));

function renderHy20l(initialEntry = '/products/hy-20l') {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <HY20L />
      </MemoryRouter>
    </HelmetProvider>
  );
}

function getProductJsonLd() {
  return Array.from(document.head.querySelectorAll('script[type="application/ld+json"]'))
    .map(script => JSON.parse(script.textContent ?? '{}'))
    .find(data => data['@type'] === 'Product');
}

describe('HY20L commerce product page', () => {
  it('defaults to RF and adds the selected Mid-Frequency variant to cart', async () => {
    const user = userEvent.setup();
    renderHy20l();

    expect(screen.getByRole('heading', { level: 1, name: 'HY-20L Batch Plasma Processing System' })).toBeInTheDocument();
    expect(screen.getByText('$14,999')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Mid-Frequency/i }));
    expect(screen.getByText('$11,999')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add to Cart' }));
    expect(addToCart).toHaveBeenCalledWith(expect.objectContaining({
      id: 'hy-20l-mf',
      sku: 'hy-20l-mf',
      name: 'HY-20L - Mid-Frequency (40 kHz) Plasma Processing System',
      price: 11999,
    }));
  });

  it('preselects the Mid-Frequency variant from query params while keeping canonical product schema stable', async () => {
    renderHy20l('/products/hy-20l?config=mf');

    expect(screen.getByText('$11,999')).toBeInTheDocument();
    await waitFor(() => {
      expect(getProductJsonLd()['@id']).toBe('https://ninescrolls.com/products/hy-20l#product');
      expect(getProductJsonLd().offers).toMatchObject({
        '@type': 'AggregateOffer',
        lowPrice: '11999',
        highPrice: '14999',
        offerCount: 2,
        url: 'https://ninescrolls.com/products/hy-20l',
      });
    });
  });

  it('keeps quote, gallery, and verified cleaner resources available without OEM disclosure copy', () => {
    renderHy20l();

    const quoteLinks = screen.getAllByRole('link', { name: 'Request a Budgetary Quote' });
    expect(quoteLinks.some(link => link.getAttribute('href') === '/request-quote?products=hy-20l')).toBe(true);
    expect(screen.getByRole('heading', { level: 2, name: 'System Views' })).toBeInTheDocument();
    expect(screen.queryByText(/Distributor Notice/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Shenzhen Huiyi/i)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Plasma Cleaner Buying Guide/i })).toHaveAttribute(
      'href',
      '/insights/plasma-cleaner-buying-guide'
    );
  });

  it('supports explicit RF query selection', () => {
    renderHy20l('/products/hy-20l?config=rf');
    expect(screen.getByText('$14,999')).toBeInTheDocument();

    cleanup();
    renderHy20l('/products/hy-20l?config=mf');
    expect(screen.getByText('$11,999')).toBeInTheDocument();
  });
});
