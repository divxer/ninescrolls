import { render, screen, waitFor, within } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { PECVDSystem } from './PECVDSystem';

vi.mock('../common/DownloadGateModal', () => ({
  DownloadGateModal: () => null,
}));

function renderPage() {
  return render(
    <HelmetProvider>
      <MemoryRouter>
        <PECVDSystem />
      </MemoryRouter>
    </HelmetProvider>
  );
}

describe('PECVDSystem redesigned product page', () => {
  it('renders PECVD through the shared product detail template', () => {
    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'PECVD Thin Film Deposition Platform' })).toBeInTheDocument();
    expect(screen.getByAltText('NineScrolls PECVD thin film deposition platform')).toHaveAttribute(
      'src',
      '/assets/images/redesign/products/pecvd-standardized.webp'
    );
    expect(document.body.querySelector('main')).not.toBeInTheDocument();
  });

  it('uses verified PECVD specifications from the equipment summary', () => {
    renderPage();

    const specs = screen.getByTestId('pecvd-specifications');

    expect(specs.tagName).toBe('DL');
    expect(within(specs).getByText('Wafer Size')).toBeInTheDocument();
    expect(within(specs).getByText('4-12 in')).toBeInTheDocument();
    expect(within(specs).getByText('RF Power')).toBeInTheDocument();
    expect(within(specs).getByText('500-2000 W')).toBeInTheDocument();
    expect(within(specs).getByText('Temperature')).toBeInTheDocument();
    expect(within(specs).getByText('20 to 400 C')).toBeInTheDocument();
    expect(within(specs).getByText('Gas System')).toBeInTheDocument();
    expect(within(specs).getByText('Up to 6 gas lines')).toBeInTheDocument();
    expect(within(specs).getByText('Uniformity')).toBeInTheDocument();
    expect(within(specs).getByText('<5%')).toBeInTheDocument();
  });

  it('keeps PECVD conversion and comparison paths visible', () => {
    renderPage();

    expect(screen.getByRole('link', { name: 'Request Quote' })).toHaveAttribute('href', '/request-quote?products=pecvd');
    expect(screen.getByRole('link', { name: 'Talk to an Engineer' })).toHaveAttribute('href', '/contact?topic=expert&product=pecvd');
    expect(screen.getByRole('link', { name: 'Compare ALD' })).toHaveAttribute('href', '/products/ald');
  });

  it('uses real PECVD-related resource slugs', () => {
    renderPage();

    expect(screen.getByRole('link', { name: /PECVD Complete Guide/i })).toHaveAttribute(
      'href',
      '/insights/pecvd-complete-guide-plasma-enhanced-cvd'
    );
    expect(screen.getByRole('link', { name: /PECVD vs ALD vs Sputtering/i })).toHaveAttribute(
      'href',
      '/insights/pecvd-vs-ald-vs-sputtering-comparison'
    );
    expect(screen.getByRole('link', { name: /HDP-CVD Applications/i })).toHaveAttribute(
      'href',
      '/insights/hdp-cvd-applications-gap-fill-dielectrics'
    );
  });

  it('derives title, canonical, and product schema URLs from the PECVD slug', async () => {
    renderPage();

    await waitFor(() => {
      expect(document.title).toBe('PECVD Thin Film Deposition Platform | NineScrolls LLC');
      expect(document.head.querySelector('link[rel="canonical"]')).toHaveAttribute(
        'href',
        'https://ninescrolls.com/products/pecvd'
      );
    });

    const productSchema = Array.from(document.head.querySelectorAll('script[type="application/ld+json"]'))
      .map(script => JSON.parse(script.textContent ?? '{}') as { '@type'?: string; '@id'?: string; offers?: { url?: string } })
      .find(schema => schema['@type'] === 'Product');

    expect(productSchema).toMatchObject({
      '@id': 'https://ninescrolls.com/products/pecvd#product',
      offers: {
        url: 'https://ninescrolls.com/products/pecvd',
      },
    });
  });
});
