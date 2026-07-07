import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { PlutoT } from './PlutoT';

const addToCart = vi.fn();
const heroImage = '/assets/images/redesign/products/pluto-t-standardized.webp';
const chamberImage = '/assets/images/redesign/products/pluto-t-chamber.webp';
const samplesImage = '/assets/images/redesign/products/pluto-t-samples.webp';
const withPumpImage = '/assets/images/redesign/products/pluto-t-with-pump.webp';

vi.mock('../../hooks/useProductPage', () => ({
  useProductPage: () => ({ addToCart }),
}));

vi.mock('../common/DownloadGateModal', () => ({
  DownloadGateModal: () => null,
}));

function renderPlutoT(initialEntry = '/products/pluto-t') {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <PlutoT />
      </MemoryRouter>
    </HelmetProvider>
  );
}

function getProductJsonLd() {
  return Array.from(document.head.querySelectorAll('script[type="application/ld+json"]'))
    .map(script => JSON.parse(script.textContent ?? '{}'))
    .find(data => data['@type'] === 'Product');
}

describe('PlutoT commerce product page', () => {
  it('renders a single RF variant and adds it to cart', async () => {
    const user = userEvent.setup();
    renderPlutoT();

    expect(screen.getByRole('heading', { level: 1, name: 'PLUTO-T Compact RF Plasma Cleaner' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'PLUTO-T compact RF plasma cleaner' })).toHaveAttribute('src', heroImage);
    expect(screen.getByRole('button', { name: 'RF (13.56 MHz)' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('heading', { level: 3, name: 'How is PLUTO-T different from HY-4L?' })).toBeInTheDocument();
    expect(screen.getByText('$9,999')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add to Cart' }));
    expect(addToCart).toHaveBeenCalledWith(expect.objectContaining({
      id: 'pluto-t',
      sku: 'pluto-t',
      name: 'PLUTO-T - 200W RF Plasma Cleaner',
      price: 9999,
      image: heroImage,
    }));
  });

  it('uses single-variant Offer schema with stable canonical identity', async () => {
    renderPlutoT();

    await waitFor(() => {
      expect(getProductJsonLd()['@id']).toBe('https://ninescrolls.com/products/pluto-t#product');
      expect(getProductJsonLd().image).toEqual(['https://ninescrolls.com/assets/images/redesign/products/pluto-t-standardized.webp']);
      expect(getProductJsonLd().offers).toMatchObject({
        '@type': 'Offer',
        price: '9999',
        priceCurrency: 'USD',
        url: 'https://ninescrolls.com/products/pluto-t',
      });
    });
    expect(getProductJsonLd().offers.priceValidUntil).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(getProductJsonLd().offers).not.toHaveProperty('lowPrice');
    expect(getProductJsonLd().offers).not.toHaveProperty('offerCount');
  });

  it('renders the specification table from the legacy datasheet values', () => {
    renderPlutoT();

    const specs = screen.getByTestId('pluto-t-specifications');
    expect(specs.tagName).toBe('DL');
    expect(screen.getByText('0-200 W, 1 W precision')).toBeInTheDocument();
    expect(screen.getByText('~4.3 L stainless steel')).toBeInTheDocument();
  });

  it('keeps gallery, quote path, verified resources, and no OEM or unverified citation copy', () => {
    renderPlutoT();

    const quoteLinks = screen.getAllByRole('link', { name: 'Request a Budgetary Quote' });
    expect(quoteLinks.some(link => link.getAttribute('href') === '/request-quote?products=pluto-t')).toBe(true);
    expect(screen.getByRole('img', { name: 'PLUTO-T chamber interior with flat plate electrode' })).toHaveAttribute('src', chamberImage);
    expect(screen.getByRole('img', { name: 'PLUTO-T sample tray with wafer during plasma processing' })).toHaveAttribute('src', samplesImage);
    expect(screen.getByRole('img', { name: 'PLUTO-T complete system with vacuum pump' })).toHaveAttribute('src', withPumpImage);
    expect(screen.queryByText(/Distributor Notice/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Shanghai Peiyuan/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/20\+ peer-reviewed/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/supplier-provided/i)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /PLUTO vs HY Comparison/i })).toHaveAttribute(
      'href',
      '/insights/pluto-vs-hy-plasma-cleaner-comparison'
    );
  });
});
