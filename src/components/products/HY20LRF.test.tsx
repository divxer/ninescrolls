import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { HY20LRF } from './HY20LRF';

const addToCart = vi.fn();
const heroImage = '/assets/images/redesign/products/hy-20lrf-standardized.webp';
const rearImage = '/assets/images/redesign/products/hy-20lrf-rear-connections.webp';

vi.mock('../../hooks/useProductPage', () => ({
  useProductPage: () => ({ addToCart }),
}));

vi.mock('../common/DownloadGateModal', () => ({
  DownloadGateModal: () => null,
}));

function renderHy20lrf(initialEntry = '/products/hy-20lrf') {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <HY20LRF />
      </MemoryRouter>
    </HelmetProvider>
  );
}

function getProductJsonLd() {
  return Array.from(document.head.querySelectorAll('script[type="application/ld+json"]'))
    .map(script => JSON.parse(script.textContent ?? '{}'))
    .find(data => data['@type'] === 'Product');
}

describe('HY20LRF commerce product page', () => {
  it('renders a single RF variant and adds it to cart', async () => {
    const user = userEvent.setup();
    renderHy20lrf();

    expect(screen.getByRole('heading', { level: 1, name: 'HY-20LRF Research-Grade Batch Plasma Cleaner' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'HY-20LRF research-grade batch plasma cleaner' })).toHaveAttribute('src', heroImage);
    expect(screen.getByRole('button', { name: 'RF (13.56 MHz)' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('heading', { level: 3, name: 'How is HY-20LRF different from HY-20L?' })).toBeInTheDocument();
    expect(screen.getByText('$14,499')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add to Cart' }));
    expect(addToCart).toHaveBeenCalledWith(expect.objectContaining({
      id: 'hy-20lrf',
      sku: 'hy-20lrf',
      name: 'HY-20LRF - RF (13.56 MHz) Batch Plasma Cleaner',
      price: 14499,
      image: heroImage,
    }));
  });

  it('uses single-variant Offer schema with stable canonical identity', async () => {
    renderHy20lrf();

    await waitFor(() => {
      expect(getProductJsonLd()['@id']).toBe('https://ninescrolls.com/products/hy-20lrf#product');
      expect(getProductJsonLd().image).toEqual(['https://ninescrolls.com/assets/images/redesign/products/hy-20lrf-standardized.webp']);
      expect(getProductJsonLd().offers).toMatchObject({
        '@type': 'Offer',
        price: '14499',
        priceCurrency: 'USD',
        url: 'https://ninescrolls.com/products/hy-20lrf',
      });
    });
    expect(getProductJsonLd().offers.priceValidUntil).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(getProductJsonLd().offers).not.toHaveProperty('lowPrice');
    expect(getProductJsonLd().offers).not.toHaveProperty('offerCount');
  });

  it('keeps gallery, quote path, verified resources, and no OEM disclosure copy', () => {
    renderHy20lrf();

    const quoteLinks = screen.getAllByRole('link', { name: 'Request a Budgetary Quote' });
    expect(quoteLinks.some(link => link.getAttribute('href') === '/request-quote?products=hy-20lrf')).toBe(true);
    expect(screen.getByRole('img', { name: 'HY-20LRF rear service connections and vacuum ports' })).toHaveAttribute('src', rearImage);
    expect(screen.queryByText(/Distributor Notice/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Shenzhen Huiyi/i)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Plasma Cleaner Buying Guide/i })).toHaveAttribute(
      'href',
      '/insights/plasma-cleaner-buying-guide'
    );
  });
});
