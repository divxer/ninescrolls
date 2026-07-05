import { render, screen, waitFor, within } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { CompactRIE } from './CompactRIE';

vi.mock('../common/DownloadGateModal', () => ({
  DownloadGateModal: () => null,
}));

function renderPage() {
  return render(
    <HelmetProvider>
      <MemoryRouter>
        <CompactRIE />
      </MemoryRouter>
    </HelmetProvider>
  );
}

describe('CompactRIE redesigned product page', () => {
  it('renders Compact RIE through the shared product detail template', () => {
    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'Compact Benchtop RIE Etcher (SV-RIE)' })).toBeInTheDocument();
    expect(screen.getByTestId('product-detail-hero-background')).toHaveStyle({
      backgroundImage:
        "linear-gradient(90deg,rgba(7,10,15,1) 0%,rgba(7,10,15,0.94) 42%,rgba(7,10,15,0.55) 100%),url('/assets/images/redesign/products/compact-rie-scene-lab.webp')",
    });
    expect(screen.getByAltText('NineScrolls Compact RIE SV-RIE platform')).toHaveAttribute(
      'src',
      '/assets/images/redesign/products/compact-rie-standardized.webp'
    );
    expect(document.body.querySelector('main')).not.toBeInTheDocument();
  });

  it('uses verified Compact RIE specifications from the equipment summary', () => {
    renderPage();

    const specs = screen.getByTestId('compact-rie-specifications');

    expect(specs.tagName).toBe('DL');
    expect(within(specs).getByText('Models')).toBeInTheDocument();
    expect(within(specs).getByText('SHL100SV-RIE / SHL150SV-RIE / SHL200SV-RIE')).toBeInTheDocument();
    expect(within(specs).getByText('Wafer Size')).toBeInTheDocument();
    expect(within(specs).getByText('4-12 in')).toBeInTheDocument();
    expect(within(specs).getByText('RF Power')).toBeInTheDocument();
    expect(within(specs).getByText('300-1000 W')).toBeInTheDocument();
    expect(within(specs).getByText('Footprint')).toBeInTheDocument();
    expect(within(specs).getByText('630mm x 600mm')).toBeInTheDocument();
  });

  it('keeps Compact RIE conversion and comparison paths visible', () => {
    renderPage();

    expect(screen.getByRole('link', { name: 'Request Quote' })).toHaveAttribute('href', '/request-quote?products=compact-rie');
    expect(screen.getByRole('link', { name: 'Talk to an Engineer' })).toHaveAttribute('href', '/contact?topic=expert&product=compact-rie');
    expect(screen.getByRole('link', { name: 'Compare RIE' })).toHaveAttribute('href', '/products/rie-etcher');
  });

  it('uses real Compact RIE resource slugs and omits unverified research claims', () => {
    renderPage();

    expect(screen.queryByText('Trusted by Leading Research Labs')).not.toBeInTheDocument();
    expect(screen.queryByText('60+')).not.toBeInTheDocument();
    expect(screen.queryByText('2800+')).not.toBeInTheDocument();

    expect(screen.getByRole('link', { name: /Reactive Ion Etching Guide/i })).toHaveAttribute(
      'href',
      '/insights/reactive-ion-etching-guide'
    );
    expect(screen.getByRole('link', { name: /Semiconductor Etchers Overview/i })).toHaveAttribute(
      'href',
      '/insights/semiconductor-etchers-overview'
    );
    expect(screen.getByRole('link', { name: /PE vs RIE vs ICP-RIE/i })).toHaveAttribute(
      'href',
      '/insights/understanding-differences-pe-rie-icp-rie-plasma-etching'
    );
  });

  it('derives title, canonical, product schema URLs, and schema image from the Compact RIE config', async () => {
    renderPage();

    await waitFor(() => {
      expect(document.title).toBe('Compact Benchtop RIE Etcher (SV-RIE) | NineScrolls LLC');
      expect(document.head.querySelector('link[rel="canonical"]')).toHaveAttribute(
        'href',
        'https://ninescrolls.com/products/compact-rie'
      );
    });

    const productSchema = Array.from(document.head.querySelectorAll('script[type="application/ld+json"]'))
      .map(script => JSON.parse(script.textContent ?? '{}') as { '@type'?: string; '@id'?: string; image?: string[]; offers?: { url?: string } })
      .find(schema => schema['@type'] === 'Product');

    expect(productSchema).toMatchObject({
      '@id': 'https://ninescrolls.com/products/compact-rie#product',
      image: ['https://ninescrolls.com/assets/images/redesign/products/compact-rie-standardized.webp'],
      offers: {
        url: 'https://ninescrolls.com/products/compact-rie',
      },
    });
  });
});
