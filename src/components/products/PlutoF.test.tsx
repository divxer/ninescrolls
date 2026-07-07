import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { PlutoF } from './PlutoF';

const addToCart = vi.fn();
const heroImage = '/assets/images/redesign/products/pluto-f-standardized.webp';
const chamberOpenImage = '/assets/images/redesign/products/pluto-f-chamber-open.webp';
const chamberInteriorImage = '/assets/images/redesign/products/pluto-f-chamber-interior.webp';
const withPumpImage = '/assets/images/redesign/products/pluto-f-with-pump.webp';

vi.mock('../../hooks/useProductPage', () => ({
  useProductPage: () => ({ addToCart }),
}));

vi.mock('../common/DownloadGateModal', () => ({
  DownloadGateModal: () => null,
}));

function renderPlutoF(initialEntry = '/products/pluto-f') {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <PlutoF />
      </MemoryRouter>
    </HelmetProvider>
  );
}

function getProductJsonLd() {
  return Array.from(document.head.querySelectorAll('script[type="application/ld+json"]'))
    .map(script => JSON.parse(script.textContent ?? '{}'))
    .find(data => data['@type'] === 'Product');
}

describe('PlutoF commerce product page', () => {
  it('renders a single RF variant and adds it to cart', async () => {
    const user = userEvent.setup();
    renderPlutoF();

    expect(screen.getByRole('heading', { level: 1, name: 'PLUTO-F Flagship RF Plasma Cleaner' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'PLUTO-F flagship RF plasma cleaner' })).toHaveAttribute('src', heroImage);
    expect(screen.getByRole('button', { name: 'RF (13.56 MHz)' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('heading', { level: 3, name: 'How is PLUTO-F different from PLUTO-M?' })).toBeInTheDocument();
    expect(screen.getByText('$15,999')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add to Cart' }));
    expect(addToCart).toHaveBeenCalledWith(expect.objectContaining({
      id: 'pluto-f',
      sku: 'pluto-f',
      name: 'PLUTO-F - 500W RF Flagship Plasma Cleaner',
      price: 15999,
      image: heroImage,
    }));
  });

  it('uses single-variant Offer schema with stable canonical identity', async () => {
    renderPlutoF();

    await waitFor(() => {
      expect(getProductJsonLd()['@id']).toBe('https://ninescrolls.com/products/pluto-f#product');
      expect(getProductJsonLd().image).toEqual(['https://ninescrolls.com/assets/images/redesign/products/pluto-f-standardized.webp']);
      expect(getProductJsonLd().offers).toMatchObject({
        '@type': 'Offer',
        price: '15999',
        priceCurrency: 'USD',
        url: 'https://ninescrolls.com/products/pluto-f',
      });
    });
    expect(getProductJsonLd().offers.priceValidUntil).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(getProductJsonLd().offers).not.toHaveProperty('lowPrice');
    expect(getProductJsonLd().offers).not.toHaveProperty('offerCount');
  });

  it('renders the specification table from the legacy datasheet values', () => {
    renderPlutoF();

    const specs = screen.getByTestId('pluto-f-specifications');
    expect(specs.tagName).toBe('DL');
    expect(screen.getByText('~14.5 L, 6061-T6 aluminum alloy')).toBeInTheDocument();
    expect(screen.getByText('0-500 W, 1 W precision')).toBeInTheDocument();
    expect(screen.getByText('205 x 205 mm flat plate')).toBeInTheDocument();
  });

  it('keeps gallery, quote path, verified resources, and no OEM or unverifiable superlative copy', () => {
    renderPlutoF();

    const quoteLinks = screen.getAllByRole('link', { name: 'Request a Budgetary Quote' });
    expect(quoteLinks.some(link => link.getAttribute('href') === '/request-quote?products=pluto-f')).toBe(true);
    expect(screen.getByRole('img', { name: 'PLUTO-F open chamber with batch tray' })).toHaveAttribute('src', chamberOpenImage);
    expect(screen.getByRole('img', { name: 'PLUTO-F chamber interior with flat plate electrode' })).toHaveAttribute('src', chamberInteriorImage);
    expect(screen.getByRole('img', { name: 'PLUTO-F complete system with vacuum pump' })).toHaveAttribute('src', withPumpImage);
    expect(screen.queryByText(/Distributor Notice/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Shanghai Peiyuan/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/under \$20K/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/highest in its class/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/supplier-provided/i)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /PLUTO vs HY Comparison/i })).toHaveAttribute(
      'href',
      '/insights/pluto-vs-hy-plasma-cleaner-comparison'
    );
  });
});
