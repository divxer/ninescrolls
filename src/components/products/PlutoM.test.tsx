import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { PlutoM } from './PlutoM';

const addToCart = vi.fn();
const heroImage = '/assets/images/redesign/products/pluto-m-standardized.webp';
const chamberImage = '/assets/images/redesign/products/pluto-m-chamber-open.webp';
const withPumpImage = '/assets/images/redesign/products/pluto-m-with-pump.webp';

vi.mock('../../hooks/useProductPage', () => ({
  useProductPage: () => ({ addToCart }),
}));

vi.mock('../common/DownloadGateModal', () => ({
  DownloadGateModal: () => null,
}));

function renderPlutoM(initialEntry = '/products/pluto-m') {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <PlutoM />
      </MemoryRouter>
    </HelmetProvider>
  );
}

function getProductJsonLd() {
  return Array.from(document.head.querySelectorAll('script[type="application/ld+json"]'))
    .map(script => JSON.parse(script.textContent ?? '{}'))
    .find(data => data['@type'] === 'Product');
}

describe('PlutoM commerce product page', () => {
  it('renders a single RF variant and adds it to cart', async () => {
    const user = userEvent.setup();
    renderPlutoM();

    expect(screen.getByRole('heading', { level: 1, name: 'PLUTO-M Mid-Capacity RF Plasma Cleaner' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'PLUTO-M mid-capacity RF plasma cleaner' })).toHaveAttribute('src', heroImage);
    expect(screen.getByRole('button', { name: 'RF (13.56 MHz)' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('$12,999')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add to Cart' }));
    expect(addToCart).toHaveBeenCalledWith(expect.objectContaining({
      id: 'pluto-m',
      sku: 'pluto-m',
      name: 'PLUTO-M - 200W RF Plasma Cleaner with 8L Chamber',
      price: 12999,
      image: heroImage,
    }));
  });

  it('uses single-variant Offer schema with stable canonical identity', async () => {
    renderPlutoM();

    await waitFor(() => {
      expect(getProductJsonLd()['@id']).toBe('https://ninescrolls.com/products/pluto-m#product');
      expect(getProductJsonLd().image).toEqual(['https://ninescrolls.com/assets/images/redesign/products/pluto-m-standardized.webp']);
      expect(getProductJsonLd().offers).toMatchObject({
        '@type': 'Offer',
        price: '12999',
        priceCurrency: 'USD',
        url: 'https://ninescrolls.com/products/pluto-m',
      });
    });
    expect(getProductJsonLd().offers.priceValidUntil).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(getProductJsonLd().offers).not.toHaveProperty('lowPrice');
    expect(getProductJsonLd().offers).not.toHaveProperty('offerCount');
  });

  it('renders the specification table from the legacy datasheet values', () => {
    renderPlutoM();

    const specs = screen.getByTestId('pluto-m-specifications');
    expect(specs.tagName).toBe('DL');
    expect(screen.getByText('~8 L stainless steel')).toBeInTheDocument();
    expect(screen.getByText('125 x 125 mm perforated gas-shower plate')).toBeInTheDocument();
    expect(screen.getByText('VRD-4 two-stage oil pump, 4 m3/h')).toBeInTheDocument();
  });

  it('keeps gallery, quote path, verified resources, and no OEM or unverified comparison copy', () => {
    renderPlutoM();

    const quoteLinks = screen.getAllByRole('link', { name: 'Request a Budgetary Quote' });
    expect(quoteLinks.some(link => link.getAttribute('href') === '/request-quote?products=pluto-m')).toBe(true);
    expect(screen.getByRole('img', { name: 'PLUTO-M open chamber with gas-shower electrode' })).toHaveAttribute('src', chamberImage);
    expect(screen.getByRole('img', { name: 'PLUTO-M complete system with vacuum pump' })).toHaveAttribute('src', withPumpImage);
    expect(screen.queryByText(/Distributor Notice/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Shanghai Peiyuan/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Less Than HY-20LRF/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/supplier-provided/i)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /PLUTO vs HY Comparison/i })).toHaveAttribute(
      'href',
      '/insights/pluto-vs-hy-plasma-cleaner-comparison'
    );
  });
});
