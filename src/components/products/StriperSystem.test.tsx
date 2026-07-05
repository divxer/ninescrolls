import { render, screen, waitFor, within } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { StriperSystem } from './StriperSystem';

vi.mock('../common/DownloadGateModal', () => ({
  DownloadGateModal: () => null,
}));

function renderPage() {
  return render(
    <HelmetProvider>
      <MemoryRouter>
        <StriperSystem />
      </MemoryRouter>
    </HelmetProvider>
  );
}

describe('StriperSystem redesigned product page', () => {
  it('renders Striper through the shared product detail template', () => {
    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'Plasma Photoresist Stripping Platform' })).toBeInTheDocument();
    expect(screen.getByAltText('NineScrolls plasma photoresist stripping system')).toHaveAttribute(
      'src',
      '/assets/images/redesign/products/striper-standardized.webp'
    );
    expect(document.body.querySelector('main')).not.toBeInTheDocument();
  });

  it('uses verified Striper specifications from the equipment summary', () => {
    renderPage();

    const specs = screen.getByTestId('striper-specifications');

    expect(specs.tagName).toBe('DL');
    expect(within(specs).getByText('Wafer Size')).toBeInTheDocument();
    expect(within(specs).getByText('4-12 in')).toBeInTheDocument();
    expect(within(specs).getByText('RF Power')).toBeInTheDocument();
    expect(within(specs).getByText('300-1000 W')).toBeInTheDocument();
    expect(within(specs).getByText('Temperature')).toBeInTheDocument();
    expect(within(specs).getByText('5 to 200 C')).toBeInTheDocument();
    expect(within(specs).getByText('Endpoint Detection')).toBeInTheDocument();
    expect(within(specs).getByText('Automated')).toBeInTheDocument();
    expect(within(specs).getByText('Footprint')).toBeInTheDocument();
    expect(within(specs).getByText('Approx. 0.8m x 0.8m')).toBeInTheDocument();
  });

  it('keeps Striper conversion and comparison paths visible', () => {
    renderPage();

    expect(screen.getByRole('link', { name: 'Request Quote' })).toHaveAttribute('href', '/request-quote?products=striper');
    expect(screen.getByRole('link', { name: 'Talk to an Engineer' })).toHaveAttribute('href', '/contact?topic=expert&product=striper');
    expect(screen.getByRole('link', { name: 'Compare Plasma Cleaners' })).toHaveAttribute('href', '/products/plasma-cleaner');
  });

  it('uses real Striper resource slugs and omits unverified research claims', () => {
    renderPage();

    expect(screen.queryByText('Trusted by Leading Research Labs')).not.toBeInTheDocument();
    expect(screen.queryByText('60+')).not.toBeInTheDocument();
    expect(screen.queryByText('2800+')).not.toBeInTheDocument();

    expect(screen.getByRole('link', { name: /Plasma Stripping & Ashing Guide/i })).toHaveAttribute(
      'href',
      '/insights/plasma-stripping-ashing-guide'
    );
    expect(screen.getByRole('link', { name: /Stripping Equipment Selection Guide/i })).toHaveAttribute(
      'href',
      '/insights/plasma-stripping-equipment-selection-guide'
    );
    expect(screen.getByRole('link', { name: /Post-Etch Cleaning & Residue Removal/i })).toHaveAttribute(
      'href',
      '/insights/post-etch-cleaning-residue-removal'
    );
  });

  it('derives title, canonical, product schema URLs, and schema image from the Striper config', async () => {
    renderPage();

    await waitFor(() => {
      expect(document.title).toBe('Plasma Photoresist Stripping Platform | NineScrolls LLC');
      expect(document.head.querySelector('link[rel="canonical"]')).toHaveAttribute(
        'href',
        'https://ninescrolls.com/products/striper'
      );
    });

    const productSchema = Array.from(document.head.querySelectorAll('script[type="application/ld+json"]'))
      .map(script => JSON.parse(script.textContent ?? '{}') as { '@type'?: string; '@id'?: string; image?: string[]; offers?: { url?: string } })
      .find(schema => schema['@type'] === 'Product');

    expect(productSchema).toMatchObject({
      '@id': 'https://ninescrolls.com/products/striper#product',
      image: ['https://ninescrolls.com/assets/images/redesign/products/striper-standardized.webp'],
      offers: {
        url: 'https://ninescrolls.com/products/striper',
      },
    });
  });
});
