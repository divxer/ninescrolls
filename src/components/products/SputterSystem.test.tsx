import { render, screen, waitFor, within } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { SputterSystem } from './SputterSystem';

vi.mock('../common/DownloadGateModal', () => ({
  DownloadGateModal: () => null,
}));

function renderPage() {
  return render(
    <HelmetProvider>
      <MemoryRouter>
        <SputterSystem />
      </MemoryRouter>
    </HelmetProvider>
  );
}

describe('SputterSystem redesigned product page', () => {
  it('renders Sputter through the shared product detail template', () => {
    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'PVD Magnetron Sputtering Platform' })).toBeInTheDocument();
    expect(screen.getByAltText('NineScrolls PVD magnetron sputtering platform')).toHaveAttribute(
      'src',
      '/assets/images/redesign/products/sputter-standardized.webp'
    );
    expect(screen.getByRole('heading', { level: 3, name: 'What materials can the Sputter platform deposit?' })).toBeInTheDocument();
    expect(document.body.querySelector('main')).not.toBeInTheDocument();
  });

  it('uses verified Sputter specifications from the equipment summary', () => {
    renderPage();

    const specs = screen.getByTestId('sputter-specifications');

    expect(specs.tagName).toBe('DL');
    expect(within(specs).getByText('Wafer Size')).toBeInTheDocument();
    expect(within(specs).getByText('4-12 in')).toBeInTheDocument();
    expect(within(specs).getByText('Targets')).toBeInTheDocument();
    expect(within(specs).getByText('2-6 configurable')).toBeInTheDocument();
    expect(within(specs).getByText('Substrate Temperature')).toBeInTheDocument();
    expect(within(specs).getByText('Water-cooled to 1200 C')).toBeInTheDocument();
    expect(within(specs).getByText('Base Pressure')).toBeInTheDocument();
    expect(within(specs).getByText('<5x10^-7 Torr')).toBeInTheDocument();
    expect(within(specs).getByText('Uniformity')).toBeInTheDocument();
    expect(within(specs).getByText('< +/-5%')).toBeInTheDocument();
  });

  it('keeps Sputter conversion and comparison paths visible', () => {
    renderPage();

    expect(screen.getByRole('link', { name: 'Request Quote' })).toHaveAttribute('href', '/request-quote?products=sputter');
    expect(screen.getByRole('link', { name: 'Talk to an Engineer' })).toHaveAttribute('href', '/contact?topic=expert&product=sputter');
    expect(screen.getByRole('link', { name: 'Compare E-Beam Evaporation' })).toHaveAttribute('href', '/products/e-beam-evaporator');
  });

  it('uses real Sputter-related resource slugs', () => {
    renderPage();

    expect(screen.getByRole('link', { name: /Magnetron Sputtering Guide/i })).toHaveAttribute(
      'href',
      '/insights/magnetron-sputtering-guide'
    );
    expect(screen.getByRole('link', { name: /E-Beam vs Thermal vs Sputter/i })).toHaveAttribute(
      'href',
      '/insights/e-beam-vs-thermal-vs-sputter-pvd-system-selection'
    );
    expect(screen.getByRole('link', { name: /PECVD vs ALD vs Sputtering/i })).toHaveAttribute(
      'href',
      '/insights/pecvd-vs-ald-vs-sputtering-comparison'
    );
  });

  it('derives title, canonical, and product schema URLs from the Sputter slug', async () => {
    renderPage();

    await waitFor(() => {
      expect(document.title).toBe('PVD Magnetron Sputtering Platform | NineScrolls LLC');
      expect(document.head.querySelector('link[rel="canonical"]')).toHaveAttribute(
        'href',
        'https://ninescrolls.com/products/sputter'
      );
    });

    const productSchema = Array.from(document.head.querySelectorAll('script[type="application/ld+json"]'))
      .map(script => JSON.parse(script.textContent ?? '{}') as { '@type'?: string; '@id'?: string; offers?: { url?: string } })
      .find(schema => schema['@type'] === 'Product');

    expect(productSchema).toMatchObject({
      '@id': 'https://ninescrolls.com/products/sputter#product',
      offers: {
        url: 'https://ninescrolls.com/products/sputter',
      },
    });
  });
});
